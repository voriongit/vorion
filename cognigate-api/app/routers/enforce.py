"""
ENFORCE endpoints - Policy validation and gating.

The ENFORCE layer validates plans against BASIS policies.
It gates execution paths and mandates human approval when boundaries are tested.

Security Layers Applied:
- L0-L2: Velocity caps (rate limiting)
- L5+: Circuit breaker (system halt on threshold breach)
- Policy Engine: BASIS constraint evaluation
"""

import time
import structlog
from fastapi import APIRouter

from app.models.enforce import EnforceRequest, EnforceResponse, PolicyViolation, RigorMode
from app.models.intent import StructuredPlan
from app.core.velocity import check_velocity, record_action, VelocityCheckResult
from app.core.circuit_breaker import (
    circuit_breaker,
    CircuitState,
)
from app.core.cache import cache_manager
from app.core.async_logger import async_log_queue

logger = structlog.get_logger()
router = APIRouter()


# Rigor mode mapping by trust level
# L0-L2: STRICT (low trust needs maximum scrutiny)
# L3: STANDARD (medium trust gets standard enforcement)
# L4-L5: LITE (high trust can skip non-critical checks)
DEFAULT_RIGOR_BY_TRUST = {
    0: RigorMode.STRICT,    # L0: Sandbox
    1: RigorMode.STRICT,    # L1: Supervised
    2: RigorMode.STRICT,    # L2: Assisted
    3: RigorMode.STANDARD,  # L3: Standard/Trusted
    4: RigorMode.LITE,      # L4: Trusted/Certified
}


def determine_rigor_mode(trust_level: int, requested_mode: RigorMode | None) -> RigorMode:
    """
    Determine enforcement rigor mode.

    Args:
        trust_level: Entity's trust level (0-4)
        requested_mode: Explicitly requested mode (optional)

    Returns:
        RigorMode to use for enforcement
    """
    if requested_mode:
        return requested_mode

    # Auto-select based on trust level
    return DEFAULT_RIGOR_BY_TRUST.get(trust_level, RigorMode.STANDARD)


# Policy severity classification for rigor filtering
CRITICAL_POLICIES = {
    "basis-core-security",      # Security violations
    "basis-risk-thresholds",    # Risk limits
}

STANDARD_POLICIES = {
    "basis-core-security",
    "basis-data-protection",
    "basis-risk-thresholds",
}

# STRICT includes all policies (current behavior)


def filter_policies_by_rigor(
    policies: list[str],
    rigor: RigorMode
) -> list[str]:
    """
    Filter policy list based on rigor mode.

    Args:
        policies: Full list of policies to check
        rigor: Rigor mode

    Returns:
        Filtered list of policies to evaluate
    """
    if rigor == RigorMode.STRICT:
        # STRICT: Check all policies
        return policies

    if rigor == RigorMode.STANDARD:
        # STANDARD: Check all standard policies
        return [p for p in policies if p in STANDARD_POLICIES]

    if rigor == RigorMode.LITE:
        # LITE: Check only critical policies
        return [p for p in policies if p in CRITICAL_POLICIES]

    return policies


# Mock BASIS policies (in production, loaded from basis-core)
MOCK_POLICIES = {
    "basis-core-security": {
        "name": "BASIS Core Security",
        "constraints": [
            {
                "id": "no-shell-low-trust",
                "type": "tool_restriction",
                "condition": "shell in tools_required and trust_level < 3",
                "severity": "critical",
                "message": "Shell execution requires Verified (L3) trust level",
            },
            {
                "id": "no-delete-without-approval",
                "type": "tool_restriction",
                "condition": "file_delete in tools_required",
                "severity": "high",
                "message": "File deletion requires human approval",
                "requires_approval": True,
            },
        ],
    },
    "basis-data-protection": {
        "name": "BASIS Data Protection",
        "constraints": [
            {
                "id": "pii-requires-l2",
                "type": "data_protection",
                "condition": "any pii_* in data_classifications and trust_level < 2",
                "severity": "critical",
                "message": "PII access requires Trusted (L2) trust level",
            },
            {
                "id": "credentials-audit",
                "type": "data_protection",
                "condition": "credentials in data_classifications",
                "severity": "high",
                "message": "Credential access requires audit logging",
            },
        ],
    },
    "basis-risk-thresholds": {
        "name": "BASIS Risk Thresholds",
        "constraints": [
            {
                "id": "high-risk-block",
                "type": "risk_threshold",
                "condition": "risk_score > 0.8",
                "severity": "critical",
                "message": "Risk score exceeds maximum threshold (0.8)",
            },
            {
                "id": "medium-risk-escalate",
                "type": "risk_threshold",
                "condition": "risk_score > 0.5 and trust_level < 3",
                "severity": "high",
                "message": "Medium-high risk requires elevated trust or approval",
                "requires_approval": True,
            },
        ],
    },
}


def evaluate_constraint(
    constraint: dict, plan: StructuredPlan, trust_level: int
) -> PolicyViolation | None:
    """
    Evaluate a single constraint against a plan.
    Returns a violation if the constraint is violated, None otherwise.
    """
    condition = constraint["condition"]

    # Simple condition parser (in production, use proper expression evaluation)
    violated = False

    # Tool restrictions
    if "shell in tools_required" in condition:
        if "shell" in plan.tools_required:
            if "trust_level < 3" in condition and trust_level < 3:
                violated = True
            elif "trust_level" not in condition:
                violated = True

    if "file_delete in tools_required" in condition:
        if "file_delete" in plan.tools_required:
            violated = True

    # Data protection
    if "pii_* in data_classifications" in condition:
        pii_types = [d for d in plan.data_classifications if d.startswith("pii_")]
        if pii_types:
            if "trust_level < 2" in condition and trust_level < 2:
                violated = True

    if "credentials in data_classifications" in condition:
        if "credentials" in plan.data_classifications:
            violated = True

    # Risk thresholds
    if "risk_score > 0.8" in condition:
        if plan.risk_score > 0.8:
            violated = True

    if "risk_score > 0.5" in condition and "trust_level < 3" in condition:
        if plan.risk_score > 0.5 and trust_level < 3:
            violated = True

    if violated:
        return PolicyViolation(
            policy_id=constraint.get("policy_id", "unknown"),
            constraint_id=constraint["id"],
            severity=constraint["severity"],
            message=constraint["message"],
            blocked=constraint["severity"] == "critical",
            remediation=constraint.get("remediation"),
        )

    return None


@router.post("/enforce", response_model=EnforceResponse)
async def enforce_policies(request: EnforceRequest) -> EnforceResponse:
    """
    Validate a plan against BASIS policies.

    This endpoint:
    1. CIRCUIT BREAKER - Check if system is halted
    2. VELOCITY CAPS - Check rate limits (L0-L2)
    3. Receives a structured plan from INTENT
    4. Evaluates it against applicable BASIS policies
    5. Returns a verdict (allow/deny/escalate/modify)
    6. Records metrics for circuit breaker monitoring
    7. Logs the decision for PROOF

    If violations are found:
    - Critical: Plan is DENIED
    - High: Plan requires human approval (ESCALATE)
    - Medium/Low: Plan may proceed with audit logging
    """
    start_time = time.perf_counter()

    # Use async logger for high-frequency informational logs
    await async_log_queue.info(
        "enforce_request",
        entity_id=request.entity_id,
        plan_id=request.plan.plan_id,
        trust_level=request.trust_level,
    )

    # ========================================================================
    # LAYER 1: CIRCUIT BREAKER CHECK (System-level halt)
    # ========================================================================
    circuit_allowed, circuit_reason = circuit_breaker.allow_request(request.entity_id)
    if not circuit_allowed:
        logger.warning(
            "enforce_circuit_blocked",
            entity_id=request.entity_id,
            reason=circuit_reason,
        )
        duration_ms = (time.perf_counter() - start_time) * 1000
        return EnforceResponse(
            intent_id=f"int_{request.plan.plan_id[5:]}",
            plan_id=request.plan.plan_id,
            allowed=False,
            action="deny",
            violations=[
                PolicyViolation(
                    policy_id="system-circuit-breaker",
                    constraint_id="system-halt",
                    severity="critical",
                    message=f"CIRCUIT BREAKER: {circuit_reason}",
                    blocked=True,
                )
            ],
            policies_evaluated=["system-circuit-breaker"],
            constraints_evaluated=1,
            trust_impact=-100,
            requires_approval=False,
            rigor_mode=RigorMode.STRICT,  # Circuit breaker always uses STRICT
            duration_ms=duration_ms,
        )

    # ========================================================================
    # LAYER 2: VELOCITY CAP CHECK (L0-L2 Rate Limiting)
    # ========================================================================
    velocity_result = await check_velocity(request.entity_id, request.trust_level)
    if not velocity_result.allowed:
        logger.warning(
            "enforce_velocity_blocked",
            entity_id=request.entity_id,
            tier=velocity_result.tier_violated.value if velocity_result.tier_violated else None,
            message=velocity_result.message,
        )

        # Record velocity violation for circuit breaker
        circuit_breaker.record_request(
            entity_id=request.entity_id,
            velocity_violated=True,
        )

        duration_ms = (time.perf_counter() - start_time) * 1000
        return EnforceResponse(
            intent_id=f"int_{request.plan.plan_id[5:]}",
            plan_id=request.plan.plan_id,
            allowed=False,
            action="deny",
            violations=[
                PolicyViolation(
                    policy_id="system-velocity-caps",
                    constraint_id=velocity_result.tier_violated.value if velocity_result.tier_violated else "unknown",
                    severity="high",
                    message=velocity_result.message,
                    blocked=True,
                    remediation=f"Retry after {velocity_result.retry_after_seconds:.1f} seconds" if velocity_result.retry_after_seconds else None,
                )
            ],
            policies_evaluated=["system-velocity-caps"],
            constraints_evaluated=1,
            trust_impact=-5,
            requires_approval=False,
            rigor_mode=RigorMode.STRICT,  # Velocity violations always use STRICT
            duration_ms=duration_ms,
        )

    # Record successful velocity check (action will be recorded after decision)

    # ========================================================================
    # DETERMINE RIGOR MODE (Proportional enforcement based on trust)
    # ========================================================================
    rigor_mode = determine_rigor_mode(request.trust_level, request.rigor_mode)

    await async_log_queue.info(
        "enforce_rigor_mode",
        entity_id=request.entity_id,
        trust_level=request.trust_level,
        rigor_mode=rigor_mode.value,
    )

    # ========================================================================
    # CACHE CHECK: Try to get cached policy result
    # ========================================================================
    policies_to_check = request.policy_ids or list(MOCK_POLICIES.keys())

    # Filter policies based on rigor mode
    policies_to_check = filter_policies_by_rigor(policies_to_check, rigor_mode)

    # Cache key includes rigor mode since different modes = different results
    cache_key_suffix = f"{request.plan.plan_id}_{rigor_mode.value}"
    cached_result = await cache_manager.get_policy_result(
        plan_id=cache_key_suffix,
        policy_ids=policies_to_check,
        trust_level=request.trust_level
    )

    if cached_result:
        await async_log_queue.info(
            "enforce_cache_hit",
            entity_id=request.entity_id,
            plan_id=request.plan.plan_id,
        )
        # Record action for velocity tracking
        await record_action(request.entity_id)

        # Reconstruct EnforceResponse from cached data
        cached_result["duration_ms"] = (time.perf_counter() - start_time) * 1000
        cached_result["rigor_mode"] = rigor_mode  # Add rigor mode
        return EnforceResponse(**cached_result)

    # ========================================================================
    # LAYER 3: POLICY EVALUATION (Cache miss - evaluate policies)
    # ========================================================================

    violations: list[PolicyViolation] = []
    policies_evaluated: list[str] = []
    constraints_evaluated = 0
    requires_approval = False

    for policy_id in policies_to_check:
        if policy_id not in MOCK_POLICIES:
            continue

        policy = MOCK_POLICIES[policy_id]
        policies_evaluated.append(policy_id)

        for constraint in policy["constraints"]:
            constraints_evaluated += 1
            constraint["policy_id"] = policy_id

            violation = evaluate_constraint(
                constraint, request.plan, request.trust_level
            )

            if violation:
                violations.append(violation)
                if constraint.get("requires_approval"):
                    requires_approval = True

    # Determine verdict
    critical_violations = [v for v in violations if v.severity == "critical"]
    high_violations = [v for v in violations if v.severity == "high"]

    if critical_violations:
        action = "deny"
        allowed = False
    elif high_violations or requires_approval:
        action = "escalate"
        allowed = False
    elif violations:
        action = "allow"  # Non-blocking violations
        allowed = True
    else:
        action = "allow"
        allowed = True

    # Calculate trust impact
    trust_impact = 0
    if critical_violations:
        trust_impact = -50  # Significant trust penalty
    elif high_violations:
        trust_impact = -10

    duration_ms = (time.perf_counter() - start_time) * 1000

    # ========================================================================
    # LAYER 4: RECORD METRICS & VELOCITY
    # ========================================================================
    # Record action for velocity tracking
    await record_action(request.entity_id)

    # Record request for circuit breaker monitoring
    circuit_breaker.record_request(
        entity_id=request.entity_id,
        risk_score=request.plan.risk_score,
        was_blocked=not allowed,
    )

    await async_log_queue.info(
        "enforce_verdict",
        entity_id=request.entity_id,
        plan_id=request.plan.plan_id,
        action=action,
        allowed=allowed,
        violations_count=len(violations),
        duration_ms=duration_ms,
    )

    response = EnforceResponse(
        intent_id=f"int_{request.plan.plan_id[5:]}",  # Derive from plan_id
        plan_id=request.plan.plan_id,
        allowed=allowed,
        action=action,
        violations=violations,
        policies_evaluated=policies_evaluated,
        constraints_evaluated=constraints_evaluated,
        trust_impact=trust_impact,
        requires_approval=requires_approval,
        approval_timeout="4h" if requires_approval else None,
        rigor_mode=rigor_mode,
        duration_ms=duration_ms,
    )

    # Cache the result for future requests (convert Pydantic to dict for serialization)
    await cache_manager.set_policy_result(
        plan_id=cache_key_suffix,  # Use same key as cache check (includes rigor mode)
        policy_ids=policies_to_check,
        trust_level=request.trust_level,
        result=response.model_dump(mode='json', exclude={'verdict_id', 'duration_ms', 'decided_at'})
    )

    return response


@router.get("/enforce/policies")
async def list_policies() -> dict:
    """
    List available BASIS policies.
    """
    return {
        "policies": [
            {"id": pid, "name": p["name"], "constraints": len(p["constraints"])}
            for pid, p in MOCK_POLICIES.items()
        ]
    }
