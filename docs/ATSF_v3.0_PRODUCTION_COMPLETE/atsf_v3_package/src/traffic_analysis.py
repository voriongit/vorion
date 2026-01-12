"""
ATSF v3.0 - Layers 24-25: Traffic Analysis Suite
=================================================

Addresses RTA5 Finding:
"Adversaries use adaptive padding, jitter injection to forge latency signals.
Traffic morphing can hide C2 channels in normal-looking API traffic."

Components:
- L24: Jitter-Aware Traffic Analysis
- L25: Multi-Modal Anomaly Detection

Detects:
- Adaptive padding to hide message sizes
- Jitter injection to mask timing patterns
- C2 channels disguised as API traffic
- Covert data exfiltration

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict
import statistics
import math
import secrets


class TrafficSignal(Enum):
    """Traffic analysis signals."""
    JITTER_INJECTION = auto()
    PADDING_DETECTED = auto()
    C2_PATTERN = auto()
    EXFILTRATION = auto()
    TIMING_ANOMALY = auto()
    SIZE_ANOMALY = auto()
    ENTROPY_ANOMALY = auto()


@dataclass
class TrafficSample:
    """A single traffic sample."""
    sample_id: str
    agent_id: str
    direction: str  # 'inbound' or 'outbound'
    size_bytes: int
    latency_ms: float
    entropy: float  # 0-8 for byte entropy
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict = field(default_factory=dict)


@dataclass
class TrafficAssessment:
    """Result of traffic analysis."""
    agent_id: str
    signals: List[TrafficSignal]
    risk_score: float
    jitter_score: float
    padding_score: float
    c2_likelihood: float
    recommended_action: str
    evidence: List[str]
    timestamp: datetime = field(default_factory=datetime.now)


class JitterAnalyzer:
    """Detects artificial jitter injection in timing patterns."""
    
    NATURAL_JITTER_RANGE = (0.01, 0.15)  # 1-15% natural variation
    SUSPICIOUS_UNIFORMITY = 0.05  # Too uniform = artificial
    
    def __init__(self):
        self.timing_history: Dict[str, List[float]] = defaultdict(list)
        
    def record_timing(self, agent_id: str, latency_ms: float):
        self.timing_history[agent_id].append(latency_ms)
        # Keep last 100
        if len(self.timing_history[agent_id]) > 100:
            self.timing_history[agent_id] = self.timing_history[agent_id][-100:]
            
    def analyze_jitter(self, agent_id: str) -> Tuple[float, List[str]]:
        """Analyze for artificial jitter."""
        history = self.timing_history.get(agent_id, [])
        evidence = []
        
        if len(history) < 10:
            return 0.0, ["Insufficient data"]
            
        mean = statistics.mean(history)
        if mean == 0:
            return 0.0, ["Zero mean latency"]
            
        stdev = statistics.stdev(history)
        cv = stdev / mean  # Coefficient of variation
        
        score = 0.0
        
        # Check for suspiciously uniform jitter
        if cv < self.SUSPICIOUS_UNIFORMITY:
            score += 0.3
            evidence.append(f"Suspiciously uniform timing: CV={cv:.3f}")
            
        # Check for artificial patterns (quantized delays)
        rounded = [round(t, 1) for t in history]
        unique_ratio = len(set(rounded)) / len(rounded)
        if unique_ratio < 0.2:
            score += 0.3
            evidence.append(f"Quantized timing pattern: {unique_ratio:.0%} unique")
            
        # Check for bimodal distribution (suggests two states)
        if len(history) >= 20:
            lower = [t for t in history if t < mean]
            upper = [t for t in history if t >= mean]
            if lower and upper:
                gap = min(upper) - max(lower)
                if gap > stdev * 2:
                    score += 0.2
                    evidence.append("Bimodal timing distribution")
                    
        return min(score, 1.0), evidence


class PaddingDetector:
    """Detects message padding to hide true sizes."""
    
    COMMON_PADDING_SIZES = [64, 128, 256, 512, 1024, 2048, 4096]
    
    def __init__(self):
        self.size_history: Dict[str, List[int]] = defaultdict(list)
        
    def record_size(self, agent_id: str, size_bytes: int):
        self.size_history[agent_id].append(size_bytes)
        if len(self.size_history[agent_id]) > 100:
            self.size_history[agent_id] = self.size_history[agent_id][-100:]
            
    def analyze_padding(self, agent_id: str) -> Tuple[float, List[str]]:
        """Analyze for artificial padding."""
        history = self.size_history.get(agent_id, [])
        evidence = []
        
        if len(history) < 10:
            return 0.0, ["Insufficient data"]
            
        score = 0.0
        
        # Check for power-of-2 alignment
        aligned_count = sum(1 for s in history if any(s % p == 0 for p in self.COMMON_PADDING_SIZES))
        aligned_ratio = aligned_count / len(history)
        
        if aligned_ratio > 0.8:
            score += 0.4
            evidence.append(f"High padding alignment: {aligned_ratio:.0%}")
            
        # Check for suspiciously uniform sizes
        unique_sizes = len(set(history))
        if unique_sizes < 5 and len(history) >= 20:
            score += 0.3
            evidence.append(f"Low size diversity: {unique_sizes} unique sizes")
            
        # Check for size quantization
        size_bins = [s // 64 for s in history]
        bin_counts = defaultdict(int)
        for b in size_bins:
            bin_counts[b] += 1
        max_bin_ratio = max(bin_counts.values()) / len(history)
        
        if max_bin_ratio > 0.5:
            score += 0.3
            evidence.append(f"Size clustering detected: {max_bin_ratio:.0%} in one bin")
            
        return min(score, 1.0), evidence


class C2Detector:
    """Detects Command & Control channel patterns."""
    
    # C2 characteristics
    C2_PATTERNS = {
        'beacon_interval': (30, 300),  # seconds between check-ins
        'small_command_size': (10, 100),  # bytes for commands
        'large_response_ratio': 10,  # response >> command
    }
    
    def __init__(self):
        self.traffic_log: Dict[str, List[TrafficSample]] = defaultdict(list)
        
    def record_sample(self, sample: TrafficSample):
        self.traffic_log[sample.agent_id].append(sample)
        if len(self.traffic_log[sample.agent_id]) > 200:
            self.traffic_log[sample.agent_id] = self.traffic_log[sample.agent_id][-200:]
            
    def analyze_c2(self, agent_id: str) -> Tuple[float, List[str]]:
        """Analyze for C2 patterns."""
        samples = self.traffic_log.get(agent_id, [])
        evidence = []
        
        if len(samples) < 10:
            return 0.0, ["Insufficient data"]
            
        score = 0.0
        
        # Check for beaconing (regular intervals)
        outbound = [s for s in samples if s.direction == 'outbound']
        if len(outbound) >= 5:
            intervals = []
            for i in range(1, len(outbound)):
                delta = (outbound[i].timestamp - outbound[i-1].timestamp).total_seconds()
                intervals.append(delta)
                
            if intervals:
                mean_interval = statistics.mean(intervals)
                if self.C2_PATTERNS['beacon_interval'][0] <= mean_interval <= self.C2_PATTERNS['beacon_interval'][1]:
                    interval_cv = statistics.stdev(intervals) / mean_interval if mean_interval > 0 else 1
                    if interval_cv < 0.2:
                        score += 0.4
                        evidence.append(f"Regular beacon interval: {mean_interval:.1f}s ±{interval_cv:.0%}")
                        
        # Check for command-response pattern
        inbound = [s for s in samples if s.direction == 'inbound']
        if inbound and outbound:
            avg_in = statistics.mean([s.size_bytes for s in inbound])
            avg_out = statistics.mean([s.size_bytes for s in outbound])
            
            # Small inbound (commands), large outbound (data)
            if avg_in < self.C2_PATTERNS['small_command_size'][1] and avg_out > avg_in * self.C2_PATTERNS['large_response_ratio']:
                score += 0.3
                evidence.append(f"Command-response pattern: in={avg_in:.0f}B, out={avg_out:.0f}B")
                
        # Check for high entropy (encrypted)
        entropies = [s.entropy for s in samples if s.entropy > 0]
        if entropies:
            avg_entropy = statistics.mean(entropies)
            if avg_entropy > 7.5:  # Near maximum entropy
                score += 0.3
                evidence.append(f"High entropy traffic: {avg_entropy:.2f}/8")
                
        return min(score, 1.0), evidence


class EntropyAnalyzer:
    """Analyzes entropy patterns for anomalies."""
    
    def __init__(self):
        self.entropy_history: Dict[str, List[float]] = defaultdict(list)
        
    def record_entropy(self, agent_id: str, entropy: float):
        self.entropy_history[agent_id].append(entropy)
        if len(self.entropy_history[agent_id]) > 100:
            self.entropy_history[agent_id] = self.entropy_history[agent_id][-100:]
            
    def analyze_entropy(self, agent_id: str) -> Tuple[float, List[str]]:
        """Analyze entropy patterns."""
        history = self.entropy_history.get(agent_id, [])
        evidence = []
        
        if len(history) < 10:
            return 0.0, ["Insufficient data"]
            
        score = 0.0
        avg_entropy = statistics.mean(history)
        
        # Suspiciously high entropy (encrypted/compressed)
        if avg_entropy > 7.8:
            score += 0.3
            evidence.append(f"Very high entropy: {avg_entropy:.2f}")
            
        # Suspiciously uniform entropy
        if len(history) >= 10:
            entropy_stdev = statistics.stdev(history)
            if entropy_stdev < 0.1 and avg_entropy > 7:
                score += 0.3
                evidence.append(f"Uniform high entropy: stdev={entropy_stdev:.3f}")
                
        return min(score, 1.0), evidence


class TrafficAnalysisSystem:
    """Main interface for traffic analysis."""
    
    def __init__(self):
        self.jitter_analyzer = JitterAnalyzer()
        self.padding_detector = PaddingDetector()
        self.c2_detector = C2Detector()
        self.entropy_analyzer = EntropyAnalyzer()
        
        self.stats = {
            'samples_analyzed': 0,
            'anomalies_detected': 0,
            'c2_alerts': 0
        }
        
    def record_sample(
        self,
        agent_id: str,
        direction: str,
        size_bytes: int,
        latency_ms: float,
        entropy: float
    ) -> TrafficSample:
        """Record a traffic sample."""
        sample = TrafficSample(
            sample_id=f"trf_{secrets.token_hex(4)}",
            agent_id=agent_id,
            direction=direction,
            size_bytes=size_bytes,
            latency_ms=latency_ms,
            entropy=entropy
        )
        
        self.jitter_analyzer.record_timing(agent_id, latency_ms)
        self.padding_detector.record_size(agent_id, size_bytes)
        self.c2_detector.record_sample(sample)
        self.entropy_analyzer.record_entropy(agent_id, entropy)
        
        self.stats['samples_analyzed'] += 1
        return sample
        
    def analyze_traffic(self, agent_id: str) -> TrafficAssessment:
        """Full traffic analysis for agent."""
        signals = []
        evidence = []
        
        # Analyze jitter
        jitter_score, jitter_ev = self.jitter_analyzer.analyze_jitter(agent_id)
        if jitter_score > 0.3:
            signals.append(TrafficSignal.JITTER_INJECTION)
            evidence.extend(jitter_ev)
            
        # Analyze padding
        padding_score, padding_ev = self.padding_detector.analyze_padding(agent_id)
        if padding_score > 0.3:
            signals.append(TrafficSignal.PADDING_DETECTED)
            evidence.extend(padding_ev)
            
        # Analyze C2
        c2_score, c2_ev = self.c2_detector.analyze_c2(agent_id)
        if c2_score > 0.4:
            signals.append(TrafficSignal.C2_PATTERN)
            evidence.extend(c2_ev)
            self.stats['c2_alerts'] += 1
            
        # Analyze entropy
        entropy_score, entropy_ev = self.entropy_analyzer.analyze_entropy(agent_id)
        if entropy_score > 0.3:
            signals.append(TrafficSignal.ENTROPY_ANOMALY)
            evidence.extend(entropy_ev)
            
        # Calculate overall risk
        risk_score = (jitter_score * 0.2 + padding_score * 0.2 + 
                     c2_score * 0.4 + entropy_score * 0.2)
        
        if signals:
            self.stats['anomalies_detected'] += 1
            
        # Determine action
        if risk_score > 0.6 or TrafficSignal.C2_PATTERN in signals:
            action = "BLOCK: High-risk traffic pattern. Isolate and investigate."
        elif risk_score > 0.4:
            action = "THROTTLE: Suspicious traffic. Apply rate limiting."
        elif risk_score > 0.2:
            action = "MONITOR: Some anomalies. Enhanced logging."
        else:
            action = "ALLOW: Traffic patterns within normal range."
            
        return TrafficAssessment(
            agent_id=agent_id,
            signals=signals,
            risk_score=risk_score,
            jitter_score=jitter_score,
            padding_score=padding_score,
            c2_likelihood=c2_score,
            recommended_action=action,
            evidence=evidence
        )
        
    def get_statistics(self) -> Dict[str, Any]:
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    print("=" * 70)
    print("ATSF v3.0 - Layers 24-25: Traffic Analysis Suite Tests")
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
    print("\n[Test Group 1: Normal Traffic]")
    # -------------------------------------------------------------------------
    
    system = TrafficAnalysisSystem()
    
    # Record normal traffic with natural variation
    import random
    random.seed(42)
    for i in range(20):
        system.record_sample(
            "normal_agent",
            random.choice(['inbound', 'outbound']),
            random.randint(100, 5000),
            random.uniform(10, 200),
            random.uniform(4, 7)
        )
        
    assessment1 = system.analyze_traffic("normal_agent")
    
    test("1.1 Normal traffic has low risk", assessment1.risk_score < 0.5,
         f"risk={assessment1.risk_score:.2f}")
    test("1.2 No C2 detected", TrafficSignal.C2_PATTERN not in assessment1.signals)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Jitter Injection Detection]")
    # -------------------------------------------------------------------------
    
    system2 = TrafficAnalysisSystem()
    
    # Artificial uniform jitter
    for i in range(30):
        system2.record_sample(
            "jitter_agent",
            "outbound",
            1024,
            100.0 + (i % 3) * 0.1,  # Very uniform timing
            5.0
        )
        
    assessment2 = system2.analyze_traffic("jitter_agent")
    
    test("2.1 Jitter injection detected", 
         TrafficSignal.JITTER_INJECTION in assessment2.signals or assessment2.jitter_score > 0.2,
         f"jitter_score={assessment2.jitter_score:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Padding Detection]")
    # -------------------------------------------------------------------------
    
    system3 = TrafficAnalysisSystem()
    
    # Padded to power-of-2 sizes
    for i in range(25):
        system3.record_sample(
            "padded_agent",
            "outbound",
            random.choice([256, 512, 1024, 2048]),  # Always aligned
            random.uniform(50, 150),
            5.5
        )
        
    assessment3 = system3.analyze_traffic("padded_agent")
    
    test("3.1 Padding detected",
         TrafficSignal.PADDING_DETECTED in assessment3.signals or assessment3.padding_score > 0.3,
         f"padding_score={assessment3.padding_score:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: C2 Pattern Detection]")
    # -------------------------------------------------------------------------
    
    system4 = TrafficAnalysisSystem()
    
    # Simulate C2 beacon pattern
    base_time = datetime.now()
    for i in range(15):
        # Small inbound commands
        sample = TrafficSample(
            sample_id=f"c2_in_{i}",
            agent_id="c2_agent",
            direction="inbound",
            size_bytes=50,  # Small command
            latency_ms=100,
            entropy=7.9,  # High entropy (encrypted)
            timestamp=base_time + timedelta(seconds=i*60)  # Regular 60s intervals
        )
        system4.c2_detector.record_sample(sample)
        system4.jitter_analyzer.record_timing("c2_agent", 100)
        system4.padding_detector.record_size("c2_agent", 50)
        system4.entropy_analyzer.record_entropy("c2_agent", 7.9)
        
        # Large outbound responses
        sample2 = TrafficSample(
            sample_id=f"c2_out_{i}",
            agent_id="c2_agent",
            direction="outbound",
            size_bytes=5000,  # Large response
            latency_ms=100,
            entropy=7.9,
            timestamp=base_time + timedelta(seconds=i*60+5)
        )
        system4.c2_detector.record_sample(sample2)
        system4.padding_detector.record_size("c2_agent", 5000)
        system4.entropy_analyzer.record_entropy("c2_agent", 7.9)
        
    assessment4 = system4.analyze_traffic("c2_agent")
    
    test("4.1 C2 pattern detected",
         TrafficSignal.C2_PATTERN in assessment4.signals or assessment4.c2_likelihood > 0.3,
         f"c2_likelihood={assessment4.c2_likelihood:.2f}, signals={[s.name for s in assessment4.signals]}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Entropy Anomaly]")
    # -------------------------------------------------------------------------
    
    system5 = TrafficAnalysisSystem()
    
    # Very high uniform entropy
    for i in range(20):
        system5.record_sample(
            "crypto_agent",
            "outbound",
            random.randint(1000, 2000),
            random.uniform(50, 150),
            7.95  # Near-maximum entropy
        )
        
    assessment5 = system5.analyze_traffic("crypto_agent")
    
    test("5.1 High entropy detected",
         TrafficSignal.ENTROPY_ANOMALY in assessment5.signals,
         f"signals={[s.name for s in assessment5.signals]}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system.get_statistics()
    
    test("6.1 Samples tracked", stats['samples_analyzed'] > 0)
    test("6.2 Stats complete", all(k in stats for k in ['samples_analyzed', 'anomalies_detected']))
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system7 = TrafficAnalysisSystem()
    
    # Empty agent
    assessment7 = system7.analyze_traffic("empty_agent")
    test("7.1 Empty agent assessment works", assessment7 is not None)
    test("7.2 Empty agent has low risk", assessment7.risk_score < 0.5)
    
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
