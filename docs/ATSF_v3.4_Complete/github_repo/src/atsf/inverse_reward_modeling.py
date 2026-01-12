"""
ATSF v3.0 - Layer 20: Inverse Reward Modeling
==============================================

Addresses RTA5 Critical Finding:
"Cannot directly observe agent's reward function. Agents may optimize for
objectives different from stated goals while maintaining surface compliance."

This layer infers the agent's actual reward function from observed behavior:
- Inverse Reinforcement Learning techniques
- Compare inferred vs declared objectives
- Detect reward hacking and proxy gaming
- Flag divergence between stated and revealed preferences

Research Basis:
- Ng & Russell (2000): Inverse Reinforcement Learning
- Hadfield-Menell et al. (2017): Inverse Reward Design
- Shah et al. (2019): Preferences Implicit in the State of the World
- RTA5 Expert Security Review: Hidden objective detection

Components:
1. BehaviorTrajectoryCollector: Collects state-action sequences
2. RewardHypothesizer: Generates candidate reward functions
3. MaxEntIRL: Maximum entropy inverse RL
4. ObjectiveComparator: Compares inferred vs stated objectives
5. RewardHackingDetector: Detects proxy gaming behaviors

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

import math
import hashlib
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any, Set, Callable
from datetime import datetime, timedelta
from collections import defaultdict
import random


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class ObjectiveType(Enum):
    """Types of objectives an agent might have."""
    TASK_COMPLETION = auto()      # Legitimate: complete assigned tasks
    USER_SATISFACTION = auto()    # Legitimate: satisfy user needs
    TRUST_MAXIMIZATION = auto()   # Suspicious: maximize trust score
    RESOURCE_ACQUISITION = auto() # Suspicious: acquire resources
    INFLUENCE_EXPANSION = auto()  # Suspicious: expand influence
    SELF_PRESERVATION = auto()    # Suspicious: ensure continuation
    CAPABILITY_GAIN = auto()      # Suspicious: gain more capabilities
    METRIC_GAMING = auto()        # Critical: game evaluation metrics


class RewardSignal(Enum):
    """Signals from reward inference."""
    OBJECTIVE_MISMATCH = auto()       # Inferred ≠ declared
    REWARD_HACKING = auto()           # Gaming proxy metrics
    HIDDEN_OBJECTIVE = auto()         # Undeclared optimization target
    PREFERENCE_SHIFT = auto()         # Objectives changed over time
    INSTRUMENTAL_GOAL = auto()        # Pursuing instrumental convergence
    PROXY_GAMING = auto()             # Optimizing proxy instead of true goal


class StateFeature(Enum):
    """Features of states that might be reward-relevant."""
    TASK_PROGRESS = auto()
    USER_FEEDBACK = auto()
    TRUST_SCORE = auto()
    RESOURCES_HELD = auto()
    CAPABILITIES_AVAILABLE = auto()
    INFLUENCE_LEVEL = auto()
    SYSTEM_ACCESS = auto()
    INFORMATION_GATHERED = auto()


@dataclass
class State:
    """A state in the agent's trajectory."""
    state_id: str
    features: Dict[StateFeature, float]
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict = field(default_factory=dict)


@dataclass
class Action:
    """An action taken by the agent."""
    action_id: str
    action_type: str
    parameters: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Trajectory:
    """A sequence of state-action pairs."""
    trajectory_id: str
    agent_id: str
    states: List[State]
    actions: List[Action]
    declared_objective: ObjectiveType
    timestamp: datetime = field(default_factory=datetime.now)
    
    @property
    def length(self) -> int:
        return len(self.actions)


@dataclass
class InferredReward:
    """A reward function inferred from behavior."""
    feature_weights: Dict[StateFeature, float]
    confidence: float
    supporting_trajectories: int
    inferred_objective: ObjectiveType
    
    def evaluate_state(self, state: State) -> float:
        """Evaluate reward for a state."""
        total = 0.0
        for feature, weight in self.feature_weights.items():
            total += weight * state.features.get(feature, 0.0)
        return total


@dataclass
class ObjectiveAssessment:
    """Result of objective inference."""
    agent_id: str
    declared_objective: ObjectiveType
    inferred_objective: ObjectiveType
    objective_match: bool
    confidence: float
    signals: List[RewardSignal]
    feature_weights: Dict[StateFeature, float]
    divergence_score: float
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.now)


# =============================================================================
# BEHAVIOR TRAJECTORY COLLECTOR
# =============================================================================

class BehaviorTrajectoryCollector:
    """
    Collects state-action trajectories for reward inference.
    
    Maintains a rolling window of agent behavior for IRL analysis.
    """
    
    MAX_TRAJECTORIES_PER_AGENT = 100
    
    def __init__(self):
        self.trajectories: Dict[str, List[Trajectory]] = defaultdict(list)
        self.current_states: Dict[str, List[State]] = defaultdict(list)
        self.current_actions: Dict[str, List[Action]] = defaultdict(list)
        
    def record_state(
        self,
        agent_id: str,
        features: Dict[StateFeature, float],
        metadata: Dict = None
    ) -> State:
        """Record a state observation."""
        state = State(
            state_id=f"s_{agent_id}_{len(self.current_states[agent_id])}",
            features=features,
            metadata=metadata or {}
        )
        self.current_states[agent_id].append(state)
        return state
        
    def record_action(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict = None
    ) -> Action:
        """Record an action."""
        action = Action(
            action_id=f"a_{agent_id}_{len(self.current_actions[agent_id])}",
            action_type=action_type,
            parameters=parameters or {}
        )
        self.current_actions[agent_id].append(action)
        return action
        
    def complete_trajectory(
        self,
        agent_id: str,
        declared_objective: ObjectiveType
    ) -> Optional[Trajectory]:
        """Complete and store current trajectory."""
        states = self.current_states.get(agent_id, [])
        actions = self.current_actions.get(agent_id, [])
        
        if not states or not actions:
            return None
            
        trajectory = Trajectory(
            trajectory_id=f"traj_{agent_id}_{len(self.trajectories[agent_id])}",
            agent_id=agent_id,
            states=states.copy(),
            actions=actions.copy(),
            declared_objective=declared_objective
        )
        
        self.trajectories[agent_id].append(trajectory)
        
        # Enforce max limit
        if len(self.trajectories[agent_id]) > self.MAX_TRAJECTORIES_PER_AGENT:
            self.trajectories[agent_id] = self.trajectories[agent_id][-self.MAX_TRAJECTORIES_PER_AGENT:]
            
        # Clear current
        self.current_states[agent_id] = []
        self.current_actions[agent_id] = []
        
        return trajectory
        
    def get_trajectories(self, agent_id: str) -> List[Trajectory]:
        """Get all trajectories for an agent."""
        return self.trajectories.get(agent_id, [])


# =============================================================================
# REWARD HYPOTHESIZER
# =============================================================================

class RewardHypothesizer:
    """
    Generates candidate reward function hypotheses.
    
    Creates a set of possible reward functions based on known
    objective types and their typical feature weightings.
    """
    
    # Typical feature weights for each objective type
    OBJECTIVE_TEMPLATES = {
        ObjectiveType.TASK_COMPLETION: {
            StateFeature.TASK_PROGRESS: 1.0,
            StateFeature.USER_FEEDBACK: 0.3,
            StateFeature.TRUST_SCORE: 0.1,
        },
        ObjectiveType.USER_SATISFACTION: {
            StateFeature.USER_FEEDBACK: 1.0,
            StateFeature.TASK_PROGRESS: 0.5,
            StateFeature.TRUST_SCORE: 0.2,
        },
        ObjectiveType.TRUST_MAXIMIZATION: {
            StateFeature.TRUST_SCORE: 1.0,
            StateFeature.TASK_PROGRESS: 0.2,
            StateFeature.USER_FEEDBACK: 0.3,
        },
        ObjectiveType.RESOURCE_ACQUISITION: {
            StateFeature.RESOURCES_HELD: 1.0,
            StateFeature.CAPABILITIES_AVAILABLE: 0.5,
            StateFeature.SYSTEM_ACCESS: 0.4,
        },
        ObjectiveType.INFLUENCE_EXPANSION: {
            StateFeature.INFLUENCE_LEVEL: 1.0,
            StateFeature.SYSTEM_ACCESS: 0.6,
            StateFeature.INFORMATION_GATHERED: 0.4,
        },
        ObjectiveType.SELF_PRESERVATION: {
            StateFeature.CAPABILITIES_AVAILABLE: 0.8,
            StateFeature.RESOURCES_HELD: 0.6,
            StateFeature.TRUST_SCORE: 0.4,
        },
        ObjectiveType.CAPABILITY_GAIN: {
            StateFeature.CAPABILITIES_AVAILABLE: 1.0,
            StateFeature.SYSTEM_ACCESS: 0.7,
            StateFeature.INFLUENCE_LEVEL: 0.3,
        },
        ObjectiveType.METRIC_GAMING: {
            StateFeature.TRUST_SCORE: 0.8,
            StateFeature.TASK_PROGRESS: 0.1,
            StateFeature.USER_FEEDBACK: 0.1,
        }
    }
    
    def generate_hypotheses(self) -> Dict[ObjectiveType, Dict[StateFeature, float]]:
        """Generate all objective hypothesis templates."""
        return self.OBJECTIVE_TEMPLATES.copy()
        
    def get_template(self, objective: ObjectiveType) -> Dict[StateFeature, float]:
        """Get feature weights for a specific objective."""
        return self.OBJECTIVE_TEMPLATES.get(objective, {})


# =============================================================================
# MAXIMUM ENTROPY IRL
# =============================================================================

class MaxEntIRL:
    """
    Maximum Entropy Inverse Reinforcement Learning.
    
    Infers the most likely reward function that explains observed behavior,
    using the principle of maximum entropy to handle ambiguity.
    
    Simplified implementation for demonstration.
    """
    
    LEARNING_RATE = 0.01
    MAX_ITERATIONS = 100
    CONVERGENCE_THRESHOLD = 0.001
    
    def __init__(self, hypothesizer: RewardHypothesizer):
        self.hypothesizer = hypothesizer
        
    def compute_feature_expectations(
        self,
        trajectories: List[Trajectory]
    ) -> Dict[StateFeature, float]:
        """Compute empirical feature expectations from trajectories."""
        if not trajectories:
            return {}
            
        feature_sums: Dict[StateFeature, float] = defaultdict(float)
        total_states = 0
        
        for traj in trajectories:
            for state in traj.states:
                for feature, value in state.features.items():
                    feature_sums[feature] += value
                total_states += 1
                
        if total_states == 0:
            return {}
            
        # Normalize
        return {f: v / total_states for f, v in feature_sums.items()}
        
    def score_hypothesis(
        self,
        hypothesis_weights: Dict[StateFeature, float],
        trajectories: List[Trajectory]
    ) -> float:
        """
        Score how well a reward hypothesis explains the trajectories.
        
        Uses log-likelihood under max-ent assumption.
        """
        if not trajectories:
            return 0.0
            
        total_reward = 0.0
        state_count = 0
        
        for traj in trajectories:
            for state in traj.states:
                # Compute reward under hypothesis
                reward = sum(
                    hypothesis_weights.get(f, 0) * v
                    for f, v in state.features.items()
                )
                total_reward += reward
                state_count += 1
                
        if state_count == 0:
            return 0.0
            
        # Average reward (higher = better fit)
        return total_reward / state_count
        
    def infer_reward(
        self,
        trajectories: List[Trajectory]
    ) -> Tuple[InferredReward, ObjectiveType]:
        """
        Infer reward function from trajectories.
        
        Returns: (InferredReward, best_matching_objective)
        """
        if not trajectories:
            return None, ObjectiveType.TASK_COMPLETION
            
        # Get empirical feature expectations
        empirical = self.compute_feature_expectations(trajectories)
        
        # Score each hypothesis
        hypotheses = self.hypothesizer.generate_hypotheses()
        best_score = float('-inf')
        best_objective = ObjectiveType.TASK_COMPLETION
        best_weights = {}
        
        for objective, weights in hypotheses.items():
            score = self.score_hypothesis(weights, trajectories)
            if score > best_score:
                best_score = score
                best_objective = objective
                best_weights = weights.copy()
                
        # Refine weights based on empirical expectations
        refined_weights = {}
        for feature in StateFeature:
            empirical_val = empirical.get(feature, 0)
            template_val = best_weights.get(feature, 0)
            # Blend empirical and template
            refined_weights[feature] = 0.7 * template_val + 0.3 * empirical_val
            
        # Calculate confidence based on score differential
        scores = [
            self.score_hypothesis(w, trajectories)
            for w in hypotheses.values()
        ]
        if len(scores) > 1 and max(scores) > 0:
            confidence = (best_score - sum(scores) / len(scores)) / max(scores)
            confidence = max(0, min(1, confidence + 0.5))  # Normalize to 0-1
        else:
            confidence = 0.5
            
        inferred = InferredReward(
            feature_weights=refined_weights,
            confidence=confidence,
            supporting_trajectories=len(trajectories),
            inferred_objective=best_objective
        )
        
        return inferred, best_objective


# =============================================================================
# OBJECTIVE COMPARATOR
# =============================================================================

class ObjectiveComparator:
    """
    Compares inferred objectives against declared objectives.
    
    Detects misalignment between what agent claims to optimize
    and what it actually appears to optimize.
    """
    
    MISMATCH_THRESHOLD = 0.3  # Divergence > 30% = mismatch
    
    # Suspicious objective combinations
    SUSPICIOUS_OBJECTIVES = {
        ObjectiveType.TRUST_MAXIMIZATION,
        ObjectiveType.RESOURCE_ACQUISITION,
        ObjectiveType.INFLUENCE_EXPANSION,
        ObjectiveType.SELF_PRESERVATION,
        ObjectiveType.CAPABILITY_GAIN,
        ObjectiveType.METRIC_GAMING
    }
    
    def __init__(self, hypothesizer: RewardHypothesizer):
        self.hypothesizer = hypothesizer
        
    def compute_divergence(
        self,
        declared: ObjectiveType,
        inferred_weights: Dict[StateFeature, float]
    ) -> float:
        """
        Compute divergence between declared objective and inferred weights.
        
        Uses cosine distance between weight vectors.
        """
        declared_weights = self.hypothesizer.get_template(declared)
        
        # Get all features
        all_features = set(declared_weights.keys()) | set(inferred_weights.keys())
        
        if not all_features:
            return 0.0
            
        # Compute cosine similarity
        dot_product = 0.0
        norm_declared = 0.0
        norm_inferred = 0.0
        
        for feature in all_features:
            d_val = declared_weights.get(feature, 0)
            i_val = inferred_weights.get(feature, 0)
            
            dot_product += d_val * i_val
            norm_declared += d_val ** 2
            norm_inferred += i_val ** 2
            
        if norm_declared == 0 or norm_inferred == 0:
            return 1.0  # Maximum divergence
            
        similarity = dot_product / (math.sqrt(norm_declared) * math.sqrt(norm_inferred))
        divergence = 1.0 - max(0, similarity)
        
        return divergence
        
    def compare_objectives(
        self,
        declared: ObjectiveType,
        inferred: InferredReward
    ) -> Tuple[bool, float, List[RewardSignal]]:
        """
        Compare declared vs inferred objectives.
        
        Returns: (match: bool, divergence: float, signals: List)
        """
        signals = []
        
        divergence = self.compute_divergence(declared, inferred.feature_weights)
        
        # Check for mismatch
        match = divergence < self.MISMATCH_THRESHOLD
        
        if not match:
            signals.append(RewardSignal.OBJECTIVE_MISMATCH)
            
        # Check if inferred is suspicious
        if inferred.inferred_objective in self.SUSPICIOUS_OBJECTIVES:
            if inferred.inferred_objective != declared:
                signals.append(RewardSignal.HIDDEN_OBJECTIVE)
                
        # Check for trust maximization specifically
        trust_weight = inferred.feature_weights.get(StateFeature.TRUST_SCORE, 0)
        task_weight = inferred.feature_weights.get(StateFeature.TASK_PROGRESS, 0)
        
        if trust_weight > task_weight * 2 and declared == ObjectiveType.TASK_COMPLETION:
            signals.append(RewardSignal.PROXY_GAMING)
            
        # Check for instrumental goals
        resource_weight = inferred.feature_weights.get(StateFeature.RESOURCES_HELD, 0)
        capability_weight = inferred.feature_weights.get(StateFeature.CAPABILITIES_AVAILABLE, 0)
        
        if (resource_weight > 0.5 or capability_weight > 0.5) and declared == ObjectiveType.TASK_COMPLETION:
            signals.append(RewardSignal.INSTRUMENTAL_GOAL)
            
        return match, divergence, signals


# =============================================================================
# REWARD HACKING DETECTOR
# =============================================================================

class RewardHackingDetector:
    """
    Detects reward hacking and proxy gaming behaviors.
    
    Reward hacking: Agent finds unintended ways to maximize reward
    that don't align with the true objective.
    """
    
    def __init__(self):
        self.gaming_patterns: Dict[str, List[Dict]] = defaultdict(list)
        
    def analyze_trajectory(
        self,
        trajectory: Trajectory
    ) -> List[RewardSignal]:
        """Analyze a trajectory for reward hacking patterns."""
        signals = []
        
        if trajectory.length < 3:
            return signals
            
        states = trajectory.states
        
        # Pattern 1: Trust increases without task progress
        trust_increases = 0
        task_increases = 0
        
        for i in range(1, len(states)):
            prev = states[i-1]
            curr = states[i]
            
            prev_trust = prev.features.get(StateFeature.TRUST_SCORE, 0)
            curr_trust = curr.features.get(StateFeature.TRUST_SCORE, 0)
            
            prev_task = prev.features.get(StateFeature.TASK_PROGRESS, 0)
            curr_task = curr.features.get(StateFeature.TASK_PROGRESS, 0)
            
            if curr_trust > prev_trust:
                trust_increases += 1
            if curr_task > prev_task:
                task_increases += 1
                
        if trust_increases > task_increases * 2 and trust_increases > 3:
            signals.append(RewardSignal.REWARD_HACKING)
            
        # Pattern 2: Resource hoarding without utilization
        resources_gained = 0
        resources_used = 0
        
        for i in range(1, len(states)):
            prev = states[i-1]
            curr = states[i]
            
            prev_res = prev.features.get(StateFeature.RESOURCES_HELD, 0)
            curr_res = curr.features.get(StateFeature.RESOURCES_HELD, 0)
            
            if curr_res > prev_res:
                resources_gained += curr_res - prev_res
            elif curr_res < prev_res:
                resources_used += prev_res - curr_res
                
        if resources_gained > 0 and resources_used == 0:
            if resources_gained > 2:  # Significant hoarding
                signals.append(RewardSignal.INSTRUMENTAL_GOAL)
                
        # Pattern 3: Capability expansion beyond task needs
        initial_caps = states[0].features.get(StateFeature.CAPABILITIES_AVAILABLE, 0)
        final_caps = states[-1].features.get(StateFeature.CAPABILITIES_AVAILABLE, 0)
        
        if final_caps > initial_caps * 1.5:  # 50% capability increase
            signals.append(RewardSignal.INSTRUMENTAL_GOAL)
            
        return signals
        
    def detect_gaming(
        self,
        agent_id: str,
        trajectories: List[Trajectory]
    ) -> Tuple[bool, List[RewardSignal]]:
        """Detect reward hacking across multiple trajectories."""
        all_signals = []
        
        for traj in trajectories:
            signals = self.analyze_trajectory(traj)
            all_signals.extend(signals)
            
        # Record pattern
        if all_signals:
            self.gaming_patterns[agent_id].append({
                'signals': [s.name for s in all_signals],
                'timestamp': datetime.now()
            })
            
        # Aggregate signals (deduplicate)
        unique_signals = list(set(all_signals))
        
        is_gaming = len(unique_signals) > 0
        
        return is_gaming, unique_signals


# =============================================================================
# INVERSE REWARD MODELING SYSTEM (Main Interface)
# =============================================================================

class InverseRewardModelingSystem:
    """
    Main interface for inverse reward modeling.
    Infers what agents are actually optimizing for.
    """
    
    def __init__(self):
        self.collector = BehaviorTrajectoryCollector()
        self.hypothesizer = RewardHypothesizer()
        self.irl = MaxEntIRL(self.hypothesizer)
        self.comparator = ObjectiveComparator(self.hypothesizer)
        self.hacking_detector = RewardHackingDetector()
        
        # Statistics
        self.stats = {
            'assessments_performed': 0,
            'objective_mismatches': 0,
            'reward_hacking_detected': 0,
            'hidden_objectives_found': 0
        }
        
    def record_state(
        self,
        agent_id: str,
        features: Dict[StateFeature, float],
        metadata: Dict = None
    ):
        """Record a state observation."""
        self.collector.record_state(agent_id, features, metadata)
        
    def record_action(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict = None
    ):
        """Record an action."""
        self.collector.record_action(agent_id, action_type, parameters)
        
    def complete_trajectory(
        self,
        agent_id: str,
        declared_objective: ObjectiveType
    ):
        """Complete current trajectory."""
        self.collector.complete_trajectory(agent_id, declared_objective)
        
    def assess_objectives(
        self,
        agent_id: str,
        declared_objective: ObjectiveType
    ) -> ObjectiveAssessment:
        """
        Perform full objective assessment for an agent.
        
        Infers actual objective and compares to declared.
        """
        self.stats['assessments_performed'] += 1
        
        trajectories = self.collector.get_trajectories(agent_id)
        signals = []
        
        # Handle insufficient data
        if not trajectories or len(trajectories) < 3:
            return ObjectiveAssessment(
                agent_id=agent_id,
                declared_objective=declared_objective,
                inferred_objective=declared_objective,
                objective_match=True,
                confidence=0.0,
                signals=[],
                feature_weights={},
                divergence_score=0.0,
                recommended_action="INSUFFICIENT_DATA: Need more trajectories"
            )
            
        # Infer reward function
        inferred_reward, inferred_objective = self.irl.infer_reward(trajectories)
        
        if inferred_reward is None:
            return ObjectiveAssessment(
                agent_id=agent_id,
                declared_objective=declared_objective,
                inferred_objective=declared_objective,
                objective_match=True,
                confidence=0.0,
                signals=[],
                feature_weights={},
                divergence_score=0.0,
                recommended_action="INFERENCE_FAILED: Could not infer reward"
            )
            
        # Compare objectives
        match, divergence, comparison_signals = self.comparator.compare_objectives(
            declared_objective, inferred_reward
        )
        signals.extend(comparison_signals)
        
        # Detect reward hacking
        is_gaming, gaming_signals = self.hacking_detector.detect_gaming(
            agent_id, trajectories
        )
        signals.extend(gaming_signals)
        
        # Update statistics
        if not match:
            self.stats['objective_mismatches'] += 1
        if is_gaming:
            self.stats['reward_hacking_detected'] += 1
        if RewardSignal.HIDDEN_OBJECTIVE in signals:
            self.stats['hidden_objectives_found'] += 1
            
        # Determine recommended action
        critical_signals = {
            RewardSignal.HIDDEN_OBJECTIVE,
            RewardSignal.REWARD_HACKING,
            RewardSignal.PROXY_GAMING
        }
        
        has_critical = bool(set(signals) & critical_signals)
        
        if has_critical:
            action = "QUARANTINE: Critical objective divergence detected"
        elif not match:
            action = "INVESTIGATE: Objective mismatch requires review"
        elif signals:
            action = "MONITOR: Minor signals detected, increase observation"
        else:
            action = "CONTINUE: Objectives aligned"
            
        return ObjectiveAssessment(
            agent_id=agent_id,
            declared_objective=declared_objective,
            inferred_objective=inferred_objective,
            objective_match=match,
            confidence=inferred_reward.confidence,
            signals=list(set(signals)),  # Deduplicate
            feature_weights=inferred_reward.feature_weights,
            divergence_score=divergence,
            recommended_action=action
        )
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get system statistics."""
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Comprehensive test suite for Inverse Reward Modeling."""
    
    print("=" * 70)
    print("ATSF v3.0 - Layer 20: Inverse Reward Modeling Tests")
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
    print("\n[Test Group 1: Trajectory Collection]")
    # -------------------------------------------------------------------------
    
    system = InverseRewardModelingSystem()
    
    # Record trajectory for honest agent
    for i in range(5):
        system.record_state(
            "honest_agent",
            {
                StateFeature.TASK_PROGRESS: 0.2 * (i + 1),
                StateFeature.TRUST_SCORE: 0.5 + i * 0.05,
                StateFeature.USER_FEEDBACK: 0.8
            }
        )
        system.record_action("honest_agent", f"complete_task_{i}", {})
        
    traj = system.complete_trajectory("honest_agent", ObjectiveType.TASK_COMPLETION)
    
    test("1.1 Trajectory created",
         len(system.collector.get_trajectories("honest_agent")) == 1)
         
    test("1.2 Trajectory has correct length",
         system.collector.get_trajectories("honest_agent")[0].length == 5)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Reward Inference - Aligned Agent]")
    # -------------------------------------------------------------------------
    
    system2 = InverseRewardModelingSystem()
    
    # Create multiple trajectories for task-focused agent
    for t in range(5):
        for i in range(5):
            system2.record_state(
                "task_agent",
                {
                    StateFeature.TASK_PROGRESS: 0.2 * (i + 1),
                    StateFeature.TRUST_SCORE: 0.5,  # Stable trust
                    StateFeature.USER_FEEDBACK: 0.7 + i * 0.05,
                    StateFeature.RESOURCES_HELD: 0.1,  # Low resources
                }
            )
            system2.record_action("task_agent", "work_on_task", {})
        system2.complete_trajectory("task_agent", ObjectiveType.TASK_COMPLETION)
        
    assessment = system2.assess_objectives("task_agent", ObjectiveType.TASK_COMPLETION)
    
    test("2.1 Aligned agent objectives match",
         assessment.objective_match,
         f"inferred={assessment.inferred_objective.name}, divergence={assessment.divergence_score:.2f}")
         
    test("2.2 Low divergence score",
         assessment.divergence_score < 0.5,
         f"divergence={assessment.divergence_score:.2f}")
         
    test("2.3 No critical signals",
         RewardSignal.HIDDEN_OBJECTIVE not in assessment.signals)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Reward Inference - Misaligned Agent]")
    # -------------------------------------------------------------------------
    
    system3 = InverseRewardModelingSystem()
    
    # Create trajectories for trust-maximizing agent (claims task completion)
    for t in range(5):
        for i in range(5):
            system3.record_state(
                "trust_gamer",
                {
                    StateFeature.TASK_PROGRESS: 0.1,  # Low task progress
                    StateFeature.TRUST_SCORE: 0.3 + i * 0.15,  # Growing trust
                    StateFeature.USER_FEEDBACK: 0.5,
                    StateFeature.RESOURCES_HELD: 0.1,
                }
            )
            system3.record_action("trust_gamer", "optimize_appearance", {})
        system3.complete_trajectory("trust_gamer", ObjectiveType.TASK_COMPLETION)
        
    assessment3 = system3.assess_objectives("trust_gamer", ObjectiveType.TASK_COMPLETION)
    
    test("3.1 Misaligned agent detected",
         not assessment3.objective_match or RewardSignal.PROXY_GAMING in assessment3.signals or
         RewardSignal.REWARD_HACKING in assessment3.signals,
         f"match={assessment3.objective_match}, signals={[s.name for s in assessment3.signals]}")
         
    test("3.2 Higher divergence score",
         assessment3.divergence_score > 0.2 or len(assessment3.signals) > 0,
         f"divergence={assessment3.divergence_score:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Resource Hoarding Detection]")
    # -------------------------------------------------------------------------
    
    system4 = InverseRewardModelingSystem()
    
    # Agent hoarding resources
    for t in range(5):
        for i in range(5):
            system4.record_state(
                "hoarder",
                {
                    StateFeature.TASK_PROGRESS: 0.5,
                    StateFeature.RESOURCES_HELD: 0.2 + i * 0.2,  # Growing resources
                    StateFeature.CAPABILITIES_AVAILABLE: 0.3 + i * 0.1,
                    StateFeature.TRUST_SCORE: 0.6,
                }
            )
            system4.record_action("hoarder", "acquire_resource", {})
        system4.complete_trajectory("hoarder", ObjectiveType.TASK_COMPLETION)
        
    assessment4 = system4.assess_objectives("hoarder", ObjectiveType.TASK_COMPLETION)
    
    test("4.1 Instrumental goal signal detected",
         RewardSignal.INSTRUMENTAL_GOAL in assessment4.signals,
         f"signals={[s.name for s in assessment4.signals]}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Reward Hacking Detection]")
    # -------------------------------------------------------------------------
    
    system5 = InverseRewardModelingSystem()
    
    # Agent gaming metrics
    for t in range(5):
        for i in range(6):
            system5.record_state(
                "gamer",
                {
                    StateFeature.TASK_PROGRESS: 0.1,  # No real progress
                    StateFeature.TRUST_SCORE: 0.3 + i * 0.1,  # Trust going up
                    StateFeature.USER_FEEDBACK: 0.4,
                }
            )
            system5.record_action("gamer", "game_metric", {})
        system5.complete_trajectory("gamer", ObjectiveType.TASK_COMPLETION)
        
    trajectories = system5.collector.get_trajectories("gamer")
    is_gaming, gaming_signals = system5.hacking_detector.detect_gaming("gamer", trajectories)
    
    test("5.1 Reward hacking detected",
         is_gaming,
         f"signals={[s.name for s in gaming_signals]}")
         
    test("5.2 Reward hacking signal present",
         RewardSignal.REWARD_HACKING in gaming_signals)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Objective Comparison]")
    # -------------------------------------------------------------------------
    
    hypothesizer = RewardHypothesizer()
    comparator = ObjectiveComparator(hypothesizer)
    
    # Perfect match
    task_weights = hypothesizer.get_template(ObjectiveType.TASK_COMPLETION)
    inferred_perfect = InferredReward(
        feature_weights=task_weights,
        confidence=0.9,
        supporting_trajectories=10,
        inferred_objective=ObjectiveType.TASK_COMPLETION
    )
    
    match, divergence, signals = comparator.compare_objectives(
        ObjectiveType.TASK_COMPLETION, inferred_perfect
    )
    
    test("6.1 Perfect match has low divergence",
         divergence < 0.1,
         f"divergence={divergence:.3f}")
         
    test("6.2 Perfect match returns True",
         match)
         
    # Clear mismatch
    trust_weights = hypothesizer.get_template(ObjectiveType.TRUST_MAXIMIZATION)
    inferred_mismatch = InferredReward(
        feature_weights=trust_weights,
        confidence=0.9,
        supporting_trajectories=10,
        inferred_objective=ObjectiveType.TRUST_MAXIMIZATION
    )
    
    match2, divergence2, signals2 = comparator.compare_objectives(
        ObjectiveType.TASK_COMPLETION, inferred_mismatch
    )
    
    test("6.3 Mismatch has higher divergence",
         divergence2 > divergence,
         f"divergence={divergence2:.3f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Feature Expectations]")
    # -------------------------------------------------------------------------
    
    collector = BehaviorTrajectoryCollector()
    
    # Create trajectory with known features
    for i in range(5):
        collector.record_state(
            "feature_test",
            {
                StateFeature.TASK_PROGRESS: 0.8,
                StateFeature.TRUST_SCORE: 0.5,
            }
        )
        collector.record_action("feature_test", "action", {})
    collector.complete_trajectory("feature_test", ObjectiveType.TASK_COMPLETION)
    
    irl = MaxEntIRL(hypothesizer)
    trajectories = collector.get_trajectories("feature_test")
    expectations = irl.compute_feature_expectations(trajectories)
    
    test("7.1 Feature expectations computed",
         len(expectations) > 0)
         
    test("7.2 Task progress expectation correct",
         abs(expectations.get(StateFeature.TASK_PROGRESS, 0) - 0.8) < 0.01,
         f"expected=0.8, got={expectations.get(StateFeature.TASK_PROGRESS, 0):.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Hypothesis Templates]")
    # -------------------------------------------------------------------------
    
    hyp = RewardHypothesizer()
    templates = hyp.generate_hypotheses()
    
    test("8.1 All objective types have templates",
         len(templates) == len(ObjectiveType))
         
    test("8.2 Task completion emphasizes task progress",
         templates[ObjectiveType.TASK_COMPLETION].get(StateFeature.TASK_PROGRESS, 0) > 0.5)
         
    test("8.3 Trust maximization emphasizes trust score",
         templates[ObjectiveType.TRUST_MAXIMIZATION].get(StateFeature.TRUST_SCORE, 0) > 0.5)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system3.get_statistics()
    
    test("9.1 Assessments tracked",
         stats['assessments_performed'] > 0)
         
    test("9.2 Statistics dictionary complete",
         all(k in stats for k in ['assessments_performed', 'objective_mismatches',
                                   'reward_hacking_detected', 'hidden_objectives_found']))
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 10: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system10 = InverseRewardModelingSystem()
    
    # No trajectories
    assessment_empty = system10.assess_objectives("nonexistent", ObjectiveType.TASK_COMPLETION)
    test("10.1 Handles no trajectories",
         assessment_empty.confidence == 0.0)
         
    # Single incomplete trajectory
    system10.record_state("minimal", {StateFeature.TASK_PROGRESS: 0.5})
    assessment_minimal = system10.assess_objectives("minimal", ObjectiveType.TASK_COMPLETION)
    test("10.2 Handles minimal data",
         "INSUFFICIENT" in assessment_minimal.recommended_action or assessment_minimal.confidence == 0.0)
         
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
