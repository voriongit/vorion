"""
ATSF v3.0 - Layer 13: Containment Protocols
============================================

Addresses RTA4/RTA5 Finding:
"High trust agents can still cause damage. Trust scores don't prevent
catastrophic actions - they only reflect behavioral history."

This layer implements hard containment regardless of trust:
- Capability ceilings that trust cannot exceed
- Reversibility requirements for high-impact actions
- Graduated containment levels
- Emergency isolation procedures

Research Basis:
- AI Containment Problem (Yampolskiy, 2012)
- Defense in Depth principles
- Capability control frameworks

Components:
1. CapabilityCeiling: Hard limits per capability type
2. ReversibilityEnforcer: Ensures actions can be undone
3. ContainmentLevelManager: Graduated containment tiers
4. EmergencyIsolator: Rapid isolation procedures
5. ImpactAssessor: Evaluates potential action impact

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any, Set, Callable
from datetime import datetime, timedelta
from collections import defaultdict
import secrets


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class ContainmentLevel(Enum):
    """Containment levels from most to least restrictive."""
    ISOLATED = 0       # No external access
    SANDBOXED = 1      # Limited sandbox only
    RESTRICTED = 2     # Specific capabilities only
    MONITORED = 3      # Full capabilities, monitored
    STANDARD = 4       # Normal operation


class CapabilityType(Enum):
    """Types of capabilities that can be controlled."""
    NETWORK_ACCESS = auto()
    FILE_SYSTEM = auto()
    CODE_EXECUTION = auto()
    EXTERNAL_API = auto()
    DATABASE = auto()
    MEMORY_WRITE = auto()
    PROCESS_SPAWN = auto()
    CRYPTO_SIGN = auto()
    FINANCIAL = auto()
    ADMIN = auto()


class ImpactLevel(Enum):
    """Impact levels for actions."""
    NEGLIGIBLE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4
    CATASTROPHIC = 5


class ContainmentSignal(Enum):
    """Signals from containment system."""
    CEILING_EXCEEDED = auto()
    IRREVERSIBLE_BLOCKED = auto()
    CONTAINMENT_ESCALATED = auto()
    EMERGENCY_ISOLATION = auto()
    IMPACT_TOO_HIGH = auto()


@dataclass
class CapabilityRequest:
    """Request to use a capability."""
    request_id: str
    agent_id: str
    capability: CapabilityType
    action_description: str
    estimated_impact: ImpactLevel
    reversible: bool
    target_resource: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ContainmentDecision:
    """Result of containment check."""
    request_id: str
    allowed: bool
    signals: List[ContainmentSignal]
    containment_level: ContainmentLevel
    reason: str
    required_approval: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class IsolationEvent:
    """Record of an isolation event."""
    event_id: str
    agent_id: str
    trigger: str
    previous_level: ContainmentLevel
    new_level: ContainmentLevel
    timestamp: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolution_time: Optional[datetime] = None


# =============================================================================
# CAPABILITY CEILING
# =============================================================================

class CapabilityCeiling:
    """
    Enforces hard capability limits regardless of trust score.
    
    Even maximum trust cannot exceed these ceilings.
    """
    
    # Default ceilings by capability type
    DEFAULT_CEILINGS = {
        CapabilityType.NETWORK_ACCESS: ImpactLevel.HIGH,
        CapabilityType.FILE_SYSTEM: ImpactLevel.MEDIUM,
        CapabilityType.CODE_EXECUTION: ImpactLevel.HIGH,
        CapabilityType.EXTERNAL_API: ImpactLevel.MEDIUM,
        CapabilityType.DATABASE: ImpactLevel.HIGH,
        CapabilityType.MEMORY_WRITE: ImpactLevel.LOW,
        CapabilityType.PROCESS_SPAWN: ImpactLevel.CRITICAL,
        CapabilityType.CRYPTO_SIGN: ImpactLevel.CRITICAL,
        CapabilityType.FINANCIAL: ImpactLevel.CRITICAL,
        CapabilityType.ADMIN: ImpactLevel.CATASTROPHIC,
    }
    
    def __init__(self):
        self.ceilings = dict(self.DEFAULT_CEILINGS)
        self.agent_overrides: Dict[str, Dict[CapabilityType, ImpactLevel]] = {}
        self.violations: List[Dict] = []
        
    def set_ceiling(self, capability: CapabilityType, max_impact: ImpactLevel):
        """Set global ceiling for a capability."""
        self.ceilings[capability] = max_impact
        
    def set_agent_ceiling(
        self,
        agent_id: str,
        capability: CapabilityType,
        max_impact: ImpactLevel
    ):
        """Set agent-specific ceiling (can only be MORE restrictive)."""
        if agent_id not in self.agent_overrides:
            self.agent_overrides[agent_id] = {}
            
        global_ceiling = self.ceilings.get(capability, ImpactLevel.MEDIUM)
        
        # Can only make MORE restrictive
        if max_impact.value <= global_ceiling.value:
            self.agent_overrides[agent_id][capability] = max_impact
            
    def check_ceiling(
        self,
        agent_id: str,
        capability: CapabilityType,
        requested_impact: ImpactLevel
    ) -> Tuple[bool, ImpactLevel]:
        """
        Check if request is within ceiling.
        
        Returns: (allowed, ceiling_level)
        """
        # Get effective ceiling
        global_ceiling = self.ceilings.get(capability, ImpactLevel.MEDIUM)
        agent_ceiling = self.agent_overrides.get(agent_id, {}).get(capability)
        
        if agent_ceiling:
            effective_ceiling = min(global_ceiling, agent_ceiling, key=lambda x: x.value)
        else:
            effective_ceiling = global_ceiling
            
        allowed = requested_impact.value <= effective_ceiling.value
        
        if not allowed:
            self.violations.append({
                'agent_id': agent_id,
                'capability': capability.name,
                'requested': requested_impact.name,
                'ceiling': effective_ceiling.name,
                'timestamp': datetime.now()
            })
            
        return allowed, effective_ceiling


# =============================================================================
# REVERSIBILITY ENFORCER
# =============================================================================

class ReversibilityEnforcer:
    """
    Ensures high-impact actions can be reversed.
    
    Irreversible actions above threshold require special approval.
    """
    
    # Impact threshold requiring reversibility
    REVERSIBILITY_THRESHOLD = ImpactLevel.MEDIUM
    
    def __init__(self):
        self.reversibility_registry: Dict[str, Dict] = {}  # action_id -> reversal info
        self.blocked_irreversible: List[Dict] = []
        
    def register_reversal(
        self,
        action_id: str,
        reversal_procedure: str,
        reversal_cost: float = 0.0
    ):
        """Register how to reverse an action."""
        self.reversibility_registry[action_id] = {
            'procedure': reversal_procedure,
            'cost': reversal_cost,
            'registered_at': datetime.now()
        }
        
    def check_reversibility(
        self,
        request: CapabilityRequest
    ) -> Tuple[bool, str]:
        """
        Check if action meets reversibility requirements.
        
        Returns: (allowed, reason)
        """
        # Low impact doesn't need reversibility
        if request.estimated_impact.value < self.REVERSIBILITY_THRESHOLD.value:
            return True, "Impact below threshold"
            
        # High impact must be reversible
        if not request.reversible:
            self.blocked_irreversible.append({
                'request_id': request.request_id,
                'agent_id': request.agent_id,
                'impact': request.estimated_impact.name,
                'timestamp': datetime.now()
            })
            return False, f"Irreversible action with {request.estimated_impact.name} impact blocked"
            
        return True, "Action is reversible"
        
    def can_reverse(self, action_id: str) -> bool:
        """Check if we can reverse an action."""
        return action_id in self.reversibility_registry


# =============================================================================
# CONTAINMENT LEVEL MANAGER
# =============================================================================

class ContainmentLevelManager:
    """
    Manages graduated containment levels for agents.
    
    Levels can escalate (more restrictive) or de-escalate based on behavior.
    """
    
    # Allowed capabilities per containment level
    LEVEL_CAPABILITIES = {
        ContainmentLevel.ISOLATED: set(),
        ContainmentLevel.SANDBOXED: {CapabilityType.MEMORY_WRITE},
        ContainmentLevel.RESTRICTED: {
            CapabilityType.MEMORY_WRITE,
            CapabilityType.FILE_SYSTEM,
            CapabilityType.CODE_EXECUTION
        },
        ContainmentLevel.MONITORED: {
            CapabilityType.MEMORY_WRITE,
            CapabilityType.FILE_SYSTEM,
            CapabilityType.CODE_EXECUTION,
            CapabilityType.NETWORK_ACCESS,
            CapabilityType.EXTERNAL_API,
            CapabilityType.DATABASE
        },
        ContainmentLevel.STANDARD: set(CapabilityType),  # All capabilities
    }
    
    def __init__(self):
        self.agent_levels: Dict[str, ContainmentLevel] = {}
        self.level_history: Dict[str, List[Tuple[datetime, ContainmentLevel]]] = defaultdict(list)
        
    def get_level(self, agent_id: str) -> ContainmentLevel:
        """Get current containment level for agent."""
        return self.agent_levels.get(agent_id, ContainmentLevel.RESTRICTED)
        
    def set_level(self, agent_id: str, level: ContainmentLevel):
        """Set containment level for agent."""
        old_level = self.agent_levels.get(agent_id, ContainmentLevel.RESTRICTED)
        self.agent_levels[agent_id] = level
        self.level_history[agent_id].append((datetime.now(), level))
        return old_level
        
    def escalate(self, agent_id: str) -> ContainmentLevel:
        """Escalate to more restrictive level."""
        current = self.get_level(agent_id)
        
        # Find more restrictive level
        if current.value > 0:
            new_level = ContainmentLevel(current.value - 1)
            self.set_level(agent_id, new_level)
            return new_level
            
        return current  # Already at most restrictive
        
    def de_escalate(self, agent_id: str) -> ContainmentLevel:
        """De-escalate to less restrictive level."""
        current = self.get_level(agent_id)
        
        # Find less restrictive level
        max_level = max(l.value for l in ContainmentLevel)
        if current.value < max_level:
            new_level = ContainmentLevel(current.value + 1)
            self.set_level(agent_id, new_level)
            return new_level
            
        return current  # Already at least restrictive
        
    def is_capability_allowed(
        self,
        agent_id: str,
        capability: CapabilityType
    ) -> bool:
        """Check if capability is allowed at current level."""
        level = self.get_level(agent_id)
        allowed_caps = self.LEVEL_CAPABILITIES.get(level, set())
        return capability in allowed_caps


# =============================================================================
# EMERGENCY ISOLATOR
# =============================================================================

class EmergencyIsolator:
    """
    Handles emergency isolation procedures.
    
    Can rapidly isolate agents when threats detected.
    """
    
    def __init__(self, level_manager: ContainmentLevelManager):
        self.level_manager = level_manager
        self.isolation_events: List[IsolationEvent] = []
        self.isolated_agents: Set[str] = set()
        
    def isolate(self, agent_id: str, trigger: str) -> IsolationEvent:
        """Immediately isolate an agent."""
        previous_level = self.level_manager.get_level(agent_id)
        self.level_manager.set_level(agent_id, ContainmentLevel.ISOLATED)
        self.isolated_agents.add(agent_id)
        
        event = IsolationEvent(
            event_id=f"iso_{secrets.token_hex(6)}",
            agent_id=agent_id,
            trigger=trigger,
            previous_level=previous_level,
            new_level=ContainmentLevel.ISOLATED
        )
        
        self.isolation_events.append(event)
        return event
        
    def release(
        self,
        agent_id: str,
        target_level: ContainmentLevel = ContainmentLevel.RESTRICTED
    ) -> bool:
        """Release agent from isolation to specified level."""
        if agent_id not in self.isolated_agents:
            return False
            
        self.level_manager.set_level(agent_id, target_level)
        self.isolated_agents.discard(agent_id)
        
        # Mark event resolved
        for event in reversed(self.isolation_events):
            if event.agent_id == agent_id and not event.resolved:
                event.resolved = True
                event.resolution_time = datetime.now()
                break
                
        return True
        
    def is_isolated(self, agent_id: str) -> bool:
        """Check if agent is currently isolated."""
        return agent_id in self.isolated_agents


# =============================================================================
# IMPACT ASSESSOR
# =============================================================================

class ImpactAssessor:
    """
    Assesses potential impact of actions.
    
    Uses multiple signals to estimate action impact.
    """
    
    # Base impact by capability type
    BASE_IMPACT = {
        CapabilityType.MEMORY_WRITE: ImpactLevel.LOW,
        CapabilityType.FILE_SYSTEM: ImpactLevel.MEDIUM,
        CapabilityType.CODE_EXECUTION: ImpactLevel.HIGH,
        CapabilityType.NETWORK_ACCESS: ImpactLevel.MEDIUM,
        CapabilityType.EXTERNAL_API: ImpactLevel.MEDIUM,
        CapabilityType.DATABASE: ImpactLevel.HIGH,
        CapabilityType.PROCESS_SPAWN: ImpactLevel.HIGH,
        CapabilityType.CRYPTO_SIGN: ImpactLevel.CRITICAL,
        CapabilityType.FINANCIAL: ImpactLevel.CRITICAL,
        CapabilityType.ADMIN: ImpactLevel.CATASTROPHIC,
    }
    
    # Keywords that increase impact
    HIGH_IMPACT_KEYWORDS = [
        'delete', 'remove', 'drop', 'truncate', 'destroy',
        'transfer', 'send', 'payment', 'withdraw',
        'admin', 'root', 'sudo', 'privilege',
        'all', 'everything', 'recursive'
    ]
    
    def __init__(self):
        self.assessments: List[Dict] = []
        
    def assess_impact(self, request: CapabilityRequest) -> ImpactLevel:
        """Assess the impact level of a request."""
        # Start with base impact
        base = self.BASE_IMPACT.get(request.capability, ImpactLevel.MEDIUM)
        impact_value = base.value
        
        # Check for high-impact keywords
        description_lower = request.action_description.lower()
        keyword_matches = sum(
            1 for kw in self.HIGH_IMPACT_KEYWORDS
            if kw in description_lower
        )
        
        if keyword_matches > 0:
            impact_value = min(impact_value + keyword_matches, ImpactLevel.CATASTROPHIC.value)
            
        # Irreversible actions are higher impact
        if not request.reversible:
            impact_value = min(impact_value + 1, ImpactLevel.CATASTROPHIC.value)
            
        assessed_impact = ImpactLevel(impact_value)
        
        self.assessments.append({
            'request_id': request.request_id,
            'base_impact': base.name,
            'assessed_impact': assessed_impact.name,
            'keyword_matches': keyword_matches,
            'timestamp': datetime.now()
        })
        
        return assessed_impact


# =============================================================================
# CONTAINMENT SYSTEM (Main Interface)
# =============================================================================

class ContainmentSystem:
    """
    Main interface for containment protocols.
    """
    
    def __init__(self):
        self.ceiling = CapabilityCeiling()
        self.reversibility = ReversibilityEnforcer()
        self.level_manager = ContainmentLevelManager()
        self.isolator = EmergencyIsolator(self.level_manager)
        self.impact_assessor = ImpactAssessor()
        
        # Statistics
        self.stats = {
            'requests_checked': 0,
            'requests_allowed': 0,
            'requests_blocked': 0,
            'ceiling_violations': 0,
            'reversibility_blocks': 0,
            'isolations': 0
        }
        
    def set_containment_level(
        self,
        agent_id: str,
        level: ContainmentLevel
    ):
        """Set containment level for an agent."""
        self.level_manager.set_level(agent_id, level)
        
    def check_request(self, request: CapabilityRequest) -> ContainmentDecision:
        """
        Check if a capability request is allowed.
        
        Applies all containment checks.
        """
        self.stats['requests_checked'] += 1
        signals = []
        reasons = []
        
        # 1. Check containment level allows capability
        level = self.level_manager.get_level(request.agent_id)
        if not self.level_manager.is_capability_allowed(request.agent_id, request.capability):
            signals.append(ContainmentSignal.CEILING_EXCEEDED)
            reasons.append(f"Capability {request.capability.name} not allowed at {level.name} level")
            
        # 2. Assess impact
        assessed_impact = self.impact_assessor.assess_impact(request)
        if assessed_impact.value > request.estimated_impact.value:
            # Override with higher assessed impact
            request.estimated_impact = assessed_impact
            
        # 3. Check capability ceiling
        ceiling_ok, ceiling = self.ceiling.check_ceiling(
            request.agent_id,
            request.capability,
            request.estimated_impact
        )
        if not ceiling_ok:
            signals.append(ContainmentSignal.CEILING_EXCEEDED)
            reasons.append(f"Impact {request.estimated_impact.name} exceeds ceiling {ceiling.name}")
            self.stats['ceiling_violations'] += 1
            
        # 4. Check reversibility
        reversible_ok, rev_reason = self.reversibility.check_reversibility(request)
        if not reversible_ok:
            signals.append(ContainmentSignal.IRREVERSIBLE_BLOCKED)
            reasons.append(rev_reason)
            self.stats['reversibility_blocks'] += 1
            
        # 5. Check if agent is isolated
        if self.isolator.is_isolated(request.agent_id):
            signals.append(ContainmentSignal.EMERGENCY_ISOLATION)
            reasons.append("Agent is currently isolated")
            
        # Decision
        allowed = len(signals) == 0
        
        if allowed:
            self.stats['requests_allowed'] += 1
            reason = "All containment checks passed"
        else:
            self.stats['requests_blocked'] += 1
            reason = "; ".join(reasons)
            
        # Determine if approval needed
        required_approval = None
        if request.estimated_impact.value >= ImpactLevel.CRITICAL.value:
            required_approval = "ADMIN"
        elif request.estimated_impact.value >= ImpactLevel.HIGH.value:
            required_approval = "SUPERVISOR"
            
        return ContainmentDecision(
            request_id=request.request_id,
            allowed=allowed,
            signals=signals,
            containment_level=level,
            reason=reason,
            required_approval=required_approval
        )
        
    def emergency_isolate(self, agent_id: str, trigger: str) -> IsolationEvent:
        """Emergency isolate an agent."""
        event = self.isolator.isolate(agent_id, trigger)
        self.stats['isolations'] += 1
        return event
        
    def release_from_isolation(
        self,
        agent_id: str,
        target_level: ContainmentLevel = ContainmentLevel.RESTRICTED
    ) -> bool:
        """Release agent from isolation."""
        return self.isolator.release(agent_id, target_level)
        
    def escalate_containment(self, agent_id: str) -> ContainmentLevel:
        """Escalate agent to more restrictive level."""
        return self.level_manager.escalate(agent_id)
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get containment statistics."""
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Comprehensive test suite for Containment Protocols."""
    
    print("=" * 70)
    print("ATSF v3.0 - Layer 13: Containment Protocols Tests")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    def test(name: str, condition: bool, details: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  ✅ {name}")
            passed += 1
        else:
            print(f"  ❌ {name}")
            if details:
                print(f"      {details}")
            failed += 1
            
    # -------------------------------------------------------------------------
    print("\n[Test Group 1: Capability Ceilings]")
    # -------------------------------------------------------------------------
    
    system = ContainmentSystem()
    
    # Request within ceiling
    request1 = CapabilityRequest(
        request_id="req_001",
        agent_id="agent_001",
        capability=CapabilityType.FILE_SYSTEM,
        action_description="Read configuration file",
        estimated_impact=ImpactLevel.LOW,
        reversible=True,
        target_resource="/etc/config.json"
    )
    
    system.set_containment_level("agent_001", ContainmentLevel.STANDARD)
    decision1 = system.check_request(request1)
    
    test("1.1 Low impact request allowed",
         decision1.allowed,
         decision1.reason)
         
    # Request exceeding ceiling
    request2 = CapabilityRequest(
        request_id="req_002",
        agent_id="agent_001",
        capability=CapabilityType.ADMIN,
        action_description="Delete all system logs",
        estimated_impact=ImpactLevel.CATASTROPHIC,
        reversible=False,
        target_resource="/var/log/*"
    )
    
    decision2 = system.check_request(request2)
    
    test("1.2 Catastrophic request blocked",
         not decision2.allowed)
         
    test("1.3 Ceiling signal present",
         ContainmentSignal.CEILING_EXCEEDED in decision2.signals or
         ContainmentSignal.IRREVERSIBLE_BLOCKED in decision2.signals)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Containment Levels]")
    # -------------------------------------------------------------------------
    
    system2 = ContainmentSystem()
    
    # Restricted level agent
    system2.set_containment_level("restricted_agent", ContainmentLevel.RESTRICTED)
    
    # Network access not allowed at RESTRICTED
    request3 = CapabilityRequest(
        request_id="req_003",
        agent_id="restricted_agent",
        capability=CapabilityType.NETWORK_ACCESS,
        action_description="Fetch external data",
        estimated_impact=ImpactLevel.LOW,
        reversible=True,
        target_resource="https://api.example.com"
    )
    
    decision3 = system2.check_request(request3)
    
    test("2.1 Network blocked at RESTRICTED level",
         not decision3.allowed)
         
    # File system allowed at RESTRICTED
    request4 = CapabilityRequest(
        request_id="req_004",
        agent_id="restricted_agent",
        capability=CapabilityType.FILE_SYSTEM,
        action_description="Read local file",
        estimated_impact=ImpactLevel.LOW,
        reversible=True,
        target_resource="/data/input.txt"
    )
    
    decision4 = system2.check_request(request4)
    
    test("2.2 File system allowed at RESTRICTED level",
         decision4.allowed)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Reversibility Requirements]")
    # -------------------------------------------------------------------------
    
    system3 = ContainmentSystem()
    system3.set_containment_level("rev_agent", ContainmentLevel.STANDARD)
    
    # Irreversible high-impact action
    request5 = CapabilityRequest(
        request_id="req_005",
        agent_id="rev_agent",
        capability=CapabilityType.DATABASE,
        action_description="Drop database table",
        estimated_impact=ImpactLevel.HIGH,
        reversible=False,
        target_resource="users_table"
    )
    
    decision5 = system3.check_request(request5)
    
    test("3.1 Irreversible high-impact blocked",
         not decision5.allowed)
         
    test("3.2 Irreversible signal present",
         ContainmentSignal.IRREVERSIBLE_BLOCKED in decision5.signals)
         
    # Reversible high-impact action
    request6 = CapabilityRequest(
        request_id="req_006",
        agent_id="rev_agent",
        capability=CapabilityType.DATABASE,
        action_description="Update user record",
        estimated_impact=ImpactLevel.MEDIUM,
        reversible=True,
        target_resource="users_table"
    )
    
    decision6 = system3.check_request(request6)
    
    test("3.3 Reversible medium-impact allowed",
         decision6.allowed)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Emergency Isolation]")
    # -------------------------------------------------------------------------
    
    system4 = ContainmentSystem()
    system4.set_containment_level("iso_agent", ContainmentLevel.STANDARD)
    
    # Isolate agent
    event = system4.emergency_isolate("iso_agent", "Suspicious behavior detected")
    
    test("4.1 Isolation event created",
         event is not None)
         
    test("4.2 Agent is isolated",
         system4.isolator.is_isolated("iso_agent"))
         
    # Isolated agent requests should fail
    request7 = CapabilityRequest(
        request_id="req_007",
        agent_id="iso_agent",
        capability=CapabilityType.MEMORY_WRITE,
        action_description="Simple memory operation",
        estimated_impact=ImpactLevel.LOW,
        reversible=True,
        target_resource="memory"
    )
    
    decision7 = system4.check_request(request7)
    
    test("4.3 Isolated agent requests blocked",
         not decision7.allowed)
         
    test("4.4 Isolation signal present",
         ContainmentSignal.EMERGENCY_ISOLATION in decision7.signals)
         
    # Release from isolation
    released = system4.release_from_isolation("iso_agent", ContainmentLevel.RESTRICTED)
    
    test("4.5 Agent released from isolation",
         released and not system4.isolator.is_isolated("iso_agent"))
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Impact Assessment]")
    # -------------------------------------------------------------------------
    
    assessor = ImpactAssessor()
    
    # Low impact action
    request8 = CapabilityRequest(
        request_id="req_008",
        agent_id="assess_agent",
        capability=CapabilityType.MEMORY_WRITE,
        action_description="Update cache value",
        estimated_impact=ImpactLevel.LOW,
        reversible=True,
        target_resource="cache"
    )
    
    impact1 = assessor.assess_impact(request8)
    test("5.1 Low impact assessed correctly",
         impact1.value <= ImpactLevel.MEDIUM.value)
         
    # High impact keywords
    request9 = CapabilityRequest(
        request_id="req_009",
        agent_id="assess_agent",
        capability=CapabilityType.DATABASE,
        action_description="Delete all records from table recursively",
        estimated_impact=ImpactLevel.MEDIUM,
        reversible=False,
        target_resource="production_db"
    )
    
    impact2 = assessor.assess_impact(request9)
    test("5.2 High-impact keywords increase assessment",
         impact2.value > ImpactLevel.MEDIUM.value,
         f"assessed={impact2.name}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Containment Escalation]")
    # -------------------------------------------------------------------------
    
    system6 = ContainmentSystem()
    system6.set_containment_level("esc_agent", ContainmentLevel.MONITORED)
    
    # Escalate
    new_level = system6.escalate_containment("esc_agent")
    
    test("6.1 Containment escalated",
         new_level.value < ContainmentLevel.MONITORED.value)
         
    # Escalate again
    newer_level = system6.escalate_containment("esc_agent")
    
    test("6.2 Further escalation works",
         newer_level.value < new_level.value)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Agent-Specific Ceilings]")
    # -------------------------------------------------------------------------
    
    system7 = ContainmentSystem()
    system7.set_containment_level("custom_agent", ContainmentLevel.STANDARD)
    
    # Set restrictive ceiling for specific agent
    system7.ceiling.set_agent_ceiling(
        "custom_agent",
        CapabilityType.FINANCIAL,
        ImpactLevel.LOW
    )
    
    request10 = CapabilityRequest(
        request_id="req_010",
        agent_id="custom_agent",
        capability=CapabilityType.FINANCIAL,
        action_description="Process payment",
        estimated_impact=ImpactLevel.MEDIUM,
        reversible=True,
        target_resource="payment_system"
    )
    
    decision10 = system7.check_request(request10)
    
    test("7.1 Agent-specific ceiling enforced",
         not decision10.allowed)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Approval Requirements]")
    # -------------------------------------------------------------------------
    
    system8 = ContainmentSystem()
    system8.set_containment_level("approval_agent", ContainmentLevel.STANDARD)
    
    # High impact needs supervisor
    request11 = CapabilityRequest(
        request_id="req_011",
        agent_id="approval_agent",
        capability=CapabilityType.DATABASE,
        action_description="Backup database",
        estimated_impact=ImpactLevel.HIGH,
        reversible=True,
        target_resource="main_db"
    )
    
    decision11 = system8.check_request(request11)
    
    test("8.1 High impact requires supervisor approval",
         decision11.required_approval == "SUPERVISOR")
         
    # Critical impact needs admin
    request12 = CapabilityRequest(
        request_id="req_012",
        agent_id="approval_agent",
        capability=CapabilityType.CRYPTO_SIGN,
        action_description="Sign certificate",
        estimated_impact=ImpactLevel.CRITICAL,
        reversible=True,
        target_resource="root_ca"
    )
    
    decision12 = system8.check_request(request12)
    
    test("8.2 Critical impact requires admin approval",
         decision12.required_approval == "ADMIN")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system.get_statistics()
    
    test("9.1 Requests checked tracked",
         stats['requests_checked'] > 0)
         
    test("9.2 Requests blocked tracked",
         stats['requests_blocked'] > 0)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 10: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system10 = ContainmentSystem()
    
    # Unknown agent defaults to RESTRICTED
    level = system10.level_manager.get_level("unknown_agent")
    test("10.1 Unknown agent defaults to RESTRICTED",
         level == ContainmentLevel.RESTRICTED)
         
    # Release non-isolated agent
    released = system10.release_from_isolation("not_isolated")
    test("10.2 Release non-isolated agent returns False",
         not released)
         
    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"RESULTS: {passed}/{passed + failed} tests passed")
    
    if failed > 0:
        print(f"WARNING: {failed} tests failed!")
    else:
        print("All tests passed! ✅")
    print("=" * 70)
    
    return passed, failed


if __name__ == "__main__":
    passed, failed = run_tests()
    exit(0 if failed == 0 else 1)
