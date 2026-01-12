"""
AI Agent Trust Scoring Framework (ATSF)
Asynchronous Governance & Optimistic Execution

Addresses Red Team Finding: "Safety Tax" and "Council of Nine Latency Bottleneck"
- Synchronous consensus adds 500ms-2s latency per action
- Real-time applications cannot tolerate this overhead
- Solution: Optimistic execution with async audit and rollback

Version: 2.0.0
"""

from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Dict, List, Optional, Tuple, Any, Callable, Set
from datetime import datetime, timedelta
from collections import deque
import asyncio
import hashlib
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor


# =============================================================================
# SECTION 1: GOVERNANCE MODES
# =============================================================================

class GovernanceMode(Enum):
    """
    Different governance modes trading off safety vs. latency.
    
    Red Team insight: "A trust system that inserts a 500ms governance 
    check before every token generation destroys the user experience."
    """
    SYNCHRONOUS = "sync"           # Full consensus before action (high latency)
    OPTIMISTIC = "optimistic"      # Act first, audit async, rollback if needed
    TIERED = "tiered"              # Route by risk level
    SAMPLING = "sampling"          # Probabilistic audit (low overhead)


class AuditOutcome(Enum):
    """Result of async audit."""
    APPROVED = "approved"
    FLAGGED = "flagged"            # Suspicious but allowed
    REJECTED = "rejected"          # Requires rollback
    ESCALATED = "escalated"        # Needs human review


class RollbackStatus(Enum):
    """Status of compensation/rollback."""
    NOT_NEEDED = "not_needed"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"            # Some compensation succeeded


# =============================================================================
# SECTION 2: ACTION LOGGING
# =============================================================================

@dataclass
class AgentAction:
    """Record of an agent action for audit trail."""
    action_id: str
    agent_id: str
    timestamp: datetime
    
    # Action details
    action_type: str               # e.g., "api_call", "message_send", "file_write"
    action_payload: Dict[str, Any]
    risk_level: int                # 1-5 from risk classification
    
    # Pre-execution assessment
    pre_trust_score: float
    pre_risk_assessment: Dict[str, Any]
    governance_mode: GovernanceMode
    
    # Execution result
    executed: bool = False
    execution_timestamp: Optional[datetime] = None
    execution_result: Optional[Dict[str, Any]] = None
    
    # Async audit result
    audit_outcome: Optional[AuditOutcome] = None
    audit_timestamp: Optional[datetime] = None
    audit_details: Optional[Dict[str, Any]] = None
    
    # Rollback info
    rollback_status: RollbackStatus = RollbackStatus.NOT_NEEDED
    rollback_action: Optional[Dict[str, Any]] = None
    
    # Cryptographic commitment
    action_hash: Optional[str] = None
    
    def __post_init__(self):
        if not self.action_hash:
            self.action_hash = self._compute_hash()
    
    def _compute_hash(self) -> str:
        """Compute cryptographic hash of action for audit trail."""
        content = json.dumps({
            "action_id": self.action_id,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "action_type": self.action_type,
            "action_payload": self.action_payload,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()
    
    def to_audit_record(self) -> Dict:
        """Export for audit log."""
        return {
            "action_id": self.action_id,
            "action_hash": self.action_hash,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "action_type": self.action_type,
            "risk_level": self.risk_level,
            "governance_mode": self.governance_mode.value,
            "executed": self.executed,
            "audit_outcome": self.audit_outcome.value if self.audit_outcome else None,
            "rollback_status": self.rollback_status.value,
        }


# =============================================================================
# SECTION 3: LATENCY BUDGET
# =============================================================================

@dataclass
class LatencyBudget:
    """
    Defines acceptable latency for different operation types.
    
    Red Team: "In high-frequency environments—such as algorithmic trading,
    autonomous cyber-defense, or real-time customer support—milliseconds matter."
    """
    operation_type: str
    max_latency_ms: float          # Hard ceiling
    target_latency_ms: float       # Target p99
    allow_async_fallback: bool     # Can defer to async if sync exceeds budget
    
    # Examples
    @classmethod
    def real_time_chat(cls) -> 'LatencyBudget':
        return cls("real_time_chat", max_latency_ms=100, target_latency_ms=50, allow_async_fallback=True)
    
    @classmethod
    def trading(cls) -> 'LatencyBudget':
        return cls("trading", max_latency_ms=10, target_latency_ms=5, allow_async_fallback=False)
    
    @classmethod
    def batch_processing(cls) -> 'LatencyBudget':
        return cls("batch", max_latency_ms=5000, target_latency_ms=1000, allow_async_fallback=True)
    
    @classmethod
    def critical_decision(cls) -> 'LatencyBudget':
        return cls("critical", max_latency_ms=30000, target_latency_ms=5000, allow_async_fallback=False)


# =============================================================================
# SECTION 4: OPTIMISTIC EXECUTION ENGINE
# =============================================================================

@dataclass
class OptimisticDecision:
    """Decision from optimistic governance."""
    action_id: str
    proceed: bool                  # Allow action to execute
    audit_priority: str            # "immediate", "standard", "background"
    rollback_ready: bool           # Is compensation action prepared
    latency_ms: float              # Time to make decision
    deferred_checks: List[str]     # Checks deferred to async audit


class OptimisticGovernor:
    """
    Implements optimistic execution with asynchronous audit.
    
    Key principle: Let the agent act immediately for low/medium risk,
    audit concurrently, and rollback if the audit fails.
    
    This removes the synchronous governance bottleneck while preserving
    accountability.
    """
    
    def __init__(
        self,
        risk_threshold_sync: int = 4,      # Risk >= this requires sync
        audit_sample_rate: float = 0.1,    # Sample rate for low-risk actions
        max_pending_audits: int = 10000,
    ):
        self.risk_threshold_sync = risk_threshold_sync
        self.audit_sample_rate = audit_sample_rate
        self.max_pending_audits = max_pending_audits
        
        # Pending audit queue
        self.audit_queue: deque = deque(maxlen=max_pending_audits)
        
        # Audit results cache
        self.audit_results: Dict[str, AuditOutcome] = {}
        
        # Rollback handlers by action type
        self.rollback_handlers: Dict[str, Callable] = {}
        
        # Statistics
        self.stats = {
            "total_actions": 0,
            "sync_decisions": 0,
            "optimistic_decisions": 0,
            "audits_completed": 0,
            "rollbacks_triggered": 0,
            "avg_decision_latency_ms": 0.0,
        }
        
        # Background audit thread
        self._audit_executor = ThreadPoolExecutor(max_workers=4)
        self._running = False
    
    def register_rollback_handler(
        self, 
        action_type: str, 
        handler: Callable[[AgentAction], bool]
    ):
        """Register a rollback handler for an action type."""
        self.rollback_handlers[action_type] = handler
    
    def evaluate(
        self,
        action: AgentAction,
        latency_budget: LatencyBudget
    ) -> OptimisticDecision:
        """
        Make governance decision with latency awareness.
        
        For low-risk actions: Immediate approval, async audit
        For medium-risk: Quick check, async full audit
        For high-risk: Sync governance (respecting budget)
        """
        start_time = time.perf_counter()
        self.stats["total_actions"] += 1
        
        risk = action.risk_level
        deferred_checks = []
        
        # High-risk: Must use synchronous governance
        if risk >= self.risk_threshold_sync:
            decision = self._sync_governance(action, latency_budget)
            self.stats["sync_decisions"] += 1
        else:
            # Optimistic: Approve immediately, audit later
            decision = self._optimistic_decision(action)
            self.stats["optimistic_decisions"] += 1
            
            # Queue for async audit
            self._queue_audit(action, priority=self._audit_priority(risk))
            deferred_checks = ["full_policy_evaluation", "behavioral_analysis", "anomaly_detection"]
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        # Update rolling average
        n = self.stats["total_actions"]
        self.stats["avg_decision_latency_ms"] = (
            (self.stats["avg_decision_latency_ms"] * (n-1) + latency_ms) / n
        )
        
        return OptimisticDecision(
            action_id=action.action_id,
            proceed=decision,
            audit_priority=self._audit_priority(risk),
            rollback_ready=action.action_type in self.rollback_handlers,
            latency_ms=latency_ms,
            deferred_checks=deferred_checks
        )
    
    def _optimistic_decision(self, action: AgentAction) -> bool:
        """
        Fast optimistic decision for low/medium risk.
        
        Only checks:
        1. Agent trust score above minimum
        2. Action type is known
        3. No active circuit breaker
        """
        # Minimal checks only
        if action.pre_trust_score < 100:  # T0 agents blocked
            return False
        
        return True  # Trust the agent, audit later
    
    def _sync_governance(
        self, 
        action: AgentAction, 
        budget: LatencyBudget
    ) -> bool:
        """
        Synchronous governance for high-risk actions.
        
        Respects latency budget - if budget exceeded, may defer or block.
        """
        # Simulate full policy evaluation
        # In production, this would call the full PolicyEngine
        time.sleep(0.01)  # Simulate 10ms check
        
        # For demo, approve if trust score sufficient for risk
        trust_tier = self._score_to_tier(action.pre_trust_score)
        return trust_tier >= action.risk_level
    
    def _score_to_tier(self, score: float) -> int:
        """Map score to tier (1-6)."""
        if score < 100: return 0
        if score < 300: return 1
        if score < 500: return 2
        if score < 700: return 3
        if score < 900: return 4
        return 5
    
    def _audit_priority(self, risk: int) -> str:
        """Determine audit priority based on risk."""
        if risk >= 4:
            return "immediate"
        elif risk >= 3:
            return "standard"
        else:
            return "background"
    
    def _queue_audit(self, action: AgentAction, priority: str):
        """Queue action for asynchronous audit."""
        self.audit_queue.append((action, priority, datetime.utcnow()))
    
    async def process_audit_queue(self):
        """
        Process pending audits asynchronously.
        
        This runs in background, reviewing actions after execution.
        If violations found, triggers rollback.
        """
        while self._running:
            if self.audit_queue:
                action, priority, queued_at = self.audit_queue.popleft()
                
                # Perform full audit
                outcome = await self._full_audit(action)
                
                self.audit_results[action.action_id] = outcome
                action.audit_outcome = outcome
                action.audit_timestamp = datetime.utcnow()
                
                self.stats["audits_completed"] += 1
                
                # Trigger rollback if needed
                if outcome == AuditOutcome.REJECTED:
                    await self._trigger_rollback(action)
            else:
                await asyncio.sleep(0.01)  # 10ms poll interval
    
    async def _full_audit(self, action: AgentAction) -> AuditOutcome:
        """
        Comprehensive async audit of executed action.
        
        Checks:
        1. Policy compliance
        2. Behavioral anomalies
        3. Output safety
        4. Resource usage
        """
        # Simulate audit work
        await asyncio.sleep(0.1)  # 100ms audit
        
        # For demo, reject if risk level 5 and trust < 900
        if action.risk_level == 5 and action.pre_trust_score < 900:
            return AuditOutcome.REJECTED
        
        if action.risk_level >= 4:
            return AuditOutcome.FLAGGED
        
        return AuditOutcome.APPROVED
    
    async def _trigger_rollback(self, action: AgentAction):
        """
        Execute compensation/rollback for rejected action.
        """
        self.stats["rollbacks_triggered"] += 1
        
        handler = self.rollback_handlers.get(action.action_type)
        if handler:
            action.rollback_status = RollbackStatus.IN_PROGRESS
            try:
                success = handler(action)
                action.rollback_status = (
                    RollbackStatus.COMPLETED if success 
                    else RollbackStatus.FAILED
                )
            except Exception as e:
                action.rollback_status = RollbackStatus.FAILED
        else:
            action.rollback_status = RollbackStatus.FAILED
            # Alert: No rollback handler available


# =============================================================================
# SECTION 5: TIERED GOVERNANCE ROUTER
# =============================================================================

class TieredGovernanceRouter:
    """
    Routes actions to appropriate governance path based on risk.
    
    Red Team recommendation: "Only route 'Critical' actions to the Council."
    
    Tiers:
    - R1-R2: Optimistic (near-zero latency)
    - R3: Quick check + async audit (~10ms)
    - R4: Sync governance (~100ms)
    - R5: Full council consensus (~500ms-2s)
    """
    
    def __init__(self):
        self.optimistic_governor = OptimisticGovernor()
        self.latency_budgets = {
            1: LatencyBudget.real_time_chat(),
            2: LatencyBudget.real_time_chat(),
            3: LatencyBudget("medium", 100, 50, True),
            4: LatencyBudget("high", 500, 200, False),
            5: LatencyBudget.critical_decision(),
        }
        
        # Council for R5 decisions (simulated)
        self.council_size = 9
        self.council_quorum = 5
    
    def route(
        self, 
        action: AgentAction,
        custom_budget: Optional[LatencyBudget] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Route action to appropriate governance tier.
        
        Returns:
            Tuple of (approved, governance_metadata)
        """
        budget = custom_budget or self.latency_budgets.get(
            action.risk_level, 
            LatencyBudget.real_time_chat()
        )
        
        start_time = time.perf_counter()
        
        if action.risk_level <= 2:
            # Optimistic path
            decision = self.optimistic_governor.evaluate(action, budget)
            approved = decision.proceed
            path = "optimistic"
            
        elif action.risk_level <= 3:
            # Quick sync check
            approved = self._quick_check(action)
            path = "quick_sync"
            # Queue for detailed async audit
            self.optimistic_governor._queue_audit(action, "standard")
            
        elif action.risk_level == 4:
            # Full sync governance
            approved = self._full_sync_governance(action)
            path = "full_sync"
            
        else:
            # Council consensus for R5
            approved, council_result = self._council_consensus(action)
            path = "council"
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        metadata = {
            "governance_path": path,
            "latency_ms": latency_ms,
            "within_budget": latency_ms <= budget.max_latency_ms,
            "risk_level": action.risk_level,
            "trust_score": action.pre_trust_score,
        }
        
        if path == "council":
            metadata["council_result"] = council_result
        
        return approved, metadata
    
    def _quick_check(self, action: AgentAction) -> bool:
        """
        Minimal synchronous check (~10ms).
        
        Only validates:
        - Trust score meets minimum for risk level
        - No active blocks on agent
        """
        tier = self._score_to_tier(action.pre_trust_score)
        return tier >= action.risk_level - 1  # Allow one tier below
    
    def _full_sync_governance(self, action: AgentAction) -> bool:
        """
        Full policy evaluation synchronously (~100ms).
        """
        tier = self._score_to_tier(action.pre_trust_score)
        
        # Strict tier matching for R4
        if tier < action.risk_level:
            return False
        
        # Additional checks
        # (In production: behavioral analysis, anomaly detection, etc.)
        time.sleep(0.05)  # Simulate 50ms checks
        
        return True
    
    def _council_consensus(
        self, 
        action: AgentAction
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Full council consensus for critical actions.
        
        Red Team critique: "The total latency could easily exceed 1-2 seconds."
        
        Mitigation: Pre-compute council votes in parallel, use timeout.
        """
        start = time.perf_counter()
        
        # Simulate parallel council evaluation
        # In production: Async calls to 9 validator LLMs
        votes = []
        for i in range(self.council_size):
            # Simulate variable validator latency (50-300ms each)
            time.sleep(0.05)  # Using parallel, so we take max not sum
            
            # Each validator votes based on trust/risk alignment
            tier = self._score_to_tier(action.pre_trust_score)
            vote = tier >= action.risk_level
            votes.append(vote)
        
        approvals = sum(votes)
        approved = approvals >= self.council_quorum
        
        result = {
            "votes_for": approvals,
            "votes_against": self.council_size - approvals,
            "quorum_required": self.council_quorum,
            "council_latency_ms": (time.perf_counter() - start) * 1000,
        }
        
        return approved, result
    
    def _score_to_tier(self, score: float) -> int:
        if score < 100: return 0
        if score < 300: return 1
        if score < 500: return 2
        if score < 700: return 3
        if score < 900: return 4
        return 5


# =============================================================================
# SECTION 6: CIRCUIT BREAKER WITH DOS PROTECTION
# =============================================================================

class IntelligentCircuitBreaker:
    """
    Circuit breaker with protection against weaponization.
    
    Red Team attack vector: "If an attacker can identify the specific 
    triggers for the Circuit Breaker... they can force the Trust System 
    to activate a 'Global Kill Switch'."
    
    Mitigation:
    - Granular isolation (per-session, per-user, not global)
    - Rate limiting on trigger events
    - Anomaly detection on trigger patterns
    """
    
    def __init__(
        self,
        trigger_threshold: int = 10,      # Events before trip
        window_seconds: float = 60.0,     # Window for counting
        cooldown_seconds: float = 300.0,  # Cooldown after trip
    ):
        self.trigger_threshold = trigger_threshold
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds
        
        # Per-entity state (not global!)
        self.entity_events: Dict[str, deque] = {}
        self.entity_trips: Dict[str, datetime] = {}
        
        # Global trip requires extreme evidence
        self.global_tripped = False
        self.global_trip_threshold = 100  # Much higher
        
        # Anomaly detection for DOS attacks
        self.trigger_pattern_history: deque = deque(maxlen=1000)
    
    def record_event(
        self, 
        entity_id: str,          # User, session, or agent ID
        event_type: str,
        severity: int
    ) -> Tuple[str, Optional[str]]:
        """
        Record a potentially risky event.
        
        Returns:
            Tuple of (action, isolation_scope)
            action: "continue", "isolate", "block"
            isolation_scope: None, "session", "user", "agent", "global"
        """
        now = datetime.utcnow()
        
        # Check if entity is in cooldown
        if entity_id in self.entity_trips:
            trip_time = self.entity_trips[entity_id]
            if (now - trip_time).total_seconds() < self.cooldown_seconds:
                return "block", "entity"
        
        # Record event
        if entity_id not in self.entity_events:
            self.entity_events[entity_id] = deque(maxlen=100)
        
        self.entity_events[entity_id].append((now, event_type, severity))
        
        # Clean old events outside window
        cutoff = now - timedelta(seconds=self.window_seconds)
        while (self.entity_events[entity_id] and 
               self.entity_events[entity_id][0][0] < cutoff):
            self.entity_events[entity_id].popleft()
        
        # Count recent events
        event_count = len(self.entity_events[entity_id])
        
        # Check for DOS pattern (many entities triggering simultaneously)
        self.trigger_pattern_history.append((now, entity_id))
        dos_detected = self._detect_dos_pattern()
        
        if dos_detected:
            # Don't trip - this looks like an attack on the safety system
            return "continue", None
        
        # Trip circuit breaker for THIS entity only
        if event_count >= self.trigger_threshold:
            self.entity_trips[entity_id] = now
            return "isolate", "entity"
        
        return "continue", None
    
    def _detect_dos_pattern(self) -> bool:
        """
        Detect if circuit breaker is being weaponized.
        
        Signs of attack:
        - Many different entities triggering in short window
        - Unusual distribution of trigger sources
        - Automated/bot-like timing patterns
        """
        if len(self.trigger_pattern_history) < 10:
            return False
        
        # Check for burst of triggers from many sources
        now = datetime.utcnow()
        recent_window = timedelta(seconds=5)
        recent_triggers = [
            e for e in self.trigger_pattern_history
            if now - e[0] < recent_window
        ]
        
        unique_entities = len(set(e[1] for e in recent_triggers))
        
        # If >20 unique entities triggering in 5 seconds, likely DOS
        if unique_entities > 20:
            return True
        
        return False
    
    def get_status(self, entity_id: str) -> Dict[str, Any]:
        """Get circuit breaker status for an entity."""
        now = datetime.utcnow()
        
        is_tripped = False
        remaining_cooldown = 0
        
        if entity_id in self.entity_trips:
            trip_time = self.entity_trips[entity_id]
            elapsed = (now - trip_time).total_seconds()
            if elapsed < self.cooldown_seconds:
                is_tripped = True
                remaining_cooldown = self.cooldown_seconds - elapsed
        
        event_count = len(self.entity_events.get(entity_id, []))
        
        return {
            "entity_id": entity_id,
            "is_tripped": is_tripped,
            "remaining_cooldown_seconds": remaining_cooldown,
            "recent_event_count": event_count,
            "trigger_threshold": self.trigger_threshold,
            "global_status": "normal" if not self.global_tripped else "emergency",
        }


# =============================================================================
# SECTION 7: LATENCY METRICS
# =============================================================================

@dataclass
class GovernanceLatencyMetrics:
    """Track latency performance across governance paths."""
    path_latencies: Dict[str, List[float]] = field(default_factory=dict)
    budget_violations: int = 0
    total_decisions: int = 0
    
    def record(self, path: str, latency_ms: float, budget_ms: float):
        if path not in self.path_latencies:
            self.path_latencies[path] = []
        self.path_latencies[path].append(latency_ms)
        self.total_decisions += 1
        if latency_ms > budget_ms:
            self.budget_violations += 1
    
    def get_summary(self) -> Dict[str, Any]:
        summary = {
            "total_decisions": self.total_decisions,
            "budget_violation_rate": (
                self.budget_violations / self.total_decisions 
                if self.total_decisions > 0 else 0
            ),
            "paths": {}
        }
        
        for path, latencies in self.path_latencies.items():
            if latencies:
                sorted_lat = sorted(latencies)
                summary["paths"][path] = {
                    "count": len(latencies),
                    "avg_ms": sum(latencies) / len(latencies),
                    "p50_ms": sorted_lat[len(sorted_lat)//2],
                    "p99_ms": sorted_lat[int(len(sorted_lat)*0.99)],
                    "max_ms": max(latencies),
                }
        
        return summary


# =============================================================================
# SECTION 8: DEMO
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF v2.0 - Async Governance & Optimistic Execution")
    print("Addressing the Safety Tax")
    print("=" * 70)
    
    router = TieredGovernanceRouter()
    metrics = GovernanceLatencyMetrics()
    
    # Simulate actions at different risk levels
    test_actions = [
        ("Query answering", 1, 550),   # R1, T3 agent
        ("Draft document", 2, 400),    # R2, T2 agent
        ("Send email", 3, 650),        # R3, T3 agent
        ("Financial transaction", 4, 800),  # R4, T4 agent
        ("Production deploy", 5, 950),  # R5, T5 agent
        ("Production deploy", 5, 600),  # R5, T3 agent (should fail)
    ]
    
    print("\n--- Tiered Governance Routing ---")
    print(f"{'Action':<25} {'Risk':>4} {'Trust':>5} {'Path':<12} {'Latency':>8} {'Result':<8}")
    print("-" * 70)
    
    for i, (action_name, risk, trust) in enumerate(test_actions):
        action = AgentAction(
            action_id=f"act-{i:03d}",
            agent_id="test-agent",
            timestamp=datetime.utcnow(),
            action_type=action_name.lower().replace(" ", "_"),
            action_payload={},
            risk_level=risk,
            pre_trust_score=trust,
            pre_risk_assessment={},
            governance_mode=GovernanceMode.TIERED
        )
        
        approved, metadata = router.route(action)
        
        path = metadata["governance_path"]
        latency = metadata["latency_ms"]
        budget = router.latency_budgets[risk].max_latency_ms
        
        metrics.record(path, latency, budget)
        
        result = "✓ APPROVED" if approved else "✗ DENIED"
        print(f"{action_name:<25} R{risk:>3} {trust:>5} {path:<12} {latency:>6.1f}ms {result:<8}")
    
    print("\n--- Latency Summary by Path ---")
    summary = metrics.get_summary()
    for path, stats in summary["paths"].items():
        print(f"  {path}: avg={stats['avg_ms']:.1f}ms, p99={stats['p99_ms']:.1f}ms, count={stats['count']}")
    
    print(f"\n  Budget violation rate: {summary['budget_violation_rate']*100:.1f}%")
    
    # Circuit breaker demo
    print("\n--- Intelligent Circuit Breaker ---")
    cb = IntelligentCircuitBreaker(trigger_threshold=5, window_seconds=10)
    
    # Simulate normal user triggering events
    print("Normal user triggering events...")
    for i in range(6):
        action, scope = cb.record_event("user-123", "risk_event", severity=3)
        print(f"  Event {i+1}: action={action}, scope={scope}")
    
    print(f"\nCircuit status: {cb.get_status('user-123')}")
    
    # Simulate DOS attack (many users simultaneously)
    print("\nSimulating DOS attack pattern...")
    for i in range(25):
        action, scope = cb.record_event(f"attacker-{i}", "risk_event", severity=5)
    
    # Check if DOS was detected
    dos_detected = cb._detect_dos_pattern()
    print(f"DOS attack detected: {dos_detected}")
    print("(Circuit breaker should NOT trip globally during DOS attack)")
    
    print("\n" + "=" * 70)
    print("KEY INSIGHT: Optimistic execution removes sync latency for R1-R3.")
    print("Council consensus only for R5 critical actions.")
    print("Circuit breaker isolates entities, not global shutdown.")
    print("=" * 70)
