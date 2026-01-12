"""
ATSF v3.0 - Event Handlers
===========================

Webhook and message queue integration for ATSF events.

Supports:
- HTTP Webhooks
- Redis Pub/Sub
- RabbitMQ
- Apache Kafka

Author: ATSF Development Team
Version: 3.0.0
"""

import json
import hmac
import hashlib
import asyncio
from datetime import datetime
from typing import Dict, List, Callable, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import logging

logger = logging.getLogger("atsf-events")


# =============================================================================
# EVENT TYPES
# =============================================================================

class EventType(str, Enum):
    """ATSF event types."""
    
    # Agent events
    AGENT_CREATED = "agent.created"
    AGENT_ACTIVATED = "agent.activated"
    AGENT_SUSPENDED = "agent.suspended"
    AGENT_QUARANTINED = "agent.quarantined"
    AGENT_TERMINATED = "agent.terminated"
    
    # Trust events
    TRUST_UPDATED = "trust.updated"
    TRUST_CEILING_HIT = "trust.ceiling_hit"
    TRUST_VELOCITY_CAPPED = "trust.velocity_capped"
    
    # Action events
    ACTION_PROCESSED = "action.processed"
    ACTION_BLOCKED = "action.blocked"
    ACTION_APPROVED = "action.approved"
    
    # Threat events
    THREAT_DETECTED = "threat.detected"
    THREAT_ESCALATED = "threat.escalated"
    THREAT_RESOLVED = "threat.resolved"
    
    # Assessment events
    ASSESSMENT_COMPLETED = "assessment.completed"
    
    # System events
    SYSTEM_ALERT = "system.alert"


@dataclass
class Event:
    """ATSF event."""
    
    event_type: EventType
    timestamp: str
    data: Dict[str, Any]
    source: str = "atsf-api"
    version: str = "3.0"
    
    def to_dict(self) -> Dict:
        return {
            "event": self.event_type.value,
            "timestamp": self.timestamp,
            "data": self.data,
            "source": self.source,
            "version": self.version
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


# =============================================================================
# WEBHOOK HANDLER
# =============================================================================

class WebhookHandler:
    """HTTP webhook event handler."""
    
    def __init__(self, secret: str = None):
        self.secret = secret
        self.subscribers: List[Dict] = []
        
    def subscribe(self, url: str, events: List[EventType] = None, headers: Dict = None):
        """Subscribe a webhook endpoint."""
        self.subscribers.append({
            "url": url,
            "events": events or list(EventType),
            "headers": headers or {}
        })
        
    def unsubscribe(self, url: str):
        """Unsubscribe a webhook endpoint."""
        self.subscribers = [s for s in self.subscribers if s["url"] != url]
        
    def sign_payload(self, payload: str) -> str:
        """Sign webhook payload."""
        if not self.secret:
            return ""
        return hmac.new(
            self.secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
    async def dispatch(self, event: Event):
        """Dispatch event to all subscribers."""
        import aiohttp
        
        payload = event.to_json()
        signature = self.sign_payload(payload)
        
        async with aiohttp.ClientSession() as session:
            for subscriber in self.subscribers:
                # Check if subscriber wants this event
                if event.event_type not in subscriber["events"]:
                    continue
                    
                headers = {
                    "Content-Type": "application/json",
                    "X-ATSF-Event": event.event_type.value,
                    "X-ATSF-Timestamp": event.timestamp,
                    "X-ATSF-Signature": signature,
                    **subscriber["headers"]
                }
                
                try:
                    async with session.post(
                        subscriber["url"],
                        data=payload,
                        headers=headers,
                        timeout=30
                    ) as response:
                        if response.status >= 400:
                            logger.warning(
                                f"Webhook delivery failed: {subscriber['url']} "
                                f"status={response.status}"
                            )
                except Exception as e:
                    logger.error(f"Webhook error: {subscriber['url']} - {e}")


# =============================================================================
# REDIS PUB/SUB HANDLER
# =============================================================================

class RedisPubSubHandler:
    """Redis Pub/Sub event handler."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self.redis = None
        self.pubsub = None
        self.handlers: Dict[EventType, List[Callable]] = {}
        
    async def connect(self):
        """Connect to Redis."""
        import aioredis
        self.redis = await aioredis.from_url(self.redis_url)
        self.pubsub = self.redis.pubsub()
        
    async def disconnect(self):
        """Disconnect from Redis."""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()
            
    async def publish(self, event: Event, channel: str = "atsf:events"):
        """Publish event to Redis channel."""
        await self.redis.publish(channel, event.to_json())
        
    async def subscribe(self, channel: str = "atsf:events"):
        """Subscribe to Redis channel."""
        await self.pubsub.subscribe(channel)
        
    def on_event(self, event_type: EventType, handler: Callable):
        """Register event handler."""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)
        
    async def listen(self):
        """Listen for events."""
        async for message in self.pubsub.listen():
            if message["type"] != "message":
                continue
                
            try:
                data = json.loads(message["data"])
                event_type = EventType(data["event"])
                
                for handler in self.handlers.get(event_type, []):
                    await handler(data)
            except Exception as e:
                logger.error(f"Redis event handling error: {e}")


# =============================================================================
# RABBITMQ HANDLER
# =============================================================================

class RabbitMQHandler:
    """RabbitMQ event handler."""
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 5672,
        username: str = "guest",
        password: str = "guest",
        exchange: str = "atsf.events"
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.exchange = exchange
        self.connection = None
        self.channel = None
        
    async def connect(self):
        """Connect to RabbitMQ."""
        import aio_pika
        
        self.connection = await aio_pika.connect_robust(
            f"amqp://{self.username}:{self.password}@{self.host}:{self.port}/"
        )
        self.channel = await self.connection.channel()
        
        # Declare exchange
        self.exchange_obj = await self.channel.declare_exchange(
            self.exchange,
            aio_pika.ExchangeType.TOPIC,
            durable=True
        )
        
    async def disconnect(self):
        """Disconnect from RabbitMQ."""
        if self.connection:
            await self.connection.close()
            
    async def publish(self, event: Event):
        """Publish event to RabbitMQ."""
        import aio_pika
        
        routing_key = event.event_type.value
        message = aio_pika.Message(
            body=event.to_json().encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT
        )
        
        await self.exchange_obj.publish(message, routing_key=routing_key)
        
    async def subscribe(
        self,
        queue_name: str,
        routing_keys: List[str],
        handler: Callable
    ):
        """Subscribe to events."""
        # Declare queue
        queue = await self.channel.declare_queue(queue_name, durable=True)
        
        # Bind to routing keys
        for key in routing_keys:
            await queue.bind(self.exchange_obj, routing_key=key)
            
        # Start consuming
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    try:
                        data = json.loads(message.body)
                        await handler(data)
                    except Exception as e:
                        logger.error(f"RabbitMQ handler error: {e}")


# =============================================================================
# KAFKA HANDLER
# =============================================================================

class KafkaHandler:
    """Apache Kafka event handler."""
    
    def __init__(
        self,
        bootstrap_servers: str = "localhost:9092",
        topic: str = "atsf-events"
    ):
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.producer = None
        self.consumer = None
        
    async def connect_producer(self):
        """Connect Kafka producer."""
        from aiokafka import AIOKafkaProducer
        
        self.producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode()
        )
        await self.producer.start()
        
    async def connect_consumer(self, group_id: str = "atsf-consumers"):
        """Connect Kafka consumer."""
        from aiokafka import AIOKafkaConsumer
        
        self.consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=group_id,
            value_deserializer=lambda v: json.loads(v.decode())
        )
        await self.consumer.start()
        
    async def disconnect(self):
        """Disconnect from Kafka."""
        if self.producer:
            await self.producer.stop()
        if self.consumer:
            await self.consumer.stop()
            
    async def publish(self, event: Event):
        """Publish event to Kafka."""
        await self.producer.send_and_wait(
            self.topic,
            value=event.to_dict(),
            key=event.event_type.value.encode()
        )
        
    async def consume(self, handler: Callable):
        """Consume events from Kafka."""
        async for message in self.consumer:
            try:
                await handler(message.value)
            except Exception as e:
                logger.error(f"Kafka handler error: {e}")


# =============================================================================
# EVENT EMITTER (SERVER-SIDE)
# =============================================================================

class EventEmitter:
    """Central event emitter for ATSF server."""
    
    def __init__(self):
        self.handlers: List[Any] = []
        
    def add_handler(self, handler):
        """Add event handler."""
        self.handlers.append(handler)
        
    def remove_handler(self, handler):
        """Remove event handler."""
        self.handlers.remove(handler)
        
    async def emit(self, event_type: EventType, data: Dict):
        """Emit event to all handlers."""
        event = Event(
            event_type=event_type,
            timestamp=datetime.utcnow().isoformat() + "Z",
            data=data
        )
        
        for handler in self.handlers:
            try:
                if asyncio.iscoroutinefunction(handler.dispatch):
                    await handler.dispatch(event)
                elif asyncio.iscoroutinefunction(handler.publish):
                    await handler.publish(event)
                else:
                    handler.dispatch(event)
            except Exception as e:
                logger.error(f"Event emission error: {e}")


# =============================================================================
# USAGE EXAMPLES
# =============================================================================

async def example_webhook_usage():
    """Example webhook usage."""
    
    webhook = WebhookHandler(secret="your-secret")
    
    # Subscribe endpoints
    webhook.subscribe(
        url="https://your-service.com/atsf/events",
        events=[EventType.THREAT_DETECTED, EventType.AGENT_QUARANTINED],
        headers={"Authorization": "Bearer your-token"}
    )
    
    # Dispatch event
    event = Event(
        event_type=EventType.THREAT_DETECTED,
        timestamp=datetime.utcnow().isoformat() + "Z",
        data={
            "agent_id": "agent-001",
            "threat_level": "high",
            "risk_score": 0.75
        }
    )
    
    await webhook.dispatch(event)


async def example_redis_usage():
    """Example Redis Pub/Sub usage."""
    
    handler = RedisPubSubHandler("redis://localhost:6379/0")
    await handler.connect()
    
    # Register handlers
    async def on_threat(data):
        print(f"Threat detected: {data}")
        
    handler.on_event(EventType.THREAT_DETECTED, on_threat)
    
    # Subscribe and listen
    await handler.subscribe()
    await handler.listen()


async def example_rabbitmq_usage():
    """Example RabbitMQ usage."""
    
    handler = RabbitMQHandler()
    await handler.connect()
    
    # Publish event
    event = Event(
        event_type=EventType.ACTION_BLOCKED,
        timestamp=datetime.utcnow().isoformat() + "Z",
        data={"agent_id": "agent-001", "action": "execute", "reason": "blocked"}
    )
    await handler.publish(event)
    
    # Subscribe to events
    async def on_event(data):
        print(f"Received: {data}")
        
    await handler.subscribe(
        queue_name="my-service",
        routing_keys=["action.*", "threat.*"],
        handler=on_event
    )


if __name__ == "__main__":
    # Test event creation
    event = Event(
        event_type=EventType.THREAT_DETECTED,
        timestamp=datetime.utcnow().isoformat() + "Z",
        data={"agent_id": "test", "level": "high"}
    )
    print(event.to_json())
