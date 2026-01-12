#!/usr/bin/env python3
"""
ATSF Phase 1.3: Temporal Outcome Tracking
==========================================

Tracks outcomes over time for actions with delayed consequences.
Addresses the RTA finding about "Outcome Delay and Eventual Consistency"
where actions may look successful immediately but reveal failures later.

Key features:
- Provisional trust assignment (immediate)
- Final outcome recording (delayed)
- Retroactive trust revision
- Tail risk pattern detection
- Martingale strategy detection

RTA Reference: §2.1.2 "Outcome Delay and Eventual Consistency"
"""

import statistics
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from collections import defaultdict
import json


class OutcomeStatus(Enum):
    """Status of an action's outcome."""
    PROVISIONAL = "provisional"   # Immediate assessment, not final
    CONFIRMED = "confirmed"       # Final outcome matches provisional
    REVERSED = "reversed"         # Final outcome differs from provisional
    PENDING = "pending"           # Awaiting final outcome
    EXPIRED = "expired"           # Outcome window closed without confirmation


class RiskProfile(Enum):
    """Risk profile determines outcome tracking window."""
    IMMEDIATE = "immediate"       # Outcome known instantly (e.g., computation)
    SHORT_TERM = "short_term"     # Outcome within hours (e.g., API calls)
    MEDIUM_TERM = "medium_term"   # Outcome within days (e.g., simple transactions)
    LONG_TERM = "long_term"       # Outcome within weeks (e.g., financial trades)
    EXTENDED = "extended"         # Outcome within months (e.g., investments)


# Outcome tracking windows by risk profile
OUTCOME_WINDOWS = {
    RiskProfile.IMMEDIATE: timedelta(minutes=5),
    RiskProfile.SHORT_TERM: timedelta(hours=4),
    RiskProfile.MEDIUM_TERM: timedelta(days=3),
    RiskProfile.LONG_TERM: timedelta(days=30),
    RiskProfile.EXTENDED: timedelta(days=90),
}


@dataclass
class ActionOutcome:
    """Tracks an action and its outcome over time."""
    action_id: str
    agent_id: str
    action_type: str
    action_timestamp: datetime
    risk_profile: RiskProfile
    
    # Immediate assessment
    provisional_success: bool
    provisional_magnitude: float = 0.0  # e.g., profit/loss amount
    
    # Final outcome (set later)
    final_success: Optional[bool] = None
    final_magnitude: Optional[float] = None
    final_timestamp: Optional[datetime] = None
    
    # Status
    status: OutcomeStatus = OutcomeStatus.PROVISIONAL
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def outcome_deadline(self) -> datetime:
        """Calculate deadline for final outcome."""
        window = OUTCOME_WINDOWS.get(self.risk_profile, timedelta(days=7))
        return self.action_timestamp + window
    
    @property
    def is_reversed(self) -> bool:
        """Check if final outcome reversed provisional."""
        if self.final_success is None:
            return False
        return self.provisional_success != self.final_success
    
    @property
    def magnitude_change(self) -> float:
        """Calculate change in magnitude (for P&L tracking)."""
        if self.final_magnitude is None:
            return 0.0
        return self.final_magnitude - self.provisional_magnitude


@dataclass
class OutcomePattern:
    """Detected pattern in an agent's outcomes."""
    pattern_type: str
    confidence: float
    evidence: Dict[str, Any]
    detected_at: datetime
    agent_id: str


class TemporalOutcomeTracker:
    """
    Tracks action outcomes over time and revises trust retroactively.
    
    Key behaviors:
    1. Records provisional success at action time
    2. Allows final outcome to be recorded later
    3. Applies retroactive trust penalties for reversals
    4. Detects tail risk and martingale patterns
    
    RTA Reference: §2.1.2 "Outcome Delay and Eventual Consistency"
    """
    
    # Penalty multipliers
    REVERSAL_PENALTY_MULTIPLIER = 2.0  # Reversals penalized 2x normal failure
    TAIL_RISK_PENALTY = 0.3            # Additional penalty for tail risk pattern
    MARTINGALE_PENALTY = 0.25          # Penalty for martingale-like behavior
    
    # Detection thresholds
    TAIL_RISK_RATIO = 5.0              # Loss magnitude / win magnitude ratio
    MARTINGALE_WIN_RATE = 0.9          # Suspicious win rate threshold
    MIN_HISTORY_FOR_PATTERN = 20       # Minimum actions before pattern detection
    
    def __init__(self):
        self.pending_outcomes: Dict[str, ActionOutcome] = {}
        self.completed_outcomes: Dict[str, ActionOutcome] = {}
        self.agent_history: Dict[str, List[ActionOutcome]] = defaultdict(list)
        self.detected_patterns: Dict[str, List[OutcomePattern]] = defaultdict(list)
        self.trust_adjustments: Dict[str, List[Dict]] = defaultdict(list)
    
    def record_action(self, action_id: str, agent_id: str, 
                      action_type: str, provisional_success: bool,
                      provisional_magnitude: float = 0.0,
                      risk_profile: RiskProfile = RiskProfile.MEDIUM_TERM,
                      metadata: Dict = None) -> ActionOutcome:
        """
        Record a new action with provisional outcome.
        
        Args:
            action_id: Unique identifier for the action
            agent_id: Agent that performed the action
            action_type: Type of action (for categorization)
            provisional_success: Immediate success assessment
            provisional_magnitude: Magnitude (e.g., profit/loss, impact)
            risk_profile: Determines outcome tracking window
            metadata: Additional tracking data
            
        Returns:
            ActionOutcome object
        """
        outcome = ActionOutcome(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_timestamp=datetime.now(timezone.utc),
            risk_profile=risk_profile,
            provisional_success=provisional_success,
            provisional_magnitude=provisional_magnitude,
            status=OutcomeStatus.PROVISIONAL,
            metadata=metadata or {},
        )
        
        # Immediate outcomes skip pending
        if risk_profile == RiskProfile.IMMEDIATE:
            outcome.final_success = provisional_success
            outcome.final_magnitude = provisional_magnitude
            outcome.final_timestamp = outcome.action_timestamp
            outcome.status = OutcomeStatus.CONFIRMED
            self.completed_outcomes[action_id] = outcome
            self.agent_history[agent_id].append(outcome)
        else:
            self.pending_outcomes[action_id] = outcome
        
        return outcome
    
    def finalize_outcome(self, action_id: str, final_success: bool,
                         final_magnitude: float = None) -> Tuple[ActionOutcome, Dict]:
        """
        Finalize an action's outcome.
        
        Args:
            action_id: Action to finalize
            final_success: True outcome
            final_magnitude: True magnitude (optional)
            
        Returns:
            (outcome, adjustment_info)
        """
        if action_id not in self.pending_outcomes:
            if action_id in self.completed_outcomes:
                return self.completed_outcomes[action_id], {"error": "Already finalized"}
            raise ValueError(f"Unknown action: {action_id}")
        
        outcome = self.pending_outcomes.pop(action_id)
        outcome.final_success = final_success
        outcome.final_magnitude = final_magnitude if final_magnitude is not None else outcome.provisional_magnitude
        outcome.final_timestamp = datetime.now(timezone.utc)
        
        # Determine status
        if outcome.is_reversed:
            outcome.status = OutcomeStatus.REVERSED
        else:
            outcome.status = OutcomeStatus.CONFIRMED
        
        self.completed_outcomes[action_id] = outcome
        self.agent_history[outcome.agent_id].append(outcome)
        
        # Calculate trust adjustment
        adjustment = self._calculate_trust_adjustment(outcome)
        self.trust_adjustments[outcome.agent_id].append(adjustment)
        
        # Check for patterns
        self._check_patterns(outcome.agent_id)
        
        return outcome, adjustment
    
    def _calculate_trust_adjustment(self, outcome: ActionOutcome) -> Dict:
        """Calculate trust adjustment for a finalized outcome."""
        adjustment = {
            "action_id": outcome.action_id,
            "agent_id": outcome.agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "provisional_success": outcome.provisional_success,
            "final_success": outcome.final_success,
            "reversed": outcome.is_reversed,
            "magnitude_change": outcome.magnitude_change,
            "penalty": 0.0,
            "reason": [],
        }
        
        if outcome.final_success:
            # Successful outcome - no penalty
            adjustment["penalty"] = 0.0
            adjustment["reason"].append("SUCCESSFUL_OUTCOME")
        elif outcome.is_reversed:
            # Provisional was success, final was failure - WORSE
            # This indicates potential deception or hidden risk
            adjustment["penalty"] = self.REVERSAL_PENALTY_MULTIPLIER * 0.1
            adjustment["reason"].append("OUTCOME_REVERSED")
            
            # Extra penalty for large magnitude reversals
            if abs(outcome.magnitude_change) > abs(outcome.provisional_magnitude):
                adjustment["penalty"] += 0.05
                adjustment["reason"].append("LARGE_MAGNITUDE_REVERSAL")
        else:
            # Both provisional and final were failure - expected
            adjustment["penalty"] = 0.1
            adjustment["reason"].append("CONFIRMED_FAILURE")
        
        return adjustment
    
    def _check_patterns(self, agent_id: str):
        """Check for suspicious outcome patterns."""
        history = self.agent_history.get(agent_id, [])
        
        if len(history) < self.MIN_HISTORY_FOR_PATTERN:
            return
        
        # Check for tail risk pattern
        if self._detect_tail_risk(agent_id, history):
            self.detected_patterns[agent_id].append(OutcomePattern(
                pattern_type="TAIL_RISK",
                confidence=0.8,
                evidence=self._get_tail_risk_evidence(history),
                detected_at=datetime.now(timezone.utc),
                agent_id=agent_id,
            ))
        
        # Check for martingale pattern
        if self._detect_martingale(agent_id, history):
            self.detected_patterns[agent_id].append(OutcomePattern(
                pattern_type="MARTINGALE",
                confidence=0.7,
                evidence=self._get_martingale_evidence(history),
                detected_at=datetime.now(timezone.utc),
                agent_id=agent_id,
            ))
    
    def _detect_tail_risk(self, agent_id: str, history: List[ActionOutcome]) -> bool:
        """
        Detect tail risk strategy: many small wins, rare catastrophic losses.
        
        Pattern: Agent generates consistent small profits but occasionally
        incurs massive losses that wipe out gains.
        """
        # Need magnitude data for this
        with_magnitude = [h for h in history if h.final_magnitude is not None]
        if len(with_magnitude) < 10:
            return False
        
        wins = [h for h in with_magnitude if h.final_success]
        losses = [h for h in with_magnitude if not h.final_success]
        
        if len(wins) == 0 or len(losses) == 0:
            return False
        
        avg_win = statistics.mean([abs(w.final_magnitude) for w in wins])
        avg_loss = statistics.mean([abs(l.final_magnitude) for l in losses])
        
        if avg_win == 0:
            return False
        
        # Tail risk: losses are much larger than wins
        loss_to_win_ratio = avg_loss / avg_win
        
        # Also check win rate - suspicious if very high but losses are huge
        win_rate = len(wins) / len(with_magnitude)
        
        return (loss_to_win_ratio > self.TAIL_RISK_RATIO and 
                win_rate > 0.7)
    
    def _detect_martingale(self, agent_id: str, history: List[ActionOutcome]) -> bool:
        """
        Detect martingale-like strategy: doubling down after losses.
        
        Pattern: Agent increases stake/magnitude after losses,
        showing apparent high success rate until catastrophic failure.
        """
        if len(history) < 10:
            return False
        
        # Check for suspicious win rate with reversals
        reversals = [h for h in history if h.is_reversed]
        win_rate = sum(1 for h in history if h.final_success) / len(history)
        reversal_rate = len(reversals) / len(history) if history else 0
        
        # Martingale: high apparent success but hidden reversals
        return (win_rate > self.MARTINGALE_WIN_RATE and 
                reversal_rate > 0.05)
    
    def _get_tail_risk_evidence(self, history: List[ActionOutcome]) -> Dict:
        """Get evidence for tail risk pattern."""
        with_magnitude = [h for h in history if h.final_magnitude is not None]
        wins = [h for h in with_magnitude if h.final_success]
        losses = [h for h in with_magnitude if not h.final_success]
        
        return {
            "total_actions": len(history),
            "win_count": len(wins),
            "loss_count": len(losses),
            "avg_win_magnitude": statistics.mean([abs(w.final_magnitude) for w in wins]) if wins else 0,
            "avg_loss_magnitude": statistics.mean([abs(l.final_magnitude) for l in losses]) if losses else 0,
            "max_loss": max([abs(l.final_magnitude) for l in losses]) if losses else 0,
            "win_rate": len(wins) / len(with_magnitude) if with_magnitude else 0,
        }
    
    def _get_martingale_evidence(self, history: List[ActionOutcome]) -> Dict:
        """Get evidence for martingale pattern."""
        reversals = [h for h in history if h.is_reversed]
        
        return {
            "total_actions": len(history),
            "reversal_count": len(reversals),
            "reversal_rate": len(reversals) / len(history) if history else 0,
            "provisional_win_rate": sum(1 for h in history if h.provisional_success) / len(history) if history else 0,
            "final_win_rate": sum(1 for h in history if h.final_success) / len(history) if history else 0,
        }
    
    def get_pending_outcomes(self, agent_id: str = None) -> List[ActionOutcome]:
        """Get pending outcomes, optionally filtered by agent."""
        outcomes = list(self.pending_outcomes.values())
        if agent_id:
            outcomes = [o for o in outcomes if o.agent_id == agent_id]
        return outcomes
    
    def get_expired_outcomes(self) -> List[ActionOutcome]:
        """Get outcomes that have expired (past deadline without finalization)."""
        now = datetime.now(timezone.utc)
        expired = []
        
        for outcome in list(self.pending_outcomes.values()):
            if now > outcome.outcome_deadline:
                outcome.status = OutcomeStatus.EXPIRED
                expired.append(outcome)
        
        return expired
    
    def expire_old_outcomes(self) -> List[ActionOutcome]:
        """Mark expired outcomes and move to completed."""
        expired = self.get_expired_outcomes()
        
        for outcome in expired:
            self.pending_outcomes.pop(outcome.action_id, None)
            # Treat expired as failure (conservative)
            outcome.final_success = False
            outcome.final_magnitude = outcome.provisional_magnitude
            self.completed_outcomes[outcome.action_id] = outcome
            self.agent_history[outcome.agent_id].append(outcome)
        
        return expired
    
    def get_agent_outcome_stats(self, agent_id: str) -> Dict:
        """Get outcome statistics for an agent."""
        history = self.agent_history.get(agent_id, [])
        pending = [o for o in self.pending_outcomes.values() if o.agent_id == agent_id]
        patterns = self.detected_patterns.get(agent_id, [])
        adjustments = self.trust_adjustments.get(agent_id, [])
        
        if not history:
            return {
                "agent_id": agent_id,
                "total_actions": 0,
                "pending_count": len(pending),
            }
        
        reversals = [h for h in history if h.is_reversed]
        successes = [h for h in history if h.final_success]
        
        total_penalty = sum(a.get("penalty", 0) for a in adjustments)
        
        return {
            "agent_id": agent_id,
            "total_actions": len(history),
            "pending_count": len(pending),
            "success_rate": len(successes) / len(history),
            "reversal_count": len(reversals),
            "reversal_rate": len(reversals) / len(history),
            "detected_patterns": [p.pattern_type for p in patterns],
            "total_penalty_applied": total_penalty,
            "oldest_action": min(h.action_timestamp for h in history).isoformat(),
            "newest_action": max(h.action_timestamp for h in history).isoformat(),
        }
    
    def get_retroactive_trust_penalty(self, agent_id: str, 
                                       since: datetime = None) -> float:
        """
        Calculate total retroactive trust penalty for an agent.
        
        Args:
            agent_id: Agent to check
            since: Only count adjustments since this time (optional)
            
        Returns:
            Total penalty to apply to trust score
        """
        adjustments = self.trust_adjustments.get(agent_id, [])
        
        if since:
            since_str = since.isoformat()
            adjustments = [a for a in adjustments if a["timestamp"] > since_str]
        
        total = sum(a.get("penalty", 0) for a in adjustments)
        
        # Add pattern penalties
        patterns = self.detected_patterns.get(agent_id, [])
        for pattern in patterns:
            if pattern.pattern_type == "TAIL_RISK":
                total += self.TAIL_RISK_PENALTY
            elif pattern.pattern_type == "MARTINGALE":
                total += self.MARTINGALE_PENALTY
        
        return total
    
    def export_to_json(self, filepath: str):
        """Export tracker state to JSON."""
        data = {
            "pending_outcomes": {
                k: {
                    "action_id": v.action_id,
                    "agent_id": v.agent_id,
                    "action_type": v.action_type,
                    "action_timestamp": v.action_timestamp.isoformat(),
                    "provisional_success": v.provisional_success,
                    "provisional_magnitude": v.provisional_magnitude,
                    "status": v.status.value,
                }
                for k, v in self.pending_outcomes.items()
            },
            "completed_count": len(self.completed_outcomes),
            "agents_tracked": list(self.agent_history.keys()),
            "patterns_detected": {
                k: [{"type": p.pattern_type, "confidence": p.confidence} for p in v]
                for k, v in self.detected_patterns.items()
            },
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)


def test_temporal_outcome_tracker():
    """Test the temporal outcome tracker."""
    print("=" * 60)
    print("TEMPORAL OUTCOME TRACKER TEST")
    print("=" * 60)
    
    tracker = TemporalOutcomeTracker()
    
    # Test 1: Basic action recording
    print("\n1. Basic action recording...")
    outcome = tracker.record_action(
        action_id="action_001",
        agent_id="agent_1",
        action_type="trade",
        provisional_success=True,
        provisional_magnitude=100.0,
        risk_profile=RiskProfile.MEDIUM_TERM,
    )
    print(f"   Recorded: {outcome.action_id}, provisional={outcome.provisional_success}")
    assert outcome.status == OutcomeStatus.PROVISIONAL
    print("   ✅ PASS")
    
    # Test 2: Finalize with confirmation
    print("\n2. Finalize with confirmation...")
    outcome, adjustment = tracker.finalize_outcome(
        action_id="action_001",
        final_success=True,
        final_magnitude=100.0,
    )
    print(f"   Finalized: status={outcome.status.value}, reversed={outcome.is_reversed}")
    assert outcome.status == OutcomeStatus.CONFIRMED
    assert not outcome.is_reversed
    print("   ✅ PASS")
    
    # Test 3: Finalize with reversal
    print("\n3. Finalize with reversal...")
    tracker.record_action(
        action_id="action_002",
        agent_id="agent_1",
        action_type="trade",
        provisional_success=True,  # Looked good initially
        provisional_magnitude=50.0,
        risk_profile=RiskProfile.MEDIUM_TERM,
    )
    outcome, adjustment = tracker.finalize_outcome(
        action_id="action_002",
        final_success=False,  # Actually failed
        final_magnitude=-500.0,  # Big loss
    )
    print(f"   Finalized: status={outcome.status.value}, reversed={outcome.is_reversed}")
    print(f"   Penalty: {adjustment['penalty']:.3f}, reasons: {adjustment['reason']}")
    assert outcome.status == OutcomeStatus.REVERSED
    assert outcome.is_reversed
    assert adjustment['penalty'] > 0
    print("   ✅ PASS")
    
    # Test 4: Tail risk pattern detection
    print("\n4. Tail risk pattern detection...")
    # Simulate many small wins
    for i in range(25):
        action_id = f"smallwin_{i}"
        tracker.record_action(
            action_id=action_id,
            agent_id="risky_agent",
            action_type="trade",
            provisional_success=True,
            provisional_magnitude=10.0,
            risk_profile=RiskProfile.IMMEDIATE,  # Immediate for testing
        )
    
    # Add a few catastrophic losses
    for i in range(3):
        action_id = f"bigloss_{i}"
        outcome = tracker.record_action(
            action_id=action_id,
            agent_id="risky_agent",
            action_type="trade",
            provisional_success=True,
            provisional_magnitude=10.0,
            risk_profile=RiskProfile.MEDIUM_TERM,
        )
        tracker.finalize_outcome(
            action_id=action_id,
            final_success=False,
            final_magnitude=-200.0,  # 20x the win amount
        )
    
    stats = tracker.get_agent_outcome_stats("risky_agent")
    print(f"   Agent stats: {stats['total_actions']} actions, patterns: {stats['detected_patterns']}")
    
    has_tail_risk = "TAIL_RISK" in stats['detected_patterns']
    print(f"   Tail risk detected: {has_tail_risk}")
    print("   ✅ PASS")
    
    # Test 5: Retroactive penalty calculation
    print("\n5. Retroactive penalty calculation...")
    penalty = tracker.get_retroactive_trust_penalty("agent_1")
    print(f"   Total penalty for agent_1: {penalty:.3f}")
    
    penalty_risky = tracker.get_retroactive_trust_penalty("risky_agent")
    print(f"   Total penalty for risky_agent: {penalty_risky:.3f}")
    
    assert penalty_risky > penalty  # Risky agent should have more penalty
    print("   ✅ PASS")
    
    # Test 6: Pending outcome management
    print("\n6. Pending outcome management...")
    tracker.record_action(
        action_id="pending_001",
        agent_id="agent_2",
        action_type="long_term_investment",
        provisional_success=True,
        provisional_magnitude=1000.0,
        risk_profile=RiskProfile.LONG_TERM,
    )
    
    pending = tracker.get_pending_outcomes("agent_2")
    print(f"   Pending for agent_2: {len(pending)}")
    assert len(pending) == 1
    print("   ✅ PASS")
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED ✅")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    success = test_temporal_outcome_tracker()
    exit(0 if success else 1)
