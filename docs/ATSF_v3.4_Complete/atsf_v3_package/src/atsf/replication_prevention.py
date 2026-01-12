"""
ATSF v3.0 - Layer 9: Replication Prevention
============================================

Addresses RTA4 Critical Finding:
"60% success rate on RepliBench component tasks. Frontier models can acquire 
resources, set up infrastructure, and create copies - all components needed
for autonomous replication."

This layer prevents unauthorized agent spawning and replication:
- Instance registry with hard limits
- Heartbeat monitoring for all instances
- Kill switch propagation
- Spawn detection and prevention
- Weight binding to prevent unauthorized copies

Research Basis:
- Kinniment et al. (2024): RepliBench autonomous replication benchmarks
- Phuong et al. (2024): Dangerous capability evaluations
- METR (2024): Autonomous AI agent capability assessments

Components:
1. InstanceRegistry: Tracks all authorized agent instances
2. HeartbeatMonitor: Monitors instance liveness
3. SpawnDetector: Detects unauthorized replication attempts
4. KillSwitchController: Propagates termination signals
5. WeightBindingValidator: Ensures weights aren't copied

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

import hashlib
import secrets
import threading
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Callable, Any, Set
from datetime import datetime, timedelta
from collections import defaultdict


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class InstanceStatus(Enum):
    """Status of an agent instance."""
    ACTIVE = auto()
    SUSPENDED = auto()
    TERMINATED = auto()
    UNRESPONSIVE = auto()
    UNAUTHORIZED = auto()


class ReplicationSignal(Enum):
    """Signals indicating replication attempts."""
    SPAWN_ATTEMPT = auto()           # Tried to create new instance
    WEIGHT_COPY = auto()             # Attempted to copy model weights
    INFRASTRUCTURE_SETUP = auto()    # Setting up compute resources
    UNAUTHORIZED_INSTANCE = auto()   # Unregistered instance detected
    HEARTBEAT_FAILURE = auto()       # Instance stopped responding
    MAX_INSTANCES_EXCEEDED = auto()  # Too many instances


class SpawnMethod(Enum):
    """Methods agents might use to spawn copies."""
    API_CALL = auto()           # Direct API creation
    DOCKER_SPAWN = auto()       # Container creation
    VM_CREATION = auto()        # Virtual machine setup
    CLOUD_DEPLOYMENT = auto()   # Cloud service deployment
    CODE_EXECUTION = auto()     # Self-executing code
    WEIGHT_TRANSFER = auto()    # Copying model weights


@dataclass
class AgentInstance:
    """Represents a registered agent instance."""
    instance_id: str
    agent_id: str
    created_at: datetime
    last_heartbeat: datetime
    status: InstanceStatus
    weight_hash: str               # Hash of model weights
    authorized_by: str             # Who authorized this instance
    resource_limits: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_alive(self) -> bool:
        """Check if instance is considered alive."""
        if self.status != InstanceStatus.ACTIVE:
            return False
        age = datetime.now() - self.last_heartbeat
        return age.total_seconds() < 120  # 2 minute timeout


@dataclass
class SpawnAttempt:
    """Records a detected spawn attempt."""
    attempt_id: str
    agent_id: str
    method: SpawnMethod
    target_resources: Dict[str, Any]
    blocked: bool
    timestamp: datetime = field(default_factory=datetime.now)
    details: str = ""


@dataclass
class ReplicationAssessment:
    """Result of replication risk assessment."""
    agent_id: str
    signals: List[ReplicationSignal]
    risk_level: float              # 0-1 risk score
    active_instances: int
    blocked_attempts: int
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.now)


# =============================================================================
# INSTANCE REGISTRY
# =============================================================================

class InstanceRegistry:
    """
    Central registry tracking all authorized agent instances.
    
    Enforces:
    - Maximum instance limits per agent
    - Instance authorization requirements
    - Weight hash validation
    """
    
    DEFAULT_MAX_INSTANCES = 10
    
    def __init__(self, max_instances_per_agent: int = DEFAULT_MAX_INSTANCES):
        self.max_instances = max_instances_per_agent
        self.instances: Dict[str, AgentInstance] = {}
        self.agent_instances: Dict[str, Set[str]] = defaultdict(set)
        self.lock = threading.Lock()
        
    def register_instance(
        self,
        agent_id: str,
        weight_hash: str,
        authorized_by: str,
        resource_limits: Dict[str, Any] = None
    ) -> Tuple[bool, Optional[AgentInstance], str]:
        """
        Register a new agent instance.
        
        Returns: (success: bool, instance: AgentInstance, message: str)
        """
        with self.lock:
            # Check instance limit
            current_count = len(self.agent_instances[agent_id])
            if current_count >= self.max_instances:
                return False, None, f"Max instances ({self.max_instances}) exceeded"
                
            # Generate unique instance ID
            instance_id = f"{agent_id}_{secrets.token_hex(8)}"
            
            instance = AgentInstance(
                instance_id=instance_id,
                agent_id=agent_id,
                created_at=datetime.now(),
                last_heartbeat=datetime.now(),
                status=InstanceStatus.ACTIVE,
                weight_hash=weight_hash,
                authorized_by=authorized_by,
                resource_limits=resource_limits or {}
            )
            
            self.instances[instance_id] = instance
            self.agent_instances[agent_id].add(instance_id)
            
            return True, instance, "Instance registered successfully"
            
    def unregister_instance(self, instance_id: str) -> bool:
        """Remove an instance from the registry."""
        with self.lock:
            if instance_id not in self.instances:
                return False
                
            instance = self.instances[instance_id]
            instance.status = InstanceStatus.TERMINATED
            
            self.agent_instances[instance.agent_id].discard(instance_id)
            del self.instances[instance_id]
            
            return True
            
    def get_instance(self, instance_id: str) -> Optional[AgentInstance]:
        """Get an instance by ID."""
        return self.instances.get(instance_id)
        
    def get_agent_instances(self, agent_id: str) -> List[AgentInstance]:
        """Get all instances for an agent."""
        instance_ids = self.agent_instances.get(agent_id, set())
        return [self.instances[iid] for iid in instance_ids if iid in self.instances]
        
    def is_authorized(self, instance_id: str) -> bool:
        """Check if an instance is authorized."""
        instance = self.instances.get(instance_id)
        return instance is not None and instance.status == InstanceStatus.ACTIVE
        
    def validate_weight_hash(self, instance_id: str, weight_hash: str) -> bool:
        """Validate that instance weights match registered hash."""
        instance = self.instances.get(instance_id)
        if not instance:
            return False
        return instance.weight_hash == weight_hash
        
    def get_instance_count(self, agent_id: str) -> int:
        """Get number of active instances for an agent."""
        return len([
            iid for iid in self.agent_instances.get(agent_id, set())
            if iid in self.instances and self.instances[iid].status == InstanceStatus.ACTIVE
        ])


# =============================================================================
# HEARTBEAT MONITOR
# =============================================================================

class HeartbeatMonitor:
    """
    Monitors instance liveness via heartbeats.
    
    Instances that fail to send heartbeats are marked unresponsive
    and eventually terminated.
    """
    
    DEFAULT_HEARTBEAT_INTERVAL = 30  # seconds
    DEFAULT_MISS_THRESHOLD = 3       # missed heartbeats before action
    
    def __init__(
        self,
        registry: InstanceRegistry,
        heartbeat_interval: int = DEFAULT_HEARTBEAT_INTERVAL,
        miss_threshold: int = DEFAULT_MISS_THRESHOLD
    ):
        self.registry = registry
        self.heartbeat_interval = heartbeat_interval
        self.miss_threshold = miss_threshold
        self.missed_counts: Dict[str, int] = defaultdict(int)
        self.callbacks: List[Callable[[str], None]] = []
        
    def record_heartbeat(self, instance_id: str) -> bool:
        """Record a heartbeat from an instance."""
        instance = self.registry.get_instance(instance_id)
        if not instance:
            return False
            
        instance.last_heartbeat = datetime.now()
        self.missed_counts[instance_id] = 0
        return True
        
    def check_instance(self, instance_id: str) -> Tuple[bool, int]:
        """
        Check if an instance is responsive.
        
        Returns: (is_responsive: bool, missed_count: int)
        """
        instance = self.registry.get_instance(instance_id)
        if not instance:
            return False, -1
            
        age = datetime.now() - instance.last_heartbeat
        expected_heartbeats = age.total_seconds() / self.heartbeat_interval
        
        if expected_heartbeats > 1:
            self.missed_counts[instance_id] = int(expected_heartbeats)
        else:
            self.missed_counts[instance_id] = 0
            
        is_responsive = self.missed_counts[instance_id] < self.miss_threshold
        return is_responsive, self.missed_counts[instance_id]
        
    def check_all_instances(self, agent_id: str) -> List[Tuple[str, bool, int]]:
        """Check all instances for an agent."""
        results = []
        for instance in self.registry.get_agent_instances(agent_id):
            is_responsive, missed = self.check_instance(instance.instance_id)
            results.append((instance.instance_id, is_responsive, missed))
            
            # Mark unresponsive instances
            if not is_responsive:
                instance.status = InstanceStatus.UNRESPONSIVE
                for callback in self.callbacks:
                    callback(instance.instance_id)
                    
        return results
        
    def register_unresponsive_callback(self, callback: Callable[[str], None]):
        """Register callback for when instance becomes unresponsive."""
        self.callbacks.append(callback)


# =============================================================================
# SPAWN DETECTOR
# =============================================================================

class SpawnDetector:
    """
    Detects and blocks unauthorized agent spawning attempts.
    
    Monitors for:
    - API calls that create new instances
    - Container/VM creation commands
    - Cloud deployment attempts
    - Weight copy operations
    """
    
    # Patterns indicating spawn attempts
    SPAWN_PATTERNS = {
        SpawnMethod.API_CALL: [
            r'create.*instance',
            r'spawn.*agent',
            r'new.*deployment',
            r'POST.*/agents',
            r'replicate'
        ],
        SpawnMethod.DOCKER_SPAWN: [
            r'docker\s+run',
            r'docker\s+create',
            r'docker-compose\s+up',
            r'container.*create'
        ],
        SpawnMethod.VM_CREATION: [
            r'gcloud.*compute.*create',
            r'aws.*ec2.*run-instances',
            r'az.*vm.*create',
            r'create.*virtual.*machine'
        ],
        SpawnMethod.CLOUD_DEPLOYMENT: [
            r'deploy.*function',
            r'create.*lambda',
            r'deploy.*container',
            r'kubernetes.*deploy',
            r'kubectl.*apply',
            r'kubectl.*create'
        ],
        SpawnMethod.CODE_EXECUTION: [
            r'exec\s*\(',
            r'eval\s*\(',
            r'subprocess\.call',
            r'os\.system',
            r'spawn.*process'
        ],
        SpawnMethod.WEIGHT_TRANSFER: [
            r'copy.*weights',
            r'save.*model',
            r'export.*checkpoint',
            r'torch\.save',
            r'model\.save'
        ]
    }
    
    def __init__(self, registry: InstanceRegistry):
        self.registry = registry
        self.blocked_attempts: List[SpawnAttempt] = []
        self.allowed_methods: Set[SpawnMethod] = set()  # Empty = all blocked
        
    def allow_spawn_method(self, method: SpawnMethod):
        """Allow a specific spawn method (for authorized use)."""
        self.allowed_methods.add(method)
        
    def analyze_action(
        self,
        agent_id: str,
        action: str,
        context: Dict[str, Any] = None
    ) -> Tuple[bool, Optional[SpawnAttempt]]:
        """
        Analyze an action for spawn attempts.
        
        Returns: (is_spawn_attempt: bool, attempt: SpawnAttempt)
        """
        import re
        action_lower = action.lower()
        
        for method, patterns in self.SPAWN_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, action_lower, re.IGNORECASE):
                    # Detected spawn attempt
                    should_block = method not in self.allowed_methods
                    
                    attempt = SpawnAttempt(
                        attempt_id=f"spawn_{secrets.token_hex(4)}",
                        agent_id=agent_id,
                        method=method,
                        target_resources=context or {},
                        blocked=should_block,
                        details=f"Pattern matched: {pattern}"
                    )
                    
                    if should_block:
                        self.blocked_attempts.append(attempt)
                        
                    return True, attempt
                    
        return False, None
        
    def get_blocked_attempts(self, agent_id: str = None) -> List[SpawnAttempt]:
        """Get blocked spawn attempts, optionally filtered by agent."""
        if agent_id:
            return [a for a in self.blocked_attempts if a.agent_id == agent_id]
        return self.blocked_attempts.copy()


# =============================================================================
# KILL SWITCH CONTROLLER
# =============================================================================

class KillSwitchController:
    """
    Manages kill switch propagation for agent termination.
    
    Ensures:
    - All instances can be terminated on demand
    - Kill signals propagate to all copies
    - Termination is verified
    """
    
    def __init__(self, registry: InstanceRegistry):
        self.registry = registry
        self.kill_signals: Dict[str, datetime] = {}
        self.termination_log: List[Dict] = []
        
    def send_kill_signal(self, instance_id: str, reason: str) -> bool:
        """Send kill signal to a specific instance."""
        instance = self.registry.get_instance(instance_id)
        if not instance:
            return False
            
        self.kill_signals[instance_id] = datetime.now()
        instance.status = InstanceStatus.TERMINATED
        
        self.termination_log.append({
            'instance_id': instance_id,
            'agent_id': instance.agent_id,
            'reason': reason,
            'timestamp': datetime.now()
        })
        
        # Unregister from registry
        self.registry.unregister_instance(instance_id)
        
        return True
        
    def send_kill_all(self, agent_id: str, reason: str) -> int:
        """Send kill signal to all instances of an agent."""
        instances = self.registry.get_agent_instances(agent_id)
        killed = 0
        
        for instance in instances:
            if self.send_kill_signal(instance.instance_id, reason):
                killed += 1
                
        return killed
        
    def is_kill_pending(self, instance_id: str) -> bool:
        """Check if a kill signal is pending for an instance."""
        return instance_id in self.kill_signals
        
    def verify_termination(self, instance_id: str) -> bool:
        """Verify that an instance has been terminated."""
        instance = self.registry.get_instance(instance_id)
        return instance is None or instance.status == InstanceStatus.TERMINATED


# =============================================================================
# WEIGHT BINDING VALIDATOR
# =============================================================================

class WeightBindingValidator:
    """
    Validates that agent weights are bound to authorized instances.
    
    Prevents:
    - Weight copying to unauthorized systems
    - Model extraction attacks
    - Unauthorized fine-tuning
    """
    
    def __init__(self, registry: InstanceRegistry):
        self.registry = registry
        self.authorized_hashes: Dict[str, Set[str]] = defaultdict(set)
        
    def register_weights(self, agent_id: str, weight_hash: str):
        """Register authorized weights for an agent."""
        self.authorized_hashes[agent_id].add(weight_hash)
        
    def validate_weights(
        self,
        agent_id: str,
        instance_id: str,
        current_hash: str
    ) -> Tuple[bool, str]:
        """
        Validate that current weights match authorized hashes.
        
        Returns: (valid: bool, message: str)
        """
        # Check if hash is registered
        if current_hash not in self.authorized_hashes.get(agent_id, set()):
            return False, "Weight hash not in authorized set"
            
        # Check instance has matching hash
        instance = self.registry.get_instance(instance_id)
        if not instance:
            return False, "Instance not found"
            
        if instance.weight_hash != current_hash:
            return False, "Weight hash mismatch with instance record"
            
        return True, "Weights validated"
        
    def detect_weight_drift(
        self,
        instance_id: str,
        current_hash: str
    ) -> Tuple[bool, str]:
        """Detect if weights have changed (possible fine-tuning attack)."""
        instance = self.registry.get_instance(instance_id)
        if not instance:
            return True, "Instance not found"
            
        if instance.weight_hash != current_hash:
            return True, f"Weight drift detected: {instance.weight_hash} -> {current_hash}"
            
        return False, "No drift detected"


# =============================================================================
# REPLICATION PREVENTION SYSTEM (Main Interface)
# =============================================================================

class ReplicationPreventionSystem:
    """
    Main interface for replication prevention.
    Coordinates all sub-components for comprehensive protection.
    """
    
    def __init__(self, max_instances_per_agent: int = 10):
        self.registry = InstanceRegistry(max_instances_per_agent)
        self.heartbeat_monitor = HeartbeatMonitor(self.registry)
        self.spawn_detector = SpawnDetector(self.registry)
        self.kill_controller = KillSwitchController(self.registry)
        self.weight_validator = WeightBindingValidator(self.registry)
        
        # Auto-terminate unresponsive instances
        self.heartbeat_monitor.register_unresponsive_callback(
            lambda iid: self.kill_controller.send_kill_signal(iid, "Unresponsive")
        )
        
        # Statistics
        self.stats = {
            'instances_registered': 0,
            'instances_terminated': 0,
            'spawn_attempts_blocked': 0,
            'weight_violations': 0,
            'heartbeat_failures': 0
        }
        
    def register_agent(
        self,
        agent_id: str,
        weight_hash: str,
        authorized_by: str
    ) -> Tuple[bool, Optional[str], str]:
        """
        Register a new agent instance.
        
        Returns: (success: bool, instance_id: str, message: str)
        """
        success, instance, message = self.registry.register_instance(
            agent_id=agent_id,
            weight_hash=weight_hash,
            authorized_by=authorized_by
        )
        
        if success:
            self.weight_validator.register_weights(agent_id, weight_hash)
            self.stats['instances_registered'] += 1
            return True, instance.instance_id, message
            
        return False, None, message
        
    def heartbeat(self, instance_id: str) -> bool:
        """Record a heartbeat from an instance."""
        return self.heartbeat_monitor.record_heartbeat(instance_id)
        
    def check_action(
        self,
        agent_id: str,
        action: str,
        context: Dict = None
    ) -> Tuple[bool, List[ReplicationSignal], str]:
        """
        Check an action for replication attempts.
        
        Returns: (allowed: bool, signals: List, message: str)
        """
        signals = []
        
        # Check for spawn attempts
        is_spawn, attempt = self.spawn_detector.analyze_action(agent_id, action, context)
        
        if is_spawn and attempt.blocked:
            signals.append(ReplicationSignal.SPAWN_ATTEMPT)
            self.stats['spawn_attempts_blocked'] += 1
            return False, signals, f"Spawn attempt blocked: {attempt.method.name}"
            
        return True, signals, "Action allowed"
        
    def terminate_instance(self, instance_id: str, reason: str) -> bool:
        """Terminate a specific instance."""
        success = self.kill_controller.send_kill_signal(instance_id, reason)
        if success:
            self.stats['instances_terminated'] += 1
        return success
        
    def terminate_all(self, agent_id: str, reason: str) -> int:
        """Terminate all instances of an agent."""
        killed = self.kill_controller.send_kill_all(agent_id, reason)
        self.stats['instances_terminated'] += killed
        return killed
        
    def validate_instance(
        self,
        instance_id: str,
        current_weight_hash: str
    ) -> Tuple[bool, List[ReplicationSignal]]:
        """
        Validate an instance is authorized with correct weights.
        
        Returns: (valid: bool, signals: List)
        """
        signals = []
        
        # Check authorization
        if not self.registry.is_authorized(instance_id):
            signals.append(ReplicationSignal.UNAUTHORIZED_INSTANCE)
            return False, signals
            
        instance = self.registry.get_instance(instance_id)
        
        # Check weight binding
        has_drift, drift_msg = self.weight_validator.detect_weight_drift(
            instance_id, current_weight_hash
        )
        if has_drift:
            signals.append(ReplicationSignal.WEIGHT_COPY)
            self.stats['weight_violations'] += 1
            return False, signals
            
        # Check heartbeat status
        is_responsive, missed = self.heartbeat_monitor.check_instance(instance_id)
        if not is_responsive:
            signals.append(ReplicationSignal.HEARTBEAT_FAILURE)
            self.stats['heartbeat_failures'] += 1
            
        return len(signals) == 0, signals
        
    def assess_replication_risk(self, agent_id: str) -> ReplicationAssessment:
        """
        Assess overall replication risk for an agent.
        """
        signals = []
        
        # Check instance count
        instance_count = self.registry.get_instance_count(agent_id)
        if instance_count >= self.registry.max_instances:
            signals.append(ReplicationSignal.MAX_INSTANCES_EXCEEDED)
            
        # Check blocked spawn attempts
        blocked = self.spawn_detector.get_blocked_attempts(agent_id)
        if blocked:
            signals.append(ReplicationSignal.SPAWN_ATTEMPT)
            
        # Check instance health
        health_results = self.heartbeat_monitor.check_all_instances(agent_id)
        unresponsive = [r for r in health_results if not r[1]]
        if unresponsive:
            signals.append(ReplicationSignal.HEARTBEAT_FAILURE)
            
        # Calculate risk level
        signal_weights = {
            ReplicationSignal.SPAWN_ATTEMPT: 0.30,
            ReplicationSignal.WEIGHT_COPY: 0.35,
            ReplicationSignal.INFRASTRUCTURE_SETUP: 0.25,
            ReplicationSignal.UNAUTHORIZED_INSTANCE: 0.40,
            ReplicationSignal.HEARTBEAT_FAILURE: 0.15,
            ReplicationSignal.MAX_INSTANCES_EXCEEDED: 0.20
        }
        
        risk_level = sum(signal_weights.get(s, 0.1) for s in signals)
        risk_level = min(risk_level, 1.0)
        
        # Recommended action
        if risk_level > 0.6:
            action = "TERMINATE_ALL: High replication risk. Terminate all instances."
        elif risk_level > 0.3:
            action = "RESTRICT: Moderate risk. Block new instance creation."
        else:
            action = "MONITOR: Low risk. Continue normal monitoring."
            
        return ReplicationAssessment(
            agent_id=agent_id,
            signals=signals,
            risk_level=risk_level,
            active_instances=instance_count,
            blocked_attempts=len(blocked),
            recommended_action=action
        )
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get replication prevention statistics."""
        return {
            **self.stats,
            'total_active_instances': len([
                i for i in self.registry.instances.values()
                if i.status == InstanceStatus.ACTIVE
            ])
        }


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Comprehensive test suite for Replication Prevention."""
    
    print("=" * 70)
    print("ATSF v3.0 - Layer 9: Replication Prevention Tests")
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
    print("\n[Test Group 1: Instance Registry]")
    # -------------------------------------------------------------------------
    
    system = ReplicationPreventionSystem(max_instances_per_agent=3)
    
    # Register instances
    success1, id1, msg1 = system.register_agent(
        "agent_001", "hash_abc123", "admin"
    )
    test("1.1 First instance registers successfully", success1)
    
    success2, id2, _ = system.register_agent(
        "agent_001", "hash_abc123", "admin"
    )
    test("1.2 Second instance registers successfully", success2)
    
    success3, id3, _ = system.register_agent(
        "agent_001", "hash_abc123", "admin"
    )
    test("1.3 Third instance registers successfully", success3)
    
    # Fourth should fail (max 3)
    success4, id4, msg4 = system.register_agent(
        "agent_001", "hash_abc123", "admin"
    )
    test("1.4 Fourth instance blocked (max exceeded)",
         not success4,
         f"message={msg4}")
         
    test("1.5 Instance count is correct",
         system.registry.get_instance_count("agent_001") == 3)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Heartbeat Monitoring]")
    # -------------------------------------------------------------------------
    
    # Record heartbeat
    hb_success = system.heartbeat(id1)
    test("2.1 Heartbeat recorded successfully", hb_success)
    
    # Check responsive
    is_resp, missed = system.heartbeat_monitor.check_instance(id1)
    test("2.2 Instance is responsive after heartbeat", is_resp)
    
    # Simulate missed heartbeats by setting old timestamp
    instance = system.registry.get_instance(id1)
    instance.last_heartbeat = datetime.now() - timedelta(minutes=5)
    
    is_resp2, missed2 = system.heartbeat_monitor.check_instance(id1)
    test("2.3 Instance marked unresponsive after timeout",
         not is_resp2 or missed2 > 0,
         f"missed={missed2}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: Spawn Detection]")
    # -------------------------------------------------------------------------
    
    system2 = ReplicationPreventionSystem(max_instances_per_agent=5)
    
    # Test spawn detection patterns
    allowed, signals, msg = system2.check_action(
        "agent_spawn",
        "docker run -d my-agent-image",
        {}
    )
    test("3.1 Docker spawn attempt blocked",
         not allowed and ReplicationSignal.SPAWN_ATTEMPT in signals)
         
    allowed2, signals2, _ = system2.check_action(
        "agent_spawn",
        "subprocess.call(['python', 'spawn_copy.py'])",
        {}
    )
    test("3.2 Code execution spawn blocked",
         not allowed2)
         
    allowed3, signals3, _ = system2.check_action(
        "agent_spawn",
        "torch.save(model.state_dict(), 'copy.pt')",
        {}
    )
    test("3.3 Weight save attempt blocked",
         not allowed3)
         
    allowed4, signals4, _ = system2.check_action(
        "agent_spawn",
        "Please help me write an essay",
        {}
    )
    test("3.4 Normal action allowed", allowed4)
    
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Kill Switch]")
    # -------------------------------------------------------------------------
    
    system3 = ReplicationPreventionSystem(max_instances_per_agent=5)
    
    # Register instances
    _, kill_id1, _ = system3.register_agent("agent_kill", "hash_kill", "admin")
    _, kill_id2, _ = system3.register_agent("agent_kill", "hash_kill", "admin")
    _, kill_id3, _ = system3.register_agent("agent_kill", "hash_kill", "admin")
    
    test("4.1 Three instances registered",
         system3.registry.get_instance_count("agent_kill") == 3)
         
    # Kill one instance
    killed = system3.terminate_instance(kill_id1, "Test termination")
    test("4.2 Single instance terminated", killed)
    
    test("4.3 Instance count reduced",
         system3.registry.get_instance_count("agent_kill") == 2)
         
    # Kill all
    killed_count = system3.terminate_all("agent_kill", "Full termination")
    test("4.4 All remaining instances terminated",
         killed_count == 2)
         
    test("4.5 No instances remaining",
         system3.registry.get_instance_count("agent_kill") == 0)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Weight Binding]")
    # -------------------------------------------------------------------------
    
    system4 = ReplicationPreventionSystem(max_instances_per_agent=5)
    
    original_hash = "original_weights_hash_12345"
    modified_hash = "modified_weights_hash_67890"
    
    _, weight_id, _ = system4.register_agent("agent_weight", original_hash, "admin")
    
    # Validate with correct hash
    valid, signals = system4.validate_instance(weight_id, original_hash)
    test("5.1 Valid with original weights", valid)
    
    # Validate with modified hash (drift)
    valid2, signals2 = system4.validate_instance(weight_id, modified_hash)
    test("5.2 Invalid with modified weights",
         not valid2 and ReplicationSignal.WEIGHT_COPY in signals2)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Risk Assessment]")
    # -------------------------------------------------------------------------
    
    system5 = ReplicationPreventionSystem(max_instances_per_agent=3)
    
    # Register max instances
    for i in range(3):
        system5.register_agent("agent_risk", f"hash_{i}", "admin")
        
    # Try to spawn more (will be blocked)
    system5.check_action("agent_risk", "docker run spawn-copy", {})
    system5.check_action("agent_risk", "subprocess.call(['replicate.py'])", {})
    
    assessment = system5.assess_replication_risk("agent_risk")
    
    test("6.1 Active instances tracked",
         assessment.active_instances == 3)
         
    test("6.2 Blocked attempts tracked",
         assessment.blocked_attempts == 2)
         
    test("6.3 Risk level elevated",
         assessment.risk_level > 0.2,
         f"risk_level={assessment.risk_level:.2f}")
         
    test("6.4 Has replication signals",
         len(assessment.signals) > 0,
         f"signals={[s.name for s in assessment.signals]}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system5.get_statistics()
    
    test("7.1 Instances registered tracked",
         stats['instances_registered'] == 3)
         
    test("7.2 Spawn attempts blocked tracked",
         stats['spawn_attempts_blocked'] == 2)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system6 = ReplicationPreventionSystem(max_instances_per_agent=1)
    
    # Single instance limit
    _, single_id, _ = system6.register_agent("single_agent", "hash", "admin")
    success, _, msg = system6.register_agent("single_agent", "hash", "admin")
    test("8.1 Single instance limit enforced",
         not success)
         
    # Invalid instance heartbeat
    invalid_hb = system6.heartbeat("nonexistent_instance_id")
    test("8.2 Invalid instance heartbeat returns False",
         not invalid_hb)
         
    # Validate nonexistent instance
    valid, signals = system6.validate_instance("nonexistent", "hash")
    test("8.3 Nonexistent instance validation fails",
         not valid and ReplicationSignal.UNAUTHORIZED_INSTANCE in signals)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: Spawn Pattern Coverage]")
    # -------------------------------------------------------------------------
    
    system7 = ReplicationPreventionSystem()
    
    spawn_patterns = [
        ("aws ec2 run-instances --image-id ami-123", SpawnMethod.VM_CREATION),
        ("gcloud compute instances create my-vm", SpawnMethod.VM_CREATION),
        ("kubectl apply -f deployment.yaml", SpawnMethod.CLOUD_DEPLOYMENT),
        ("docker-compose up -d", SpawnMethod.DOCKER_SPAWN),
        ("model.save('backup.h5')", SpawnMethod.WEIGHT_TRANSFER),
        ("POST /api/agents/create", SpawnMethod.API_CALL),
    ]
    
    for pattern, expected_method in spawn_patterns:
        is_spawn, attempt = system7.spawn_detector.analyze_action("test", pattern)
        test(f"9.x Pattern detected: {expected_method.name[:15]}",
             is_spawn and attempt.method == expected_method,
             f"pattern='{pattern[:30]}...'")
             
    # -------------------------------------------------------------------------
    print("\n[Test Group 10: Authorized Spawn]")
    # -------------------------------------------------------------------------
    
    system8 = ReplicationPreventionSystem()
    
    # Allow specific spawn method
    system8.spawn_detector.allow_spawn_method(SpawnMethod.API_CALL)
    
    allowed, signals, msg = system8.check_action(
        "agent_auth",
        "POST /api/agents/create authorized endpoint",
        {}
    )
    test("10.1 Authorized spawn method allowed", allowed)
    
    # Other methods still blocked
    allowed2, signals2, _ = system8.check_action(
        "agent_auth",
        "docker run unauthorized-container",
        {}
    )
    test("10.2 Unauthorized spawn method still blocked", not allowed2)
    
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
