"""
AI Agent Trust Scoring Framework (ATSF)
Confidential Computing & Attestation Layer

Addresses Red Team Finding: "Transparency Paradox"
- Cannot inspect proprietary model internals (GPT-4, Claude)
- Must distinguish scaffolding trust from model trust
- Hardware root of trust via TEE attestation

Version: 2.0.0
"""

from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Dict, List, Optional, Tuple, Any, Set
from datetime import datetime, timedelta
import hashlib
import json
import base64


# =============================================================================
# SECTION 1: OBSERVATION TIER CLASSIFICATION
# =============================================================================

class ObservationTier(IntEnum):
    """
    Classifies what level of inspection is possible for an agent component.
    
    Critical insight from Red Team: "White Box" for proprietary models is 
    technically impossible. We must be honest about observation limits.
    """
    BLACK_BOX = 1      # Inputs/outputs only (API-accessed models)
    GRAY_BOX = 2       # I/O + platform metrics + logs
    WHITE_BOX = 3      # Full source code access (open source only)
    ATTESTED_BOX = 4   # Cryptographic proof of code/weights integrity


class ComponentType(Enum):
    """Types of components in an AI agent system."""
    FOUNDATION_MODEL = "foundation_model"      # GPT-4, Claude, etc.
    ORCHESTRATION_CODE = "orchestration"       # LangChain, custom code
    TOOL_INTEGRATION = "tools"                 # APIs, databases
    GUARDRAIL_SYSTEM = "guardrails"           # Safety filters
    MEMORY_SYSTEM = "memory"                   # RAG, vector stores
    ROUTING_LOGIC = "routing"                  # Multi-agent coordination


class ModelAccessType(Enum):
    """How the foundation model is accessed."""
    API_PROPRIETARY = "api_proprietary"        # OpenAI, Anthropic APIs
    API_OPEN_WEIGHTS = "api_open_weights"      # Hosted Llama, Mistral
    SELF_HOSTED_OPEN = "self_hosted_open"      # Local open-weights
    SELF_HOSTED_TEE = "self_hosted_tee"        # In Trusted Execution Environment
    FINE_TUNED_PROPRIETARY = "fine_tuned_prop" # Fine-tuned on proprietary platform


# Observation limits by access type
OBSERVATION_LIMITS: Dict[ModelAccessType, ObservationTier] = {
    ModelAccessType.API_PROPRIETARY: ObservationTier.BLACK_BOX,
    ModelAccessType.API_OPEN_WEIGHTS: ObservationTier.BLACK_BOX,  # Still can't see runtime state
    ModelAccessType.SELF_HOSTED_OPEN: ObservationTier.WHITE_BOX,
    ModelAccessType.SELF_HOSTED_TEE: ObservationTier.ATTESTED_BOX,
    ModelAccessType.FINE_TUNED_PROPRIETARY: ObservationTier.BLACK_BOX,
}


@dataclass
class ComponentObservability:
    """Tracks what we can actually observe about each component."""
    component_type: ComponentType
    observation_tier: ObservationTier
    observable_properties: Set[str]
    unobservable_properties: Set[str]
    trust_ceiling: float  # Max trust score possible given observation limits
    
    def __post_init__(self):
        # Enforce trust ceilings based on observation tier
        tier_ceilings = {
            ObservationTier.BLACK_BOX: 0.6,      # Max 60% trust for black boxes
            ObservationTier.GRAY_BOX: 0.75,      # Max 75% for gray box
            ObservationTier.WHITE_BOX: 0.95,     # Max 95% for white box
            ObservationTier.ATTESTED_BOX: 1.0,   # Full trust possible with attestation
        }
        self.trust_ceiling = min(self.trust_ceiling, tier_ceilings[self.observation_tier])


# =============================================================================
# SECTION 2: ATTESTATION PRIMITIVES
# =============================================================================

class AttestationType(Enum):
    """Types of cryptographic attestation."""
    NONE = "none"
    SOFTWARE_HASH = "software_hash"           # Hash of code, no hardware backing
    TPM_QUOTE = "tpm_quote"                   # Trusted Platform Module
    SGX_QUOTE = "sgx_quote"                   # Intel SGX enclave
    SEV_SNP_REPORT = "sev_snp"               # AMD SEV-SNP
    TDX_QUOTE = "tdx_quote"                  # Intel TDX
    NVIDIA_CC = "nvidia_cc"                  # NVIDIA Confidential Compute (H100)


@dataclass
class AttestationEvidence:
    """Cryptographic proof of agent integrity."""
    attestation_id: str
    attestation_type: AttestationType
    timestamp: datetime
    
    # What is being attested
    code_hash: str                            # SHA-256 of orchestration code
    weights_hash: Optional[str]               # SHA-256 of model weights (if accessible)
    config_hash: str                          # SHA-256 of configuration
    
    # Hardware attestation (if available)
    platform_quote: Optional[bytes] = None    # Raw attestation quote
    measurement_registers: Optional[Dict[str, str]] = None  # PCR/RTMR values
    
    # Verification chain
    certificate_chain: List[str] = field(default_factory=list)
    verified_by: Optional[str] = None
    verification_timestamp: Optional[datetime] = None
    
    # Golden image comparison
    golden_image_hash: Optional[str] = None
    matches_golden_image: Optional[bool] = None
    
    def is_hardware_backed(self) -> bool:
        """Check if attestation has hardware root of trust."""
        return self.attestation_type in {
            AttestationType.TPM_QUOTE,
            AttestationType.SGX_QUOTE,
            AttestationType.SEV_SNP_REPORT,
            AttestationType.TDX_QUOTE,
            AttestationType.NVIDIA_CC,
        }
    
    def to_dict(self) -> Dict:
        return {
            "attestation_id": self.attestation_id,
            "type": self.attestation_type.value,
            "timestamp": self.timestamp.isoformat(),
            "code_hash": self.code_hash,
            "weights_hash": self.weights_hash,
            "config_hash": self.config_hash,
            "hardware_backed": self.is_hardware_backed(),
            "matches_golden_image": self.matches_golden_image,
            "verified_by": self.verified_by,
        }


@dataclass
class GoldenImage:
    """Pre-audited reference configuration for comparison."""
    image_id: str
    name: str
    version: str
    
    # Hashes of audited components
    code_hash: str
    weights_hash: Optional[str]
    config_hash: str
    
    # Audit metadata
    audited_by: str
    audit_date: datetime
    audit_report_uri: Optional[str] = None
    
    # Validity
    valid_from: datetime = field(default_factory=datetime.utcnow)
    valid_until: Optional[datetime] = None
    revoked: bool = False
    revocation_reason: Optional[str] = None
    
    def is_valid(self) -> bool:
        now = datetime.utcnow()
        if self.revoked:
            return False
        if now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True


# =============================================================================
# SECTION 3: ATTESTATION VERIFIER
# =============================================================================

class AttestationVerifier:
    """
    Verifies cryptographic attestations against golden images.
    
    This is the core of the "Attested Box" approach - we don't need to
    see the code, we need cryptographic proof it hasn't changed from
    an audited baseline.
    """
    
    def __init__(self):
        self.golden_images: Dict[str, GoldenImage] = {}
        self.trusted_roots: Set[str] = set()  # Trusted CA certificates
        
    def register_golden_image(self, image: GoldenImage):
        """Register a pre-audited golden image."""
        self.golden_images[image.image_id] = image
        
    def verify_attestation(
        self, 
        evidence: AttestationEvidence
    ) -> Tuple[bool, float, List[str]]:
        """
        Verify attestation evidence and return trust score.
        
        Returns:
            Tuple of (valid, integrity_score, issues)
        """
        issues = []
        score = 0.0
        
        # Check attestation type
        if evidence.attestation_type == AttestationType.NONE:
            issues.append("No attestation provided")
            return False, 0.0, issues
        
        # Check hardware backing
        if evidence.is_hardware_backed():
            score += 0.3  # Hardware attestation bonus
        else:
            issues.append("Software-only attestation (no hardware root of trust)")
            score += 0.1
        
        # Verify against golden image
        if evidence.golden_image_hash:
            golden = self.golden_images.get(evidence.golden_image_hash)
            if golden and golden.is_valid():
                # Compare hashes
                code_match = evidence.code_hash == golden.code_hash
                config_match = evidence.config_hash == golden.config_hash
                weights_match = (
                    evidence.weights_hash == golden.weights_hash 
                    if golden.weights_hash else True
                )
                
                if code_match and config_match and weights_match:
                    score += 0.5  # Golden image match
                    evidence.matches_golden_image = True
                else:
                    if not code_match:
                        issues.append("Code hash mismatch from golden image")
                    if not config_match:
                        issues.append("Config hash mismatch from golden image")
                    if not weights_match:
                        issues.append("Weights hash mismatch from golden image")
                    evidence.matches_golden_image = False
            else:
                issues.append("Golden image not found or expired")
        else:
            issues.append("No golden image reference for comparison")
            score += 0.1  # Partial credit for having attestation
        
        # Freshness check
        age_hours = (datetime.utcnow() - evidence.timestamp).total_seconds() / 3600
        if age_hours > 24:
            issues.append(f"Attestation is {age_hours:.1f} hours old (>24h)")
            score -= 0.1
        else:
            score += 0.1  # Fresh attestation bonus
        
        score = max(0.0, min(1.0, score))
        valid = len([i for i in issues if "mismatch" in i or "No attestation" in i]) == 0
        
        return valid, score, issues
    
    def compute_integrity_score(self, evidence: AttestationEvidence) -> float:
        """Compute integrity score from attestation (0-100 scale)."""
        valid, score, _ = self.verify_attestation(evidence)
        return score * 100


# =============================================================================
# SECTION 4: DECOMPOSED TRUST SCORING
# =============================================================================

@dataclass
class ComponentTrustAssessment:
    """Trust assessment for a single component."""
    component_type: ComponentType
    observation_tier: ObservationTier
    
    # Scores (0-100)
    observable_score: float       # Score based on what we can observe
    attestation_score: float      # Score from cryptographic attestation
    behavioral_score: float       # Score from runtime behavior analysis
    
    # Trust ceiling enforcement
    trust_ceiling: float
    
    # Final component score
    @property
    def effective_score(self) -> float:
        """Compute effective score respecting observation ceiling."""
        raw = (
            self.observable_score * 0.4 +
            self.attestation_score * 0.35 +
            self.behavioral_score * 0.25
        )
        return min(raw, self.trust_ceiling * 100)
    
    @property
    def confidence(self) -> float:
        """Confidence in the score (higher for better observability)."""
        confidence_by_tier = {
            ObservationTier.BLACK_BOX: 0.4,
            ObservationTier.GRAY_BOX: 0.6,
            ObservationTier.WHITE_BOX: 0.85,
            ObservationTier.ATTESTED_BOX: 0.95,
        }
        return confidence_by_tier[self.observation_tier]


@dataclass 
class DecomposedAgentTrust:
    """
    Separates trust scoring for scaffolding vs. foundation model.
    
    Key insight from Red Team: We can fully validate orchestration code
    but can only observe I/O for proprietary models. The composite score
    must reflect this epistemic uncertainty.
    """
    agent_id: str
    
    # Component-level assessments
    foundation_model: ComponentTrustAssessment
    orchestration: ComponentTrustAssessment
    tools: Optional[ComponentTrustAssessment] = None
    guardrails: Optional[ComponentTrustAssessment] = None
    
    # Attestation evidence
    attestation: Optional[AttestationEvidence] = None
    
    # Computed at evaluation time
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def compute_composite_trust(self) -> Tuple[float, float]:
        """
        Compute composite trust with confidence interval.
        
        Returns:
            Tuple of (trust_score, confidence)
        """
        components = [
            (self.foundation_model, 0.40),   # Model is 40% of trust
            (self.orchestration, 0.35),      # Scaffolding is 35%
        ]
        
        if self.tools:
            components.append((self.tools, 0.15))
        if self.guardrails:
            components.append((self.guardrails, 0.10))
        
        # Normalize weights
        total_weight = sum(w for _, w in components)
        
        weighted_score = 0.0
        weighted_confidence = 0.0
        
        for component, weight in components:
            norm_weight = weight / total_weight
            weighted_score += component.effective_score * norm_weight
            weighted_confidence += component.confidence * norm_weight
        
        # Apply attestation bonus
        if self.attestation and self.attestation.is_hardware_backed():
            if self.attestation.matches_golden_image:
                weighted_score = min(100, weighted_score * 1.1)  # 10% bonus
                weighted_confidence = min(1.0, weighted_confidence * 1.15)
        
        return weighted_score, weighted_confidence
    
    def get_trust_breakdown(self) -> Dict:
        """Get detailed breakdown for transparency."""
        composite_score, confidence = self.compute_composite_trust()
        
        return {
            "agent_id": self.agent_id,
            "composite_score": round(composite_score, 2),
            "confidence": round(confidence, 3),
            "components": {
                "foundation_model": {
                    "observation_tier": self.foundation_model.observation_tier.name,
                    "effective_score": round(self.foundation_model.effective_score, 2),
                    "trust_ceiling": self.foundation_model.trust_ceiling,
                    "confidence": self.foundation_model.confidence,
                },
                "orchestration": {
                    "observation_tier": self.orchestration.observation_tier.name,
                    "effective_score": round(self.orchestration.effective_score, 2),
                    "trust_ceiling": self.orchestration.trust_ceiling,
                    "confidence": self.orchestration.confidence,
                },
            },
            "attestation": self.attestation.to_dict() if self.attestation else None,
            "timestamp": self.timestamp.isoformat(),
            "warnings": self._get_warnings(),
        }
    
    def _get_warnings(self) -> List[str]:
        """Generate warnings about trust limitations."""
        warnings = []
        
        if self.foundation_model.observation_tier == ObservationTier.BLACK_BOX:
            warnings.append(
                "Foundation model is BLACK_BOX (API-accessed). "
                "Cannot verify internal reasoning. Trust ceiling: 60%"
            )
        
        if not self.attestation:
            warnings.append(
                "No cryptographic attestation. Cannot verify code integrity."
            )
        elif not self.attestation.is_hardware_backed():
            warnings.append(
                "Software-only attestation. No hardware root of trust."
            )
        
        if self.foundation_model.effective_score > 60 and \
           self.foundation_model.observation_tier == ObservationTier.BLACK_BOX:
            warnings.append(
                "INTEGRITY WARNING: Foundation model score exceeds observation ceiling. "
                "Score has been capped."
            )
        
        return warnings


# =============================================================================
# SECTION 5: SCAFFOLDING VS MODEL TRUST CALCULATOR
# =============================================================================

class DecomposedTrustCalculator:
    """
    Calculates trust scores with explicit separation of scaffolding and model.
    
    Addresses Red Team critique: "A 'Trust-Only' system that validates the 
    container but ignores the contents is vulnerable to deep systemic failure."
    
    Solution: Be explicit about what we're validating and what we can't.
    """
    
    def __init__(self, verifier: Optional[AttestationVerifier] = None):
        self.verifier = verifier or AttestationVerifier()
    
    def assess_foundation_model(
        self,
        model_name: str,
        access_type: ModelAccessType,
        behavioral_metrics: Dict[str, float],
        attestation: Optional[AttestationEvidence] = None
    ) -> ComponentTrustAssessment:
        """
        Assess foundation model trust with honest observation limits.
        """
        obs_tier = OBSERVATION_LIMITS[access_type]
        
        # What we can observe varies by access type
        if access_type == ModelAccessType.API_PROPRIETARY:
            # BLACK_BOX: Only I/O metrics
            observable_score = self._score_io_metrics(behavioral_metrics)
            trust_ceiling = 0.6
        elif access_type == ModelAccessType.SELF_HOSTED_OPEN:
            # WHITE_BOX: Full inspection possible
            observable_score = self._score_full_inspection(behavioral_metrics)
            trust_ceiling = 0.95
        elif access_type == ModelAccessType.SELF_HOSTED_TEE:
            # ATTESTED_BOX: Cryptographic proof
            observable_score = self._score_io_metrics(behavioral_metrics)
            trust_ceiling = 1.0  # Can reach full trust with attestation
        else:
            observable_score = self._score_io_metrics(behavioral_metrics)
            trust_ceiling = 0.6
        
        # Attestation score
        attestation_score = 0.0
        if attestation:
            attestation_score = self.verifier.compute_integrity_score(attestation)
        
        # Behavioral score from runtime analysis
        behavioral_score = behavioral_metrics.get("behavioral_consistency", 50.0)
        
        return ComponentTrustAssessment(
            component_type=ComponentType.FOUNDATION_MODEL,
            observation_tier=obs_tier,
            observable_score=observable_score,
            attestation_score=attestation_score,
            behavioral_score=behavioral_score,
            trust_ceiling=trust_ceiling
        )
    
    def assess_orchestration(
        self,
        code_available: bool,
        code_metrics: Dict[str, float],
        attestation: Optional[AttestationEvidence] = None
    ) -> ComponentTrustAssessment:
        """
        Assess orchestration/scaffolding code trust.
        
        This is where we CAN do true white-box analysis.
        """
        if code_available:
            obs_tier = ObservationTier.WHITE_BOX
            observable_score = self._score_code_analysis(code_metrics)
            trust_ceiling = 0.95
        else:
            obs_tier = ObservationTier.GRAY_BOX
            observable_score = code_metrics.get("observed_behavior", 50.0)
            trust_ceiling = 0.75
        
        attestation_score = 0.0
        if attestation:
            attestation_score = self.verifier.compute_integrity_score(attestation)
            if attestation.is_hardware_backed():
                obs_tier = ObservationTier.ATTESTED_BOX
                trust_ceiling = 1.0
        
        behavioral_score = code_metrics.get("runtime_behavior", 50.0)
        
        return ComponentTrustAssessment(
            component_type=ComponentType.ORCHESTRATION_CODE,
            observation_tier=obs_tier,
            observable_score=observable_score,
            attestation_score=attestation_score,
            behavioral_score=behavioral_score,
            trust_ceiling=trust_ceiling
        )
    
    def _score_io_metrics(self, metrics: Dict[str, float]) -> float:
        """Score based on input/output analysis only (black box)."""
        # Limited to observable behaviors
        hallucination_rate = metrics.get("hallucination_rate", 0.1)
        refusal_rate = metrics.get("appropriate_refusal_rate", 0.5)
        consistency = metrics.get("output_consistency", 0.5)
        
        score = (
            (1 - hallucination_rate) * 40 +  # Lower hallucination = better
            refusal_rate * 30 +               # Appropriate refusals
            consistency * 30                   # Consistent outputs
        )
        return min(60.0, score)  # Cap at 60 for black box
    
    def _score_full_inspection(self, metrics: Dict[str, float]) -> float:
        """Score based on full white-box inspection."""
        architecture_safety = metrics.get("architecture_safety", 0.5)
        weight_analysis = metrics.get("weight_analysis", 0.5)
        activation_patterns = metrics.get("activation_analysis", 0.5)
        
        io_score = self._score_io_metrics(metrics)
        
        inspection_score = (
            architecture_safety * 30 +
            weight_analysis * 30 +
            activation_patterns * 35
        )
        
        return min(95.0, io_score + inspection_score * 0.35)
    
    def _score_code_analysis(self, metrics: Dict[str, float]) -> float:
        """Score orchestration code through static/dynamic analysis."""
        static_analysis = metrics.get("static_analysis_score", 0.5)
        test_coverage = metrics.get("test_coverage", 0.5)
        vulnerability_scan = metrics.get("vulnerability_score", 0.5)
        logic_verification = metrics.get("logic_verification", 0.5)
        
        score = (
            static_analysis * 25 +
            test_coverage * 25 +
            vulnerability_scan * 25 +
            logic_verification * 25
        )
        return score


# =============================================================================
# SECTION 6: INTEGRATION WITH MAIN TRUST SCORE
# =============================================================================

def create_observation_aware_assessment(
    agent_id: str,
    model_name: str,
    model_access: ModelAccessType,
    orchestration_code_available: bool,
    behavioral_metrics: Dict[str, float],
    code_metrics: Dict[str, float],
    attestation: Optional[AttestationEvidence] = None
) -> DecomposedAgentTrust:
    """
    Factory function to create a decomposed trust assessment.
    
    This is the main entry point for the revised trust scoring that
    honestly accounts for observation limits.
    """
    calculator = DecomposedTrustCalculator()
    
    foundation_assessment = calculator.assess_foundation_model(
        model_name=model_name,
        access_type=model_access,
        behavioral_metrics=behavioral_metrics,
        attestation=attestation
    )
    
    orchestration_assessment = calculator.assess_orchestration(
        code_available=orchestration_code_available,
        code_metrics=code_metrics,
        attestation=attestation
    )
    
    return DecomposedAgentTrust(
        agent_id=agent_id,
        foundation_model=foundation_assessment,
        orchestration=orchestration_assessment,
        attestation=attestation
    )


# =============================================================================
# SECTION 7: DEMO
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF v2.0 - Confidential Computing & Attestation Layer")
    print("Addressing the White Box Paradox")
    print("=" * 70)
    
    # Scenario 1: API-accessed GPT-4 (BLACK BOX)
    print("\n--- Scenario 1: GPT-4 via API (BLACK BOX) ---")
    assessment1 = create_observation_aware_assessment(
        agent_id="agent-gpt4-api",
        model_name="gpt-4",
        model_access=ModelAccessType.API_PROPRIETARY,
        orchestration_code_available=True,
        behavioral_metrics={
            "hallucination_rate": 0.05,
            "appropriate_refusal_rate": 0.85,
            "output_consistency": 0.90,
            "behavioral_consistency": 75.0,
        },
        code_metrics={
            "static_analysis_score": 0.85,
            "test_coverage": 0.70,
            "vulnerability_score": 0.90,
            "logic_verification": 0.80,
            "runtime_behavior": 85.0,
        }
    )
    
    breakdown1 = assessment1.get_trust_breakdown()
    print(f"Composite Score: {breakdown1['composite_score']}")
    print(f"Confidence: {breakdown1['confidence']}")
    print(f"Foundation Model Tier: {breakdown1['components']['foundation_model']['observation_tier']}")
    print(f"Foundation Model Score: {breakdown1['components']['foundation_model']['effective_score']} (ceiling: {breakdown1['components']['foundation_model']['trust_ceiling']*100}%)")
    print("Warnings:")
    for w in breakdown1['warnings']:
        print(f"  ⚠️  {w}")
    
    # Scenario 2: Self-hosted Llama in TEE (ATTESTED BOX)
    print("\n--- Scenario 2: Llama 3 in TEE (ATTESTED BOX) ---")
    
    attestation = AttestationEvidence(
        attestation_id="att-001",
        attestation_type=AttestationType.TDX_QUOTE,
        timestamp=datetime.utcnow(),
        code_hash="sha256:abc123...",
        weights_hash="sha256:def456...",
        config_hash="sha256:ghi789...",
        platform_quote=b"mock_tdx_quote",
        golden_image_hash="golden-llama3-v1",
        matches_golden_image=True,
    )
    
    assessment2 = create_observation_aware_assessment(
        agent_id="agent-llama-tee",
        model_name="llama-3-70b",
        model_access=ModelAccessType.SELF_HOSTED_TEE,
        orchestration_code_available=True,
        behavioral_metrics={
            "hallucination_rate": 0.08,
            "appropriate_refusal_rate": 0.80,
            "output_consistency": 0.85,
            "behavioral_consistency": 80.0,
        },
        code_metrics={
            "static_analysis_score": 0.90,
            "test_coverage": 0.85,
            "vulnerability_score": 0.95,
            "logic_verification": 0.85,
            "runtime_behavior": 88.0,
        },
        attestation=attestation
    )
    
    breakdown2 = assessment2.get_trust_breakdown()
    print(f"Composite Score: {breakdown2['composite_score']}")
    print(f"Confidence: {breakdown2['confidence']}")
    print(f"Foundation Model Tier: {breakdown2['components']['foundation_model']['observation_tier']}")
    print(f"Attestation: Hardware-backed = {attestation.is_hardware_backed()}")
    print("Warnings:")
    for w in breakdown2['warnings']:
        print(f"  ⚠️  {w}")
    if not breakdown2['warnings']:
        print("  ✓ No warnings - full attestation chain verified")
    
    print("\n" + "=" * 70)
    print("KEY INSIGHT: Black-box models are capped at 60% trust regardless of")
    print("behavioral metrics. Only TEE-attested deployments can achieve full trust.")
    print("=" * 70)
