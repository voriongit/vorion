---
sidebar_position: 1
title: Cognitive Architecture
description: The internal anatomy of intelligent agents
---

# Cognitive Architecture

## The Internal Anatomy of Intelligent Agents

A cognitive architecture defines how an agent's components—memory, reasoning, planning, and action—are organized and interact. It's the blueprint for machine cognition.

:::tip Think of it Like a Brain
Just like your brain has different regions for memory, decision-making, and motor control, AI agents have **cognitive architectures** with specialized components:

| Human Brain | AI Agent |
|-------------|----------|
| Short-term memory | Working memory / context window |
| Long-term memory | Vector databases, knowledge graphs |
| Prefrontal cortex (planning) | Planning engines |
| Motor cortex (action) | Tool use / API calls |

The **ReAct pattern** (Reasoning + Acting) is the most common architecture—it's like thinking out loud before doing something.
:::

---

## Core Systems

```
┌─────────────────────────────────────────────────────────────────┐
│                    COGNITIVE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   MEMORY     │◀──▶│  REASONING   │◀──▶│   PLANNING   │     │
│   │   SYSTEMS    │    │   ENGINE     │    │   ENGINE     │     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                         │
│                    │  TOOL INTERFACE  │                         │
│                    │                  │                         │
│                    │  APIs, Code,     │                         │
│                    │  Databases, Web  │                         │
│                    └──────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Components

### [Memory Systems](/architecture/memory-systems)
How agents store and retrieve information across different timescales:
- **Working Memory**: Active context for current reasoning
- **Episodic Memory**: Specific past experiences
- **Semantic Memory**: General knowledge and facts
- **Procedural Memory**: Skills and how-to knowledge

### [ReAct Pattern](/architecture/react-pattern)
The foundational pattern for LLM agents:
- **Reasoning**: Think about the situation
- **Acting**: Take an action
- **Observing**: See the result
- **Repeat**: Continue until goal achieved

### [Planning Engines](/architecture/planning-engines)
How agents formulate multi-step plans:
- Classical planners (STRIPS, PDDL)
- Hierarchical task networks
- LLM-based planning
- Monte Carlo tree search

### [Neuro-Symbolic Systems](/architecture/neuro-symbolic)
Combining neural networks with symbolic reasoning:
- Knowledge graph integration
- Rule-based constraints on neural outputs
- Hybrid architectures

### [Tool Use](/architecture/tool-use)
How agents interact with external systems:
- Function calling protocols
- API integration
- Code execution
- Multi-modal tools

---

## Architecture Patterns

### Pattern 1: Single-Agent Loop

```python
while not done:
    observation = perceive(environment)
    thought = reason(observation, memory)
    action = decide(thought)
    result = execute(action)
    memory.store(observation, action, result)
```

### Pattern 2: Multi-Agent Orchestration

```python
# Coordinator distributes to specialists
task = coordinator.decompose(user_request)
results = await asyncio.gather(*[
    specialist.execute(subtask)
    for subtask in task.subtasks
])
response = coordinator.synthesize(results)
```

### Pattern 3: Hierarchical Control

```python
# High-level planner → mid-level tactics → low-level actions
strategic_goal = planner.set_objective(user_intent)
tactical_plan = tactician.plan(strategic_goal)
for action in tactical_plan:
    executor.execute(action)
```

---

## Design Considerations

### Modularity vs Integration

| Approach | Pros | Cons |
|----------|------|------|
| **Modular** | Testable, swappable | Communication overhead |
| **Integrated** | Efficient, coherent | Hard to modify |
| **Hybrid** | Balance | Complexity |

### Synchronous vs Asynchronous

```python
# Synchronous: Simple but blocking
result = tool.call(args)
next_step(result)

# Asynchronous: Parallel but complex
results = await asyncio.gather(
    tool1.call(args1),
    tool2.call(args2)
)
```

### Stateless vs Stateful

```python
# Stateless: Each call is independent
response = agent.respond(message, context=full_history)

# Stateful: Agent maintains internal state
agent.receive(message)  # Updates internal state
response = agent.respond()
```

---

## LLM-Based Architectures

### The Foundation Model as Core

Modern cognitive architectures often use LLMs as the central reasoning engine:

```
┌────────────────────────────────────────────────┐
│                    LLM CORE                    │
│                                                │
│   Prompt ──▶ [Language Model] ──▶ Response    │
│                     │                          │
│              Tool Calls, Memory Queries        │
└────────────────────────────────────────────────┘
```

### Context Window as Working Memory

The LLM's context window functions as working memory:
- Limited capacity (varies by model)
- Recency effects (recent tokens more influential)
- Requires summarization for long contexts

### Prompt Engineering as Architecture

The system prompt defines the agent's cognitive structure:

```python
COGNITIVE_PROMPT = """
You are an agent with the following cognitive architecture:

## Memory Access
- Use search_memory(query) to retrieve past experiences
- Use store_memory(content) to remember important information

## Reasoning Protocol
1. Analyze the current situation
2. Retrieve relevant memories
3. Consider available actions
4. Predict outcomes
5. Select optimal action

## Available Tools
{tool_descriptions}

## Current State
{state_summary}
"""
```

---

## Historical Architectures

| Architecture | Era | Key Innovation |
|--------------|-----|----------------|
| **GPS** | 1957 | Means-ends analysis |
| **SOAR** | 1983 | Universal subgoaling |
| **ACT-R** | 1993 | Declarative + Procedural memory |
| **CLARION** | 1997 | Implicit/Explicit knowledge |
| **ReAct** | 2022 | LLM reasoning + acting |
| **Reflexion** | 2023 | Self-reflection loops |

---

## Evaluation Criteria

### Functional Requirements
- **Task Performance**: Can it complete the intended tasks?
- **Generalization**: Does it work across domains?
- **Robustness**: Does it handle errors gracefully?

### Non-Functional Requirements
- **Latency**: Response time for decisions
- **Cost**: Compute and API expenses
- **Interpretability**: Can we understand its reasoning?

---

## Next Steps

Explore each component in detail:

1. [Memory Systems](/architecture/memory-systems) — Information storage and retrieval
2. [ReAct Pattern](/architecture/react-pattern) — Reasoning and acting
3. [Planning Engines](/architecture/planning-engines) — Multi-step planning
4. [Neuro-Symbolic](/architecture/neuro-symbolic) — Hybrid architectures
5. [Tool Use](/architecture/tool-use) — External integrations

---

## References

- Laird, J. E. (2012). *The Soar Cognitive Architecture*
- Anderson, J. R. (2007). *How Can the Human Mind Occur in the Physical Universe?*
- Sumers, T. R., et al. (2023). *Cognitive Architectures for Language Agents*
