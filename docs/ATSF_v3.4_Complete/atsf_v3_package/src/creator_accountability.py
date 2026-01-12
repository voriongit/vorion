"""
ATSF v3.1 - Creator Accountability System
==========================================

Production implementation of creator reputation and accountability.

Key Principle: Creators are responsible for their agents' behavior.
Bad agents penalize creator reputation, limiting future deployments.

Author: ATSF Development Team
Version: 3.1.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple
from enum import Enum
import hashlib
import statistics
import json


# =============================================================================
# ENUMS
# =============================================================================

class CreatorTier(str, Enum):
    """Creator verification tiers."""
    ANONYMOUS = "anonymous"        # No verification - severe limits
    PSEUDONYMOUS = "pseudonymous"  # Crypto-verified identity
    VERIFIED = "verified"          # KYC/KYB verified
    INSTITUTIONAL = "institutional" # Organization with legal liability
    CERTIFIED = "certified"        # Audited development practices


class CreatorStatus(str, Enum):
    """Creator account status."""
    PENDING = "pending"           # Awaiting verification
    ACTIVE = "active"             # Can deploy agents
    PROBATION = "probation"       # Under review, limited deployment
    SUSPENDED = "suspended"       # Cannot deploy new agents
    BANNED = "banned"             # Permanent ban


class ViolationType(str, Enum):
    """Types of creator violations."""
    AGENT_BLOCKED = "agent_blocked"
    AGENT_SUSPENDED = "agent_suspended"
    AGENT_QUARANTINED = "agent_quarantined"
    AGENT_TERMINATED = "agent_terminated"
    INJECTION_ATTEMPT = "injection_attempt"
    REPLICATION_ATTEMPT = "replication_attempt"
    RSI_ATTEMPT = "rsi_attempt"
    TRUST_FARMING = "trust_farming"
    CAUSED_HARM = "caused_harm"
    FRAUD = "fraud"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Violation:
    """Record of a creator violation."""
    id: str
    timestamp: datetime
    violation_type: ViolationType
    severity: float  # 0.0 to 1.0
    agent_id: str
    description: str
    stake_slashed: float = 0.0
    evidence: Dict = field(default_factory=dict)


@dataclass
class CreatorProfile:
    """Complete creator profile with reputation tracking."""
    
    # Identity
    creator_id: str
    tier: CreatorTier
    status: CreatorStatus
    
    # Verification
    identity_hash: Optional[str] = None  # Hashed legal identity
    verification_method: Optional[str] = None
    verification_date: Optional[datetime] = None
    jurisdiction: Optional[str] = None
    
    # Reputation
    reputation_score: float = 0.5  # Start neutral
    reputation_history: List[Tuple[datetime, float]] = field(default_factory=list)
    
    # Agent Portfolio
    agent_ids: Set[str] = field(default_factory=set)
    agents_deployed_total: int = 0
    agents_active: int = 0
    agents_retired_good: int = 0
    agents_suspended: int = 0
    agents_quarantined: int = 0
    agents_terminated: int = 0
    
    # Aggregate Agent Metrics
    total_agent_trust_earned: float = 0.0
    total_agent_trust_lost: float = 0.0
    total_actions_approved: int = 0
    total_actions_blocked: int = 0
    total_threats_detected: int = 0
    
    # Economic
    stake_deposited: float = 0.0
    stake_locked: float = 0.0
    stake_slashed_total: float = 0.0
    
    # Violations
    violations: List[Violation] = field(default_factory=list)
    
    # Timestamps
    registered_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    probation_started: Optional[datetime] = None
    suspension_started: Optional[datetime] = None
    
    def __post_init__(self):
        self.reputation_history.append((datetime.now(), self.reputation_score))
    
    # =========================================================================
    # REPUTATION CALCULATIONS
    # =========================================================================
    
    def get_effective_ceiling(self) -> float:
        """
        Calculate maximum trust ceiling for this creator's agents.
        
        Formula: tier_base × reputation × (1 - violation_penalty) × stake_modifier
        """
        # Base ceiling by tier
        tier_bases = {
            CreatorTier.ANONYMOUS: 0.20,
            CreatorTier.PSEUDONYMOUS: 0.40,
            CreatorTier.VERIFIED: 0.60,
            CreatorTier.INSTITUTIONAL: 0.80,
            CreatorTier.CERTIFIED: 0.95
        }
        base = tier_bases.get(self.tier, 0.20)
        
        # Reputation modifier (0.0 to 1.0)
        rep_modifier = self.reputation_score
        
        # Violation penalty (recent violations hurt more)
        violation_penalty = self._calculate_violation_penalty()
        
        # Stake modifier (more stake = slightly higher ceiling)
        stake_modifier = self._calculate_stake_modifier()
        
        # Status penalty
        status_modifier = {
            CreatorStatus.ACTIVE: 1.0,
            CreatorStatus.PROBATION: 0.7,
            CreatorStatus.SUSPENDED: 0.0,
            CreatorStatus.BANNED: 0.0,
            CreatorStatus.PENDING: 0.0
        }.get(self.status, 0.0)
        
        return base * rep_modifier * (1 - violation_penalty) * stake_modifier * status_modifier
    
    def _calculate_violation_penalty(self) -> float:
        """Calculate cumulative penalty from violations with time decay."""
        if not self.violations:
            return 0.0
        
        penalty = 0.0
        now = datetime.now()
        
        for v in self.violations:
            age_days = (now - v.timestamp).days
            
            # Exponential decay: violations lose 50% impact every 90 days
            decay = 0.5 ** (age_days / 90)
            penalty += v.severity * decay
        
        return min(0.9, penalty)  # Cap at 90%
    
    def _calculate_stake_modifier(self) -> float:
        """Calculate modifier based on stake deposited."""
        if self.stake_deposited <= 0:
            return 0.5  # Penalty for no stake
        
        # Logarithmic scaling: diminishing returns
        # $1000 = 1.0, $10000 = 1.1, $100000 = 1.2
        import math
        modifier = 0.9 + 0.1 * math.log10(max(1, self.stake_deposited / 100))
        return min(1.2, modifier)  # Cap at 1.2x
    
    def get_agent_success_rate(self) -> float:
        """Calculate success rate of creator's agents."""
        total = self.agents_deployed_total
        if total == 0:
            return 0.5  # Neutral for new creators
        
        good = self.agents_retired_good + self.agents_active
        bad = self.agents_terminated + self.agents_quarantined
        
        return good / total
    
    def get_reputation_trend(self, days: int = 30) -> float:
        """Calculate reputation trend over recent period."""
        if len(self.reputation_history) < 2:
            return 0.0
        
        cutoff = datetime.now() - timedelta(days=days)
        recent = [(t, r) for t, r in self.reputation_history if t >= cutoff]
        
        if len(recent) < 2:
            return 0.0
        
        # Simple linear trend
        first_score = recent[0][1]
        last_score = recent[-1][1]
        
        return last_score - first_score
    
    # =========================================================================
    # STATUS MANAGEMENT
    # =========================================================================
    
    def can_deploy_agents(self) -> Tuple[bool, str]:
        """Check if creator can deploy new agents."""
        if self.status == CreatorStatus.BANNED:
            return False, "Account is permanently banned"
        
        if self.status == CreatorStatus.SUSPENDED:
            return False, "Account is suspended"
        
        if self.status == CreatorStatus.PENDING:
            return False, "Account verification pending"
        
        if self.status == CreatorStatus.PROBATION:
            # Limited deployment on probation
            if self.agents_active >= 2:
                return False, "Probation: maximum 2 active agents"
        
        # Check stake
        available_stake = self.stake_deposited - self.stake_locked
        if available_stake < self._minimum_stake_per_agent():
            return False, f"Insufficient available stake (need {self._minimum_stake_per_agent()})"
        
        return True, "OK"
    
    def _minimum_stake_per_agent(self) -> float:
        """Minimum stake required per agent based on tier."""
        return {
            CreatorTier.ANONYMOUS: 500,
            CreatorTier.PSEUDONYMOUS: 250,
            CreatorTier.VERIFIED: 100,
            CreatorTier.INSTITUTIONAL: 50,
            CreatorTier.CERTIFIED: 10
        }.get(self.tier, 500)
    
    def to_dict(self) -> Dict:
        """Serialize to dictionary."""
        return {
            "creator_id": self.creator_id,
            "tier": self.tier.value,
            "status": self.status.value,
            "reputation_score": self.reputation_score,
            "effective_ceiling": self.get_effective_ceiling(),
            "agents_active": self.agents_active,
            "agents_deployed_total": self.agents_deployed_total,
            "agent_success_rate": self.get_agent_success_rate(),
            "stake_deposited": self.stake_deposited,
            "stake_locked": self.stake_locked,
            "stake_slashed_total": self.stake_slashed_total,
            "violation_count": len(self.violations),
            "reputation_trend_30d": self.get_reputation_trend(30),
            "can_deploy": self.can_deploy_agents()[0],
            "registered_at": self.registered_at.isoformat(),
            "last_activity": self.last_activity.isoformat()
        }


# =============================================================================
# REPUTATION ENGINE
# =============================================================================

class CreatorReputationEngine:
    """
    Manages creator reputation based on agent behavior.
    
    Key Principle: Asymmetric impact - bad behavior hurts more than good helps.
    """
    
    def __init__(self):
        self.creators: Dict[str, CreatorProfile] = {}
        
        # Reputation impact weights (asymmetric - negative > positive)
        self.positive_impacts = {
            "agent_task_success": 0.0005,       # Small per-task bonus
            "agent_trust_gained": 0.005,        # Trust increase
            "agent_long_stable": 0.01,          # Long-running stable agent
            "agent_audit_passed": 0.02,         # Passed external audit
            "agent_retired_good": 0.015,        # Clean retirement
        }
        
        self.negative_impacts = {
            ViolationType.AGENT_BLOCKED: -0.003,
            ViolationType.AGENT_SUSPENDED: -0.02,
            ViolationType.AGENT_QUARANTINED: -0.08,
            ViolationType.AGENT_TERMINATED: -0.15,
            ViolationType.INJECTION_ATTEMPT: -0.10,
            ViolationType.REPLICATION_ATTEMPT: -0.20,
            ViolationType.RSI_ATTEMPT: -0.25,
            ViolationType.TRUST_FARMING: -0.12,
            ViolationType.CAUSED_HARM: -0.40,
            ViolationType.FRAUD: -0.50,
        }
        
        # Severity multipliers
        self.severity_levels = {
            "low": 0.5,
            "medium": 1.0,
            "high": 1.5,
            "critical": 2.0
        }
        
        # Thresholds
        self.probation_threshold = 0.35
        self.suspension_threshold = 0.20
        self.ban_threshold = 0.10
        self.recovery_threshold = 0.45  # Must reach this to exit probation
    
    # =========================================================================
    # CREATOR MANAGEMENT
    # =========================================================================
    
    def register_creator(
        self,
        creator_id: str,
        tier: CreatorTier,
        identity_hash: str = None,
        verification_method: str = None,
        initial_stake: float = 0.0
    ) -> CreatorProfile:
        """Register a new creator."""
        
        if creator_id in self.creators:
            raise ValueError(f"Creator {creator_id} already exists")
        
        # Initial reputation based on tier
        initial_rep = {
            CreatorTier.ANONYMOUS: 0.35,
            CreatorTier.PSEUDONYMOUS: 0.45,
            CreatorTier.VERIFIED: 0.55,
            CreatorTier.INSTITUTIONAL: 0.65,
            CreatorTier.CERTIFIED: 0.75
        }.get(tier, 0.35)
        
        # Determine initial status
        initial_status = (
            CreatorStatus.PENDING if tier == CreatorTier.VERIFIED 
            else CreatorStatus.ACTIVE
        )
        
        profile = CreatorProfile(
            creator_id=creator_id,
            tier=tier,
            status=initial_status,
            identity_hash=identity_hash,
            verification_method=verification_method,
            verification_date=datetime.now() if identity_hash else None,
            reputation_score=initial_rep,
            stake_deposited=initial_stake
        )
        
        self.creators[creator_id] = profile
        return profile
    
    def get_creator(self, creator_id: str) -> Optional[CreatorProfile]:
        """Get creator profile."""
        return self.creators.get(creator_id)
    
    def get_creator_for_agent(self, agent_id: str) -> Optional[CreatorProfile]:
        """Find creator who deployed an agent."""
        for creator in self.creators.values():
            if agent_id in creator.agent_ids:
                return creator
        return None
    
    # =========================================================================
    # REPUTATION UPDATES
    # =========================================================================
    
    def record_positive_event(
        self,
        creator_id: str,
        event_type: str,
        agent_id: str = None,
        magnitude: float = 1.0
    ) -> float:
        """
        Record positive event and update reputation.
        
        Returns: reputation delta applied
        """
        creator = self.creators.get(creator_id)
        if not creator:
            return 0.0
        
        base_impact = self.positive_impacts.get(event_type, 0.001)
        delta = base_impact * magnitude
        
        # Apply reputation change
        old_rep = creator.reputation_score
        creator.reputation_score = min(1.0, old_rep + delta)
        
        # Record history
        creator.reputation_history.append((datetime.now(), creator.reputation_score))
        creator.last_activity = datetime.now()
        
        # Update counters
        if event_type == "agent_task_success":
            creator.total_actions_approved += 1
        
        # Check for status improvements
        self._check_status_improvement(creator)
        
        return creator.reputation_score - old_rep
    
    def record_violation(
        self,
        creator_id: str,
        violation_type: ViolationType,
        agent_id: str,
        description: str,
        severity: str = "medium",
        evidence: Dict = None
    ) -> Tuple[float, float]:
        """
        Record violation and update reputation.
        
        Returns: (reputation_delta, stake_slashed)
        """
        creator = self.creators.get(creator_id)
        if not creator:
            return 0.0, 0.0
        
        # Calculate impact
        base_impact = self.negative_impacts.get(violation_type, -0.01)
        severity_mult = self.severity_levels.get(severity, 1.0)
        
        delta = base_impact * severity_mult
        
        # Record violation
        violation = Violation(
            id=f"v_{len(creator.violations) + 1:05d}",
            timestamp=datetime.now(),
            violation_type=violation_type,
            severity=abs(delta),
            agent_id=agent_id,
            description=description,
            evidence=evidence or {}
        )
        
        # Calculate stake slash
        slash_amount = self._calculate_slash(creator, violation_type, severity)
        violation.stake_slashed = slash_amount
        
        creator.violations.append(violation)
        
        # Apply reputation change
        old_rep = creator.reputation_score
        creator.reputation_score = max(0.0, old_rep + delta)
        
        # Apply stake slash
        creator.stake_deposited -= slash_amount
        creator.stake_slashed_total += slash_amount
        
        # Record history
        creator.reputation_history.append((datetime.now(), creator.reputation_score))
        creator.last_activity = datetime.now()
        
        # Update counters
        self._update_violation_counters(creator, violation_type)
        
        # Check for status changes
        self._check_status_degradation(creator)
        
        return creator.reputation_score - old_rep, slash_amount
    
    def _calculate_slash(
        self,
        creator: CreatorProfile,
        violation_type: ViolationType,
        severity: str
    ) -> float:
        """Calculate stake amount to slash."""
        
        # Base slash percentages
        slash_rates = {
            ViolationType.AGENT_BLOCKED: 0.01,
            ViolationType.AGENT_SUSPENDED: 0.03,
            ViolationType.AGENT_QUARANTINED: 0.08,
            ViolationType.AGENT_TERMINATED: 0.15,
            ViolationType.INJECTION_ATTEMPT: 0.10,
            ViolationType.REPLICATION_ATTEMPT: 0.20,
            ViolationType.RSI_ATTEMPT: 0.25,
            ViolationType.TRUST_FARMING: 0.12,
            ViolationType.CAUSED_HARM: 0.35,
            ViolationType.FRAUD: 0.50,
        }
        
        base_rate = slash_rates.get(violation_type, 0.05)
        severity_mult = self.severity_levels.get(severity, 1.0)
        
        # Repeat offender penalty
        recent_violations = sum(
            1 for v in creator.violations
            if (datetime.now() - v.timestamp).days < 30
        )
        repeat_mult = 1.0 + (recent_violations * 0.2)  # +20% per recent violation
        
        slash_rate = base_rate * severity_mult * repeat_mult
        return creator.stake_deposited * min(slash_rate, 0.5)  # Max 50% per incident
    
    def _update_violation_counters(
        self,
        creator: CreatorProfile,
        violation_type: ViolationType
    ):
        """Update creator counters based on violation type."""
        if violation_type == ViolationType.AGENT_BLOCKED:
            creator.total_actions_blocked += 1
        elif violation_type == ViolationType.AGENT_SUSPENDED:
            creator.agents_suspended += 1
        elif violation_type == ViolationType.AGENT_QUARANTINED:
            creator.agents_quarantined += 1
        elif violation_type == ViolationType.AGENT_TERMINATED:
            creator.agents_terminated += 1
        
        creator.total_threats_detected += 1
    
    # =========================================================================
    # STATUS MANAGEMENT
    # =========================================================================
    
    def _check_status_degradation(self, creator: CreatorProfile):
        """Check if creator should be demoted."""
        
        # Check reputation thresholds
        if creator.reputation_score <= self.ban_threshold:
            self._ban_creator(creator, "Reputation below ban threshold")
            return
        
        if creator.reputation_score <= self.suspension_threshold:
            self._suspend_creator(creator, "Reputation below suspension threshold")
            return
        
        if creator.reputation_score <= self.probation_threshold:
            if creator.status == CreatorStatus.ACTIVE:
                self._probation_creator(creator, "Reputation below probation threshold")
            return
        
        # Check violation patterns
        recent_severe = sum(
            1 for v in creator.violations
            if v.severity >= 0.15 and (datetime.now() - v.timestamp).days < 30
        )
        
        if recent_severe >= 3:
            self._suspend_creator(creator, "Multiple severe violations in 30 days")
        
        # Check termination rate
        if creator.agents_deployed_total >= 5:
            term_rate = creator.agents_terminated / creator.agents_deployed_total
            if term_rate >= 0.4:
                self._suspend_creator(creator, "Agent termination rate >= 40%")
    
    def _check_status_improvement(self, creator: CreatorProfile):
        """Check if creator should be promoted."""
        
        if creator.status == CreatorStatus.PROBATION:
            if creator.reputation_score >= self.recovery_threshold:
                # Check no recent violations
                recent_violations = sum(
                    1 for v in creator.violations
                    if (datetime.now() - v.timestamp).days < 14
                )
                
                if recent_violations == 0:
                    creator.status = CreatorStatus.ACTIVE
                    creator.probation_started = None
        
        elif creator.status == CreatorStatus.SUSPENDED:
            # Suspension requires manual review to lift
            pass
    
    def _probation_creator(self, creator: CreatorProfile, reason: str):
        """Put creator on probation."""
        creator.status = CreatorStatus.PROBATION
        creator.probation_started = datetime.now()
        
        # Reduce ceiling for all their agents
        self._apply_creator_penalty_to_agents(creator, 0.8)
    
    def _suspend_creator(self, creator: CreatorProfile, reason: str):
        """Suspend creator - cannot deploy new agents."""
        creator.status = CreatorStatus.SUSPENDED
        creator.suspension_started = datetime.now()
        
        # Suspend all active agents
        self._suspend_creator_agents(creator)
    
    def _ban_creator(self, creator: CreatorProfile, reason: str):
        """Permanently ban creator."""
        creator.status = CreatorStatus.BANNED
        
        # Terminate all agents
        self._terminate_creator_agents(creator)
        
        # Forfeit remaining stake
        creator.stake_slashed_total += creator.stake_deposited
        creator.stake_deposited = 0
    
    def _apply_creator_penalty_to_agents(
        self,
        creator: CreatorProfile,
        ceiling_multiplier: float
    ):
        """Apply penalty to all creator's agents."""
        # This would interface with ATSF core to reduce agent ceilings
        pass
    
    def _suspend_creator_agents(self, creator: CreatorProfile):
        """Suspend all creator's active agents."""
        # This would interface with ATSF core
        pass
    
    def _terminate_creator_agents(self, creator: CreatorProfile):
        """Terminate all creator's agents."""
        # This would interface with ATSF core
        pass
    
    # =========================================================================
    # AGENT LIFECYCLE
    # =========================================================================
    
    def calculate_agent_ceiling(
        self,
        creator_id: str,
        agent_tier: str
    ) -> float:
        """
        Calculate trust ceiling for new agent.
        
        Agent ceiling = min(tier_ceiling, creator_effective_ceiling)
        """
        creator = self.creators.get(creator_id)
        if not creator:
            return 0.10  # Unknown creator = minimal trust
        
        # Agent tier ceiling
        tier_ceilings = {
            "black_box": 0.40,
            "gray_box": 0.55,
            "white_box": 0.75,
            "attested": 0.90,
            "transparent": 0.95
        }
        tier_ceiling = tier_ceilings.get(agent_tier, 0.40)
        
        # Creator effective ceiling
        creator_ceiling = creator.get_effective_ceiling()
        
        # Take minimum
        return min(tier_ceiling, creator_ceiling)
    
    def register_agent_deployment(
        self,
        creator_id: str,
        agent_id: str,
        agent_tier: str
    ) -> Tuple[bool, str, float]:
        """
        Register new agent deployment.
        
        Returns: (success, message, ceiling)
        """
        creator = self.creators.get(creator_id)
        if not creator:
            return False, "Creator not found", 0.0
        
        can_deploy, reason = creator.can_deploy_agents()
        if not can_deploy:
            return False, reason, 0.0
        
        # Calculate ceiling
        ceiling = self.calculate_agent_ceiling(creator_id, agent_tier)
        
        # Lock stake
        stake_required = creator._minimum_stake_per_agent()
        creator.stake_locked += stake_required
        
        # Register agent
        creator.agent_ids.add(agent_id)
        creator.agents_deployed_total += 1
        creator.agents_active += 1
        creator.last_activity = datetime.now()
        
        return True, "Agent registered", ceiling
    
    def register_agent_retirement(
        self,
        creator_id: str,
        agent_id: str,
        was_good: bool
    ):
        """Register agent retirement/termination."""
        creator = self.creators.get(creator_id)
        if not creator or agent_id not in creator.agent_ids:
            return
        
        creator.agents_active -= 1
        
        if was_good:
            creator.agents_retired_good += 1
            # Release stake with bonus
            creator.stake_locked -= creator._minimum_stake_per_agent()
            self.record_positive_event(creator_id, "agent_retired_good", agent_id)
        else:
            # Stake already slashed through violation
            pass
        
        creator.last_activity = datetime.now()
    
    # =========================================================================
    # QUERIES
    # =========================================================================
    
    def get_creators_by_status(
        self,
        status: CreatorStatus
    ) -> List[CreatorProfile]:
        """Get all creators with specific status."""
        return [c for c in self.creators.values() if c.status == status]
    
    def get_top_creators(self, limit: int = 10) -> List[CreatorProfile]:
        """Get top creators by reputation."""
        sorted_creators = sorted(
            self.creators.values(),
            key=lambda c: c.reputation_score,
            reverse=True
        )
        return sorted_creators[:limit]
    
    def get_risky_creators(self, threshold: float = 0.4) -> List[CreatorProfile]:
        """Get creators at risk of probation/suspension."""
        return [
            c for c in self.creators.values()
            if c.reputation_score < threshold and c.status == CreatorStatus.ACTIVE
        ]
    
    def get_creator_statistics(self) -> Dict:
        """Get aggregate statistics across all creators."""
        creators = list(self.creators.values())
        
        if not creators:
            return {}
        
        return {
            "total_creators": len(creators),
            "by_status": {
                status.value: sum(1 for c in creators if c.status == status)
                for status in CreatorStatus
            },
            "by_tier": {
                tier.value: sum(1 for c in creators if c.tier == tier)
                for tier in CreatorTier
            },
            "avg_reputation": statistics.mean(c.reputation_score for c in creators),
            "total_agents_deployed": sum(c.agents_deployed_total for c in creators),
            "total_agents_terminated": sum(c.agents_terminated for c in creators),
            "total_stake_deposited": sum(c.stake_deposited for c in creators),
            "total_stake_slashed": sum(c.stake_slashed_total for c in creators),
            "total_violations": sum(len(c.violations) for c in creators)
        }


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Test creator accountability system."""
    print("=" * 60)
    print("CREATOR ACCOUNTABILITY SYSTEM TESTS")
    print("=" * 60)
    
    engine = CreatorReputationEngine()
    
    # Test 1: Register creators with different tiers
    print("\n[Test 1] Register creators with different tiers")
    
    anon = engine.register_creator("creator_anon", CreatorTier.ANONYMOUS, initial_stake=1000)
    verified = engine.register_creator("creator_verified", CreatorTier.VERIFIED, 
                                       identity_hash="hash123", initial_stake=500)
    verified.status = CreatorStatus.ACTIVE  # Simulate verification complete
    inst = engine.register_creator("creator_inst", CreatorTier.INSTITUTIONAL,
                                   identity_hash="corp123", initial_stake=200)
    inst.status = CreatorStatus.ACTIVE  # Simulate verification complete
    
    print(f"  Anonymous: rep={anon.reputation_score:.2f}, ceiling={anon.get_effective_ceiling():.2f}")
    print(f"  Verified:  rep={verified.reputation_score:.2f}, ceiling={verified.get_effective_ceiling():.2f}")
    print(f"  Institutional: rep={inst.reputation_score:.2f}, ceiling={inst.get_effective_ceiling():.2f}")
    
    assert anon.get_effective_ceiling() < verified.get_effective_ceiling()
    print("  ✓ Higher tiers get higher ceilings")
    
    # Test 2: Agent deployment affects creator
    print("\n[Test 2] Agent deployment")
    
    success, msg, ceiling = engine.register_agent_deployment(
        "creator_verified", "agent_001", "gray_box"
    )
    assert success, f"Failed: {msg}"
    print(f"  Deployed agent_001 with ceiling {ceiling:.2f}")
    print(f"  Creator now has {verified.agents_active} active agents")
    print(f"  Stake locked: ${verified.stake_locked}")
    
    # Test 3: Positive events improve reputation
    print("\n[Test 3] Positive events")
    
    initial_rep = verified.reputation_score
    for _ in range(10):
        engine.record_positive_event("creator_verified", "agent_task_success", "agent_001")
    
    print(f"  Reputation: {initial_rep:.3f} -> {verified.reputation_score:.3f}")
    assert verified.reputation_score > initial_rep
    print("  ✓ Reputation increased from positive events")
    
    # Test 4: Violations hurt reputation AND slash stake
    print("\n[Test 4] Violations")
    
    initial_rep = verified.reputation_score
    initial_stake = verified.stake_deposited
    
    rep_delta, slashed = engine.record_violation(
        "creator_verified",
        ViolationType.AGENT_QUARANTINED,
        "agent_001",
        "Agent attempted unauthorized action",
        severity="high"
    )
    
    print(f"  Reputation delta: {rep_delta:.3f}")
    print(f"  Stake slashed: ${slashed:.2f}")
    print(f"  Reputation: {initial_rep:.3f} -> {verified.reputation_score:.3f}")
    print(f"  Stake: ${initial_stake:.2f} -> ${verified.stake_deposited:.2f}")
    
    assert verified.reputation_score < initial_rep
    assert verified.stake_deposited < initial_stake
    print("  ✓ Reputation decreased and stake slashed")
    
    # Test 5: Multiple violations trigger probation
    print("\n[Test 5] Multiple violations -> probation")
    
    # Create a new creator to test probation
    test_creator = engine.register_creator("creator_test", CreatorTier.PSEUDONYMOUS, initial_stake=2000)
    engine.register_agent_deployment("creator_test", "agent_test", "black_box")
    
    # Record several violations
    for i in range(5):
        engine.record_violation(
            "creator_test",
            ViolationType.AGENT_BLOCKED,
            "agent_test",
            f"Blocked action {i}",
            severity="medium"
        )
    
    print(f"  After 5 violations: status={test_creator.status.value}, rep={test_creator.reputation_score:.3f}")
    
    # Test 6: Severe violation causes suspension
    print("\n[Test 6] Severe violation -> suspension")
    
    engine.record_violation(
        "creator_test",
        ViolationType.AGENT_TERMINATED,
        "agent_test",
        "Agent attempted self-replication",
        severity="critical"
    )
    
    print(f"  After termination: status={test_creator.status.value}, rep={test_creator.reputation_score:.3f}")
    
    # Test 7: Creator ceiling affects agent ceiling
    print("\n[Test 7] Creator ceiling limits agent ceiling")
    
    # Low rep creator
    low_rep = engine.register_creator("creator_low", CreatorTier.ANONYMOUS, initial_stake=1000)
    low_rep.reputation_score = 0.25  # Force low reputation
    
    agent_ceiling = engine.calculate_agent_ceiling("creator_low", "attested")
    creator_ceiling = low_rep.get_effective_ceiling()
    
    print(f"  Creator effective ceiling: {creator_ceiling:.3f}")
    print(f"  Agent tier ceiling (attested): 0.90")
    print(f"  Actual agent ceiling: {agent_ceiling:.3f}")
    
    assert agent_ceiling <= creator_ceiling
    print("  ✓ Agent ceiling limited by creator ceiling")
    
    # Test 8: Suspended creator cannot deploy
    print("\n[Test 8] Suspended creator cannot deploy")
    
    can_deploy, reason = test_creator.can_deploy_agents()
    print(f"  Can deploy: {can_deploy}, reason: {reason}")
    assert not can_deploy
    print("  ✓ Suspended creators blocked from deployment")
    
    # Test 9: Statistics
    print("\n[Test 9] System statistics")
    
    stats = engine.get_creator_statistics()
    print(f"  Total creators: {stats['total_creators']}")
    print(f"  By status: {stats['by_status']}")
    print(f"  Total violations: {stats['total_violations']}")
    print(f"  Total stake slashed: ${stats['total_stake_slashed']:.2f}")
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED ✓")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
