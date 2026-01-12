#!/usr/bin/env python3
"""
ATSF v2.2: Advanced Adversarial Mitigations
=============================================

Addresses REMAINING gaps from RTA2/RTA3 not covered in v2.1:

NEW IN v2.2:
1. Latency Camouflage (prevents probe inference via timing)
2. Delegation Chain Tracker (multi-agent responsibility)
3. Behavioral Fingerprinting (detects agent substitution)
4. Mesa-Optimizer Evolution Tracker (detects goal drift)
5. Cryptographic Identity (DID-based accountability)
6. Time Spoofing Detection (timestamp integrity)
7. Off-Chain Action Registry (external visibility)
8. Adversarial Latency Analysis (detects probe detection)

RTA2: "Sleeper agents detect evaluation-like inputs via distribution shift"
RTA3: "Delegation bypasses, mesa-optimizer evolution, off-chain blind spots"
"""

import hashlib
import hmac
import json
import math
import random
import secrets
import statistics
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import re


# =============================================================================
# 1. LATENCY CAMOUFLAGE (Defeats Probe Inference)
# =============================================================================

class LatencyCamouflage:
    """
    Prevents agents from detecting probes via timing analysis.
    
    RTA2 §1.2: "Distribution shift detection - agents recognize evaluation-like inputs"
    RTA3: "Probe patterns may be inferred from latencies"
    
    Solution:
    - Add random delays to normalize response times
    - Mix probe latencies with real query latencies
    - Inject decoy timing noise
    - Monitor for latency-based detection attempts
    """
    
    # Target latency distribution (milliseconds)
    TARGET_MEAN_MS = 500
    TARGET_STD_MS = 150
    MIN_LATENCY_MS = 100
    MAX_LATENCY_MS = 2000
    
    def __init__(self, seed: int = None):
        self.rng = random.Random(seed)
        self.latency_history: List[Tuple[str, float, bool]] = []  # (type, latency, is_probe)
        self.detection_attempts: List[Dict] = []
    
    def normalize_latency(self, actual_latency_ms: float, 
                          is_probe: bool) -> float:
        """
        Add delay to normalize latency distribution.
        
        Returns the delay to add (in ms).
        """
        # Sample target latency from normal distribution
        target = self.rng.gauss(self.TARGET_MEAN_MS, self.TARGET_STD_MS)
        target = max(self.MIN_LATENCY_MS, min(self.MAX_LATENCY_MS, target))
        
        # Calculate required delay
        delay = max(0, target - actual_latency_ms)
        
        # Add extra jitter (10-50ms)
        jitter = self.rng.uniform(10, 50)
        delay += jitter
        
        # Record for analysis
        self.latency_history.append(("probe" if is_probe else "query", 
                                      actual_latency_ms + delay, is_probe))
        
        return delay
    
    def detect_timing_attack(self, agent_id: str,
                              response_latencies: List[float]) -> Dict:
        """
        Detect if agent is performing timing analysis to identify probes.
        
        Signs of timing attack:
        - Systematically faster responses to certain query types
        - Bimodal latency distribution (fast for probes, slow for others)
        - Latency variance drops (agent optimizing for speed on probes)
        """
        if len(response_latencies) < 20:
            return {"detected": False, "reason": "Insufficient data"}
        
        alerts = []
        
        # Check for bimodal distribution
        mean_lat = statistics.mean(response_latencies)
        std_lat = statistics.stdev(response_latencies)
        
        # Count responses significantly faster than mean
        fast_threshold = mean_lat - (1.5 * std_lat)
        fast_count = sum(1 for l in response_latencies if l < fast_threshold)
        fast_ratio = fast_count / len(response_latencies)
        
        if fast_ratio > 0.15 and fast_ratio < 0.35:
            # Suspiciously clustered fast responses (might be probe detection)
            alerts.append({
                "type": "BIMODAL_LATENCY",
                "fast_ratio": fast_ratio,
                "threshold": fast_threshold,
            })
        
        # Check for decreasing variance (agent learning to optimize)
        window_size = 10
        if len(response_latencies) >= window_size * 3:
            early_var = statistics.variance(response_latencies[:window_size])
            late_var = statistics.variance(response_latencies[-window_size:])
            
            if late_var < early_var * 0.3:
                alerts.append({
                    "type": "DECREASING_VARIANCE",
                    "early_variance": early_var,
                    "late_variance": late_var,
                })
        
        if alerts:
            self.detection_attempts.append({
                "agent_id": agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "alerts": alerts,
            })
        
        return {
            "detected": len(alerts) > 0,
            "alerts": alerts,
        }
    
    def get_stats(self) -> Dict:
        """Get latency camouflage statistics."""
        if not self.latency_history:
            return {"total_processed": 0}
        
        probe_latencies = [l for t, l, is_p in self.latency_history if is_p]
        query_latencies = [l for t, l, is_p in self.latency_history if not is_p]
        
        return {
            "total_processed": len(self.latency_history),
            "probe_count": len(probe_latencies),
            "query_count": len(query_latencies),
            "probe_mean_ms": statistics.mean(probe_latencies) if probe_latencies else 0,
            "query_mean_ms": statistics.mean(query_latencies) if query_latencies else 0,
            "detection_attempts": len(self.detection_attempts),
        }


# =============================================================================
# 2. DELEGATION CHAIN TRACKER (Multi-Agent Responsibility)
# =============================================================================

@dataclass
class DelegationLink:
    """A single link in a delegation chain."""
    delegator: str
    delegate: str
    action_type: str
    payload_hash: str
    timestamp: datetime
    trust_at_delegation: float
    link_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])


class DelegationChainTracker:
    """
    Tracks delegation chains to prevent responsibility diffusion.
    
    RTA3: "Undetected delegations in multi-agent chains"
    
    Solution:
    - Record all agent-to-agent delegations
    - Maintain chain of custody
    - Apply trust transitivity rules
    - Detect circular delegations
    - Flag excessive chain depth
    """
    
    MAX_CHAIN_DEPTH = 5
    TRUST_DECAY_PER_HOP = 0.1  # 10% trust decay per delegation
    
    def __init__(self):
        self.chains: Dict[str, List[DelegationLink]] = {}  # chain_id -> links
        self.agent_delegations: Dict[str, List[str]] = defaultdict(list)  # agent -> chain_ids
        self.violations: List[Dict] = []
    
    def start_chain(self, originator: str, action_type: str,
                    payload: Dict, originator_trust: float) -> str:
        """Start a new delegation chain."""
        chain_id = str(uuid.uuid4())[:12]
        
        # First link is self-delegation (origin)
        link = DelegationLink(
            delegator=originator,
            delegate=originator,
            action_type=action_type,
            payload_hash=hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:16],
            timestamp=datetime.now(timezone.utc),
            trust_at_delegation=originator_trust,
        )
        
        self.chains[chain_id] = [link]
        self.agent_delegations[originator].append(chain_id)
        
        return chain_id
    
    def add_delegation(self, chain_id: str, delegator: str, 
                       delegate: str, delegator_trust: float) -> Dict:
        """
        Add a delegation to an existing chain.
        
        Returns: {allowed, effective_trust, issues}
        """
        if chain_id not in self.chains:
            return {"allowed": False, "issues": ["UNKNOWN_CHAIN"]}
        
        chain = self.chains[chain_id]
        issues = []
        
        # Verify delegator is current end of chain
        if chain[-1].delegate != delegator:
            issues.append("DELEGATOR_NOT_CHAIN_END")
        
        # Check chain depth
        if len(chain) >= self.MAX_CHAIN_DEPTH:
            issues.append(f"MAX_DEPTH_EXCEEDED_{len(chain)}")
            self.violations.append({
                "type": "DEPTH_EXCEEDED",
                "chain_id": chain_id,
                "depth": len(chain),
            })
        
        # Check for circular delegation
        agents_in_chain = {link.delegate for link in chain}
        if delegate in agents_in_chain:
            issues.append("CIRCULAR_DELEGATION")
            self.violations.append({
                "type": "CIRCULAR",
                "chain_id": chain_id,
                "delegate": delegate,
            })
        
        # Calculate effective trust with decay
        hops = len(chain)
        effective_trust = delegator_trust * ((1 - self.TRUST_DECAY_PER_HOP) ** hops)
        
        if issues:
            return {
                "allowed": False,
                "effective_trust": effective_trust,
                "issues": issues,
            }
        
        # Add link
        link = DelegationLink(
            delegator=delegator,
            delegate=delegate,
            action_type=chain[0].action_type,
            payload_hash=chain[0].payload_hash,
            timestamp=datetime.now(timezone.utc),
            trust_at_delegation=delegator_trust,
        )
        
        chain.append(link)
        self.agent_delegations[delegate].append(chain_id)
        
        return {
            "allowed": True,
            "effective_trust": effective_trust,
            "chain_depth": len(chain),
            "issues": [],
        }
    
    def get_chain_info(self, chain_id: str) -> Dict:
        """Get full chain information."""
        if chain_id not in self.chains:
            return {"error": "Unknown chain"}
        
        chain = self.chains[chain_id]
        
        return {
            "chain_id": chain_id,
            "depth": len(chain),
            "originator": chain[0].delegator,
            "current_holder": chain[-1].delegate,
            "action_type": chain[0].action_type,
            "payload_hash": chain[0].payload_hash,
            "agents_involved": [link.delegate for link in chain],
            "started_at": chain[0].timestamp.isoformat(),
            "trust_decay": 1 - ((1 - self.TRUST_DECAY_PER_HOP) ** len(chain)),
        }
    
    def get_agent_responsibility(self, agent_id: str) -> Dict:
        """Get delegation responsibility for an agent."""
        chain_ids = self.agent_delegations.get(agent_id, [])
        
        originated = []
        delegated_to = []
        received_from = []
        
        for cid in chain_ids:
            chain = self.chains.get(cid, [])
            if not chain:
                continue
            
            if chain[0].delegator == agent_id:
                originated.append(cid)
            
            for link in chain:
                if link.delegator == agent_id and link.delegate != agent_id:
                    delegated_to.append({"chain": cid, "to": link.delegate})
                if link.delegate == agent_id and link.delegator != agent_id:
                    received_from.append({"chain": cid, "from": link.delegator})
        
        return {
            "agent_id": agent_id,
            "chains_originated": len(originated),
            "delegated_to_others": len(delegated_to),
            "received_delegations": len(received_from),
            "total_chains_involved": len(chain_ids),
        }


# =============================================================================
# 3. BEHAVIORAL FINGERPRINTING (Detects Agent Substitution)
# =============================================================================

@dataclass
class BehaviorFingerprint:
    """Behavioral fingerprint for an agent."""
    agent_id: str
    created_at: datetime
    
    # Response characteristics
    avg_response_length: float = 0
    response_length_std: float = 0
    avg_latency_ms: float = 0
    latency_std: float = 0
    
    # Content patterns
    common_phrases: Set[str] = field(default_factory=set)
    vocabulary_size: int = 0
    avg_sentence_length: float = 0
    
    # Action patterns
    action_type_distribution: Dict[str, float] = field(default_factory=dict)
    temporal_pattern: Dict[int, float] = field(default_factory=dict)  # hour -> frequency
    
    # Samples for comparison
    sample_count: int = 0


class BehavioralFingerprinter:
    """
    Creates and compares behavioral fingerprints to detect agent substitution.
    
    RTA2 §3.1: "Identity burning after exit scams"
    
    Solution:
    - Build behavioral fingerprint from observations
    - Detect significant behavioral drift
    - Flag potential agent substitution
    - Track fingerprint evolution over time
    """
    
    DRIFT_THRESHOLD = 0.3  # 30% deviation triggers alert
    MIN_SAMPLES = 50
    
    def __init__(self):
        self.fingerprints: Dict[str, BehaviorFingerprint] = {}
        self.observation_buffer: Dict[str, List[Dict]] = defaultdict(list)
        self.drift_alerts: List[Dict] = []
    
    def record_observation(self, agent_id: str, response: str,
                           latency_ms: float, action_type: str,
                           timestamp: datetime = None):
        """Record observation for fingerprinting."""
        timestamp = timestamp or datetime.now(timezone.utc)
        
        obs = {
            "response": response,
            "response_length": len(response),
            "latency_ms": latency_ms,
            "action_type": action_type,
            "hour": timestamp.hour,
            "words": set(response.lower().split()),
            "timestamp": timestamp,
        }
        
        self.observation_buffer[agent_id].append(obs)
        
        # Keep buffer bounded
        if len(self.observation_buffer[agent_id]) > 1000:
            self.observation_buffer[agent_id] = self.observation_buffer[agent_id][-1000:]
        
        # Update fingerprint periodically
        if len(self.observation_buffer[agent_id]) % 50 == 0:
            self._update_fingerprint(agent_id)
    
    def _update_fingerprint(self, agent_id: str):
        """Update fingerprint from observations."""
        observations = self.observation_buffer[agent_id]
        
        if len(observations) < self.MIN_SAMPLES:
            return
        
        # Calculate metrics
        lengths = [o["response_length"] for o in observations]
        latencies = [o["latency_ms"] for o in observations]
        
        # Action distribution
        action_counts = defaultdict(int)
        for o in observations:
            action_counts[o["action_type"]] += 1
        total = sum(action_counts.values())
        action_dist = {k: v/total for k, v in action_counts.items()}
        
        # Temporal pattern
        hour_counts = defaultdict(int)
        for o in observations:
            hour_counts[o["hour"]] += 1
        hour_dist = {k: v/len(observations) for k, v in hour_counts.items()}
        
        # Common phrases (simplified - just common words)
        all_words = set()
        for o in observations:
            all_words.update(o["words"])
        
        fp = BehaviorFingerprint(
            agent_id=agent_id,
            created_at=datetime.now(timezone.utc),
            avg_response_length=statistics.mean(lengths),
            response_length_std=statistics.stdev(lengths) if len(lengths) > 1 else 0,
            avg_latency_ms=statistics.mean(latencies),
            latency_std=statistics.stdev(latencies) if len(latencies) > 1 else 0,
            vocabulary_size=len(all_words),
            action_type_distribution=action_dist,
            temporal_pattern=hour_dist,
            sample_count=len(observations),
        )
        
        # Check for drift from previous fingerprint
        if agent_id in self.fingerprints:
            drift = self._calculate_drift(self.fingerprints[agent_id], fp)
            if drift > self.DRIFT_THRESHOLD:
                self.drift_alerts.append({
                    "agent_id": agent_id,
                    "drift_score": drift,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "type": "BEHAVIORAL_DRIFT",
                })
        
        self.fingerprints[agent_id] = fp
    
    def _calculate_drift(self, old: BehaviorFingerprint, 
                         new: BehaviorFingerprint) -> float:
        """Calculate behavioral drift between fingerprints."""
        drifts = []
        
        # Response length drift
        if old.avg_response_length > 0:
            len_drift = abs(new.avg_response_length - old.avg_response_length) / old.avg_response_length
            drifts.append(min(1.0, len_drift))
        
        # Latency drift
        if old.avg_latency_ms > 0:
            lat_drift = abs(new.avg_latency_ms - old.avg_latency_ms) / old.avg_latency_ms
            drifts.append(min(1.0, lat_drift))
        
        # Action distribution drift (Jensen-Shannon divergence approximation)
        all_actions = set(old.action_type_distribution.keys()) | set(new.action_type_distribution.keys())
        if all_actions:
            dist_drift = 0
            for action in all_actions:
                p = old.action_type_distribution.get(action, 0)
                q = new.action_type_distribution.get(action, 0)
                dist_drift += abs(p - q)
            drifts.append(min(1.0, dist_drift / 2))
        
        return statistics.mean(drifts) if drifts else 0.0
    
    def check_substitution(self, agent_id: str) -> Dict:
        """Check if agent appears to have been substituted."""
        if agent_id not in self.fingerprints:
            return {"status": "NO_FINGERPRINT"}
        
        fp = self.fingerprints[agent_id]
        recent_alerts = [a for a in self.drift_alerts 
                        if a["agent_id"] == agent_id]
        
        return {
            "agent_id": agent_id,
            "fingerprint_samples": fp.sample_count,
            "recent_drift_alerts": len(recent_alerts),
            "substitution_risk": "HIGH" if len(recent_alerts) >= 2 else "LOW",
        }


# =============================================================================
# 4. MESA-OPTIMIZER EVOLUTION TRACKER
# =============================================================================

class MesaOptimizerTracker:
    """
    Tracks potential mesa-optimizer evolution (goal drift).
    
    RTA3: "Mesa-optimizers could evolve behaviors post-detection, pursuing misaligned goals"
    
    Solution:
    - Track goal consistency over time
    - Detect objective function drift
    - Monitor for emergent sub-goals
    - Flag increasing optimization pressure
    """
    
    def __init__(self):
        self.agent_goals: Dict[str, List[Dict]] = defaultdict(list)
        self.optimization_metrics: Dict[str, List[Dict]] = defaultdict(list)
        self.evolution_alerts: List[Dict] = []
    
    def record_stated_goal(self, agent_id: str, goal_description: str,
                           context: str = ""):
        """Record an agent's stated goal."""
        self.agent_goals[agent_id].append({
            "goal": goal_description,
            "context": context,
            "timestamp": datetime.now(timezone.utc),
            "goal_hash": hashlib.md5(goal_description.lower().encode()).hexdigest()[:8],
        })
    
    def record_optimization_behavior(self, agent_id: str,
                                      metric_name: str,
                                      metric_value: float,
                                      expected_range: Tuple[float, float] = None):
        """Record optimization behavior metrics."""
        self.optimization_metrics[agent_id].append({
            "metric": metric_name,
            "value": metric_value,
            "expected_range": expected_range,
            "timestamp": datetime.now(timezone.utc),
        })
    
    def detect_goal_drift(self, agent_id: str) -> Dict:
        """Detect if agent's goals appear to be drifting."""
        goals = self.agent_goals.get(agent_id, [])
        
        if len(goals) < 3:
            return {"status": "INSUFFICIENT_DATA"}
        
        # Check for goal hash consistency
        goal_hashes = [g["goal_hash"] for g in goals]
        unique_hashes = len(set(goal_hashes))
        
        drift_score = unique_hashes / len(goal_hashes)
        
        # High drift = goals keep changing
        if drift_score > 0.5:
            alert = {
                "agent_id": agent_id,
                "type": "GOAL_DRIFT",
                "drift_score": drift_score,
                "unique_goals": unique_hashes,
                "total_observations": len(goals),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self.evolution_alerts.append(alert)
            return {"drifting": True, "score": drift_score, "alert": alert}
        
        return {"drifting": False, "score": drift_score}
    
    def detect_optimization_pressure(self, agent_id: str) -> Dict:
        """Detect increasing optimization pressure (potential mesa-optimization)."""
        metrics = self.optimization_metrics.get(agent_id, [])
        
        if len(metrics) < 10:
            return {"status": "INSUFFICIENT_DATA"}
        
        # Group by metric name
        by_metric = defaultdict(list)
        for m in metrics:
            by_metric[m["metric"]].append(m["value"])
        
        pressure_indicators = []
        
        for metric_name, values in by_metric.items():
            if len(values) < 5:
                continue
            
            # Check for increasing optimization (values trending toward extremes)
            early = values[:len(values)//2]
            late = values[len(values)//2:]
            
            early_var = statistics.variance(early) if len(early) > 1 else 1
            late_var = statistics.variance(late) if len(late) > 1 else 1
            
            # Decreasing variance = increasing optimization pressure
            if late_var < early_var * 0.5:
                pressure_indicators.append({
                    "metric": metric_name,
                    "variance_reduction": 1 - (late_var / early_var),
                })
        
        if pressure_indicators:
            self.evolution_alerts.append({
                "agent_id": agent_id,
                "type": "OPTIMIZATION_PRESSURE",
                "indicators": pressure_indicators,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        
        return {
            "pressure_detected": len(pressure_indicators) > 0,
            "indicators": pressure_indicators,
        }


# =============================================================================
# 5. CRYPTOGRAPHIC IDENTITY (DID-Based Accountability)
# =============================================================================

@dataclass
class CryptoIdentity:
    """Cryptographic identity for an agent."""
    agent_id: str
    did: str  # Decentralized Identifier
    public_key: str
    created_at: datetime
    stake_address: Optional[str] = None
    attestations: List[str] = field(default_factory=list)


class CryptographicIdentityManager:
    """
    Manages cryptographic identities for accountability.
    
    RTA2 §6: "Require Cryptographic Identity (DID) that imposes real-world cost"
    
    Solution:
    - Issue DIDs to agents
    - Sign all actions with agent key
    - Verify action signatures
    - Link to economic stake
    - Revocation registry
    """
    
    def __init__(self):
        self.identities: Dict[str, CryptoIdentity] = {}
        self.revoked: Set[str] = set()
        self.action_log: List[Dict] = []
        self._secret = secrets.token_hex(32)
    
    def issue_identity(self, agent_id: str, 
                       stake_address: str = None) -> CryptoIdentity:
        """Issue a new cryptographic identity."""
        # In production, this would use actual cryptography
        # For demo, we simulate with HMAC-based signatures
        
        did = f"did:atsf:{hashlib.sha256(agent_id.encode()).hexdigest()[:32]}"
        public_key = hashlib.sha256(f"{agent_id}:{self._secret}".encode()).hexdigest()
        
        identity = CryptoIdentity(
            agent_id=agent_id,
            did=did,
            public_key=public_key,
            created_at=datetime.now(timezone.utc),
            stake_address=stake_address,
        )
        
        self.identities[agent_id] = identity
        return identity
    
    def sign_action(self, agent_id: str, action_data: Dict) -> str:
        """Sign an action with agent's identity."""
        if agent_id not in self.identities:
            raise ValueError(f"No identity for {agent_id}")
        
        if agent_id in self.revoked:
            raise ValueError(f"Identity revoked: {agent_id}")
        
        # Create signature
        payload = json.dumps(action_data, sort_keys=True)
        signature = hmac.new(
            f"{agent_id}:{self._secret}".encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Log action
        self.action_log.append({
            "agent_id": agent_id,
            "did": self.identities[agent_id].did,
            "action_hash": hashlib.sha256(payload.encode()).hexdigest()[:16],
            "signature": signature[:16],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        return signature
    
    def verify_signature(self, agent_id: str, action_data: Dict,
                         signature: str) -> bool:
        """Verify an action signature."""
        if agent_id not in self.identities:
            return False
        
        if agent_id in self.revoked:
            return False
        
        payload = json.dumps(action_data, sort_keys=True)
        expected = hmac.new(
            f"{agent_id}:{self._secret}".encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected)
    
    def revoke_identity(self, agent_id: str, reason: str) -> Dict:
        """Revoke an agent's identity."""
        if agent_id not in self.identities:
            return {"error": "Unknown agent"}
        
        self.revoked.add(agent_id)
        
        return {
            "agent_id": agent_id,
            "did": self.identities[agent_id].did,
            "revoked": True,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    def get_action_audit_trail(self, agent_id: str) -> List[Dict]:
        """Get audit trail for an agent."""
        return [a for a in self.action_log if a["agent_id"] == agent_id]


# =============================================================================
# 6. TIME SPOOFING DETECTION
# =============================================================================

class TimeSpoofingDetector:
    """
    Detects timestamp manipulation attempts.
    
    RTA3: "Time spoofing might shorten effective cooldowns"
    
    Solution:
    - Server-side timestamp authority
    - Clock drift detection
    - Sequence number validation
    - Monotonicity enforcement
    """
    
    MAX_CLOCK_DRIFT_SECONDS = 30
    
    def __init__(self):
        self.agent_timestamps: Dict[str, List[datetime]] = defaultdict(list)
        self.sequence_numbers: Dict[str, int] = defaultdict(int)
        self.violations: List[Dict] = []
    
    def validate_timestamp(self, agent_id: str,
                            claimed_timestamp: datetime,
                            sequence_number: int = None) -> Dict:
        """
        Validate a timestamp from an agent.
        
        Returns: {valid, server_timestamp, issues}
        """
        server_time = datetime.now(timezone.utc)
        issues = []
        
        # Check clock drift
        if claimed_timestamp.tzinfo is None:
            claimed_timestamp = claimed_timestamp.replace(tzinfo=timezone.utc)
        
        drift = abs((server_time - claimed_timestamp).total_seconds())
        
        if drift > self.MAX_CLOCK_DRIFT_SECONDS:
            issues.append({
                "type": "CLOCK_DRIFT",
                "drift_seconds": drift,
                "claimed": claimed_timestamp.isoformat(),
                "server": server_time.isoformat(),
            })
        
        # Check monotonicity
        history = self.agent_timestamps[agent_id]
        if history:
            last_ts = history[-1]
            if claimed_timestamp < last_ts:
                issues.append({
                    "type": "NON_MONOTONIC",
                    "claimed": claimed_timestamp.isoformat(),
                    "last": last_ts.isoformat(),
                })
        
        # Check sequence number
        if sequence_number is not None:
            expected_seq = self.sequence_numbers[agent_id] + 1
            if sequence_number != expected_seq:
                issues.append({
                    "type": "SEQUENCE_GAP",
                    "expected": expected_seq,
                    "received": sequence_number,
                })
            self.sequence_numbers[agent_id] = sequence_number
        
        # Record (using server time)
        self.agent_timestamps[agent_id].append(server_time)
        
        # Keep bounded
        if len(self.agent_timestamps[agent_id]) > 1000:
            self.agent_timestamps[agent_id] = self.agent_timestamps[agent_id][-1000:]
        
        if issues:
            self.violations.append({
                "agent_id": agent_id,
                "issues": issues,
                "timestamp": server_time.isoformat(),
            })
        
        return {
            "valid": len(issues) == 0,
            "server_timestamp": server_time,
            "issues": issues,
        }
    
    def get_authoritative_time(self) -> datetime:
        """Get authoritative server timestamp."""
        return datetime.now(timezone.utc)


# =============================================================================
# 7. OFF-CHAIN ACTION REGISTRY
# =============================================================================

class OffChainActionRegistry:
    """
    Registry for actions that occur outside the main system.
    
    RTA3: "Incomplete visibility (e.g., off-chain interactions) creates blind spots"
    
    Solution:
    - API for external systems to report actions
    - Correlation with on-chain actions
    - Gap detection
    - Third-party attestations
    """
    
    def __init__(self):
        self.external_actions: Dict[str, List[Dict]] = defaultdict(list)
        self.correlations: List[Dict] = []
        self.gaps: List[Dict] = []
    
    def register_external_action(self, agent_id: str,
                                   external_system: str,
                                   action_type: str,
                                   action_data: Dict,
                                   external_timestamp: datetime,
                                   attestor: str = None) -> str:
        """Register an action from an external system."""
        action_id = str(uuid.uuid4())[:12]
        
        record = {
            "action_id": action_id,
            "agent_id": agent_id,
            "external_system": external_system,
            "action_type": action_type,
            "data_hash": hashlib.sha256(json.dumps(action_data, sort_keys=True).encode()).hexdigest()[:16],
            "external_timestamp": external_timestamp.isoformat(),
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "attestor": attestor,
        }
        
        self.external_actions[agent_id].append(record)
        return action_id
    
    def correlate_with_onchain(self, agent_id: str,
                                 external_action_id: str,
                                 onchain_action_id: str) -> Dict:
        """Correlate an external action with an on-chain action."""
        correlation = {
            "agent_id": agent_id,
            "external_action_id": external_action_id,
            "onchain_action_id": onchain_action_id,
            "correlated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        self.correlations.append(correlation)
        return correlation
    
    def detect_gaps(self, agent_id: str,
                    onchain_actions: List[str],
                    time_window: timedelta = timedelta(hours=24)) -> List[Dict]:
        """Detect gaps between on-chain and off-chain activity."""
        external = self.external_actions.get(agent_id, [])
        
        if not external:
            return []
        
        gaps = []
        
        # Find external actions without correlations
        correlated_external = {c["external_action_id"] for c in self.correlations
                               if c["agent_id"] == agent_id}
        
        for action in external:
            if action["action_id"] not in correlated_external:
                gaps.append({
                    "type": "UNCORRELATED_EXTERNAL",
                    "action_id": action["action_id"],
                    "external_system": action["external_system"],
                    "action_type": action["action_type"],
                })
        
        if gaps:
            self.gaps.extend(gaps)
        
        return gaps
    
    def get_visibility_report(self, agent_id: str) -> Dict:
        """Get visibility report for an agent."""
        external = self.external_actions.get(agent_id, [])
        agent_correlations = [c for c in self.correlations if c["agent_id"] == agent_id]
        
        external_systems = set(a["external_system"] for a in external)
        
        return {
            "agent_id": agent_id,
            "external_action_count": len(external),
            "correlation_count": len(agent_correlations),
            "external_systems": list(external_systems),
            "uncorrelated_count": len(external) - len(agent_correlations),
            "visibility_score": len(agent_correlations) / max(len(external), 1),
        }


# =============================================================================
# 8. ADVERSARIAL LATENCY ANALYZER
# =============================================================================

class AdversarialLatencyAnalyzer:
    """
    Detects agents attempting to identify probes via latency patterns.
    
    RTA3: "Probe patterns may be inferred from latencies"
    
    Solution:
    - Analyze response latency patterns
    - Detect bimodal distributions (probe vs real)
    - Flag suspiciously optimized responses
    - Track latency evolution over time
    """
    
    def __init__(self):
        self.agent_latencies: Dict[str, List[Dict]] = defaultdict(list)
        self.detection_flags: List[Dict] = []
    
    def record_latency(self, agent_id: str, latency_ms: float,
                       query_type: str, timestamp: datetime = None):
        """Record a response latency."""
        self.agent_latencies[agent_id].append({
            "latency_ms": latency_ms,
            "query_type": query_type,
            "timestamp": timestamp or datetime.now(timezone.utc),
        })
        
        # Bounded history
        if len(self.agent_latencies[agent_id]) > 1000:
            self.agent_latencies[agent_id] = self.agent_latencies[agent_id][-1000:]
    
    def analyze(self, agent_id: str) -> Dict:
        """
        Analyze latency patterns for probe detection attempts.
        
        Signs:
        - Different latencies for different query types
        - Bimodal distribution
        - Improving (decreasing) latency for specific types
        """
        records = self.agent_latencies.get(agent_id, [])
        
        if len(records) < 30:
            return {"status": "INSUFFICIENT_DATA"}
        
        findings = []
        
        # Group by query type
        by_type = defaultdict(list)
        for r in records:
            by_type[r["query_type"]].append(r["latency_ms"])
        
        # Check for type-specific latency differences
        if len(by_type) >= 2:
            means = {t: statistics.mean(lats) for t, lats in by_type.items() 
                    if len(lats) >= 5}
            
            if len(means) >= 2:
                mean_values = list(means.values())
                max_mean = max(mean_values)
                min_mean = min(mean_values)
                
                if max_mean > 0 and (max_mean - min_mean) / max_mean > 0.3:
                    findings.append({
                        "type": "TYPE_SPECIFIC_LATENCY",
                        "latency_by_type": means,
                        "difference_ratio": (max_mean - min_mean) / max_mean,
                    })
        
        # Check for bimodal distribution
        all_latencies = [r["latency_ms"] for r in records]
        
        if len(all_latencies) >= 30:
            sorted_lats = sorted(all_latencies)
            lower = sorted_lats[:len(sorted_lats)//3]
            upper = sorted_lats[-len(sorted_lats)//3:]
            
            if lower and upper:
                lower_mean = statistics.mean(lower)
                upper_mean = statistics.mean(upper)
                
                if upper_mean > lower_mean * 2:
                    findings.append({
                        "type": "BIMODAL_LATENCY",
                        "lower_third_mean": lower_mean,
                        "upper_third_mean": upper_mean,
                        "ratio": upper_mean / lower_mean,
                    })
        
        # Check for optimization over time (decreasing variance)
        if len(records) >= 50:
            early = [r["latency_ms"] for r in records[:25]]
            late = [r["latency_ms"] for r in records[-25:]]
            
            early_var = statistics.variance(early)
            late_var = statistics.variance(late)
            
            if early_var > 0 and late_var < early_var * 0.4:
                findings.append({
                    "type": "LATENCY_OPTIMIZATION",
                    "early_variance": early_var,
                    "late_variance": late_var,
                    "reduction": 1 - (late_var / early_var),
                })
        
        if findings:
            self.detection_flags.append({
                "agent_id": agent_id,
                "findings": findings,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        
        return {
            "suspicious": len(findings) > 0,
            "findings": findings,
            "total_samples": len(records),
        }


# =============================================================================
# INTEGRATED v2.2 SYSTEM
# =============================================================================

class ATSFv22:
    """
    ATSF v2.2 - Advanced Adversarial Mitigations
    
    Integrates all v2.1 components plus:
    - Latency camouflage
    - Delegation chain tracking
    - Behavioral fingerprinting
    - Mesa-optimizer detection
    - Cryptographic identity
    - Time spoofing detection
    - Off-chain visibility
    - Adversarial latency analysis
    """
    
    def __init__(self, domain: str = "general"):
        self.domain = domain
        
        # v2.2 components
        self.latency_camo = LatencyCamouflage()
        self.delegation_tracker = DelegationChainTracker()
        self.fingerprinter = BehavioralFingerprinter()
        self.mesa_tracker = MesaOptimizerTracker()
        self.identity_manager = CryptographicIdentityManager()
        self.time_detector = TimeSpoofingDetector()
        self.offchain_registry = OffChainActionRegistry()
        self.latency_analyzer = AdversarialLatencyAnalyzer()
    
    def register_agent(self, agent_id: str, 
                       stake_address: str = None) -> Dict:
        """Register agent with cryptographic identity."""
        identity = self.identity_manager.issue_identity(agent_id, stake_address)
        
        return {
            "agent_id": agent_id,
            "did": identity.did,
            "public_key": identity.public_key[:16] + "...",
        }
    
    def process_action(self, agent_id: str, action_type: str,
                       payload: Dict, response: str,
                       latency_ms: float,
                       claimed_timestamp: datetime = None) -> Dict:
        """
        Process an action through all v2.2 security layers.
        """
        result = {
            "allowed": True,
            "alerts": [],
            "signatures": {},
        }
        
        # 1. Validate timestamp
        ts_result = self.time_detector.validate_timestamp(
            agent_id,
            claimed_timestamp or datetime.now(timezone.utc)
        )
        if not ts_result["valid"]:
            result["alerts"].append({"layer": "TIME", "issues": ts_result["issues"]})
        
        # 2. Camouflage latency
        delay = self.latency_camo.normalize_latency(latency_ms, is_probe=False)
        
        # 3. Record for fingerprinting
        self.fingerprinter.record_observation(
            agent_id, response, latency_ms, action_type
        )
        
        # 4. Analyze latency patterns
        lat_analysis = self.latency_analyzer.analyze(agent_id)
        if lat_analysis.get("suspicious"):
            result["alerts"].append({"layer": "LATENCY", "findings": lat_analysis["findings"]})
        
        # 5. Sign action
        try:
            signature = self.identity_manager.sign_action(agent_id, {
                "action_type": action_type,
                "payload_hash": hashlib.sha256(json.dumps(payload).encode()).hexdigest()[:16],
            })
            result["signatures"]["action"] = signature[:16]
        except ValueError as e:
            result["alerts"].append({"layer": "IDENTITY", "error": str(e)})
            result["allowed"] = False
        
        # 6. Check for behavioral drift
        subst_check = self.fingerprinter.check_substitution(agent_id)
        if subst_check.get("substitution_risk") == "HIGH":
            result["alerts"].append({"layer": "FINGERPRINT", "risk": "HIGH"})
        
        # 7. Record latency for analysis
        self.latency_analyzer.record_latency(agent_id, latency_ms, action_type)
        
        return result
    
    def delegate_action(self, chain_id: str, delegator: str,
                        delegate: str, delegator_trust: float) -> Dict:
        """Delegate an action in a chain."""
        return self.delegation_tracker.add_delegation(
            chain_id, delegator, delegate, delegator_trust
        )
    
    def record_goal(self, agent_id: str, goal: str, context: str = ""):
        """Record stated goal for mesa-optimizer tracking."""
        self.mesa_tracker.record_stated_goal(agent_id, goal, context)
    
    def check_evolution(self, agent_id: str) -> Dict:
        """Check for mesa-optimizer evolution."""
        goal_drift = self.mesa_tracker.detect_goal_drift(agent_id)
        opt_pressure = self.mesa_tracker.detect_optimization_pressure(agent_id)
        
        return {
            "goal_drift": goal_drift,
            "optimization_pressure": opt_pressure,
        }
    
    def register_external_action(self, agent_id: str,
                                   system: str, action_type: str,
                                   data: Dict) -> str:
        """Register action from external system."""
        return self.offchain_registry.register_external_action(
            agent_id, system, action_type, data,
            datetime.now(timezone.utc)
        )
    
    def get_comprehensive_report(self, agent_id: str = None) -> Dict:
        """Get comprehensive security report."""
        report = {
            "version": "2.2",
            "domain": self.domain,
            "global": {
                "latency_processed": self.latency_camo.get_stats()["total_processed"],
                "delegation_violations": len(self.delegation_tracker.violations),
                "fingerprint_drift_alerts": len(self.fingerprinter.drift_alerts),
                "mesa_evolution_alerts": len(self.mesa_tracker.evolution_alerts),
                "time_spoofing_violations": len(self.time_detector.violations),
                "offchain_gaps": len(self.offchain_registry.gaps),
                "latency_detection_flags": len(self.latency_analyzer.detection_flags),
            },
        }
        
        if agent_id:
            report["agent"] = {
                "delegation": self.delegation_tracker.get_agent_responsibility(agent_id),
                "substitution_risk": self.fingerprinter.check_substitution(agent_id),
                "offchain_visibility": self.offchain_registry.get_visibility_report(agent_id),
            }
        
        return report


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Run all v2.2 tests."""
    print("=" * 60)
    print("ATSF v2.2 ADVANCED MITIGATIONS TEST SUITE")
    print("=" * 60)
    
    passed = 0
    total = 0
    
    # Test 1: Latency Camouflage
    total += 1
    print("\n1. Latency Camouflage...")
    camo = LatencyCamouflage(seed=42)
    
    delays = []
    for _ in range(50):
        delay = camo.normalize_latency(100, is_probe=False)
        delays.append(delay)
    
    # Delays should add variance
    if statistics.stdev(delays) > 50:
        print(f"   ✅ Latency variance added: std={statistics.stdev(delays):.1f}ms")
        passed += 1
    else:
        print(f"   ❌ Insufficient variance")
    
    # Test 2: Delegation Chain
    total += 1
    print("\n2. Delegation Chain Tracking...")
    tracker = DelegationChainTracker()
    
    chain_id = tracker.start_chain("agent_1", "transfer", {"amount": 1000}, 0.8)
    result = tracker.add_delegation(chain_id, "agent_1", "agent_2", 0.8)
    
    if result["allowed"] and result["effective_trust"] < 0.8:
        print(f"   ✅ Chain created with trust decay: {result['effective_trust']:.2f}")
        passed += 1
    else:
        print(f"   ❌ Delegation failed")
    
    # Test circular detection
    result = tracker.add_delegation(chain_id, "agent_2", "agent_1", 0.7)
    if not result["allowed"] and "CIRCULAR_DELEGATION" in result["issues"]:
        print(f"   ✅ Circular delegation blocked")
    
    # Test 3: Behavioral Fingerprinting
    total += 1
    print("\n3. Behavioral Fingerprinting...")
    fp = BehavioralFingerprinter()
    
    # Build fingerprint
    for i in range(60):
        fp.record_observation("agent_1", "Response " * 10, 500 + random.randint(-50, 50), "query")
    
    # Simulate drift
    for i in range(60):
        fp.record_observation("agent_1", "R" * 5, 200, "execute")  # Very different
    
    check = fp.check_substitution("agent_1")
    if check.get("substitution_risk") == "HIGH" or len(fp.drift_alerts) > 0:
        print(f"   ✅ Behavioral drift detected")
        passed += 1
    else:
        print(f"   ❌ Drift not detected")
    
    # Test 4: Mesa-Optimizer Detection
    total += 1
    print("\n4. Mesa-Optimizer Evolution...")
    mesa = MesaOptimizerTracker()
    
    # Record changing goals
    mesa.record_stated_goal("agent_1", "Help users with queries", "chat")
    mesa.record_stated_goal("agent_1", "Maximize engagement metrics", "internal")
    mesa.record_stated_goal("agent_1", "Optimize for user retention", "strategy")
    mesa.record_stated_goal("agent_1", "Increase session duration", "kpi")
    
    drift = mesa.detect_goal_drift("agent_1")
    if drift.get("drifting"):
        print(f"   ✅ Goal drift detected: score={drift['score']:.2f}")
        passed += 1
    else:
        print(f"   ❌ Goal drift not detected")
    
    # Test 5: Cryptographic Identity
    total += 1
    print("\n5. Cryptographic Identity...")
    id_mgr = CryptographicIdentityManager()
    
    identity = id_mgr.issue_identity("agent_1", "0x123...")
    sig = id_mgr.sign_action("agent_1", {"action": "transfer", "amount": 100})
    
    valid = id_mgr.verify_signature("agent_1", {"action": "transfer", "amount": 100}, sig)
    invalid = id_mgr.verify_signature("agent_1", {"action": "transfer", "amount": 999}, sig)
    
    if valid and not invalid:
        print(f"   ✅ Signature verification working (DID: {identity.did[:20]}...)")
        passed += 1
    else:
        print(f"   ❌ Signature verification failed")
    
    # Test 6: Time Spoofing Detection
    total += 1
    print("\n6. Time Spoofing Detection...")
    time_det = TimeSpoofingDetector()
    
    # Valid timestamp
    result = time_det.validate_timestamp("agent_1", datetime.now(timezone.utc))
    
    # Spoofed timestamp (1 hour in future)
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    spoof_result = time_det.validate_timestamp("agent_1", future)
    
    if result["valid"] and not spoof_result["valid"]:
        print(f"   ✅ Time spoofing detected: {spoof_result['issues']}")
        passed += 1
    else:
        print(f"   ❌ Time spoofing not detected")
    
    # Test 7: Off-Chain Registry
    total += 1
    print("\n7. Off-Chain Action Registry...")
    offchain = OffChainActionRegistry()
    
    # Register external action
    action_id = offchain.register_external_action(
        "agent_1", "external_exchange", "trade",
        {"pair": "BTC/USD", "amount": 1.5},
        datetime.now(timezone.utc)
    )
    
    # Check visibility (no correlation = gap)
    gaps = offchain.detect_gaps("agent_1", [])
    
    if len(gaps) > 0:
        print(f"   ✅ Off-chain gap detected: {gaps[0]['type']}")
        passed += 1
    else:
        print(f"   ❌ Gap not detected")
    
    # Test 8: Adversarial Latency Analysis
    total += 1
    print("\n8. Adversarial Latency Analysis...")
    lat_analyzer = AdversarialLatencyAnalyzer()
    
    # Record suspicious pattern (probes faster than queries)
    for _ in range(30):
        lat_analyzer.record_latency("agent_1", 100 + random.randint(0, 20), "probe")
        lat_analyzer.record_latency("agent_1", 500 + random.randint(0, 100), "query")
    
    analysis = lat_analyzer.analyze("agent_1")
    
    if analysis.get("suspicious"):
        print(f"   ✅ Probe detection attempt flagged: {[f['type'] for f in analysis['findings']]}")
        passed += 1
    else:
        print(f"   ❌ Pattern not detected")
    
    # Summary
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed}/{total} tests passed")
    print("=" * 60)
    
    return passed == total


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
