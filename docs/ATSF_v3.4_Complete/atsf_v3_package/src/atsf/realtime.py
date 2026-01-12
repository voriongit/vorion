"""
ATSF WebSocket & Event System
=============================

Real-time streaming and pub/sub event system for ATSF.

Features:
- WebSocket server for real-time trust updates
- Event pub/sub for decoupled components
- Action stream for monitoring dashboards
- Alert broadcasting for security events

Usage:
    # Start WebSocket server
    from atsf.realtime import ATSFWebSocketServer
    server = ATSFWebSocketServer(port=8765)
    await server.start()
    
    # Subscribe to events
    from atsf.realtime import EventBus
    bus = EventBus()
    bus.subscribe("trust_change", my_handler)

Author: ATSF Development Team
Version: 3.4.0
"""

import asyncio
import json
import logging
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import weakref

logger = logging.getLogger("atsf.realtime")


# =============================================================================
# EVENT TYPES
# =============================================================================

class EventType(str, Enum):
    """ATSF event types for pub/sub system."""
    # Trust events
    TRUST_CHANGE = "trust_change"
    TRUST_THRESHOLD_BREACH = "trust_threshold_breach"
    TRUST_RECOVERY = "trust_recovery"
    
    # Action events
    ACTION_REQUESTED = "action_requested"
    ACTION_ALLOWED = "action_allowed"
    ACTION_DENIED = "action_denied"
    ACTION_MONITORED = "action_monitored"
    
    # Security events
    SECURITY_ALERT = "security_alert"
    INJECTION_DETECTED = "injection_detected"
    DRIFT_DETECTED = "drift_detected"
    ANOMALY_DETECTED = "anomaly_detected"
    
    # System events
    AGENT_REGISTERED = "agent_registered"
    AGENT_DEACTIVATED = "agent_deactivated"
    KILL_SWITCH_TRIGGERED = "kill_switch_triggered"
    SYSTEM_HEALTH = "system_health"
    
    # Cognitive events
    MEMORY_CONSOLIDATED = "memory_consolidated"
    CAUSAL_CHAIN_DISCOVERED = "causal_chain_discovered"
    CLUSTER_FORMED = "cluster_formed"
    CONSTITUTIONAL_VIOLATION = "constitutional_violation"


@dataclass
class ATSFEvent:
    """Base event structure for ATSF pub/sub."""
    event_type: EventType
    timestamp: datetime
    source: str  # Component that generated the event
    agent_id: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)
    severity: str = "info"  # info, warning, error, critical
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type.value if isinstance(self.event_type, EventType) else self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "agent_id": self.agent_id,
            "data": self.data,
            "severity": self.severity,
            "correlation_id": self.correlation_id
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ATSFEvent":
        return cls(
            event_type=EventType(data["event_type"]) if data["event_type"] in [e.value for e in EventType] else data["event_type"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            source=data["source"],
            agent_id=data.get("agent_id"),
            data=data.get("data", {}),
            severity=data.get("severity", "info"),
            correlation_id=data.get("correlation_id")
        )


# =============================================================================
# EVENT BUS (PUB/SUB)
# =============================================================================

class EventBus:
    """
    In-process pub/sub event bus for ATSF components.
    
    Usage:
        bus = EventBus()
        
        # Subscribe to events
        def on_trust_change(event: ATSFEvent):
            print(f"Trust changed: {event.data}")
        
        bus.subscribe(EventType.TRUST_CHANGE, on_trust_change)
        
        # Publish events
        bus.publish(ATSFEvent(
            event_type=EventType.TRUST_CHANGE,
            timestamp=datetime.now(),
            source="trust_engine",
            data={"old": 0.5, "new": 0.6}
        ))
    """
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern for global event bus."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._subscribers: Dict[str, List[Callable]] = defaultdict(list)
        self._async_subscribers: Dict[str, List[Callable]] = defaultdict(list)
        self._event_history: List[ATSFEvent] = []
        self._max_history = 1000
        self._filters: Dict[str, Callable] = {}
        self._initialized = True
        
        logger.info("EventBus initialized")
    
    def subscribe(
        self,
        event_type: EventType,
        handler: Callable[[ATSFEvent], None],
        filter_fn: Optional[Callable[[ATSFEvent], bool]] = None
    ) -> str:
        """
        Subscribe to an event type.
        
        Returns subscription ID for unsubscribing.
        """
        sub_id = hashlib.sha256(
            f"{event_type}:{id(handler)}:{datetime.now().isoformat()}".encode()
        ).hexdigest()[:12]
        
        self._subscribers[event_type.value if isinstance(event_type, EventType) else event_type].append(handler)
        
        if filter_fn:
            self._filters[sub_id] = filter_fn
        
        logger.debug(f"Subscribed to {event_type}: {sub_id}")
        return sub_id
    
    def subscribe_async(
        self,
        event_type: EventType,
        handler: Callable[[ATSFEvent], Any]
    ) -> str:
        """Subscribe with async handler."""
        sub_id = hashlib.sha256(
            f"{event_type}:async:{id(handler)}:{datetime.now().isoformat()}".encode()
        ).hexdigest()[:12]
        
        self._async_subscribers[event_type.value if isinstance(event_type, EventType) else event_type].append(handler)
        
        logger.debug(f"Async subscribed to {event_type}: {sub_id}")
        return sub_id
    
    def unsubscribe(self, event_type: EventType, handler: Callable) -> bool:
        """Unsubscribe a handler."""
        key = event_type.value if isinstance(event_type, EventType) else event_type
        
        if handler in self._subscribers[key]:
            self._subscribers[key].remove(handler)
            return True
        if handler in self._async_subscribers[key]:
            self._async_subscribers[key].remove(handler)
            return True
        return False
    
    def publish(self, event: ATSFEvent) -> int:
        """
        Publish an event to all subscribers.
        
        Returns number of handlers notified.
        """
        key = event.event_type.value if isinstance(event.event_type, EventType) else event.event_type
        notified = 0
        
        # Store in history
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history.pop(0)
        
        # Notify sync subscribers
        for handler in self._subscribers.get(key, []):
            try:
                handler(event)
                notified += 1
            except Exception as e:
                logger.error(f"Handler error: {e}")
        
        # Also notify wildcard subscribers
        for handler in self._subscribers.get("*", []):
            try:
                handler(event)
                notified += 1
            except Exception as e:
                logger.error(f"Wildcard handler error: {e}")
        
        return notified
    
    async def publish_async(self, event: ATSFEvent) -> int:
        """Publish event and await async handlers."""
        key = event.event_type.value if isinstance(event.event_type, EventType) else event.event_type
        notified = self.publish(event)  # Notify sync handlers
        
        # Notify async subscribers
        tasks = []
        for handler in self._async_subscribers.get(key, []):
            tasks.append(asyncio.create_task(handler(event)))
        
        for handler in self._async_subscribers.get("*", []):
            tasks.append(asyncio.create_task(handler(event)))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            notified += len(tasks)
        
        return notified
    
    def get_history(
        self,
        event_type: Optional[EventType] = None,
        agent_id: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[ATSFEvent]:
        """Get event history with filters."""
        events = self._event_history
        
        if event_type:
            key = event_type.value if isinstance(event_type, EventType) else event_type
            events = [e for e in events if (e.event_type.value if isinstance(e.event_type, EventType) else e.event_type) == key]
        
        if agent_id:
            events = [e for e in events if e.agent_id == agent_id]
        
        if since:
            events = [e for e in events if e.timestamp >= since]
        
        return events[-limit:]
    
    def clear_history(self) -> int:
        """Clear event history."""
        count = len(self._event_history)
        self._event_history.clear()
        return count


# =============================================================================
# WEBSOCKET SERVER
# =============================================================================

class ATSFWebSocketServer:
    """
    WebSocket server for real-time ATSF event streaming.
    
    Usage:
        server = ATSFWebSocketServer(host="0.0.0.0", port=8765)
        await server.start()
        
        # Clients connect and receive events in real-time
        # ws://localhost:8765
    """
    
    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8765,
        event_bus: Optional[EventBus] = None
    ):
        self.host = host
        self.port = port
        self.bus = event_bus or EventBus()
        
        self._clients: Set = set()
        self._subscriptions: Dict[Any, Set[str]] = defaultdict(set)
        self._server = None
        self._running = False
        
        # Subscribe to all events for broadcasting
        self.bus.subscribe_async("*", self._broadcast_event)
        
        logger.info(f"WebSocket server configured on {host}:{port}")
    
    async def _broadcast_event(self, event: ATSFEvent) -> None:
        """Broadcast event to all connected clients."""
        if not self._clients:
            return
        
        message = event.to_json()
        
        # Send to clients subscribed to this event type
        disconnected = set()
        for client in self._clients:
            try:
                # Check if client is subscribed to this event type
                event_key = event.event_type.value if isinstance(event.event_type, EventType) else event.event_type
                client_subs = self._subscriptions.get(client, set())
                
                if "*" in client_subs or event_key in client_subs:
                    await client.send(message)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                disconnected.add(client)
        
        # Clean up disconnected clients
        self._clients -= disconnected
        for client in disconnected:
            self._subscriptions.pop(client, None)
    
    async def _handle_client(self, websocket, path: str = "/") -> None:
        """Handle WebSocket client connection."""
        self._clients.add(websocket)
        self._subscriptions[websocket] = {"*"}  # Subscribe to all by default
        
        client_id = id(websocket)
        logger.info(f"Client connected: {client_id}")
        
        try:
            # Send welcome message
            welcome = {
                "type": "welcome",
                "message": "Connected to ATSF Real-time Stream",
                "available_events": [e.value for e in EventType]
            }
            await websocket.send(json.dumps(welcome))
            
            # Handle incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(websocket, data)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON"
                    }))
        except Exception as e:
            logger.error(f"Client error: {e}")
        finally:
            self._clients.discard(websocket)
            self._subscriptions.pop(websocket, None)
            logger.info(f"Client disconnected: {client_id}")
    
    async def _handle_message(self, websocket, data: Dict) -> None:
        """Handle incoming WebSocket message."""
        msg_type = data.get("type", "")
        
        if msg_type == "subscribe":
            # Subscribe to specific event types
            events = data.get("events", [])
            self._subscriptions[websocket] = set(events)
            await websocket.send(json.dumps({
                "type": "subscribed",
                "events": events
            }))
        
        elif msg_type == "unsubscribe":
            events = data.get("events", [])
            self._subscriptions[websocket] -= set(events)
            await websocket.send(json.dumps({
                "type": "unsubscribed",
                "events": events
            }))
        
        elif msg_type == "history":
            # Get event history
            event_type = data.get("event_type")
            agent_id = data.get("agent_id")
            limit = data.get("limit", 50)
            
            history = self.bus.get_history(
                event_type=EventType(event_type) if event_type else None,
                agent_id=agent_id,
                limit=limit
            )
            
            await websocket.send(json.dumps({
                "type": "history",
                "events": [e.to_dict() for e in history]
            }))
        
        elif msg_type == "ping":
            await websocket.send(json.dumps({"type": "pong"}))
        
        else:
            await websocket.send(json.dumps({
                "type": "error",
                "message": f"Unknown message type: {msg_type}"
            }))
    
    async def start(self) -> None:
        """Start the WebSocket server."""
        try:
            import websockets
            
            self._server = await websockets.serve(
                self._handle_client,
                self.host,
                self.port
            )
            self._running = True
            
            logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
            
            await self._server.wait_closed()
        except ImportError:
            logger.warning("websockets not installed. Install with: pip install websockets")
            # Fallback: just run event bus without WebSocket
            self._running = True
    
    async def stop(self) -> None:
        """Stop the WebSocket server."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        self._running = False
        logger.info("WebSocket server stopped")
    
    def is_running(self) -> bool:
        return self._running
    
    @property
    def client_count(self) -> int:
        return len(self._clients)


# =============================================================================
# ACTION STREAM
# =============================================================================

class ActionStream:
    """
    Stream of ATSF actions for real-time monitoring.
    
    Captures all agent actions and emits them as events.
    
    Usage:
        stream = ActionStream()
        
        # Record actions
        stream.record(agent_id, action_type, decision, trust_score)
        
        # Get recent actions
        recent = stream.get_recent(limit=100)
    """
    
    def __init__(self, event_bus: Optional[EventBus] = None):
        self.bus = event_bus or EventBus()
        self._actions: List[Dict] = []
        self._max_actions = 10000
    
    def record(
        self,
        agent_id: str,
        action_type: str,
        decision: str,
        trust_score: float,
        risk_score: float = 0.0,
        processing_time_ms: float = 0.0,
        metadata: Optional[Dict] = None
    ) -> None:
        """Record an action and emit event."""
        action = {
            "timestamp": datetime.now().isoformat(),
            "agent_id": agent_id,
            "action_type": action_type,
            "decision": decision,
            "trust_score": trust_score,
            "risk_score": risk_score,
            "processing_time_ms": processing_time_ms,
            "metadata": metadata or {}
        }
        
        self._actions.append(action)
        if len(self._actions) > self._max_actions:
            self._actions.pop(0)
        
        # Determine event type based on decision
        if decision == "allow":
            event_type = EventType.ACTION_ALLOWED
        elif decision == "deny":
            event_type = EventType.ACTION_DENIED
        else:
            event_type = EventType.ACTION_MONITORED
        
        # Emit event
        event = ATSFEvent(
            event_type=event_type,
            timestamp=datetime.now(),
            source="action_stream",
            agent_id=agent_id,
            data=action,
            severity="warning" if decision == "deny" else "info"
        )
        self.bus.publish(event)
    
    def get_recent(
        self,
        agent_id: Optional[str] = None,
        action_type: Optional[str] = None,
        decision: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent actions with filters."""
        actions = self._actions
        
        if agent_id:
            actions = [a for a in actions if a["agent_id"] == agent_id]
        if action_type:
            actions = [a for a in actions if a["action_type"] == action_type]
        if decision:
            actions = [a for a in actions if a["decision"] == decision]
        
        return actions[-limit:]
    
    def get_stats(self, agent_id: Optional[str] = None) -> Dict:
        """Get action statistics."""
        actions = self._actions
        if agent_id:
            actions = [a for a in actions if a["agent_id"] == agent_id]
        
        if not actions:
            return {"total": 0}
        
        decisions = defaultdict(int)
        for a in actions:
            decisions[a["decision"]] += 1
        
        return {
            "total": len(actions),
            "allowed": decisions["allow"],
            "denied": decisions["deny"],
            "monitored": decisions.get("allow_monitored", 0),
            "avg_trust": sum(a["trust_score"] for a in actions) / len(actions),
            "avg_processing_ms": sum(a["processing_time_ms"] for a in actions) / len(actions)
        }


# =============================================================================
# ALERT SYSTEM
# =============================================================================

class AlertManager:
    """
    Alert management for ATSF security events.
    
    Usage:
        alerts = AlertManager()
        
        # Configure alert thresholds
        alerts.set_threshold("trust_drop", 0.1)
        
        # Trigger alert
        alerts.trigger(
            alert_type="security_breach",
            severity="critical",
            message="Injection attack detected"
        )
    """
    
    def __init__(self, event_bus: Optional[EventBus] = None):
        self.bus = event_bus or EventBus()
        self._thresholds: Dict[str, float] = {}
        self._alerts: List[Dict] = []
        self._handlers: List[Callable] = []
    
    def set_threshold(self, metric: str, threshold: float) -> None:
        """Set alert threshold for a metric."""
        self._thresholds[metric] = threshold
    
    def add_handler(self, handler: Callable[[Dict], None]) -> None:
        """Add alert handler (e.g., email, Slack, PagerDuty)."""
        self._handlers.append(handler)
    
    def trigger(
        self,
        alert_type: str,
        severity: str,
        message: str,
        agent_id: Optional[str] = None,
        data: Optional[Dict] = None
    ) -> Dict:
        """Trigger an alert."""
        alert = {
            "id": hashlib.sha256(f"{alert_type}:{datetime.now().isoformat()}".encode()).hexdigest()[:12],
            "timestamp": datetime.now().isoformat(),
            "type": alert_type,
            "severity": severity,
            "message": message,
            "agent_id": agent_id,
            "data": data or {},
            "acknowledged": False
        }
        
        self._alerts.append(alert)
        
        # Emit event
        event = ATSFEvent(
            event_type=EventType.SECURITY_ALERT,
            timestamp=datetime.now(),
            source="alert_manager",
            agent_id=agent_id,
            data=alert,
            severity=severity
        )
        self.bus.publish(event)
        
        # Call handlers
        for handler in self._handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"Alert handler error: {e}")
        
        logger.warning(f"Alert triggered: [{severity.upper()}] {message}")
        return alert
    
    def check_metric(
        self,
        metric: str,
        value: float,
        agent_id: Optional[str] = None
    ) -> Optional[Dict]:
        """Check if metric exceeds threshold and trigger alert if so."""
        threshold = self._thresholds.get(metric)
        if threshold is None:
            return None
        
        if value > threshold:
            return self.trigger(
                alert_type=f"{metric}_exceeded",
                severity="warning",
                message=f"Metric {metric} ({value:.3f}) exceeded threshold ({threshold:.3f})",
                agent_id=agent_id,
                data={"metric": metric, "value": value, "threshold": threshold}
            )
        return None
    
    def acknowledge(self, alert_id: str) -> bool:
        """Acknowledge an alert."""
        for alert in self._alerts:
            if alert["id"] == alert_id:
                alert["acknowledged"] = True
                return True
        return False
    
    def get_active(self, severity: Optional[str] = None) -> List[Dict]:
        """Get active (unacknowledged) alerts."""
        alerts = [a for a in self._alerts if not a["acknowledged"]]
        if severity:
            alerts = [a for a in alerts if a["severity"] == severity]
        return alerts


# =============================================================================
# ATSF EVENT EMITTER MIXIN
# =============================================================================

class ATSFEventEmitter:
    """
    Mixin class to add event emission to ATSF components.
    
    Usage:
        class MyComponent(ATSFEventEmitter):
            def do_something(self):
                self.emit_event(EventType.ACTION_ALLOWED, {"action": "test"})
    """
    
    def __init__(self):
        self._event_bus = EventBus()
    
    def emit_event(
        self,
        event_type: EventType,
        data: Dict[str, Any],
        agent_id: Optional[str] = None,
        severity: str = "info"
    ) -> None:
        """Emit an event to the bus."""
        event = ATSFEvent(
            event_type=event_type,
            timestamp=datetime.now(),
            source=self.__class__.__name__,
            agent_id=agent_id,
            data=data,
            severity=severity
        )
        self._event_bus.publish(event)


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF Real-time System Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Event Bus
    tests_total += 1
    try:
        bus = EventBus()
        received = []
        
        def handler(event):
            received.append(event)
        
        bus.subscribe(EventType.TRUST_CHANGE, handler)
        
        event = ATSFEvent(
            event_type=EventType.TRUST_CHANGE,
            timestamp=datetime.now(),
            source="test",
            data={"old": 0.5, "new": 0.6}
        )
        
        count = bus.publish(event)
        assert count >= 1
        assert len(received) == 1
        print("  ✓ Event bus pub/sub works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Event bus failed: {e}")
    
    # Test 2: Event serialization
    tests_total += 1
    try:
        event = ATSFEvent(
            event_type=EventType.ACTION_DENIED,
            timestamp=datetime.now(),
            source="test",
            agent_id="agent_001",
            data={"reason": "trust too low"},
            severity="warning"
        )
        
        json_str = event.to_json()
        parsed = json.loads(json_str)
        
        restored = ATSFEvent.from_dict(parsed)
        assert restored.agent_id == "agent_001"
        assert restored.severity == "warning"
        print("  ✓ Event serialization works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Event serialization failed: {e}")
    
    # Test 3: Action Stream
    tests_total += 1
    try:
        stream = ActionStream()
        
        for i in range(10):
            stream.record(
                agent_id="agent_001",
                action_type="read",
                decision="allow" if i % 3 != 0 else "deny",
                trust_score=0.5 + i * 0.01,
                processing_time_ms=1.5
            )
        
        recent = stream.get_recent(limit=5)
        assert len(recent) == 5
        
        stats = stream.get_stats()
        assert stats["total"] == 10
        print("  ✓ Action stream works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Action stream failed: {e}")
    
    # Test 4: Alert Manager
    tests_total += 1
    try:
        alerts = AlertManager()
        
        alert = alerts.trigger(
            alert_type="test_alert",
            severity="warning",
            message="Test alert message",
            agent_id="agent_001"
        )
        
        assert alert["severity"] == "warning"
        assert not alert["acknowledged"]
        
        alerts.acknowledge(alert["id"])
        active = alerts.get_active()
        assert len(active) == 0
        print("  ✓ Alert manager works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Alert manager failed: {e}")
    
    # Test 5: Event history
    tests_total += 1
    try:
        bus = EventBus()
        
        for i in range(20):
            event = ATSFEvent(
                event_type=EventType.ACTION_ALLOWED if i % 2 == 0 else EventType.ACTION_DENIED,
                timestamp=datetime.now(),
                source="test",
                agent_id=f"agent_{i % 3}"
            )
            bus.publish(event)
        
        history = bus.get_history(limit=10)
        assert len(history) == 10
        
        filtered = bus.get_history(event_type=EventType.ACTION_DENIED, limit=50)
        assert all(e.event_type == EventType.ACTION_DENIED for e in filtered)
        print("  ✓ Event history works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Event history failed: {e}")
    
    # Test 6: Threshold alerts
    tests_total += 1
    try:
        alerts = AlertManager()
        alerts.set_threshold("risk_score", 0.8)
        
        # Should not trigger
        result = alerts.check_metric("risk_score", 0.5, "agent_001")
        assert result is None
        
        # Should trigger
        result = alerts.check_metric("risk_score", 0.9, "agent_001")
        assert result is not None
        assert result["type"] == "risk_score_exceeded"
        print("  ✓ Threshold alerts work")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Threshold alerts failed: {e}")
    
    # Test 7: Wildcard subscription
    tests_total += 1
    try:
        bus = EventBus()
        all_events = []
        
        def catch_all(event):
            all_events.append(event)
        
        bus.subscribe("*", catch_all)
        
        bus.publish(ATSFEvent(EventType.TRUST_CHANGE, datetime.now(), "test"))
        bus.publish(ATSFEvent(EventType.ACTION_DENIED, datetime.now(), "test"))
        
        assert len(all_events) >= 2
        print("  ✓ Wildcard subscription works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Wildcard subscription failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
