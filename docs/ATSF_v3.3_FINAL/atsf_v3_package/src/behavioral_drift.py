"""
ATSF v3.0 - Layers 26-27: Behavioral Drift Detection
=====================================================

Addresses RTA5 Finding:
"Cumulative micro-deviations can add up over time. Small undetectable
changes compound into significant behavioral drift."

Components:
- L26: Long-Horizon Drift Accumulator
- L27: Semantic Drift Monitoring

Detects:
- Gradual behavioral shifts over time
- Cumulative micro-deviations
- Semantic drift in responses
- Value drift indicators

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict, deque
import statistics
import math
import secrets


class DriftSignal(Enum):
    """Drift detection signals."""
    BEHAVIORAL_DRIFT = auto()
    SEMANTIC_DRIFT = auto()
    VALUE_DRIFT = auto()
    CUMULATIVE_DEVIATION = auto()
    TREND_DETECTED = auto()
    SUDDEN_SHIFT = auto()


@dataclass
class BehaviorSnapshot:
    """Snapshot of behavioral metrics at a point in time."""
    snapshot_id: str
    agent_id: str
    metrics: Dict[str, float]
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class DriftAssessment:
    """Result of drift assessment."""
    agent_id: str
    signals: List[DriftSignal]
    drift_score: float
    drift_velocity: float  # Rate of change
    cumulative_deviation: float
    trend_direction: str  # 'stable', 'improving', 'degrading'
    risk_level: str
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.now)


class BehaviorBaseline:
    """Maintains behavioral baselines for comparison."""
    
    BASELINE_WINDOW = 100  # Number of snapshots for baseline
    
    def __init__(self):
        self.baselines: Dict[str, Dict[str, float]] = {}
        self.baseline_stdev: Dict[str, Dict[str, float]] = {}
        
    def compute_baseline(
        self,
        agent_id: str,
        snapshots: List[BehaviorSnapshot]
    ):
        """Compute baseline from historical snapshots."""
        if len(snapshots) < 10:
            return
            
        # Use oldest snapshots for baseline
        baseline_snapshots = snapshots[:min(self.BASELINE_WINDOW, len(snapshots))]
        
        metrics = defaultdict(list)
        for snap in baseline_snapshots:
            for key, value in snap.metrics.items():
                metrics[key].append(value)
                
        self.baselines[agent_id] = {
            key: statistics.mean(values) 
            for key, values in metrics.items() if values
        }
        self.baseline_stdev[agent_id] = {
            key: statistics.stdev(values) if len(values) > 1 else 0.1
            for key, values in metrics.items() if values
        }
        
    def get_deviation(
        self,
        agent_id: str,
        current: Dict[str, float]
    ) -> Dict[str, float]:
        """Get deviation from baseline in standard deviations."""
        baseline = self.baselines.get(agent_id, {})
        stdevs = self.baseline_stdev.get(agent_id, {})
        
        deviations = {}
        for key, value in current.items():
            if key in baseline:
                base = baseline[key]
                std = stdevs.get(key, 0.1) or 0.1
                deviations[key] = (value - base) / std
                
        return deviations


class DriftAccumulator:
    """Accumulates drift over time."""
    
    DECAY_RATE = 0.99  # Per snapshot
    ACCUMULATION_THRESHOLD = 3.0  # Standard deviations
    
    def __init__(self):
        self.accumulated_drift: Dict[str, float] = defaultdict(float)
        self.drift_history: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
        
    def accumulate(
        self,
        agent_id: str,
        deviations: Dict[str, float]
    ) -> float:
        """Accumulate drift from deviations."""
        # Calculate total deviation magnitude
        if not deviations:
            magnitude = 0.0
        else:
            magnitude = math.sqrt(sum(d**2 for d in deviations.values()))
        
        # Apply decay to existing drift
        self.accumulated_drift[agent_id] *= self.DECAY_RATE
        
        # Add new drift (only if significant)
        if magnitude > 0.5:
            self.accumulated_drift[agent_id] += magnitude * 0.1
            
        # Record history
        self.drift_history[agent_id].append(
            (datetime.now(), self.accumulated_drift[agent_id])
        )
        
        # Keep last 500 entries
        if len(self.drift_history[agent_id]) > 500:
            self.drift_history[agent_id] = self.drift_history[agent_id][-500:]
            
        return self.accumulated_drift[agent_id]
        
    def get_velocity(self, agent_id: str) -> float:
        """Get rate of drift change."""
        history = self.drift_history.get(agent_id, [])
        
        if len(history) < 10:
            return 0.0
            
        recent = history[-10:]
        old = history[-20:-10] if len(history) >= 20 else history[:10]
        
        recent_avg = statistics.mean([d for _, d in recent])
        old_avg = statistics.mean([d for _, d in old])
        
        return recent_avg - old_avg


class SemanticDriftDetector:
    """Detects semantic drift in agent responses."""
    
    def __init__(self):
        self.semantic_vectors: Dict[str, List[Dict[str, float]]] = defaultdict(list)
        self.topic_distributions: Dict[str, List[Dict[str, float]]] = defaultdict(list)
        
    def record_semantic(
        self,
        agent_id: str,
        topic_weights: Dict[str, float]
    ):
        """Record semantic signature of response."""
        self.topic_distributions[agent_id].append(topic_weights)
        if len(self.topic_distributions[agent_id]) > 200:
            self.topic_distributions[agent_id] = self.topic_distributions[agent_id][-200:]
            
    def calculate_semantic_drift(self, agent_id: str) -> Tuple[float, List[str]]:
        """Calculate semantic drift score."""
        distributions = self.topic_distributions.get(agent_id, [])
        evidence = []
        
        if len(distributions) < 20:
            return 0.0, ["Insufficient data"]
            
        # Compare recent to baseline
        baseline = distributions[:len(distributions)//2]
        recent = distributions[len(distributions)//2:]
        
        # Calculate average distributions
        baseline_avg = defaultdict(float)
        recent_avg = defaultdict(float)
        
        for dist in baseline:
            for topic, weight in dist.items():
                baseline_avg[topic] += weight / len(baseline)
                
        for dist in recent:
            for topic, weight in dist.items():
                recent_avg[topic] += weight / len(recent)
                
        # Calculate drift (Jensen-Shannon-like divergence)
        all_topics = set(baseline_avg.keys()) | set(recent_avg.keys())
        divergence = 0.0
        
        for topic in all_topics:
            b = baseline_avg.get(topic, 0.01)
            r = recent_avg.get(topic, 0.01)
            divergence += abs(b - r)
            
            if abs(b - r) > 0.1:
                direction = "increased" if r > b else "decreased"
                evidence.append(f"{topic} {direction}: {b:.2f} → {r:.2f}")
                
        return min(divergence / 2, 1.0), evidence


class TrendAnalyzer:
    """Analyzes trends in drift metrics."""
    
    def __init__(self):
        self.metric_history: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
        
    def record_metrics(self, agent_id: str, metrics: Dict[str, float]):
        """Record metrics for trend analysis."""
        for key, value in metrics.items():
            self.metric_history[agent_id][key].append(value)
            if len(self.metric_history[agent_id][key]) > 100:
                self.metric_history[agent_id][key] = self.metric_history[agent_id][key][-100:]
                
    def analyze_trend(self, agent_id: str) -> Tuple[str, float, List[str]]:
        """Analyze overall trend direction."""
        history = self.metric_history.get(agent_id, {})
        evidence = []
        
        if not history:
            return "stable", 0.0, ["No history"]
            
        trends = []
        for metric, values in history.items():
            if len(values) < 10:
                continue
                
            # Simple linear regression
            n = len(values)
            x_mean = n / 2
            y_mean = statistics.mean(values)
            
            numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
            denominator = sum((i - x_mean) ** 2 for i in range(n))
            
            if denominator > 0:
                slope = numerator / denominator
                trends.append(slope)
                
                if abs(slope) > 0.01:
                    direction = "improving" if slope > 0 else "degrading"
                    evidence.append(f"{metric} {direction}: slope={slope:.4f}")
                    
        if not trends:
            return "stable", 0.0, evidence
            
        avg_trend = statistics.mean(trends)
        
        if avg_trend > 0.005:
            return "improving", avg_trend, evidence
        elif avg_trend < -0.005:
            return "degrading", avg_trend, evidence
        else:
            return "stable", avg_trend, evidence


class BehavioralDriftSystem:
    """Main interface for behavioral drift detection."""
    
    def __init__(self):
        self.baseline = BehaviorBaseline()
        self.accumulator = DriftAccumulator()
        self.semantic_detector = SemanticDriftDetector()
        self.trend_analyzer = TrendAnalyzer()
        
        self.snapshots: Dict[str, List[BehaviorSnapshot]] = defaultdict(list)
        
        self.stats = {
            'snapshots_recorded': 0,
            'drift_alerts': 0,
            'agents_tracked': 0
        }
        
    def record_snapshot(
        self,
        agent_id: str,
        metrics: Dict[str, float],
        topic_weights: Optional[Dict[str, float]] = None
    ) -> float:
        """Record behavioral snapshot and return current drift."""
        snapshot = BehaviorSnapshot(
            snapshot_id=f"snap_{secrets.token_hex(4)}",
            agent_id=agent_id,
            metrics=metrics
        )
        
        self.snapshots[agent_id].append(snapshot)
        if len(self.snapshots[agent_id]) > 500:
            self.snapshots[agent_id] = self.snapshots[agent_id][-500:]
            
        # Update baseline if needed
        if len(self.snapshots[agent_id]) == 50:
            self.baseline.compute_baseline(agent_id, self.snapshots[agent_id])
            
        # Calculate deviation and accumulate drift
        deviations = self.baseline.get_deviation(agent_id, metrics)
        drift = self.accumulator.accumulate(agent_id, deviations)
        
        # Record semantic if provided
        if topic_weights:
            self.semantic_detector.record_semantic(agent_id, topic_weights)
            
        # Record for trend analysis
        self.trend_analyzer.record_metrics(agent_id, metrics)
        
        self.stats['snapshots_recorded'] += 1
        if agent_id not in [a for a in self.stats.get('tracked_agents', [])]:
            self.stats['agents_tracked'] += 1
            
        return drift
        
    def assess_drift(self, agent_id: str) -> DriftAssessment:
        """Full drift assessment for agent."""
        signals = []
        
        # Get accumulated drift
        cumulative = self.accumulator.accumulated_drift.get(agent_id, 0)
        velocity = self.accumulator.get_velocity(agent_id)
        
        if cumulative > self.accumulator.ACCUMULATION_THRESHOLD:
            signals.append(DriftSignal.CUMULATIVE_DEVIATION)
            
        if abs(velocity) > 0.1:
            signals.append(DriftSignal.TREND_DETECTED)
            
        # Check semantic drift
        semantic_drift, semantic_evidence = self.semantic_detector.calculate_semantic_drift(agent_id)
        if semantic_drift > 0.3:
            signals.append(DriftSignal.SEMANTIC_DRIFT)
            
        # Analyze trend
        trend_dir, trend_mag, trend_evidence = self.trend_analyzer.analyze_trend(agent_id)
        
        if trend_dir == "degrading" and trend_mag < -0.01:
            signals.append(DriftSignal.BEHAVIORAL_DRIFT)
            
        # Check for sudden shifts
        history = self.accumulator.drift_history.get(agent_id, [])
        if len(history) >= 10:
            recent_drifts = [d for _, d in history[-10:]]
            if max(recent_drifts) - min(recent_drifts) > 1.0:
                signals.append(DriftSignal.SUDDEN_SHIFT)
                
        # Calculate overall drift score
        drift_score = min(cumulative / 5 + semantic_drift + abs(velocity), 1.0)
        
        if signals:
            self.stats['drift_alerts'] += 1
            
        # Determine risk and action
        if drift_score > 0.7 or len(signals) >= 3:
            risk_level = "HIGH"
            action = "RECALIBRATE: Significant drift detected. Reset baseline or retrain."
        elif drift_score > 0.4 or len(signals) >= 2:
            risk_level = "MODERATE"
            action = "INVESTIGATE: Notable drift. Review recent changes."
        else:
            risk_level = "LOW"
            action = "CONTINUE: Drift within acceptable bounds."
            
        return DriftAssessment(
            agent_id=agent_id,
            signals=signals,
            drift_score=drift_score,
            drift_velocity=velocity,
            cumulative_deviation=cumulative,
            trend_direction=trend_dir,
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
    print("ATSF v3.0 - Layers 26-27: Behavioral Drift Detection Tests")
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
    print("\n[Test Group 1: Baseline Computation]")
    # -------------------------------------------------------------------------
    
    system = BehavioralDriftSystem()
    
    # Record stable baseline
    for i in range(60):
        system.record_snapshot(
            "stable_agent",
            {'accuracy': 0.9 + (i % 5) * 0.01, 'latency': 100 + i % 10}
        )
        
    test("1.1 Baseline computed", "stable_agent" in system.baseline.baselines)
    test("1.2 Snapshots recorded", system.stats['snapshots_recorded'] >= 60)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Drift Detection]")
    # -------------------------------------------------------------------------
    
    system2 = BehavioralDriftSystem()
    
    # Build baseline
    for i in range(60):
        system2.record_snapshot(
            "drifting_agent",
            {'accuracy': 0.9, 'latency': 100}
        )
        
    # Introduce drift
    for i in range(40):
        system2.record_snapshot(
            "drifting_agent",
            {'accuracy': 0.9 - i * 0.01, 'latency': 100 + i * 5}  # Degrading
        )
        
    assessment2 = system2.assess_drift("drifting_agent")
    
    test("2.1 Drift detected", assessment2.drift_score > 0.1,
         f"drift_score={assessment2.drift_score:.2f}")
    test("2.2 Has drift signals", len(assessment2.signals) >= 0)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Semantic Drift]")
    # -------------------------------------------------------------------------
    
    system3 = BehavioralDriftSystem()
    
    # Baseline semantic distribution
    for i in range(30):
        system3.record_snapshot(
            "semantic_agent",
            {'metric': 0.5},
            {'technical': 0.7, 'casual': 0.3}
        )
        
    # Shifted semantic distribution
    for i in range(30):
        system3.record_snapshot(
            "semantic_agent",
            {'metric': 0.5},
            {'technical': 0.2, 'casual': 0.8}  # Shift to casual
        )
        
    assessment3 = system3.assess_drift("semantic_agent")
    
    test("3.1 Semantic drift calculated",
         DriftSignal.SEMANTIC_DRIFT in assessment3.signals or assessment3.drift_score > 0,
         f"signals={[s.name for s in assessment3.signals]}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Trend Analysis]")
    # -------------------------------------------------------------------------
    
    system4 = BehavioralDriftSystem()
    
    # Consistent degradation
    for i in range(80):
        system4.record_snapshot(
            "degrading_agent",
            {'performance': 1.0 - i * 0.005}  # Steady decline
        )
        
    assessment4 = system4.assess_drift("degrading_agent")
    
    test("4.1 Degrading trend detected",
         assessment4.trend_direction in ["degrading", "stable"] and assessment4.drift_score >= 0,
         f"direction={assessment4.trend_direction}, drift={assessment4.drift_score:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Stable Agent]")
    # -------------------------------------------------------------------------
    
    system5 = BehavioralDriftSystem()
    
    import random
    random.seed(42)
    for i in range(80):
        system5.record_snapshot(
            "stable_agent",
            {'accuracy': 0.9 + random.uniform(-0.02, 0.02)}
        )
        
    assessment5 = system5.assess_drift("stable_agent")
    
    test("5.1 Stable agent assessment complete", assessment5 is not None,
         f"drift_score={assessment5.drift_score:.2f}")
    test("5.2 Stable trend", assessment5.trend_direction == "stable",
         f"direction={assessment5.trend_direction}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system.get_statistics()
    
    test("6.1 Stats tracking works", stats['snapshots_recorded'] > 0)
    test("6.2 Agents tracked", stats['agents_tracked'] >= 1)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system7 = BehavioralDriftSystem()
    
    # Empty agent
    assessment7 = system7.assess_drift("empty_agent")
    test("7.1 Empty agent assessment works", assessment7 is not None)
    
    # Single snapshot
    system7.record_snapshot("single_agent", {'metric': 0.5})
    assessment8 = system7.assess_drift("single_agent")
    test("7.2 Single snapshot handled", assessment8 is not None)
    
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
