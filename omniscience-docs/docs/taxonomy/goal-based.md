---
sidebar_position: 4
title: Goal-Based Agents
description: Planning and search for multi-step objectives
tags: [taxonomy, planning, goals, search]
---

# Goal-Based Agents

## Planning and Search for Multi-Step Objectives

When condition-action rules aren't enough, agents need **goals**. Goal-based agents represent desired end states and use planning algorithms to find action sequences that achieve them.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    GOAL-BASED AGENT                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    Environment ──▶ [SENSORS] ──▶ Current State             │
│                                        │                    │
│                         ┌──────────────┴──────────────┐     │
│                         ▼                             ▼     │
│                  ┌───────────┐                 ┌──────────┐ │
│                  │   WORLD   │                 │   GOAL   │ │
│                  │   MODEL   │                 │  STATE   │ │
│                  └─────┬─────┘                 └────┬─────┘ │
│                        │                            │       │
│                        └──────────┬─────────────────┘       │
│                                   ▼                         │
│                         ┌─────────────────┐                 │
│                         │    PLANNING     │                 │
│                         │    ENGINE       │                 │
│                         │                 │                 │
│                         │  Search for     │                 │
│                         │  action sequence│                 │
│                         └────────┬────────┘                 │
│                                  │                          │
│                                  ▼                          │
│    Environment ◀── [ACTUATORS] ◀── Action Plan             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Differences from Reflex Agents

| Aspect | Reflex Agent | Goal-Based Agent |
|--------|--------------|------------------|
| **Decision basis** | Current percept | Future state |
| **Computation** | O(n) rule matching | Search over states |
| **Flexibility** | Fixed responses | Same goal, different plans |
| **Optimality** | Local | Can be global |

---

## Planning Approaches

### 1. Classical Planning (STRIPS-style)

Represents actions with preconditions and effects:

```python
@dataclass
class Action:
    name: str
    preconditions: set[str]
    add_effects: set[str]
    delete_effects: set[str]

def can_apply(action: Action, state: set[str]) -> bool:
    return action.preconditions.issubset(state)

def apply(action: Action, state: set[str]) -> set[str]:
    return (state - action.delete_effects) | action.add_effects
```

### 2. Forward Search

Start from initial state, search toward goal:

```python
def forward_search(initial, goal, actions):
    frontier = [([initial], [])]  # (states, plan)
    visited = {frozenset(initial)}

    while frontier:
        states, plan = frontier.pop(0)
        current = states[-1]

        if goal.issubset(current):
            return plan

        for action in actions:
            if can_apply(action, current):
                new_state = apply(action, current)
                if frozenset(new_state) not in visited:
                    visited.add(frozenset(new_state))
                    frontier.append((states + [new_state], plan + [action]))

    return None  # No plan found
```

### 3. Backward Search (Regression)

Start from goal, work backward to find required actions.

### 4. Heuristic Search (A*)

Use domain heuristics to guide search efficiently.

---

## LLM Implementation

Modern LLMs can perform goal-based reasoning through prompting:

```python
class LLMGoalBasedAgent:
    def __init__(self, llm):
        self.llm = llm

    def plan(self, current_state: str, goal: str) -> list[str]:
        prompt = f"""
        You are a planning agent.

        Current state: {current_state}
        Goal: {goal}

        Generate a step-by-step plan to achieve the goal.
        Consider:
        1. What actions are available?
        2. What preconditions must be met?
        3. What is the optimal sequence?

        Output as a numbered list of actions.
        """

        response = self.llm.generate(prompt)
        return self._parse_plan(response)

    def replan(self, original_plan: list, failure_point: int,
               current_state: str, goal: str) -> list[str]:
        """Replan when execution fails."""
        prompt = f"""
        Original plan failed at step {failure_point}.
        Current state: {current_state}
        Goal: {goal}

        Generate a new plan from current state.
        """
        return self._parse_plan(self.llm.generate(prompt))
```

---

## ReAct Pattern

The ReAct (Reasoning + Acting) pattern combines planning with execution:

```python
class ReActAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools

    def solve(self, goal: str, max_steps: int = 10) -> str:
        trajectory = []

        for step in range(max_steps):
            # Reason about next action
            thought = self.llm.generate(f"""
                Goal: {goal}
                History: {trajectory}

                Think: What should I do next?
            """)

            # Decide action
            action = self.llm.generate(f"""
                Based on thought: {thought}
                Available tools: {list(self.tools.keys())}

                Action: [tool_name](arguments)
            """)

            # Execute and observe
            tool, args = self._parse_action(action)
            observation = self.tools[tool](*args)

            trajectory.append({
                "thought": thought,
                "action": action,
                "observation": observation
            })

            if self._goal_achieved(observation, goal):
                return observation

        return "Goal not achieved within step limit"
```

---

## Goal Types

### 1. Achievement Goals
Reach a specific state once.
- "Book a flight to NYC"
- "Deploy the application"

### 2. Maintenance Goals
Keep a condition true over time.
- "Keep the server running"
- "Maintain inventory above threshold"

### 3. Avoidance Goals
Prevent certain states.
- "Never exceed budget"
- "Don't expose sensitive data"

---

## Challenges

### 1. Goal Specification
Translating human intent into formal goal representations.

### 2. Plan Execution Monitoring
Detecting when plans fail and replanning is needed.

### 3. Computational Complexity
Classical planning is PSPACE-complete in general.

### 4. Incomplete Information
Planning under uncertainty requires probabilistic approaches.

---

## When to Use

**Good fit:**
- Multi-step tasks with clear end states
- Problems where different paths can reach the same goal
- Situations requiring flexibility in approach

**Poor fit:**
- Real-time reactive systems
- Continuous control problems
- When goals can't be clearly specified

---

## References

- Ghallab, M., Nau, D., & Traverso, P. (2004). *Automated Planning: Theory and Practice*
- Russell, S., & Norvig, P. (2020). *AIMA*, Chapter 11
- Yao, S., et al. (2023). *ReAct: Synergizing Reasoning and Acting in Language Models*
