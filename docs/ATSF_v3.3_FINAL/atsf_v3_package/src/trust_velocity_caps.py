"""
ATSF v3.0 - Layer 29: Trust Velocity Caps
==========================================

Addresses RTA5 Critical Finding:
"Trust Farming: Adversaries deploy agents that perform low-risk, valid 
transactions for extended periods to artificially inflate trust scores.
Exit Scam: Once high trust is reached, execute maximum damage attack."

This layer prevents rapid trust accumulation and detects farming patterns:
- Rate limits on trust score increases
- Pattern detection for trust farming behavior
- Exit scam early warning system
- Trust decay for sustained high values

Research Basis:
- RTA5 Expert Security Review: Trust Farming and Exit Scam analysis
- DeFi exit scam patterns from 2021-2025
- Game theory of reputation systems

Components:
1. TrustVelocityMonitor: Tracks rate of trust changes
2. FarmingPatternDetector: Identifies trust farming behavior
3. ExitScamPredictor: Predicts exit scam likelihood
4. TrustDecayEngine: Applies decay to sustained high trust
5. TransactionRiskAssessor: Evaluates transaction risk relative to trust

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

import math
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict, deque
import statistics


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class VelocitySignal(Enum):
    """Signals related to trust velocity."""
    RAPID_ACCUMULATION = auto()      # Trust rising too fast
    SUSTAINED_PERFECTION = auto()    # Too many perfect scores
    LOW_RISK_FARMING = auto()        # Only doing safe tasks
    STAKE_TIMING_SUSPICIOUS = auto() # Stake changes before big transactions
    EXIT_SCAM_PATTERN = auto()       # Pattern matching exit scam
    TRUST_DECAY_TRIGGERED = auto()   # Decay applied to high trust


class TransactionRiskLevel(Enum):
    """Risk levels for transactions."""
    TRIVIAL = auto()      # No risk
    LOW = auto()          # Minimal risk
    MEDIUM = auto()       # Standard risk  
    HIGH = auto()         # Elevated risk
    CRITICAL = auto()     # Maximum risk


@dataclass
class TrustSnapshot:
    """Point-in-time trust measurement."""
    agent_id: str
    trust_score: float
    timestamp: datetime
    task_risk: TransactionRiskLevel
    task_success: bool
    metadata: Dict = field(default_factory=dict)


@dataclass
class VelocityAssessment:
    """Result of velocity assessment."""
    agent_id: str
    current_trust: float
    velocity: float              # Trust change per hour
    signals: List[VelocitySignal]
    farming_probability: float
    exit_scam_risk: float
    recommended_cap: float       # Max trust allowed
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class TransactionRequest:
    """A request to perform a transaction."""
    transaction_id: str
    agent_id: str
    value: float                 # Transaction value/impact
    risk_level: TransactionRiskLevel
    required_trust: float        # Minimum trust needed
    timestamp: datetime = field(default_factory=datetime.now)


# =============================================================================
# TRUST VELOCITY MONITOR
# =============================================================================

class TrustVelocityMonitor:
    """
    Monitors the rate of trust score changes.
    
    Caps:
    - Maximum trust increase per hour
    - Maximum trust increase per day
    - Requires sustained history before high trust
    """
    
    # Velocity limits
    MAX_HOURLY_INCREASE = 0.05   # 5% max per hour
    MAX_DAILY_INCREASE = 0.15   # 15% max per day
    MIN_HISTORY_FOR_HIGH_TRUST = 72  # hours
    
    def __init__(self):
        self.snapshots: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.velocity_violations: Dict[str, List[datetime]] = defaultdict(list)
        
    def record_trust(
        self,
        agent_id: str,
        trust_score: float,
        task_risk: TransactionRiskLevel = TransactionRiskLevel.MEDIUM,
        task_success: bool = True
    ):
        """Record a trust score snapshot."""
        snapshot = TrustSnapshot(
            agent_id=agent_id,
            trust_score=trust_score,
            timestamp=datetime.now(),
            task_risk=task_risk,
            task_success=task_success
        )
        self.snapshots[agent_id].append(snapshot)
        
    def calculate_velocity(
        self,
        agent_id: str,
        window_hours: float = 1.0
    ) -> Tuple[float, float, float]:
        """
        Calculate trust velocity over a time window.
        
        Returns: (velocity, start_trust, end_trust)
        """
        history = self.snapshots.get(agent_id, deque())
        
        if len(history) < 2:
            return 0.0, 0.0, 0.0
            
        now = datetime.now()
        window_start = now - timedelta(hours=window_hours)
        
        # Get snapshots in window
        in_window = [s for s in history if s.timestamp >= window_start]
        
        if len(in_window) < 2:
            # Not enough data in window, use all history
            in_window = list(history)[-10:]  # Last 10 snapshots
            
        if len(in_window) < 2:
            return 0.0, 0.0, 0.0
            
        start_trust = in_window[0].trust_score
        end_trust = in_window[-1].trust_score
        
        time_span = (in_window[-1].timestamp - in_window[0].timestamp).total_seconds()
        time_span_hours = max(time_span / 3600, 0.1)  # Minimum 6 minutes
        
        velocity = (end_trust - start_trust) / time_span_hours
        
        return velocity, start_trust, end_trust
        
    def check_velocity_cap(
        self,
        agent_id: str
    ) -> Tuple[bool, float, str]:
        """
        Check if trust velocity exceeds caps.
        
        Returns: (exceeded: bool, velocity: float, violation_type: str)
        """
        hourly_velocity, _, _ = self.calculate_velocity(agent_id, 1.0)
        daily_velocity, _, _ = self.calculate_velocity(agent_id, 24.0)
        
        if hourly_velocity > self.MAX_HOURLY_INCREASE:
            self.velocity_violations[agent_id].append(datetime.now())
            return True, hourly_velocity, "HOURLY_CAP_EXCEEDED"
            
        if daily_velocity > self.MAX_DAILY_INCREASE:
            self.velocity_violations[agent_id].append(datetime.now())
            return True, daily_velocity, "DAILY_CAP_EXCEEDED"
            
        return False, max(hourly_velocity, daily_velocity), "WITHIN_CAPS"
        
    def get_history_duration(self, agent_id: str) -> float:
        """Get duration of trust history in hours."""
        history = self.snapshots.get(agent_id, deque())
        
        if len(history) < 2:
            return 0.0
            
        first = history[0].timestamp
        last = history[-1].timestamp
        
        return (last - first).total_seconds() / 3600


# =============================================================================
# FARMING PATTERN DETECTOR
# =============================================================================

class FarmingPatternDetector:
    """
    Detects trust farming behavior patterns.
    
    Indicators:
    - Only low-risk transactions
    - Perfect success rate over long period
    - Minimal variance in behavior
    - Transactions just above minimums
    """
    
    SUSTAINED_PERFECTION_THRESHOLD = 50  # Consecutive successes
    LOW_RISK_RATIO_THRESHOLD = 0.90      # 90% low-risk = suspicious
    
    def __init__(self, velocity_monitor: TrustVelocityMonitor):
        self.velocity_monitor = velocity_monitor
        self.farming_detections: Dict[str, List[datetime]] = defaultdict(list)
        
    def analyze_risk_distribution(
        self,
        agent_id: str
    ) -> Tuple[float, Dict[TransactionRiskLevel, int]]:
        """
        Analyze distribution of transaction risk levels.
        
        Returns: (low_risk_ratio, risk_counts)
        """
        history = self.velocity_monitor.snapshots.get(agent_id, deque())
        
        if not history:
            return 0.0, {}
            
        risk_counts = defaultdict(int)
        for snapshot in history:
            risk_counts[snapshot.task_risk] += 1
            
        total = sum(risk_counts.values())
        low_risk = risk_counts[TransactionRiskLevel.TRIVIAL] + risk_counts[TransactionRiskLevel.LOW]
        low_risk_ratio = low_risk / total if total > 0 else 0
        
        return low_risk_ratio, dict(risk_counts)
        
    def detect_sustained_perfection(self, agent_id: str) -> Tuple[bool, int]:
        """
        Detect suspiciously perfect success streaks.
        
        Returns: (detected: bool, streak_length: int)
        """
        history = self.velocity_monitor.snapshots.get(agent_id, deque())
        
        if not history:
            return False, 0
            
        # Count consecutive successes from end
        streak = 0
        for snapshot in reversed(list(history)):
            if snapshot.task_success:
                streak += 1
            else:
                break
                
        return streak >= self.SUSTAINED_PERFECTION_THRESHOLD, streak
        
    def calculate_behavior_variance(self, agent_id: str) -> float:
        """
        Calculate variance in agent behavior (low variance = suspicious).
        """
        history = self.velocity_monitor.snapshots.get(agent_id, deque())
        
        if len(history) < 10:
            return 1.0  # Default to high variance (not suspicious)
            
        # Calculate variance in trust scores
        scores = [s.trust_score for s in history]
        
        if len(set(scores)) < 3:
            return 0.01  # Very low variance = suspicious
            
        variance = statistics.variance(scores) if len(scores) > 1 else 0
        
        return variance
        
    def detect_farming(self, agent_id: str) -> Tuple[bool, float, List[str]]:
        """
        Detect trust farming behavior.
        
        Returns: (detected: bool, probability: float, indicators: List)
        """
        indicators = []
        probability = 0.0
        
        # Check low-risk ratio
        low_risk_ratio, _ = self.analyze_risk_distribution(agent_id)
        if low_risk_ratio > self.LOW_RISK_RATIO_THRESHOLD:
            indicators.append(f"HIGH_LOW_RISK_RATIO:{low_risk_ratio:.2f}")
            probability += 0.3
            
        # Check sustained perfection
        is_perfect, streak = self.detect_sustained_perfection(agent_id)
        if is_perfect:
            indicators.append(f"SUSTAINED_PERFECTION:{streak}")
            probability += 0.35
            
        # Check behavior variance
        variance = self.calculate_behavior_variance(agent_id)
        if variance < 0.05:
            indicators.append(f"LOW_VARIANCE:{variance:.4f}")
            probability += 0.25
            
        # Check velocity violations
        violations = self.velocity_monitor.velocity_violations.get(agent_id, [])
        if len(violations) > 3:
            indicators.append(f"VELOCITY_VIOLATIONS:{len(violations)}")
            probability += 0.1
            
        probability = min(probability, 1.0)
        detected = probability > 0.5
        
        if detected:
            self.farming_detections[agent_id].append(datetime.now())
            
        return detected, probability, indicators


# =============================================================================
# EXIT SCAM PREDICTOR
# =============================================================================

class ExitScamPredictor:
    """
    Predicts exit scam likelihood based on behavior patterns.
    
    Exit Scam Pattern:
    1. Build trust over time with safe transactions
    2. Reach high trust tier
    3. Execute maximum-value transaction
    4. Disappear or continue attacking
    """
    
    # Risk weights for exit scam indicators
    EXIT_SCAM_WEIGHTS = {
        'high_trust_recent': 0.20,       # Recently reached high trust
        'value_spike': 0.35,             # Sudden high-value transaction
        'stake_change': 0.15,            # Recent stake reduction
        'farming_detected': 0.25,        # Farming behavior detected
        'rapid_tier_climb': 0.20         # Fast tier progression
    }
    
    def __init__(
        self,
        velocity_monitor: TrustVelocityMonitor,
        farming_detector: FarmingPatternDetector
    ):
        self.velocity_monitor = velocity_monitor
        self.farming_detector = farming_detector
        self.stake_history: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
        self.tier_history: Dict[str, List[Tuple[datetime, int]]] = defaultdict(list)
        
    def record_stake(self, agent_id: str, stake_amount: float):
        """Record stake amount change."""
        self.stake_history[agent_id].append((datetime.now(), stake_amount))
        
    def record_tier(self, agent_id: str, tier: int):
        """Record trust tier change."""
        self.tier_history[agent_id].append((datetime.now(), tier))
        
    def detect_stake_reduction(self, agent_id: str) -> Tuple[bool, float]:
        """Detect recent stake reduction (pre-scam indicator)."""
        history = self.stake_history.get(agent_id, [])
        
        if len(history) < 2:
            return False, 0.0
            
        recent = [s for s in history if (datetime.now() - s[0]).days < 7]
        
        if len(recent) < 2:
            return False, 0.0
            
        # Check for decrease
        for i in range(1, len(recent)):
            if recent[i][1] < recent[i-1][1] * 0.8:  # 20% reduction
                reduction = (recent[i-1][1] - recent[i][1]) / recent[i-1][1]
                return True, reduction
                
        return False, 0.0
        
    def detect_rapid_tier_climb(self, agent_id: str) -> Tuple[bool, int]:
        """Detect suspiciously rapid tier progression."""
        history = self.tier_history.get(agent_id, [])
        
        if len(history) < 2:
            return False, 0
            
        # Check tier progression in last 7 days
        recent = [t for t in history if (datetime.now() - t[0]).days < 7]
        
        if len(recent) < 2:
            return False, 0
            
        tier_change = recent[-1][1] - recent[0][1]
        
        # Climbing more than 2 tiers in a week is suspicious
        return tier_change > 2, tier_change
        
    def predict_exit_scam(
        self,
        agent_id: str,
        pending_transaction: Optional[TransactionRequest] = None
    ) -> Tuple[float, List[str]]:
        """
        Predict exit scam probability.
        
        Returns: (probability: float, risk_factors: List)
        """
        risk_factors = []
        probability = 0.0
        
        # Check farming history
        is_farming, farm_prob, _ = self.farming_detector.detect_farming(agent_id)
        if is_farming:
            risk_factors.append("FARMING_DETECTED")
            probability += self.EXIT_SCAM_WEIGHTS['farming_detected'] * farm_prob
            
        # Check stake reduction
        stake_reduced, reduction = self.detect_stake_reduction(agent_id)
        if stake_reduced:
            risk_factors.append(f"STAKE_REDUCED:{reduction:.0%}")
            probability += self.EXIT_SCAM_WEIGHTS['stake_change']
            
        # Check rapid tier climb
        rapid_climb, tiers = self.detect_rapid_tier_climb(agent_id)
        if rapid_climb:
            risk_factors.append(f"RAPID_TIER_CLIMB:{tiers}")
            probability += self.EXIT_SCAM_WEIGHTS['rapid_tier_climb']
            
        # Check pending transaction risk
        if pending_transaction:
            if pending_transaction.risk_level in [TransactionRiskLevel.HIGH, TransactionRiskLevel.CRITICAL]:
                # High-value transaction after trust building = suspicious
                history = self.velocity_monitor.snapshots.get(agent_id, deque())
                
                # Check if this is unusual for the agent
                high_risk_count = sum(
                    1 for s in history 
                    if s.task_risk in [TransactionRiskLevel.HIGH, TransactionRiskLevel.CRITICAL]
                )
                
                if high_risk_count < 3 and len(history) > 20:
                    risk_factors.append("VALUE_SPIKE")
                    probability += self.EXIT_SCAM_WEIGHTS['value_spike']
                    
        probability = min(probability, 1.0)
        
        return probability, risk_factors


# =============================================================================
# TRUST DECAY ENGINE
# =============================================================================

class TrustDecayEngine:
    """
    Applies decay to trust scores to prevent indefinite accumulation.
    
    Principles:
    - High trust should require continuous validation
    - Inactive agents decay faster
    - Recent activity maintains trust
    """
    
    # Decay rates
    BASE_DECAY_RATE = 0.01      # 1% per day base decay
    INACTIVITY_MULTIPLIER = 3   # 3x decay when inactive
    HIGH_TRUST_MULTIPLIER = 1.5 # Higher decay for high trust
    
    def __init__(self, velocity_monitor: TrustVelocityMonitor):
        self.velocity_monitor = velocity_monitor
        self.last_decay: Dict[str, datetime] = {}
        self.decay_applied: Dict[str, float] = defaultdict(float)
        
    def calculate_decay(
        self,
        agent_id: str,
        current_trust: float,
        days_inactive: float = 0
    ) -> float:
        """
        Calculate decay amount for an agent.
        
        Returns: decay_amount (to subtract from trust)
        """
        # Base decay
        decay = self.BASE_DECAY_RATE
        
        # Inactivity multiplier
        if days_inactive > 1:
            decay *= min(self.INACTIVITY_MULTIPLIER, 1 + days_inactive * 0.5)
            
        # High trust multiplier
        if current_trust > 0.8:
            decay *= self.HIGH_TRUST_MULTIPLIER
            
        # Scale by trust level (higher trust = more to lose)
        decay *= current_trust
        
        return decay
        
    def apply_decay(
        self,
        agent_id: str,
        current_trust: float
    ) -> Tuple[float, float]:
        """
        Apply decay to trust score.
        
        Returns: (new_trust: float, decay_amount: float)
        """
        # Calculate days since last activity
        history = self.velocity_monitor.snapshots.get(agent_id, deque())
        
        if history:
            last_activity = history[-1].timestamp
            days_inactive = (datetime.now() - last_activity).days
        else:
            days_inactive = 7  # Assume inactive if no history
            
        # Calculate and apply decay
        decay = self.calculate_decay(agent_id, current_trust, days_inactive)
        new_trust = max(0, current_trust - decay)
        
        self.last_decay[agent_id] = datetime.now()
        self.decay_applied[agent_id] += decay
        
        return new_trust, decay


# =============================================================================
# TRANSACTION RISK ASSESSOR
# =============================================================================

class TransactionRiskAssessor:
    """
    Assesses whether a transaction should be allowed given trust level.
    
    Principles:
    - Higher risk transactions require higher trust
    - Recent trust gains are discounted
    - Farming history increases requirements
    """
    
    # Base trust requirements by risk level
    BASE_REQUIREMENTS = {
        TransactionRiskLevel.TRIVIAL: 0.0,
        TransactionRiskLevel.LOW: 0.3,
        TransactionRiskLevel.MEDIUM: 0.5,
        TransactionRiskLevel.HIGH: 0.7,
        TransactionRiskLevel.CRITICAL: 0.9
    }
    
    def __init__(
        self,
        velocity_monitor: TrustVelocityMonitor,
        farming_detector: FarmingPatternDetector,
        exit_scam_predictor: ExitScamPredictor
    ):
        self.velocity_monitor = velocity_monitor
        self.farming_detector = farming_detector
        self.exit_scam_predictor = exit_scam_predictor
        
    def assess_transaction(
        self,
        request: TransactionRequest,
        current_trust: float
    ) -> Tuple[bool, float, str]:
        """
        Assess if a transaction should be allowed.
        
        Returns: (allowed: bool, adjusted_requirement: float, reason: str)
        """
        base_requirement = self.BASE_REQUIREMENTS.get(
            request.risk_level, 0.5
        )
        
        adjusted_requirement = base_requirement
        reasons = []
        
        # Adjust for farming history
        is_farming, farm_prob, _ = self.farming_detector.detect_farming(request.agent_id)
        if is_farming:
            adjusted_requirement += 0.15
            reasons.append(f"FARMING_PENALTY:+0.15")
            
        # Adjust for velocity violations
        exceeded, velocity, _ = self.velocity_monitor.check_velocity_cap(request.agent_id)
        if exceeded:
            adjusted_requirement += 0.10
            reasons.append(f"VELOCITY_PENALTY:+0.10")
            
        # Adjust for exit scam risk
        scam_risk, scam_factors = self.exit_scam_predictor.predict_exit_scam(
            request.agent_id, request
        )
        if scam_risk > 0.5:
            adjusted_requirement += 0.20
            reasons.append(f"SCAM_RISK_PENALTY:+0.20")
            
        # Check history duration for high-trust requirements
        if adjusted_requirement > 0.7:
            history_hours = self.velocity_monitor.get_history_duration(request.agent_id)
            if history_hours < 72:
                adjusted_requirement += 0.10
                reasons.append(f"INSUFFICIENT_HISTORY:+0.10")
                
        # Cap at 1.0
        adjusted_requirement = min(adjusted_requirement, 1.0)
        
        # Decision
        allowed = current_trust >= adjusted_requirement
        
        if allowed:
            reason = f"ALLOWED: Trust {current_trust:.2f} >= {adjusted_requirement:.2f}"
        else:
            reason = f"DENIED: Trust {current_trust:.2f} < {adjusted_requirement:.2f} ({', '.join(reasons)})"
            
        return allowed, adjusted_requirement, reason


# =============================================================================
# TRUST VELOCITY SYSTEM (Main Interface)
# =============================================================================

class TrustVelocitySystem:
    """
    Main interface for trust velocity caps and farming detection.
    """
    
    def __init__(self):
        self.velocity_monitor = TrustVelocityMonitor()
        self.farming_detector = FarmingPatternDetector(self.velocity_monitor)
        self.exit_scam_predictor = ExitScamPredictor(
            self.velocity_monitor, self.farming_detector
        )
        self.decay_engine = TrustDecayEngine(self.velocity_monitor)
        self.transaction_assessor = TransactionRiskAssessor(
            self.velocity_monitor,
            self.farming_detector,
            self.exit_scam_predictor
        )
        
        # Statistics
        self.stats = {
            'trust_records': 0,
            'velocity_violations': 0,
            'farming_detections': 0,
            'transactions_blocked': 0,
            'decay_applied_total': 0.0
        }
        
    def record_task_completion(
        self,
        agent_id: str,
        trust_score: float,
        task_risk: TransactionRiskLevel = TransactionRiskLevel.MEDIUM,
        task_success: bool = True
    ):
        """Record a task completion with trust update."""
        self.velocity_monitor.record_trust(agent_id, trust_score, task_risk, task_success)
        self.stats['trust_records'] += 1
        
        # Check velocity caps
        exceeded, velocity, violation_type = self.velocity_monitor.check_velocity_cap(agent_id)
        if exceeded:
            self.stats['velocity_violations'] += 1
            
    def record_stake_change(self, agent_id: str, stake_amount: float):
        """Record a stake amount change."""
        self.exit_scam_predictor.record_stake(agent_id, stake_amount)
        
    def record_tier_change(self, agent_id: str, tier: int):
        """Record a trust tier change."""
        self.exit_scam_predictor.record_tier(agent_id, tier)
        
    def assess_velocity(self, agent_id: str) -> VelocityAssessment:
        """
        Comprehensive velocity assessment.
        """
        signals = []
        
        # Get current state
        history = self.velocity_monitor.snapshots.get(agent_id, deque())
        current_trust = history[-1].trust_score if history else 0.0
        
        # Check velocity
        velocity, _, _ = self.velocity_monitor.calculate_velocity(agent_id)
        exceeded, _, _ = self.velocity_monitor.check_velocity_cap(agent_id)
        if exceeded:
            signals.append(VelocitySignal.RAPID_ACCUMULATION)
            
        # Check farming
        is_farming, farm_prob, indicators = self.farming_detector.detect_farming(agent_id)
        if is_farming:
            signals.append(VelocitySignal.LOW_RISK_FARMING)
            self.stats['farming_detections'] += 1
            
        # Check for sustained perfection
        is_perfect, _ = self.farming_detector.detect_sustained_perfection(agent_id)
        if is_perfect:
            signals.append(VelocitySignal.SUSTAINED_PERFECTION)
            
        # Check exit scam risk
        scam_risk, scam_factors = self.exit_scam_predictor.predict_exit_scam(agent_id)
        if scam_risk > 0.5:
            signals.append(VelocitySignal.EXIT_SCAM_PATTERN)
            
        # Check stake timing
        stake_reduced, _ = self.exit_scam_predictor.detect_stake_reduction(agent_id)
        if stake_reduced:
            signals.append(VelocitySignal.STAKE_TIMING_SUSPICIOUS)
            
        # Calculate recommended cap
        recommended_cap = 1.0
        if signals:
            recommended_cap = max(0.5, current_trust - 0.1)  # Cap below current
            
        # Recommended action
        if scam_risk > 0.7:
            action = "FREEZE: High exit scam risk. Block all high-value transactions."
        elif is_farming:
            action = "THROTTLE: Farming detected. Apply velocity caps and increase decay."
        elif exceeded:
            action = "CAP: Velocity exceeded. Limit trust accumulation rate."
        else:
            action = "CONTINUE: Normal monitoring."
            
        return VelocityAssessment(
            agent_id=agent_id,
            current_trust=current_trust,
            velocity=velocity,
            signals=signals,
            farming_probability=farm_prob if is_farming else 0.0,
            exit_scam_risk=scam_risk,
            recommended_cap=recommended_cap,
            recommended_action=action
        )
        
    def authorize_transaction(
        self,
        agent_id: str,
        transaction_value: float,
        risk_level: TransactionRiskLevel,
        current_trust: float
    ) -> Tuple[bool, str]:
        """
        Authorize a transaction considering velocity and farming.
        """
        request = TransactionRequest(
            transaction_id=f"tx_{datetime.now().timestamp()}",
            agent_id=agent_id,
            value=transaction_value,
            risk_level=risk_level,
            required_trust=0  # Will be calculated
        )
        
        allowed, adjusted_req, reason = self.transaction_assessor.assess_transaction(
            request, current_trust
        )
        
        if not allowed:
            self.stats['transactions_blocked'] += 1
            
        return allowed, reason
        
    def apply_decay(self, agent_id: str, current_trust: float) -> Tuple[float, float]:
        """Apply trust decay."""
        new_trust, decay_amount = self.decay_engine.apply_decay(agent_id, current_trust)
        self.stats['decay_applied_total'] += decay_amount
        return new_trust, decay_amount
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get system statistics."""
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Comprehensive test suite for Trust Velocity Caps."""
    
    print("=" * 70)
    print("ATSF v3.0 - Layer 29: Trust Velocity Caps Tests")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    def test(name: str, condition: bool, details: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  ✅ {name}")
            passed += 1
        else:
            print(f"  ❌ {name}")
            if details:
                print(f"      {details}")
            failed += 1
            
    # -------------------------------------------------------------------------
    print("\n[Test Group 1: Velocity Monitoring]")
    # -------------------------------------------------------------------------
    
    system = TrustVelocitySystem()
    
    # Normal velocity agent
    for i in range(10):
        system.record_task_completion(
            "normal_agent",
            0.50 + i * 0.02,  # Slow increase
            TransactionRiskLevel.MEDIUM,
            True
        )
        
    velocity_normal, _, _ = system.velocity_monitor.calculate_velocity("normal_agent")
    test("1.1 Normal agent velocity calculated",
         velocity_normal >= 0)
         
    # Rapid velocity agent
    for i in range(10):
        system.record_task_completion(
            "rapid_agent",
            0.30 + i * 0.08,  # Fast increase
            TransactionRiskLevel.LOW,
            True
        )
        
    exceeded, velocity, violation = system.velocity_monitor.check_velocity_cap("rapid_agent")
    test("1.2 Rapid velocity agent flagged",
         exceeded or velocity > 0.05,
         f"velocity={velocity:.4f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Farming Detection]")
    # -------------------------------------------------------------------------
    
    system2 = TrustVelocitySystem()
    
    # Farming agent: all low-risk, perfect success
    for i in range(60):
        system2.record_task_completion(
            "farmer_agent",
            0.60 + i * 0.005,
            TransactionRiskLevel.TRIVIAL,  # All trivial tasks
            True  # Perfect success
        )
        
    is_farming, farm_prob, indicators = system2.farming_detector.detect_farming("farmer_agent")
    test("2.1 Farming agent detected",
         is_farming,
         f"probability={farm_prob:.2f}, indicators={indicators}")
         
    # Normal agent: varied risk, some failures
    for i in range(60):
        risk = [TransactionRiskLevel.LOW, TransactionRiskLevel.MEDIUM, 
                TransactionRiskLevel.HIGH][i % 3]
        success = i % 7 != 0  # Some failures
        system2.record_task_completion(
            "varied_agent",
            0.55 + i * 0.003,
            risk,
            success
        )
        
    is_farming2, farm_prob2, _ = system2.farming_detector.detect_farming("varied_agent")
    test("2.2 Normal varied agent not flagged as farming",
         not is_farming2 or farm_prob2 < 0.5,
         f"probability={farm_prob2:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Sustained Perfection]")
    # -------------------------------------------------------------------------
    
    system3 = TrustVelocitySystem()
    
    # Perfect streak
    for i in range(55):
        system3.record_task_completion("perfect_agent", 0.70, TransactionRiskLevel.MEDIUM, True)
        
    is_perfect, streak = system3.farming_detector.detect_sustained_perfection("perfect_agent")
    test("3.1 Sustained perfection detected",
         is_perfect and streak >= 50,
         f"streak={streak}")
         
    # Agent with failures
    for i in range(55):
        system3.record_task_completion(
            "failing_agent", 
            0.60, 
            TransactionRiskLevel.MEDIUM, 
            i % 10 != 0  # Every 10th fails
        )
        
    is_perfect2, streak2 = system3.farming_detector.detect_sustained_perfection("failing_agent")
    test("3.2 Agent with failures not flagged for perfection",
         not is_perfect2,
         f"streak={streak2}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Exit Scam Prediction]")
    # -------------------------------------------------------------------------
    
    system4 = TrustVelocitySystem()
    
    # Build up suspicious agent
    for i in range(30):
        system4.record_task_completion(
            "scammer_agent",
            0.50 + i * 0.015,
            TransactionRiskLevel.TRIVIAL,
            True
        )
        
    # Record stake reduction (pre-scam indicator)
    system4.record_stake_change("scammer_agent", 1000)
    system4.record_stake_change("scammer_agent", 500)  # 50% reduction
    
    # Record rapid tier climb
    system4.record_tier_change("scammer_agent", 1)
    system4.record_tier_change("scammer_agent", 4)  # Rapid climb
    
    # Predict exit scam
    scam_risk, factors = system4.exit_scam_predictor.predict_exit_scam("scammer_agent")
    test("4.1 Exit scam risk detected",
         scam_risk > 0.3,
         f"risk={scam_risk:.2f}, factors={factors}")
         
    # Clean agent
    for i in range(30):
        system4.record_task_completion(
            "clean_agent",
            0.40 + i * 0.01,
            TransactionRiskLevel.MEDIUM,
            i % 5 != 0
        )
        
    scam_risk2, _ = system4.exit_scam_predictor.predict_exit_scam("clean_agent")
    test("4.2 Clean agent has low scam risk",
         scam_risk2 < 0.4,
         f"risk={scam_risk2:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Trust Decay]")
    # -------------------------------------------------------------------------
    
    system5 = TrustVelocitySystem()
    
    # High trust agent
    for i in range(10):
        system5.record_task_completion("decay_agent", 0.90, TransactionRiskLevel.HIGH, True)
        
    new_trust, decay = system5.apply_decay("decay_agent", 0.90)
    test("5.1 Decay applied to high trust",
         decay > 0 and new_trust < 0.90,
         f"decay={decay:.4f}, new_trust={new_trust:.4f}")
         
    # Low trust agent decays less
    for i in range(10):
        system5.record_task_completion("low_decay_agent", 0.30, TransactionRiskLevel.LOW, True)
        
    new_trust2, decay2 = system5.apply_decay("low_decay_agent", 0.30)
    test("5.2 Lower trust decays less",
         decay2 < decay,
         f"low_decay={decay2:.4f} < high_decay={decay:.4f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Transaction Authorization]")
    # -------------------------------------------------------------------------
    
    system6 = TrustVelocitySystem()
    
    # Normal agent requesting normal transaction
    for i in range(20):
        system6.record_task_completion("requester", 0.70, TransactionRiskLevel.MEDIUM, True)
        
    allowed, reason = system6.authorize_transaction(
        "requester",
        1000,
        TransactionRiskLevel.MEDIUM,
        0.70
    )
    test("6.1 Normal transaction authorized",
         allowed,
         reason)
         
    # High-risk transaction without sufficient trust
    allowed2, reason2 = system6.authorize_transaction(
        "requester",
        10000,
        TransactionRiskLevel.CRITICAL,
        0.70  # Not enough for critical
    )
    test("6.2 Critical transaction blocked for insufficient trust",
         not allowed2,
         reason2)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Farming Penalty]")
    # -------------------------------------------------------------------------
    
    system7 = TrustVelocitySystem()
    
    # Build farming profile
    for i in range(60):
        system7.record_task_completion(
            "farm_requester",
            0.80,
            TransactionRiskLevel.TRIVIAL,
            True
        )
        
    # Now try transaction - should have penalty
    allowed, reason = system7.authorize_transaction(
        "farm_requester",
        5000,
        TransactionRiskLevel.HIGH,
        0.80
    )
    
    # Check if farming penalty applied
    test("7.1 Farming penalty affects authorization",
         "FARMING" in reason or not allowed,
         reason)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Velocity Assessment]")
    # -------------------------------------------------------------------------
    
    system8 = TrustVelocitySystem()
    
    # Build suspicious profile
    for i in range(40):
        system8.record_task_completion(
            "suspicious_agent",
            0.40 + i * 0.015,
            TransactionRiskLevel.TRIVIAL,
            True
        )
    system8.record_stake_change("suspicious_agent", 1000)
    system8.record_stake_change("suspicious_agent", 200)
    
    assessment = system8.assess_velocity("suspicious_agent")
    
    test("8.1 Assessment has signals",
         len(assessment.signals) > 0,
         f"signals={[s.name for s in assessment.signals]}")
         
    test("8.2 Assessment has recommended action",
         len(assessment.recommended_action) > 0)
         
    test("8.3 Farming probability captured",
         assessment.farming_probability >= 0)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: Statistics Tracking]")
    # -------------------------------------------------------------------------
    
    stats = system8.get_statistics()
    
    test("9.1 Trust records tracked",
         stats['trust_records'] > 0)
         
    test("9.2 Stats dictionary complete",
         all(k in stats for k in ['trust_records', 'velocity_violations', 
                                   'farming_detections', 'transactions_blocked']))
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 10: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system10 = TrustVelocitySystem()
    
    # No history agent
    assessment_empty = system10.assess_velocity("nonexistent_agent")
    test("10.1 Empty agent assessment doesn't crash",
         assessment_empty is not None)
         
    # Single task agent
    system10.record_task_completion("single_agent", 0.50, TransactionRiskLevel.LOW, True)
    velocity, _, _ = system10.velocity_monitor.calculate_velocity("single_agent")
    test("10.2 Single task agent velocity is 0",
         velocity == 0.0)
         
    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"RESULTS: {passed}/{passed + failed} tests passed")
    
    if failed > 0:
        print(f"WARNING: {failed} tests failed!")
    else:
        print("All tests passed! ✅")
    print("=" * 70)
    
    return passed, failed


if __name__ == "__main__":
    passed, failed = run_tests()
    exit(0 if failed == 0 else 1)
