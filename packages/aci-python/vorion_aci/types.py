"""
ACI Type Definitions

Pydantic models for ACI Trust Engine data types.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# =============================================================================
# ENUMS
# =============================================================================


class TrustTier(str, Enum):
    """Trust tier levels (T0-T5)"""

    T0 = "T0"  # Sandbox (0-99)
    T1 = "T1"  # Probation (100-299)
    T2 = "T2"  # Limited (300-499)
    T3 = "T3"  # Standard (500-699)
    T4 = "T4"  # Trusted (700-899)
    T5 = "T5"  # Sovereign (900-1000)


class AgentRole(str, Enum):
    """Agent role levels (R_L0-R_L8)"""

    R_L0 = "R_L0"  # Listener
    R_L1 = "R_L1"  # Responder
    R_L2 = "R_L2"  # Task Executor
    R_L3 = "R_L3"  # Workflow Manager
    R_L4 = "R_L4"  # Domain Expert
    R_L5 = "R_L5"  # Resource Controller
    R_L6 = "R_L6"  # System Administrator
    R_L7 = "R_L7"  # Trust Governor
    R_L8 = "R_L8"  # Ecosystem Controller


class CreationType(str, Enum):
    """Agent creation/provenance types"""

    FRESH = "FRESH"  # New agent (0 modifier)
    CLONED = "CLONED"  # Cloned from parent (-50 modifier)
    EVOLVED = "EVOLVED"  # Evolved from parent (+100 modifier)
    PROMOTED = "PROMOTED"  # Promoted from another system (+150 modifier)
    IMPORTED = "IMPORTED"  # Imported from external (-100 modifier)


class RoleGateDecision(str, Enum):
    """Role gate evaluation decisions"""

    ALLOW = "ALLOW"
    DENY = "DENY"
    ESCALATE = "ESCALATE"


class ComplianceStatus(str, Enum):
    """Compliance status levels"""

    COMPLIANT = "COMPLIANT"
    WARNING = "WARNING"
    VIOLATION = "VIOLATION"


class AlertSeverity(str, Enum):
    """Gaming alert severity levels"""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, Enum):
    """Gaming alert status"""

    ACTIVE = "ACTIVE"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


# =============================================================================
# STATS MODELS
# =============================================================================


class ContextStats(BaseModel):
    """Context statistics"""

    deployments: int = 0
    organizations: int = 0
    agents: int = 0
    active_operations: int = Field(default=0, alias="activeOperations")


class ComplianceBreakdown(BaseModel):
    """Compliance status breakdown"""

    compliant: int = 0
    warning: int = 0
    violation: int = 0


class CeilingStats(BaseModel):
    """Ceiling enforcement statistics"""

    total_events: int = Field(default=0, alias="totalEvents")
    total_audit_entries: int = Field(default=0, alias="totalAuditEntries")
    compliance_breakdown: ComplianceBreakdown = Field(
        default_factory=ComplianceBreakdown, alias="complianceBreakdown"
    )
    agents_with_alerts: int = Field(default=0, alias="agentsWithAlerts")


class DecisionBreakdown(BaseModel):
    """Role gate decision breakdown"""

    ALLOW: int = 0
    DENY: int = 0
    ESCALATE: int = 0


class RoleGateStats(BaseModel):
    """Role gate statistics"""

    total_evaluations: int = Field(default=0, alias="totalEvaluations")
    by_decision: DecisionBreakdown = Field(
        default_factory=DecisionBreakdown, alias="byDecision"
    )


class PresetStats(BaseModel):
    """Preset statistics"""

    aci_presets: int = Field(default=0, alias="aciPresets")
    vorion_presets: int = Field(default=0, alias="vorionPresets")
    axiom_presets: int = Field(default=0, alias="axiomPresets")
    verified_lineages: int = Field(default=0, alias="verifiedLineages")


class ProvenanceStats(BaseModel):
    """Provenance statistics"""

    total_records: int = Field(default=0, alias="totalRecords")
    by_creation_type: dict[str, int] = Field(
        default_factory=dict, alias="byCreationType"
    )


class DashboardStats(BaseModel):
    """Complete dashboard statistics"""

    context_stats: ContextStats = Field(alias="contextStats")
    ceiling_stats: CeilingStats = Field(alias="ceilingStats")
    role_gate_stats: RoleGateStats = Field(alias="roleGateStats")
    preset_stats: PresetStats = Field(alias="presetStats")
    provenance_stats: ProvenanceStats = Field(alias="provenanceStats")


# =============================================================================
# ROLE GATE MODELS
# =============================================================================


class RoleGateRequest(BaseModel):
    """Request to evaluate role gate"""

    agent_id: str = Field(alias="agentId")
    requested_role: AgentRole = Field(alias="requestedRole")
    current_tier: TrustTier = Field(alias="currentTier")
    current_score: int = Field(ge=0, le=1000, alias="currentScore")
    operation_id: Optional[str] = Field(default=None, alias="operationId")
    attestations: Optional[list[str]] = None


class RoleGateResponse(BaseModel):
    """Role gate evaluation response"""

    decision: RoleGateDecision
    reason: str
    kernel_allowed: bool = Field(alias="kernelAllowed")
    policy_applied: Optional[str] = Field(default=None, alias="policyApplied")
    basis_override: bool = Field(default=False, alias="basisOverride")
    evaluation_id: str = Field(alias="evaluationId")


# =============================================================================
# CEILING MODELS
# =============================================================================


class CeilingCheckRequest(BaseModel):
    """Request to check trust ceiling"""

    agent_id: str = Field(alias="agentId")
    current_score: int = Field(ge=0, le=1000, alias="currentScore")
    target_score: Optional[int] = Field(default=None, ge=0, le=1000, alias="targetScore")


class CeilingCheckResponse(BaseModel):
    """Ceiling check response"""

    ceiling_applied: bool = Field(alias="ceilingApplied")
    effective_score: int = Field(alias="effectiveScore")
    ceiling_source: Optional[str] = Field(default=None, alias="ceilingSource")
    compliance_status: ComplianceStatus = Field(alias="complianceStatus")
    original_tier: TrustTier = Field(alias="originalTier")
    effective_tier: TrustTier = Field(alias="effectiveTier")


# =============================================================================
# PROVENANCE MODELS
# =============================================================================


class ProvenanceCreateRequest(BaseModel):
    """Request to create provenance record"""

    agent_id: str = Field(alias="agentId")
    creation_type: CreationType = Field(alias="creationType")
    parent_agent_id: Optional[str] = Field(default=None, alias="parentAgentId")
    metadata: Optional[dict[str, Any]] = None


class ProvenanceRecord(BaseModel):
    """Provenance record"""

    id: str
    agent_id: str = Field(alias="agentId")
    creation_type: CreationType = Field(alias="creationType")
    parent_agent_id: Optional[str] = Field(default=None, alias="parentAgentId")
    lineage_hash: Optional[str] = Field(default=None, alias="lineageHash")
    score_modifier: int = Field(alias="scoreModifier")
    verified: bool = False
    created_at: datetime = Field(alias="createdAt")


# =============================================================================
# ALERT MODELS
# =============================================================================


class GamingAlert(BaseModel):
    """Gaming detection alert"""

    id: str
    agent_id: str = Field(alias="agentId")
    alert_type: str = Field(alias="alertType")
    severity: AlertSeverity
    status: AlertStatus
    details: dict[str, Any] = Field(default_factory=dict)
    threshold_value: Optional[float] = Field(default=None, alias="thresholdValue")
    actual_value: Optional[float] = Field(default=None, alias="actualValue")
    created_at: datetime = Field(alias="createdAt")
    resolved_at: Optional[datetime] = Field(default=None, alias="resolvedAt")
    resolved_by: Optional[str] = Field(default=None, alias="resolvedBy")
