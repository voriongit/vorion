---
sidebar_position: 2
title: Simple Reflex Agents
description: Condition-action rules for reactive behavior
tags: [taxonomy, reactive, automation]
---

# Simple Reflex Agents

## Condition-Action Rules for Reactive Behavior

The simplest form of agent: perceive the environment, match against rules, execute actions. No memory, no planning—pure reaction.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                   SIMPLE REFLEX AGENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    Environment ──▶ [SENSORS] ──▶ Current Percept           │
│                                        │                    │
│                                        ▼                    │
│                              ┌─────────────────┐            │
│                              │ CONDITION-ACTION │            │
│                              │     RULES        │            │
│                              │                 │            │
│                              │ if X then Y     │            │
│                              │ if A then B     │            │
│                              └────────┬────────┘            │
│                                       │                     │
│                                       ▼                     │
│    Environment ◀── [ACTUATORS] ◀── Action                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Characteristics

| Aspect | Description |
|--------|-------------|
| **Memory** | None — only sees current percept |
| **Planning** | None — immediate reaction |
| **Complexity** | O(n) rule matching |
| **Adaptability** | Fixed rules, no learning |
| **Best For** | Fully observable, deterministic environments |

---

## Implementation Pattern

```python
class SimpleReflexAgent:
    def __init__(self, rules: list[tuple[Callable, Callable]]):
        """
        rules: List of (condition, action) pairs
        """
        self.rules = rules

    def act(self, percept: dict) -> str:
        """Select action based on current percept only."""
        for condition, action in self.rules:
            if condition(percept):
                return action(percept)
        return "no_action"

# Example: Thermostat agent
thermostat = SimpleReflexAgent([
    (lambda p: p["temp"] < 68, lambda p: "heat_on"),
    (lambda p: p["temp"] > 72, lambda p: "heat_off"),
    (lambda p: True, lambda p: "maintain"),
])
```

---

## LLM Implementation

Modern LLM-based simple reflex agents use prompt engineering:

```python
SIMPLE_REFLEX_PROMPT = """
You are a customer service bot. Respond ONLY based on the current message.
Do not reference previous messages or plan ahead.

Rules:
- If greeting → respond with greeting
- If complaint → apologize and escalate
- If question about hours → state hours are 9-5
- Otherwise → ask to clarify

Current message: {message}
Response:
"""
```

---

## Limitations

### 1. No Memory
Cannot handle: "As I mentioned earlier..."
The agent has no concept of conversation history.

### 2. No Partial Observability
If the environment state isn't fully visible in the current percept, the agent cannot reason about hidden state.

### 3. No Lookahead
Cannot optimize multi-step outcomes. Each action is locally optimal but may be globally suboptimal.

---

## When to Use

**Good fit:**
- Simple automation tasks
- Stateless API handlers
- Event-triggered webhooks
- Basic chatbot intents

**Poor fit:**
- Multi-turn conversations
- Complex decision making
- Environments with hidden state
- Tasks requiring planning

---

## Real-World Examples

| System | Condition | Action |
|--------|-----------|--------|
| Email filter | Subject contains "urgent" | Move to priority inbox |
| Auto-responder | Out of office detected | Send template reply |
| Alert system | CPU > 90% | Page on-call |
| Trading bot | Price < threshold | Execute buy order |

---

## Evolution Path

Simple reflex agents often evolve into more sophisticated types:

```
Simple Reflex
     │
     │ + Add state tracking
     ▼
Model-Based Reflex
     │
     │ + Add goal representation
     ▼
Goal-Based Agent
```

---

## References

- Russell, S., & Norvig, P. (2020). *AIMA*, Chapter 2.4.2
- Braitenberg, V. (1984). *Vehicles: Experiments in Synthetic Psychology*
