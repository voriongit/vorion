---
sidebar_position: 5
title: Utility-Based Agents
description: Optimizing expected outcomes through utility functions
tags: [taxonomy, utility, optimization, decision-theory]
---

# Utility-Based Agents

## Optimizing Expected Outcomes Through Utility Functions

When multiple goals conflict or outcomes are uncertain, agents need a way to compare options. Utility-based agents assign **numerical values** to states and choose actions that maximize expected utility.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                   UTILITY-BASED AGENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    Environment ──▶ [SENSORS] ──▶ Current State             │
│                                        │                    │
│                         ┌──────────────┴──────────────┐     │
│                         ▼                             ▼     │
│                  ┌───────────┐                 ┌──────────┐ │
│                  │   WORLD   │                 │  UTILITY │ │
│                  │   MODEL   │                 │ FUNCTION │ │
│                  │           │                 │  U(s)    │ │
│                  └─────┬─────┘                 └────┬─────┘ │
│                        │                            │       │
│                        └──────────┬─────────────────┘       │
│                                   ▼                         │
│                         ┌─────────────────┐                 │
│                         │    MAXIMIZE     │                 │
│                         │    EXPECTED     │                 │
│                         │    UTILITY      │                 │
│                         │                 │                 │
│                         │  argmax E[U(s)] │                 │
│                         └────────┬────────┘                 │
│                                  │                          │
│                                  ▼                          │
│    Environment ◀── [ACTUATORS] ◀── Optimal Action          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Why Utility Matters

### The Problem with Binary Goals

Goals are binary: achieved or not. But real decisions involve:

| Scenario | Goal-Based View | Utility-Based View |
|----------|-----------------|-------------------|
| Two flights: cheap but long, expensive but fast | Both achieve "get there" | Compare time vs. money trade-off |
| Investment options | All aim for "profit" | Risk-adjusted expected returns |
| Treatment plans | All aim for "cure" | Quality of life, side effects, cost |

---

## Utility Theory Foundations

### Expected Utility

For uncertain outcomes, compute weighted average:

```
EU(action) = Σ P(outcome | action) × U(outcome)
```

### Axioms of Rational Preferences

Von Neumann-Morgenstern utility theory requires:

1. **Orderability**: Can compare any two states
2. **Transitivity**: If A > B and B > C, then A > C
3. **Continuity**: No infinitely good/bad outcomes
4. **Substitutability**: Preferences over lotteries are consistent
5. **Monotonicity**: Prefer higher probability of better outcomes
6. **Decomposability**: Compound lotteries can be simplified

---

## Implementation Pattern

```python
from dataclasses import dataclass
from typing import Callable
import numpy as np

@dataclass
class UtilityAgent:
    world_model: WorldModel
    utility_fn: Callable[[State], float]

    def expected_utility(self, action: Action, state: State) -> float:
        """Compute expected utility of taking action from state."""
        outcomes = self.world_model.predict_outcomes(state, action)
        return sum(
            prob * self.utility_fn(outcome_state)
            for outcome_state, prob in outcomes
        )

    def act(self, current_state: State) -> Action:
        """Select action maximizing expected utility."""
        available_actions = self.world_model.available_actions(current_state)

        utilities = {
            action: self.expected_utility(action, current_state)
            for action in available_actions
        }

        return max(utilities, key=utilities.get)
```

---

## Multi-Attribute Utility

Real decisions often involve multiple factors:

```python
class MultiAttributeUtility:
    def __init__(self, weights: dict[str, float]):
        self.weights = weights  # Sum to 1.0

    def compute(self, state: dict[str, float]) -> float:
        """
        Weighted linear combination of attributes.

        Example attributes:
        - cost: 0.3
        - speed: 0.25
        - reliability: 0.25
        - user_satisfaction: 0.2
        """
        return sum(
            self.weights[attr] * self._normalize(attr, value)
            for attr, value in state.items()
        )

    def _normalize(self, attr: str, value: float) -> float:
        """Normalize to [0, 1] range."""
        # Implementation depends on attribute scales
        pass
```

---

## LLM Implementation

LLMs can perform utility-based reasoning with structured prompts:

```python
class LLMUtilityAgent:
    def __init__(self, llm, utility_criteria: list[str]):
        self.llm = llm
        self.criteria = utility_criteria

    def evaluate_options(self, options: list[str], context: str) -> str:
        prompt = f"""
        You are a decision-making agent that maximizes utility.

        Context: {context}

        Options:
        {chr(10).join(f'{i+1}. {opt}' for i, opt in enumerate(options))}

        Evaluate each option on these criteria (1-10 scale):
        {chr(10).join(f'- {c}' for c in self.criteria)}

        For each option, provide:
        1. Score for each criterion
        2. Overall weighted utility
        3. Key trade-offs

        Recommend the option with highest expected utility.
        """

        return self.llm.generate(prompt)
```

---

## Decision Under Uncertainty

### Risk Attitudes

Utility functions encode risk preferences:

```python
def risk_neutral(value: float) -> float:
    """Linear utility - expected value maximizer."""
    return value

def risk_averse(value: float) -> float:
    """Concave utility - prefers certainty."""
    return np.sqrt(value)  # Or log(value)

def risk_seeking(value: float) -> float:
    """Convex utility - prefers gambles."""
    return value ** 2
```

### Prospect Theory

Humans don't follow expected utility theory. Kahneman & Tversky's prospect theory captures:

- **Loss aversion**: Losses hurt ~2x more than equivalent gains
- **Reference dependence**: Utility relative to reference point
- **Probability weighting**: Overweight small probabilities

---

## Applications

### 1. Resource Allocation

```python
def allocate_resources(budget: float, projects: list[Project]) -> dict:
    """Allocate budget to maximize total utility."""
    # Each project has expected return and risk
    # Utility function balances return vs. risk
    pass
```

### 2. Recommendation Systems

```python
def recommend(user_preferences: dict, items: list[Item]) -> list[Item]:
    """Rank items by expected user utility."""
    utilities = [
        compute_utility(item, user_preferences)
        for item in items
    ]
    return sorted(items, key=lambda i: utilities[items.index(i)], reverse=True)
```

### 3. Autonomous Vehicles

Trade-offs between:
- Passenger safety
- Pedestrian safety
- Trip efficiency
- Comfort

---

## Challenges

### 1. Utility Elicitation
How do we determine the correct utility function? Human preferences are:
- Context-dependent
- Inconsistent
- Hard to articulate

### 2. Computational Complexity
Computing expected utility over large state spaces is intractable.

### 3. Specification Gaming
Agents may find unexpected ways to maximize specified utility (reward hacking).

### 4. Interpersonal Utility Comparison
Comparing utility across different stakeholders raises ethical issues.

---

## Comparison with Goal-Based

| Aspect | Goal-Based | Utility-Based |
|--------|------------|---------------|
| **Output** | Achieves/doesn't | Continuous score |
| **Trade-offs** | Not explicit | Explicitly modeled |
| **Uncertainty** | Plan for expected case | Optimize over distribution |
| **Computational cost** | Lower | Higher |
| **Specification** | Easier | Harder (requires numbers) |

---

## References

- Von Neumann, J., & Morgenstern, O. (1944). *Theory of Games and Economic Behavior*
- Kahneman, D., & Tversky, A. (1979). *Prospect Theory: An Analysis of Decision under Risk*
- Russell, S., & Norvig, P. (2020). *AIMA*, Chapter 16
