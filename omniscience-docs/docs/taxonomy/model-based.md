---
sidebar_position: 3
title: Model-Based Reflex Agents
description: Maintaining internal state for partial observability
tags: [taxonomy, state, world-model]
---

# Model-Based Reflex Agents

## Maintaining Internal State for Partial Observability

When the environment isn't fully observable from a single percept, agents need memory. Model-based agents maintain an internal **world model** to track hidden state.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                 MODEL-BASED REFLEX AGENT                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    Environment ──▶ [SENSORS] ──▶ Current Percept           │
│                                        │                    │
│                                        ▼                    │
│                              ┌─────────────────┐            │
│                              │  WORLD MODEL    │            │
│                              │                 │            │
│    ┌──────────────────────▶  │  Internal State │            │
│    │                         │  + Transition   │            │
│    │                         │    Model        │            │
│    │                         └────────┬────────┘            │
│    │                                  │                     │
│    │                                  ▼                     │
│    │                        ┌─────────────────┐             │
│    │                        │ CONDITION-ACTION │             │
│    │                        │     RULES        │             │
│    │                        └────────┬────────┘             │
│    │                                 │                      │
│    │      State Update               ▼                      │
│    └──────────────────── [ACTUATORS] ──▶ Environment       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. World Model
A representation of the environment that persists between percepts:

```python
@dataclass
class WorldModel:
    # Known entities and their states
    entities: dict[str, Entity]

    # Relationships between entities
    relations: list[Relation]

    # Temporal information
    last_updated: datetime
    history: list[StateSnapshot]
```

### 2. Transition Model
How the world evolves:
- **Action effects**: What changes when the agent acts
- **Autonomous changes**: How the world changes on its own

### 3. Sensor Model
How percepts relate to actual world state (handling noise, uncertainty).

---

## Implementation Pattern

```python
class ModelBasedAgent:
    def __init__(self, rules, transition_model, sensor_model):
        self.rules = rules
        self.transition_model = transition_model
        self.sensor_model = sensor_model
        self.state = {}  # Internal world model

    def update_state(self, percept, last_action):
        """Update internal state based on percept and action."""
        # Predict state change from last action
        predicted = self.transition_model(self.state, last_action)

        # Update with new percept
        self.state = self.sensor_model.update(predicted, percept)

    def act(self, percept, last_action=None):
        """Select action based on internal state."""
        self.update_state(percept, last_action)

        for condition, action in self.rules:
            if condition(self.state):
                return action(self.state)
        return "no_action"
```

---

## LLM Implementation

LLMs naturally maintain context as a form of world model:

```python
class LLMModelBasedAgent:
    def __init__(self, llm):
        self.llm = llm
        self.conversation_history = []
        self.world_state = {}

    def act(self, user_message: str) -> str:
        # Update world model from conversation
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })

        # Include state in prompt
        system_prompt = f"""
        You are an assistant with memory.

        Current world state:
        {json.dumps(self.world_state, indent=2)}

        Update your understanding and respond.
        """

        response = self.llm.chat(
            system=system_prompt,
            messages=self.conversation_history
        )

        # Extract and update state (could use structured output)
        self.world_state = self._extract_state(response)

        return response
```

---

## When State Matters

### Example: Package Delivery Bot

**Without state:**
```
User: Where's my package?
Bot: I don't know which package you mean.
User: Order #12345
Bot: Order #12345 is in transit.
User: When will it arrive?
Bot: I don't know which package you mean.  ← Lost context!
```

**With state:**
```
User: Where's my package?
Bot: I don't know which package you mean.
User: Order #12345
Bot: Order #12345 is in transit.
     [State: current_order = #12345]
User: When will it arrive?
Bot: Order #12345 will arrive tomorrow.  ← Remembers context
```

---

## State Representation Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Key-Value Store** | Simple, fast | Limited structure |
| **Knowledge Graph** | Rich relations | Complex to maintain |
| **Vector Database** | Semantic search | Lossy retrieval |
| **Conversation Buffer** | Full context | Token limits |
| **Hybrid** | Best of all | Implementation complexity |

---

## Challenges

### 1. State Explosion
As environment complexity grows, state space becomes intractable.

### 2. State Consistency
Keeping internal model aligned with actual world state.

### 3. Uncertainty
Real sensors are noisy; state is often probabilistic.

---

## References

- Russell, S., & Norvig, P. (2020). *AIMA*, Chapter 2.4.3
- Cassandra, A. R. (1998). *A Survey of POMDP Applications*
