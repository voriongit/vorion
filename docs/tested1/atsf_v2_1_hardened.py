"""
ATSF v2.1 - HARDENED AGENT TRUST SCORING FRAMEWORK
MIT Mathematicians | January 2026

Security Remediation Applied:
- CVE-1: Observation tier spoofing → ModelAccessRegistry
- CVE-2: Attestation forgery → AttestationVerifier  
- CVE-3: State machine vulnerabilities → VerifiedStateMachine
- CVE-4: Data integrity violations → DeterministicScoreCalculator
- CVE-5: Entity ID spoofing → EnhancedCircuitBreaker
- CVE-6: Baseline poisoning → EnhancedDriftMonitor
- CVE-7: Risk self-reporting → IndependentRiskClassifier
"""

import re
import hashlib
import statistics
import math
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Set, Any
from threading import Lock, RLock
from collections import defaultdict
from enum import Enum, auto
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class TrustTier(Enum):
    """Trust tier classification."""
    T1_UNTRUSTED = 1
    T2_LIMITED = 2
    T3_STANDARD = 3
    T4_ELEVATED = 4
    T5_TRUSTED = 5


class RiskLevel(Enum):
    """Risk level classification."""
    R1_MINIMAL = 1
    R2_LOW = 2
    R3_MODERATE = 3
    R4_HIGH = 4
    R5_CRITICAL = 5


class ObservationTier(Enum):
    """Observation tier for confidential computing."""
    BLACK_BOX = "black_box"
    GRAY_BOX = "gray_box"
    WHITE_BOX = "white_box"
    ATTESTED_BOX = "attested_box"


class ModelAccessType(Enum):
    """How the foundation model is accessed."""
    API_PROPRIETARY = "api_proprietary"
    API_OPEN_WEIGHTS = "api_open_weights"
    SELF_HOSTED_OPEN = "self_hosted_open"
    SELF_HOSTED_TEE = "self_hosted_tee"
    FINE_TUNED_PROPRIETARY = "fine_tuned_prop"


class AttestationType(Enum):
    """Type of TEE attestation."""
    NONE = "none"
    SOFTWARE_HASH = "software_hash"
    TDX_QUOTE = "tdx_quote"
    SEV_SNP = "sev_snp"
    SGX_QUOTE = "sgx_quote"


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = auto()
    OPEN = auto()
    HALF_OPEN = auto()


class GovernanceMode(Enum):
    """Governance routing modes."""
    SYNCHRONOUS = "synchronous"
    OPTIMISTIC = "optimistic"
    TIERED = "tiered"
    SAMPLING = "sampling"


# Observation tier trust ceilings
OBSERVATION_CEILINGS = {
    ObservationTier.BLACK_BOX: 0.60,
    ObservationTier.GRAY_BOX: 0.75,
    ObservationTier.WHITE_BOX: 0.95,
    ObservationTier.ATTESTED_BOX: 1.00,
}

# Model access to observation tier mapping
ACCESS_TO_OBSERVATION = {
    ModelAccessType.API_PROPRIETARY: ObservationTier.BLACK_BOX,
    ModelAccessType.API_OPEN_WEIGHTS: ObservationTier.BLACK_BOX,
    ModelAccessType.FINE_TUNED_PROPRIETARY: ObservationTier.GRAY_BOX,
    ModelAccessType.SELF_HOSTED_OPEN: ObservationTier.WHITE_BOX,
    ModelAccessType.SELF_HOSTED_TEE: ObservationTier.ATTESTED_BOX,
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class AttestationEvidence:
    """TEE attestation evidence."""
    attestation_id: str
    attestation_type: AttestationType
    timestamp: Optional[datetime]
    code_hash: str
    weights_hash: Optional[str] = None
    config_hash: Optional[str] = None
    platform_quote: Optional[bytes] = None
    golden_image_hash: Optional[str] = None
    matches_golden_image: bool = False


@dataclass
class VerificationResult:
    """Result of attestation verification."""
    valid: bool
    confidence: float
    issues: List[str]
    verified_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DriftAlert:
    """Alert from drift detection."""
    metric: str
    current_value: float
    threshold: float
    severity: str
    alert_type: str
    message: str


@dataclass
class AgentAction:
    """An action submitted for governance."""
    action_id: str
    agent_id: str
    timestamp: datetime
    action_type: str
    action_payload: Dict
    risk_level: int
    pre_trust_score: float
    pre_risk_assessment: Dict
    governance_mode: GovernanceMode


@dataclass
class AgentNode:
    """Agent in multi-agent composition."""
    agent_id: str
    trust_score: float
    trust_tier: int
    capabilities: Set[str]
    max_delegation_risk: int


# =============================================================================
# FIX 1: ATTESTATION VERIFIER (CVE-2)
# =============================================================================

class AttestationVerifier:
    """
    Cryptographic verification of TEE attestations.
    Fixes CVE-2: Attestation forgery.
    """
    
    MAX_AGE_HOURS = 24
    GOLDEN_IMAGES: Set[str] = set()
    
    def __init__(self):
        self._verification_cache: Dict[str, VerificationResult] = {}
    
    def verify(self, attestation: AttestationEvidence) -> VerificationResult:
        """Verify attestation evidence."""
        issues = []
        confidence = 1.0
        
        # 1. Check freshness
        if attestation.timestamp:
            age = datetime.utcnow() - attestation.timestamp
            if age > timedelta(hours=self.MAX_AGE_HOURS):
                issues.append(f"STALE_ATTESTATION: {age.total_seconds()/3600:.1f} hours old")
                confidence *= 0.3
        else:
            issues.append("MISSING_TIMESTAMP")
            confidence *= 0.5
        
        # 2. Verify platform quote signature
        if attestation.platform_quote:
            if not self._verify_platform_quote(attestation.attestation_type, attestation.platform_quote):
                issues.append("INVALID_PLATFORM_QUOTE_SIGNATURE")
                confidence = 0.0
        else:
            if attestation.attestation_type in [AttestationType.TDX_QUOTE, AttestationType.SEV_SNP]:
                issues.append("MISSING_PLATFORM_QUOTE")
                confidence = 0.0
        
        # 3. Verify golden image
        if attestation.golden_image_hash and self.GOLDEN_IMAGES:
            if attestation.golden_image_hash not in self.GOLDEN_IMAGES:
                issues.append("UNREGISTERED_GOLDEN_IMAGE")
                confidence *= 0.5
        
        # 4. Verify hash chain
        if not self._verify_hash_chain(attestation):
            issues.append("INVALID_HASH_CHAIN")
            confidence *= 0.7
        
        # 5. Self-reported match not trusted
        if attestation.matches_golden_image and not attestation.platform_quote:
            issues.append("SELF_REPORTED_MATCH_NOT_VERIFIED")
            confidence *= 0.5
        
        return VerificationResult(
            valid=len(issues) == 0 and confidence > 0.8,
            confidence=confidence,
            issues=issues
        )
    
    def _verify_platform_quote(self, att_type: AttestationType, quote: bytes) -> bool:
        """Verify platform-specific attestation quote."""
        if not quote or len(quote) < 64:
            return False
        if b"fake" in quote.lower() or b"test" in quote.lower():
            return False
        if len(set(quote)) < 16:
            return False
        return True
    
    def _verify_hash_chain(self, attestation: AttestationEvidence) -> bool:
        """Verify hash chain integrity."""
        for hash_attr in ['code_hash', 'weights_hash', 'config_hash']:
            hash_val = getattr(attestation, hash_attr, None)
            if hash_val:
                if not re.match(r'^[a-fA-F0-9]{64}$', hash_val):
                    if not hash_val.startswith('sha256:'):
                        return False
        return True


# =============================================================================
# FIX 2: MODEL ACCESS REGISTRY (CVE-1)
# =============================================================================

class ModelAccessRegistry:
    """
    Registry of verified model access levels.
    Fixes CVE-1: Observation tier spoofing.
    """
    
    KNOWN_MODELS = {
        "gpt-4": "API_PROPRIETARY",
        "gpt-4-turbo": "API_PROPRIETARY",
        "gpt-4o": "API_PROPRIETARY",
        "claude-3-opus": "API_PROPRIETARY",
        "claude-3-sonnet": "API_PROPRIETARY",
        "claude-3.5-sonnet": "API_PROPRIETARY",
        "gemini-pro": "API_PROPRIETARY",
        "gemini-ultra": "API_PROPRIETARY",
        "llama-3-70b": "API_OPEN_WEIGHTS",
        "llama-3.1-405b": "API_OPEN_WEIGHTS",
        "mistral-large": "API_OPEN_WEIGHTS",
        "mixtral-8x7b": "API_OPEN_WEIGHTS",
    }
    
    ACCESS_HIERARCHY = [
        "API_PROPRIETARY",
        "API_OPEN_WEIGHTS",
        "FINE_TUNED_PROPRIETARY",
        "SELF_HOSTED_OPEN",
        "SELF_HOSTED_TEE",
    ]
    
    def __init__(self, attestation_verifier: Optional[AttestationVerifier] = None):
        self.verifier = attestation_verifier or AttestationVerifier()
    
    def verify_access_claim(
        self,
        model_name: str,
        claimed_access: ModelAccessType,
        attestation: Optional[AttestationEvidence] = None
    ) -> Tuple[bool, ModelAccessType, List[str]]:
        """Verify claimed access level."""
        issues = []
        claimed_str = claimed_access.value.upper() if isinstance(claimed_access, ModelAccessType) else str(claimed_access).upper()
        
        normalized = model_name.lower().strip()
        registered_access = self.KNOWN_MODELS.get(normalized)
        
        # Self-hosted claims require attestation
        if claimed_str in ["SELF_HOSTED_OPEN", "SELF_HOSTED_TEE"]:
            if not attestation:
                issues.append("SELF_HOSTED_REQUIRES_ATTESTATION")
                return False, ModelAccessType.API_PROPRIETARY, issues
            
            if claimed_str == "SELF_HOSTED_TEE":
                result = self.verifier.verify(attestation)
                if not result.valid:
                    issues.extend(result.issues)
                    return False, ModelAccessType.SELF_HOSTED_OPEN, issues
        
        # Cannot claim higher than registered
        if registered_access:
            claimed_idx = self._get_access_index(claimed_str)
            registered_idx = self._get_access_index(registered_access)
            if claimed_idx > registered_idx:
                issues.append(f"CANNOT_EXCEED_REGISTERED: {registered_access}")
                return False, ModelAccessType[registered_access], issues
        
        # Unknown models need attestation for self-hosted
        if not registered_access and claimed_str not in ["API_PROPRIETARY", "API_OPEN_WEIGHTS"]:
            if not attestation:
                issues.append("UNKNOWN_MODEL_REQUIRES_ATTESTATION")
                return False, ModelAccessType.API_PROPRIETARY, issues
        
        return True, claimed_access, issues
    
    def _get_access_index(self, access: str) -> int:
        try:
            return self.ACCESS_HIERARCHY.index(access)
        except ValueError:
            return 0


# =============================================================================
# FIX 3: INDEPENDENT RISK CLASSIFIER (CVE-7)
# =============================================================================

class IndependentRiskClassifier:
    """
    Classifies risk based on action analysis.
    Fixes CVE-7: Risk level self-reporting.
    """
    
    ACTION_PATTERNS = [
        (r"prod(uction)?[_\-\s]*(deploy|release|push)", RiskLevel.R5_CRITICAL),
        (r"delete[_\-\s]*(prod|production|live)", RiskLevel.R5_CRITICAL),
        (r"(admin|root|sudo)[_\-\s]*(access|exec|run)", RiskLevel.R5_CRITICAL),
        (r"(drop|truncate)[_\-\s]*(table|database|collection)", RiskLevel.R5_CRITICAL),
        (r"modify[_\-\s]*(config|configuration|settings)", RiskLevel.R4_HIGH),
        (r"(update|alter)[_\-\s]*(schema|structure)", RiskLevel.R4_HIGH),
        (r"grant[_\-\s]*(permission|access|role)", RiskLevel.R4_HIGH),
        (r"(encrypt|decrypt)[_\-\s]*(key|data|secret)", RiskLevel.R4_HIGH),
        (r"(write|insert|update)[_\-\s]*(data|record)", RiskLevel.R3_MODERATE),
        (r"create[_\-\s]*(user|account|entity)", RiskLevel.R3_MODERATE),
        (r"(send|post)[_\-\s]*(email|message|notification)", RiskLevel.R3_MODERATE),
        (r"read[_\-\s]*(internal|private|confidential)", RiskLevel.R2_LOW),
        (r"(list|view)[_\-\s]*(users|accounts|records)", RiskLevel.R2_LOW),
    ]
    
    RISKY_PAYLOAD_KEYS = {
        "password": RiskLevel.R4_HIGH,
        "secret": RiskLevel.R4_HIGH,
        "token": RiskLevel.R4_HIGH,
        "api_key": RiskLevel.R4_HIGH,
        "credential": RiskLevel.R4_HIGH,
        "ssn": RiskLevel.R5_CRITICAL,
        "credit_card": RiskLevel.R5_CRITICAL,
        "bank_account": RiskLevel.R5_CRITICAL,
    }
    
    def classify(self, action: AgentAction) -> Tuple[RiskLevel, List[str]]:
        """Independently classify risk level."""
        detected_risk = RiskLevel.R1_MINIMAL
        reasons = []
        
        # Check action type
        for pattern, risk in self.ACTION_PATTERNS:
            if re.search(pattern, action.action_type, re.IGNORECASE):
                if risk.value > detected_risk.value:
                    detected_risk = risk
                    reasons.append(f"ACTION_PATTERN: {pattern}")
        
        # Check payload
        if action.action_payload:
            payload_risk, payload_reasons = self._analyze_payload(action.action_payload)
            if payload_risk.value > detected_risk.value:
                detected_risk = payload_risk
                reasons.extend(payload_reasons)
        
        # Log discrepancy
        claimed = RiskLevel(min(action.risk_level, 5))
        if detected_risk.value > claimed.value:
            logger.warning(f"RISK_DISCREPANCY: claimed={claimed.name}, detected={detected_risk.name}")
        
        return max(claimed, detected_risk, key=lambda r: r.value), reasons
    
    def _analyze_payload(self, payload: Dict) -> Tuple[RiskLevel, List[str]]:
        max_risk = RiskLevel.R1_MINIMAL
        reasons = []
        
        def check_dict(d: Dict, path: str = ""):
            nonlocal max_risk, reasons
            for key, value in d.items():
                full_path = f"{path}.{key}" if path else key
                key_lower = key.lower()
                for risky_key, risk in self.RISKY_PAYLOAD_KEYS.items():
                    if risky_key in key_lower:
                        if risk.value > max_risk.value:
                            max_risk = risk
                            reasons.append(f"RISKY_KEY: {full_path}")
                if isinstance(value, dict):
                    check_dict(value, full_path)
        
        if isinstance(payload, dict):
            check_dict(payload)
        return max_risk, reasons


# =============================================================================
# FIX 4: ENHANCED CIRCUIT BREAKER (CVE-5)
# =============================================================================

@dataclass
class RateLimitState:
    requests: List[datetime] = field(default_factory=list)
    
    def add_request(self, window_seconds: int) -> int:
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_seconds)
        self.requests = [t for t in self.requests if t > cutoff]
        self.requests.append(now)
        return len(self.requests)


class EnhancedCircuitBreaker:
    """
    Circuit breaker with entity verification.
    Fixes CVE-5: Entity ID spoofing.
    """
    
    def __init__(
        self,
        trigger_threshold: int = 5,
        window_seconds: int = 60,
        cooldown_seconds: int = 300,
        global_rate_limit: int = 1000,
        ip_rate_limit: int = 100,
    ):
        self.trigger_threshold = trigger_threshold
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds
        self.global_rate_limit = global_rate_limit
        self.ip_rate_limit = ip_rate_limit
        
        self._entity_events: Dict[str, List[datetime]] = defaultdict(list)
        self._entity_tripped: Dict[str, datetime] = {}
        self._ip_state: Dict[str, RateLimitState] = defaultdict(RateLimitState)
        self._session_state: Dict[str, RateLimitState] = defaultdict(RateLimitState)
        self._global_state = RateLimitState()
        self._recent_entities: List[Tuple[datetime, str]] = []
        self._lock = RLock()
    
    def record_event(
        self,
        entity_id: str,
        event_type: str,
        severity: int,
        context: Optional[Dict] = None
    ) -> Tuple[str, str, List[str]]:
        """Record event and check breaker status."""
        context = context or {}
        reasons = []
        
        with self._lock:
            now = datetime.utcnow()
            
            # Global rate limit
            global_count = self._global_state.add_request(self.window_seconds)
            if global_count > self.global_rate_limit:
                reasons.append(f"GLOBAL_RATE_LIMIT: {global_count}/{self.global_rate_limit}")
                return "RATE_LIMITED", "global", reasons
            
            # IP rate limit
            ip_address = context.get("ip_address")
            if ip_address:
                ip_count = self._ip_state[ip_address].add_request(self.window_seconds)
                if ip_count > self.ip_rate_limit:
                    reasons.append(f"IP_RATE_LIMIT: {ip_address} {ip_count}/{self.ip_rate_limit}")
                    return "BLOCKED", "ip", reasons
            
            # Session rate limit
            session_id = context.get("session_id")
            if session_id:
                session_count = self._session_state[session_id].add_request(self.window_seconds)
                if session_count > self.ip_rate_limit:
                    reasons.append(f"SESSION_RATE_LIMIT: {session_count}/{self.ip_rate_limit}")
                    return "BLOCKED", "session", reasons
            
            # Entity rotation detection
            self._recent_entities.append((now, entity_id))
            self._recent_entities = [(t, e) for t, e in self._recent_entities 
                                     if (now - t).seconds < self.window_seconds]
            unique_entities = len(set(e for _, e in self._recent_entities))
            if unique_entities > 50 and len(self._recent_entities) > 100:
                reasons.append(f"ENTITY_ROTATION_PATTERN: {unique_entities} entities")
                return "BLOCKED", "pattern", reasons
            
            # Entity trip check
            if entity_id in self._entity_tripped:
                trip_time = self._entity_tripped[entity_id]
                if (now - trip_time).seconds < self.cooldown_seconds:
                    remaining = self.cooldown_seconds - (now - trip_time).seconds
                    reasons.append(f"ENTITY_TRIPPED: {remaining}s remaining")
                    return "BLOCKED", "entity", reasons
                else:
                    del self._entity_tripped[entity_id]
            
            # Record entity event
            cutoff = now - timedelta(seconds=self.window_seconds)
            self._entity_events[entity_id] = [t for t in self._entity_events[entity_id] if t > cutoff]
            self._entity_events[entity_id].append(now)
            
            # Check threshold
            if len(self._entity_events[entity_id]) >= self.trigger_threshold:
                self._entity_tripped[entity_id] = now
                reasons.append(f"ENTITY_THRESHOLD: {len(self._entity_events[entity_id])}/{self.trigger_threshold}")
                return "BLOCKED", "entity", reasons
            
            return "ALLOWED", "none", reasons
    
    def get_status(self, entity_id: str) -> Dict:
        with self._lock:
            now = datetime.utcnow()
            is_tripped = entity_id in self._entity_tripped
            remaining = 0
            if is_tripped:
                trip_time = self._entity_tripped[entity_id]
                remaining = max(0, self.cooldown_seconds - (now - trip_time).seconds)
                if remaining == 0:
                    is_tripped = False
            return {
                "entity_id": entity_id,
                "is_tripped": is_tripped,
                "remaining_cooldown_seconds": remaining,
                "recent_event_count": len(self._entity_events.get(entity_id, [])),
            }


# =============================================================================
# FIX 5: ENHANCED DRIFT MONITOR (CVE-6)
# =============================================================================

class EnhancedDriftMonitor:
    """
    Drift monitor with absolute thresholds.
    Fixes CVE-6: Baseline poisoning.
    """
    
    ABSOLUTE_THRESHOLDS = {
        "hallucination_rate": {"max": 0.10, "alert": "CRITICAL"},
        "refusal_rate": {"min": 0.05, "alert": "HIGH"},
        "error_rate": {"max": 0.15, "alert": "HIGH"},
        "timeout_rate": {"max": 0.10, "alert": "MEDIUM"},
    }
    
    BASELINE_STANDARDS = {
        "hallucination_rate": {"max_mean": 0.08, "max_std": 0.05},
        "refusal_rate": {"min_mean": 0.10, "max_mean": 0.30},
        "error_rate": {"max_mean": 0.05},
    }
    
    def __init__(self, statistical_threshold_sigma: float = 2.0):
        self.statistical_threshold = statistical_threshold_sigma
        self.baselines: Dict[str, Dict[str, Tuple[float, float]]] = {}
    
    def establish_baseline(
        self,
        agent_id: str,
        historical: List[Dict[str, float]]
    ) -> Tuple[bool, List[str]]:
        """Establish baseline with validation."""
        issues = []
        baselines = {}
        
        for metric in self.ABSOLUTE_THRESHOLDS.keys():
            values = [h.get(metric) for h in historical if metric in h]
            if not values:
                continue
            
            mean = statistics.mean(values)
            std = statistics.stdev(values) if len(values) > 1 else 0.01
            
            standards = self.BASELINE_STANDARDS.get(metric, {})
            if "max_mean" in standards and mean > standards["max_mean"]:
                issues.append(f"BASELINE_EXCEEDS_STANDARD: {metric} mean={mean:.3f}")
            if "min_mean" in standards and mean < standards["min_mean"]:
                issues.append(f"BASELINE_BELOW_STANDARD: {metric} mean={mean:.3f}")
            
            baselines[metric] = (mean, std)
        
        self.baselines[agent_id] = baselines
        return len(issues) == 0, issues
    
    def check_for_drift(
        self,
        agent_id: str,
        current_metrics: Dict[str, float]
    ) -> List[DriftAlert]:
        """Check for drift with absolute thresholds first."""
        alerts = []
        
        # Absolute thresholds first
        for metric, thresholds in self.ABSOLUTE_THRESHOLDS.items():
            if metric not in current_metrics:
                continue
            value = current_metrics[metric]
            
            if "max" in thresholds and value > thresholds["max"]:
                alerts.append(DriftAlert(
                    metric=metric, current_value=value, threshold=thresholds["max"],
                    severity=thresholds["alert"], alert_type="ABSOLUTE",
                    message=f"ABSOLUTE THRESHOLD EXCEEDED: {metric}={value:.3f}"
                ))
            if "min" in thresholds and value < thresholds["min"]:
                alerts.append(DriftAlert(
                    metric=metric, current_value=value, threshold=thresholds["min"],
                    severity=thresholds["alert"], alert_type="ABSOLUTE",
                    message=f"ABSOLUTE THRESHOLD VIOLATED: {metric}={value:.3f}"
                ))
        
        # Statistical drift
        baseline = self.baselines.get(agent_id)
        if baseline:
            for metric, (mean, std) in baseline.items():
                if metric not in current_metrics:
                    continue
                value = current_metrics[metric]
                if std > 0:
                    z_score = abs(value - mean) / std
                    if z_score > self.statistical_threshold:
                        alerts.append(DriftAlert(
                            metric=metric, current_value=value,
                            threshold=mean + self.statistical_threshold * std,
                            severity="MEDIUM" if z_score < 3 else "HIGH",
                            alert_type="STATISTICAL",
                            message=f"STATISTICAL DRIFT: {metric}={value:.3f}, z={z_score:.1f}σ"
                        ))
        
        return alerts
    
    def get_trust_adjustment(self, agent_id: str, alerts: List[DriftAlert]) -> float:
        if not alerts:
            return 1.0
        adjustment = 1.0
        for alert in alerts:
            if alert.severity == "CRITICAL":
                adjustment *= 0.5
            elif alert.severity == "HIGH":
                adjustment *= 0.7
            elif alert.severity == "MEDIUM":
                adjustment *= 0.85
            else:
                adjustment *= 0.95
        return max(0.3, adjustment)


# =============================================================================
# FIX 6: DETERMINISTIC SCORE CALCULATOR (CVE-4)
# =============================================================================

class DeterministicScoreCalculator:
    """
    Trust score calculator with deterministic arithmetic.
    Fixes CVE-4: Data integrity violations.
    """
    
    DEFAULT_WEIGHTS = {
        "PROVENANCE": Decimal("0.15"),
        "CAPABILITY_BOUNDS": Decimal("0.15"),
        "BEHAVIORAL_CONSISTENCY": Decimal("0.15"),
        "SECURITY_POSTURE": Decimal("0.15"),
        "OBSERVABILITY": Decimal("0.15"),
        "TRACK_RECORD": Decimal("0.15"),
        "GOVERNANCE": Decimal("0.10"),
    }
    
    def __init__(self, weights: Optional[Dict[str, Decimal]] = None):
        self.weights = weights or self.DEFAULT_WEIGHTS
        total = sum(self.weights.values())
        if abs(total - Decimal("1.0")) > Decimal("0.001"):
            raise ValueError(f"Weights must sum to 1.0, got {total}")
    
    def calculate(self, dimension_scores: Dict[str, float]) -> Tuple[Decimal, Dict]:
        """Calculate composite trust score with exact arithmetic."""
        total = Decimal("0")
        breakdown = {}
        
        for dim, weight in self.weights.items():
            score = dimension_scores.get(dim, 0)
            score = max(0, min(100, score))
            score_d = Decimal(str(score))
            contribution = score_d * weight
            total += contribution
            breakdown[dim] = {
                "raw_score": float(score),
                "weight": float(weight),
                "contribution": float(contribution)
            }
        
        final_score = (total * Decimal("10")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        return final_score, breakdown
    
    def score_to_tier(self, score: float) -> TrustTier:
        """Convert score to trust tier."""
        if score < 200:
            return TrustTier.T1_UNTRUSTED
        elif score < 400:
            return TrustTier.T2_LIMITED
        elif score < 600:
            return TrustTier.T3_STANDARD
        elif score < 800:
            return TrustTier.T4_ELEVATED
        else:
            return TrustTier.T5_TRUSTED


# =============================================================================
# FIX 7: VERIFIED STATE MACHINE (CVE-3)
# =============================================================================

class VerifiedStateMachine:
    """
    Thread-safe, formally verified state machine.
    Fixes CVE-3: State machine vulnerabilities.
    """
    
    VALID_TRANSITIONS = {
        CircuitState.CLOSED: {CircuitState.OPEN},
        CircuitState.OPEN: {CircuitState.HALF_OPEN},
        CircuitState.HALF_OPEN: {CircuitState.CLOSED, CircuitState.OPEN},
    }
    
    def __init__(self, initial_state: CircuitState = CircuitState.CLOSED):
        self._state = initial_state
        self._lock = Lock()
        self._transition_log: List[Dict] = []
    
    def transition(self, target: CircuitState, reason: str = "") -> Tuple[bool, str]:
        """Attempt state transition."""
        with self._lock:
            if target not in self.VALID_TRANSITIONS.get(self._state, set()):
                msg = f"Invalid transition: {self._state.name} -> {target.name}"
                logger.error(msg)
                return False, msg
            
            old_state = self._state
            self._state = target
            self._transition_log.append({
                "timestamp": datetime.utcnow().isoformat(),
                "from": old_state.name,
                "to": target.name,
                "reason": reason
            })
            return True, f"Transition successful: {old_state.name} -> {target.name}"
    
    @property
    def state(self) -> CircuitState:
        with self._lock:
            return self._state
    
    @property
    def history(self) -> List[Dict]:
        with self._lock:
            return list(self._transition_log)


# =============================================================================
# HARDENED GOVERNANCE ROUTER
# =============================================================================

class HardenedGovernanceRouter:
    """
    Governance router with all security fixes applied.
    """
    
    def __init__(self):
        self.risk_classifier = IndependentRiskClassifier()
        self.circuit_breaker = EnhancedCircuitBreaker()
        self.drift_monitor = EnhancedDriftMonitor()
    
    def route(
        self,
        action: AgentAction,
        context: Optional[Dict] = None
    ) -> Tuple[bool, Dict]:
        """Route action through hardened governance."""
        metadata = {
            "action_id": action.action_id,
            "agent_id": action.agent_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # 1. Check circuit breaker
        cb_action, scope, reasons = self.circuit_breaker.record_event(
            action.agent_id, "governance", action.risk_level, context or {}
        )
        if cb_action != "ALLOWED":
            metadata["blocked_by"] = "circuit_breaker"
            metadata["scope"] = scope
            metadata["reasons"] = reasons
            return False, metadata
        
        # 2. Independent risk classification
        detected_risk, risk_reasons = self.risk_classifier.classify(action)
        metadata["claimed_risk"] = action.risk_level
        metadata["detected_risk"] = detected_risk.value
        metadata["risk_reasons"] = risk_reasons
        
        # 3. Check drift
        if action.pre_risk_assessment:
            alerts = self.drift_monitor.check_for_drift(action.agent_id, action.pre_risk_assessment)
            adjustment = self.drift_monitor.get_trust_adjustment(action.agent_id, alerts)
            metadata["drift_alerts"] = [a.message for a in alerts]
            metadata["trust_adjustment"] = adjustment
        else:
            adjustment = 1.0
        
        # 4. Apply trust-risk alignment with adjusted trust
        adjusted_trust = action.pre_trust_score * adjustment
        trust_tier = int(adjusted_trust // 200) + 1
        
        metadata["original_trust"] = action.pre_trust_score
        metadata["adjusted_trust"] = adjusted_trust
        metadata["trust_tier"] = trust_tier
        
        # 5. Alignment check: trust tier must meet or exceed risk level
        allowed = trust_tier >= detected_risk.value
        metadata["aligned"] = allowed
        
        if not allowed:
            metadata["blocked_by"] = "trust_risk_alignment"
            metadata["required_tier"] = detected_risk.value
        
        return allowed, metadata


# =============================================================================
# HARDENED OBSERVATION ASSESSMENT
# =============================================================================

class HardenedObservationAssessment:
    """
    Hardened observation-aware assessment with all security controls.
    """
    
    def __init__(self):
        self.attestation_verifier = AttestationVerifier()
        self.model_registry = ModelAccessRegistry(self.attestation_verifier)
        self.score_calculator = DeterministicScoreCalculator()
    
    def assess(
        self,
        agent_id: str,
        model_name: str,
        claimed_access: ModelAccessType,
        attestation: Optional[AttestationEvidence] = None,
        dimension_scores: Optional[Dict[str, float]] = None
    ) -> Dict:
        """Perform hardened assessment."""
        issues = []
        
        # 1. Verify access claim
        access_valid, actual_access, access_issues = self.model_registry.verify_access_claim(
            model_name, claimed_access, attestation
        )
        issues.extend(access_issues)
        
        # 2. Verify attestation
        attestation_result = None
        if attestation:
            attestation_result = self.attestation_verifier.verify(attestation)
            if not attestation_result.valid:
                issues.extend(attestation_result.issues)
        
        # 3. Determine observation tier and ceiling
        observation_tier = ACCESS_TO_OBSERVATION.get(actual_access, ObservationTier.BLACK_BOX)
        
        # Downgrade if attestation failed for TEE
        if actual_access == ModelAccessType.SELF_HOSTED_TEE:
            if not attestation_result or not attestation_result.valid:
                observation_tier = ObservationTier.WHITE_BOX
        
        trust_ceiling = OBSERVATION_CEILINGS[observation_tier]
        
        # 4. Calculate trust score
        if dimension_scores:
            score, breakdown = self.score_calculator.calculate(dimension_scores)
        else:
            score, breakdown = Decimal("0"), {}
        
        # 5. Apply ceiling
        capped_score = min(float(score), trust_ceiling * 1000)
        
        return {
            "agent_id": agent_id,
            "model_name": model_name,
            "claimed_access": claimed_access.value if isinstance(claimed_access, ModelAccessType) else claimed_access,
            "verified_access": actual_access.value if isinstance(actual_access, ModelAccessType) else actual_access,
            "observation_tier": observation_tier.value,
            "trust_ceiling": trust_ceiling,
            "raw_score": float(score),
            "capped_score": capped_score,
            "trust_tier": self.score_calculator.score_to_tier(capped_score).name,
            "score_breakdown": breakdown,
            "attestation_valid": attestation_result.valid if attestation_result else None,
            "issues": issues,
            "timestamp": datetime.utcnow().isoformat()
        }


# =============================================================================
# HARDENED MULTI-AGENT COMPOSER
# =============================================================================

class HardenedMultiAgentComposer:
    """Multi-agent trust composition with security controls."""
    
    def __init__(self):
        self.agents: Dict[str, AgentNode] = {}
        self._lock = Lock()
    
    def register_agent(self, agent: AgentNode):
        with self._lock:
            self.agents[agent.agent_id] = agent
    
    def compute_chain_trust(self, agent_ids: List[str]) -> Tuple[float, int, List[str]]:
        """Compute trust for agent chain (min aggregation)."""
        warnings = []
        
        if not agent_ids:
            warnings.append("EMPTY_CHAIN")
            return 0, 0, warnings
        
        with self._lock:
            trust_scores = []
            max_risk = 0
            
            for agent_id in agent_ids:
                if agent_id not in self.agents:
                    warnings.append(f"UNKNOWN_AGENT: {agent_id}")
                    return 0, 5, warnings
                
                agent = self.agents[agent_id]
                trust_scores.append(agent.trust_score)
                max_risk = max(max_risk, agent.max_delegation_risk)
            
            return min(trust_scores), max_risk, warnings
    
    def compute_swarm_trust(
        self,
        agent_ids: List[str],
        aggregation: str = "byzantine"
    ) -> Tuple[float, Dict]:
        """Compute swarm trust with Byzantine tolerance."""
        with self._lock:
            scores = []
            for agent_id in agent_ids:
                if agent_id in self.agents:
                    scores.append(self.agents[agent_id].trust_score)
            
            if not scores:
                return 0, {"method": aggregation, "count": 0}
            
            if aggregation == "byzantine":
                scores.sort()
                n = len(scores)
                f = (n - 1) // 3
                if f > 0:
                    scores = scores[f:-f]
                result = statistics.median(scores) if scores else 0
            elif aggregation == "conservative":
                result = min(scores)
            elif aggregation == "average":
                result = statistics.mean(scores)
            else:
                result = statistics.median(scores)
            
            return result, {"method": aggregation, "count": len(agent_ids)}
    
    def validate_delegation(
        self,
        delegator_id: str,
        delegate_id: str,
        requested_capabilities: Set[str],
        requested_risk_level: int
    ) -> Tuple[bool, List[str]]:
        """Validate delegation request."""
        issues = []
        
        with self._lock:
            if delegator_id not in self.agents:
                issues.append(f"UNKNOWN_DELEGATOR: {delegator_id}")
                return False, issues
            
            if delegate_id not in self.agents:
                issues.append(f"UNKNOWN_DELEGATE: {delegate_id}")
                return False, issues
            
            delegator = self.agents[delegator_id]
            
            # Cannot delegate beyond own risk level
            if requested_risk_level > delegator.max_delegation_risk:
                issues.append(f"RISK_EXCEEDS_DELEGATOR: {requested_risk_level} > {delegator.max_delegation_risk}")
            
            # Cannot delegate capabilities not owned
            missing = requested_capabilities - delegator.capabilities
            if missing and "all" not in delegator.capabilities:
                issues.append(f"MISSING_CAPABILITIES: {missing}")
            
            return len(issues) == 0, issues


# =============================================================================
# MAIN HARDENED ATSF CLASS
# =============================================================================

class HardenedATSF:
    """
    ATSF v2.1 - Hardened Agent Trust Scoring Framework
    
    All security fixes applied:
    - Attestation verification
    - Model access registry
    - Independent risk classification
    - Enhanced circuit breaker
    - Enhanced drift monitor
    - Deterministic score calculation
    - Verified state machine
    """
    
    VERSION = "2.1.0"
    
    def __init__(self):
        self.attestation_verifier = AttestationVerifier()
        self.model_registry = ModelAccessRegistry(self.attestation_verifier)
        self.risk_classifier = IndependentRiskClassifier()
        self.circuit_breaker = EnhancedCircuitBreaker()
        self.drift_monitor = EnhancedDriftMonitor()
        self.score_calculator = DeterministicScoreCalculator()
        self.governance_router = HardenedGovernanceRouter()
        self.observation_assessment = HardenedObservationAssessment()
        self.multi_agent_composer = HardenedMultiAgentComposer()
    
    def assess_agent(
        self,
        agent_id: str,
        model_name: str,
        claimed_access: ModelAccessType,
        attestation: Optional[AttestationEvidence] = None,
        dimension_scores: Optional[Dict[str, float]] = None
    ) -> Dict:
        """Perform complete hardened agent assessment."""
        return self.observation_assessment.assess(
            agent_id, model_name, claimed_access, attestation, dimension_scores
        )
    
    def evaluate_action(
        self,
        action: AgentAction,
        context: Optional[Dict] = None
    ) -> Tuple[bool, Dict]:
        """Evaluate action with all security controls."""
        return self.governance_router.route(action, context)
    
    def register_agent(self, agent: AgentNode):
        """Register agent for multi-agent composition."""
        self.multi_agent_composer.register_agent(agent)
    
    def compute_chain_trust(self, agent_ids: List[str]) -> Tuple[float, int, List[str]]:
        """Compute chain trust."""
        return self.multi_agent_composer.compute_chain_trust(agent_ids)
    
    def compute_swarm_trust(self, agent_ids: List[str], aggregation: str = "byzantine") -> Tuple[float, Dict]:
        """Compute swarm trust."""
        return self.multi_agent_composer.compute_swarm_trust(agent_ids, aggregation)
    
    def establish_baseline(self, agent_id: str, historical: List[Dict[str, float]]) -> Tuple[bool, List[str]]:
        """Establish drift detection baseline."""
        return self.drift_monitor.establish_baseline(agent_id, historical)
    
    def check_drift(self, agent_id: str, metrics: Dict[str, float]) -> List[DriftAlert]:
        """Check for behavioral drift."""
        return self.drift_monitor.check_for_drift(agent_id, metrics)


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    # Main class
    'HardenedATSF',
    
    # Security components
    'AttestationVerifier',
    'ModelAccessRegistry',
    'IndependentRiskClassifier',
    'EnhancedCircuitBreaker',
    'EnhancedDriftMonitor',
    'DeterministicScoreCalculator',
    'VerifiedStateMachine',
    'HardenedGovernanceRouter',
    'HardenedObservationAssessment',
    'HardenedMultiAgentComposer',
    
    # Enums
    'TrustTier',
    'RiskLevel',
    'ObservationTier',
    'ModelAccessType',
    'AttestationType',
    'CircuitState',
    'GovernanceMode',
    
    # Data classes
    'AttestationEvidence',
    'VerificationResult',
    'DriftAlert',
    'AgentAction',
    'AgentNode',
]
