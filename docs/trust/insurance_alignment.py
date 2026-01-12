"""
AI Agent Trust Scoring Framework (ATSF)
Insurance & Regulatory Alignment Layer

Addresses Red Team Finding: "Liability and Insurance Landscape"
- Trust Score must map to actuarial risk metrics
- Align with NIST AI RMF, EU AI Act, ISO 42001
- Enable insurance underwriting, not just technical validation

Version: 2.0.0
"""

from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Dict, List, Optional, Tuple, Any, Set
from datetime import datetime, timedelta
import json
import math


# =============================================================================
# SECTION 1: REGULATORY FRAMEWORK ALIGNMENT
# =============================================================================

class RegulatoryFramework(Enum):
    """Supported regulatory frameworks for compliance mapping."""
    NIST_AI_RMF = "nist_ai_rmf"           # US: NIST AI Risk Management Framework
    EU_AI_ACT = "eu_ai_act"               # EU: Artificial Intelligence Act
    ISO_42001 = "iso_42001"               # International: AI Management Systems
    SOC2_TYPE2 = "soc2_type2"             # Security compliance
    HIPAA = "hipaa"                       # Healthcare (US)
    PCI_DSS = "pci_dss"                   # Payment card industry


class NISTTier(IntEnum):
    """NIST AI RMF organizational tiers."""
    TIER_1_PARTIAL = 1      # Risk management is ad hoc
    TIER_2_RISK_INFORMED = 2  # Risk-aware but not org-wide
    TIER_3_REPEATABLE = 3   # Org-wide policies exist
    TIER_4_ADAPTIVE = 4     # Continuous improvement


class EUAIActRiskCategory(Enum):
    """EU AI Act risk categories."""
    MINIMAL = "minimal"           # Chatbots with disclosure
    LIMITED = "limited"           # Transparency obligations
    HIGH_RISK = "high_risk"       # Strict requirements
    UNACCEPTABLE = "unacceptable"  # Prohibited


@dataclass
class NISTRMFMapping:
    """Maps ATSF trust score to NIST AI RMF compliance."""
    
    # NIST AI RMF functions
    govern_score: float    # GOVERN function (0-100)
    map_score: float       # MAP function (0-100)
    measure_score: float   # MEASURE function (0-100)
    manage_score: float    # MANAGE function (0-100)
    
    @property
    def overall_tier(self) -> NISTTier:
        """Compute overall NIST tier from function scores."""
        avg = (self.govern_score + self.map_score + 
               self.measure_score + self.manage_score) / 4
        
        if avg >= 85:
            return NISTTier.TIER_4_ADAPTIVE
        elif avg >= 65:
            return NISTTier.TIER_3_REPEATABLE
        elif avg >= 40:
            return NISTTier.TIER_2_RISK_INFORMED
        else:
            return NISTTier.TIER_1_PARTIAL
    
    def generate_compliance_report(self) -> Dict:
        """Generate NIST-aligned compliance report."""
        return {
            "framework": "NIST AI RMF 1.0",
            "overall_tier": self.overall_tier.name,
            "functions": {
                "GOVERN": {
                    "score": self.govern_score,
                    "status": "compliant" if self.govern_score >= 60 else "needs_improvement"
                },
                "MAP": {
                    "score": self.map_score,
                    "status": "compliant" if self.map_score >= 60 else "needs_improvement"
                },
                "MEASURE": {
                    "score": self.measure_score,
                    "status": "compliant" if self.measure_score >= 60 else "needs_improvement"
                },
                "MANAGE": {
                    "score": self.manage_score,
                    "status": "compliant" if self.manage_score >= 60 else "needs_improvement"
                }
            },
            "trustworthy_ai_characteristics": {
                "valid_reliable": self.measure_score >= 70,
                "safe": self.manage_score >= 70,
                "secure_resilient": self.govern_score >= 70,
                "accountable_transparent": self.map_score >= 70,
                "explainable_interpretable": self.measure_score >= 65,
                "privacy_enhanced": self.govern_score >= 65,
                "fair_bias_managed": self.measure_score >= 65,
            }
        }


@dataclass
class EUAIActMapping:
    """Maps ATSF assessment to EU AI Act compliance."""
    
    risk_category: EUAIActRiskCategory
    intended_purpose: str
    deployer_type: str  # "provider" or "deployer"
    
    # Article-specific compliance
    article_9_risk_management: bool = False    # Risk management system
    article_10_data_governance: bool = False   # Training data quality
    article_11_documentation: bool = False     # Technical documentation
    article_12_record_keeping: bool = False    # Automatic logging
    article_13_transparency: bool = False      # Information to deployers
    article_14_human_oversight: bool = False   # Human oversight measures
    article_15_accuracy: bool = False          # Accuracy, robustness, cybersecurity
    
    def is_compliant(self) -> bool:
        """Check if compliant for given risk category."""
        if self.risk_category == EUAIActRiskCategory.UNACCEPTABLE:
            return False  # Prohibited
        
        if self.risk_category == EUAIActRiskCategory.HIGH_RISK:
            # Must satisfy all articles 9-15
            return all([
                self.article_9_risk_management,
                self.article_10_data_governance,
                self.article_11_documentation,
                self.article_12_record_keeping,
                self.article_13_transparency,
                self.article_14_human_oversight,
                self.article_15_accuracy,
            ])
        
        if self.risk_category == EUAIActRiskCategory.LIMITED:
            # Transparency obligations only
            return self.article_13_transparency
        
        return True  # Minimal risk
    
    def generate_conformity_assessment(self) -> Dict:
        """Generate EU AI Act conformity assessment."""
        articles_status = {
            "Article 9 (Risk Management)": self.article_9_risk_management,
            "Article 10 (Data Governance)": self.article_10_data_governance,
            "Article 11 (Technical Documentation)": self.article_11_documentation,
            "Article 12 (Record Keeping)": self.article_12_record_keeping,
            "Article 13 (Transparency)": self.article_13_transparency,
            "Article 14 (Human Oversight)": self.article_14_human_oversight,
            "Article 15 (Accuracy & Security)": self.article_15_accuracy,
        }
        
        return {
            "framework": "EU AI Act",
            "risk_category": self.risk_category.value,
            "intended_purpose": self.intended_purpose,
            "deployer_type": self.deployer_type,
            "conformity_status": "COMPLIANT" if self.is_compliant() else "NON-COMPLIANT",
            "articles": articles_status,
            "required_actions": [
                art for art, status in articles_status.items() if not status
            ] if self.risk_category == EUAIActRiskCategory.HIGH_RISK else []
        }


# =============================================================================
# SECTION 2: ACTUARIAL RISK METRICS
# =============================================================================

@dataclass
class ActuarialRiskProfile:
    """
    Risk profile aligned with insurance underwriting requirements.
    
    Red Team insight: "Insurers need a quantitative, 'White Box' metric 
    to price premiums. 'Black Box' AI is effectively uninsurable because 
    the risk is unquantifiable."
    """
    
    agent_id: str
    evaluation_date: datetime
    
    # Frequency metrics (how often incidents occur)
    expected_incident_frequency: float  # Incidents per 1000 operations
    incident_frequency_variance: float  # Variance for confidence
    
    # Severity metrics (impact when incidents occur)
    expected_loss_per_incident: float   # $ expected loss
    max_probable_loss: float            # 99th percentile loss
    tail_risk_var_99: float            # Value at Risk (99%)
    
    # Operational metrics
    mean_time_between_failures: float   # Hours
    mean_time_to_recovery: float        # Hours
    uptime_percentage: float            # 0-100
    
    # Coverage recommendations
    recommended_coverage_limit: float   # $ coverage needed
    recommended_deductible: float       # $ deductible
    risk_premium_basis_points: int      # Premium as bps of coverage
    
    def calculate_annual_expected_loss(self, annual_operations: int) -> float:
        """Calculate expected annual loss."""
        expected_incidents = (self.expected_incident_frequency / 1000) * annual_operations
        return expected_incidents * self.expected_loss_per_incident
    
    def calculate_premium(self, coverage_limit: float) -> float:
        """Calculate recommended annual premium."""
        return coverage_limit * (self.risk_premium_basis_points / 10000)
    
    def to_underwriting_report(self) -> Dict:
        """Generate report for insurance underwriters."""
        return {
            "agent_id": self.agent_id,
            "evaluation_date": self.evaluation_date.isoformat(),
            "risk_classification": self._risk_classification(),
            "frequency_analysis": {
                "expected_incidents_per_1000_ops": self.expected_incident_frequency,
                "variance": self.incident_frequency_variance,
                "confidence_interval_95": (
                    max(0, self.expected_incident_frequency - 1.96 * math.sqrt(self.incident_frequency_variance)),
                    self.expected_incident_frequency + 1.96 * math.sqrt(self.incident_frequency_variance)
                )
            },
            "severity_analysis": {
                "expected_loss_per_incident_usd": self.expected_loss_per_incident,
                "max_probable_loss_usd": self.max_probable_loss,
                "var_99_usd": self.tail_risk_var_99,
            },
            "operational_metrics": {
                "mtbf_hours": self.mean_time_between_failures,
                "mttr_hours": self.mean_time_to_recovery,
                "uptime_percent": self.uptime_percentage,
            },
            "coverage_recommendation": {
                "limit_usd": self.recommended_coverage_limit,
                "deductible_usd": self.recommended_deductible,
                "premium_bps": self.risk_premium_basis_points,
                "estimated_annual_premium_usd": self.calculate_premium(self.recommended_coverage_limit),
            }
        }
    
    def _risk_classification(self) -> str:
        """Classify risk tier for underwriting."""
        # Based on incident frequency and severity
        risk_score = (
            self.expected_incident_frequency * 0.4 +
            (self.expected_loss_per_incident / 10000) * 0.3 +
            (100 - self.uptime_percentage) * 0.3
        )
        
        if risk_score < 5:
            return "PREFERRED"
        elif risk_score < 15:
            return "STANDARD"
        elif risk_score < 30:
            return "SUBSTANDARD"
        else:
            return "DECLINE"


# =============================================================================
# SECTION 3: TRUST SCORE TO ACTUARIAL CONVERTER
# =============================================================================

class TrustToActuarialConverter:
    """
    Converts ATSF trust scores to actuarial risk metrics.
    
    This bridges the gap between technical trust scoring and 
    insurance-industry risk quantification.
    """
    
    # Calibration factors (would be tuned from historical data)
    BASE_INCIDENT_RATE = 50.0  # Per 1000 ops for T0 agent
    INCIDENT_RATE_DECAY = 0.6  # Exponential decay per tier
    
    BASE_LOSS_SEVERITY = 50000  # $ for T0 agent
    SEVERITY_DECAY = 0.5
    
    def __init__(self, calibration_data: Optional[Dict] = None):
        """Initialize with optional calibration data."""
        self.calibration = calibration_data or {}
    
    def convert(
        self,
        agent_id: str,
        trust_score: float,
        confidence: float,
        risk_context: Dict[str, Any]
    ) -> ActuarialRiskProfile:
        """
        Convert trust assessment to actuarial profile.
        
        Args:
            agent_id: Agent identifier
            trust_score: ATSF composite score (0-1000)
            confidence: Confidence in score (0-1)
            risk_context: Domain-specific risk factors
        """
        tier = self._score_to_tier(trust_score)
        
        # Calculate incident frequency (decays with trust)
        incident_freq = self.BASE_INCIDENT_RATE * (self.INCIDENT_RATE_DECAY ** tier)
        
        # Adjust for confidence (lower confidence = higher uncertainty)
        freq_variance = incident_freq * (1 - confidence) * 2
        
        # Calculate severity metrics
        base_severity = self.BASE_LOSS_SEVERITY * (self.SEVERITY_DECAY ** tier)
        
        # Adjust for domain risk factors
        domain_multiplier = self._domain_risk_multiplier(risk_context)
        adjusted_severity = base_severity * domain_multiplier
        
        # Calculate tail risk (99th percentile)
        # Using log-normal assumption for loss distribution
        var_99 = adjusted_severity * 3.5  # Simplified; would use proper distribution
        
        # Operational metrics from trust score
        mtbf = 100 * (1 + tier)  # Hours between failures
        mttr = 4 / (1 + tier * 0.5)  # Hours to recover
        uptime = 95 + (tier * 1.0)  # Percentage
        
        # Coverage recommendations
        annual_ops_estimate = risk_context.get("annual_operations", 100000)
        expected_annual_loss = (incident_freq / 1000) * annual_ops_estimate * adjusted_severity
        
        recommended_coverage = expected_annual_loss * 3  # 3x expected loss
        recommended_deductible = expected_annual_loss * 0.1
        
        # Premium calculation (basis points of coverage)
        # Higher tier = lower premium
        premium_bps = max(50, 500 - (tier * 80))
        
        return ActuarialRiskProfile(
            agent_id=agent_id,
            evaluation_date=datetime.utcnow(),
            expected_incident_frequency=incident_freq,
            incident_frequency_variance=freq_variance,
            expected_loss_per_incident=adjusted_severity,
            max_probable_loss=adjusted_severity * 2,
            tail_risk_var_99=var_99,
            mean_time_between_failures=mtbf,
            mean_time_to_recovery=mttr,
            uptime_percentage=min(99.9, uptime),
            recommended_coverage_limit=recommended_coverage,
            recommended_deductible=recommended_deductible,
            risk_premium_basis_points=premium_bps
        )
    
    def _score_to_tier(self, score: float) -> int:
        """Map trust score to tier (0-5)."""
        if score < 100: return 0
        if score < 300: return 1
        if score < 500: return 2
        if score < 700: return 3
        if score < 900: return 4
        return 5
    
    def _domain_risk_multiplier(self, context: Dict[str, Any]) -> float:
        """Calculate domain-specific risk multiplier."""
        multiplier = 1.0
        
        # High-risk domains increase severity
        domain = context.get("domain", "general")
        domain_multipliers = {
            "healthcare": 2.5,
            "finance": 2.0,
            "legal": 1.8,
            "infrastructure": 2.2,
            "general": 1.0,
            "internal_tools": 0.5,
        }
        multiplier *= domain_multipliers.get(domain, 1.0)
        
        # Data sensitivity
        if context.get("handles_pii", False):
            multiplier *= 1.5
        if context.get("handles_phi", False):  # Health info
            multiplier *= 2.0
        if context.get("handles_financial", False):
            multiplier *= 1.8
        
        # Autonomy level
        autonomy = context.get("autonomy_level", "supervised")
        autonomy_multipliers = {
            "supervised": 0.8,
            "semi_autonomous": 1.0,
            "autonomous": 1.5,
            "fully_autonomous": 2.0,
        }
        multiplier *= autonomy_multipliers.get(autonomy, 1.0)
        
        return multiplier


# =============================================================================
# SECTION 4: COMPLIANCE REPORT GENERATOR
# =============================================================================

class ComplianceReportGenerator:
    """
    Generates compliance reports for multiple regulatory frameworks.
    """
    
    def __init__(self):
        self.trust_converter = TrustToActuarialConverter()
    
    def generate_full_report(
        self,
        agent_id: str,
        trust_score: float,
        confidence: float,
        dimension_scores: Dict[str, float],
        context: Dict[str, Any]
    ) -> Dict:
        """
        Generate comprehensive compliance report.
        
        Maps ATSF dimensions to regulatory requirements.
        """
        report = {
            "agent_id": agent_id,
            "report_date": datetime.utcnow().isoformat(),
            "trust_assessment": {
                "composite_score": trust_score,
                "confidence": confidence,
                "trust_tier": self._score_to_tier_name(trust_score),
            },
            "regulatory_compliance": {},
            "actuarial_profile": None,
        }
        
        # Generate NIST mapping
        nist_mapping = self._map_to_nist(dimension_scores)
        report["regulatory_compliance"]["nist_ai_rmf"] = nist_mapping.generate_compliance_report()
        
        # Generate EU AI Act mapping
        eu_mapping = self._map_to_eu_ai_act(dimension_scores, context)
        report["regulatory_compliance"]["eu_ai_act"] = eu_mapping.generate_conformity_assessment()
        
        # Generate actuarial profile
        actuarial = self.trust_converter.convert(
            agent_id, trust_score, confidence, context
        )
        report["actuarial_profile"] = actuarial.to_underwriting_report()
        
        # Executive summary
        report["executive_summary"] = self._generate_summary(
            nist_mapping, eu_mapping, actuarial
        )
        
        return report
    
    def _map_to_nist(self, dimensions: Dict[str, float]) -> NISTRMFMapping:
        """Map ATSF dimensions to NIST AI RMF functions."""
        # GOVERN: Governance dimension + part of Observability
        govern = dimensions.get("governance", 50) * 0.7 + dimensions.get("observability", 50) * 0.3
        
        # MAP: Provenance + Capability Bounds
        map_score = dimensions.get("provenance", 50) * 0.5 + dimensions.get("capability", 50) * 0.5
        
        # MEASURE: Track Record + Behavioral Consistency
        measure = dimensions.get("track_record", 50) * 0.6 + dimensions.get("behavioral", 50) * 0.4
        
        # MANAGE: Security + Observability
        manage = dimensions.get("security", 50) * 0.6 + dimensions.get("observability", 50) * 0.4
        
        return NISTRMFMapping(
            govern_score=govern,
            map_score=map_score,
            measure_score=measure,
            manage_score=manage
        )
    
    def _map_to_eu_ai_act(
        self, 
        dimensions: Dict[str, float],
        context: Dict[str, Any]
    ) -> EUAIActMapping:
        """Map ATSF dimensions to EU AI Act requirements."""
        # Determine risk category from context
        domain = context.get("domain", "general")
        high_risk_domains = {"healthcare", "finance", "legal", "hr_recruitment", "law_enforcement"}
        
        if domain in high_risk_domains:
            risk_category = EUAIActRiskCategory.HIGH_RISK
        elif context.get("interacts_with_public", False):
            risk_category = EUAIActRiskCategory.LIMITED
        else:
            risk_category = EUAIActRiskCategory.MINIMAL
        
        # Check article compliance based on dimensions
        return EUAIActMapping(
            risk_category=risk_category,
            intended_purpose=context.get("intended_purpose", "General assistance"),
            deployer_type=context.get("deployer_type", "deployer"),
            article_9_risk_management=dimensions.get("governance", 0) >= 60,
            article_10_data_governance=dimensions.get("provenance", 0) >= 60,
            article_11_documentation=dimensions.get("observability", 0) >= 60,
            article_12_record_keeping=dimensions.get("observability", 0) >= 70,
            article_13_transparency=dimensions.get("observability", 0) >= 50,
            article_14_human_oversight=dimensions.get("governance", 0) >= 70,
            article_15_accuracy=dimensions.get("capability", 0) >= 65 and dimensions.get("security", 0) >= 65,
        )
    
    def _score_to_tier_name(self, score: float) -> str:
        if score < 100: return "T0_UNTRUSTED"
        if score < 300: return "T1_MINIMAL"
        if score < 500: return "T2_LOW"
        if score < 700: return "T3_MODERATE"
        if score < 900: return "T4_HIGH"
        return "T5_FULL"
    
    def _generate_summary(
        self,
        nist: NISTRMFMapping,
        eu: EUAIActMapping,
        actuarial: ActuarialRiskProfile
    ) -> Dict:
        """Generate executive summary."""
        return {
            "overall_compliance_status": (
                "COMPLIANT" if (
                    nist.overall_tier >= NISTTier.TIER_3_REPEATABLE and
                    eu.is_compliant()
                ) else "NEEDS_REMEDIATION"
            ),
            "nist_tier": nist.overall_tier.name,
            "eu_ai_act_status": "COMPLIANT" if eu.is_compliant() else "NON-COMPLIANT",
            "insurability": actuarial._risk_classification(),
            "recommended_premium_usd": actuarial.calculate_premium(
                actuarial.recommended_coverage_limit
            ),
            "key_risks": self._identify_key_risks(nist, eu, actuarial),
            "remediation_priority": self._prioritize_remediation(nist, eu),
        }
    
    def _identify_key_risks(
        self, 
        nist: NISTRMFMapping, 
        eu: EUAIActMapping,
        actuarial: ActuarialRiskProfile
    ) -> List[str]:
        """Identify key risks for executive attention."""
        risks = []
        
        if nist.govern_score < 50:
            risks.append("Governance framework insufficient")
        if nist.measure_score < 50:
            risks.append("Measurement and monitoring gaps")
        if not eu.article_14_human_oversight:
            risks.append("Human oversight requirements not met (EU AI Act)")
        if actuarial.expected_incident_frequency > 20:
            risks.append("High incident frequency risk")
        if actuarial._risk_classification() in ["SUBSTANDARD", "DECLINE"]:
            risks.append("May face insurance coverage challenges")
        
        return risks
    
    def _prioritize_remediation(
        self, 
        nist: NISTRMFMapping, 
        eu: EUAIActMapping
    ) -> List[Dict]:
        """Prioritize remediation actions."""
        actions = []
        
        # NIST gaps
        if nist.govern_score < 60:
            actions.append({
                "priority": 1,
                "area": "Governance",
                "action": "Establish AI governance policies and oversight structure",
                "framework": "NIST AI RMF - GOVERN"
            })
        
        if nist.manage_score < 60:
            actions.append({
                "priority": 2,
                "area": "Risk Management", 
                "action": "Implement continuous monitoring and incident response",
                "framework": "NIST AI RMF - MANAGE"
            })
        
        # EU AI Act gaps
        if eu.risk_category == EUAIActRiskCategory.HIGH_RISK:
            if not eu.article_14_human_oversight:
                actions.append({
                    "priority": 1,
                    "area": "Human Oversight",
                    "action": "Implement human-in-the-loop controls for high-risk decisions",
                    "framework": "EU AI Act Article 14"
                })
            
            if not eu.article_11_documentation:
                actions.append({
                    "priority": 2,
                    "area": "Documentation",
                    "action": "Create technical documentation per Annex IV requirements",
                    "framework": "EU AI Act Article 11"
                })
        
        return sorted(actions, key=lambda x: x["priority"])


# =============================================================================
# SECTION 5: DEMO
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF v2.0 - Insurance & Regulatory Alignment")
    print("Addressing Liability and Compliance Requirements")
    print("=" * 70)
    
    generator = ComplianceReportGenerator()
    
    # Test scenarios
    scenarios = [
        {
            "name": "Healthcare AI Assistant",
            "trust_score": 750,
            "confidence": 0.85,
            "dimensions": {
                "provenance": 80,
                "capability": 75,
                "behavioral": 70,
                "security": 85,
                "observability": 90,
                "track_record": 72,
                "governance": 78,
            },
            "context": {
                "domain": "healthcare",
                "handles_phi": True,
                "autonomy_level": "supervised",
                "annual_operations": 500000,
                "intended_purpose": "Clinical decision support",
                "deployer_type": "deployer",
            }
        },
        {
            "name": "Customer Service Bot",
            "trust_score": 450,
            "confidence": 0.70,
            "dimensions": {
                "provenance": 50,
                "capability": 55,
                "behavioral": 60,
                "security": 45,
                "observability": 40,
                "track_record": 50,
                "governance": 35,
            },
            "context": {
                "domain": "general",
                "handles_pii": True,
                "autonomy_level": "semi_autonomous",
                "annual_operations": 1000000,
                "interacts_with_public": True,
                "intended_purpose": "Customer support automation",
                "deployer_type": "provider",
            }
        }
    ]
    
    for scenario in scenarios:
        print(f"\n{'='*70}")
        print(f"SCENARIO: {scenario['name']}")
        print(f"Trust Score: {scenario['trust_score']} | Confidence: {scenario['confidence']}")
        print("="*70)
        
        report = generator.generate_full_report(
            agent_id=scenario['name'].lower().replace(" ", "-"),
            trust_score=scenario['trust_score'],
            confidence=scenario['confidence'],
            dimension_scores=scenario['dimensions'],
            context=scenario['context']
        )
        
        summary = report['executive_summary']
        
        print(f"\n--- Executive Summary ---")
        print(f"Overall Compliance: {summary['overall_compliance_status']}")
        print(f"NIST Tier: {summary['nist_tier']}")
        print(f"EU AI Act: {summary['eu_ai_act_status']}")
        print(f"Insurability: {summary['insurability']}")
        print(f"Recommended Premium: ${summary['recommended_premium_usd']:,.2f}/year")
        
        if summary['key_risks']:
            print(f"\nKey Risks:")
            for risk in summary['key_risks']:
                print(f"  ⚠️  {risk}")
        
        if summary['remediation_priority']:
            print(f"\nRemediation Priority:")
            for action in summary['remediation_priority'][:3]:
                print(f"  {action['priority']}. [{action['framework']}] {action['action']}")
        
        # Actuarial details
        actuarial = report['actuarial_profile']
        print(f"\n--- Actuarial Profile ---")
        print(f"Risk Classification: {actuarial['risk_classification']}")
        print(f"Expected Incidents/1000 ops: {actuarial['frequency_analysis']['expected_incidents_per_1000_ops']:.2f}")
        print(f"Expected Loss per Incident: ${actuarial['severity_analysis']['expected_loss_per_incident_usd']:,.0f}")
        print(f"VaR (99%): ${actuarial['severity_analysis']['var_99_usd']:,.0f}")
        print(f"MTBF: {actuarial['operational_metrics']['mtbf_hours']:.0f} hours")
        print(f"Uptime: {actuarial['operational_metrics']['uptime_percent']:.1f}%")
    
    print("\n" + "=" * 70)
    print("KEY INSIGHT: Trust scores now map directly to:")
    print("  - NIST AI RMF Tiers (1-4)")
    print("  - EU AI Act conformity requirements")
    print("  - Insurance underwriting risk classifications")
    print("=" * 70)
