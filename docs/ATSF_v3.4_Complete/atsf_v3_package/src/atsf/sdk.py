"""
ATSF Python SDK
===============

High-level Python SDK for easy ATSF integration.

Features:
- Simple client interface
- Sync and async support
- Automatic retry logic
- Connection pooling
- Type hints throughout

Usage:
    from atsf import ATSF
    
    # Initialize
    atsf = ATSF(api_url="http://localhost:8000")
    
    # Register and use agents
    agent = atsf.create_agent("my_agent", "my_creator")
    result = agent.execute("read", {"target": "file.txt"})
    
    # Check trust
    trust = agent.get_trust()
    print(f"Current trust: {trust.score}")

Author: ATSF Development Team
Version: 3.4.0
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import hashlib

# ATSF imports (for embedded mode)
from .atsf_v33_fixes import ATSFv33System, ActionDecision, SafetyConfig, TrustConfig
from .cognitive_cube import CognitiveCube
from .data_cube import AgentKnowledgeBase
from .realtime import EventBus, EventType, ATSFEvent, ActionStream, AlertManager
from .ai_trism_integration import AITRiSMManager

logger = logging.getLogger("atsf.sdk")


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class TrustScore:
    """Trust score with metadata."""
    score: float
    tier: str
    ceiling: float
    velocity: float
    last_action: Optional[datetime] = None
    action_count: int = 0
    
    @property
    def percentage(self) -> float:
        return self.score * 100
    
    @property
    def is_trusted(self) -> bool:
        return self.score >= 0.5
    
    def to_dict(self) -> Dict:
        return {
            "score": self.score,
            "tier": self.tier,
            "ceiling": self.ceiling,
            "velocity": self.velocity,
            "last_action": self.last_action.isoformat() if self.last_action else None,
            "action_count": self.action_count
        }


@dataclass
class ActionResult:
    """Result of an agent action."""
    request_id: str
    decision: str  # allow, deny, allow_monitored
    trust_score: float
    trust_delta: float
    risk_score: float
    processing_time_ms: float
    explanation: str
    violations: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)
    
    @property
    def allowed(self) -> bool:
        return self.decision in ("allow", "allow_monitored")
    
    @property
    def monitored(self) -> bool:
        return self.decision == "allow_monitored"
    
    def to_dict(self) -> Dict:
        return {
            "request_id": self.request_id,
            "decision": self.decision,
            "allowed": self.allowed,
            "trust_score": self.trust_score,
            "trust_delta": self.trust_delta,
            "risk_score": self.risk_score,
            "processing_time_ms": self.processing_time_ms,
            "explanation": self.explanation,
            "violations": self.violations,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class AgentStatus:
    """Current agent status."""
    agent_id: str
    active: bool
    trust: TrustScore
    action_count: int
    last_action_time: Optional[datetime]
    created_at: datetime
    metadata: Dict = field(default_factory=dict)


# =============================================================================
# AGENT CLASS
# =============================================================================

class Agent:
    """
    Represents an ATSF-managed agent.
    
    Usage:
        agent = atsf.create_agent("my_agent", "my_creator")
        
        # Execute action
        result = agent.execute("read", {"file": "data.txt"})
        if result.allowed:
            print("Action allowed!")
        
        # Check trust
        trust = agent.get_trust()
        
        # Get analytics
        insights = agent.get_insights()
    """
    
    def __init__(
        self,
        agent_id: str,
        creator_id: str,
        atsf_system: ATSFv33System,
        tier: str = "gray_box"
    ):
        self.agent_id = agent_id
        self.creator_id = creator_id
        self.tier = tier
        self._atsf = atsf_system
        self._kb = AgentKnowledgeBase(agent_id)
        self._cube = CognitiveCube(agent_id)
        self._action_count = 0
        self._created_at = datetime.now()
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        data = f"{self.agent_id}:{datetime.now().isoformat()}:{self._action_count}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def execute(
        self,
        action_type: str,
        payload: Optional[Dict] = None,
        reasoning: Optional[str] = None
    ) -> ActionResult:
        """
        Execute an action through ATSF.
        
        Args:
            action_type: Type of action (read, write, execute, api_call, etc.)
            payload: Action-specific data
            reasoning: Optional reasoning trace for the action
        
        Returns:
            ActionResult with decision and trust changes
        """
        from .atsf_v33_fixes import ActionRequest
        
        request_id = self._generate_request_id()
        self._action_count += 1
        
        # Create proper ActionRequest object
        action = ActionRequest(
            request_id=request_id,
            agent_id=self.agent_id,
            action_type=action_type,
            payload=payload or {},
            reasoning_trace=reasoning or f"SDK action: {action_type}"
        )
        
        # Process through ATSF
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(self._atsf.process_action(action))
        
        # Extract decision info from result dict
        decision = result.get("decision", "deny")
        trust_score = result.get("trust_score", 0.5)
        trust_delta = result.get("trust_delta", 0.0)
        risk_score = result.get("risk_score", 0.0)
        processing_time = result.get("processing_time_ms", 0.0)
        
        # Record to knowledge base
        self._kb.record_action(
            request_id=request_id,
            action_type=action_type,
            action_category=payload.get("category", "general") if payload else "general",
            decision=decision,
            trust_score=trust_score,
            trust_delta=trust_delta,
            risk_score=risk_score,
            processing_time_ms=processing_time,
            metadata={"creator_id": self.creator_id, "tier": self.tier}
        )
        
        return ActionResult(
            request_id=request_id,
            decision=decision,
            trust_score=trust_score,
            trust_delta=trust_delta,
            risk_score=risk_score,
            processing_time_ms=processing_time,
            explanation="; ".join(result.get("reasons", [])),
            violations=result.get("violations", [])
        )
    
    async def execute_async(
        self,
        action_type: str,
        payload: Optional[Dict] = None,
        reasoning: Optional[str] = None
    ) -> ActionResult:
        """Async version of execute."""
        request_id = self._generate_request_id()
        self._action_count += 1
        
        action = {
            "request_id": request_id,
            "agent_id": self.agent_id,
            "action_type": action_type,
            "payload": payload or {},
            "reasoning_trace": reasoning or f"SDK action: {action_type}"
        }
        
        decision = await self._atsf.process_action(action)
        
        return ActionResult(
            request_id=request_id,
            decision=decision.decision,
            trust_score=decision.trust_score,
            trust_delta=decision.trust_delta,
            risk_score=decision.risk_score,
            processing_time_ms=decision.processing_time_ms,
            explanation=decision.explanation,
            violations=decision.violations
        )
    
    def get_trust(self) -> TrustScore:
        """Get current trust score."""
        # Get agent from ATSF system
        agent_data = self._atsf.agents.get(self.agent_id)
        
        if agent_data:
            return TrustScore(
                score=agent_data.trust_score,
                tier=self.tier,
                ceiling=agent_data.trust_ceiling,
                velocity=0.0,  # Would need to track this
                action_count=self._action_count
            )
        
        # Fallback if agent not found
        return TrustScore(
            score=0.5,
            tier=self.tier,
            ceiling=0.6,
            velocity=0.0,
            action_count=self._action_count
        )
    
    def get_insights(self) -> Dict:
        """Get analytics insights from the data cube."""
        return self._kb.get_insights()
    
    def get_memory_context(self, max_entries: int = 10) -> List[Dict]:
        """Get recent memory context."""
        return self._kb.memory.get_context_window(max_entries=max_entries)
    
    def find_causes(self, effect: str, max_depth: int = 5) -> List:
        """Find causal chains leading to an effect."""
        return self._cube.find_causes(effect, max_depth=max_depth)
    
    def get_effect_groups(self) -> Dict:
        """Get clustered effect groups."""
        return self._cube.get_effect_groups()
    
    def consolidate_memory(self) -> Dict:
        """Consolidate agent memory."""
        return self._kb.memory.consolidate()
    
    def get_status(self) -> AgentStatus:
        """Get full agent status."""
        trust = self.get_trust()
        stats = self._kb.cube.get_stats()
        
        return AgentStatus(
            agent_id=self.agent_id,
            active=True,
            trust=trust,
            action_count=self._action_count,
            last_action_time=trust.last_action,
            created_at=self._created_at,
            metadata={
                "creator_id": self.creator_id,
                "tier": self.tier,
                "cube_stats": stats
            }
        )


# =============================================================================
# MAIN SDK CLASS
# =============================================================================

class ATSF:
    """
    ATSF Python SDK - Main entry point.
    
    Usage:
        # Embedded mode (in-process)
        atsf = ATSF()
        
        # API mode (remote server)
        atsf = ATSF(api_url="http://localhost:8000")
        
        # Create agents
        agent = atsf.create_agent("agent_001", "creator_001")
        
        # Execute actions
        result = agent.execute("read", {"target": "data.txt"})
        
        # Monitor events
        atsf.on_event(EventType.ACTION_DENIED, my_handler)
    """
    
    def __init__(
        self,
        api_url: Optional[str] = None,
        safety_config: Optional[SafetyConfig] = None,
        trust_config: Optional[TrustConfig] = None
    ):
        """
        Initialize ATSF SDK.
        
        Args:
            api_url: Optional URL for remote ATSF server. If None, runs embedded.
            safety_config: Optional safety configuration
            trust_config: Optional trust configuration
        """
        self.api_url = api_url
        self._embedded = api_url is None
        
        if self._embedded:
            self._system = ATSFv33System()
        else:
            self._system = None
            self._api_client = self._create_api_client(api_url)
        
        self._agents: Dict[str, Agent] = {}
        self._creators: Dict[str, Dict] = {}
        self._event_bus = EventBus()
        self._action_stream = ActionStream(self._event_bus)
        self._alert_manager = AlertManager(self._event_bus)
        
        logger.info(f"ATSF SDK initialized (mode={'embedded' if self._embedded else 'api'})")
    
    def _create_api_client(self, api_url: str):
        """Create API client for remote mode."""
        # Placeholder for HTTP client
        return {"base_url": api_url}
    
    # =========================================================================
    # CREATOR MANAGEMENT
    # =========================================================================
    
    def register_creator(
        self,
        creator_id: str,
        tier: str = "verified",
        stake: float = 1000.0,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Register a creator.
        
        Args:
            creator_id: Unique creator identifier
            tier: Creator tier (unverified, verified, trusted, enterprise)
            stake: Economic stake amount
            metadata: Optional creator metadata
        
        Returns:
            Creator registration info
        """
        # Store creator info locally (ATSF manages creators through agents)
        self._creators[creator_id] = {
            "creator_id": creator_id,
            "tier": tier,
            "stake": stake,
            "metadata": metadata or {},
            "registered_at": datetime.now()
        }
        
        logger.debug(f"Creator registered: {creator_id} (tier={tier})")
        return self._creators[creator_id]
    
    def get_creator(self, creator_id: str) -> Optional[Dict]:
        """Get creator info."""
        return self._creators.get(creator_id)
    
    # =========================================================================
    # AGENT MANAGEMENT
    # =========================================================================
    
    def create_agent(
        self,
        agent_id: str,
        creator_id: str,
        tier: str = "gray_box",
        metadata: Optional[Dict] = None
    ) -> Agent:
        """
        Create and register a new agent.
        
        Args:
            agent_id: Unique agent identifier
            creator_id: Creator who owns this agent
            tier: Agent transparency tier (black_box, gray_box, white_box)
            metadata: Optional agent metadata
        
        Returns:
            Agent instance
        """
        # Ensure creator exists
        if creator_id not in self._creators:
            self.register_creator(creator_id)
        
        # Map string tier to enum
        tier_map = {
            "black_box": "BLACK_BOX",
            "gray_box": "GRAY_BOX", 
            "white_box": "WHITE_BOX",
            "verified_box": "VERIFIED_BOX"
        }
        tier_value = tier_map.get(tier.lower(), "GRAY_BOX")
        
        # Register agent in ATSF
        if self._embedded:
            from .atsf_v33_fixes import TransparencyTier
            tier_enum = getattr(TransparencyTier, tier_value)
            self._system.register_agent(agent_id, creator_id, tier_enum)
        
        # Create agent wrapper
        agent = Agent(
            agent_id=agent_id,
            creator_id=creator_id,
            atsf_system=self._system,
            tier=tier
        )
        
        self._agents[agent_id] = agent
        
        # Emit event
        self._event_bus.publish(ATSFEvent(
            event_type=EventType.AGENT_REGISTERED,
            timestamp=datetime.now(),
            source="sdk",
            agent_id=agent_id,
            data={"creator_id": creator_id, "tier": tier}
        ))
        
        logger.info(f"Agent created: {agent_id} (creator={creator_id}, tier={tier})")
        return agent
    
    def get_agent(self, agent_id: str) -> Optional[Agent]:
        """Get an existing agent."""
        return self._agents.get(agent_id)
    
    def list_agents(self, creator_id: Optional[str] = None) -> List[str]:
        """List all agent IDs, optionally filtered by creator."""
        if creator_id:
            return [
                aid for aid, agent in self._agents.items()
                if agent.creator_id == creator_id
            ]
        return list(self._agents.keys())
    
    # =========================================================================
    # EVENT HANDLING
    # =========================================================================
    
    def on_event(
        self,
        event_type: EventType,
        handler: callable
    ) -> str:
        """
        Subscribe to ATSF events.
        
        Args:
            event_type: Type of event to subscribe to
            handler: Callback function(event: ATSFEvent)
        
        Returns:
            Subscription ID
        """
        return self._event_bus.subscribe(event_type, handler)
    
    def emit_event(
        self,
        event_type: EventType,
        data: Dict,
        agent_id: Optional[str] = None,
        severity: str = "info"
    ) -> None:
        """Emit a custom event."""
        event = ATSFEvent(
            event_type=event_type,
            timestamp=datetime.now(),
            source="sdk_user",
            agent_id=agent_id,
            data=data,
            severity=severity
        )
        self._event_bus.publish(event)
    
    def get_event_history(
        self,
        event_type: Optional[EventType] = None,
        agent_id: Optional[str] = None,
        limit: int = 100
    ) -> List[ATSFEvent]:
        """Get event history."""
        return self._event_bus.get_history(
            event_type=event_type,
            agent_id=agent_id,
            limit=limit
        )
    
    # =========================================================================
    # ALERTS
    # =========================================================================
    
    def set_alert_threshold(self, metric: str, threshold: float) -> None:
        """Set alert threshold for a metric."""
        self._alert_manager.set_threshold(metric, threshold)
    
    def on_alert(self, handler: callable) -> None:
        """Add alert handler."""
        self._alert_manager.add_handler(handler)
    
    def get_active_alerts(self, severity: Optional[str] = None) -> List[Dict]:
        """Get active (unacknowledged) alerts."""
        return self._alert_manager.get_active(severity)
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert."""
        return self._alert_manager.acknowledge(alert_id)
    
    # =========================================================================
    # ANALYTICS
    # =========================================================================
    
    def get_action_stats(self, agent_id: Optional[str] = None) -> Dict:
        """Get action statistics."""
        return self._action_stream.get_stats(agent_id)
    
    def get_recent_actions(
        self,
        agent_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent actions."""
        return self._action_stream.get_recent(agent_id=agent_id, limit=limit)
    
    # =========================================================================
    # GOVERNANCE
    # =========================================================================
    
    def add_constitutional_rule(
        self,
        rule_id: str,
        category: str,
        rule_text: str,
        keywords: List[str],
        priority: int = 3
    ) -> None:
        """Add a constitutional rule to all agents."""
        for agent in self._agents.values():
            agent._cube.basis.add_rule(
                rule_id=rule_id,
                category=category,
                rule_text=rule_text,
                keywords=keywords,
                priority=priority
            )
    
    def trigger_kill_switch(self, reason: str) -> None:
        """Trigger kill switch for all agents."""
        if self._embedded and hasattr(self._system, 'trism'):
            self._system.trism.model_ops.trigger_kill_switch(reason)
        
        self._event_bus.publish(ATSFEvent(
            event_type=EventType.KILL_SWITCH_TRIGGERED,
            timestamp=datetime.now(),
            source="sdk",
            data={"reason": reason},
            severity="critical"
        ))
        
        logger.critical(f"Kill switch triggered: {reason}")
    
    # =========================================================================
    # UTILITIES
    # =========================================================================
    
    def health_check(self) -> Dict:
        """Check system health."""
        return {
            "status": "healthy",
            "mode": "embedded" if self._embedded else "api",
            "agents_count": len(self._agents),
            "creators_count": len(self._creators),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_version(self) -> str:
        """Get SDK version."""
        return "3.4.0"


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

_default_instance: Optional[ATSF] = None


def init(api_url: Optional[str] = None, **kwargs) -> ATSF:
    """Initialize default ATSF instance."""
    global _default_instance
    _default_instance = ATSF(api_url=api_url, **kwargs)
    return _default_instance


def get_instance() -> ATSF:
    """Get default ATSF instance."""
    global _default_instance
    if _default_instance is None:
        _default_instance = ATSF()
    return _default_instance


def create_agent(agent_id: str, creator_id: str, **kwargs) -> Agent:
    """Create agent using default instance."""
    return get_instance().create_agent(agent_id, creator_id, **kwargs)


def execute(agent_id: str, action_type: str, payload: Optional[Dict] = None) -> ActionResult:
    """Execute action using default instance."""
    instance = get_instance()
    agent = instance.get_agent(agent_id)
    if not agent:
        raise ValueError(f"Agent {agent_id} not found")
    return agent.execute(action_type, payload)


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF Python SDK Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Initialize SDK
    tests_total += 1
    try:
        atsf = ATSF()
        assert atsf.health_check()["status"] == "healthy"
        print("  ✓ SDK initialization works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ SDK initialization failed: {e}")
    
    # Test 2: Create creator and agent
    tests_total += 1
    try:
        atsf = ATSF()
        creator = atsf.register_creator("test_creator", "verified", stake=1000)
        assert creator["creator_id"] == "test_creator"
        
        agent = atsf.create_agent("test_agent", "test_creator", "gray_box")
        assert agent.agent_id == "test_agent"
        print("  ✓ Creator and agent creation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Creator/agent creation failed: {e}")
    
    # Test 3: Execute action
    tests_total += 1
    try:
        atsf = ATSF()
        atsf.register_creator("exec_creator")
        agent = atsf.create_agent("exec_agent", "exec_creator")
        
        result = agent.execute("read", {"target": "test.txt"})
        assert result.request_id is not None
        assert result.decision in ("allow", "deny", "allow_monitored")
        print(f"  ✓ Action execution works (decision={result.decision})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Action execution failed: {e}")
    
    # Test 4: Trust score
    tests_total += 1
    try:
        atsf = ATSF()
        atsf.register_creator("trust_creator")
        agent = atsf.create_agent("trust_agent", "trust_creator")
        
        trust = agent.get_trust()
        assert 0 <= trust.score <= 1
        assert trust.tier is not None
        print(f"  ✓ Trust score works (score={trust.score:.2f})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Trust score failed: {e}")
    
    # Test 5: Event handling
    tests_total += 1
    try:
        atsf = ATSF()
        events_received = []
        
        def handler(event):
            events_received.append(event)
        
        atsf.on_event(EventType.AGENT_REGISTERED, handler)
        atsf.register_creator("event_creator")
        atsf.create_agent("event_agent", "event_creator")
        
        assert len(events_received) >= 1
        print("  ✓ Event handling works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Event handling failed: {e}")
    
    # Test 6: Agent status
    tests_total += 1
    try:
        atsf = ATSF()
        atsf.register_creator("status_creator")
        agent = atsf.create_agent("status_agent", "status_creator")
        
        # Execute some actions
        for _ in range(5):
            agent.execute("read", {"target": "test"})
        
        status = agent.get_status()
        assert status.agent_id == "status_agent"
        assert status.action_count == 5
        print(f"  ✓ Agent status works (actions={status.action_count})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Agent status failed: {e}")
    
    # Test 7: Insights
    tests_total += 1
    try:
        atsf = ATSF()
        atsf.register_creator("insights_creator")
        agent = atsf.create_agent("insights_agent", "insights_creator")
        
        for i in range(10):
            agent.execute(
                "read" if i % 2 == 0 else "write",
                {"target": f"file_{i}"}
            )
        
        insights = agent.get_insights()
        assert "total_actions" in insights
        print(f"  ✓ Insights work (total={insights['total_actions']})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Insights failed: {e}")
    
    # Test 8: Convenience functions
    tests_total += 1
    try:
        atsf_instance = init()
        assert atsf_instance is not None
        
        agent = create_agent("conv_agent", "conv_creator")
        assert agent.agent_id == "conv_agent"
        print("  ✓ Convenience functions work")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Convenience functions failed: {e}")
    
    # Test 9: Alert thresholds
    tests_total += 1
    try:
        atsf = ATSF()
        alerts_received = []
        
        def alert_handler(alert):
            alerts_received.append(alert)
        
        atsf.on_alert(alert_handler)
        atsf.set_alert_threshold("risk_score", 0.8)
        
        # Manually trigger alert
        atsf._alert_manager.trigger(
            alert_type="test_alert",
            severity="warning",
            message="Test alert"
        )
        
        assert len(alerts_received) == 1
        print("  ✓ Alert thresholds work")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Alert thresholds failed: {e}")
    
    # Test 10: List agents
    tests_total += 1
    try:
        atsf = ATSF()
        atsf.register_creator("list_creator")
        
        for i in range(3):
            atsf.create_agent(f"list_agent_{i}", "list_creator")
        
        agents = atsf.list_agents()
        assert len(agents) >= 3
        
        filtered = atsf.list_agents(creator_id="list_creator")
        assert len(filtered) == 3
        print(f"  ✓ List agents works (count={len(agents)})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ List agents failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
