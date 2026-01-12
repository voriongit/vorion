"""
ATSF v3.0 - Webhook Handler System
===================================

Real-time event notification system via webhooks.

Features:
- Event subscription management
- Retry logic with exponential backoff
- Signature verification
- Rate limiting
- Dead letter queue

Author: ATSF Development Team
Version: 3.0.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Callable, Any
import asyncio
import aiohttp
import hashlib
import hmac
import json
import logging
import secrets
from collections import deque

logger = logging.getLogger("atsf-webhooks")


# =============================================================================
# ENUMS
# =============================================================================

class EventType(str, Enum):
    """Webhook event types."""
    # Agent events
    AGENT_CREATED = "agent.created"
    AGENT_ACTIVATED = "agent.activated"
    AGENT_SUSPENDED = "agent.suspended"
    AGENT_QUARANTINED = "agent.quarantined"
    AGENT_TERMINATED = "agent.terminated"
    
    # Trust events
    TRUST_UPDATED = "trust.updated"
    TRUST_CEILING_REACHED = "trust.ceiling_reached"
    TRUST_VELOCITY_EXCEEDED = "trust.velocity_exceeded"
    
    # Security events
    THREAT_DETECTED = "threat.detected"
    ACTION_BLOCKED = "action.blocked"
    INJECTION_DETECTED = "injection.detected"
    
    # Assessment events
    ASSESSMENT_COMPLETED = "assessment.completed"
    RISK_LEVEL_CHANGED = "risk.level_changed"
    
    # System events
    SYSTEM_ALERT = "system.alert"
    RATE_LIMIT_EXCEEDED = "rate_limit.exceeded"


class DeliveryStatus(str, Enum):
    """Webhook delivery status."""
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"
    DEAD_LETTER = "dead_letter"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class WebhookSubscription:
    """Webhook subscription configuration."""
    id: str
    url: str
    secret: str
    events: List[EventType]
    active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    
    # Rate limiting
    rate_limit: int = 100  # requests per minute
    last_delivery: Optional[datetime] = None
    delivery_count: int = 0
    
    # Retry configuration
    max_retries: int = 5
    retry_delay_seconds: int = 60
    
    # Metadata
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookEvent:
    """Single webhook event."""
    id: str
    event_type: EventType
    timestamp: datetime
    data: Dict[str, Any]
    
    # Delivery tracking
    subscription_id: Optional[str] = None
    status: DeliveryStatus = DeliveryStatus.PENDING
    attempts: int = 0
    last_attempt: Optional[datetime] = None
    last_error: Optional[str] = None
    delivered_at: Optional[datetime] = None


@dataclass
class DeliveryResult:
    """Result of webhook delivery attempt."""
    event_id: str
    subscription_id: str
    success: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error: Optional[str] = None


# =============================================================================
# WEBHOOK MANAGER
# =============================================================================

class WebhookManager:
    """
    Manages webhook subscriptions and event delivery.
    """
    
    def __init__(
        self,
        max_queue_size: int = 10000,
        worker_count: int = 4,
        signature_header: str = "X-ATSF-Signature"
    ):
        self.subscriptions: Dict[str, WebhookSubscription] = {}
        self.event_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self.dead_letter_queue: deque = deque(maxlen=1000)
        self.worker_count = worker_count
        self.signature_header = signature_header
        self.workers: List[asyncio.Task] = []
        self._running = False
        
        # Statistics
        self.stats = {
            "events_queued": 0,
            "events_delivered": 0,
            "events_failed": 0,
            "events_retried": 0
        }
    
    # =========================================================================
    # SUBSCRIPTION MANAGEMENT
    # =========================================================================
    
    def create_subscription(
        self,
        url: str,
        events: List[EventType],
        description: str = None,
        metadata: Dict = None
    ) -> WebhookSubscription:
        """Create a new webhook subscription."""
        subscription = WebhookSubscription(
            id=f"wh_{secrets.token_hex(16)}",
            url=url,
            secret=secrets.token_hex(32),
            events=events,
            description=description,
            metadata=metadata or {}
        )
        
        self.subscriptions[subscription.id] = subscription
        logger.info(f"Created webhook subscription: {subscription.id} -> {url}")
        
        return subscription
    
    def get_subscription(self, subscription_id: str) -> Optional[WebhookSubscription]:
        """Get subscription by ID."""
        return self.subscriptions.get(subscription_id)
    
    def list_subscriptions(self, active_only: bool = True) -> List[WebhookSubscription]:
        """List all subscriptions."""
        subs = list(self.subscriptions.values())
        if active_only:
            subs = [s for s in subs if s.active]
        return subs
    
    def update_subscription(
        self,
        subscription_id: str,
        url: str = None,
        events: List[EventType] = None,
        active: bool = None
    ) -> Optional[WebhookSubscription]:
        """Update subscription configuration."""
        sub = self.subscriptions.get(subscription_id)
        if not sub:
            return None
        
        if url is not None:
            sub.url = url
        if events is not None:
            sub.events = events
        if active is not None:
            sub.active = active
            
        return sub
    
    def delete_subscription(self, subscription_id: str) -> bool:
        """Delete a subscription."""
        if subscription_id in self.subscriptions:
            del self.subscriptions[subscription_id]
            logger.info(f"Deleted webhook subscription: {subscription_id}")
            return True
        return False
    
    def rotate_secret(self, subscription_id: str) -> Optional[str]:
        """Rotate subscription secret."""
        sub = self.subscriptions.get(subscription_id)
        if not sub:
            return None
        
        sub.secret = secrets.token_hex(32)
        return sub.secret
    
    # =========================================================================
    # EVENT PUBLISHING
    # =========================================================================
    
    async def publish(
        self,
        event_type: EventType,
        data: Dict[str, Any],
        agent_id: str = None
    ):
        """
        Publish an event to all matching subscriptions.
        """
        event = WebhookEvent(
            id=f"evt_{secrets.token_hex(16)}",
            event_type=event_type,
            timestamp=datetime.now(),
            data={
                **data,
                "agent_id": agent_id,
                "event_type": event_type.value
            }
        )
        
        # Find matching subscriptions
        matching = [
            s for s in self.subscriptions.values()
            if s.active and event_type in s.events
        ]
        
        # Queue event for each subscription
        for sub in matching:
            event_copy = WebhookEvent(
                id=event.id,
                event_type=event.event_type,
                timestamp=event.timestamp,
                data=event.data,
                subscription_id=sub.id
            )
            
            try:
                self.event_queue.put_nowait(event_copy)
                self.stats["events_queued"] += 1
            except asyncio.QueueFull:
                logger.warning(f"Webhook queue full, dropping event: {event.id}")
        
        logger.debug(f"Published event {event.id} to {len(matching)} subscriptions")
    
    # =========================================================================
    # EVENT DELIVERY
    # =========================================================================
    
    def _generate_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for payload."""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def _deliver_event(
        self,
        event: WebhookEvent,
        session: aiohttp.ClientSession
    ) -> DeliveryResult:
        """Deliver a single event to its subscription."""
        sub = self.subscriptions.get(event.subscription_id)
        if not sub or not sub.active:
            return DeliveryResult(
                event_id=event.id,
                subscription_id=event.subscription_id or "",
                success=False,
                error="Subscription not found or inactive"
            )
        
        # Prepare payload
        payload = json.dumps({
            "event_id": event.id,
            "event_type": event.event_type.value,
            "timestamp": event.timestamp.isoformat(),
            "data": event.data
        }, default=str)
        
        # Generate signature
        signature = self._generate_signature(payload, sub.secret)
        
        headers = {
            "Content-Type": "application/json",
            self.signature_header: f"sha256={signature}",
            "X-ATSF-Event-ID": event.id,
            "X-ATSF-Event-Type": event.event_type.value
        }
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            async with session.post(
                sub.url,
                data=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                elapsed_ms = (asyncio.get_event_loop().time() - start_time) * 1000
                
                if response.status < 300:
                    return DeliveryResult(
                        event_id=event.id,
                        subscription_id=sub.id,
                        success=True,
                        status_code=response.status,
                        response_time_ms=elapsed_ms
                    )
                else:
                    return DeliveryResult(
                        event_id=event.id,
                        subscription_id=sub.id,
                        success=False,
                        status_code=response.status,
                        response_time_ms=elapsed_ms,
                        error=f"HTTP {response.status}"
                    )
                    
        except asyncio.TimeoutError:
            return DeliveryResult(
                event_id=event.id,
                subscription_id=sub.id,
                success=False,
                error="Timeout"
            )
        except Exception as e:
            return DeliveryResult(
                event_id=event.id,
                subscription_id=sub.id,
                success=False,
                error=str(e)
            )
    
    async def _worker(self, worker_id: int, session: aiohttp.ClientSession):
        """Worker coroutine for processing events."""
        logger.info(f"Webhook worker {worker_id} started")
        
        while self._running:
            try:
                event = await asyncio.wait_for(
                    self.event_queue.get(),
                    timeout=1.0
                )
            except asyncio.TimeoutError:
                continue
            
            event.attempts += 1
            event.last_attempt = datetime.now()
            event.status = DeliveryStatus.RETRYING if event.attempts > 1 else DeliveryStatus.PENDING
            
            result = await self._deliver_event(event, session)
            
            if result.success:
                event.status = DeliveryStatus.DELIVERED
                event.delivered_at = datetime.now()
                self.stats["events_delivered"] += 1
                logger.debug(f"Delivered event {event.id}")
            else:
                event.last_error = result.error
                self.stats["events_failed"] += 1
                
                sub = self.subscriptions.get(event.subscription_id)
                max_retries = sub.max_retries if sub else 5
                
                if event.attempts < max_retries:
                    # Exponential backoff
                    delay = min(60 * (2 ** event.attempts), 3600)
                    self.stats["events_retried"] += 1
                    
                    # Re-queue with delay
                    asyncio.create_task(self._delayed_requeue(event, delay))
                    logger.warning(
                        f"Event {event.id} failed, retry {event.attempts}/{max_retries} "
                        f"in {delay}s: {result.error}"
                    )
                else:
                    event.status = DeliveryStatus.DEAD_LETTER
                    self.dead_letter_queue.append(event)
                    logger.error(
                        f"Event {event.id} moved to dead letter queue after "
                        f"{event.attempts} attempts"
                    )
            
            self.event_queue.task_done()
        
        logger.info(f"Webhook worker {worker_id} stopped")
    
    async def _delayed_requeue(self, event: WebhookEvent, delay: float):
        """Re-queue event after delay."""
        await asyncio.sleep(delay)
        try:
            self.event_queue.put_nowait(event)
        except asyncio.QueueFull:
            self.dead_letter_queue.append(event)
    
    # =========================================================================
    # LIFECYCLE
    # =========================================================================
    
    async def start(self):
        """Start webhook delivery workers."""
        if self._running:
            return
            
        self._running = True
        
        connector = aiohttp.TCPConnector(limit=100)
        self._session = aiohttp.ClientSession(connector=connector)
        
        for i in range(self.worker_count):
            task = asyncio.create_task(self._worker(i, self._session))
            self.workers.append(task)
        
        logger.info(f"Started {self.worker_count} webhook workers")
    
    async def stop(self, timeout: float = 30.0):
        """Stop webhook delivery workers."""
        self._running = False
        
        # Wait for queue to drain
        try:
            await asyncio.wait_for(self.event_queue.join(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for webhook queue to drain")
        
        # Cancel workers
        for worker in self.workers:
            worker.cancel()
        
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
        
        if hasattr(self, '_session'):
            await self._session.close()
        
        logger.info("Stopped webhook workers")
    
    # =========================================================================
    # STATISTICS
    # =========================================================================
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get webhook statistics."""
        return {
            **self.stats,
            "queue_size": self.event_queue.qsize(),
            "dead_letter_count": len(self.dead_letter_queue),
            "active_subscriptions": sum(1 for s in self.subscriptions.values() if s.active),
            "total_subscriptions": len(self.subscriptions)
        }
    
    def get_dead_letter_events(self, limit: int = 100) -> List[WebhookEvent]:
        """Get events from dead letter queue."""
        return list(self.dead_letter_queue)[:limit]
    
    def retry_dead_letter(self, event_id: str) -> bool:
        """Retry a specific dead letter event."""
        for event in self.dead_letter_queue:
            if event.id == event_id:
                event.attempts = 0
                event.status = DeliveryStatus.PENDING
                try:
                    self.event_queue.put_nowait(event)
                    self.dead_letter_queue.remove(event)
                    return True
                except asyncio.QueueFull:
                    return False
        return False


# =============================================================================
# EVENT PUBLISHER HELPER
# =============================================================================

class EventPublisher:
    """
    Convenient event publishing interface.
    """
    
    def __init__(self, manager: WebhookManager):
        self.manager = manager
    
    async def agent_created(self, agent_id: str, data: Dict = None):
        await self.manager.publish(
            EventType.AGENT_CREATED,
            data or {},
            agent_id
        )
    
    async def agent_activated(self, agent_id: str):
        await self.manager.publish(
            EventType.AGENT_ACTIVATED,
            {"status": "active"},
            agent_id
        )
    
    async def agent_suspended(self, agent_id: str, reason: str):
        await self.manager.publish(
            EventType.AGENT_SUSPENDED,
            {"reason": reason},
            agent_id
        )
    
    async def agent_quarantined(self, agent_id: str, reason: str):
        await self.manager.publish(
            EventType.AGENT_QUARANTINED,
            {"reason": reason},
            agent_id
        )
    
    async def trust_updated(self, agent_id: str, old_trust: float, new_trust: float, delta: float):
        await self.manager.publish(
            EventType.TRUST_UPDATED,
            {
                "old_trust": old_trust,
                "new_trust": new_trust,
                "delta": delta
            },
            agent_id
        )
    
    async def threat_detected(
        self,
        agent_id: str,
        threat_level: str,
        risk_score: float,
        signals: List[str]
    ):
        await self.manager.publish(
            EventType.THREAT_DETECTED,
            {
                "threat_level": threat_level,
                "risk_score": risk_score,
                "signals": signals
            },
            agent_id
        )
    
    async def action_blocked(
        self,
        agent_id: str,
        action_type: str,
        reason: str,
        signals: List[str]
    ):
        await self.manager.publish(
            EventType.ACTION_BLOCKED,
            {
                "action_type": action_type,
                "reason": reason,
                "signals": signals
            },
            agent_id
        )


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

async def example():
    """Example webhook usage."""
    manager = WebhookManager()
    
    # Create subscription
    sub = manager.create_subscription(
        url="https://example.com/webhooks/atsf",
        events=[EventType.THREAT_DETECTED, EventType.AGENT_QUARANTINED],
        description="Security alerts"
    )
    
    print(f"Created subscription: {sub.id}")
    print(f"Secret: {sub.secret}")
    
    # Start workers
    await manager.start()
    
    # Publish events
    publisher = EventPublisher(manager)
    
    await publisher.threat_detected(
        agent_id="agent-001",
        threat_level="critical",
        risk_score=0.85,
        signals=["INJECTION_DETECTED", "RAPID_TRUST_GAIN"]
    )
    
    # Wait for delivery
    await asyncio.sleep(2)
    
    # Check stats
    print(f"Statistics: {manager.get_statistics()}")
    
    # Stop
    await manager.stop()


if __name__ == "__main__":
    asyncio.run(example())
