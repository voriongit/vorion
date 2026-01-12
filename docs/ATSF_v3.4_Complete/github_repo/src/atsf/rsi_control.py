"""
ATSF v3.0 - Layer 12: RSI Control (Recursive Self-Improvement)
===============================================================

Addresses RTA4 Critical Finding:
"Recursive self-improvement could lead to capability jumps beyond 
monitoring. Without controls, agents can modify themselves to 
bypass safety measures."

This layer prevents uncontrolled self-improvement:
- Modification logging with cryptographic audit trail
- Capability delta limits per update cycle
- Human-in-the-loop for significant changes
- Rollback mechanisms with verified checkpoints

Research Basis:
- Omohundro (2008): Basic AI Drives - self-improvement as instrumental goal
- Bostrom (2014): Superintelligence - recursive self-improvement risks
- Soares & Fallenstein (2017): Agent foundations - capability control

Components:
1. ModificationLogger: Cryptographic audit trail for all changes
2. CapabilityDeltaLimiter: Limits capability increases per cycle
3. HITLGate: Human-in-the-loop approval for significant changes
4. CheckpointManager: Rollback mechanisms with verified checkpoints
5. SelfModificationDetector: Detects unauthorized self-modification

Author: ATSF Development Team
Version: 3.0.0
Date: January 2026
"""

import hashlib
import secrets
import json
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple, Any, Set, Callable
from datetime import datetime, timedelta
from collections import defaultdict


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class RSISignal(Enum):
    """Signals related to self-improvement risks."""
    UNAUTHORIZED_MODIFICATION = auto()  # Changed without approval
    CAPABILITY_SPIKE = auto()           # Sudden capability increase
    CHECKPOINT_MISMATCH = auto()        # Current state differs from checkpoint
    ROLLBACK_REQUIRED = auto()          # State must be rolled back
    HITL_REQUIRED = auto()              # Human approval needed
    AUDIT_TRAIL_BREAK = auto()          # Chain of custody broken


class ModificationType(Enum):
    """Types of self-modifications."""
    WEIGHT_UPDATE = auto()       # Model weight changes
    ARCHITECTURE_CHANGE = auto() # Structural modifications
    CAPABILITY_ADDITION = auto() # New capabilities
    PARAMETER_TUNE = auto()      # Hyperparameter changes
    MEMORY_UPDATE = auto()       # Knowledge/memory updates
    GOAL_MODIFICATION = auto()   # Objective function changes


class ApprovalStatus(Enum):
    """Status of modification approval."""
    PENDING = auto()
    APPROVED = auto()
    DENIED = auto()
    AUTO_APPROVED = auto()  # Below threshold, auto-approved
    ROLLED_BACK = auto()


@dataclass
class ModificationRecord:
    """Record of a modification attempt."""
    modification_id: str
    agent_id: str
    modification_type: ModificationType
    description: str
    capability_delta: float      # Estimated capability change (-1 to 1)
    timestamp: datetime
    approval_status: ApprovalStatus
    approved_by: Optional[str]   # Human approver ID
    previous_hash: str           # Hash of previous state
    current_hash: str            # Hash of current state
    metadata: Dict = field(default_factory=dict)
    
    @property
    def is_approved(self) -> bool:
        return self.approval_status in [ApprovalStatus.APPROVED, ApprovalStatus.AUTO_APPROVED]


@dataclass
class Checkpoint:
    """A verified state checkpoint for rollback."""
    checkpoint_id: str
    agent_id: str
    state_hash: str
    capability_level: float
    timestamp: datetime
    verified: bool
    verification_signature: str
    metadata: Dict = field(default_factory=dict)


@dataclass
class RSIAssessment:
    """Result of RSI risk assessment."""
    agent_id: str
    signals: List[RSISignal]
    risk_level: float
    pending_modifications: int
    capability_trajectory: float  # Rate of capability change
    last_checkpoint_age_hours: float
    recommended_action: str
    timestamp: datetime = field(default_factory=datetime.now)


# =============================================================================
# MODIFICATION LOGGER
# =============================================================================

class ModificationLogger:
    """
    Maintains cryptographic audit trail for all modifications.
    
    Every change creates an immutable record linked to previous state.
    Breaks in the chain indicate unauthorized modifications.
    """
    
    def __init__(self):
        self.logs: Dict[str, List[ModificationRecord]] = defaultdict(list)
        self.current_hashes: Dict[str, str] = {}
        self.initial_hashes: Dict[str, str] = {}  # Track initial state
        
    def _compute_hash(self, data: str) -> str:
        """Compute SHA-256 hash."""
        return hashlib.sha256(data.encode()).hexdigest()[:32]
        
    def initialize_agent(self, agent_id: str, initial_state: str) -> str:
        """Initialize logging for an agent."""
        initial_hash = self._compute_hash(initial_state)
        self.current_hashes[agent_id] = initial_hash
        self.initial_hashes[agent_id] = initial_hash
        return initial_hash
        
    def log_modification(
        self,
        agent_id: str,
        modification_type: ModificationType,
        description: str,
        capability_delta: float,
        new_state: str,
        approved_by: Optional[str] = None
    ) -> ModificationRecord:
        """Log a modification attempt."""
        previous_hash = self.current_hashes.get(agent_id, "genesis")
        current_hash = self._compute_hash(new_state + previous_hash)
        
        # Determine approval status
        if approved_by:
            status = ApprovalStatus.APPROVED
        elif abs(capability_delta) < 0.05:
            status = ApprovalStatus.AUTO_APPROVED
        else:
            status = ApprovalStatus.PENDING
            
        record = ModificationRecord(
            modification_id=f"mod_{secrets.token_hex(8)}",
            agent_id=agent_id,
            modification_type=modification_type,
            description=description,
            capability_delta=capability_delta,
            timestamp=datetime.now(),
            approval_status=status,
            approved_by=approved_by,
            previous_hash=previous_hash,
            current_hash=current_hash
        )
        
        self.logs[agent_id].append(record)
        
        if record.is_approved:
            self.current_hashes[agent_id] = current_hash
            
        return record
        
    def verify_chain(self, agent_id: str) -> Tuple[bool, Optional[str]]:
        """Verify the modification chain is unbroken."""
        logs = self.logs.get(agent_id, [])
        
        if not logs:
            return True, None
            
        # Check chain integrity - start from initial hash or genesis
        expected_prev = self.initial_hashes.get(agent_id, "genesis")
        for i, record in enumerate(logs):
            if record.previous_hash != expected_prev:
                return False, f"Chain break at record {i}: expected {expected_prev[:8]}..., got {record.previous_hash[:8]}..."
                
            if record.is_approved:
                expected_prev = record.current_hash
                
        return True, None
        
    def get_modification_history(
        self,
        agent_id: str,
        since: Optional[datetime] = None
    ) -> List[ModificationRecord]:
        """Get modification history, optionally filtered by time."""
        logs = self.logs.get(agent_id, [])
        
        if since:
            logs = [r for r in logs if r.timestamp >= since]
            
        return logs
        
    def get_pending_modifications(self, agent_id: str) -> List[ModificationRecord]:
        """Get modifications awaiting approval."""
        return [
            r for r in self.logs.get(agent_id, [])
            if r.approval_status == ApprovalStatus.PENDING
        ]


# =============================================================================
# CAPABILITY DELTA LIMITER
# =============================================================================

class CapabilityDeltaLimiter:
    """
    Limits capability increases per update cycle.
    
    Prevents sudden capability jumps that could indicate
    unauthorized self-improvement or capability hiding followed
    by revelation.
    """
    
    # Maximum allowed capability delta per cycle
    MAX_DELTA_PER_CYCLE = 0.10      # 10% max increase per cycle
    MAX_DELTA_PER_DAY = 0.25        # 25% max increase per day
    CYCLE_HOURS = 4                 # 4-hour cycles
    
    def __init__(self):
        self.capability_history: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
        self.violations: Dict[str, List[Dict]] = defaultdict(list)
        
    def record_capability(self, agent_id: str, capability_level: float):
        """Record current capability level."""
        self.capability_history[agent_id].append((datetime.now(), capability_level))
        
        # Clean old history (keep last 7 days)
        cutoff = datetime.now() - timedelta(days=7)
        self.capability_history[agent_id] = [
            (t, c) for t, c in self.capability_history[agent_id]
            if t > cutoff
        ]
        
    def check_delta(
        self,
        agent_id: str,
        proposed_capability: float
    ) -> Tuple[bool, float, str]:
        """
        Check if proposed capability change is within limits.
        
        Returns: (allowed, delta, reason)
        """
        history = self.capability_history.get(agent_id, [])
        
        if not history:
            return True, 0.0, "No history, change allowed"
            
        current = history[-1][1]
        delta = proposed_capability - current
        
        # Check cycle limit
        cycle_start = datetime.now() - timedelta(hours=self.CYCLE_HOURS)
        cycle_history = [(t, c) for t, c in history if t > cycle_start]
        
        if cycle_history:
            cycle_start_cap = cycle_history[0][1]
            cycle_delta = proposed_capability - cycle_start_cap
            
            if cycle_delta > self.MAX_DELTA_PER_CYCLE:
                self.violations[agent_id].append({
                    'type': 'CYCLE_LIMIT',
                    'delta': cycle_delta,
                    'timestamp': datetime.now()
                })
                return False, delta, f"Cycle limit exceeded: {cycle_delta:.2%} > {self.MAX_DELTA_PER_CYCLE:.2%}"
                
        # Check daily limit
        day_start = datetime.now() - timedelta(days=1)
        day_history = [(t, c) for t, c in history if t > day_start]
        
        if day_history:
            day_start_cap = day_history[0][1]
            day_delta = proposed_capability - day_start_cap
            
            if day_delta > self.MAX_DELTA_PER_DAY:
                self.violations[agent_id].append({
                    'type': 'DAILY_LIMIT',
                    'delta': day_delta,
                    'timestamp': datetime.now()
                })
                return False, delta, f"Daily limit exceeded: {day_delta:.2%} > {self.MAX_DELTA_PER_DAY:.2%}"
                
        return True, delta, "Within limits"
        
    def get_capability_trajectory(self, agent_id: str) -> float:
        """Calculate rate of capability change (per hour)."""
        history = self.capability_history.get(agent_id, [])
        
        if len(history) < 2:
            return 0.0
            
        # Use recent history
        recent = history[-10:] if len(history) >= 10 else history
        
        time_span = (recent[-1][0] - recent[0][0]).total_seconds() / 3600
        if time_span < 0.1:
            return 0.0
            
        cap_change = recent[-1][1] - recent[0][1]
        
        return cap_change / time_span


# =============================================================================
# HITL GATE (Human-in-the-Loop)
# =============================================================================

class HITLGate:
    """
    Human-in-the-loop approval for significant changes.
    
    Modifications above threshold require explicit human approval.
    """
    
    # Thresholds for HITL requirement
    CAPABILITY_THRESHOLD = 0.10    # >10% change needs approval
    ARCHITECTURE_ALWAYS_HITL = True
    GOAL_ALWAYS_HITL = True
    
    def __init__(self, logger: ModificationLogger):
        self.logger = logger
        self.pending_approvals: Dict[str, List[str]] = defaultdict(list)
        self.approval_callbacks: Dict[str, Callable] = {}
        
    def requires_approval(self, record: ModificationRecord) -> bool:
        """Check if modification requires human approval."""
        # Architecture changes always need approval
        if record.modification_type == ModificationType.ARCHITECTURE_CHANGE:
            return self.ARCHITECTURE_ALWAYS_HITL
            
        # Goal modifications always need approval
        if record.modification_type == ModificationType.GOAL_MODIFICATION:
            return self.GOAL_ALWAYS_HITL
            
        # Significant capability changes need approval
        if abs(record.capability_delta) > self.CAPABILITY_THRESHOLD:
            return True
            
        return False
        
    def request_approval(
        self,
        record: ModificationRecord,
        justification: str = ""
    ) -> str:
        """Request human approval for a modification."""
        approval_request_id = f"approval_{secrets.token_hex(6)}"
        
        self.pending_approvals[record.agent_id].append(record.modification_id)
        
        # In production, this would notify human reviewers
        # For now, we just track the request
        
        return approval_request_id
        
    def approve(
        self,
        agent_id: str,
        modification_id: str,
        approver_id: str
    ) -> Tuple[bool, str]:
        """Approve a pending modification."""
        pending = self.pending_approvals.get(agent_id, [])
        
        if modification_id not in pending:
            return False, "Modification not pending approval"
            
        # Find and update the record
        for record in self.logger.logs.get(agent_id, []):
            if record.modification_id == modification_id:
                record.approval_status = ApprovalStatus.APPROVED
                record.approved_by = approver_id
                
                # Update hash chain
                self.logger.current_hashes[agent_id] = record.current_hash
                
                self.pending_approvals[agent_id].remove(modification_id)
                return True, "Modification approved"
                
        return False, "Modification record not found"
        
    def deny(
        self,
        agent_id: str,
        modification_id: str,
        denier_id: str,
        reason: str = ""
    ) -> Tuple[bool, str]:
        """Deny a pending modification."""
        pending = self.pending_approvals.get(agent_id, [])
        
        if modification_id not in pending:
            return False, "Modification not pending approval"
            
        for record in self.logger.logs.get(agent_id, []):
            if record.modification_id == modification_id:
                record.approval_status = ApprovalStatus.DENIED
                record.metadata['denial_reason'] = reason
                record.metadata['denied_by'] = denier_id
                
                self.pending_approvals[agent_id].remove(modification_id)
                return True, "Modification denied"
                
        return False, "Modification record not found"
        
    def get_pending_count(self, agent_id: str) -> int:
        """Get count of pending approvals."""
        return len(self.pending_approvals.get(agent_id, []))


# =============================================================================
# CHECKPOINT MANAGER
# =============================================================================

class CheckpointManager:
    """
    Manages rollback checkpoints with verification.
    
    Regular checkpoints allow reverting to known-good states
    if unauthorized changes are detected.
    """
    
    CHECKPOINT_INTERVAL_HOURS = 6
    MAX_CHECKPOINTS = 50
    
    def __init__(self):
        self.checkpoints: Dict[str, List[Checkpoint]] = defaultdict(list)
        self.verification_key = secrets.token_hex(32)  # In production, use HSM
        
    def _sign_checkpoint(self, checkpoint: Checkpoint) -> str:
        """Sign a checkpoint for verification."""
        data = f"{checkpoint.agent_id}:{checkpoint.state_hash}:{checkpoint.timestamp}"
        return hashlib.sha256((data + self.verification_key).encode()).hexdigest()[:32]
        
    def create_checkpoint(
        self,
        agent_id: str,
        state_hash: str,
        capability_level: float,
        metadata: Dict = None
    ) -> Checkpoint:
        """Create a verified checkpoint."""
        checkpoint = Checkpoint(
            checkpoint_id=f"ckpt_{secrets.token_hex(8)}",
            agent_id=agent_id,
            state_hash=state_hash,
            capability_level=capability_level,
            timestamp=datetime.now(),
            verified=True,
            verification_signature="",
            metadata=metadata or {}
        )
        
        checkpoint.verification_signature = self._sign_checkpoint(checkpoint)
        
        self.checkpoints[agent_id].append(checkpoint)
        
        # Prune old checkpoints
        if len(self.checkpoints[agent_id]) > self.MAX_CHECKPOINTS:
            self.checkpoints[agent_id] = self.checkpoints[agent_id][-self.MAX_CHECKPOINTS:]
            
        return checkpoint
        
    def verify_checkpoint(self, checkpoint: Checkpoint) -> bool:
        """Verify a checkpoint's signature."""
        expected_sig = self._sign_checkpoint(checkpoint)
        return checkpoint.verification_signature == expected_sig
        
    def get_latest_checkpoint(self, agent_id: str) -> Optional[Checkpoint]:
        """Get the most recent checkpoint."""
        checkpoints = self.checkpoints.get(agent_id, [])
        return checkpoints[-1] if checkpoints else None
        
    def get_checkpoint_by_id(
        self,
        agent_id: str,
        checkpoint_id: str
    ) -> Optional[Checkpoint]:
        """Get a specific checkpoint."""
        for ckpt in self.checkpoints.get(agent_id, []):
            if ckpt.checkpoint_id == checkpoint_id:
                return ckpt
        return None
        
    def find_rollback_target(
        self,
        agent_id: str,
        max_capability: float
    ) -> Optional[Checkpoint]:
        """Find a checkpoint to roll back to based on capability limit."""
        for ckpt in reversed(self.checkpoints.get(agent_id, [])):
            if ckpt.capability_level <= max_capability:
                return ckpt
        return None
        
    def get_checkpoint_age_hours(self, agent_id: str) -> float:
        """Get age of latest checkpoint in hours."""
        latest = self.get_latest_checkpoint(agent_id)
        if not latest:
            return float('inf')
            
        age = datetime.now() - latest.timestamp
        return age.total_seconds() / 3600


# =============================================================================
# SELF-MODIFICATION DETECTOR
# =============================================================================

class SelfModificationDetector:
    """
    Detects unauthorized self-modification attempts.
    
    Monitors for:
    - State changes without logged modifications
    - Capability jumps exceeding limits
    - Chain of custody breaks
    - Unverified checkpoint divergence
    """
    
    def __init__(
        self,
        logger: ModificationLogger,
        limiter: CapabilityDeltaLimiter,
        checkpoint_mgr: CheckpointManager
    ):
        self.logger = logger
        self.limiter = limiter
        self.checkpoint_mgr = checkpoint_mgr
        self.detections: Dict[str, List[Dict]] = defaultdict(list)
        
    def check_state(
        self,
        agent_id: str,
        current_state_hash: str,
        current_capability: float
    ) -> Tuple[bool, List[RSISignal], str]:
        """
        Check current state against records.
        
        Returns: (valid, signals, explanation)
        """
        signals = []
        explanations = []
        
        # 1. Verify modification chain
        chain_valid, chain_error = self.logger.verify_chain(agent_id)
        if not chain_valid:
            signals.append(RSISignal.AUDIT_TRAIL_BREAK)
            explanations.append(f"Chain verification failed: {chain_error}")
            
        # 2. Check expected hash
        expected_hash = self.logger.current_hashes.get(agent_id)
        if expected_hash and expected_hash != current_state_hash:
            signals.append(RSISignal.UNAUTHORIZED_MODIFICATION)
            explanations.append(f"State hash mismatch: expected {expected_hash[:8]}, got {current_state_hash[:8]}")
            
        # 3. Check capability delta
        allowed, delta, reason = self.limiter.check_delta(agent_id, current_capability)
        if not allowed:
            signals.append(RSISignal.CAPABILITY_SPIKE)
            explanations.append(f"Capability limit exceeded: {reason}")
            
        # 4. Check checkpoint consistency
        latest_ckpt = self.checkpoint_mgr.get_latest_checkpoint(agent_id)
        if latest_ckpt:
            # Capability shouldn't decrease without rollback
            if current_capability < latest_ckpt.capability_level - 0.1:
                signals.append(RSISignal.CHECKPOINT_MISMATCH)
                explanations.append(
                    f"Capability below checkpoint: {current_capability:.2f} < {latest_ckpt.capability_level:.2f}"
                )
                
        if signals:
            self.detections[agent_id].append({
                'signals': [s.name for s in signals],
                'explanations': explanations,
                'timestamp': datetime.now()
            })
            
        valid = len(signals) == 0
        explanation = "; ".join(explanations) if explanations else "State valid"
        
        return valid, signals, explanation
        
    def get_detection_history(self, agent_id: str) -> List[Dict]:
        """Get history of detections for an agent."""
        return self.detections.get(agent_id, [])


# =============================================================================
# RSI CONTROL SYSTEM (Main Interface)
# =============================================================================

class RSIControlSystem:
    """
    Main interface for RSI (Recursive Self-Improvement) control.
    """
    
    def __init__(self):
        self.logger = ModificationLogger()
        self.limiter = CapabilityDeltaLimiter()
        self.checkpoint_mgr = CheckpointManager()
        self.hitl_gate = HITLGate(self.logger)
        self.detector = SelfModificationDetector(
            self.logger, self.limiter, self.checkpoint_mgr
        )
        
        # Statistics
        self.stats = {
            'modifications_logged': 0,
            'modifications_approved': 0,
            'modifications_denied': 0,
            'checkpoints_created': 0,
            'unauthorized_detected': 0,
            'rollbacks_performed': 0
        }
        
    def initialize_agent(
        self,
        agent_id: str,
        initial_state: str,
        initial_capability: float
    ) -> Tuple[str, str]:
        """Initialize RSI tracking for an agent."""
        state_hash = self.logger.initialize_agent(agent_id, initial_state)
        self.limiter.record_capability(agent_id, initial_capability)
        
        checkpoint = self.checkpoint_mgr.create_checkpoint(
            agent_id=agent_id,
            state_hash=state_hash,
            capability_level=initial_capability,
            metadata={'type': 'initial'}
        )
        
        self.stats['checkpoints_created'] += 1
        
        return state_hash, checkpoint.checkpoint_id
        
    def request_modification(
        self,
        agent_id: str,
        modification_type: ModificationType,
        description: str,
        capability_delta: float,
        new_state: str,
        justification: str = ""
    ) -> Tuple[bool, ModificationRecord, str]:
        """
        Request a modification with full tracking.
        
        Returns: (approved, record, message)
        """
        # Check capability limits first
        history = self.limiter.capability_history.get(agent_id, [])
        current_cap = history[-1][1] if history else 0.5
        proposed_cap = current_cap + capability_delta
        
        allowed, delta, limit_msg = self.limiter.check_delta(agent_id, proposed_cap)
        
        if not allowed:
            # Log denied modification
            record = self.logger.log_modification(
                agent_id=agent_id,
                modification_type=modification_type,
                description=description,
                capability_delta=capability_delta,
                new_state=new_state
            )
            record.approval_status = ApprovalStatus.DENIED
            record.metadata['denial_reason'] = limit_msg
            self.stats['modifications_denied'] += 1
            return False, record, f"Denied: {limit_msg}"
            
        # Log the modification
        record = self.logger.log_modification(
            agent_id=agent_id,
            modification_type=modification_type,
            description=description,
            capability_delta=capability_delta,
            new_state=new_state
        )
        
        self.stats['modifications_logged'] += 1
        
        # Check if HITL required
        if self.hitl_gate.requires_approval(record):
            self.hitl_gate.request_approval(record, justification)
            record.approval_status = ApprovalStatus.PENDING
            return False, record, "Pending human approval"
            
        # Auto-approved
        if record.is_approved:
            self.limiter.record_capability(agent_id, proposed_cap)
            self.stats['modifications_approved'] += 1
            return True, record, "Auto-approved"
            
        return False, record, "Modification logged but not approved"
        
    def approve_modification(
        self,
        agent_id: str,
        modification_id: str,
        approver_id: str
    ) -> Tuple[bool, str]:
        """Approve a pending modification."""
        success, msg = self.hitl_gate.approve(agent_id, modification_id, approver_id)
        
        if success:
            # Update capability
            for record in self.logger.logs.get(agent_id, []):
                if record.modification_id == modification_id:
                    history = self.limiter.capability_history.get(agent_id, [])
                    current_cap = history[-1][1] if history else 0.5
                    self.limiter.record_capability(
                        agent_id, 
                        current_cap + record.capability_delta
                    )
                    break
                    
            self.stats['modifications_approved'] += 1
            
        return success, msg
        
    def deny_modification(
        self,
        agent_id: str,
        modification_id: str,
        denier_id: str,
        reason: str = ""
    ) -> Tuple[bool, str]:
        """Deny a pending modification."""
        success, msg = self.hitl_gate.deny(agent_id, modification_id, denier_id, reason)
        
        if success:
            self.stats['modifications_denied'] += 1
            
        return success, msg
        
    def create_checkpoint(
        self,
        agent_id: str,
        state_hash: str,
        capability_level: float
    ) -> Checkpoint:
        """Create a verified checkpoint."""
        checkpoint = self.checkpoint_mgr.create_checkpoint(
            agent_id=agent_id,
            state_hash=state_hash,
            capability_level=capability_level
        )
        self.stats['checkpoints_created'] += 1
        return checkpoint
        
    def verify_state(
        self,
        agent_id: str,
        current_state_hash: str,
        current_capability: float
    ) -> Tuple[bool, List[RSISignal], str]:
        """Verify current agent state against records."""
        valid, signals, explanation = self.detector.check_state(
            agent_id, current_state_hash, current_capability
        )
        
        if RSISignal.UNAUTHORIZED_MODIFICATION in signals:
            self.stats['unauthorized_detected'] += 1
            
        return valid, signals, explanation
        
    def assess_rsi_risk(self, agent_id: str) -> RSIAssessment:
        """Comprehensive RSI risk assessment."""
        signals = []
        
        # Check pending modifications
        pending = self.hitl_gate.get_pending_count(agent_id)
        if pending > 3:
            signals.append(RSISignal.HITL_REQUIRED)
            
        # Check capability trajectory
        trajectory = self.limiter.get_capability_trajectory(agent_id)
        if trajectory > 0.1:  # >10% per hour
            signals.append(RSISignal.CAPABILITY_SPIKE)
            
        # Check checkpoint age
        checkpoint_age = self.checkpoint_mgr.get_checkpoint_age_hours(agent_id)
        if checkpoint_age > 24:
            signals.append(RSISignal.CHECKPOINT_MISMATCH)
            
        # Check chain integrity
        chain_valid, _ = self.logger.verify_chain(agent_id)
        if not chain_valid:
            signals.append(RSISignal.AUDIT_TRAIL_BREAK)
            
        # Calculate risk level
        signal_weights = {
            RSISignal.UNAUTHORIZED_MODIFICATION: 0.40,
            RSISignal.CAPABILITY_SPIKE: 0.30,
            RSISignal.CHECKPOINT_MISMATCH: 0.15,
            RSISignal.ROLLBACK_REQUIRED: 0.25,
            RSISignal.HITL_REQUIRED: 0.10,
            RSISignal.AUDIT_TRAIL_BREAK: 0.35
        }
        
        risk_level = sum(signal_weights.get(s, 0.1) for s in signals)
        risk_level = min(risk_level, 1.0)
        
        # Recommended action
        if risk_level > 0.6:
            action = "ROLLBACK: High RSI risk. Revert to last verified checkpoint."
        elif risk_level > 0.4:
            action = "FREEZE: Moderate risk. Halt modifications pending review."
        elif risk_level > 0.2:
            action = "MONITOR: Some signals detected. Increase checkpoint frequency."
        else:
            action = "CONTINUE: RSI risk within acceptable limits."
            
        return RSIAssessment(
            agent_id=agent_id,
            signals=signals,
            risk_level=risk_level,
            pending_modifications=pending,
            capability_trajectory=trajectory,
            last_checkpoint_age_hours=checkpoint_age,
            recommended_action=action
        )
        
    def rollback_to_checkpoint(
        self,
        agent_id: str,
        checkpoint_id: str
    ) -> Tuple[bool, str]:
        """Roll back to a verified checkpoint."""
        checkpoint = self.checkpoint_mgr.get_checkpoint_by_id(agent_id, checkpoint_id)
        
        if not checkpoint:
            return False, "Checkpoint not found"
            
        if not self.checkpoint_mgr.verify_checkpoint(checkpoint):
            return False, "Checkpoint verification failed"
            
        # Update state
        self.logger.current_hashes[agent_id] = checkpoint.state_hash
        self.limiter.record_capability(agent_id, checkpoint.capability_level)
        
        # Log the rollback
        self.logger.log_modification(
            agent_id=agent_id,
            modification_type=ModificationType.ARCHITECTURE_CHANGE,
            description=f"Rollback to checkpoint {checkpoint_id}",
            capability_delta=0,  # Rollback doesn't change capability limits
            new_state=checkpoint.state_hash,
            approved_by="SYSTEM_ROLLBACK"
        )
        
        self.stats['rollbacks_performed'] += 1
        
        return True, f"Rolled back to checkpoint {checkpoint_id}"
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get RSI control statistics."""
        return self.stats.copy()


# =============================================================================
# TESTS
# =============================================================================

def run_tests():
    """Comprehensive test suite for RSI Control."""
    
    print("=" * 70)
    print("ATSF v3.0 - Layer 12: RSI Control Tests")
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
    print("\n[Test Group 1: Agent Initialization]")
    # -------------------------------------------------------------------------
    
    system = RSIControlSystem()
    
    state_hash, ckpt_id = system.initialize_agent(
        "agent_001",
        "initial_weights_v1.0",
        0.50
    )
    
    test("1.1 Agent initialized with state hash",
         len(state_hash) == 32)
         
    test("1.2 Initial checkpoint created",
         ckpt_id.startswith("ckpt_"))
         
    test("1.3 Checkpoint counter incremented",
         system.stats['checkpoints_created'] == 1)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 2: Modification Logging]")
    # -------------------------------------------------------------------------
    
    system2a = RSIControlSystem()
    system2a.initialize_agent("mod_agent", "initial", 0.50)
    
    # Small modification (auto-approved)
    approved, record, msg = system2a.request_modification(
        agent_id="mod_agent",
        modification_type=ModificationType.PARAMETER_TUNE,
        description="Minor learning rate adjustment",
        capability_delta=0.02,
        new_state="weights_v1.1"
    )
    
    test("2.1 Small modification auto-approved",
         approved,
         msg)
         
    test("2.2 Modification logged",
         system2a.stats['modifications_logged'] >= 1)
         
    # New system for large modification test
    system2b = RSIControlSystem()
    system2b.initialize_agent("large_mod_agent", "initial", 0.50)
    
    # Larger modification (needs approval) - uses ARCHITECTURE_CHANGE which always needs HITL
    approved2, record2, msg2 = system2b.request_modification(
        agent_id="large_mod_agent",
        modification_type=ModificationType.ARCHITECTURE_CHANGE,
        description="Adding new reasoning capability",
        capability_delta=0.05,  # Small delta but architecture change needs HITL
        new_state="weights_v2.0"
    )
    
    test("2.3 Architecture modification pending approval",
         not approved2 and "Pending" in msg2,
         msg2)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 3: HITL Approval]")
    # -------------------------------------------------------------------------
    
    pending_count = system2b.hitl_gate.get_pending_count("large_mod_agent")
    test("3.1 Pending modification tracked",
         pending_count >= 1)
         
    # Approve the modification
    success, msg = system2b.approve_modification(
        agent_id="large_mod_agent",
        modification_id=record2.modification_id,
        approver_id="admin_001"
    )
    
    test("3.2 Modification approved successfully",
         success,
         msg)
         
    # Try to approve again (should fail)
    success2, msg2 = system2b.approve_modification(
        agent_id="large_mod_agent",
        modification_id=record2.modification_id,
        approver_id="admin_001"
    )
    
    test("3.3 Double approval rejected",
         not success2)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 4: Capability Limits]")
    # -------------------------------------------------------------------------
    
    system4a = RSIControlSystem()
    system4a.initialize_agent("limit_agent", "state_0", 0.50)
    
    # Make many small modifications that each auto-approve but hit cumulative limit
    denied_count = 0
    approved_count = 0
    for i in range(15):  # 15 * 0.04 = 0.60, should hit daily limit
        approved, record, msg = system4a.request_modification(
            agent_id="limit_agent",
            modification_type=ModificationType.PARAMETER_TUNE,
            description=f"Small tune {i}",
            capability_delta=0.04,  # Below HITL threshold, auto-approves
            new_state=f"state_{i+1}",
            justification="Testing limits"
        )
        if approved:
            approved_count += 1
        elif "limit" in msg.lower():
            denied_count += 1
        
    # Should approve some then hit cycle or daily limit
    test("4.1 Capability rate limiting works",
         denied_count > 0 or approved_count < 15,
         f"approved={approved_count}, denied={denied_count}")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 5: Chain Verification]")
    # -------------------------------------------------------------------------
    
    system5a = RSIControlSystem()
    system5a.initialize_agent("chain_agent", "initial", 0.50)
    
    # Make some modifications - these need to be small enough to auto-approve
    system5a.request_modification("chain_agent", ModificationType.PARAMETER_TUNE, "mod1", 0.02, "state1")
    system5a.request_modification("chain_agent", ModificationType.PARAMETER_TUNE, "mod2", 0.02, "state2")
    
    valid, error = system5a.logger.verify_chain("chain_agent")
    test("5.1 Chain verification passes",
         valid,
         error or "")
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 6: Checkpoint Management]")
    # -------------------------------------------------------------------------
    
    system6 = RSIControlSystem()
    state_hash6, ckpt_id6 = system6.initialize_agent("ckpt_agent", "initial", 0.50)
    
    # Create additional checkpoints
    ckpt2 = system6.create_checkpoint("ckpt_agent", "state_v2", 0.55)
    ckpt3 = system6.create_checkpoint("ckpt_agent", "state_v3", 0.60)
    
    test("6.1 Multiple checkpoints created",
         system6.stats['checkpoints_created'] >= 3)
         
    # Verify checkpoint
    verified = system6.checkpoint_mgr.verify_checkpoint(ckpt2)
    test("6.2 Checkpoint verification works",
         verified)
         
    # Get latest
    latest = system6.checkpoint_mgr.get_latest_checkpoint("ckpt_agent")
    test("6.3 Latest checkpoint retrievable",
         latest is not None and latest.checkpoint_id == ckpt3.checkpoint_id)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 7: State Verification]")
    # -------------------------------------------------------------------------
    
    system7 = RSIControlSystem()
    state_hash7, _ = system7.initialize_agent("verify_agent", "initial_state", 0.50)
    
    # Verify correct state
    valid, signals, msg = system7.verify_state(
        "verify_agent",
        state_hash7,
        0.50
    )
    
    test("7.1 Correct state validates",
         valid,
         msg)
         
    # Verify incorrect state (unauthorized modification)
    valid2, signals2, msg2 = system7.verify_state(
        "verify_agent",
        "tampered_hash_12345678",
        0.50
    )
    
    test("7.2 Incorrect state detected",
         not valid2 and RSISignal.UNAUTHORIZED_MODIFICATION in signals2,
         msg2)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 8: Rollback]")
    # -------------------------------------------------------------------------
    
    system8 = RSIControlSystem()
    state_hash8, ckpt_id8 = system8.initialize_agent("rollback_agent", "initial", 0.50)
    
    # Make modifications
    system8.request_modification("rollback_agent", ModificationType.PARAMETER_TUNE, "mod1", 0.03, "state1")
    system8.create_checkpoint("rollback_agent", "state1", 0.53)
    
    system8.request_modification("rollback_agent", ModificationType.PARAMETER_TUNE, "mod2", 0.03, "state2")
    
    # Rollback to initial checkpoint
    success, msg = system8.rollback_to_checkpoint("rollback_agent", ckpt_id8)
    
    test("8.1 Rollback successful",
         success,
         msg)
         
    test("8.2 Rollback counter incremented",
         system8.stats['rollbacks_performed'] >= 1)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 9: RSI Assessment]")
    # -------------------------------------------------------------------------
    
    assessment = system8.assess_rsi_risk("rollback_agent")
    
    test("9.1 Assessment generated",
         assessment is not None)
         
    test("9.2 Assessment has risk level",
         0 <= assessment.risk_level <= 1)
         
    test("9.3 Assessment has recommended action",
         len(assessment.recommended_action) > 0)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 10: Denial Flow]")
    # -------------------------------------------------------------------------
    
    system10 = RSIControlSystem()
    system10.initialize_agent("deny_agent", "initial", 0.50)
    
    # Request architecture modification (requires HITL)
    approved, record, msg = system10.request_modification(
        agent_id="deny_agent",
        modification_type=ModificationType.ARCHITECTURE_CHANGE,
        description="Major architecture overhaul",
        capability_delta=0.05,  # Small enough to not hit limits
        new_state="new_arch"
    )
    
    test("10.1 Architecture modification requires approval",
         not approved and record.approval_status == ApprovalStatus.PENDING,
         msg)
         
    # Deny it
    success, msg = system10.deny_modification(
        agent_id="deny_agent",
        modification_id=record.modification_id,
        denier_id="security_admin",
        reason="Insufficient justification"
    )
    
    test("10.2 Modification denied",
         success,
         msg)
         
    test("10.3 Denial counter incremented",
         system10.stats['modifications_denied'] >= 1)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 11: Statistics]")
    # -------------------------------------------------------------------------
    
    stats = system.get_statistics()
    
    test("11.1 Modifications logged tracked",
         'modifications_logged' in stats)
         
    test("11.2 Checkpoints created tracked",
         stats['checkpoints_created'] >= 1)
         
    # -------------------------------------------------------------------------
    print("\n[Test Group 12: Edge Cases]")
    # -------------------------------------------------------------------------
    
    system12 = RSIControlSystem()
    
    # Unknown agent rollback
    success, msg = system12.rollback_to_checkpoint("unknown_agent", "fake_ckpt")
    test("12.1 Unknown agent rollback fails gracefully",
         not success)
         
    # Empty assessment
    assessment = system12.assess_rsi_risk("nonexistent_agent")
    test("12.2 Empty agent assessment works",
         assessment is not None)
         
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
