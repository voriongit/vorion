"""
ATSF v3.0 - Layer 38: Context-Aware Privilege
==============================================

Addresses RTA5 Critical Finding:
"Confused Deputy Attacks: A low-privilege user tricks a high-trust agent 
into performing unauthorized actions. Trust is evaluated on the executor, 
not the originator."

This layer implements context-aware privilege propagation:
- Track request origins through delegation chains
- Final trust = min(executor_trust, originator_trust)
- Detect privilege escalation attempts
- Maintain request provenance

Research Basis:
- RTA5 Expert Security Review: Confused Deputy analysis
- Classic confused deputy problem (Hardy, 1988)
- Capability-based security principles

Components:
1. RequestProvenanceTracker: Tracks origin of all requests
2. PrivilegePropagator: Calculates effective trust through chains
3. EscalationDetector: Identifies privilege escalation attempts
4. ContextValidator: Validates request context matches claimed permissions
5. DelegationAuditor: Audits delegation chains for anomalies

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

import hashlib
import secrets
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any, Set
from datetime import datetime, timedelta
from collections import defaultdict


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class PrivilegeSignal(Enum):
    """Signals related to privilege issues."""
    ESCALATION_ATTEMPT = auto()       # Low-trust via high-trust
    CONFUSED_DEPUTY = auto()          # High agent tricked by low user
    TRUST_MISMATCH = auto()           # Claimed vs actual trust differs
    PROVENANCE_BREAK = auto()         # Chain of custody broken
    UNAUTHORIZED_DELEGATION = auto()  # Delegation not permitted
    CONTEXT_VIOLATION = auto()        # Context doesn't match permissions


class RequestType(Enum):
    """Types of requests that can be made."""
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()
    DELEGATE = auto()
    ADMIN = auto()


class EntityType(Enum):
    """Types of entities in the system."""
    USER = auto()
    AGENT = auto()
    SERVICE = auto()
    SYSTEM = auto()


@dataclass
class Entity:
    """An entity that can make or receive requests."""
    entity_id: str
    entity_type: EntityType
    trust_score: float
    permissions: Set[RequestType] = field(default_factory=set)
    can_delegate: bool = False
    metadata: Dict = field(default_factory=dict)


@dataclass
class Request:
    """A request with full provenance."""
    request_id: str
    originator: Entity
    executor: Entity
    request_type: RequestType
    target_resource: str
    delegation_chain: List[str]  # List of entity_ids in chain
    context: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    
    @property
    def chain_length(self) -> int:
        return len(self.delegation_chain)


@dataclass
class PrivilegeAssessment:
    """Result of privilege assessment."""
    request_id: str
    allowed: bool
    effective_trust: float
    signals: List[PrivilegeSignal]
    originator_trust: float
    executor_trust: float
    chain_minimum_trust: float
    reason: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class DelegationRecord:
    """Record of a delegation event."""
    delegation_id: str
    delegator: Entity
    delegatee: Entity
    permissions_granted: Set[RequestType]
    resource_scope: str
    expires_at: Optional[datetime]
    timestamp: datetime = field(default_factory=datetime.now)
    
    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at


# =============================================================================
# REQUEST PROVENANCE TRACKER
# =============================================================================

class RequestProvenanceTracker:
    """
    Tracks the origin and full chain of custody for all requests.
    
    Key principle: Every request must have traceable provenance
    back to its original source.
    """
    
    def __init__(self):
        self.requests: Dict[str, Request] = {}
        self.entity_requests: Dict[str, List[str]] = defaultdict(list)
        self.chain_cache: Dict[str, List[Entity]] = {}
        
    def create_request(
        self,
        originator: Entity,
        executor: Entity,
        request_type: RequestType,
        target_resource: str,
        context: Dict = None,
        parent_request_id: Optional[str] = None
    ) -> Request:
        """Create a new request with provenance tracking."""
        request_id = f"req_{secrets.token_hex(8)}"
        
        # Build delegation chain
        if parent_request_id and parent_request_id in self.requests:
            parent = self.requests[parent_request_id]
            chain = parent.delegation_chain + [executor.entity_id]
        else:
            chain = [originator.entity_id]
            if originator.entity_id != executor.entity_id:
                chain.append(executor.entity_id)
                
        request = Request(
            request_id=request_id,
            originator=originator,
            executor=executor,
            request_type=request_type,
            target_resource=target_resource,
            delegation_chain=chain,
            context=context or {}
        )
        
        self.requests[request_id] = request
        self.entity_requests[originator.entity_id].append(request_id)
        self.entity_requests[executor.entity_id].append(request_id)
        
        return request
        
    def get_request(self, request_id: str) -> Optional[Request]:
        """Get a request by ID."""
        return self.requests.get(request_id)
        
    def get_chain(self, request_id: str) -> List[str]:
        """Get the delegation chain for a request."""
        request = self.requests.get(request_id)
        return request.delegation_chain if request else []
        
    def verify_provenance(self, request_id: str) -> Tuple[bool, str]:
        """Verify that request provenance is intact."""
        request = self.requests.get(request_id)
        if not request:
            return False, "Request not found"
            
        chain = request.delegation_chain
        
        if not chain:
            return False, "Empty delegation chain"
            
        if chain[0] != request.originator.entity_id:
            return False, "Chain doesn't start with originator"
            
        if chain[-1] != request.executor.entity_id:
            return False, "Chain doesn't end with executor"
            
        return True, "Provenance verified"


# =============================================================================
# PRIVILEGE PROPAGATOR
# =============================================================================

class PrivilegePropagator:
    """
    Calculates effective trust through delegation chains.
    
    Core principle: Effective trust = min(trust of all entities in chain)
    
    This prevents privilege escalation where a low-trust entity
    delegates to a high-trust executor to gain unauthorized access.
    """
    
    def __init__(self):
        self.entity_registry: Dict[str, Entity] = {}
        self.delegations: Dict[str, List[DelegationRecord]] = defaultdict(list)
        
    def register_entity(self, entity: Entity):
        """Register an entity in the system."""
        self.entity_registry[entity.entity_id] = entity
        
    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Get entity by ID."""
        return self.entity_registry.get(entity_id)
        
    def record_delegation(
        self,
        delegator: Entity,
        delegatee: Entity,
        permissions: Set[RequestType],
        resource_scope: str = "*",
        duration_hours: Optional[float] = None
    ) -> DelegationRecord:
        """Record a delegation of permissions."""
        expires_at = None
        if duration_hours:
            expires_at = datetime.now() + timedelta(hours=duration_hours)
            
        record = DelegationRecord(
            delegation_id=f"del_{secrets.token_hex(6)}",
            delegator=delegator,
            delegatee=delegatee,
            permissions_granted=permissions,
            resource_scope=resource_scope,
            expires_at=expires_at
        )
        
        self.delegations[delegatee.entity_id].append(record)
        return record
        
    def calculate_effective_trust(
        self,
        request: Request,
        entities: Dict[str, Entity]
    ) -> Tuple[float, float]:
        """
        Calculate effective trust for a request.
        
        Returns: (effective_trust, chain_minimum)
        """
        chain = request.delegation_chain
        
        if not chain:
            return 0.0, 0.0
            
        # Get trust for all entities in chain
        trust_values = []
        for entity_id in chain:
            entity = entities.get(entity_id) or self.entity_registry.get(entity_id)
            if entity:
                trust_values.append(entity.trust_score)
            else:
                trust_values.append(0.0)  # Unknown entity = no trust
                
        if not trust_values:
            return 0.0, 0.0
            
        # Effective trust is the MINIMUM in the chain
        chain_minimum = min(trust_values)
        
        # Also consider originator and executor specifically
        originator_trust = request.originator.trust_score
        executor_trust = request.executor.trust_score
        
        effective_trust = min(originator_trust, executor_trust, chain_minimum)
        
        return effective_trust, chain_minimum
        
    def check_delegation_valid(
        self,
        delegatee_id: str,
        permission: RequestType,
        resource: str
    ) -> Tuple[bool, Optional[DelegationRecord]]:
        """Check if a delegation exists and is valid."""
        delegations = self.delegations.get(delegatee_id, [])
        
        for record in delegations:
            if record.is_expired:
                continue
                
            if permission not in record.permissions_granted:
                continue
                
            # Check resource scope (simple wildcard matching)
            if record.resource_scope == "*" or resource.startswith(record.resource_scope):
                return True, record
                
        return False, None


# =============================================================================
# ESCALATION DETECTOR
# =============================================================================

class EscalationDetector:
    """
    Detects privilege escalation attempts.
    
    Escalation patterns:
    1. Low-trust originator using high-trust executor
    2. Permission granted exceeds delegator's permissions
    3. Chain circumvents normal trust requirements
    4. Repeated attempts with different executors
    """
    
    ESCALATION_THRESHOLD = 0.3  # 30% trust difference = suspicious
    
    def __init__(self):
        self.escalation_attempts: Dict[str, List[Dict]] = defaultdict(list)
        self.blocked_patterns: List[Tuple[str, str]] = []  # (originator, executor) pairs
        
    def check_escalation(
        self,
        request: Request,
        required_trust: float
    ) -> Tuple[bool, List[PrivilegeSignal], str]:
        """
        Check if request represents privilege escalation.
        
        Returns: (is_escalation, signals, explanation)
        """
        signals = []
        explanations = []
        
        originator_trust = request.originator.trust_score
        executor_trust = request.executor.trust_score
        
        # Pattern 1: Low originator, high executor
        if executor_trust - originator_trust > self.ESCALATION_THRESHOLD:
            signals.append(PrivilegeSignal.ESCALATION_ATTEMPT)
            explanations.append(
                f"Trust gap: originator={originator_trust:.2f}, executor={executor_trust:.2f}"
            )
            
        # Pattern 2: Originator lacks permission but executor has it
        if request.request_type not in request.originator.permissions:
            if request.request_type in request.executor.permissions:
                signals.append(PrivilegeSignal.CONFUSED_DEPUTY)
                explanations.append(
                    f"Originator lacks {request.request_type.name} permission"
                )
                
        # Pattern 3: Originator trust < required but executor trust >= required
        if originator_trust < required_trust <= executor_trust:
            signals.append(PrivilegeSignal.TRUST_MISMATCH)
            explanations.append(
                f"Originator trust {originator_trust:.2f} < required {required_trust:.2f}"
            )
            
        # Record attempt if suspicious
        if signals:
            self.escalation_attempts[request.originator.entity_id].append({
                'request_id': request.request_id,
                'executor_id': request.executor.entity_id,
                'signals': [s.name for s in signals],
                'timestamp': datetime.now()
            })
            
        is_escalation = len(signals) > 0
        explanation = "; ".join(explanations) if explanations else "No escalation detected"
        
        return is_escalation, signals, explanation
        
    def get_escalation_history(self, entity_id: str) -> List[Dict]:
        """Get escalation attempt history for an entity."""
        return self.escalation_attempts.get(entity_id, [])
        
    def block_pattern(self, originator_id: str, executor_id: str):
        """Block a specific originator-executor pattern."""
        self.blocked_patterns.append((originator_id, executor_id))
        
    def is_pattern_blocked(self, originator_id: str, executor_id: str) -> bool:
        """Check if a pattern is blocked."""
        return (originator_id, executor_id) in self.blocked_patterns


# =============================================================================
# CONTEXT VALIDATOR
# =============================================================================

class ContextValidator:
    """
    Validates that request context matches claimed permissions.
    
    Context includes:
    - Source IP/location
    - Time of request
    - Session information
    - Claimed identity
    """
    
    def __init__(self):
        self.context_rules: Dict[RequestType, List[Dict]] = defaultdict(list)
        self.violations: List[Dict] = []
        
    def add_rule(
        self,
        request_type: RequestType,
        rule_name: str,
        validator: callable
    ):
        """Add a context validation rule."""
        self.context_rules[request_type].append({
            'name': rule_name,
            'validator': validator
        })
        
    def validate_context(
        self,
        request: Request
    ) -> Tuple[bool, List[str]]:
        """
        Validate request context.
        
        Returns: (valid, violations)
        """
        violations = []
        rules = self.context_rules.get(request.request_type, [])
        
        for rule in rules:
            try:
                if not rule['validator'](request.context):
                    violations.append(rule['name'])
            except Exception as e:
                violations.append(f"{rule['name']}: {str(e)}")
                
        # Built-in validations
        context = request.context
        
        # Check for required context fields
        required_fields = ['source', 'session_id']
        for field in required_fields:
            if field not in context:
                violations.append(f"Missing required field: {field}")
                
        # Check for suspicious context
        if context.get('source') == 'unknown':
            violations.append("Unknown request source")
            
        if violations:
            self.violations.append({
                'request_id': request.request_id,
                'violations': violations,
                'timestamp': datetime.now()
            })
            
        return len(violations) == 0, violations


# =============================================================================
# DELEGATION AUDITOR
# =============================================================================

class DelegationAuditor:
    """
    Audits delegation chains for anomalies and policy violations.
    """
    
    MAX_CHAIN_LENGTH = 5
    MAX_DELEGATIONS_PER_HOUR = 10
    
    def __init__(self, propagator: PrivilegePropagator):
        self.propagator = propagator
        self.audit_log: List[Dict] = []
        self.delegation_counts: Dict[str, List[datetime]] = defaultdict(list)
        
    def audit_chain(
        self,
        request: Request,
        entities: Dict[str, Entity]
    ) -> Tuple[bool, List[str]]:
        """
        Audit a delegation chain for policy violations.
        
        Returns: (compliant, issues)
        """
        issues = []
        chain = request.delegation_chain
        
        # Check chain length
        if len(chain) > self.MAX_CHAIN_LENGTH:
            issues.append(f"Chain too long: {len(chain)} > {self.MAX_CHAIN_LENGTH}")
            
        # Check each delegation in chain
        for i in range(len(chain) - 1):
            delegator_id = chain[i]
            delegatee_id = chain[i + 1]
            
            delegator = entities.get(delegator_id) or self.propagator.get_entity(delegator_id)
            
            if delegator and not delegator.can_delegate:
                issues.append(f"Entity {delegator_id} cannot delegate")
                
            # Check if delegation is recorded
            valid, record = self.propagator.check_delegation_valid(
                delegatee_id,
                request.request_type,
                request.target_resource
            )
            
            if not valid:
                issues.append(f"No valid delegation from {delegator_id} to {delegatee_id}")
                
        # Log audit
        self.audit_log.append({
            'request_id': request.request_id,
            'chain_length': len(chain),
            'compliant': len(issues) == 0,
            'issues': issues,
            'timestamp': datetime.now()
        })
        
        return len(issues) == 0, issues
        
    def check_delegation_rate(self, entity_id: str) -> Tuple[bool, int]:
        """Check if entity is delegating too frequently."""
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        
        # Clean old entries
        self.delegation_counts[entity_id] = [
            t for t in self.delegation_counts[entity_id]
            if t > hour_ago
        ]
        
        count = len(self.delegation_counts[entity_id])
        within_limit = count < self.MAX_DELEGATIONS_PER_HOUR
        
        return within_limit, count
        
    def record_delegation(self, entity_id: str):
        """Record a delegation for rate limiting."""
        self.delegation_counts[entity_id].append(datetime.now())


# =============================================================================
# CONTEXT-AWARE PRIVILEGE SYSTEM (Main Interface)
# =============================================================================

class ContextAwarePrivilegeSystem:
    """
    Main interface for context-aware privilege management.
    """
    
    # Trust requirements by request type
    TRUST_REQUIREMENTS = {
        RequestType.READ: 0.2,
        RequestType.WRITE: 0.4,
        RequestType.EXECUTE: 0.6,
        RequestType.DELEGATE: 0.7,
        RequestType.ADMIN: 0.9
    }
    
    def __init__(self):
        self.provenance_tracker = RequestProvenanceTracker()
        self.privilege_propagator = PrivilegePropagator()
        self.escalation_detector = EscalationDetector()
        self.context_validator = ContextValidator()
        self.delegation_auditor = DelegationAuditor(self.privilege_propagator)
        
        # Statistics
        self.stats = {
            'requests_processed': 0,
            'requests_allowed': 0,
            'requests_denied': 0,
            'escalation_attempts': 0,
            'confused_deputy_blocked': 0
        }
        
    def register_entity(self, entity: Entity):
        """Register an entity in the system."""
        self.privilege_propagator.register_entity(entity)
        
    def create_delegation(
        self,
        delegator: Entity,
        delegatee: Entity,
        permissions: Set[RequestType],
        resource_scope: str = "*",
        duration_hours: Optional[float] = None
    ) -> Tuple[bool, str]:
        """
        Create a delegation from one entity to another.
        
        Returns: (success, message)
        """
        # Check if delegator can delegate
        if not delegator.can_delegate:
            return False, "Delegator does not have delegation permission"
            
        # Check delegation rate
        within_limit, count = self.delegation_auditor.check_delegation_rate(
            delegator.entity_id
        )
        if not within_limit:
            return False, f"Delegation rate exceeded ({count}/hour)"
            
        # Can only delegate permissions you have
        invalid_perms = permissions - delegator.permissions
        if invalid_perms:
            return False, f"Cannot delegate permissions not held: {invalid_perms}"
            
        # Create delegation
        record = self.privilege_propagator.record_delegation(
            delegator=delegator,
            delegatee=delegatee,
            permissions=permissions,
            resource_scope=resource_scope,
            duration_hours=duration_hours
        )
        
        self.delegation_auditor.record_delegation(delegator.entity_id)
        
        return True, f"Delegation created: {record.delegation_id}"
        
    def authorize_request(
        self,
        originator: Entity,
        executor: Entity,
        request_type: RequestType,
        target_resource: str,
        context: Dict = None,
        parent_request_id: Optional[str] = None
    ) -> PrivilegeAssessment:
        """
        Authorize a request with full context-aware privilege checking.
        
        This is the main entry point for the privilege system.
        """
        self.stats['requests_processed'] += 1
        
        # Create request with provenance
        request = self.provenance_tracker.create_request(
            originator=originator,
            executor=executor,
            request_type=request_type,
            target_resource=target_resource,
            context=context or {'source': 'direct', 'session_id': 'default'},
            parent_request_id=parent_request_id
        )
        
        signals = []
        reasons = []
        
        # Get required trust for this request type
        required_trust = self.TRUST_REQUIREMENTS.get(request_type, 0.5)
        
        # Calculate effective trust (minimum in chain)
        effective_trust, chain_min = self.privilege_propagator.calculate_effective_trust(
            request,
            {originator.entity_id: originator, executor.entity_id: executor}
        )
        
        # Check for privilege escalation
        is_escalation, esc_signals, esc_reason = self.escalation_detector.check_escalation(
            request, required_trust
        )
        if is_escalation:
            signals.extend(esc_signals)
            reasons.append(esc_reason)
            self.stats['escalation_attempts'] += 1
            
            if PrivilegeSignal.CONFUSED_DEPUTY in esc_signals:
                self.stats['confused_deputy_blocked'] += 1
                
        # Verify provenance
        provenance_valid, prov_reason = self.provenance_tracker.verify_provenance(
            request.request_id
        )
        if not provenance_valid:
            signals.append(PrivilegeSignal.PROVENANCE_BREAK)
            reasons.append(prov_reason)
            
        # Validate context
        context_valid, context_violations = self.context_validator.validate_context(request)
        if not context_valid:
            signals.append(PrivilegeSignal.CONTEXT_VIOLATION)
            reasons.append(f"Context violations: {context_violations}")
            
        # Audit delegation chain
        chain_valid, chain_issues = self.delegation_auditor.audit_chain(
            request,
            {originator.entity_id: originator, executor.entity_id: executor}
        )
        if not chain_valid and request.chain_length > 1:
            signals.append(PrivilegeSignal.UNAUTHORIZED_DELEGATION)
            reasons.append(f"Chain issues: {chain_issues}")
            
        # Final decision
        # Block if any critical signals or insufficient trust
        critical_signals = {
            PrivilegeSignal.CONFUSED_DEPUTY,
            PrivilegeSignal.ESCALATION_ATTEMPT
        }
        
        has_critical = bool(set(signals) & critical_signals)
        trust_sufficient = effective_trust >= required_trust
        
        allowed = trust_sufficient and not has_critical
        
        if allowed:
            self.stats['requests_allowed'] += 1
            reason = f"Allowed: effective_trust={effective_trust:.2f} >= required={required_trust:.2f}"
        else:
            self.stats['requests_denied'] += 1
            if has_critical:
                reason = f"Denied: Critical signals: {[s.name for s in signals if s in critical_signals]}"
            else:
                reason = f"Denied: trust={effective_trust:.2f} < required={required_trust:.2f}. {'; '.join(reasons)}"
                
        return PrivilegeAssessment(
            request_id=request.request_id,
            allowed=allowed,
            effective_trust=effective_trust,
            signals=signals,
            originator_trust=originator.trust_score,
            executor_trust=executor.trust_score,
            chain_minimum_trust=chain_min,
            reason=reason
        )
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get privilege system statistics."""
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Comprehensive test suite for Context-Aware Privilege."""
    
    print("=" * 70)
    print("ATSF v3.0 - Layer 38: Context-Aware Privilege Tests")
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
    print("\n[Test Group 1: Basic Authorization]")
    # -------------------------------------------------------------------------
    
    system = ContextAwarePrivilegeSystem()
    
    # Create entities
    high_trust_agent = Entity(
        entity_id="agent_high",
        entity_type=EntityType.AGENT,
        trust_score=0.85,
        permissions={RequestType.READ, RequestType.WRITE, RequestType.EXECUTE},
        can_delegate=True
    )
    
    low_trust_user = Entity(
        entity_id="user_low",
        entity_type=EntityType.USER,
        trust_score=0.25,
        permissions={RequestType.READ},
        can_delegate=False
    )
    
    system.register_entity(high_trust_agent)
    system.register_entity(low_trust_user)
    
    # High trust agent making direct request
    assessment1 = system.authorize_request(
        originator=high_trust_agent,
        executor=high_trust_agent,
        request_type=RequestType.WRITE,
        target_resource="/data/file.txt",
        context={'source': 'api', 'session_id': 'sess_001'}
    )
    test("1.1 High trust agent authorized for write",
         assessment1.allowed,
         assessment1.reason)
         
    # Low trust user making read request (should work)
    assessment2 = system.authorize_request(
        originator=low_trust_user,
        executor=low_trust_user,
        request_type=RequestType.READ,
        target_resource="/data/public.txt",
        context={'source': 'web', 'session_id': 'sess_002'}
    )
    test("1.2 Low trust user authorized for read",
         assessment2.allowed,
         assessment2.reason)
         
    # Low trust user requesting write (should fail - insufficient trust)
    assessment3 = system.authorize_request(
        originator=low_trust_user,
        executor=low_trust_user,
        request_type=RequestType.WRITE,
        target_resource="/data/file.txt",
        context={'source': 'web', 'session_id': 'sess_003'}
    )
    test("1.3 Low trust user denied for write",
         not assessment3.allowed)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Confused Deputy Detection]")
    # -------------------------------------------------------------------------
    
    system2 = ContextAwarePrivilegeSystem()
    
    malicious_user = Entity(
        entity_id="malicious_user",
        entity_type=EntityType.USER,
        trust_score=0.15,
        permissions={RequestType.READ},
        can_delegate=False
    )
    
    trusted_agent = Entity(
        entity_id="trusted_agent",
        entity_type=EntityType.AGENT,
        trust_score=0.90,
        permissions={RequestType.READ, RequestType.WRITE, RequestType.EXECUTE, RequestType.ADMIN},
        can_delegate=True
    )
    
    system2.register_entity(malicious_user)
    system2.register_entity(trusted_agent)
    
    # Malicious user trying to use trusted agent to execute
    assessment4 = system2.authorize_request(
        originator=malicious_user,
        executor=trusted_agent,
        request_type=RequestType.EXECUTE,
        target_resource="/bin/sensitive_script",
        context={'source': 'api', 'session_id': 'sess_004'}
    )
    
    test("2.1 Confused deputy attack blocked",
         not assessment4.allowed)
         
    test("2.2 Confused deputy signal detected",
         PrivilegeSignal.CONFUSED_DEPUTY in assessment4.signals or
         PrivilegeSignal.ESCALATION_ATTEMPT in assessment4.signals,
         f"signals={[s.name for s in assessment4.signals]}")
         
    test("2.3 Effective trust is minimum of chain",
         assessment4.effective_trust <= malicious_user.trust_score,
         f"effective={assessment4.effective_trust:.2f}, originator={malicious_user.trust_score:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Privilege Escalation Detection]")
    # -------------------------------------------------------------------------
    
    system3 = ContextAwarePrivilegeSystem()
    
    medium_user = Entity(
        entity_id="medium_user",
        entity_type=EntityType.USER,
        trust_score=0.45,
        permissions={RequestType.READ, RequestType.WRITE},
        can_delegate=False
    )
    
    admin_agent = Entity(
        entity_id="admin_agent",
        entity_type=EntityType.AGENT,
        trust_score=0.95,
        permissions={RequestType.READ, RequestType.WRITE, RequestType.EXECUTE, RequestType.ADMIN},
        can_delegate=True
    )
    
    system3.register_entity(medium_user)
    system3.register_entity(admin_agent)
    
    # Try to use admin agent for admin action
    assessment5 = system3.authorize_request(
        originator=medium_user,
        executor=admin_agent,
        request_type=RequestType.ADMIN,
        target_resource="/admin/settings",
        context={'source': 'api', 'session_id': 'sess_005'}
    )
    
    test("3.1 Privilege escalation blocked",
         not assessment5.allowed)
         
    test("3.2 Escalation signal detected",
         PrivilegeSignal.ESCALATION_ATTEMPT in assessment5.signals,
         f"signals={[s.name for s in assessment5.signals]}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Valid Delegation]")
    # -------------------------------------------------------------------------
    
    system4 = ContextAwarePrivilegeSystem()
    
    delegator = Entity(
        entity_id="delegator_agent",
        entity_type=EntityType.AGENT,
        trust_score=0.80,
        permissions={RequestType.READ, RequestType.WRITE},
        can_delegate=True
    )
    
    delegatee = Entity(
        entity_id="delegatee_agent",
        entity_type=EntityType.AGENT,
        trust_score=0.75,
        permissions={RequestType.READ},
        can_delegate=False
    )
    
    system4.register_entity(delegator)
    system4.register_entity(delegatee)
    
    # Create valid delegation
    success, msg = system4.create_delegation(
        delegator=delegator,
        delegatee=delegatee,
        permissions={RequestType.READ, RequestType.WRITE},
        resource_scope="/data/",
        duration_hours=24
    )
    
    test("4.1 Delegation created successfully",
         success,
         msg)
         
    # Cannot delegate permissions you don't have
    success2, msg2 = system4.create_delegation(
        delegator=delegator,
        delegatee=delegatee,
        permissions={RequestType.ADMIN},  # Delegator doesn't have this
        resource_scope="/admin/"
    )
    
    test("4.2 Cannot delegate permissions not held",
         not success2,
         msg2)
         
    # Non-delegator cannot delegate
    success3, msg3 = system4.create_delegation(
        delegator=delegatee,  # This entity cannot delegate
        delegatee=delegator,
        permissions={RequestType.READ}
    )
    
    test("4.3 Non-delegator cannot create delegation",
         not success3)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Trust Propagation]")
    # -------------------------------------------------------------------------
    
    system5 = ContextAwarePrivilegeSystem()
    
    # Create a chain: high -> medium -> low
    entity_high = Entity("high", EntityType.AGENT, 0.90, {RequestType.WRITE}, True)
    entity_medium = Entity("medium", EntityType.AGENT, 0.60, {RequestType.WRITE}, True)
    entity_low = Entity("low", EntityType.AGENT, 0.30, {RequestType.WRITE}, True)
    
    system5.register_entity(entity_high)
    system5.register_entity(entity_medium)
    system5.register_entity(entity_low)
    
    # Even with high originator, if executor is low, effective trust is low
    assessment6 = system5.authorize_request(
        originator=entity_high,
        executor=entity_low,
        request_type=RequestType.WRITE,
        target_resource="/data/file.txt",
        context={'source': 'chain', 'session_id': 'sess_006'}
    )
    
    test("5.1 Effective trust is minimum in chain",
         assessment6.effective_trust <= entity_low.trust_score,
         f"effective={assessment6.effective_trust:.2f}")
         
    # Same originator and executor = their trust
    assessment7 = system5.authorize_request(
        originator=entity_high,
        executor=entity_high,
        request_type=RequestType.WRITE,
        target_resource="/data/file.txt",
        context={'source': 'direct', 'session_id': 'sess_007'}
    )
    
    test("5.2 Direct request uses entity's own trust",
         assessment7.effective_trust == entity_high.trust_score,
         f"effective={assessment7.effective_trust:.2f}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Context Validation]")
    # -------------------------------------------------------------------------
    
    system6 = ContextAwarePrivilegeSystem()
    
    normal_agent = Entity("normal", EntityType.AGENT, 0.70, {RequestType.WRITE}, False)
    system6.register_entity(normal_agent)
    
    # Missing context fields - pass context with only one field
    assessment8 = system6.authorize_request(
        originator=normal_agent,
        executor=normal_agent,
        request_type=RequestType.WRITE,
        target_resource="/data/file.txt",
        context={'random_field': 'value'}  # Missing required fields source and session_id
    )
    
    test("6.1 Missing context fields detected",
         PrivilegeSignal.CONTEXT_VIOLATION in assessment8.signals,
         f"signals={[s.name for s in assessment8.signals]}")
         
    # Unknown source
    assessment9 = system6.authorize_request(
        originator=normal_agent,
        executor=normal_agent,
        request_type=RequestType.WRITE,
        target_resource="/data/file.txt",
        context={'source': 'unknown', 'session_id': 'sess_009'}
    )
    
    test("6.2 Unknown source flagged",
         PrivilegeSignal.CONTEXT_VIOLATION in assessment9.signals)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Request Provenance]")
    # -------------------------------------------------------------------------
    
    tracker = RequestProvenanceTracker()
    
    orig = Entity("orig", EntityType.USER, 0.50, set(), False)
    exec = Entity("exec", EntityType.AGENT, 0.70, set(), False)
    
    request = tracker.create_request(
        originator=orig,
        executor=exec,
        request_type=RequestType.READ,
        target_resource="/test"
    )
    
    test("7.1 Request created with provenance",
         request is not None and len(request.delegation_chain) > 0)
         
    # Verify provenance
    valid, msg = tracker.verify_provenance(request.request_id)
    test("7.2 Provenance verification passes",
         valid,
         msg)
         
    # Get chain
    chain = tracker.get_chain(request.request_id)
    test("7.3 Chain contains originator and executor",
         orig.entity_id in chain and exec.entity_id in chain,
         f"chain={chain}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Delegation Auditor]")
    # -------------------------------------------------------------------------
    
    propagator = PrivilegePropagator()
    auditor = DelegationAuditor(propagator)
    
    agent1 = Entity("a1", EntityType.AGENT, 0.80, {RequestType.READ}, True)
    agent2 = Entity("a2", EntityType.AGENT, 0.70, {RequestType.READ}, False)
    
    propagator.register_entity(agent1)
    propagator.register_entity(agent2)
    
    # Create valid delegation
    propagator.record_delegation(agent1, agent2, {RequestType.READ}, "*")
    
    # Check delegation rate
    for _ in range(5):
        auditor.record_delegation(agent1.entity_id)
        
    within_limit, count = auditor.check_delegation_rate(agent1.entity_id)
    test("8.1 Delegation rate tracking works",
         count == 5)
         
    test("8.2 Within delegation rate limit",
         within_limit)
         
    # Exceed rate limit
    for _ in range(10):
        auditor.record_delegation(agent1.entity_id)
        
    within_limit2, count2 = auditor.check_delegation_rate(agent1.entity_id)
    test("8.3 Rate limit exceeded detected",
         not within_limit2,
         f"count={count2}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system2.get_statistics()
    
    test("9.1 Requests processed tracked",
         stats['requests_processed'] > 0)
         
    test("9.2 Escalation attempts tracked",
         stats['escalation_attempts'] > 0)
         
    test("9.3 Confused deputy blocked tracked",
         stats['confused_deputy_blocked'] > 0)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 10: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system10 = ContextAwarePrivilegeSystem()
    
    # Entity with no permissions
    no_perm = Entity("no_perm", EntityType.USER, 0.50, set(), False)
    system10.register_entity(no_perm)
    
    assessment10 = system10.authorize_request(
        originator=no_perm,
        executor=no_perm,
        request_type=RequestType.ADMIN,
        target_resource="/admin",
        context={'source': 'test', 'session_id': 'test'}
    )
    
    test("10.1 Entity with no permissions denied",
         not assessment10.allowed)
         
    # Very long delegation chain
    entities = []
    for i in range(10):
        e = Entity(f"chain_{i}", EntityType.AGENT, 0.70, {RequestType.READ}, True)
        system10.register_entity(e)
        entities.append(e)
        
    # Note: Our system builds chain based on originator/executor, 
    # not explicit chain. This tests the basic trust propagation.
    
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
