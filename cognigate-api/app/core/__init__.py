"""
Core security modules for Cognigate Engine.

Security Layers:
- L0-L2: velocity - Rate limiting per entity (burst/sustained/quota)
- L3: tripwires - Deterministic regex-based pattern matching
- L4: critic - AI vs AI adversarial evaluation
- L5+: circuit_breaker - System-wide safety halts
"""

from .tripwires import check_tripwires, TripwireResult
from .critic import run_critic, should_run_critic
from .velocity import (
    check_velocity,
    record_action,
    throttle_entity,
    get_velocity_stats,
    VelocityCheckResult,
)
from .circuit_breaker import (
    allow_request as circuit_allow_request,
    record_request as circuit_record_request,
    get_circuit_status,
    manual_halt,
    manual_reset,
    halt_entity,
    unhalt_entity,
)

__all__ = [
    # Tripwires
    "check_tripwires",
    "TripwireResult",
    # Critic
    "run_critic",
    "should_run_critic",
    # Velocity
    "check_velocity",
    "record_action",
    "throttle_entity",
    "get_velocity_stats",
    "VelocityCheckResult",
    # Circuit Breaker
    "circuit_allow_request",
    "circuit_record_request",
    "get_circuit_status",
    "manual_halt",
    "manual_reset",
    "halt_entity",
    "unhalt_entity",
]
