"""
ATSF v3.0 - Message Queue Integration
======================================

Asynchronous event processing via message queues.

Supports:
- RabbitMQ (AMQP)
- Redis Pub/Sub
- AWS SQS (placeholder)
- Kafka (placeholder)

Author: ATSF Development Team
Version: 3.0.0
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Callable, Any, Awaitable
import asyncio
import json
import logging
import os

logger = logging.getLogger("atsf-mq")


# =============================================================================
# MESSAGE TYPES
# =============================================================================

class MessagePriority(int, Enum):
    """Message priority levels."""
    LOW = 1
    NORMAL = 5
    HIGH = 8
    CRITICAL = 10


@dataclass
class Message:
    """Message structure."""
    id: str
    topic: str
    payload: Dict[str, Any]
    priority: MessagePriority = MessagePriority.NORMAL
    timestamp: datetime = field(default_factory=datetime.now)
    headers: Dict[str, str] = field(default_factory=dict)
    
    # Retry tracking
    attempt: int = 0
    max_attempts: int = 3
    
    def to_json(self) -> str:
        return json.dumps({
            "id": self.id,
            "topic": self.topic,
            "payload": self.payload,
            "priority": self.priority.value,
            "timestamp": self.timestamp.isoformat(),
            "headers": self.headers,
            "attempt": self.attempt,
            "max_attempts": self.max_attempts
        })
    
    @classmethod
    def from_json(cls, data: str) -> "Message":
        d = json.loads(data)
        return cls(
            id=d["id"],
            topic=d["topic"],
            payload=d["payload"],
            priority=MessagePriority(d.get("priority", 5)),
            timestamp=datetime.fromisoformat(d["timestamp"]),
            headers=d.get("headers", {}),
            attempt=d.get("attempt", 0),
            max_attempts=d.get("max_attempts", 3)
        )


# =============================================================================
# ABSTRACT QUEUE INTERFACE
# =============================================================================

MessageHandler = Callable[[Message], Awaitable[bool]]


class MessageQueue(ABC):
    """Abstract message queue interface."""
    
    @abstractmethod
    async def connect(self):
        """Connect to the message broker."""
        pass
    
    @abstractmethod
    async def disconnect(self):
        """Disconnect from the message broker."""
        pass
    
    @abstractmethod
    async def publish(self, message: Message) -> bool:
        """Publish a message."""
        pass
    
    @abstractmethod
    async def subscribe(self, topic: str, handler: MessageHandler):
        """Subscribe to a topic."""
        pass
    
    @abstractmethod
    async def unsubscribe(self, topic: str):
        """Unsubscribe from a topic."""
        pass


# =============================================================================
# REDIS PUB/SUB IMPLEMENTATION
# =============================================================================

class RedisMessageQueue(MessageQueue):
    """Redis Pub/Sub message queue implementation."""
    
    def __init__(self, url: str = None):
        self.url = url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis = None
        self.pubsub = None
        self.handlers: Dict[str, MessageHandler] = {}
        self._listener_task = None
        self._running = False
    
    async def connect(self):
        """Connect to Redis."""
        import aioredis
        
        self.redis = await aioredis.from_url(self.url)
        self.pubsub = self.redis.pubsub()
        self._running = True
        
        logger.info(f"Connected to Redis: {self.url}")
    
    async def disconnect(self):
        """Disconnect from Redis."""
        self._running = False
        
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        
        if self.pubsub:
            await self.pubsub.close()
        
        if self.redis:
            await self.redis.close()
        
        logger.info("Disconnected from Redis")
    
    async def publish(self, message: Message) -> bool:
        """Publish message to Redis channel."""
        try:
            await self.redis.publish(message.topic, message.to_json())
            logger.debug(f"Published message {message.id} to {message.topic}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            return False
    
    async def subscribe(self, topic: str, handler: MessageHandler):
        """Subscribe to a Redis channel."""
        self.handlers[topic] = handler
        await self.pubsub.subscribe(topic)
        
        if not self._listener_task:
            self._listener_task = asyncio.create_task(self._listen())
        
        logger.info(f"Subscribed to topic: {topic}")
    
    async def unsubscribe(self, topic: str):
        """Unsubscribe from a Redis channel."""
        await self.pubsub.unsubscribe(topic)
        if topic in self.handlers:
            del self.handlers[topic]
        
        logger.info(f"Unsubscribed from topic: {topic}")
    
    async def _listen(self):
        """Listen for messages."""
        while self._running:
            try:
                message = await self.pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )
                
                if message and message["type"] == "message":
                    topic = message["channel"].decode() if isinstance(message["channel"], bytes) else message["channel"]
                    data = message["data"].decode() if isinstance(message["data"], bytes) else message["data"]
                    
                    handler = self.handlers.get(topic)
                    if handler:
                        try:
                            msg = Message.from_json(data)
                            await handler(msg)
                        except Exception as e:
                            logger.error(f"Error handling message: {e}")
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Listener error: {e}")
                await asyncio.sleep(1)


# =============================================================================
# RABBITMQ IMPLEMENTATION
# =============================================================================

class RabbitMQMessageQueue(MessageQueue):
    """RabbitMQ (AMQP) message queue implementation."""
    
    def __init__(self, url: str = None):
        self.url = url or os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost/")
        self.connection = None
        self.channel = None
        self.handlers: Dict[str, MessageHandler] = {}
        self._consumer_tags: Dict[str, str] = {}
    
    async def connect(self):
        """Connect to RabbitMQ."""
        import aio_pika
        
        self.connection = await aio_pika.connect_robust(self.url)
        self.channel = await self.connection.channel()
        
        # Set QoS
        await self.channel.set_qos(prefetch_count=10)
        
        logger.info(f"Connected to RabbitMQ: {self.url}")
    
    async def disconnect(self):
        """Disconnect from RabbitMQ."""
        if self.channel:
            await self.channel.close()
        if self.connection:
            await self.connection.close()
        
        logger.info("Disconnected from RabbitMQ")
    
    async def publish(self, message: Message) -> bool:
        """Publish message to RabbitMQ exchange."""
        import aio_pika
        
        try:
            # Declare exchange
            exchange = await self.channel.declare_exchange(
                "atsf_events",
                aio_pika.ExchangeType.TOPIC,
                durable=True
            )
            
            # Publish message
            await exchange.publish(
                aio_pika.Message(
                    body=message.to_json().encode(),
                    content_type="application/json",
                    priority=message.priority.value,
                    message_id=message.id,
                    timestamp=message.timestamp
                ),
                routing_key=message.topic
            )
            
            logger.debug(f"Published message {message.id} to {message.topic}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            return False
    
    async def subscribe(self, topic: str, handler: MessageHandler):
        """Subscribe to RabbitMQ queue."""
        import aio_pika
        
        self.handlers[topic] = handler
        
        # Declare exchange
        exchange = await self.channel.declare_exchange(
            "atsf_events",
            aio_pika.ExchangeType.TOPIC,
            durable=True
        )
        
        # Declare queue
        queue = await self.channel.declare_queue(
            f"atsf_{topic.replace('.', '_')}",
            durable=True
        )
        
        # Bind queue to exchange
        await queue.bind(exchange, routing_key=topic)
        
        # Start consuming
        async def process_message(message: aio_pika.IncomingMessage):
            async with message.process():
                try:
                    msg = Message.from_json(message.body.decode())
                    success = await handler(msg)
                    
                    if not success and msg.attempt < msg.max_attempts:
                        msg.attempt += 1
                        await self.publish(msg)
                        
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
        
        tag = await queue.consume(process_message)
        self._consumer_tags[topic] = tag
        
        logger.info(f"Subscribed to topic: {topic}")
    
    async def unsubscribe(self, topic: str):
        """Unsubscribe from RabbitMQ queue."""
        if topic in self._consumer_tags:
            await self.channel.cancel(self._consumer_tags[topic])
            del self._consumer_tags[topic]
        
        if topic in self.handlers:
            del self.handlers[topic]
        
        logger.info(f"Unsubscribed from topic: {topic}")


# =============================================================================
# IN-MEMORY IMPLEMENTATION (FOR TESTING)
# =============================================================================

class InMemoryMessageQueue(MessageQueue):
    """In-memory message queue for testing."""
    
    def __init__(self):
        self.handlers: Dict[str, MessageHandler] = {}
        self.messages: List[Message] = []
        self._running = False
    
    async def connect(self):
        self._running = True
        logger.info("Connected to in-memory queue")
    
    async def disconnect(self):
        self._running = False
        logger.info("Disconnected from in-memory queue")
    
    async def publish(self, message: Message) -> bool:
        self.messages.append(message)
        
        handler = self.handlers.get(message.topic)
        if handler:
            asyncio.create_task(handler(message))
        
        return True
    
    async def subscribe(self, topic: str, handler: MessageHandler):
        self.handlers[topic] = handler
        logger.info(f"Subscribed to topic: {topic}")
    
    async def unsubscribe(self, topic: str):
        if topic in self.handlers:
            del self.handlers[topic]
        logger.info(f"Unsubscribed from topic: {topic}")


# =============================================================================
# ATSF EVENT TOPICS
# =============================================================================

class ATSFTopics:
    """ATSF event topics."""
    
    # Agent events
    AGENT_LIFECYCLE = "atsf.agent.lifecycle"
    AGENT_TRUST = "atsf.agent.trust"
    
    # Security events
    SECURITY_THREAT = "atsf.security.threat"
    SECURITY_ACTION = "atsf.security.action"
    SECURITY_INJECTION = "atsf.security.injection"
    
    # Assessment events
    ASSESSMENT_COMPLETE = "atsf.assessment.complete"
    
    # System events
    SYSTEM_ALERT = "atsf.system.alert"
    SYSTEM_METRICS = "atsf.system.metrics"


# =============================================================================
# EVENT PRODUCER
# =============================================================================

class ATSFEventProducer:
    """ATSF event producer."""
    
    def __init__(self, queue: MessageQueue):
        self.queue = queue
        self._message_id = 0
    
    def _next_id(self) -> str:
        self._message_id += 1
        return f"msg_{self._message_id:08d}"
    
    async def agent_lifecycle(
        self,
        agent_id: str,
        event: str,
        data: Dict = None
    ):
        """Publish agent lifecycle event."""
        await self.queue.publish(Message(
            id=self._next_id(),
            topic=ATSFTopics.AGENT_LIFECYCLE,
            payload={
                "agent_id": agent_id,
                "event": event,
                **(data or {})
            },
            priority=MessagePriority.NORMAL
        ))
    
    async def trust_update(
        self,
        agent_id: str,
        old_trust: float,
        new_trust: float,
        delta: float
    ):
        """Publish trust update event."""
        await self.queue.publish(Message(
            id=self._next_id(),
            topic=ATSFTopics.AGENT_TRUST,
            payload={
                "agent_id": agent_id,
                "old_trust": old_trust,
                "new_trust": new_trust,
                "delta": delta
            },
            priority=MessagePriority.NORMAL
        ))
    
    async def threat_detected(
        self,
        agent_id: str,
        threat_level: str,
        risk_score: float,
        signals: List[str]
    ):
        """Publish threat detection event."""
        await self.queue.publish(Message(
            id=self._next_id(),
            topic=ATSFTopics.SECURITY_THREAT,
            payload={
                "agent_id": agent_id,
                "threat_level": threat_level,
                "risk_score": risk_score,
                "signals": signals
            },
            priority=MessagePriority.CRITICAL if threat_level in ["critical", "catastrophic"] else MessagePriority.HIGH
        ))
    
    async def action_processed(
        self,
        agent_id: str,
        request_id: str,
        allowed: bool,
        risk_score: float,
        signals: List[str]
    ):
        """Publish action processing event."""
        await self.queue.publish(Message(
            id=self._next_id(),
            topic=ATSFTopics.SECURITY_ACTION,
            payload={
                "agent_id": agent_id,
                "request_id": request_id,
                "allowed": allowed,
                "risk_score": risk_score,
                "signals": signals
            },
            priority=MessagePriority.HIGH if not allowed else MessagePriority.NORMAL
        ))


# =============================================================================
# FACTORY
# =============================================================================

def create_message_queue(queue_type: str = None) -> MessageQueue:
    """
    Create message queue instance.
    
    Args:
        queue_type: "redis", "rabbitmq", or "memory"
    """
    queue_type = queue_type or os.getenv("MQ_TYPE", "memory")
    
    if queue_type == "redis":
        return RedisMessageQueue()
    elif queue_type == "rabbitmq":
        return RabbitMQMessageQueue()
    else:
        return InMemoryMessageQueue()


# =============================================================================
# EXAMPLE
# =============================================================================

async def example():
    """Example message queue usage."""
    # Create queue
    queue = create_message_queue("memory")
    await queue.connect()
    
    # Create producer
    producer = ATSFEventProducer(queue)
    
    # Subscribe to events
    async def handle_threat(msg: Message) -> bool:
        print(f"Received threat: {msg.payload}")
        return True
    
    await queue.subscribe(ATSFTopics.SECURITY_THREAT, handle_threat)
    
    # Publish events
    await producer.threat_detected(
        agent_id="agent-001",
        threat_level="high",
        risk_score=0.75,
        signals=["INJECTION_DETECTED"]
    )
    
    # Wait for processing
    await asyncio.sleep(1)
    
    # Cleanup
    await queue.disconnect()


if __name__ == "__main__":
    asyncio.run(example())
