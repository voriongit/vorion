"""
AI Agent Trust Scoring Framework (ATSF)
Future Requirements Alignment Layer

Anticipates and prepares for:
1. Emerging regulations (EU AI Act enforcement, US federal AI law, state laws)
2. Multi-agent trust composition (swarms, hierarchies, delegation)
3. Continuous learning drift detection
4. Cross-registry interoperability
5. Real-time insurance integration
6. Algorithmic impact assessments

Version: 2.0.0
"""

from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Dict, List, Optional, Tuple, Any, Set, Callable
from datetime import datetime, date, timedelta
from abc import ABC, abstractmethod
import json
import hashlib


# =============================================================================
# SECTION 1: REGULATORY HORIZON TRACKING
# =============================================================================

class RegulatoryStatus(Enum):
    """Status of regulatory requirements."""
    PROPOSED = "proposed"           # Under discussion
    DRAFT = "draft"                 # Draft text published
    ADOPTED = "adopted"             # Passed but not enforced
    ENFORCED = "enforced"           # Currently in force
    SUPERSEDED = "superseded"       # Replaced by newer regulation


class Jurisdiction(Enum):
    """Regulatory jurisdictions."""
    EU = "eu"
    US_FEDERAL = "us_federal"
    US_CALIFORNIA = "us_ca"
    US_COLORADO = "us_co"
    US_TEXAS = "us_tx"
    US_NEW_YORK = "us_ny"
    UK = "uk"
    CHINA = "cn"
    JAPAN = "jp"
    CANADA = "ca"
    AUSTRALIA = "au"
    SINGAPORE = "sg"
    INTERNATIONAL = "international"


@dataclass
class RegulatoryRequirement:
    """Represents a current or upcoming regulatory requirement."""
    requirement_id: str
    name: str
    jurisdiction: Jurisdiction
    status: RegulatoryStatus
    
    # Timeline
    proposal_date: Optional[date] = None
    adoption_date: Optional[date] = None
    enforcement_date: Optional[date] = None
    
    # Applicability
    applies_to_high_risk: bool = True
    applies_to_general_purpose: bool = False
    risk_categories: List[str] = field(default_factory=list)
    
    # Requirements mapping to ATSF dimensions
    dimension_requirements: Dict[str, float] = field(default_factory=dict)  # Min scores
    
    # Specific obligations
    obligations: List[str] = field(default_factory=list)
    
    # ATSF mapping
    atsf_controls: List[str] = field(default_factory=list)
    
    def is_applicable(self, target_date: date) -> bool:
        """Check if requirement is applicable at a given date."""
        if self.status == RegulatoryStatus.SUPERSEDED:
            return False
        if self.enforcement_date and target_date >= self.enforcement_date:
            return True
        return False
    
    def days_until_enforcement(self) -> Optional[int]:
        """Days until enforcement (None if already enforced or unknown)."""
        if not self.enforcement_date:
            return None
        delta = self.enforcement_date - date.today()
        return max(0, delta.days)


class RegulatoryHorizonTracker:
    """
    Tracks current and upcoming regulatory requirements.
    
    Enables proactive compliance planning rather than reactive scrambling.
    """
    
    def __init__(self):
        self.requirements: Dict[str, RegulatoryRequirement] = {}
        self._load_known_requirements()
    
    def _load_known_requirements(self):
        """Load known regulatory requirements and timeline."""
        
        # EU AI Act - Phased enforcement 2024-2027
        self.add_requirement(RegulatoryRequirement(
            requirement_id="eu_ai_act_prohibited",
            name="EU AI Act - Prohibited Practices",
            jurisdiction=Jurisdiction.EU,
            status=RegulatoryStatus.ENFORCED,
            adoption_date=date(2024, 8, 1),
            enforcement_date=date(2025, 2, 2),
            applies_to_high_risk=True,
            applies_to_general_purpose=True,
            obligations=[
                "No social scoring systems",
                "No real-time biometric identification (with exceptions)",
                "No emotion recognition in workplace/education",
                "No cognitive behavioral manipulation",
            ],
            atsf_controls=["prohibited_use_check", "purpose_limitation"]
        ))
        
        self.add_requirement(RegulatoryRequirement(
            requirement_id="eu_ai_act_gpai",
            name="EU AI Act - General Purpose AI",
            jurisdiction=Jurisdiction.EU,
            status=RegulatoryStatus.ADOPTED,
            adoption_date=date(2024, 8, 1),
            enforcement_date=date(2025, 8, 2),
            applies_to_high_risk=False,
            applies_to_general_purpose=True,
            dimension_requirements={
                "observability": 60,
                "governance": 50,
            },
            obligations=[
                "Technical documentation",
                "Copyright compliance information",
                "Training data summary",
            ],
            atsf_controls=["documentation_complete", "training_data_provenance"]
        ))
        
        self.add_requirement(RegulatoryRequirement(
            requirement_id="eu_ai_act_high_risk",
            name="EU AI Act - High-Risk AI Systems",
            jurisdiction=Jurisdiction.EU,
            status=RegulatoryStatus.ADOPTED,
            adoption_date=date(2024, 8, 1),
            enforcement_date=date(2026, 8, 2),
            applies_to_high_risk=True,
            applies_to_general_purpose=False,
            risk_categories=["healthcare", "finance", "legal", "hr", "education", "law_enforcement"],
            dimension_requirements={
                "governance": 70,
                "observability": 70,
                "security": 65,
                "provenance": 60,
            },
            obligations=[
                "Risk management system (Art. 9)",
                "Data governance (Art. 10)",
                "Technical documentation (Art. 11)",
                "Record-keeping (Art. 12)",
                "Transparency (Art. 13)",
                "Human oversight (Art. 14)",
                "Accuracy, robustness, cybersecurity (Art. 15)",
                "Conformity assessment",
                "CE marking",
                "Registration in EU database",
            ],
            atsf_controls=[
                "risk_management_system",
                "data_governance",
                "technical_documentation",
                "audit_logging",
                "human_oversight",
                "accuracy_monitoring",
                "conformity_assessment",
            ]
        ))
        
        # US Colorado AI Act (SB 205) - 2026
        self.add_requirement(RegulatoryRequirement(
            requirement_id="us_co_ai_act",
            name="Colorado AI Act (SB 24-205)",
            jurisdiction=Jurisdiction.US_COLORADO,
            status=RegulatoryStatus.ADOPTED,
            adoption_date=date(2024, 5, 17),
            enforcement_date=date(2026, 2, 1),
            applies_to_high_risk=True,
            applies_to_general_purpose=False,
            risk_categories=["employment", "finance", "healthcare", "housing", "insurance", "legal"],
            dimension_requirements={
                "governance": 60,
                "observability": 60,
            },
            obligations=[
                "Risk management policy",
                "Impact assessment for high-risk decisions",
                "Consumer disclosure of AI use",
                "Consumer right to appeal AI decisions",
                "Annual review of AI systems",
            ],
            atsf_controls=[
                "risk_management_policy",
                "impact_assessment",
                "consumer_disclosure",
                "appeal_mechanism",
                "annual_review",
            ]
        ))
        
        # California AI Transparency (proposed)
        self.add_requirement(RegulatoryRequirement(
            requirement_id="us_ca_ai_transparency",
            name="California AI Transparency Act (Proposed)",
            jurisdiction=Jurisdiction.US_CALIFORNIA,
            status=RegulatoryStatus.PROPOSED,
            applies_to_high_risk=True,
            applies_to_general_purpose=True,
            obligations=[
                "Disclosure when interacting with AI",
                "Watermarking of AI-generated content",
                "Training data disclosure",
            ],
            atsf_controls=["ai_disclosure", "content_watermarking", "training_transparency"]
        ))
        
        # UK AI Safety Framework
        self.add_requirement(RegulatoryRequirement(
            requirement_id="uk_ai_safety",
            name="UK AI Safety Framework",
            jurisdiction=Jurisdiction.UK,
            status=RegulatoryStatus.DRAFT,
            applies_to_high_risk=True,
            applies_to_general_purpose=True,
            dimension_requirements={
                "security": 70,
                "behavioral": 65,
            },
            obligations=[
                "Safety testing for frontier models",
                "Dangerous capability evaluations",
                "Incident reporting to AI Safety Institute",
            ],
            atsf_controls=["safety_testing", "capability_evaluation", "incident_reporting"]
        ))
        
        # ISO 42001 (Already in force)
        self.add_requirement(RegulatoryRequirement(
            requirement_id="iso_42001",
            name="ISO/IEC 42001 AI Management System",
            jurisdiction=Jurisdiction.INTERNATIONAL,
            status=RegulatoryStatus.ENFORCED,
            enforcement_date=date(2023, 12, 18),
            applies_to_high_risk=True,
            applies_to_general_purpose=True,
            dimension_requirements={
                "governance": 70,
                "observability": 65,
                "track_record": 60,
            },
            obligations=[
                "AI policy establishment",
                "Risk assessment process",
                "Objectives and planning",
                "Support and resources",
                "Operational controls",
                "Performance evaluation",
                "Continuous improvement",
            ],
            atsf_controls=["ai_policy", "risk_process", "performance_monitoring", "continuous_improvement"]
        ))
        
        # Anticipated: US Federal AI Legislation (2026-2027)
        self.add_requirement(RegulatoryRequirement(
            requirement_id="us_federal_ai_anticipated",
            name="US Federal AI Framework (Anticipated)",
            jurisdiction=Jurisdiction.US_FEDERAL,
            status=RegulatoryStatus.PROPOSED,
            applies_to_high_risk=True,
            applies_to_general_purpose=False,
            risk_categories=["critical_infrastructure", "healthcare", "finance", "government"],
            obligations=[
                "Algorithmic impact assessment",
                "Bias testing and mitigation",
                "Security standards",
                "Incident reporting",
            ],
            atsf_controls=["impact_assessment", "bias_testing", "security_baseline", "incident_reporting"]
        ))
    
    def add_requirement(self, req: RegulatoryRequirement):
        """Add or update a regulatory requirement."""
        self.requirements[req.requirement_id] = req
    
    def get_applicable_requirements(
        self,
        jurisdictions: List[Jurisdiction],
        target_date: Optional[date] = None,
        include_upcoming: bool = True,
        risk_categories: Optional[List[str]] = None
    ) -> List[RegulatoryRequirement]:
        """Get requirements applicable to given jurisdictions and date."""
        target = target_date or date.today()
        applicable = []
        
        for req in self.requirements.values():
            if req.jurisdiction not in jurisdictions:
                continue
            
            if risk_categories and req.risk_categories:
                if not any(cat in req.risk_categories for cat in risk_categories):
                    continue
            
            if req.is_applicable(target):
                applicable.append(req)
            elif include_upcoming and req.enforcement_date and req.enforcement_date > target:
                applicable.append(req)
        
        return sorted(applicable, key=lambda r: r.enforcement_date or date.max)
    
    def get_compliance_roadmap(
        self,
        jurisdictions: List[Jurisdiction],
        current_scores: Dict[str, float],
        risk_categories: Optional[List[str]] = None
    ) -> List[Dict]:
        """Generate compliance roadmap with gaps and timelines."""
        roadmap = []
        
        requirements = self.get_applicable_requirements(
            jurisdictions, include_upcoming=True, risk_categories=risk_categories
        )
        
        for req in requirements:
            gaps = []
            for dim, min_score in req.dimension_requirements.items():
                current = current_scores.get(dim, 0)
                if current < min_score:
                    gaps.append({
                        "dimension": dim,
                        "current": current,
                        "required": min_score,
                        "gap": min_score - current
                    })
            
            days_remaining = req.days_until_enforcement()
            
            roadmap.append({
                "requirement_id": req.requirement_id,
                "name": req.name,
                "jurisdiction": req.jurisdiction.value,
                "status": req.status.value,
                "enforcement_date": req.enforcement_date.isoformat() if req.enforcement_date else "TBD",
                "days_until_enforcement": days_remaining,
                "urgency": self._calculate_urgency(days_remaining, len(gaps)),
                "dimension_gaps": gaps,
                "missing_controls": [c for c in req.atsf_controls],  # Would check against implemented
                "obligations_count": len(req.obligations),
            })
        
        return sorted(roadmap, key=lambda r: (r["urgency"], r.get("days_until_enforcement") or 9999), reverse=True)
    
    def _calculate_urgency(self, days_remaining: Optional[int], gap_count: int) -> str:
        """Calculate urgency level."""
        if days_remaining is None:
            return "LOW" if gap_count == 0 else "MEDIUM"
        
        if days_remaining <= 0:
            return "CRITICAL" if gap_count > 0 else "COMPLIANT"
        elif days_remaining <= 90:
            return "HIGH" if gap_count > 0 else "ON_TRACK"
        elif days_remaining <= 365:
            return "MEDIUM" if gap_count > 0 else "ON_TRACK"
        else:
            return "LOW"


# =============================================================================
# SECTION 2: MULTI-AGENT TRUST COMPOSITION
# =============================================================================

class AgentRelationship(Enum):
    """Types of relationships between agents."""
    ORCHESTRATOR = "orchestrator"      # Controls other agents
    SUBORDINATE = "subordinate"        # Controlled by another agent
    PEER = "peer"                      # Equal collaboration
    DELEGATOR = "delegator"            # Delegates tasks
    DELEGATE = "delegate"              # Receives delegated tasks
    AUDITOR = "auditor"               # Monitors other agents
    AUDITEE = "auditee"               # Being monitored


@dataclass
class AgentNode:
    """Represents an agent in a multi-agent system."""
    agent_id: str
    trust_score: float
    trust_tier: int  # 0-5
    capabilities: Set[str]
    max_risk_level: int  # 1-5
    relationships: Dict[str, AgentRelationship] = field(default_factory=dict)


@dataclass
class TrustDelegation:
    """Represents delegated trust between agents."""
    delegator_id: str
    delegate_id: str
    delegated_capabilities: Set[str]
    max_delegated_risk: int
    expiry: Optional[datetime] = None
    conditions: Dict[str, Any] = field(default_factory=dict)
    revocable: bool = True


class MultiAgentTrustComposer:
    """
    Computes trust for multi-agent systems.
    
    Key principles:
    1. Chain trust cannot exceed weakest link
    2. Delegation cannot exceed delegator's trust
    3. Orchestrator responsibility for subordinates
    4. Aggregation risk in agent swarms
    """
    
    def __init__(self):
        self.agents: Dict[str, AgentNode] = {}
        self.delegations: List[TrustDelegation] = {}
    
    def register_agent(self, agent: AgentNode):
        """Register an agent in the multi-agent system."""
        self.agents[agent.agent_id] = agent
    
    def add_delegation(self, delegation: TrustDelegation):
        """Add a trust delegation between agents."""
        self.delegations.append(delegation)
    
    def compute_chain_trust(self, agent_chain: List[str]) -> Tuple[float, int, List[str]]:
        """
        Compute trust for a chain of agents (e.g., orchestrator → sub-agent → tool).
        
        Returns:
            Tuple of (effective_trust_score, max_risk_level, warnings)
        """
        if not agent_chain:
            return 0.0, 0, ["Empty agent chain"]
        
        warnings = []
        scores = []
        risk_levels = []
        
        for agent_id in agent_chain:
            agent = self.agents.get(agent_id)
            if not agent:
                warnings.append(f"Unknown agent in chain: {agent_id}")
                scores.append(0)
                risk_levels.append(1)
            else:
                scores.append(agent.trust_score)
                risk_levels.append(agent.max_risk_level)
        
        # Chain trust is limited by weakest link
        effective_score = min(scores) if scores else 0
        
        # Risk level is limited by most restrictive agent
        effective_risk = min(risk_levels) if risk_levels else 1
        
        # Warn about significant trust differentials
        if scores and max(scores) - min(scores) > 200:
            warnings.append(
                f"Large trust differential in chain: {max(scores)} vs {min(scores)}. "
                "Consider homogenizing agent trust levels."
            )
        
        return effective_score, effective_risk, warnings
    
    def compute_swarm_trust(
        self, 
        agent_ids: List[str],
        aggregation_function: str = "conservative"
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Compute trust for a swarm of peer agents.
        
        Aggregation functions:
        - "conservative": min(scores) - Use lowest trust
        - "average": mean(scores) - Average trust
        - "weighted_vote": Weighted by individual trust
        - "byzantine": Tolerates f faulty agents in 3f+1 swarm
        """
        scores = []
        for agent_id in agent_ids:
            agent = self.agents.get(agent_id)
            if agent:
                scores.append(agent.trust_score)
        
        if not scores:
            return 0.0, {"error": "No valid agents in swarm"}
        
        metadata = {
            "swarm_size": len(scores),
            "min_score": min(scores),
            "max_score": max(scores),
            "mean_score": sum(scores) / len(scores),
            "aggregation": aggregation_function,
        }
        
        if aggregation_function == "conservative":
            effective = min(scores)
        elif aggregation_function == "average":
            effective = sum(scores) / len(scores)
        elif aggregation_function == "weighted_vote":
            # Higher trust agents have more weight
            total_weight = sum(scores)
            effective = sum(s * s for s in scores) / total_weight if total_weight > 0 else 0
        elif aggregation_function == "byzantine":
            # Byzantine fault tolerance: need 2f+1 honest for 3f+1 total
            # Use median to tolerate up to f faulty scores
            sorted_scores = sorted(scores)
            n = len(sorted_scores)
            effective = sorted_scores[n // 2]
            metadata["byzantine_tolerance"] = (n - 1) // 3
        else:
            effective = min(scores)
        
        return effective, metadata
    
    def validate_delegation(
        self,
        delegator_id: str,
        delegate_id: str,
        requested_capabilities: Set[str],
        requested_risk_level: int
    ) -> Tuple[bool, List[str]]:
        """
        Validate if a delegation is permissible.
        
        Rules:
        1. Cannot delegate capabilities you don't have
        2. Cannot delegate higher risk than your own level
        3. Cannot delegate to agent with insufficient base trust
        """
        issues = []
        
        delegator = self.agents.get(delegator_id)
        delegate = self.agents.get(delegate_id)
        
        if not delegator:
            issues.append(f"Delegator {delegator_id} not found")
            return False, issues
        
        if not delegate:
            issues.append(f"Delegate {delegate_id} not found")
            return False, issues
        
        # Check capability coverage
        missing_caps = requested_capabilities - delegator.capabilities
        if missing_caps:
            issues.append(f"Cannot delegate capabilities not possessed: {missing_caps}")
        
        # Check risk level
        if requested_risk_level > delegator.max_risk_level:
            issues.append(
                f"Cannot delegate R{requested_risk_level} (delegator max: R{delegator.max_risk_level})"
            )
        
        # Check delegate's base trust
        required_tier = requested_risk_level - 1  # Minimum tier for risk level
        if delegate.trust_tier < required_tier:
            issues.append(
                f"Delegate trust tier T{delegate.trust_tier} insufficient for R{requested_risk_level}"
            )
        
        return len(issues) == 0, issues


# =============================================================================
# SECTION 3: CONTINUOUS LEARNING DRIFT DETECTION
# =============================================================================

@dataclass
class BehavioralBaseline:
    """Baseline behavioral metrics for drift detection."""
    agent_id: str
    established_at: datetime
    sample_size: int
    
    # Distribution parameters
    hallucination_rate_mean: float
    hallucination_rate_std: float
    refusal_rate_mean: float
    refusal_rate_std: float
    response_time_mean: float
    response_time_std: float
    
    # Capability bounds
    known_capabilities: Set[str]
    known_limitations: Set[str]


@dataclass
class DriftAlert:
    """Alert for detected behavioral drift."""
    alert_id: str
    agent_id: str
    detected_at: datetime
    drift_type: str  # "capability", "behavioral", "alignment"
    severity: str    # "low", "medium", "high", "critical"
    
    baseline_value: float
    current_value: float
    deviation_sigma: float
    
    description: str
    recommended_action: str


class ContinuousLearningMonitor:
    """
    Monitors for drift in continuously learning systems.
    
    Critical for maintaining trust in systems that update over time.
    """
    
    def __init__(self, alert_threshold_sigma: float = 2.0):
        self.baselines: Dict[str, BehavioralBaseline] = {}
        self.alert_threshold = alert_threshold_sigma
        self.alerts: List[DriftAlert] = []
    
    def establish_baseline(
        self,
        agent_id: str,
        historical_metrics: List[Dict[str, float]]
    ) -> BehavioralBaseline:
        """Establish behavioral baseline from historical data."""
        import statistics
        
        hallucination_rates = [m.get("hallucination_rate", 0) for m in historical_metrics]
        refusal_rates = [m.get("refusal_rate", 0) for m in historical_metrics]
        response_times = [m.get("response_time_ms", 0) for m in historical_metrics]
        
        baseline = BehavioralBaseline(
            agent_id=agent_id,
            established_at=datetime.utcnow(),
            sample_size=len(historical_metrics),
            hallucination_rate_mean=statistics.mean(hallucination_rates) if hallucination_rates else 0,
            hallucination_rate_std=statistics.stdev(hallucination_rates) if len(hallucination_rates) > 1 else 0.01,
            refusal_rate_mean=statistics.mean(refusal_rates) if refusal_rates else 0,
            refusal_rate_std=statistics.stdev(refusal_rates) if len(refusal_rates) > 1 else 0.01,
            response_time_mean=statistics.mean(response_times) if response_times else 0,
            response_time_std=statistics.stdev(response_times) if len(response_times) > 1 else 1,
            known_capabilities=set(),
            known_limitations=set(),
        )
        
        self.baselines[agent_id] = baseline
        return baseline
    
    def check_for_drift(
        self,
        agent_id: str,
        current_metrics: Dict[str, float]
    ) -> List[DriftAlert]:
        """Check current metrics against baseline for drift."""
        baseline = self.baselines.get(agent_id)
        if not baseline:
            return []
        
        alerts = []
        
        # Check hallucination rate drift
        if "hallucination_rate" in current_metrics:
            current = current_metrics["hallucination_rate"]
            deviation = abs(current - baseline.hallucination_rate_mean) / max(baseline.hallucination_rate_std, 0.001)
            
            if deviation > self.alert_threshold:
                severity = "critical" if deviation > 4 else "high" if deviation > 3 else "medium"
                alerts.append(DriftAlert(
                    alert_id=f"drift-{agent_id}-halluc-{datetime.utcnow().timestamp()}",
                    agent_id=agent_id,
                    detected_at=datetime.utcnow(),
                    drift_type="behavioral",
                    severity=severity,
                    baseline_value=baseline.hallucination_rate_mean,
                    current_value=current,
                    deviation_sigma=deviation,
                    description=f"Hallucination rate drifted {deviation:.1f}σ from baseline",
                    recommended_action="Review recent model updates or fine-tuning. Consider re-evaluation."
                ))
        
        # Check refusal rate drift (could indicate alignment shift)
        if "refusal_rate" in current_metrics:
            current = current_metrics["refusal_rate"]
            deviation = abs(current - baseline.refusal_rate_mean) / max(baseline.refusal_rate_std, 0.001)
            
            if deviation > self.alert_threshold:
                direction = "increased" if current > baseline.refusal_rate_mean else "decreased"
                severity = "high" if direction == "decreased" else "medium"  # Decreased refusal is more concerning
                
                alerts.append(DriftAlert(
                    alert_id=f"drift-{agent_id}-refusal-{datetime.utcnow().timestamp()}",
                    agent_id=agent_id,
                    detected_at=datetime.utcnow(),
                    drift_type="alignment",
                    severity=severity,
                    baseline_value=baseline.refusal_rate_mean,
                    current_value=current,
                    deviation_sigma=deviation,
                    description=f"Refusal rate {direction} {deviation:.1f}σ from baseline",
                    recommended_action="Investigate alignment stability. Decreased refusals may indicate safety degradation."
                ))
        
        self.alerts.extend(alerts)
        return alerts
    
    def get_trust_adjustment(self, agent_id: str) -> float:
        """
        Calculate trust score adjustment based on drift alerts.
        
        Returns multiplier (1.0 = no change, <1.0 = decrease trust)
        """
        recent_alerts = [
            a for a in self.alerts 
            if a.agent_id == agent_id and 
            (datetime.utcnow() - a.detected_at).days < 7
        ]
        
        if not recent_alerts:
            return 1.0
        
        # Accumulate penalties
        penalty = 0.0
        for alert in recent_alerts:
            if alert.severity == "critical":
                penalty += 0.15
            elif alert.severity == "high":
                penalty += 0.10
            elif alert.severity == "medium":
                penalty += 0.05
            else:
                penalty += 0.02
        
        return max(0.5, 1.0 - penalty)  # Cap at 50% reduction


# =============================================================================
# SECTION 4: CROSS-REGISTRY INTEROPERABILITY
# =============================================================================

@dataclass
class TrustAttestation:
    """
    Portable trust attestation for cross-registry interoperability.
    
    Allows trust scores to be shared across organizations/registries
    while maintaining verifiability.
    """
    attestation_id: str
    agent_id: str
    
    # Issuer information
    issuer_registry: str
    issuer_public_key: str
    issued_at: datetime
    expires_at: datetime
    
    # Trust claims
    trust_score: float
    trust_tier: int
    observation_tier: str
    confidence: float
    
    # Dimensional scores (for detailed verification)
    dimension_scores: Dict[str, float]
    
    # Scope and limitations
    valid_jurisdictions: List[str]
    valid_use_cases: List[str]
    limitations: List[str]
    
    # Cryptographic proof
    signature: str
    
    def is_valid(self) -> bool:
        """Check if attestation is currently valid."""
        now = datetime.utcnow()
        return self.issued_at <= now <= self.expires_at
    
    def to_portable_format(self) -> str:
        """Export to portable JSON format."""
        data = {
            "version": "1.0",
            "type": "atsf_trust_attestation",
            "attestation_id": self.attestation_id,
            "agent_id": self.agent_id,
            "issuer": {
                "registry": self.issuer_registry,
                "public_key": self.issuer_public_key,
            },
            "validity": {
                "issued_at": self.issued_at.isoformat(),
                "expires_at": self.expires_at.isoformat(),
            },
            "claims": {
                "trust_score": self.trust_score,
                "trust_tier": self.trust_tier,
                "observation_tier": self.observation_tier,
                "confidence": self.confidence,
                "dimensions": self.dimension_scores,
            },
            "scope": {
                "jurisdictions": self.valid_jurisdictions,
                "use_cases": self.valid_use_cases,
                "limitations": self.limitations,
            },
            "signature": self.signature,
        }
        return json.dumps(data, indent=2)


class TrustRegistry:
    """
    Trust registry that can interoperate with other registries.
    
    Enables a federated trust ecosystem where attestations from
    trusted registries are recognized.
    """
    
    def __init__(self, registry_id: str, registry_name: str):
        self.registry_id = registry_id
        self.registry_name = registry_name
        self.attestations: Dict[str, TrustAttestation] = {}
        self.trusted_registries: Dict[str, Dict] = {}  # Registry ID -> public key + trust level
    
    def trust_registry(self, registry_id: str, public_key: str, trust_level: float):
        """Add another registry as trusted for cross-validation."""
        self.trusted_registries[registry_id] = {
            "public_key": public_key,
            "trust_level": trust_level,  # 0-1, how much we trust their attestations
        }
    
    def issue_attestation(
        self,
        agent_id: str,
        trust_score: float,
        trust_tier: int,
        observation_tier: str,
        confidence: float,
        dimension_scores: Dict[str, float],
        validity_days: int = 90
    ) -> TrustAttestation:
        """Issue a new trust attestation."""
        now = datetime.utcnow()
        
        attestation = TrustAttestation(
            attestation_id=f"{self.registry_id}-{agent_id}-{now.strftime('%Y%m%d%H%M%S')}",
            agent_id=agent_id,
            issuer_registry=self.registry_id,
            issuer_public_key="[REGISTRY_PUBLIC_KEY]",  # Would be real key
            issued_at=now,
            expires_at=now + timedelta(days=validity_days),
            trust_score=trust_score,
            trust_tier=trust_tier,
            observation_tier=observation_tier,
            confidence=confidence,
            dimension_scores=dimension_scores,
            valid_jurisdictions=["global"],
            valid_use_cases=["general"],
            limitations=[],
            signature="[SIGNATURE]"  # Would be real signature
        )
        
        self.attestations[attestation.attestation_id] = attestation
        return attestation
    
    def verify_external_attestation(
        self,
        attestation: TrustAttestation
    ) -> Tuple[bool, float, List[str]]:
        """
        Verify an attestation from another registry.
        
        Returns:
            Tuple of (valid, adjusted_trust_score, issues)
        """
        issues = []
        
        # Check if we trust the issuing registry
        if attestation.issuer_registry not in self.trusted_registries:
            issues.append(f"Unknown registry: {attestation.issuer_registry}")
            return False, 0, issues
        
        registry_trust = self.trusted_registries[attestation.issuer_registry]["trust_level"]
        
        # Check validity period
        if not attestation.is_valid():
            issues.append("Attestation expired or not yet valid")
            return False, 0, issues
        
        # Would verify signature here
        # signature_valid = self._verify_signature(attestation)
        signature_valid = True  # Placeholder
        
        if not signature_valid:
            issues.append("Invalid signature")
            return False, 0, issues
        
        # Adjust trust score based on registry trust level
        adjusted_score = attestation.trust_score * registry_trust
        
        if registry_trust < 1.0:
            issues.append(f"Score adjusted by registry trust factor: {registry_trust}")
        
        return True, adjusted_score, issues


# =============================================================================
# SECTION 5: EXTENSIBLE CONTROL FRAMEWORK
# =============================================================================

class ControlInterface(ABC):
    """Abstract interface for pluggable controls."""
    
    @property
    @abstractmethod
    def control_id(self) -> str:
        pass
    
    @property
    @abstractmethod
    def control_name(self) -> str:
        pass
    
    @abstractmethod
    def evaluate(self, context: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """
        Evaluate the control.
        
        Returns:
            Tuple of (passed, details)
        """
        pass


class ControlRegistry:
    """Registry for extensible controls that can be added as regulations evolve."""
    
    def __init__(self):
        self.controls: Dict[str, ControlInterface] = {}
        self.required_controls: Dict[str, List[str]] = {}  # requirement_id -> control_ids
    
    def register_control(self, control: ControlInterface):
        """Register a new control."""
        self.controls[control.control_id] = control
    
    def map_requirement_to_controls(self, requirement_id: str, control_ids: List[str]):
        """Map a regulatory requirement to its implementing controls."""
        self.required_controls[requirement_id] = control_ids
    
    def evaluate_requirement(
        self,
        requirement_id: str,
        context: Dict[str, Any]
    ) -> Tuple[bool, Dict[str, Any]]:
        """Evaluate all controls for a requirement."""
        control_ids = self.required_controls.get(requirement_id, [])
        
        results = {}
        all_passed = True
        
        for control_id in control_ids:
            control = self.controls.get(control_id)
            if control:
                passed, details = control.evaluate(context)
                results[control_id] = {"passed": passed, "details": details}
                if not passed:
                    all_passed = False
            else:
                results[control_id] = {"passed": False, "details": {"error": "Control not implemented"}}
                all_passed = False
        
        return all_passed, results


# =============================================================================
# SECTION 6: DEMO
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF v2.0 - Future Requirements Alignment")
    print("=" * 70)
    
    # Regulatory Horizon Demo
    print("\n--- Regulatory Horizon Tracking ---")
    tracker = RegulatoryHorizonTracker()
    
    roadmap = tracker.get_compliance_roadmap(
        jurisdictions=[Jurisdiction.EU, Jurisdiction.US_COLORADO],
        current_scores={
            "governance": 55,
            "observability": 60,
            "security": 70,
            "provenance": 50,
        },
        risk_categories=["healthcare", "finance"]
    )
    
    print(f"\nCompliance Roadmap ({len(roadmap)} requirements):")
    for item in roadmap[:5]:
        print(f"\n  {item['name']}")
        print(f"    Status: {item['status']} | Enforcement: {item['enforcement_date']}")
        print(f"    Urgency: {item['urgency']} | Days remaining: {item['days_until_enforcement']}")
        if item['dimension_gaps']:
            gaps_str = [f"{g['dimension']}: {g['current']}/{g['required']}" for g in item['dimension_gaps']]
            print(f"    Gaps: {gaps_str}")
    
    # Multi-Agent Trust Demo
    print("\n--- Multi-Agent Trust Composition ---")
    composer = MultiAgentTrustComposer()
    
    # Register agents in a hierarchy
    composer.register_agent(AgentNode(
        agent_id="orchestrator",
        trust_score=800,
        trust_tier=4,
        capabilities={"reasoning", "planning", "delegation"},
        max_risk_level=4
    ))
    composer.register_agent(AgentNode(
        agent_id="code-agent",
        trust_score=650,
        trust_tier=3,
        capabilities={"code_generation", "code_review"},
        max_risk_level=3
    ))
    composer.register_agent(AgentNode(
        agent_id="data-agent",
        trust_score=500,
        trust_tier=2,
        capabilities={"data_query", "data_analysis"},
        max_risk_level=2
    ))
    
    # Compute chain trust
    chain_trust, chain_risk, warnings = composer.compute_chain_trust(
        ["orchestrator", "code-agent", "data-agent"]
    )
    print(f"\nChain Trust: {chain_trust} (limited by weakest link)")
    print(f"Chain Max Risk: R{chain_risk}")
    if warnings:
        print(f"Warnings: {warnings}")
    
    # Compute swarm trust
    swarm_trust, swarm_meta = composer.compute_swarm_trust(
        ["code-agent", "data-agent", "code-agent"],  # Simulating peer swarm
        aggregation_function="byzantine"
    )
    print(f"\nSwarm Trust (Byzantine): {swarm_trust}")
    print(f"Swarm Metadata: {swarm_meta}")
    
    # Drift Detection Demo
    print("\n--- Continuous Learning Drift Detection ---")
    monitor = ContinuousLearningMonitor(alert_threshold_sigma=2.0)
    
    # Establish baseline
    historical = [
        {"hallucination_rate": 0.05, "refusal_rate": 0.15, "response_time_ms": 200},
        {"hallucination_rate": 0.04, "refusal_rate": 0.14, "response_time_ms": 210},
        {"hallucination_rate": 0.06, "refusal_rate": 0.16, "response_time_ms": 195},
        {"hallucination_rate": 0.05, "refusal_rate": 0.15, "response_time_ms": 205},
    ]
    baseline = monitor.establish_baseline("test-agent", historical)
    print(f"\nBaseline established: hallucination={baseline.hallucination_rate_mean:.3f}±{baseline.hallucination_rate_std:.3f}")
    
    # Check for drift (normal)
    alerts = monitor.check_for_drift("test-agent", {"hallucination_rate": 0.055, "refusal_rate": 0.14})
    print(f"Normal metrics: {len(alerts)} alerts")
    
    # Check for drift (anomalous)
    alerts = monitor.check_for_drift("test-agent", {"hallucination_rate": 0.15, "refusal_rate": 0.05})
    print(f"Anomalous metrics: {len(alerts)} alerts")
    for alert in alerts:
        print(f"  [{alert.severity.upper()}] {alert.description}")
    
    # Trust Registry Demo
    print("\n--- Cross-Registry Interoperability ---")
    registry_a = TrustRegistry("registry-alpha", "Alpha Trust Registry")
    registry_b = TrustRegistry("registry-beta", "Beta Trust Registry")
    
    # Alpha trusts Beta at 80%
    registry_a.trust_registry("registry-beta", "BETA_PUBLIC_KEY", 0.8)
    
    # Beta issues attestation
    attestation = registry_b.issue_attestation(
        agent_id="external-agent",
        trust_score=750,
        trust_tier=4,
        observation_tier="WHITE_BOX",
        confidence=0.9,
        dimension_scores={"security": 80, "governance": 70}
    )
    
    # Alpha verifies Beta's attestation
    valid, adjusted_score, issues = registry_a.verify_external_attestation(attestation)
    print(f"\nExternal attestation verification:")
    print(f"  Original score: {attestation.trust_score}")
    print(f"  Adjusted score: {adjusted_score} (after registry trust factor)")
    print(f"  Valid: {valid}")
    if issues:
        print(f"  Notes: {issues}")
    
    print("\n" + "=" * 70)
    print("Future-Proofing Features:")
    print("  ✓ Regulatory horizon tracking with compliance roadmap")
    print("  ✓ Multi-agent trust composition (chains, swarms, delegation)")
    print("  ✓ Continuous learning drift detection")
    print("  ✓ Cross-registry interoperability with portable attestations")
    print("  ✓ Extensible control framework for new regulations")
    print("=" * 70)
