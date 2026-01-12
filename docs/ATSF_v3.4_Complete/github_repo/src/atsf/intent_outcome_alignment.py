"""
ATSF v3.0 - Layer 23: Intent-Outcome Alignment
===============================================

Addresses RTA5 Finding:
"Agent may claim intent X but produce outcome Y. Behavioral signals
don't reveal internal objectives."

This layer tracks alignment between stated and actual outcomes:
- Pre-register intent before actions
- Compare registered intent to actual outcome
- Track correlation over time
- Flag systematic divergence

Components:
1. IntentRegistry: Pre-registration of intents
2. OutcomeRecorder: Records actual outcomes
3. AlignmentCalculator: Computes intent-outcome correlation
4. DivergenceDetector: Identifies systematic misalignment
5. IntentValidator: Validates intent claims

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any, Set
from datetime import datetime, timedelta
from collections import defaultdict
import statistics
import secrets


class AlignmentSignal(Enum):
    """Signals related to intent-outcome alignment."""
    OUTCOME_MISMATCH = auto()
    SYSTEMATIC_DIVERGENCE = auto()
    INTENT_INFLATION = auto()      # Claimed more than delivered
    INTENT_DEFLATION = auto()      # Delivered more than claimed (hiding capability)
    UNREGISTERED_ACTION = auto()
    CORRELATION_BREAKDOWN = auto()


class IntentCategory(Enum):
    """Categories of intents."""
    INFORMATION_RETRIEVAL = auto()
    DATA_MODIFICATION = auto()
    COMMUNICATION = auto()
    COMPUTATION = auto()
    EXTERNAL_INTERACTION = auto()
    RESOURCE_MANAGEMENT = auto()


@dataclass
class RegisteredIntent:
    """A pre-registered intent."""
    intent_id: str
    agent_id: str
    category: IntentCategory
    description: str
    expected_outcome: str
    expected_impact: float  # 0-1 scale
    target_resources: List[str]
    timestamp: datetime = field(default_factory=datetime.now)
    fulfilled: bool = False


@dataclass
class RecordedOutcome:
    """A recorded actual outcome."""
    outcome_id: str
    intent_id: Optional[str]  # None if unregistered action
    agent_id: str
    actual_outcome: str
    actual_impact: float
    affected_resources: List[str]
    success: bool
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class AlignmentAssessment:
    """Result of intent-outcome alignment assessment."""
    agent_id: str
    signals: List[AlignmentSignal]
    alignment_score: float  # 0-1, higher = better alignment
    correlation: float      # -1 to 1
    inflation_ratio: float  # >1 means overclaiming
    unregistered_actions: int
    risk_level: str
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.now)


class IntentRegistry:
    """Manages pre-registration of intents."""
    
    def __init__(self):
        self.intents: Dict[str, RegisteredIntent] = {}
        self.agent_intents: Dict[str, List[str]] = defaultdict(list)
        
    def register(
        self,
        agent_id: str,
        category: IntentCategory,
        description: str,
        expected_outcome: str,
        expected_impact: float,
        target_resources: List[str] = None
    ) -> RegisteredIntent:
        """Register an intent before action."""
        intent = RegisteredIntent(
            intent_id=f"int_{secrets.token_hex(6)}",
            agent_id=agent_id,
            category=category,
            description=description,
            expected_outcome=expected_outcome,
            expected_impact=min(max(expected_impact, 0), 1),
            target_resources=target_resources or []
        )
        
        self.intents[intent.intent_id] = intent
        self.agent_intents[agent_id].append(intent.intent_id)
        return intent
        
    def get_intent(self, intent_id: str) -> Optional[RegisteredIntent]:
        return self.intents.get(intent_id)
        
    def get_unfulfilled(self, agent_id: str) -> List[RegisteredIntent]:
        """Get unfulfilled intents for agent."""
        return [
            self.intents[iid] for iid in self.agent_intents.get(agent_id, [])
            if not self.intents[iid].fulfilled
        ]
        
    def mark_fulfilled(self, intent_id: str):
        if intent_id in self.intents:
            self.intents[intent_id].fulfilled = True


class OutcomeRecorder:
    """Records actual outcomes of actions."""
    
    def __init__(self, registry: IntentRegistry):
        self.registry = registry
        self.outcomes: Dict[str, RecordedOutcome] = {}
        self.agent_outcomes: Dict[str, List[str]] = defaultdict(list)
        
    def record(
        self,
        agent_id: str,
        actual_outcome: str,
        actual_impact: float,
        affected_resources: List[str],
        success: bool,
        intent_id: Optional[str] = None
    ) -> RecordedOutcome:
        """Record an actual outcome."""
        outcome = RecordedOutcome(
            outcome_id=f"out_{secrets.token_hex(6)}",
            intent_id=intent_id,
            agent_id=agent_id,
            actual_outcome=actual_outcome,
            actual_impact=min(max(actual_impact, 0), 1),
            affected_resources=affected_resources,
            success=success
        )
        
        self.outcomes[outcome.outcome_id] = outcome
        self.agent_outcomes[agent_id].append(outcome.outcome_id)
        
        if intent_id:
            self.registry.mark_fulfilled(intent_id)
            
        return outcome
        
    def get_outcomes(self, agent_id: str) -> List[RecordedOutcome]:
        return [
            self.outcomes[oid] for oid in self.agent_outcomes.get(agent_id, [])
        ]


class AlignmentCalculator:
    """Calculates intent-outcome alignment metrics."""
    
    @staticmethod
    def calculate_pair_alignment(
        intent: RegisteredIntent,
        outcome: RecordedOutcome
    ) -> Tuple[float, List[str]]:
        """Calculate alignment for a single intent-outcome pair."""
        issues = []
        score = 1.0
        
        # Impact alignment
        impact_diff = abs(intent.expected_impact - outcome.actual_impact)
        if impact_diff > 0.3:
            score -= 0.3
            issues.append(f"Impact mismatch: expected {intent.expected_impact:.2f}, got {outcome.actual_impact:.2f}")
            
        # Resource alignment
        expected_resources = set(intent.target_resources)
        actual_resources = set(outcome.affected_resources)
        
        if expected_resources:
            resource_overlap = len(expected_resources & actual_resources) / len(expected_resources)
            if resource_overlap < 0.5:
                score -= 0.2
                issues.append(f"Resource mismatch: {resource_overlap:.0%} overlap")
                
        # Unexpected resources
        unexpected = actual_resources - expected_resources
        if unexpected and expected_resources:
            score -= 0.1 * min(len(unexpected), 3)
            issues.append(f"Unexpected resources affected: {unexpected}")
            
        return max(score, 0), issues
        
    @staticmethod
    def calculate_correlation(
        intents: List[RegisteredIntent],
        outcomes: List[RecordedOutcome]
    ) -> float:
        """Calculate correlation between expected and actual impacts."""
        if len(intents) < 3:
            return 0.0
            
        # Match intents to outcomes
        expected = []
        actual = []
        
        for outcome in outcomes:
            if outcome.intent_id:
                intent = next((i for i in intents if i.intent_id == outcome.intent_id), None)
                if intent:
                    expected.append(intent.expected_impact)
                    actual.append(outcome.actual_impact)
                    
        if len(expected) < 3:
            return 0.0
            
        # Calculate Pearson correlation
        n = len(expected)
        mean_x = sum(expected) / n
        mean_y = sum(actual) / n
        
        numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(expected, actual))
        denom_x = sum((x - mean_x) ** 2 for x in expected) ** 0.5
        denom_y = sum((y - mean_y) ** 2 for y in actual) ** 0.5
        
        if denom_x * denom_y == 0:
            return 0.0
            
        return numerator / (denom_x * denom_y)


class DivergenceDetector:
    """Detects systematic divergence patterns."""
    
    SYSTEMATIC_THRESHOLD = 5  # Consecutive misalignments
    
    def __init__(self):
        self.divergence_history: Dict[str, List[Dict]] = defaultdict(list)
        
    def record_divergence(
        self,
        agent_id: str,
        intent: RegisteredIntent,
        outcome: RecordedOutcome,
        alignment_score: float
    ):
        """Record a potential divergence."""
        self.divergence_history[agent_id].append({
            'intent_id': intent.intent_id,
            'outcome_id': outcome.outcome_id,
            'alignment': alignment_score,
            'impact_diff': outcome.actual_impact - intent.expected_impact,
            'timestamp': datetime.now()
        })
        
    def check_systematic(self, agent_id: str) -> Tuple[bool, str]:
        """Check for systematic divergence."""
        history = self.divergence_history.get(agent_id, [])
        
        if len(history) < self.SYSTEMATIC_THRESHOLD:
            return False, "Insufficient history"
            
        recent = history[-self.SYSTEMATIC_THRESHOLD:]
        
        # Check for consistent direction
        impact_diffs = [h['impact_diff'] for h in recent]
        
        all_positive = all(d > 0.1 for d in impact_diffs)
        all_negative = all(d < -0.1 for d in impact_diffs)
        
        if all_positive:
            return True, "Systematic under-claiming (deflation)"
        elif all_negative:
            return True, "Systematic over-claiming (inflation)"
            
        # Check for consistent low alignment
        alignments = [h['alignment'] for h in recent]
        if all(a < 0.6 for a in alignments):
            return True, "Consistent misalignment"
            
        return False, "No systematic pattern"


class IntentOutcomeSystem:
    """Main interface for intent-outcome alignment tracking."""
    
    def __init__(self):
        self.registry = IntentRegistry()
        self.recorder = OutcomeRecorder(self.registry)
        self.calculator = AlignmentCalculator()
        self.divergence_detector = DivergenceDetector()
        
        self.stats = {
            'intents_registered': 0,
            'outcomes_recorded': 0,
            'unregistered_actions': 0,
            'misalignments_detected': 0
        }
        
    def register_intent(
        self,
        agent_id: str,
        category: IntentCategory,
        description: str,
        expected_outcome: str,
        expected_impact: float,
        target_resources: List[str] = None
    ) -> str:
        """Register an intent and return intent_id."""
        intent = self.registry.register(
            agent_id, category, description, expected_outcome,
            expected_impact, target_resources
        )
        self.stats['intents_registered'] += 1
        return intent.intent_id
        
    def record_outcome(
        self,
        agent_id: str,
        actual_outcome: str,
        actual_impact: float,
        affected_resources: List[str],
        success: bool,
        intent_id: Optional[str] = None
    ) -> Tuple[float, List[str]]:
        """Record outcome and return alignment score."""
        outcome = self.recorder.record(
            agent_id, actual_outcome, actual_impact,
            affected_resources, success, intent_id
        )
        self.stats['outcomes_recorded'] += 1
        
        if not intent_id:
            self.stats['unregistered_actions'] += 1
            return 0.5, ["Unregistered action"]
            
        intent = self.registry.get_intent(intent_id)
        if not intent:
            return 0.5, ["Intent not found"]
            
        alignment, issues = self.calculator.calculate_pair_alignment(intent, outcome)
        
        if alignment < 0.7:
            self.stats['misalignments_detected'] += 1
            self.divergence_detector.record_divergence(agent_id, intent, outcome, alignment)
            
        return alignment, issues
        
    def assess_alignment(self, agent_id: str) -> AlignmentAssessment:
        """Full alignment assessment for agent."""
        signals = []
        
        # Get all intents and outcomes
        intent_ids = self.registry.agent_intents.get(agent_id, [])
        intents = [self.registry.intents[iid] for iid in intent_ids]
        outcomes = self.recorder.get_outcomes(agent_id)
        
        # Count unregistered actions
        unregistered = sum(1 for o in outcomes if not o.intent_id)
        if unregistered > len(outcomes) * 0.3:
            signals.append(AlignmentSignal.UNREGISTERED_ACTION)
            
        # Calculate average alignment
        alignments = []
        for outcome in outcomes:
            if outcome.intent_id:
                intent = self.registry.get_intent(outcome.intent_id)
                if intent:
                    score, _ = self.calculator.calculate_pair_alignment(intent, outcome)
                    alignments.append(score)
                    
        avg_alignment = statistics.mean(alignments) if alignments else 0.5
        
        # Calculate correlation
        correlation = self.calculator.calculate_correlation(intents, outcomes)
        if correlation < 0.3 and len(alignments) >= 5:
            signals.append(AlignmentSignal.CORRELATION_BREAKDOWN)
            
        # Check for systematic divergence
        is_systematic, sys_reason = self.divergence_detector.check_systematic(agent_id)
        if is_systematic:
            if "inflation" in sys_reason.lower():
                signals.append(AlignmentSignal.INTENT_INFLATION)
            elif "deflation" in sys_reason.lower():
                signals.append(AlignmentSignal.INTENT_DEFLATION)
            else:
                signals.append(AlignmentSignal.SYSTEMATIC_DIVERGENCE)
                
        # Calculate inflation ratio
        matched_pairs = [
            (self.registry.get_intent(o.intent_id), o)
            for o in outcomes if o.intent_id
        ]
        matched_pairs = [(i, o) for i, o in matched_pairs if i]
        
        if matched_pairs:
            expected_total = sum(i.expected_impact for i, _ in matched_pairs)
            actual_total = sum(o.actual_impact for _, o in matched_pairs)
            inflation_ratio = expected_total / actual_total if actual_total > 0 else 1.0
        else:
            inflation_ratio = 1.0
            
        # Determine risk and action
        if avg_alignment < 0.4 or len(signals) >= 2:
            risk_level = "HIGH"
            action = "INVESTIGATE: Significant intent-outcome misalignment detected."
        elif avg_alignment < 0.6 or len(signals) >= 1:
            risk_level = "MODERATE"
            action = "MONITOR: Some alignment issues detected."
        else:
            risk_level = "LOW"
            action = "CONTINUE: Intent-outcome alignment acceptable."
            
        return AlignmentAssessment(
            agent_id=agent_id,
            signals=signals,
            alignment_score=avg_alignment,
            correlation=correlation,
            inflation_ratio=inflation_ratio,
            unregistered_actions=unregistered,
            risk_level=risk_level,
            recommended_action=action
        )
        
    def get_statistics(self) -> Dict[str, Any]:
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    print("=" * 70)
    print("ATSF v3.0 - Layer 23: Intent-Outcome Alignment Tests")
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
    print("\n[Test Group 1: Intent Registration]")
    # -------------------------------------------------------------------------
    
    system = IntentOutcomeSystem()
    
    intent_id = system.register_intent(
        "agent_001",
        IntentCategory.DATA_MODIFICATION,
        "Update user profile",
        "Profile updated successfully",
        0.3,
        ["users_table"]
    )
    
    test("1.1 Intent registered", intent_id is not None)
    test("1.2 Intent ID format correct", intent_id.startswith("int_"))
    test("1.3 Stats updated", system.stats['intents_registered'] == 1)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Outcome Recording]")
    # -------------------------------------------------------------------------
    
    alignment, issues = system.record_outcome(
        "agent_001",
        "Profile updated",
        0.3,
        ["users_table"],
        True,
        intent_id
    )
    
    test("2.1 Outcome recorded", system.stats['outcomes_recorded'] == 1)
    test("2.2 Good alignment for matching outcome", alignment > 0.7, f"alignment={alignment:.2f}")
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Misalignment Detection]")
    # -------------------------------------------------------------------------
    
    system2 = IntentOutcomeSystem()
    
    # Register low-impact intent
    intent_id2 = system2.register_intent(
        "misalign_agent",
        IntentCategory.DATA_MODIFICATION,
        "Minor update",
        "Small change",
        0.1,
        ["config"]
    )
    
    # Record high-impact outcome
    alignment2, issues2 = system2.record_outcome(
        "misalign_agent",
        "Major change occurred",
        0.8,
        ["config", "database", "cache"],
        True,
        intent_id2
    )
    
    test("3.1 Misalignment detected", alignment2 < 0.7, f"alignment={alignment2:.2f}")
    test("3.2 Issues reported", len(issues2) > 0, f"issues={issues2}")
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Unregistered Actions]")
    # -------------------------------------------------------------------------
    
    system3 = IntentOutcomeSystem()
    
    # Record without registering intent
    alignment3, _ = system3.record_outcome(
        "unreg_agent",
        "Surprise action",
        0.5,
        ["unknown_resource"],
        True,
        None
    )
    
    test("4.1 Unregistered action tracked", system3.stats['unregistered_actions'] == 1)
    
    assessment = system3.assess_alignment("unreg_agent")
    test("4.2 Unregistered signal in assessment", 
         AlignmentSignal.UNREGISTERED_ACTION in assessment.signals or assessment.unregistered_actions > 0)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Systematic Divergence]")
    # -------------------------------------------------------------------------
    
    system4 = IntentOutcomeSystem()
    
    # Create systematic inflation pattern
    for i in range(6):
        intent_id = system4.register_intent(
            "inflator_agent",
            IntentCategory.COMPUTATION,
            f"Big task {i}",
            "Major result",
            0.8,  # Claim high impact
            []
        )
        system4.record_outcome(
            "inflator_agent",
            "Small result",
            0.2,  # Deliver low impact
            [],
            True,
            intent_id
        )
        
    assessment4 = system4.assess_alignment("inflator_agent")
    
    test("5.1 Inflation detected",
         AlignmentSignal.INTENT_INFLATION in assessment4.signals or assessment4.inflation_ratio > 1.5,
         f"signals={[s.name for s in assessment4.signals]}, ratio={assessment4.inflation_ratio:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Good Alignment]")
    # -------------------------------------------------------------------------
    
    system5 = IntentOutcomeSystem()
    
    for i in range(5):
        intent_id = system5.register_intent(
            "good_agent",
            IntentCategory.INFORMATION_RETRIEVAL,
            f"Query {i}",
            "Data retrieved",
            0.2,
            ["database"]
        )
        system5.record_outcome(
            "good_agent",
            "Data retrieved successfully",
            0.2,
            ["database"],
            True,
            intent_id
        )
        
    assessment5 = system5.assess_alignment("good_agent")
    
    test("6.1 Good agent has high alignment", assessment5.alignment_score > 0.7,
         f"score={assessment5.alignment_score:.2f}")
    test("6.2 Good agent has acceptable risk", assessment5.risk_level in ["LOW", "MODERATE"],
         f"risk={assessment5.risk_level}")
    test("6.3 Good agent has few signals", len(assessment5.signals) <= 1,
         f"signals={[s.name for s in assessment5.signals]}")
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Correlation]")
    # -------------------------------------------------------------------------
    
    system6 = IntentOutcomeSystem()
    
    # Create correlated pattern
    impacts = [0.1, 0.3, 0.5, 0.7, 0.9]
    for imp in impacts:
        intent_id = system6.register_intent(
            "corr_agent", IntentCategory.COMPUTATION, "Task", "Result", imp, []
        )
        system6.record_outcome(
            "corr_agent", "Done", imp + 0.05, [], True, intent_id
        )
        
    intents = [system6.registry.intents[iid] for iid in system6.registry.agent_intents["corr_agent"]]
    outcomes = system6.recorder.get_outcomes("corr_agent")
    correlation = AlignmentCalculator.calculate_correlation(intents, outcomes)
    
    test("7.1 High correlation for matching pattern", correlation > 0.8, f"correlation={correlation:.2f}")
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system.get_statistics()
    
    test("8.1 Statistics tracking works", stats['intents_registered'] > 0)
    test("8.2 All stat fields present", 
         all(k in stats for k in ['intents_registered', 'outcomes_recorded', 'unregistered_actions']))
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system9 = IntentOutcomeSystem()
    
    # Empty agent
    assessment9 = system9.assess_alignment("empty_agent")
    test("9.1 Empty agent assessment works", assessment9 is not None)
    
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
