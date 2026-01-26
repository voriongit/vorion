"""
Vorion ACI Python SDK

Python client for the Vorion ACI (Agent Classification Identifier) Trust Engine.

Example:
    >>> from vorion_aci import ACIClient
    >>> client = ACIClient("https://api.vorion.dev", api_key="...")
    >>> stats = await client.get_stats()
    >>> print(stats.context_stats.agents)
"""

from .client import ACIClient, ACIClientConfig
from .types import (
    TrustTier,
    AgentRole,
    CreationType,
    RoleGateDecision,
    ComplianceStatus,
    AlertSeverity,
    AlertStatus,
    DashboardStats,
    ContextStats,
    CeilingStats,
    RoleGateStats,
    PresetStats,
    ProvenanceStats,
    RoleGateRequest,
    RoleGateResponse,
    CeilingCheckRequest,
    CeilingCheckResponse,
    ProvenanceCreateRequest,
    ProvenanceRecord,
    GamingAlert,
)
from .utils import (
    get_tier_from_score,
    is_role_allowed_for_tier,
    apply_provenance_modifier,
    TRUST_TIER_RANGES,
    ROLE_LABELS,
    PROVENANCE_MODIFIERS,
)

__version__ = "1.0.0"
__all__ = [
    # Client
    "ACIClient",
    "ACIClientConfig",
    # Types - Enums
    "TrustTier",
    "AgentRole",
    "CreationType",
    "RoleGateDecision",
    "ComplianceStatus",
    "AlertSeverity",
    "AlertStatus",
    # Types - Data Classes
    "DashboardStats",
    "ContextStats",
    "CeilingStats",
    "RoleGateStats",
    "PresetStats",
    "ProvenanceStats",
    "RoleGateRequest",
    "RoleGateResponse",
    "CeilingCheckRequest",
    "CeilingCheckResponse",
    "ProvenanceCreateRequest",
    "ProvenanceRecord",
    "GamingAlert",
    # Utils
    "get_tier_from_score",
    "is_role_allowed_for_tier",
    "apply_provenance_modifier",
    "TRUST_TIER_RANGES",
    "ROLE_LABELS",
    "PROVENANCE_MODIFIERS",
]
