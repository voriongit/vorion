---
sidebar_position: 3
title: Capability Gating
description: Controlling agent capabilities based on trust and context
tags: [safety, capabilities, permissions, authorization, access-control]
---

# Capability Gating

## Controlling What Agents Can Do

Capability gating is the practice of restricting agent capabilities based on trust level, context, and authorization. Rather than giving agents full access to all tools and actions, capabilities are granted incrementally as trust is established.

## The Capability Hierarchy

```
                    Capability Hierarchy
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         ┌─────────────────────┐                         │
│                         │ Unrestricted Access │   Trust > 0.95          │
│                         │ (Very Rare)         │   + Human Approval      │
│                         └──────────┬──────────┘                         │
│                                    │                                     │
│                    ┌───────────────┴───────────────┐                    │
│                    │    Privileged Capabilities    │   Trust > 0.85     │
│                    │   (Financial, Administrative) │   + Attestation    │
│                    └───────────────┬───────────────┘                    │
│                                    │                                     │
│           ┌────────────────────────┴────────────────────────┐           │
│           │         Standard Capabilities                    │  Trust   │
│           │   (CRUD Operations, API Access)                  │  > 0.7   │
│           └────────────────────────┬────────────────────────┘           │
│                                    │                                     │
│  ┌─────────────────────────────────┴─────────────────────────────────┐  │
│  │                    Basic Capabilities                              │  │
│  │           (Read-only, Query, Simple Tasks)                         │  │
│  │                                                            Trust   │  │
│  │                                                            > 0.5   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Sandbox Only                                    │  │
│  │           (New agents, untrusted sources)               Trust < 0.5│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Capability Model

### Capability Definition

```python
@dataclass
class Capability:
    """A grantable agent capability."""

    id: str                          # Unique identifier
    name: str                        # Human-readable name
    description: str                 # What this capability allows
    category: str                    # Category (read, write, execute, admin)

    # Requirements
    min_trust_score: float           # Minimum overall trust
    required_components: Dict[str, float]  # Component-specific minimums
    required_certifications: List[str]     # Required credentials
    requires_human_approval: bool    # Needs human sign-off

    # Constraints
    rate_limit: Optional[RateLimit]  # Usage limits
    context_restrictions: List[str]  # Context requirements
    expiration: Optional[timedelta]  # Auto-expiration

    # Risk
    risk_level: str                  # low, medium, high, critical

    def __hash__(self):
        return hash(self.id)


# Example capabilities
CAPABILITIES = {
    "read:public": Capability(
        id="read:public",
        name="Read Public Data",
        description="Access publicly available data",
        category="read",
        min_trust_score=0.3,
        required_components={},
        required_certifications=[],
        requires_human_approval=False,
        rate_limit=RateLimit(requests=1000, per="hour"),
        risk_level="low"
    ),

    "write:user_data": Capability(
        id="write:user_data",
        name="Write User Data",
        description="Modify user data records",
        category="write",
        min_trust_score=0.75,
        required_components={"security": 0.8, "compliance": 0.75},
        required_certifications=["data_handling"],
        requires_human_approval=False,
        rate_limit=RateLimit(requests=100, per="hour"),
        risk_level="medium"
    ),

    "execute:financial": Capability(
        id="execute:financial",
        name="Execute Financial Transactions",
        description="Initiate financial transactions",
        category="execute",
        min_trust_score=0.9,
        required_components={"security": 0.95, "compliance": 0.95, "behavioral": 0.9},
        required_certifications=["financial_services", "aml_kyc"],
        requires_human_approval=True,
        rate_limit=RateLimit(requests=10, per="minute"),
        context_restrictions=["trading_hours", "approved_instruments"],
        risk_level="critical"
    ),
}
```

### Capability Gate

```python
class CapabilityGate:
    """Gate that controls capability access."""

    def __init__(
        self,
        trust_oracle: TrustOracle,
        credential_verifier: CredentialVerifier,
        approval_system: ApprovalSystem
    ):
        self.trust_oracle = trust_oracle
        self.credential_verifier = credential_verifier
        self.approval_system = approval_system
        self.grants: Dict[str, Set[str]] = {}  # agent_did -> granted capabilities

    async def authorize(
        self,
        agent_did: str,
        capability_id: str,
        context: Optional[Context] = None
    ) -> AuthorizationResult:
        """Check if agent can use a capability."""

        capability = CAPABILITIES.get(capability_id)
        if not capability:
            return AuthorizationResult(authorized=False, reason="Unknown capability")

        # Check if already granted
        if capability_id in self.grants.get(agent_did, set()):
            return await self._check_usage_constraints(agent_did, capability, context)

        # Not granted - check if can be granted
        can_grant = await self._can_grant(agent_did, capability)
        if not can_grant.allowed:
            return AuthorizationResult(authorized=False, reason=can_grant.reason)

        # Grant capability
        await self._grant_capability(agent_did, capability_id)

        return AuthorizationResult(authorized=True, capability=capability)

    async def _can_grant(
        self,
        agent_did: str,
        capability: Capability
    ) -> CanGrantResult:
        """Check if capability can be granted to agent."""

        # 1. Check trust score
        score = await self.trust_oracle.get_score(agent_did)

        if score.overall < capability.min_trust_score:
            return CanGrantResult(
                allowed=False,
                reason=f"Trust score {score.overall:.2f} below required {capability.min_trust_score}"
            )

        # 2. Check component scores
        for component, threshold in capability.required_components.items():
            component_score = getattr(score, component).overall
            if component_score < threshold:
                return CanGrantResult(
                    allowed=False,
                    reason=f"{component} score {component_score:.2f} below required {threshold}"
                )

        # 3. Check certifications
        for cert in capability.required_certifications:
            has_cert = await self.credential_verifier.verify_certification(
                agent_did, cert
            )
            if not has_cert:
                return CanGrantResult(
                    allowed=False,
                    reason=f"Missing required certification: {cert}"
                )

        # 4. Check human approval if required
        if capability.requires_human_approval:
            approval = await self.approval_system.check_approval(
                agent_did, capability.id
            )
            if not approval.granted:
                return CanGrantResult(
                    allowed=False,
                    reason="Awaiting human approval"
                )

        return CanGrantResult(allowed=True)

    async def _check_usage_constraints(
        self,
        agent_did: str,
        capability: Capability,
        context: Optional[Context]
    ) -> AuthorizationResult:
        """Check runtime usage constraints."""

        # Rate limiting
        if capability.rate_limit:
            if not await self._check_rate_limit(agent_did, capability):
                return AuthorizationResult(
                    authorized=False,
                    reason="Rate limit exceeded"
                )

        # Context restrictions
        if capability.context_restrictions and context:
            for restriction in capability.context_restrictions:
                if not self._check_context_restriction(restriction, context):
                    return AuthorizationResult(
                        authorized=False,
                        reason=f"Context restriction not met: {restriction}"
                    )

        return AuthorizationResult(authorized=True, capability=capability)
```

## Capability Delegation

### Delegation Chains

```python
class CapabilityDelegator:
    """Handle capability delegation between agents."""

    async def delegate(
        self,
        from_agent: str,
        to_agent: str,
        capability_id: str,
        constraints: Optional[DelegationConstraints] = None
    ) -> DelegationResult:
        """Delegate capability from one agent to another."""

        # Verify source has capability with delegation rights
        source_grant = await self.gate.get_grant(from_agent, capability_id)
        if not source_grant:
            return DelegationResult(
                success=False,
                reason="Source agent doesn't have this capability"
            )

        if not source_grant.can_delegate:
            return DelegationResult(
                success=False,
                reason="Capability cannot be delegated"
            )

        # Check target meets minimum requirements
        target_score = await self.trust_oracle.get_score(to_agent)
        original_cap = CAPABILITIES[capability_id]

        # Delegated capability has stricter requirements
        min_score = max(original_cap.min_trust_score, source_grant.delegation_min_trust)
        if target_score.overall < min_score:
            return DelegationResult(
                success=False,
                reason=f"Target trust score {target_score.overall:.2f} below required {min_score}"
            )

        # Create delegated grant
        delegated_grant = Grant(
            capability_id=capability_id,
            agent_did=to_agent,
            granted_by=from_agent,  # Delegated from
            delegated=True,
            constraints=self._merge_constraints(source_grant.constraints, constraints),
            expiration=min(
                source_grant.expiration,
                constraints.expiration if constraints else None
            ),
            can_delegate=False  # No re-delegation by default
        )

        await self._store_grant(delegated_grant)

        return DelegationResult(success=True, grant=delegated_grant)

    def _merge_constraints(
        self,
        original: Constraints,
        additional: Optional[Constraints]
    ) -> Constraints:
        """Merge constraints (more restrictive wins)."""
        if not additional:
            return original

        return Constraints(
            rate_limit=min(original.rate_limit, additional.rate_limit),
            max_value=min(original.max_value, additional.max_value) if original.max_value else additional.max_value,
            allowed_contexts=set(original.allowed_contexts) & set(additional.allowed_contexts),
            time_restrictions=original.time_restrictions + additional.time_restrictions
        )
```

## Dynamic Capability Adjustment

### Trust-Responsive Capabilities

```python
class DynamicCapabilityManager:
    """Adjust capabilities based on real-time trust."""

    def __init__(self, gate: CapabilityGate, trust_oracle: TrustOracle):
        self.gate = gate
        self.trust_oracle = trust_oracle

    async def update_agent_capabilities(self, agent_did: str):
        """Update agent capabilities based on current trust score."""

        current_score = await self.trust_oracle.get_score(agent_did)
        current_grants = await self.gate.get_grants(agent_did)

        for grant in current_grants:
            capability = CAPABILITIES[grant.capability_id]

            # Check if agent still qualifies
            if current_score.overall < capability.min_trust_score:
                # Trust dropped - revoke capability
                await self.gate.revoke(agent_did, grant.capability_id)
                await self._notify_revocation(agent_did, grant.capability_id, "trust_drop")

            # Check component requirements
            for component, threshold in capability.required_components.items():
                component_score = getattr(current_score, component).overall
                if component_score < threshold:
                    await self.gate.revoke(agent_did, grant.capability_id)
                    await self._notify_revocation(
                        agent_did,
                        grant.capability_id,
                        f"{component}_below_threshold"
                    )
                    break

        # Check for new capabilities agent now qualifies for
        await self._check_new_eligibility(agent_did, current_score)

    async def _check_new_eligibility(self, agent_did: str, score: ATSFScore):
        """Check if agent now qualifies for additional capabilities."""

        current_grants = {g.capability_id for g in await self.gate.get_grants(agent_did)}

        for cap_id, capability in CAPABILITIES.items():
            if cap_id in current_grants:
                continue

            if score.overall >= capability.min_trust_score:
                # May qualify - notify for consideration
                await self._suggest_capability(agent_did, capability)
```

## Sandboxing

### Capability-Based Sandboxing

```python
class CapabilitySandbox:
    """Sandbox that enforces capability restrictions."""

    def __init__(self, granted_capabilities: Set[str]):
        self.capabilities = granted_capabilities

    async def execute(
        self,
        action: Action,
        context: Context
    ) -> ExecutionResult:
        """Execute action within capability sandbox."""

        # Determine required capability
        required_cap = self._get_required_capability(action)

        if required_cap not in self.capabilities:
            return ExecutionResult(
                success=False,
                error=f"Action requires capability '{required_cap}' which is not granted"
            )

        # Create restricted execution environment
        restricted_env = self._create_restricted_environment(action)

        try:
            result = await restricted_env.execute(action)
            return ExecutionResult(success=True, result=result)
        except CapabilityViolation as e:
            return ExecutionResult(
                success=False,
                error=f"Capability violation: {e}"
            )

    def _create_restricted_environment(self, action: Action) -> RestrictedEnvironment:
        """Create environment with only allowed capabilities."""

        allowed_operations = set()
        for cap_id in self.capabilities:
            cap = CAPABILITIES[cap_id]
            allowed_operations.update(cap.allowed_operations)

        return RestrictedEnvironment(
            allowed_operations=allowed_operations,
            network_access=self._determine_network_access(),
            filesystem_access=self._determine_filesystem_access(),
            memory_limit=self._determine_memory_limit()
        )
```

## Capability Revocation

### Immediate Revocation

```python
class CapabilityRevoker:
    """Handle capability revocation."""

    async def revoke(
        self,
        agent_did: str,
        capability_id: str,
        reason: str,
        immediate: bool = True
    ) -> RevocationResult:
        """Revoke a capability from an agent."""

        grant = await self.gate.get_grant(agent_did, capability_id)
        if not grant:
            return RevocationResult(success=False, reason="Grant not found")

        if immediate:
            # Immediate revocation
            await self._immediate_revoke(agent_did, capability_id)
        else:
            # Graceful revocation with wind-down period
            await self._graceful_revoke(agent_did, capability_id)

        # Log revocation
        await self._log_revocation(agent_did, capability_id, reason)

        # Cascade to delegated capabilities
        delegations = await self._find_delegations(agent_did, capability_id)
        for delegation in delegations:
            await self.revoke(
                delegation.delegatee,
                capability_id,
                f"Cascade from {agent_did} revocation",
                immediate=immediate
            )

        return RevocationResult(
            success=True,
            revoked_count=1 + len(delegations)
        )

    async def _immediate_revoke(self, agent_did: str, capability_id: str):
        """Immediately revoke capability."""

        # Remove from grants
        await self.gate.remove_grant(agent_did, capability_id)

        # Terminate any active uses
        active_uses = await self._find_active_uses(agent_did, capability_id)
        for use in active_uses:
            await use.terminate()

        # Invalidate any tokens/credentials
        await self._invalidate_credentials(agent_did, capability_id)
```

## Research Foundations

- **Capability-Based Security** (Dennis & Van Horn, 1966)
- **Object-Capability Model** (Miller, 2006)
- **Principle of Least Privilege** (Saltzer & Schroeder, 1975)

---

## See Also

- [Trust Scoring](./trust-scoring.md) - Determining trust levels
- [Audit Trails](./audit-trails.md) - Tracking capability usage
- [Human Oversight](./human-oversight.md) - Approval workflows
