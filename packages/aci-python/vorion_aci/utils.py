"""
ACI Utility Functions

Helper functions for trust tier calculations and role gate evaluation.
"""

from .types import AgentRole, CreationType, TrustTier

# =============================================================================
# CONSTANTS
# =============================================================================

TRUST_TIER_RANGES: dict[TrustTier, tuple[int, int]] = {
    TrustTier.T0: (0, 99),
    TrustTier.T1: (100, 299),
    TrustTier.T2: (300, 499),
    TrustTier.T3: (500, 699),
    TrustTier.T4: (700, 899),
    TrustTier.T5: (900, 1000),
}

TIER_LABELS: dict[TrustTier, str] = {
    TrustTier.T0: "Sandbox",
    TrustTier.T1: "Probation",
    TrustTier.T2: "Limited",
    TrustTier.T3: "Standard",
    TrustTier.T4: "Trusted",
    TrustTier.T5: "Sovereign",
}

ROLE_LABELS: dict[AgentRole, str] = {
    AgentRole.R_L0: "Listener",
    AgentRole.R_L1: "Responder",
    AgentRole.R_L2: "Task Executor",
    AgentRole.R_L3: "Workflow Manager",
    AgentRole.R_L4: "Domain Expert",
    AgentRole.R_L5: "Resource Controller",
    AgentRole.R_L6: "System Administrator",
    AgentRole.R_L7: "Trust Governor",
    AgentRole.R_L8: "Ecosystem Controller",
}

PROVENANCE_MODIFIERS: dict[CreationType, int] = {
    CreationType.FRESH: 0,
    CreationType.CLONED: -50,
    CreationType.EVOLVED: 100,
    CreationType.PROMOTED: 150,
    CreationType.IMPORTED: -100,
}

# Role gate kernel matrix - which roles are allowed at which tiers
ROLE_GATE_MATRIX: dict[AgentRole, dict[TrustTier, bool]] = {
    AgentRole.R_L0: {t: True for t in TrustTier},
    AgentRole.R_L1: {t: True for t in TrustTier},
    AgentRole.R_L2: {
        TrustTier.T0: False,
        TrustTier.T1: True,
        TrustTier.T2: True,
        TrustTier.T3: True,
        TrustTier.T4: True,
        TrustTier.T5: True,
    },
    AgentRole.R_L3: {
        TrustTier.T0: False,
        TrustTier.T1: False,
        TrustTier.T2: True,
        TrustTier.T3: True,
        TrustTier.T4: True,
        TrustTier.T5: True,
    },
    AgentRole.R_L4: {
        TrustTier.T0: False,
        TrustTier.T1: False,
        TrustTier.T2: False,
        TrustTier.T3: True,
        TrustTier.T4: True,
        TrustTier.T5: True,
    },
    AgentRole.R_L5: {
        TrustTier.T0: False,
        TrustTier.T1: False,
        TrustTier.T2: False,
        TrustTier.T3: False,
        TrustTier.T4: True,
        TrustTier.T5: True,
    },
    AgentRole.R_L6: {
        TrustTier.T0: False,
        TrustTier.T1: False,
        TrustTier.T2: False,
        TrustTier.T3: False,
        TrustTier.T4: False,
        TrustTier.T5: True,
    },
    AgentRole.R_L7: {
        TrustTier.T0: False,
        TrustTier.T1: False,
        TrustTier.T2: False,
        TrustTier.T3: False,
        TrustTier.T4: False,
        TrustTier.T5: True,
    },
    AgentRole.R_L8: {
        TrustTier.T0: False,
        TrustTier.T1: False,
        TrustTier.T2: False,
        TrustTier.T3: False,
        TrustTier.T4: False,
        TrustTier.T5: True,
    },
}


# =============================================================================
# FUNCTIONS
# =============================================================================


def get_tier_from_score(score: int) -> TrustTier:
    """
    Get trust tier from score.

    Args:
        score: Trust score (0-1000)

    Returns:
        TrustTier: The corresponding trust tier

    Raises:
        ValueError: If score is out of range
    """
    if score < 0 or score > 1000:
        raise ValueError(f"Score must be between 0 and 1000, got {score}")

    if score < 100:
        return TrustTier.T0
    elif score < 300:
        return TrustTier.T1
    elif score < 500:
        return TrustTier.T2
    elif score < 700:
        return TrustTier.T3
    elif score < 900:
        return TrustTier.T4
    else:
        return TrustTier.T5


def is_role_allowed_for_tier(role: AgentRole, tier: TrustTier) -> bool:
    """
    Check if a role is allowed at a given trust tier.

    This implements the kernel layer of the role gate system.

    Args:
        role: Agent role to check
        tier: Current trust tier

    Returns:
        bool: True if the role is allowed at the tier
    """
    return ROLE_GATE_MATRIX.get(role, {}).get(tier, False)


def apply_provenance_modifier(base_score: int, creation_type: CreationType) -> int:
    """
    Apply provenance modifier to base score.

    Args:
        base_score: Base trust score
        creation_type: Type of agent creation

    Returns:
        int: Modified score, clamped to 0-1000
    """
    modifier = PROVENANCE_MODIFIERS.get(creation_type, 0)
    return max(0, min(1000, base_score + modifier))


def get_minimum_tier_for_role(role: AgentRole) -> TrustTier:
    """
    Get the minimum trust tier required for a role.

    Args:
        role: Agent role

    Returns:
        TrustTier: Minimum required tier
    """
    for tier in TrustTier:
        if is_role_allowed_for_tier(role, tier):
            return tier
    return TrustTier.T5  # Fallback to highest tier


def get_tier_label(tier: TrustTier) -> str:
    """
    Get human-readable label for a tier.

    Args:
        tier: Trust tier

    Returns:
        str: Human-readable label
    """
    return TIER_LABELS.get(tier, "Unknown")


def get_role_label(role: AgentRole) -> str:
    """
    Get human-readable label for a role.

    Args:
        role: Agent role

    Returns:
        str: Human-readable label
    """
    return ROLE_LABELS.get(role, "Unknown")
