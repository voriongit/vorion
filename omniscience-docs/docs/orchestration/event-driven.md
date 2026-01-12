---
sidebar_position: 4
title: Event-Driven Architecture
description: Reactive multi-agent systems using publish-subscribe patterns
tags: [orchestration, events, pub-sub, reactive]
---

# Event-Driven Architecture

## Reactive Multi-Agent Systems Using Publish-Subscribe Patterns

Event-driven architecture (EDA) enables autonomous agents to operate as loosely coupled, reactive components that respond to events in real-time. This pattern is fundamental to building scalable, resilient multi-agent systems.

## Core Concepts

### Event Fundamentals

An **event** is an immutable record of something that happened:

```typescript
interface AgentEvent {
  id: string;                    // Unique event identifier
  type: string;                  // Event classification
  source: string;                // Originating agent DID
  timestamp: number;             // Unix timestamp
  payload: Record<string, any>;  // Event-specific data
  metadata: {
    correlationId?: string;      // For tracing workflows
    causationId?: string;        // What caused this event
    version: string;             // Schema version
  };
}
```

### Event Types in Agentic Systems

| Event Category | Examples | Typical Subscribers |
|----------------|----------|---------------------|
| **Task Events** | `task.created`, `task.completed`, `task.failed` | Orchestrators, monitors |
| **State Events** | `agent.started`, `agent.paused`, `memory.updated` | Coordinators, dashboards |
| **Data Events** | `document.processed`, `embedding.generated` | Downstream processors |
| **Decision Events** | `action.proposed`, `action.approved`, `action.vetoed` | Human oversight, audit |
| **Trust Events** | `score.updated`, `violation.detected` | Security agents, governance |

## Publish-Subscribe Patterns

### Basic Pub-Sub

```
┌─────────────┐     publish      ┌─────────────┐     subscribe    ┌─────────────┐
│   Agent A   │ ──────────────▶  │  Event Bus  │ ◀─────────────── │   Agent B   │
│  (Producer) │                  │   (Broker)  │                  │ (Consumer)  │
└─────────────┘                  └──────┬──────┘                  └─────────────┘
                                        │
                                        │ deliver
                                        ▼
                                 ┌─────────────┐
                                 │   Agent C   │
                                 │ (Consumer)  │
                                 └─────────────┘
```

### Topic-Based Routing

Agents subscribe to specific topics using patterns:

```python
# Exact match
event_bus.subscribe("task.completed", handler)

# Wildcard patterns
event_bus.subscribe("task.*", handler)           # All task events
event_bus.subscribe("agent.*.memory", handler)  # Memory events from any agent
event_bus.subscribe("#", handler)                # All events (audit)
```

### Content-Based Routing

Filter events based on payload content:

```python
event_bus.subscribe(
    topic="task.created",
    filter={
        "payload.priority": {"$gte": "high"},
        "payload.domain": "financial"
    },
    handler=high_priority_financial_handler
)
```

## Event Sourcing for Agents

### The Event Store

Rather than storing current state, store the sequence of events:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Agent Event Store                             │
├─────────┬─────────────────────┬──────────────────────────────────────────┤
│ Seq     │ Event Type          │ Payload                                  │
├─────────┼─────────────────────┼──────────────────────────────────────────┤
│ 1       │ agent.initialized   │ {model: "claude-3", capabilities: [...]} │
│ 2       │ memory.updated      │ {key: "user_context", value: {...}}      │
│ 3       │ task.received       │ {id: "t-123", description: "..."}        │
│ 4       │ tool.invoked        │ {tool: "search", params: {...}}          │
│ 5       │ task.completed      │ {id: "t-123", result: {...}}             │
└─────────┴─────────────────────┴──────────────────────────────────────────┘
```

### Benefits of Event Sourcing

1. **Complete Audit Trail**: Every action is recorded
2. **Time Travel**: Reconstruct state at any point
3. **Debugging**: Replay events to reproduce issues
4. **Analytics**: Rich data for behavior analysis
5. **CQRS**: Separate read and write models

### State Reconstruction

```python
def reconstruct_agent_state(agent_id: str, up_to: datetime = None) -> AgentState:
    """Rebuild agent state from event history."""
    events = event_store.get_events(
        agent_id=agent_id,
        up_to=up_to
    )

    state = AgentState.initial()

    for event in events:
        state = state.apply(event)

    return state
```

## Implementation Patterns

### The Saga Pattern

For multi-agent workflows that require coordination:

```
                    Order Saga
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐       │
│  │ Create  │───▶│ Reserve │───▶│ Process │───▶│Complete │       │
│  │ Order   │    │Inventory│    │ Payment │    │ Order   │       │
│  └────┬────┘    └────┬────┘    └────┬────┘    └─────────┘       │
│       │              │              │                            │
│       │ fail         │ fail         │ fail                       │
│       ▼              ▼              ▼                            │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                      │
│  │ Cancel  │◀───│ Release │◀───│ Refund  │                      │
│  │ Order   │    │Inventory│    │ Payment │                      │
│  └─────────┘    └─────────┘    └─────────┘                      │
│                                                                  │
│                 Compensating Transactions                        │
└──────────────────────────────────────────────────────────────────┘
```

### Choreography vs Orchestration

| Aspect | Choreography | Orchestration |
|--------|--------------|---------------|
| **Coordination** | Agents react to events | Central coordinator directs |
| **Coupling** | Loose (agents independent) | Tighter (coordinator knows flow) |
| **Visibility** | Distributed (harder to trace) | Centralized (easy monitoring) |
| **Resilience** | No single point of failure | Coordinator is critical |
| **Complexity** | Grows with interactions | Contained in orchestrator |

### Event-Driven Agent Example

```python
class EventDrivenAgent:
    """Agent that operates entirely through events."""

    def __init__(self, event_bus: EventBus, agent_id: str):
        self.event_bus = event_bus
        self.agent_id = agent_id
        self._setup_subscriptions()

    def _setup_subscriptions(self):
        """Subscribe to relevant events."""
        self.event_bus.subscribe(
            f"task.assigned.{self.agent_id}",
            self._handle_task_assigned
        )
        self.event_bus.subscribe(
            f"agent.{self.agent_id}.query",
            self._handle_query
        )
        self.event_bus.subscribe(
            "system.shutdown",
            self._handle_shutdown
        )

    async def _handle_task_assigned(self, event: AgentEvent):
        """Process assigned task."""
        # Emit acknowledgment
        await self.event_bus.publish(AgentEvent(
            type="task.acknowledged",
            source=self.agent_id,
            payload={"task_id": event.payload["task_id"]},
            metadata={"correlationId": event.id}
        ))

        try:
            result = await self._execute_task(event.payload)

            await self.event_bus.publish(AgentEvent(
                type="task.completed",
                source=self.agent_id,
                payload={"task_id": event.payload["task_id"], "result": result},
                metadata={"correlationId": event.id}
            ))
        except Exception as e:
            await self.event_bus.publish(AgentEvent(
                type="task.failed",
                source=self.agent_id,
                payload={"task_id": event.payload["task_id"], "error": str(e)},
                metadata={"correlationId": event.id}
            ))
```

## Message Brokers for Agents

### Comparison of Technologies

| Technology | Strengths | Best For |
|------------|-----------|----------|
| **Apache Kafka** | High throughput, persistence, replay | Large-scale event sourcing |
| **RabbitMQ** | Flexible routing, mature | Traditional messaging patterns |
| **Redis Streams** | Low latency, simple | Real-time agent coordination |
| **NATS** | Lightweight, cloud-native | Microservice agents |
| **AWS EventBridge** | Serverless, AWS integration | Cloud-native systems |

### Event Schema Evolution

Managing changes to event structures:

```json
{
  "type": "task.completed",
  "schemaVersion": "2.0.0",
  "payload": {
    "taskId": "t-123",
    "result": {
      "status": "success",
      "output": {...},
      "metrics": {
        "duration_ms": 1523,
        "tokens_used": 450
      }
    }
  }
}
```

## Real-Time Agent Coordination

### Presence and Discovery

```python
class AgentPresenceManager:
    """Track online agents and their capabilities."""

    async def announce_presence(self, agent: AgentInfo):
        """Broadcast agent availability."""
        await self.event_bus.publish(AgentEvent(
            type="agent.online",
            source=agent.did,
            payload={
                "capabilities": agent.capabilities,
                "capacity": agent.available_capacity,
                "specializations": agent.specializations
            }
        ))

    async def find_capable_agents(self, capability: str) -> List[str]:
        """Find agents with specific capability."""
        return [
            agent_id for agent_id, info in self.agents.items()
            if capability in info.capabilities and info.available_capacity > 0
        ]
```

### Heartbeat and Health

```python
# Agent publishes heartbeat every 30 seconds
async def heartbeat_loop(agent_id: str, event_bus: EventBus):
    while True:
        await event_bus.publish(AgentEvent(
            type="agent.heartbeat",
            source=agent_id,
            payload={
                "status": "healthy",
                "load": get_current_load(),
                "memory_usage": get_memory_usage()
            }
        ))
        await asyncio.sleep(30)

# Monitor detects failures
class AgentMonitor:
    def __init__(self, timeout_seconds: int = 90):
        self.last_heartbeat: Dict[str, datetime] = {}
        self.timeout = timedelta(seconds=timeout_seconds)

    async def check_agents(self):
        now = datetime.utcnow()
        for agent_id, last_seen in self.last_heartbeat.items():
            if now - last_seen > self.timeout:
                await self.event_bus.publish(AgentEvent(
                    type="agent.suspected_failure",
                    source="monitor",
                    payload={"agent_id": agent_id, "last_seen": last_seen}
                ))
```

## Backpressure and Flow Control

### Handling Event Storms

```python
class BackpressureHandler:
    """Prevent agents from being overwhelmed by events."""

    def __init__(self, max_queue_size: int = 1000):
        self.queue = asyncio.Queue(maxsize=max_queue_size)
        self.dropped_count = 0

    async def handle_event(self, event: AgentEvent):
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            self.dropped_count += 1
            # Signal backpressure
            await self.event_bus.publish(AgentEvent(
                type="agent.backpressure",
                source=self.agent_id,
                payload={"queue_size": self.queue.qsize(), "dropped": self.dropped_count}
            ))
```

## Testing Event-Driven Agents

### Event Simulation

```python
class EventTestHarness:
    """Test harness for event-driven agents."""

    def __init__(self):
        self.published_events: List[AgentEvent] = []
        self.mock_bus = MockEventBus(self.published_events)

    async def test_task_completion(self):
        agent = EventDrivenAgent(self.mock_bus, "test-agent")

        # Simulate task assignment
        await self.mock_bus.simulate_event(AgentEvent(
            type="task.assigned.test-agent",
            source="orchestrator",
            payload={"task_id": "t-1", "description": "Test task"}
        ))

        # Verify expected events were published
        assert any(e.type == "task.acknowledged" for e in self.published_events)
        assert any(e.type == "task.completed" for e in self.published_events)
```

## Research Foundations

This architecture draws from:

- **Enterprise Integration Patterns** (Hohpe & Woolf, 2003) - Foundational messaging patterns
- **Event-Driven Architecture** - SOA evolution for reactive systems
- **CQRS/Event Sourcing** (Young, 2010) - Command Query Responsibility Segregation
- **Reactive Manifesto** (2014) - Principles for responsive, resilient systems
- **Actor Model** (Hewitt, 1973) - Message-passing concurrency

---

## See Also

- [Hierarchical Orchestration](./hierarchical.md) - Centralized coordination patterns
- [Multi-Agent Debate](./multi-agent-debate.md) - Consensus through argumentation
- [Audit Trails](../safety/audit-trails.md) - Event logging for compliance
