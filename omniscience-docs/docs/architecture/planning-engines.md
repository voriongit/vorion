---
sidebar_position: 4
title: Planning Engines
description: Algorithms for multi-step action sequences
tags: [architecture, planning, search, algorithms]
---

# Planning Engines

## Algorithms for Multi-Step Action Sequences

Planning engines enable agents to look ahead and find sequences of actions that achieve goals. From classical AI planners to modern LLM-based approaches, planning is central to intelligent behavior.

---

## Planning Problem Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    PLANNING PROBLEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Initial State          Goal State                         │
│   ┌─────────┐            ┌─────────┐                        │
│   │ A B C   │  ──?───▶   │   C     │                        │
│   │ ─────── │            │   B     │                        │
│   │  TABLE  │            │   A     │                        │
│   └─────────┘            │ ─────── │                        │
│                          │  TABLE  │                        │
│                          └─────────┘                        │
│                                                              │
│   Actions: pick(X), place(X,Y), stack(X,Y), unstack(X,Y)    │
│                                                              │
│   Plan: unstack(C,B) → place(C,TABLE) → unstack(B,A) →     │
│         stack(B,C) → stack(A,B)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Classical Planning (STRIPS/PDDL)

### Action Representation

```python
@dataclass
class Action:
    name: str
    parameters: list[str]
    preconditions: set[str]  # Must be true to execute
    add_effects: set[str]    # Become true after execution
    del_effects: set[str]    # Become false after execution

# Example: Stack block X on block Y
stack_action = Action(
    name="stack",
    parameters=["X", "Y"],
    preconditions={"holding(X)", "clear(Y)"},
    add_effects={"on(X,Y)", "clear(X)", "hand_empty"},
    del_effects={"holding(X)", "clear(Y)"}
)
```

### Forward Search Planner

```python
def forward_search(initial: set, goal: set, actions: list[Action]) -> list[Action]:
    """Find plan using forward state-space search."""
    frontier = [(initial, [])]  # (state, plan)
    visited = {frozenset(initial)}

    while frontier:
        state, plan = frontier.pop(0)  # BFS

        # Goal check
        if goal.issubset(state):
            return plan

        # Expand applicable actions
        for action in actions:
            if action.preconditions.issubset(state):
                # Apply action
                new_state = (state - action.del_effects) | action.add_effects
                frozen = frozenset(new_state)

                if frozen not in visited:
                    visited.add(frozen)
                    frontier.append((new_state, plan + [action]))

    return None  # No plan exists
```

### Heuristic Planning (A*)

```python
def astar_planner(initial, goal, actions, heuristic):
    """A* search with domain heuristic."""
    import heapq

    frontier = [(heuristic(initial, goal), 0, initial, [])]
    visited = {frozenset(initial)}

    while frontier:
        f, g, state, plan = heapq.heappop(frontier)

        if goal.issubset(state):
            return plan

        for action in applicable_actions(state, actions):
            new_state = apply(action, state)
            new_g = g + 1
            new_h = heuristic(new_state, goal)
            new_f = new_g + new_h

            if frozenset(new_state) not in visited:
                visited.add(frozenset(new_state))
                heapq.heappush(frontier, (new_f, new_g, new_state, plan + [action]))

    return None

def goal_count_heuristic(state, goal):
    """Simple admissible heuristic: count unsatisfied goals."""
    return len(goal - state)
```

---

## Hierarchical Task Networks (HTN)

Decompose high-level tasks into subtasks:

```python
@dataclass
class Task:
    name: str
    parameters: list[str]

@dataclass
class Method:
    task: str           # What task this achieves
    preconditions: set  # When this method applies
    subtasks: list      # Sequence of subtasks (or primitive actions)

class HTNPlanner:
    def __init__(self, methods: list[Method], actions: list[Action]):
        self.methods = methods
        self.actions = actions

    def plan(self, tasks: list[Task], state: set) -> list[Action]:
        if not tasks:
            return []

        task = tasks[0]
        remaining = tasks[1:]

        # If task is primitive, execute directly
        if self._is_primitive(task):
            action = self._get_action(task)
            if action.preconditions.issubset(state):
                new_state = self._apply(action, state)
                rest_plan = self.plan(remaining, new_state)
                if rest_plan is not None:
                    return [action] + rest_plan

        # Otherwise, find applicable method
        for method in self._get_methods(task):
            if method.preconditions.issubset(state):
                expanded = method.subtasks + remaining
                plan = self.plan(expanded, state)
                if plan is not None:
                    return plan

        return None  # No plan found
```

### HTN Example

```python
# High-level task
travel_task = Task("travel", ["from", "to"])

# Methods for travel
methods = [
    Method(
        task="travel",
        preconditions={"have_car"},
        subtasks=[Task("drive", ["from", "to"])]
    ),
    Method(
        task="travel",
        preconditions={"near_airport(from)", "near_airport(to)"},
        subtasks=[
            Task("go_to_airport", ["from"]),
            Task("fly", ["from", "to"]),
            Task("leave_airport", ["to"])
        ]
    )
]
```

---

## LLM-Based Planning

### Direct Plan Generation

```python
class LLMPlanner:
    def __init__(self, llm):
        self.llm = llm

    def plan(self, task: str, available_actions: list[str]) -> list[str]:
        prompt = f"""
        You are a planning agent.

        Task: {task}

        Available actions:
        {chr(10).join(f'- {a}' for a in available_actions)}

        Generate a step-by-step plan to accomplish this task.
        Each step should be a single action from the available actions.
        Format as a numbered list.
        """

        response = self.llm.generate(prompt)
        return self._parse_plan(response)
```

### Plan-and-Execute Pattern

```python
class PlanAndExecuteAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
        self.plan = []
        self.current_step = 0

    def generate_plan(self, task: str) -> list[str]:
        prompt = f"""
        Create a detailed plan for: {task}

        Available tools: {list(self.tools.keys())}

        Output a numbered list of steps.
        Each step should be specific and actionable.
        """
        response = self.llm.generate(prompt)
        self.plan = self._parse_plan(response)
        return self.plan

    def execute_plan(self) -> str:
        results = []

        while self.current_step < len(self.plan):
            step = self.plan[self.current_step]

            # Execute step
            result = self._execute_step(step)
            results.append(result)

            # Check if replanning needed
            if self._needs_replan(step, result):
                remaining_task = self._summarize_remaining(self.plan[self.current_step:])
                new_plan = self.generate_plan(remaining_task)
                self.plan = self.plan[:self.current_step] + new_plan
            else:
                self.current_step += 1

        return self._synthesize_result(results)
```

---

## Monte Carlo Tree Search (MCTS)

For planning in large or uncertain spaces:

```python
class MCTSPlanner:
    def __init__(self, simulator, llm, exploration=1.4):
        self.simulator = simulator
        self.llm = llm
        self.c = exploration

    def plan(self, state, goal, iterations=1000):
        root = Node(state=state)

        for _ in range(iterations):
            # 1. Selection: traverse tree using UCB
            node = self.select(root)

            # 2. Expansion: add new child
            if not node.is_terminal():
                node = self.expand(node)

            # 3. Simulation: rollout to estimate value
            value = self.simulate(node.state, goal)

            # 4. Backpropagation: update statistics
            self.backpropagate(node, value)

        # Return best action from root
        return self.best_action(root)

    def select(self, node):
        while node.children and not node.is_terminal():
            node = max(node.children, key=self.ucb)
        return node

    def ucb(self, node):
        if node.visits == 0:
            return float('inf')
        exploitation = node.value / node.visits
        exploration = self.c * math.sqrt(math.log(node.parent.visits) / node.visits)
        return exploitation + exploration
```

---

## Comparison of Approaches

| Approach | Strengths | Weaknesses | Best For |
|----------|-----------|------------|----------|
| **Classical (STRIPS)** | Optimal, complete | Scalability | Small, well-defined domains |
| **HTN** | Natural hierarchy | Requires domain knowledge | Complex, decomposable tasks |
| **LLM Direct** | Flexible, natural language | May miss edge cases | Simple, familiar tasks |
| **MCTS** | Handles uncertainty | Computationally expensive | Games, large state spaces |

---

## Hybrid Approaches

### LLM + Classical Planner

```python
class HybridPlanner:
    def __init__(self, llm, classical_planner):
        self.llm = llm
        self.planner = classical_planner

    def plan(self, natural_language_task: str) -> list[Action]:
        # 1. LLM translates to formal specification
        formal_spec = self.llm.generate(f"""
            Convert this task to a planning problem:
            Task: {natural_language_task}

            Output:
            Initial state: [facts]
            Goal state: [facts]
        """)

        initial, goal = self._parse_spec(formal_spec)

        # 2. Classical planner finds optimal plan
        plan = self.planner.plan(initial, goal)

        # 3. LLM explains plan in natural language
        explanation = self.llm.generate(f"""
            Explain this plan in plain English:
            {[str(a) for a in plan]}
        """)

        return plan, explanation
```

---

## Best Practices

### 1. Validate Plans Before Execution
Check that preconditions are satisfiable.

### 2. Support Replanning
Plans often fail; be ready to replan.

### 3. Use Appropriate Abstraction
Match planning granularity to problem.

### 4. Consider Uncertainty
Real environments are stochastic.

---

## References

- Ghallab, M., Nau, D., & Traverso, P. (2016). *Automated Planning and Acting*
- Russell, S., & Norvig, P. (2020). *AIMA*, Chapters 10-11
- Browne, C., et al. (2012). *A Survey of Monte Carlo Tree Search Methods*
- Wang, L., et al. (2023). *Plan-and-Solve Prompting*
