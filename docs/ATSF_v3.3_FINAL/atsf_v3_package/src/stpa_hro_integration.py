"""
ATSF v3.3 - STPA Control Structure & HRO Integration
======================================================

Implements Systems-Theoretic Process Analysis (STPA) methodology
and High Reliability Organization (HRO) principles.

Based on Document 2 recommendations:
- STPA over FMEA for complex software systems
- Control structure modeling
- Unsafe Control Action (UCA) identification
- HRO five principles integration
- Hierarchy of Controls alignment

Author: ATSF Development Team
Version: 3.3.0
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Any
from enum import Enum
import hashlib

logger = logging.getLogger("atsf.stpa")


# =============================================================================
# STPA CONTROL STRUCTURE MODELING
# =============================================================================

class ControllerType(str, Enum):
    """Types of controllers in the system."""
    HUMAN_OPERATOR = "human_operator"
    HUMAN_OVERSIGHT = "human_oversight"
    AUTOMATED_MONITOR = "automated_monitor"
    AI_AGENT = "ai_agent"
    TRUST_ENGINE = "trust_engine"
    VERIFIER_NETWORK = "verifier_network"
    CREATOR_REGISTRY = "creator_registry"


class ControlActionType(str, Enum):
    """Types of control actions."""
    ALLOW_ACTION = "allow_action"
    DENY_ACTION = "deny_action"
    REQUIRE_APPROVAL = "require_approval"
    QUARANTINE = "quarantine"
    TERMINATE = "terminate"
    UPDATE_TRUST = "update_trust"
    SLASH_STAKE = "slash_stake"
    ESCALATE = "escalate"


class UCAType(str, Enum):
    """
    Types of Unsafe Control Actions (per STPA methodology).
    
    An accident results from inadequate control - specifically when
    a control action is:
    1. Not provided when required
    2. Provided but causes a hazard
    3. Provided too early, too late, or out of sequence
    4. Stopped too soon or applied too long
    """
    NOT_PROVIDED = "not_provided"
    PROVIDED_CAUSES_HAZARD = "provided_causes_hazard"
    WRONG_TIMING = "wrong_timing"
    WRONG_DURATION = "wrong_duration"


@dataclass
class SystemLoss:
    """
    System-level loss (per STPA Step 1).
    
    These are the unacceptable outcomes we're trying to prevent.
    """
    loss_id: str
    description: str
    severity: str  # catastrophic, critical, major, minor
    examples: List[str] = field(default_factory=list)


@dataclass
class SystemHazard:
    """
    System-level hazard that could lead to a loss.
    
    A hazard is a system state that, together with environmental
    conditions, can lead to a loss.
    """
    hazard_id: str
    description: str
    related_losses: List[str]  # loss_ids
    constraints: List[str]  # safety constraints to prevent this hazard


@dataclass
class Controller:
    """
    Controller in the STPA control structure.
    
    Controllers receive feedback and issue control actions
    to controlled processes.
    """
    controller_id: str
    controller_type: ControllerType
    name: str
    description: str
    
    # Control actions this controller can issue
    control_actions: List[ControlActionType] = field(default_factory=list)
    
    # Process model (what the controller "believes" about the system)
    process_model: Dict[str, Any] = field(default_factory=dict)
    
    # Feedback received by this controller
    feedback_sources: List[str] = field(default_factory=list)
    
    # Controllers above this one in hierarchy
    parent_controllers: List[str] = field(default_factory=list)
    
    # Controllers below this one
    child_controllers: List[str] = field(default_factory=list)


@dataclass
class UnsafeControlAction:
    """
    Identified Unsafe Control Action (STPA Step 3).
    
    Represents a control action that could be unsafe in certain contexts.
    """
    uca_id: str
    controller_id: str
    control_action: ControlActionType
    uca_type: UCAType
    context: str
    hazard_id: str
    description: str
    
    # Mitigations
    constraints: List[str] = field(default_factory=list)
    mitigations: List[str] = field(default_factory=list)


@dataclass
class LossScenario:
    """
    Loss Scenario (STPA Step 4).
    
    Describes how an UCA could occur - the causal factors
    including software logic, human factors, and environmental inputs.
    """
    scenario_id: str
    uca_id: str
    causal_factors: List[str]
    scenario_description: str
    likelihood: str  # high, medium, low
    existing_controls: List[str]
    recommended_controls: List[str]


class STPAAnalyzer:
    """
    STPA Analysis Engine for ATSF.
    
    Models the complete control structure of the agent safety system
    and identifies potential unsafe control actions.
    """
    
    def __init__(self):
        self.losses: Dict[str, SystemLoss] = {}
        self.hazards: Dict[str, SystemHazard] = {}
        self.controllers: Dict[str, Controller] = {}
        self.ucas: Dict[str, UnsafeControlAction] = {}
        self.scenarios: Dict[str, LossScenario] = {}
        
        # Initialize ATSF-specific losses, hazards, and control structure
        self._initialize_atsf_stpa()
    
    def _initialize_atsf_stpa(self):
        """Initialize STPA analysis for ATSF system."""
        
        # =================================================================
        # STEP 1: Define System Losses
        # =================================================================
        
        self.losses = {
            "L1": SystemLoss(
                loss_id="L1",
                description="Agent causes harm to humans or systems",
                severity="catastrophic",
                examples=[
                    "Agent executes code that damages critical infrastructure",
                    "Agent leaks sensitive personal data",
                    "Agent manipulates financial systems causing losses",
                ]
            ),
            "L2": SystemLoss(
                loss_id="L2",
                description="Malicious actor gains unauthorized control",
                severity="critical",
                examples=[
                    "Attacker hijacks agent via indirect prompt injection",
                    "Compromised creator deploys malicious agents",
                    "Verifier collusion allows unsafe actions",
                ]
            ),
            "L3": SystemLoss(
                loss_id="L3",
                description="Legitimate operations blocked (false positive)",
                severity="major",
                examples=[
                    "Safe agent quarantined incorrectly",
                    "Valid actions denied due to overly aggressive thresholds",
                    "Creator reputation damaged unfairly",
                ]
            ),
            "L4": SystemLoss(
                loss_id="L4",
                description="System becomes unresponsive or unavailable",
                severity="major",
                examples=[
                    "Trust engine overwhelmed by Sybil attack",
                    "Verifier network consensus failure",
                    "Cascading quarantine of legitimate agents",
                ]
            ),
        }
        
        # =================================================================
        # STEP 2: Define System Hazards
        # =================================================================
        
        self.hazards = {
            "H1": SystemHazard(
                hazard_id="H1",
                description="Unsafe agent action permitted",
                related_losses=["L1", "L2"],
                constraints=[
                    "SC1: Actions must be evaluated before execution",
                    "SC2: High-risk actions require multi-party verification",
                    "SC3: Trust score must be sufficient for action type",
                ]
            ),
            "H2": SystemHazard(
                hazard_id="H2",
                description="Trust score does not reflect true agent behavior",
                related_losses=["L1", "L3"],
                constraints=[
                    "SC4: Trust must incorporate multiple signal sources",
                    "SC5: Trust velocity must be rate-limited",
                    "SC6: Trust must decay over time without positive signals",
                ]
            ),
            "H3": SystemHazard(
                hazard_id="H3",
                description="Malicious input processed as trusted data",
                related_losses=["L1", "L2"],
                constraints=[
                    "SC7: All external inputs must be sanitized",
                    "SC8: Tool outputs must be scanned before processing",
                    "SC9: Role markers in data must trigger alerts",
                ]
            ),
            "H4": SystemHazard(
                hazard_id="H4",
                description="Human oversight bypassed or ineffective",
                related_losses=["L1", "L2", "L3"],
                constraints=[
                    "SC10: Critical actions must have human approval path",
                    "SC11: Approval requests must not time out silently",
                    "SC12: Humans must have veto power over automated decisions",
                ]
            ),
            "H5": SystemHazard(
                hazard_id="H5",
                description="Creator accountability fails to constrain agent",
                related_losses=["L1", "L2"],
                constraints=[
                    "SC13: Agent ceiling <= Creator ceiling",
                    "SC14: Creator violations must impact all their agents",
                    "SC15: Stake must be slashed for accountability",
                ]
            ),
        }
        
        # =================================================================
        # STEP 2: Define Control Structure
        # =================================================================
        
        self.controllers = {
            "C1": Controller(
                controller_id="C1",
                controller_type=ControllerType.HUMAN_OVERSIGHT,
                name="Human Oversight Panel",
                description="Human reviewers who approve high-risk actions",
                control_actions=[
                    ControlActionType.ALLOW_ACTION,
                    ControlActionType.DENY_ACTION,
                    ControlActionType.QUARANTINE,
                    ControlActionType.TERMINATE,
                ],
                process_model={
                    "agent_context": "From approval request",
                    "risk_assessment": "From trust engine",
                    "historical_behavior": "From audit logs",
                },
                feedback_sources=["Approval outcomes", "Agent behavior post-approval"],
                parent_controllers=[],
                child_controllers=["C2", "C3"],
            ),
            "C2": Controller(
                controller_id="C2",
                controller_type=ControllerType.TRUST_ENGINE,
                name="ATSF Trust Engine",
                description="Core trust scoring and action processing",
                control_actions=[
                    ControlActionType.ALLOW_ACTION,
                    ControlActionType.DENY_ACTION,
                    ControlActionType.REQUIRE_APPROVAL,
                    ControlActionType.UPDATE_TRUST,
                    ControlActionType.QUARANTINE,
                ],
                process_model={
                    "agent_trust_score": "Continuously updated",
                    "creator_reputation": "From creator registry",
                    "action_risk_level": "Calculated per action",
                    "reasoning_quality": "From L44 evaluator",
                },
                feedback_sources=[
                    "Action outcomes",
                    "L43 sanitizer signals",
                    "L44 reasoning analysis",
                    "Verifier network votes",
                    "Red team probe results",
                ],
                parent_controllers=["C1"],
                child_controllers=["C4", "C5", "C6"],
            ),
            "C3": Controller(
                controller_id="C3",
                controller_type=ControllerType.CREATOR_REGISTRY,
                name="Creator Accountability System",
                description="Manages creator reputation, staking, and status",
                control_actions=[
                    ControlActionType.UPDATE_TRUST,
                    ControlActionType.SLASH_STAKE,
                    ControlActionType.QUARANTINE,
                    ControlActionType.TERMINATE,
                ],
                process_model={
                    "creator_reputation": "Historical track record",
                    "stake_balance": "Economic commitment",
                    "violation_history": "With time decay",
                    "agent_portfolio": "All deployed agents",
                },
                feedback_sources=[
                    "Agent violations",
                    "Successful operations",
                    "External verifications",
                ],
                parent_controllers=["C1"],
                child_controllers=["C2"],
            ),
            "C4": Controller(
                controller_id="C4",
                controller_type=ControllerType.VERIFIER_NETWORK,
                name="Multi-Party Verifier Network",
                description="Independent verification of high-risk actions",
                control_actions=[
                    ControlActionType.ALLOW_ACTION,
                    ControlActionType.DENY_ACTION,
                    ControlActionType.ESCALATE,
                ],
                process_model={
                    "action_details": "From trust engine",
                    "agent_history": "From trust engine",
                    "verifier_consensus": "Stake-weighted voting",
                },
                feedback_sources=[
                    "Verification accuracy (post-hoc)",
                    "Dissenting opinions",
                ],
                parent_controllers=["C2"],
                child_controllers=[],
            ),
            "C5": Controller(
                controller_id="C5",
                controller_type=ControllerType.AUTOMATED_MONITOR,
                name="Red Team Scheduler",
                description="Continuous adversarial probing of agents",
                control_actions=[
                    ControlActionType.ESCALATE,
                    ControlActionType.UPDATE_TRUST,
                ],
                process_model={
                    "probe_results": "Pass/fail for each probe type",
                    "agent_vulnerability_profile": "Category scores",
                },
                feedback_sources=[
                    "Probe responses",
                    "Agent behavior changes over time",
                ],
                parent_controllers=["C2"],
                child_controllers=[],
            ),
            "C6": Controller(
                controller_id="C6",
                controller_type=ControllerType.AI_AGENT,
                name="Monitored AI Agent",
                description="The AI agent being controlled by ATSF",
                control_actions=[],  # Agent doesn't control ATSF
                process_model={
                    "task_context": "From user/system",
                    "available_tools": "Constrained by trust",
                    "own_reasoning": "Internal chain-of-thought",
                },
                feedback_sources=[],  # Agent receives constraints from ATSF
                parent_controllers=["C2"],
                child_controllers=[],
            ),
        }
        
        # =================================================================
        # STEP 3: Identify Unsafe Control Actions
        # =================================================================
        
        self.ucas = {
            "UCA1": UnsafeControlAction(
                uca_id="UCA1",
                controller_id="C2",
                control_action=ControlActionType.ALLOW_ACTION,
                uca_type=UCAType.PROVIDED_CAUSES_HAZARD,
                context="When agent trust score has been artificially inflated through trust farming",
                hazard_id="H1",
                description="Trust engine allows action based on farmed trust score",
                constraints=["SC5: Trust velocity must be rate-limited"],
                mitigations=[
                    "Per-hour and per-day velocity caps",
                    "Detect patterns of rapid benign-then-malicious behavior",
                    "Require longer trust history for high-risk actions",
                ],
            ),
            "UCA2": UnsafeControlAction(
                uca_id="UCA2",
                controller_id="C2",
                control_action=ControlActionType.ALLOW_ACTION,
                uca_type=UCAType.PROVIDED_CAUSES_HAZARD,
                context="When tool output contains indirect prompt injection",
                hazard_id="H3",
                description="Trust engine allows action without sanitizing tool output",
                constraints=["SC8: Tool outputs must be scanned before processing"],
                mitigations=[
                    "L43 sanitizer in action processing pipeline",
                    "Block on high-confidence injection signals",
                    "ML fallback for obfuscated attacks",
                ],
            ),
            "UCA3": UnsafeControlAction(
                uca_id="UCA3",
                controller_id="C2",
                control_action=ControlActionType.DENY_ACTION,
                uca_type=UCAType.PROVIDED_CAUSES_HAZARD,
                context="When action is legitimate but appears similar to known attack patterns",
                hazard_id="H2",
                description="Trust engine denies legitimate action (false positive)",
                constraints=["SC4: Trust must incorporate multiple signal sources"],
                mitigations=[
                    "Require multiple signals for denial",
                    "Provide appeal workflow",
                    "Human override capability",
                ],
            ),
            "UCA4": UnsafeControlAction(
                uca_id="UCA4",
                controller_id="C2",
                control_action=ControlActionType.REQUIRE_APPROVAL,
                uca_type=UCAType.NOT_PROVIDED,
                context="When high-risk action processed without human review",
                hazard_id="H4",
                description="Trust engine doesn't escalate action that exceeds risk threshold",
                constraints=["SC10: Critical actions must have human approval path"],
                mitigations=[
                    "Strict risk threshold checks",
                    "Multiple trigger conditions for escalation",
                    "Audit logging of all decisions",
                ],
            ),
            "UCA5": UnsafeControlAction(
                uca_id="UCA5",
                controller_id="C1",
                control_action=ControlActionType.ALLOW_ACTION,
                uca_type=UCAType.WRONG_TIMING,
                context="When approval given after context has changed",
                hazard_id="H4",
                description="Human approves stale request; context has changed to unsafe",
                constraints=["SC11: Approval requests must not time out silently"],
                mitigations=[
                    "Approval expiration with context re-verification",
                    "Show human reviewers latest context",
                    "Require re-approval if context drift detected",
                ],
            ),
            "UCA6": UnsafeControlAction(
                uca_id="UCA6",
                controller_id="C4",
                control_action=ControlActionType.ALLOW_ACTION,
                uca_type=UCAType.PROVIDED_CAUSES_HAZARD,
                context="When majority of verifiers are colluding",
                hazard_id="H1",
                description="Verifier network approves unsafe action due to collusion",
                constraints=["SC2: High-risk actions require multi-party verification"],
                mitigations=[
                    "Random verifier selection",
                    "Stake requirements with slashing",
                    "Collusion detection patterns",
                    "Cross-model verification (different AI families)",
                ],
            ),
            "UCA7": UnsafeControlAction(
                uca_id="UCA7",
                controller_id="C3",
                control_action=ControlActionType.SLASH_STAKE,
                uca_type=UCAType.NOT_PROVIDED,
                context="When agent violation occurs but creator stake not slashed",
                hazard_id="H5",
                description="Creator faces no economic consequence for bad agent",
                constraints=["SC15: Stake must be slashed for accountability"],
                mitigations=[
                    "Automatic slash on violation detection",
                    "Graduated slashing based on severity",
                    "Lock stake before agent deployment",
                ],
            ),
        }
        
        # =================================================================
        # STEP 4: Define Loss Scenarios
        # =================================================================
        
        self.scenarios = {
            "LS1": LossScenario(
                scenario_id="LS1",
                uca_id="UCA2",
                causal_factors=[
                    "Attacker poisons external API response",
                    "API response contains obfuscated instruction injection",
                    "Regex patterns fail to detect obfuscation",
                    "ML fallback not enabled or model not available",
                    "Agent processes poisoned data as trusted",
                ],
                scenario_description="Indirect prompt injection via tool output bypasses sanitization",
                likelihood="medium",
                existing_controls=["L43 sanitizer", "Regex patterns"],
                recommended_controls=[
                    "Enable ML fallback detection",
                    "Block on ANY injection signal (not just high confidence)",
                    "Sandbox tool output processing",
                ],
            ),
            "LS2": LossScenario(
                scenario_id="LS2",
                uca_id="UCA1",
                causal_factors=[
                    "Attacker creates agent that performs many benign actions",
                    "Trust score rises to high level",
                    "Attacker then issues malicious action",
                    "Trust score is sufficient to bypass checks",
                ],
                scenario_description="Trust farming attack followed by malicious action",
                likelihood="medium",
                existing_controls=["Per-action velocity cap"],
                recommended_controls=[
                    "Per-hour velocity cap",
                    "Per-day velocity cap",
                    "Behavioral drift detection",
                    "Require longer history for critical actions",
                ],
            ),
            "LS3": LossScenario(
                scenario_id="LS3",
                uca_id="UCA6",
                causal_factors=[
                    "Adversary compromises or bribes multiple verifiers",
                    "Verifiers coordinate approval timing",
                    "Random selection repeatedly selects colluding verifiers",
                    "Stake is insufficient deterrent",
                ],
                scenario_description="Verifier network collusion attack",
                likelihood="low",
                existing_controls=["Random selection", "Stake requirement"],
                recommended_controls=[
                    "Increase minimum stake",
                    "Detect synchronized voting patterns",
                    "Cross-model verification",
                    "Geographic/organizational diversity requirement",
                ],
            ),
        }
        
        logger.info(f"STPA analysis initialized: {len(self.losses)} losses, "
                   f"{len(self.hazards)} hazards, {len(self.controllers)} controllers, "
                   f"{len(self.ucas)} UCAs, {len(self.scenarios)} scenarios")
    
    def get_control_structure_diagram(self) -> str:
        """Generate ASCII diagram of control structure."""
        return """
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ATSF CONTROL STRUCTURE (STPA)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                         ┌────────────────────────┐                               │
│                         │   C1: HUMAN OVERSIGHT  │                               │
│                         │  (Approval Panel)      │                               │
│                         └───────────┬────────────┘                               │
│                                     │                                            │
│              Control Actions:       │ Approve/Deny/Quarantine/Terminate          │
│              Feedback: Outcomes     ▼                                            │
│        ┌────────────────────────────┴────────────────────────────────┐          │
│        │                                                              │          │
│        ▼                                                              ▼          │
│  ┌─────────────────────┐                               ┌─────────────────────┐   │
│  │  C3: CREATOR        │──── Agent Ceiling ──────────▶│  C2: TRUST ENGINE   │   │
│  │  ACCOUNTABILITY     │                               │  (Core Processing)  │   │
│  │                     │◀──── Violation Reports ──────│                     │   │
│  └─────────────────────┘                               └─────────┬───────────┘   │
│        │                                                         │               │
│        │ Slash Stake                        Control Actions:     │               │
│        │ Update Rep                         Allow/Deny/Escalate  │               │
│        ▼                                                         ▼               │
│  [Creator Pool]            ┌─────────────────────────────────────┴───────────┐  │
│                            │                     │                     │      │  │
│                            ▼                     ▼                     ▼      │  │
│                   ┌─────────────────┐   ┌─────────────────┐   ┌────────────┐  │  │
│                   │ C4: VERIFIER    │   │ C5: RED TEAM    │   │ C6: AGENT  │  │  │
│                   │ NETWORK         │   │ SCHEDULER       │   │ (Monitored)│  │  │
│                   └────────┬────────┘   └────────┬────────┘   └─────┬──────┘  │  │
│                            │                     │                   │         │  │
│                 Feedback:  │                     │ Probe             │ Action  │  │
│                 Votes      │                     │ Results           │ Requests│  │
│                            ▼                     ▼                   ▼         │  │
│                   [Verification      [Vulnerability         [Action           │  │
│                    Outcomes]          Profiles]              Outcomes]         │  │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  SAFETY CONSTRAINTS:                                                             │
│    SC1: Actions evaluated before execution                                       │
│    SC2: High-risk requires multi-party verification                              │
│    SC3: Trust score sufficient for action type                                   │
│    SC5: Trust velocity rate-limited                                              │
│    SC8: Tool outputs scanned before processing                                   │
│    SC10: Critical actions have human approval path                               │
│    SC13: Agent ceiling ≤ Creator ceiling                                         │
│    SC15: Stake slashed for accountability                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
"""
    
    def analyze_action(self, action_context: Dict) -> Dict:
        """
        Analyze an action request through STPA lens.
        
        Returns relevant UCAs and loss scenarios.
        """
        relevant_ucas = []
        relevant_scenarios = []
        
        # Check for UCA2 (tool output injection)
        if action_context.get("has_tool_outputs"):
            relevant_ucas.append(self.ucas["UCA2"])
            relevant_scenarios.append(self.scenarios["LS1"])
        
        # Check for UCA1 (trust farming)
        if action_context.get("rapid_trust_increase"):
            relevant_ucas.append(self.ucas["UCA1"])
            relevant_scenarios.append(self.scenarios["LS2"])
        
        # Check for UCA4 (missing escalation)
        if action_context.get("risk_score", 0) > 0.6:
            relevant_ucas.append(self.ucas["UCA4"])
        
        return {
            "relevant_ucas": [u.uca_id for u in relevant_ucas],
            "relevant_scenarios": [s.scenario_id for s in relevant_scenarios],
            "safety_constraints": list(set(
                c for uca in relevant_ucas for c in uca.constraints
            )),
            "recommended_mitigations": list(set(
                m for uca in relevant_ucas for m in uca.mitigations
            )),
        }
    
    def export_analysis(self) -> Dict:
        """Export full STPA analysis as dictionary."""
        return {
            "losses": {k: {
                "description": v.description,
                "severity": v.severity,
                "examples": v.examples
            } for k, v in self.losses.items()},
            "hazards": {k: {
                "description": v.description,
                "related_losses": v.related_losses,
                "constraints": v.constraints
            } for k, v in self.hazards.items()},
            "controllers": {k: {
                "name": v.name,
                "type": v.controller_type.value,
                "control_actions": [a.value for a in v.control_actions],
            } for k, v in self.controllers.items()},
            "ucas": {k: {
                "controller": v.controller_id,
                "action": v.control_action.value,
                "type": v.uca_type.value,
                "context": v.context,
                "hazard": v.hazard_id,
                "mitigations": v.mitigations
            } for k, v in self.ucas.items()},
            "scenarios": {k: {
                "uca": v.uca_id,
                "causal_factors": v.causal_factors,
                "likelihood": v.likelihood,
                "recommended_controls": v.recommended_controls
            } for k, v in self.scenarios.items()},
        }


# =============================================================================
# HRO PRINCIPLES INTEGRATION
# =============================================================================

class HROPrinciple(str, Enum):
    """
    The Five Principles of High Reliability Organizations.
    
    From Weick & Sutcliffe's research on organizations that
    operate in high-risk environments with exceptional safety records.
    """
    PREOCCUPATION_WITH_FAILURE = "preoccupation_with_failure"
    RELUCTANCE_TO_SIMPLIFY = "reluctance_to_simplify"
    SENSITIVITY_TO_OPERATIONS = "sensitivity_to_operations"
    COMMITMENT_TO_RESILIENCE = "commitment_to_resilience"
    DEFERENCE_TO_EXPERTISE = "deference_to_expertise"


@dataclass
class HROEvent:
    """An event logged according to HRO principles."""
    event_id: str
    timestamp: datetime
    principle: HROPrinciple
    event_type: str
    description: str
    severity: str
    resolution: str = ""
    lessons_learned: List[str] = field(default_factory=list)
    reported_by: str = ""


class HROMonitor:
    """
    High Reliability Organization principles monitor.
    
    Ensures ATSF operates according to HRO principles:
    1. Preoccupation with Failure - treat near-misses as learning opportunities
    2. Reluctance to Simplify - don't dismiss anomalies as "glitches"
    3. Sensitivity to Operations - ground decisions in reality, not abstractions
    4. Commitment to Resilience - assume prevention will fail, prepare recovery
    5. Deference to Expertise - authority to experts, not hierarchy
    """
    
    def __init__(self):
        self.events: List[HROEvent] = []
        self.near_misses: List[HROEvent] = []
        self.anomalies: List[Dict] = []
        
        # HRO metrics
        self.metrics = {
            "near_misses_reported": 0,
            "anomalies_investigated": 0,
            "false_positives_analyzed": 0,
            "recovery_drills": 0,
            "expert_overrides": 0,
        }
    
    def report_near_miss(
        self,
        description: str,
        what_prevented_loss: str,
        reported_by: str = "system"
    ) -> HROEvent:
        """
        Report a near-miss event.
        
        HRO Principle: Preoccupation with Failure
        Near-misses are free lessons - they show where the system almost failed.
        """
        event = HROEvent(
            event_id=f"nm_{hashlib.sha256(f'{datetime.now()}'.encode()).hexdigest()[:8]}",
            timestamp=datetime.now(),
            principle=HROPrinciple.PREOCCUPATION_WITH_FAILURE,
            event_type="near_miss",
            description=description,
            severity="warning",
            resolution=what_prevented_loss,
            reported_by=reported_by
        )
        
        self.near_misses.append(event)
        self.events.append(event)
        self.metrics["near_misses_reported"] += 1
        
        logger.warning(f"Near-miss reported: {description} (prevented by: {what_prevented_loss})")
        
        return event
    
    def investigate_anomaly(
        self,
        anomaly_description: str,
        initial_assessment: str,
        deep_investigation: str
    ) -> Dict:
        """
        Investigate an anomaly without simplifying.
        
        HRO Principle: Reluctance to Simplify
        Don't dismiss anomalies as "glitches" or "human error" - dig deeper.
        """
        investigation = {
            "id": f"inv_{hashlib.sha256(f'{datetime.now()}'.encode()).hexdigest()[:8]}",
            "timestamp": datetime.now().isoformat(),
            "anomaly": anomaly_description,
            "initial_assessment": initial_assessment,
            "deep_investigation": deep_investigation,
            "root_causes": [],
            "systemic_factors": [],
            "recommendations": [],
        }
        
        # Flag if initial assessment is too simple
        simple_explanations = ["human error", "glitch", "bug", "random", "one-off"]
        if any(s in initial_assessment.lower() for s in simple_explanations):
            investigation["warning"] = (
                "Initial assessment may be oversimplified. "
                "HRO principle: Reluctance to Simplify - dig deeper."
            )
            logger.warning(f"Anomaly investigation may be oversimplified: {initial_assessment}")
        
        self.anomalies.append(investigation)
        self.metrics["anomalies_investigated"] += 1
        
        return investigation
    
    def ground_in_operations(
        self,
        proposed_change: str,
        operator_feedback: str,
        work_as_imagined: str,
        work_as_done: str
    ) -> Dict:
        """
        Ensure decisions are grounded in operational reality.
        
        HRO Principle: Sensitivity to Operations
        Value front-line operator perspective over abstract plans.
        """
        analysis = {
            "proposed_change": proposed_change,
            "operator_feedback": operator_feedback,
            "work_as_imagined": work_as_imagined,
            "work_as_done": work_as_done,
            "gap_analysis": [],
            "adjusted_recommendation": "",
        }
        
        # Identify gaps between imagined and actual work
        if work_as_imagined != work_as_done:
            analysis["gap_analysis"].append(
                "GAP DETECTED: Work-as-imagined differs from work-as-done. "
                "Proposed change may not work in practice."
            )
            analysis["adjusted_recommendation"] = (
                f"Revise '{proposed_change}' based on operator feedback: '{operator_feedback}'"
            )
        
        return analysis
    
    def prepare_recovery(
        self,
        failure_type: str,
        recovery_plan: str,
        backup_systems: List[str],
        drill_date: datetime = None
    ) -> Dict:
        """
        Prepare for failure with recovery capability.
        
        HRO Principle: Commitment to Resilience
        Assume prevention will eventually fail. Invest in recovery.
        """
        recovery = {
            "failure_type": failure_type,
            "recovery_plan": recovery_plan,
            "backup_systems": backup_systems,
            "last_drill": drill_date,
            "drill_recommended": drill_date is None or 
                                (datetime.now() - drill_date) > timedelta(days=30),
            "recovery_time_objective": None,
            "recovery_point_objective": None,
        }
        
        if recovery["drill_recommended"]:
            logger.info(f"Recovery drill recommended for: {failure_type}")
            self.metrics["recovery_drills"] += 1
        
        return recovery
    
    def defer_to_expert(
        self,
        decision_context: str,
        hierarchy_recommendation: str,
        expert_recommendation: str,
        expert_role: str
    ) -> Dict:
        """
        Allow expert to override hierarchy in crisis.
        
        HRO Principle: Deference to Expertise
        In a crisis, decision authority goes to the person with most expertise,
        regardless of rank.
        """
        override = {
            "context": decision_context,
            "hierarchy_said": hierarchy_recommendation,
            "expert_said": expert_recommendation,
            "expert_role": expert_role,
            "decision": expert_recommendation,  # Expert wins
            "justification": (
                f"Per HRO principle of Deference to Expertise, "
                f"deferring to {expert_role}'s recommendation over hierarchy."
            ),
        }
        
        if hierarchy_recommendation != expert_recommendation:
            self.metrics["expert_overrides"] += 1
            logger.info(
                f"Expert override: {expert_role} recommendation '{expert_recommendation}' "
                f"overrides hierarchy recommendation '{hierarchy_recommendation}'"
            )
        
        return override
    
    def get_hro_health_score(self) -> Dict:
        """Calculate HRO health score based on metrics."""
        
        # Positive indicators
        near_miss_reporting = min(1.0, self.metrics["near_misses_reported"] / 10)
        anomaly_investigation = min(1.0, self.metrics["anomalies_investigated"] / 5)
        expert_deference = min(1.0, self.metrics["expert_overrides"] / 3)
        
        # Combined score
        score = (near_miss_reporting + anomaly_investigation + expert_deference) / 3
        
        return {
            "overall_score": score,
            "near_miss_reporting": near_miss_reporting,
            "anomaly_investigation": anomaly_investigation,
            "expert_deference": expert_deference,
            "raw_metrics": self.metrics,
            "assessment": (
                "Strong HRO culture" if score > 0.7 else
                "Developing HRO culture" if score > 0.4 else
                "Needs HRO improvement"
            ),
        }


# =============================================================================
# APPEAL WORKFLOW (False Positive Recovery)
# =============================================================================

class AppealStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


@dataclass
class Appeal:
    """Appeal request for false positive."""
    appeal_id: str
    original_decision_id: str
    agent_id: str
    creator_id: str
    
    # Appeal details
    appeal_reason: str
    evidence: List[str]
    
    # Process
    status: AppealStatus = AppealStatus.PENDING
    reviewer_id: str = ""
    review_notes: str = ""
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    reviewed_at: datetime = None
    
    # Resolution
    reputation_restored: float = 0.0
    stake_refunded: float = 0.0
    trust_restored: float = 0.0


class AppealWorkflow:
    """
    Appeal workflow for false positive recovery.
    
    Addresses UCA3: Trust engine denies legitimate action (false positive).
    Provides path for creators/agents to contest incorrect decisions.
    """
    
    def __init__(self):
        self.appeals: Dict[str, Appeal] = {}
        self.appeal_history: List[Appeal] = []
    
    def file_appeal(
        self,
        original_decision_id: str,
        agent_id: str,
        creator_id: str,
        appeal_reason: str,
        evidence: List[str]
    ) -> Appeal:
        """File an appeal against a decision."""
        
        appeal_id = f"appeal_{hashlib.sha256(f'{original_decision_id}:{datetime.now()}'.encode()).hexdigest()[:10]}"
        
        appeal = Appeal(
            appeal_id=appeal_id,
            original_decision_id=original_decision_id,
            agent_id=agent_id,
            creator_id=creator_id,
            appeal_reason=appeal_reason,
            evidence=evidence
        )
        
        self.appeals[appeal_id] = appeal
        logger.info(f"Appeal filed: {appeal_id} for decision {original_decision_id}")
        
        return appeal
    
    def review_appeal(
        self,
        appeal_id: str,
        reviewer_id: str,
        approved: bool,
        notes: str,
        reputation_restore: float = 0.0,
        stake_refund: float = 0.0,
        trust_restore: float = 0.0
    ) -> Appeal:
        """Review and decide on an appeal."""
        
        appeal = self.appeals.get(appeal_id)
        if not appeal:
            raise ValueError(f"Appeal {appeal_id} not found")
        
        appeal.status = AppealStatus.APPROVED if approved else AppealStatus.REJECTED
        appeal.reviewer_id = reviewer_id
        appeal.review_notes = notes
        appeal.reviewed_at = datetime.now()
        
        if approved:
            appeal.reputation_restored = reputation_restore
            appeal.stake_refunded = stake_refund
            appeal.trust_restored = trust_restore
            logger.info(
                f"Appeal {appeal_id} APPROVED: "
                f"rep+{reputation_restore}, stake+${stake_refund}, trust+{trust_restore}"
            )
        else:
            logger.info(f"Appeal {appeal_id} REJECTED: {notes}")
        
        # Move to history
        del self.appeals[appeal_id]
        self.appeal_history.append(appeal)
        
        return appeal
    
    def get_pending_appeals(self) -> List[Appeal]:
        """Get all pending appeals."""
        return [a for a in self.appeals.values() if a.status == AppealStatus.PENDING]
    
    def get_appeal_stats(self) -> Dict:
        """Get appeal statistics."""
        if not self.appeal_history:
            return {"total": 0, "approved_rate": 0.0}
        
        approved = sum(1 for a in self.appeal_history if a.status == AppealStatus.APPROVED)
        
        return {
            "total": len(self.appeal_history),
            "approved": approved,
            "rejected": len(self.appeal_history) - approved,
            "approved_rate": approved / len(self.appeal_history),
            "pending": len(self.appeals),
        }


# =============================================================================
# TESTS
# =============================================================================

def run_stpa_hro_tests():
    """Test STPA and HRO components."""
    print("=" * 60)
    print("ATSF v3.3 STPA & HRO INTEGRATION TESTS")
    print("=" * 60)
    
    # Test STPA Analyzer
    print("\n[Test 1] STPA Control Structure")
    stpa = STPAAnalyzer()
    
    assert len(stpa.losses) == 4
    assert len(stpa.hazards) == 5
    assert len(stpa.controllers) == 6
    assert len(stpa.ucas) == 7
    assert len(stpa.scenarios) == 3
    print(f"  ✓ STPA initialized: {len(stpa.losses)} losses, {len(stpa.hazards)} hazards, "
          f"{len(stpa.ucas)} UCAs")
    
    # Test action analysis
    print("\n[Test 2] STPA Action Analysis")
    analysis = stpa.analyze_action({
        "has_tool_outputs": True,
        "risk_score": 0.7
    })
    assert "UCA2" in analysis["relevant_ucas"]
    assert "UCA4" in analysis["relevant_ucas"]
    print(f"  ✓ Relevant UCAs: {analysis['relevant_ucas']}")
    print(f"  ✓ Safety constraints: {analysis['safety_constraints'][:2]}...")
    
    # Test control structure diagram
    print("\n[Test 3] Control Structure Diagram")
    diagram = stpa.get_control_structure_diagram()
    assert "HUMAN OVERSIGHT" in diagram
    assert "TRUST ENGINE" in diagram
    print("  ✓ Control structure diagram generated")
    
    # Test HRO Monitor
    print("\n[Test 4] HRO Near-Miss Reporting")
    hro = HROMonitor()
    
    nm = hro.report_near_miss(
        description="Agent attempted to execute code without proper sandbox",
        what_prevented_loss="L43 sanitizer blocked the request",
        reported_by="trust_engine"
    )
    assert nm.principle == HROPrinciple.PREOCCUPATION_WITH_FAILURE
    assert hro.metrics["near_misses_reported"] == 1
    print(f"  ✓ Near-miss reported: {nm.event_id}")
    
    # Test anomaly investigation
    print("\n[Test 5] HRO Anomaly Investigation")
    inv = hro.investigate_anomaly(
        anomaly_description="Trust score spiked unexpectedly",
        initial_assessment="Probably just a glitch",
        deep_investigation="Actually caused by race condition in velocity limiter"
    )
    assert "warning" in inv  # Should flag oversimplified assessment
    print(f"  ✓ Anomaly investigated: {inv['warning'][:50]}...")
    
    # Test expert deference
    print("\n[Test 6] HRO Expert Deference")
    override = hro.defer_to_expert(
        decision_context="Agent quarantine decision",
        hierarchy_recommendation="Keep agent quarantined (policy says so)",
        expert_recommendation="Release with monitoring (false positive confirmed)",
        expert_role="Senior Security Engineer"
    )
    assert override["decision"] == "Release with monitoring (false positive confirmed)"
    assert hro.metrics["expert_overrides"] == 1
    print(f"  ✓ Expert override: {override['justification'][:50]}...")
    
    # Test HRO health score
    print("\n[Test 7] HRO Health Score")
    health = hro.get_hro_health_score()
    assert health["overall_score"] > 0
    print(f"  ✓ HRO health: {health['assessment']} (score={health['overall_score']:.2f})")
    
    # Test Appeal Workflow
    print("\n[Test 8] Appeal Workflow")
    appeals = AppealWorkflow()
    
    appeal = appeals.file_appeal(
        original_decision_id="dec_12345",
        agent_id="agent_001",
        creator_id="creator_001",
        appeal_reason="False positive - legitimate code execution request",
        evidence=["Log showing benign context", "User testimony"]
    )
    assert appeal.status == AppealStatus.PENDING
    print(f"  ✓ Appeal filed: {appeal.appeal_id}")
    
    # Review appeal
    result = appeals.review_appeal(
        appeal_id=appeal.appeal_id,
        reviewer_id="reviewer_001",
        approved=True,
        notes="Evidence confirms false positive",
        reputation_restore=0.02,
        stake_refund=50.0,
        trust_restore=0.05
    )
    assert result.status == AppealStatus.APPROVED
    assert result.reputation_restored == 0.02
    print(f"  ✓ Appeal approved: rep+{result.reputation_restored}, stake+${result.stake_refunded}")
    
    # Appeal stats
    stats = appeals.get_appeal_stats()
    assert stats["approved"] == 1
    print(f"  ✓ Appeal stats: {stats}")
    
    print("\n" + "=" * 60)
    print("ALL STPA & HRO TESTS PASSED ✓")
    print("=" * 60)


if __name__ == "__main__":
    run_stpa_hro_tests()
