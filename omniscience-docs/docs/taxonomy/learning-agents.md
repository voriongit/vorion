---
sidebar_position: 7
title: Learning Agents
description: Self-improvement through experience and feedback
tags: [taxonomy, learning, adaptation, rl]
---

# Learning Agents

## Self-Improvement Through Experience and Feedback

Learning agents improve their performance over time. Rather than relying solely on pre-programmed knowledge, they acquire new capabilities through experience, feedback, and exploration.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LEARNING AGENT                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    CRITIC                            │   │
│   │         Evaluates performance against standard       │   │
│   │                        │                             │   │
│   │                        ▼                             │   │
│   │                   [Feedback]                         │   │
│   └───────────────────────┬─────────────────────────────┘   │
│                           │                                 │
│   ┌───────────────────────▼─────────────────────────────┐   │
│   │               LEARNING ELEMENT                       │   │
│   │         Modifies performance element                 │   │
│   └───────────────────────┬─────────────────────────────┘   │
│                           │                                 │
│   ┌───────────────────────▼─────────────────────────────┐   │
│   │             PERFORMANCE ELEMENT                      │   │
│   │         Selects actions based on percepts            │   │
│   │                        │                             │   │
│   │    Environment ◀── [Actions] ──▶ Environment        │   │
│   └───────────────────────┬─────────────────────────────┘   │
│                           │                                 │
│   ┌───────────────────────▼─────────────────────────────┐   │
│   │             PROBLEM GENERATOR                        │   │
│   │         Suggests exploratory actions                 │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Performance Element
The decision-making component (could be any of the previous agent types):

```python
class PerformanceElement:
    def __init__(self, policy):
        self.policy = policy  # Learned or initial policy

    def select_action(self, state) -> Action:
        return self.policy(state)
```

### 2. Critic
Evaluates how well the agent is doing:

```python
class Critic:
    def __init__(self, performance_standard):
        self.standard = performance_standard

    def evaluate(self, state, action, outcome) -> float:
        """Return reward signal based on performance standard."""
        expected = self.standard(state, action)
        actual = outcome
        return self.reward_function(expected, actual)
```

### 3. Learning Element
Updates the performance element based on feedback:

```python
class LearningElement:
    def update(self, experience: Experience, feedback: float):
        """Modify the performance element."""
        # Could be:
        # - Update Q-values (RL)
        # - Adjust neural network weights
        # - Modify rules or plans
        # - Fine-tune LLM
        pass
```

### 4. Problem Generator
Suggests actions to explore and improve:

```python
class ProblemGenerator:
    def suggest_exploration(self, current_knowledge) -> Action:
        """Propose actions that might lead to learning."""
        # Exploration strategies:
        # - Random actions (ε-greedy)
        # - Uncertainty-based (UCB)
        # - Curiosity-driven
        pass
```

---

## Learning Paradigms

### Reinforcement Learning

Learn from reward signals through trial and error:

```python
class QLearningAgent:
    def __init__(self, actions, alpha=0.1, gamma=0.99, epsilon=0.1):
        self.Q = defaultdict(lambda: defaultdict(float))
        self.alpha = alpha    # Learning rate
        self.gamma = gamma    # Discount factor
        self.epsilon = epsilon  # Exploration rate

    def select_action(self, state) -> Action:
        if random.random() < self.epsilon:
            return random.choice(self.actions)  # Explore
        return max(self.actions, key=lambda a: self.Q[state][a])  # Exploit

    def learn(self, state, action, reward, next_state):
        """Q-learning update."""
        best_next = max(self.Q[next_state].values(), default=0)
        td_target = reward + self.gamma * best_next
        td_error = td_target - self.Q[state][action]
        self.Q[state][action] += self.alpha * td_error
```

### Supervised Learning

Learn from labeled examples:

```python
class SupervisedLearningAgent:
    def __init__(self, model):
        self.model = model
        self.experience_buffer = []

    def collect_demonstration(self, state, expert_action):
        """Learn from expert demonstrations."""
        self.experience_buffer.append((state, expert_action))

    def train(self):
        """Update model from collected experience."""
        X = [exp[0] for exp in self.experience_buffer]
        y = [exp[1] for exp in self.experience_buffer]
        self.model.fit(X, y)
```

### Self-Supervised Learning

Learn from the structure of data itself:

```python
class SelfSupervisedAgent:
    def __init__(self, llm):
        self.llm = llm

    def learn_from_interaction(self, trajectory: list[Interaction]):
        """Learn patterns from interaction history."""
        # Generate self-training signal
        for interaction in trajectory:
            # Predict next state from current
            # Compare with actual outcome
            # Update internal model
            pass
```

---

## LLM Learning Mechanisms

### In-Context Learning

LLMs learn from examples in the prompt:

```python
class InContextLearner:
    def __init__(self, llm):
        self.llm = llm
        self.examples = []

    def add_example(self, input_text: str, output_text: str):
        self.examples.append({"input": input_text, "output": output_text})

    def predict(self, new_input: str) -> str:
        prompt = "Learn from these examples:\n\n"
        for ex in self.examples:
            prompt += f"Input: {ex['input']}\nOutput: {ex['output']}\n\n"
        prompt += f"Now apply the pattern:\nInput: {new_input}\nOutput:"

        return self.llm.generate(prompt)
```

### RLHF (Reinforcement Learning from Human Feedback)

```python
class RLHFAgent:
    def __init__(self, base_model, reward_model):
        self.policy = base_model
        self.reward_model = reward_model

    def generate_and_learn(self, prompt: str, human_feedback: int):
        """
        1. Generate response
        2. Get human rating
        3. Update reward model
        4. Fine-tune policy via PPO
        """
        response = self.policy.generate(prompt)

        # Update reward model with human preference
        self.reward_model.update(prompt, response, human_feedback)

        # Policy optimization step
        self.optimize_policy(prompt, response)
```

### Reflection and Self-Critique

```python
class ReflectiveAgent:
    def __init__(self, llm):
        self.llm = llm
        self.memory = []

    def act_and_reflect(self, task: str) -> str:
        # Initial attempt
        response = self.llm.generate(f"Complete this task: {task}")

        # Self-critique
        critique = self.llm.generate(f"""
            Task: {task}
            Your response: {response}

            Critique this response:
            1. What worked well?
            2. What could be improved?
            3. What mistakes were made?
        """)

        # Refined attempt
        refined = self.llm.generate(f"""
            Task: {task}
            Initial attempt: {response}
            Self-critique: {critique}

            Now provide an improved response:
        """)

        # Store for future learning
        self.memory.append({
            "task": task,
            "initial": response,
            "critique": critique,
            "refined": refined
        })

        return refined
```

---

## Exploration vs Exploitation

The fundamental trade-off in learning:

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **ε-greedy** | Random action with probability ε | Simple, general |
| **UCB** | Optimism under uncertainty | When you can estimate uncertainty |
| **Thompson Sampling** | Sample from posterior | Bayesian approaches |
| **Curiosity-Driven** | Seek novel states | Sparse rewards |

```python
def epsilon_greedy(Q, state, actions, epsilon=0.1):
    if random.random() < epsilon:
        return random.choice(actions)
    return max(actions, key=lambda a: Q[state][a])

def ucb(Q, N, state, actions, c=2.0):
    """Upper Confidence Bound."""
    total_n = sum(N[state].values())
    ucb_values = {
        a: Q[state][a] + c * math.sqrt(math.log(total_n + 1) / (N[state][a] + 1))
        for a in actions
    }
    return max(ucb_values, key=ucb_values.get)
```

---

## Types of Learning Agents

| Type | Learning Signal | Example |
|------|-----------------|---------|
| **Model-Free RL** | Reward | Game-playing agents |
| **Model-Based RL** | World transitions + Reward | Robotics |
| **Imitation Learning** | Expert demonstrations | Autonomous driving |
| **Meta-Learning** | Performance on distributions | Few-shot adaptation |
| **Continual Learning** | Stream of tasks | Long-running agents |

---

## Challenges

### 1. Sample Efficiency
Learning can require many interactions with the environment.

### 2. Credit Assignment
Which actions were responsible for eventual rewards?

### 3. Catastrophic Forgetting
Learning new skills can degrade old ones.

### 4. Reward Hacking
Agents may find unintended ways to maximize reward.

### 5. Distribution Shift
Performance degrades when environment changes.

---

## Safety in Learning Agents

```python
class SafeLearningAgent:
    def __init__(self, agent, safety_constraints):
        self.agent = agent
        self.constraints = safety_constraints

    def select_action(self, state) -> Action:
        proposed = self.agent.select_action(state)

        if self.is_safe(state, proposed):
            return proposed
        else:
            return self.find_safe_alternative(state)

    def is_safe(self, state, action) -> bool:
        """Check if action satisfies safety constraints."""
        return all(c.check(state, action) for c in self.constraints)
```

---

## References

- Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An Introduction* (2nd ed.)
- Russell, S., & Norvig, P. (2020). *AIMA*, Chapter 22
- Ouyang, L., et al. (2022). *Training language models to follow instructions with human feedback*
- Shinn, N., et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*
