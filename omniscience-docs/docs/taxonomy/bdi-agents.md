---
sidebar_position: 6
title: BDI Agents
description: Belief-Desire-Intention cognitive architecture
tags: [taxonomy, cognitive, bdi, intentions]
---

# BDI Agents

## Belief-Desire-Intention Cognitive Architecture

BDI (Belief-Desire-Intention) agents model human-like practical reasoning. They maintain explicit representations of what they believe, what they want, and what they've committed to doing.

---

## The BDI Framework

```
┌─────────────────────────────────────────────────────────────┐
│                       BDI AGENT                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │   BELIEFS   │  │   DESIRES   │  │ INTENTIONS  │        │
│   │             │  │             │  │             │        │
│   │  What the   │  │  What the   │  │  What the   │        │
│   │  agent      │  │  agent      │  │  agent is   │        │
│   │  believes   │  │  wants      │  │  committed  │        │
│   │  true       │  │             │  │  to doing   │        │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│          │                │                │                │
│          └────────────────┼────────────────┘                │
│                           ▼                                 │
│                  ┌─────────────────┐                        │
│                  │   PRACTICAL     │                        │
│                  │   REASONING     │                        │
│                  │                 │                        │
│                  │  Deliberation   │                        │
│                  │  Means-Ends     │                        │
│                  │  Reasoning      │                        │
│                  └────────┬────────┘                        │
│                           │                                 │
│                           ▼                                 │
│                      [ACTIONS]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## The Three Components

### Beliefs (B)
The agent's **informational state** about the world:

```python
@dataclass
class BeliefBase:
    facts: dict[str, Any]           # Known facts
    uncertainties: dict[str, float]  # Probabilistic beliefs
    revision_history: list[Revision] # How beliefs changed

    def update(self, percept: Percept) -> None:
        """Belief revision based on new information."""
        pass

    def query(self, proposition: str) -> bool | float:
        """Query current beliefs."""
        pass
```

### Desires (D)
The agent's **motivational state** — what it wants to achieve:

```python
@dataclass
class Desire:
    goal: str
    priority: float
    conditions: list[str]  # When this desire is active

@dataclass
class DesireSet:
    desires: list[Desire]

    def active_desires(self, beliefs: BeliefBase) -> list[Desire]:
        """Return desires whose conditions are satisfied."""
        return [d for d in self.desires
                if all(beliefs.query(c) for c in d.conditions)]
```

### Intentions (I)
The agent's **deliberative state** — committed plans:

```python
@dataclass
class Intention:
    goal: Desire
    plan: list[Action]
    status: Literal["active", "suspended", "completed", "failed"]

@dataclass
class IntentionStack:
    intentions: list[Intention]

    def current_intention(self) -> Intention | None:
        """Return the top active intention."""
        for intention in self.intentions:
            if intention.status == "active":
                return intention
        return None
```

---

## The BDI Control Loop

```python
class BDIAgent:
    def __init__(self):
        self.beliefs = BeliefBase()
        self.desires = DesireSet()
        self.intentions = IntentionStack()
        self.plan_library = PlanLibrary()

    def run(self):
        while True:
            # 1. Observe environment
            percept = self.perceive()

            # 2. Update beliefs
            self.beliefs.update(percept)

            # 3. Deliberate: select intention
            options = self.generate_options()
            intention = self.filter(options)

            if intention:
                self.intentions.add(intention)

            # 4. Execute current plan
            current = self.intentions.current_intention()
            if current:
                action = current.plan.next_action()
                self.execute(action)

                # Check if intention succeeded or failed
                self.update_intention_status(current)

    def generate_options(self) -> list[Intention]:
        """Generate possible intentions from active desires."""
        options = []
        for desire in self.desires.active_desires(self.beliefs):
            plans = self.plan_library.find_plans(desire, self.beliefs)
            for plan in plans:
                options.append(Intention(goal=desire, plan=plan, status="active"))
        return options

    def filter(self, options: list[Intention]) -> Intention | None:
        """Select best intention considering current commitments."""
        # Don't adopt intentions that conflict with current ones
        compatible = [o for o in options
                     if not self.conflicts_with_current(o)]

        if not compatible:
            return None

        # Select highest priority
        return max(compatible, key=lambda i: i.goal.priority)
```

---

## Commitment Strategies

How strongly should agents stick to their intentions?

### Blind Commitment
Never drop an intention until achieved or impossible:
```python
def should_reconsider(self, intention: Intention) -> bool:
    return False  # Never reconsider
```

### Single-Minded Commitment
Drop intention only if achieved or believed impossible:
```python
def should_reconsider(self, intention: Intention) -> bool:
    return (self.believes_achieved(intention) or
            self.believes_impossible(intention))
```

### Open-Minded Commitment
Reconsider when the motivating desire is no longer active:
```python
def should_reconsider(self, intention: Intention) -> bool:
    return intention.goal not in self.desires.active_desires(self.beliefs)
```

---

## LLM Implementation

```python
class LLMBDIAgent:
    def __init__(self, llm):
        self.llm = llm
        self.beliefs = {}
        self.desires = []
        self.current_intention = None

    def deliberate(self, percept: str) -> str:
        prompt = f"""
        You are a BDI agent with human-like reasoning.

        CURRENT BELIEFS:
        {json.dumps(self.beliefs, indent=2)}

        DESIRES (in priority order):
        {chr(10).join(f'{i+1}. {d}' for i, d in enumerate(self.desires))}

        CURRENT INTENTION:
        {self.current_intention or "None"}

        NEW PERCEPTION:
        {percept}

        Perform BDI reasoning:

        1. BELIEF UPDATE: What beliefs should change based on this perception?

        2. DESIRE ACTIVATION: Which desires are now relevant?

        3. INTENTION SELECTION: Should you:
           - Continue current intention?
           - Adopt a new intention?
           - Drop current intention?

        4. ACTION: What is the next action to take?

        Respond with structured JSON.
        """

        return self.llm.generate(prompt)
```

---

## Plan Library

BDI agents use pre-defined plan templates:

```python
@dataclass
class Plan:
    name: str
    trigger: str          # Goal this plan achieves
    context: list[str]    # Beliefs required to use this plan
    body: list[Action]    # Steps to execute

class PlanLibrary:
    plans: list[Plan]

    def find_plans(self, desire: Desire, beliefs: BeliefBase) -> list[Plan]:
        """Find applicable plans for a desire."""
        applicable = []
        for plan in self.plans:
            if plan.trigger == desire.goal:
                if all(beliefs.query(c) for c in plan.context):
                    applicable.append(plan)
        return applicable
```

---

## Example: Travel Agent

```python
# Beliefs
beliefs = {
    "destination": "Paris",
    "budget": 2000,
    "flight_booked": False,
    "hotel_booked": False,
    "dates": ("2025-06-01", "2025-06-07")
}

# Desires
desires = [
    Desire("plan_trip", priority=1.0, conditions=["destination"]),
    Desire("minimize_cost", priority=0.8, conditions=["budget"]),
    Desire("ensure_comfort", priority=0.6, conditions=[])
]

# Plan Library
plans = [
    Plan(
        name="book_flight_first",
        trigger="plan_trip",
        context=["not flight_booked"],
        body=[
            SearchFlights(),
            CompareOptions(),
            BookCheapest()
        ]
    ),
    Plan(
        name="book_hotel_after_flight",
        trigger="plan_trip",
        context=["flight_booked", "not hotel_booked"],
        body=[
            SearchHotels(),
            FilterByRating(),
            BookBestValue()
        ]
    )
]
```

---

## Advantages of BDI

1. **Explainability**: Can articulate why decisions were made
2. **Commitment Balance**: Neither too stubborn nor too flighty
3. **Modularity**: Beliefs, desires, and plans are separate
4. **Human-Like**: Matches folk psychology concepts

---

## Challenges

### 1. Plan Library Engineering
Creating comprehensive plan libraries is labor-intensive.

### 2. Belief Revision Complexity
Maintaining consistent beliefs under contradictory information.

### 3. Intention Reconsideration
When to reconsider is a meta-level decision problem.

### 4. Desire Conflicts
Prioritizing among competing desires requires utility-like reasoning.

---

## BDI Implementations

| System | Language | Domain |
|--------|----------|--------|
| **AgentSpeak/Jason** | Java | General-purpose |
| **JACK** | Java | Commercial agents |
| **Jadex** | Java | BDI + components |
| **2APL** | Prolog-like | Research |
| **LangChain BDI** | Python | LLM-based |

---

## References

- Rao, A. S., & Georgeff, M. P. (1995). *BDI Agents: From Theory to Practice*
- Bratman, M. E. (1987). *Intention, Plans, and Practical Reason*
- Bordini, R. H., et al. (2007). *Programming Multi-Agent Systems in AgentSpeak using Jason*
- Wooldridge, M. (2009). *An Introduction to MultiAgent Systems*, Chapter 5
