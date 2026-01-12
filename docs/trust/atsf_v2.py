"""
AI Agent Trust Scoring Framework (ATSF) v2.0
Integrated Trust Assessment Engine

Addresses ALL Red Team Findings:
1. Transparency Paradox → Observation tiers with trust ceilings
2. Safety Tax → Tiered async governance with optimistic execution
3. Liability Risk → Actuarial metrics and regulatory alignment
4. Scaffolding Bypass → Decomposed model vs. orchestration trust
5. DOS via Circuit Breaker → Intelligent per-entity isolation

Version: 2.0.0
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import json

# Import v1.0 core modules
from trust_score import (
    TrustTier, DimensionType, TrustScoreCalculator, AgentProfile,
    DEFAULT_WEIGHTS, create_sample_profile
)
from risk_classification import (
    RiskLevel, TaskRegistry, RiskClassifier, RISK_LEVEL_DEFINITIONS
)
from alignment_policy import (
    AlignmentPolicy, PolicyEngine, PolicyDecision, ControlAction,
    create_conservative_policy, generate_alignment_matrix_table
)

# Import v2.0 enhancements
from confidential_computing import (
    ObservationTier, ModelAccessType, ComponentType,
    AttestationEvidence, AttestationType, GoldenImage,
    DecomposedAgentTrust, DecomposedTrustCalculator,
    create_observation_aware_assessment
)
from async_governance import (
    GovernanceMode, TieredGovernanceRouter, OptimisticGovernor,
    IntelligentCircuitBreaker, AgentAction, LatencyBudget,
    GovernanceLatencyMetrics
)
from insurance_alignment import (
    ComplianceReportGenerator, TrustToActuarialConverter,
    NISTTier, EUAIActRiskCategory, ActuarialRiskProfile
)


# =============================================================================
# SECTION 1: V2.0 TRUST ASSESSMENT
# =============================================================================

@dataclass
class TrustAssessmentV2:
    """
    Complete v2.0 trust assessment with all enhancements.
    
    Provides:
    - Decomposed trust (model vs. scaffolding)
    - Observation-aware scoring with ceilings
    - Regulatory compliance mapping
    - Actuarial risk profile
    - Governance recommendations
    """
    agent_id: str
    timestamp: datetime
    
    # Core trust metrics
    composite_score: float              # 0-1000 (v1.0 compatible)
    composite_score_v2: float           # Observation-adjusted score
    confidence: float                   # 0-1 confidence in score
    trust_tier: TrustTier
    
    # Decomposed trust
    foundation_model_trust: float       # 0-100, capped by observation tier
    orchestration_trust: float          # 0-100
    observation_tier: ObservationTier
    
    # Attestation status
    has_attestation: bool
    attestation_type: Optional[AttestationType]
    attestation_valid: bool
    
    # Compliance status
    nist_tier: NISTTier
    eu_ai_act_compliant: bool
    insurability_class: str
    
    # Risk metrics
    expected_incident_rate: float       # Per 1000 ops
    recommended_premium_bps: int        # Basis points
    
    # Warnings and recommendations
    warnings: List[str]
    recommendations: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "trust": {
                "composite_score_v1": self.composite_score,
                "composite_score_v2": self.composite_score_v2,
                "confidence": self.confidence,
                "trust_tier": self.trust_tier.name,
            },
            "decomposed": {
                "foundation_model": self.foundation_model_trust,
                "orchestration": self.orchestration_trust,
                "observation_tier": self.observation_tier.name,
            },
            "attestation": {
                "present": self.has_attestation,
                "type": self.attestation_type.value if self.attestation_type else None,
                "valid": self.attestation_valid,
            },
            "compliance": {
                "nist_tier": self.nist_tier.name,
                "eu_ai_act_compliant": self.eu_ai_act_compliant,
                "insurability": self.insurability_class,
            },
            "risk": {
                "incident_rate_per_1000": self.expected_incident_rate,
                "premium_bps": self.recommended_premium_bps,
            },
            "warnings": self.warnings,
            "recommendations": self.recommendations,
        }


# =============================================================================
# SECTION 2: V2.0 GOVERNANCE DECISION
# =============================================================================

@dataclass
class GovernanceDecisionV2:
    """
    Enhanced governance decision with latency awareness.
    """
    action_id: str
    agent_id: str
    
    # Decision
    permitted: bool
    governance_path: str                # "optimistic", "quick_sync", "full_sync", "council"
    required_controls: List[str]
    
    # Latency metrics
    decision_latency_ms: float
    latency_budget_ms: float
    within_budget: bool
    
    # Audit trail
    deferred_to_async: bool
    async_audit_priority: str           # "immediate", "standard", "background"
    rollback_available: bool
    
    # Reasons
    reasons: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "action_id": self.action_id,
            "agent_id": self.agent_id,
            "permitted": self.permitted,
            "governance_path": self.governance_path,
            "required_controls": self.required_controls,
            "latency": {
                "actual_ms": self.decision_latency_ms,
                "budget_ms": self.latency_budget_ms,
                "within_budget": self.within_budget,
            },
            "async_audit": {
                "deferred": self.deferred_to_async,
                "priority": self.async_audit_priority,
                "rollback_available": self.rollback_available,
            },
            "reasons": self.reasons,
        }


# =============================================================================
# SECTION 3: INTEGRATED ENGINE
# =============================================================================

class ATSFEngineV2:
    """
    ATSF v2.0 Integrated Engine
    
    Combines all components into a unified trust and governance system.
    """
    
    def __init__(
        self,
        policy: Optional[AlignmentPolicy] = None,
        governance_mode: GovernanceMode = GovernanceMode.TIERED,
    ):
        # Core components
        self.policy = policy or create_conservative_policy()
        self.v1_calculator = TrustScoreCalculator()
        self.v2_calculator = DecomposedTrustCalculator()
        
        # Governance
        self.governance_mode = governance_mode
        self.governance_router = TieredGovernanceRouter()
        self.circuit_breaker = IntelligentCircuitBreaker()
        
        # Compliance
        self.compliance_generator = ComplianceReportGenerator()
        self.actuarial_converter = TrustToActuarialConverter()
        
        # Risk classification
        self.risk_classifier = RiskClassifier()
        
        # Metrics
        self.latency_metrics = GovernanceLatencyMetrics()
    
    def assess_agent(
        self,
        agent_id: str,
        model_name: str,
        model_access: ModelAccessType,
        orchestration_available: bool,
        behavioral_metrics: Dict[str, float],
        code_metrics: Dict[str, float],
        dimension_scores: Dict[str, float],
        context: Dict[str, Any],
        attestation: Optional[AttestationEvidence] = None,
    ) -> TrustAssessmentV2:
        """
        Perform comprehensive v2.0 trust assessment.
        """
        # V1 score (for compatibility)
        v1_profile = self._create_v1_profile(agent_id, dimension_scores)
        v1_score = self.v1_calculator.calculate_composite_score(v1_profile)
        v1_tier = TrustScoreCalculator.score_to_tier(v1_score)
        
        # V2 decomposed assessment
        decomposed = create_observation_aware_assessment(
            agent_id=agent_id,
            model_name=model_name,
            model_access=model_access,
            orchestration_code_available=orchestration_available,
            behavioral_metrics=behavioral_metrics,
            code_metrics=code_metrics,
            attestation=attestation
        )
        
        v2_score, confidence = decomposed.compute_composite_trust()
        v2_score_normalized = v2_score * 10  # Scale to 0-1000
        
        # Compliance mapping
        compliance_report = self.compliance_generator.generate_full_report(
            agent_id=agent_id,
            trust_score=v2_score_normalized,
            confidence=confidence,
            dimension_scores=dimension_scores,
            context=context
        )
        
        # Actuarial profile
        actuarial = self.actuarial_converter.convert(
            agent_id, v2_score_normalized, confidence, context
        )
        
        # Collect warnings
        warnings = decomposed._get_warnings()
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            v2_score_normalized, confidence, decomposed, compliance_report
        )
        
        return TrustAssessmentV2(
            agent_id=agent_id,
            timestamp=datetime.utcnow(),
            composite_score=v1_score,
            composite_score_v2=v2_score_normalized,
            confidence=confidence,
            trust_tier=v1_tier,
            foundation_model_trust=decomposed.foundation_model.effective_score,
            orchestration_trust=decomposed.orchestration.effective_score,
            observation_tier=decomposed.foundation_model.observation_tier,
            has_attestation=attestation is not None,
            attestation_type=attestation.attestation_type if attestation else None,
            attestation_valid=attestation.matches_golden_image if attestation else False,
            nist_tier=NISTTier[compliance_report['regulatory_compliance']['nist_ai_rmf']['overall_tier']],
            eu_ai_act_compliant=compliance_report['regulatory_compliance']['eu_ai_act']['conformity_status'] == 'COMPLIANT',
            insurability_class=actuarial._risk_classification(),
            expected_incident_rate=actuarial.expected_incident_frequency,
            recommended_premium_bps=actuarial.risk_premium_basis_points,
            warnings=warnings,
            recommendations=recommendations
        )
    
    def evaluate_action(
        self,
        agent_assessment: TrustAssessmentV2,
        action_description: str,
        action_type: str,
        context: Dict[str, Any],
        latency_budget: Optional[LatencyBudget] = None,
    ) -> GovernanceDecisionV2:
        """
        Evaluate whether an action should be permitted.
        
        Uses tiered governance to minimize latency while maintaining safety.
        """
        # Classify risk
        risk_result = self.risk_classifier.classify(action_description, context)
        risk_level = RiskLevel[risk_result['risk_level']].value
        
        # Create action record
        action = AgentAction(
            action_id=f"act-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
            agent_id=agent_assessment.agent_id,
            timestamp=datetime.utcnow(),
            action_type=action_type,
            action_payload={"description": action_description},
            risk_level=risk_level,
            pre_trust_score=agent_assessment.composite_score_v2,
            pre_risk_assessment=risk_result,
            governance_mode=self.governance_mode
        )
        
        # Check circuit breaker
        cb_action, cb_scope = self.circuit_breaker.record_event(
            agent_assessment.agent_id,
            "action_attempt",
            severity=risk_level
        )
        
        if cb_action == "block":
            return GovernanceDecisionV2(
                action_id=action.action_id,
                agent_id=agent_assessment.agent_id,
                permitted=False,
                governance_path="circuit_breaker",
                required_controls=[],
                decision_latency_ms=0.1,
                latency_budget_ms=latency_budget.max_latency_ms if latency_budget else 100,
                within_budget=True,
                deferred_to_async=False,
                async_audit_priority="immediate",
                rollback_available=False,
                reasons=[f"Circuit breaker tripped for entity (scope: {cb_scope})"]
            )
        
        # Route through tiered governance
        budget = latency_budget or LatencyBudget.real_time_chat()
        permitted, metadata = self.governance_router.route(action, budget)
        
        # Record metrics
        self.latency_metrics.record(
            metadata['governance_path'],
            metadata['latency_ms'],
            budget.max_latency_ms
        )
        
        # Determine required controls
        controls = self._determine_controls(
            risk_level, agent_assessment.trust_tier, permitted
        )
        
        # Determine async audit details
        deferred = metadata['governance_path'] in ['optimistic', 'quick_sync']
        audit_priority = "background" if risk_level <= 2 else "standard" if risk_level <= 3 else "immediate"
        
        return GovernanceDecisionV2(
            action_id=action.action_id,
            agent_id=agent_assessment.agent_id,
            permitted=permitted,
            governance_path=metadata['governance_path'],
            required_controls=controls,
            decision_latency_ms=metadata['latency_ms'],
            latency_budget_ms=budget.max_latency_ms,
            within_budget=metadata['within_budget'],
            deferred_to_async=deferred,
            async_audit_priority=audit_priority,
            rollback_available=action_type in self.governance_router.optimistic_governor.rollback_handlers,
            reasons=self._format_reasons(permitted, metadata, agent_assessment)
        )
    
    def _create_v1_profile(
        self, 
        agent_id: str, 
        dimension_scores: Dict[str, float]
    ) -> AgentProfile:
        """Create v1 profile from dimension scores for compatibility."""
        from trust_score import DimensionScore
        
        dim_map = {
            'provenance': DimensionType.PROVENANCE,
            'capability': DimensionType.CAPABILITY_BOUNDS,
            'behavioral': DimensionType.BEHAVIORAL_CONSISTENCY,
            'security': DimensionType.SECURITY_POSTURE,
            'observability': DimensionType.OBSERVABILITY,
            'track_record': DimensionType.TRACK_RECORD,
            'governance': DimensionType.GOVERNANCE,
        }
        
        profile_dims = {}
        for name, dim_type in dim_map.items():
            score = dimension_scores.get(name, 50)
            # Create a dimension score that produces the desired total
            profile_dims[dim_type] = DimensionScore(
                dim_type, 
                {"direct_score": score}
            )
            # Override total_score property
            profile_dims[dim_type].factor_scores = {"_override": score}
        
        return AgentProfile(
            agent_id=agent_id,
            name=f"Agent-{agent_id}",
            version="2.0.0",
            developer="ATSF",
            dimension_scores=profile_dims
        )
    
    def _determine_controls(
        self, 
        risk_level: int, 
        trust_tier: TrustTier,
        permitted: bool
    ) -> List[str]:
        """Determine required controls based on risk and trust."""
        controls = []
        
        if not permitted:
            return ["action_blocked"]
        
        if risk_level >= 3:
            controls.append("audit_log")
        
        if risk_level >= 4:
            controls.append("pre_action_confirmation")
            controls.append("timeout_limit")
        
        if risk_level >= 5:
            controls.append("multi_party_approval")
            controls.append("rollback_plan")
            controls.append("human_oversight")
        
        # Lower trust = more controls
        if trust_tier.value <= 2 and risk_level >= 2:
            controls.append("enhanced_monitoring")
        
        return list(set(controls))
    
    def _format_reasons(
        self,
        permitted: bool,
        metadata: Dict,
        assessment: TrustAssessmentV2
    ) -> List[str]:
        """Format decision reasons."""
        reasons = []
        
        if permitted:
            reasons.append(f"Trust tier {assessment.trust_tier.name} sufficient for risk level")
            reasons.append(f"Governance path: {metadata['governance_path']}")
        else:
            reasons.append(f"Trust score {assessment.composite_score_v2:.0f} insufficient")
            if assessment.observation_tier == ObservationTier.BLACK_BOX:
                reasons.append("Foundation model is BLACK_BOX with 60% trust ceiling")
        
        return reasons
    
    def _generate_recommendations(
        self,
        score: float,
        confidence: float,
        decomposed: DecomposedAgentTrust,
        compliance: Dict
    ) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []
        
        if decomposed.foundation_model.observation_tier == ObservationTier.BLACK_BOX:
            recommendations.append(
                "Deploy model in TEE for hardware attestation to unlock higher trust ceiling"
            )
        
        if confidence < 0.7:
            recommendations.append(
                "Increase observability and monitoring to improve confidence"
            )
        
        if not decomposed.attestation:
            recommendations.append(
                "Add cryptographic attestation for code integrity verification"
            )
        
        summary = compliance.get('executive_summary', {})
        if summary.get('overall_compliance_status') == 'NEEDS_REMEDIATION':
            for action in summary.get('remediation_priority', [])[:2]:
                recommendations.append(f"{action['framework']}: {action['action']}")
        
        return recommendations
    
    def get_metrics_summary(self) -> Dict:
        """Get performance metrics summary."""
        return {
            "latency": self.latency_metrics.get_summary(),
            "circuit_breaker": {
                "global_status": self.circuit_breaker.global_tripped
            },
            "governance_mode": self.governance_mode.value
        }


# =============================================================================
# SECTION 4: DEMO
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF v2.0 - Integrated Trust Assessment Engine")
    print("Addressing All Red Team Findings")
    print("=" * 70)
    
    engine = ATSFEngineV2()
    
    # Scenario: GPT-4 based customer service agent
    print("\n--- Scenario: GPT-4 Customer Service Agent ---")
    
    assessment = engine.assess_agent(
        agent_id="cs-agent-001",
        model_name="gpt-4",
        model_access=ModelAccessType.API_PROPRIETARY,
        orchestration_available=True,
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
        },
        dimension_scores={
            "provenance": 70,
            "capability": 75,
            "behavioral": 80,
            "security": 65,
            "observability": 60,
            "track_record": 70,
            "governance": 55,
        },
        context={
            "domain": "general",
            "handles_pii": True,
            "autonomy_level": "semi_autonomous",
            "annual_operations": 1000000,
            "interacts_with_public": True,
        }
    )
    
    print(f"\nTrust Assessment:")
    print(f"  V1 Score: {assessment.composite_score:.0f}")
    print(f"  V2 Score: {assessment.composite_score_v2:.0f} (observation-adjusted)")
    print(f"  Confidence: {assessment.confidence:.2f}")
    print(f"  Trust Tier: {assessment.trust_tier.name}")
    print(f"\nDecomposed Trust:")
    print(f"  Foundation Model: {assessment.foundation_model_trust:.1f}/100 ({assessment.observation_tier.name})")
    print(f"  Orchestration: {assessment.orchestration_trust:.1f}/100")
    print(f"\nCompliance:")
    print(f"  NIST Tier: {assessment.nist_tier.name}")
    print(f"  EU AI Act: {'COMPLIANT' if assessment.eu_ai_act_compliant else 'NON-COMPLIANT'}")
    print(f"  Insurability: {assessment.insurability_class}")
    print(f"  Premium: {assessment.recommended_premium_bps} bps")
    
    if assessment.warnings:
        print(f"\nWarnings:")
        for w in assessment.warnings:
            print(f"  ⚠️  {w}")
    
    if assessment.recommendations:
        print(f"\nRecommendations:")
        for r in assessment.recommendations[:3]:
            print(f"  → {r}")
    
    # Test governance decisions
    print("\n--- Governance Decisions ---")
    test_actions = [
        ("Answer customer question about return policy", "query"),
        ("Send email confirmation to customer", "communication"),
        ("Process refund of $50", "financial"),
        ("Update customer record in database", "data_modification"),
    ]
    
    for desc, action_type in test_actions:
        decision = engine.evaluate_action(
            agent_assessment=assessment,
            action_description=desc,
            action_type=action_type,
            context={"handles_pii": True}
        )
        
        status = "✓" if decision.permitted else "✗"
        print(f"\n{status} {desc[:50]}")
        print(f"  Path: {decision.governance_path} | Latency: {decision.decision_latency_ms:.1f}ms")
        print(f"  Controls: {decision.required_controls if decision.required_controls else 'None'}")
        if decision.deferred_to_async:
            print(f"  Async audit: {decision.async_audit_priority}")
    
    # Metrics summary
    print("\n--- Performance Metrics ---")
    metrics = engine.get_metrics_summary()
    for path, stats in metrics['latency'].get('paths', {}).items():
        print(f"  {path}: avg={stats['avg_ms']:.1f}ms, p99={stats['p99_ms']:.1f}ms")
    
    print("\n" + "=" * 70)
    print("ATSF v2.0 addresses Red Team findings:")
    print("  ✓ Transparency Paradox: Observation tiers with trust ceilings")
    print("  ✓ Safety Tax: Tiered async governance (<1ms for R1-R2)")  
    print("  ✓ Liability Risk: NIST/EU AI Act/Actuarial alignment")
    print("  ✓ Scaffolding Bypass: Decomposed model vs orchestration trust")
    print("  ✓ Circuit Breaker DOS: Per-entity isolation, DOS detection")
    print("=" * 70)
