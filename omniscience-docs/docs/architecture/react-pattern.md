---
sidebar_position: 3
title: ReAct Pattern
description: Synergizing reasoning and acting in language agents
tags: [architecture, react, reasoning, action]
---

# ReAct Pattern

## Synergizing Reasoning and Acting in Language Agents

ReAct (Reasoning + Acting) is a foundational pattern for LLM agents. It interleaves thinking with doing, allowing agents to reason about observations and plan next steps dynamically.

---

## The Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      ReAct LOOP                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│    │ THOUGHT  │───▶│  ACTION  │───▶│OBSERVATION│───┐        │
│    └──────────┘    └──────────┘    └──────────┘   │        │
│         ▲                                          │        │
│         └──────────────────────────────────────────┘        │
│                                                              │
│    Repeat until task is complete or max steps reached       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **Thought**: The agent reasons about the current situation
2. **Action**: The agent selects and executes an action
3. **Observation**: The agent receives feedback from the environment
4. **Loop**: Continue until goal is achieved

---

## Basic Implementation

```python
class ReActAgent:
    def __init__(self, llm, tools: dict[str, Callable]):
        self.llm = llm
        self.tools = tools

    def run(self, task: str, max_steps: int = 10) -> str:
        trajectory = []

        for step in range(max_steps):
            # Generate thought and action
            prompt = self._build_prompt(task, trajectory)
            response = self.llm.generate(prompt)

            # Parse response
            thought, action = self._parse_response(response)
            trajectory.append({"thought": thought, "action": action})

            # Check for finish
            if action.startswith("finish:"):
                return action.replace("finish:", "").strip()

            # Execute action
            tool_name, args = self._parse_action(action)
            if tool_name in self.tools:
                observation = self.tools[tool_name](*args)
            else:
                observation = f"Error: Unknown tool {tool_name}"

            trajectory.append({"observation": observation})

        return "Max steps reached without completing task"

    def _build_prompt(self, task: str, trajectory: list) -> str:
        prompt = f"""
You are an agent that solves tasks by thinking and acting.

Available tools:
{self._format_tools()}

Task: {task}

"""
        for item in trajectory:
            if "thought" in item:
                prompt += f"Thought: {item['thought']}\n"
                prompt += f"Action: {item['action']}\n"
            elif "observation" in item:
                prompt += f"Observation: {item['observation']}\n"

        prompt += """
Think about what to do next, then take an action.
Format:
Thought: [your reasoning]
Action: [tool_name(arg1, arg2)] or finish: [final answer]
"""
        return prompt
```

---

## Trace Example

**Task**: What is the population of the capital of France?

```
Thought: I need to find the capital of France first, then look up its population.
Action: search("capital of France")
Observation: Paris is the capital of France.

Thought: Now I know Paris is the capital. I need to find its population.
Action: search("population of Paris")
Observation: Paris has a population of approximately 2.1 million in the city proper.

Thought: I have the answer. Paris is the capital of France with a population of about 2.1 million.
Action: finish: The capital of France is Paris, which has a population of approximately 2.1 million.
```

---

## Why ReAct Works

### Reasoning Without Action (Chain-of-Thought)
```
Problem: Just thinking, no environment interaction
- Cannot verify facts
- Cannot update based on new information
- Prone to hallucination
```

### Action Without Reasoning (Direct Acting)
```
Problem: Random action selection
- No strategic planning
- Inefficient exploration
- Cannot adapt to failures
```

### ReAct: Best of Both
```
Benefits:
- Grounded reasoning (thoughts informed by observations)
- Strategic action (actions informed by reasoning)
- Adaptive behavior (can recover from failures)
- Interpretable traces (we can see why decisions were made)
```

---

## Variants and Extensions

### ReAct with Self-Reflection

```python
class ReflectiveReActAgent(ReActAgent):
    def run(self, task: str, max_attempts: int = 3) -> str:
        for attempt in range(max_attempts):
            result = super().run(task)

            # Self-evaluate
            evaluation = self.llm.generate(f"""
                Task: {task}
                Your answer: {result}

                Evaluate your answer:
                1. Is it correct?
                2. Is it complete?
                3. What could be improved?

                Rate confidence (1-10):
            """)

            if self._extract_confidence(evaluation) >= 8:
                return result

            # Reflect and retry
            self.memory.add_reflection(evaluation)

        return result
```

### ReAct with Planning

```python
class PlanningReActAgent(ReActAgent):
    def run(self, task: str) -> str:
        # First, create a high-level plan
        plan = self.llm.generate(f"""
            Task: {task}

            Create a step-by-step plan to solve this task.
            List 3-5 high-level steps.
        """)

        # Execute each step with ReAct
        results = []
        for step in self._parse_plan(plan):
            step_result = super().run(step)
            results.append(step_result)

        # Synthesize final answer
        return self.llm.generate(f"""
            Task: {task}
            Step results: {results}

            Synthesize a final answer.
        """)
```

### ReAct with Memory

```python
class MemoryReActAgent(ReActAgent):
    def __init__(self, llm, tools, memory):
        super().__init__(llm, tools)
        self.memory = memory

    def _build_prompt(self, task: str, trajectory: list) -> str:
        # Retrieve relevant past experiences
        relevant_memories = self.memory.retrieve(task, k=3)

        prompt = super()._build_prompt(task, trajectory)
        prompt = f"""
Relevant past experiences:
{self._format_memories(relevant_memories)}

""" + prompt

        return prompt

    def run(self, task: str) -> str:
        result = super().run(task)

        # Store this experience
        self.memory.store({
            "task": task,
            "result": result,
            "trajectory": self.last_trajectory
        })

        return result
```

---

## Tool Design for ReAct

### Good Tool Design

```python
# Clear, atomic tools
tools = {
    "search": lambda q: web_search(q),
    "calculate": lambda expr: eval_math(expr),
    "read_file": lambda path: read_file(path),
    "write_file": lambda path, content: write_file(path, content)
}
```

### Tool Documentation

```python
TOOL_DESCRIPTIONS = """
Available tools:

search(query: str) -> str
    Search the web for information.
    Example: search("Python list comprehension syntax")

calculate(expression: str) -> float
    Evaluate a mathematical expression.
    Example: calculate("(2 + 3) * 4")

read_file(path: str) -> str
    Read contents of a file.
    Example: read_file("data.json")
"""
```

---

## Error Handling

```python
class RobustReActAgent(ReActAgent):
    def run(self, task: str, max_steps: int = 10) -> str:
        trajectory = []
        consecutive_errors = 0

        for step in range(max_steps):
            try:
                response = self.llm.generate(self._build_prompt(task, trajectory))
                thought, action = self._parse_response(response)

                # Execute action
                tool_name, args = self._parse_action(action)
                observation = self.tools[tool_name](*args)
                consecutive_errors = 0

            except ToolError as e:
                observation = f"Error: {e}. Try a different approach."
                consecutive_errors += 1

                if consecutive_errors >= 3:
                    # Agent is stuck, provide guidance
                    observation += "\nHint: Consider using a different tool or breaking down the problem."

            except ParseError:
                observation = "Could not parse your response. Please use the format: Thought: ... Action: ..."

            trajectory.append({
                "thought": thought if 'thought' in locals() else "Parse error",
                "action": action if 'action' in locals() else "None",
                "observation": observation
            })

        return self._synthesize_answer(trajectory)
```

---

## Comparison with Other Patterns

| Pattern | Reasoning | Action | Memory | Use Case |
|---------|-----------|--------|--------|----------|
| **ReAct** | Explicit | Tool calls | Short-term | General tasks |
| **CoT** | Explicit | None | In-context | Math, logic |
| **Reflexion** | Explicit + Reflection | Tool calls | Long-term | Learning from mistakes |
| **LATS** | Explicit | Tree search | Tree | Complex planning |

---

## Best Practices

### 1. Clear Tool Boundaries
Each tool should do one thing well.

### 2. Informative Observations
Tool outputs should give enough context for next reasoning step.

### 3. Step Limits
Prevent infinite loops with maximum step counts.

### 4. Error Recovery
Design for graceful handling of tool failures.

### 5. Trajectory Logging
Store full traces for debugging and improvement.

---

## References

- Yao, S., et al. (2023). *ReAct: Synergizing Reasoning and Acting in Language Models*
- Wei, J., et al. (2022). *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*
- Shinn, N., et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*
