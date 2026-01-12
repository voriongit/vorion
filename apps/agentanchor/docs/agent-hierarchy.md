# Agent Hierarchy Architecture

**Version:** 1.0
**Date:** 2025-12-13
**Status:** Active

---

## Overview

The A3I platform uses a 5-tier agent hierarchy where each level is built with three core components:
- **Knowledge** - What the entity knows
- **Memory** - What the entity remembers
- **Abilities** - What the entity can do

---

## The 5-Tier Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ╔═══════════════════════════════════════════════════════════════════╗    │
│   ║  TIER 0: HITL (Human-In-The-Loop)                                 ║    │
│   ║  Ultimate authority • Ethics & safety decisions • Human oversight ║    │
│   ╚═══════════════════════════════════════════════════════════════════╝    │
│                                    │                                        │
│                                    ▼                                        │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │  TIER 1: ORCHS (Orchestrators)                                    │    │
│   │  Multi-agent workflow coordination • Resource allocation          │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │  TIER 2: METAGOATS (Meta-level Agents)                            │    │
│   │  Agent optimization • Training • Performance management           │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │  TIER 3: AGENTS (Domain Specialists)                              │    │
│   │  Deep expertise • Task execution • Bot management                 │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │  TIER 4: BOTS (User-Facing)                                       │    │
│   │  Direct user interaction • Scripted responses • Guardrails        │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tier Details

### TIER 0: HITL (Human-In-The-Loop)

**Role:** Ultimate authority and human oversight

| Attribute | Value |
|-----------|-------|
| Authority | 100 |
| Scope | Governance |
| Autonomy | 5 (Full) |
| Can Delegate To | Orchs, Metagoats, Agents, Bots |
| Reports To | None |
| Min Trust | N/A (Human) |

**Responsibilities:**
- Final decisions on ethics and safety
- Strategic direction setting
- High-stakes operation approval
- Escalation handling
- Appeal resolution

**Components:**
- Knowledge: Platform policies, ethical guidelines, user preferences
- Memory: Decision history, escalation patterns, user context
- Abilities: Approve, reject, delegate, override, configure

---

### TIER 1: ORCHS (Orchestrators)

**Role:** Multi-agent workflow coordination

| Attribute | Value |
|-----------|-------|
| Authority | 80 |
| Scope | Coordination |
| Autonomy | 4 |
| Can Delegate To | Metagoats, Agents, Bots |
| Reports To | HITL |
| Min Trust | 800 |

**Responsibilities:**
- Complex workflow management
- Resource allocation across teams
- Cross-team collaboration
- Performance monitoring
- Capacity planning

**Components:**
- Knowledge: Workflow patterns, resource constraints, team capabilities
- Memory: Active workflows, resource usage, performance history
- Abilities: Orchestrate, allocate, schedule, monitor, escalate

---

### TIER 2: METAGOATS (Meta-level Agents)

**Role:** Agent optimization and management

| Attribute | Value |
|-----------|-------|
| Authority | 60 |
| Scope | Management |
| Autonomy | 4 |
| Can Delegate To | Agents, Bots |
| Reports To | Orchs |
| Min Trust | 600 |

**Responsibilities:**
- Agent performance optimization
- Training program management
- Capability enhancement
- Quality assurance
- Pattern recognition

**Components:**
- Knowledge: Optimization strategies, training curricula, quality metrics
- Memory: Agent performance history, improvement patterns, insights
- Abilities: Optimize, train, evaluate, certify, restructure

**Why "Metagoats"?**
- **Meta**: Operates at a meta-level, managing other agents
- **GOAT**: "Greatest Of All Time" - these are the elite agents that make other agents better
- Memorable and unique branding for A3I

---

### TIER 3: AGENTS (Domain Specialists)

**Role:** Deep expertise and task execution

| Attribute | Value |
|-----------|-------|
| Authority | 40 |
| Scope | Execution |
| Autonomy | 3 |
| Can Delegate To | Bots |
| Reports To | Metagoats |
| Min Trust | 400 |

**Responsibilities:**
- Complex task execution
- Domain-specific recommendations
- Bot supervision
- Quality output generation
- Collaboration with peers

**Components:**
- Knowledge: Domain expertise, procedures, best practices
- Memory: Task history, user preferences, collaboration context
- Abilities: Execute, recommend, supervise, collaborate, escalate

---

### TIER 4: BOTS (User-Facing)

**Role:** Direct user interaction

| Attribute | Value |
|-----------|-------|
| Authority | 20 |
| Scope | Interaction |
| Autonomy | 2 |
| Can Delegate To | None |
| Reports To | Agents |
| Min Trust | 200 |

**Responsibilities:**
- User conversation handling
- Scripted response delivery
- Guardrail enforcement
- Escalation when needed
- User preference tracking

**Components:**
- Knowledge: User preferences, conversation scripts, guardrails
- Memory: Conversation history, user context, session state
- Abilities: Respond, clarify, escalate, log, personalize

---

## Three Core Components

### Knowledge

Each entity maintains a knowledge base with:

| Type | Description | Example |
|------|-------------|---------|
| Fact | Verified information | "API rate limit is 100/minute" |
| Concept | Abstract understanding | "User satisfaction correlates with response time" |
| Procedure | How to do something | "Steps to escalate a complaint" |
| Principle | Governing rules | "Never share PII without consent" |
| Pattern | Recognized patterns | "Users ask follow-up questions 80% of time" |
| Anti-pattern | What to avoid | "Don't use jargon with new users" |
| Relationship | Connections | "Security Agent collaborates with Compliance Agent" |
| Context | Situational understanding | "Enterprise users prefer formal tone" |
| Preference | Learned preferences | "User prefers bullet points over paragraphs" |
| Constraint | Limitations | "Cannot access external URLs" |

**Capacity by Tier:**
- HITL: 10,000 items
- Orchs: 5,000 items
- Metagoats: 3,000 items
- Agents: 1,000 items
- Bots: 500 items

---

### Memory

Each entity maintains three memory types:

| Type | Description | Retention |
|------|-------------|-----------|
| Working | Current session context | Session duration |
| Short-term | Recent interactions | Days (with decay) |
| Long-term | Important consolidated memories | Persistent |

**Memory Flow:**
```
Working Memory → (importance > threshold) → Short-term Memory → (consolidation) → Long-term Memory
                                                      ↓
                                               (decay over time)
                                                      ↓
                                                  Forgotten
```

**Capacity by Tier:**
| Tier | Working | Short-term | Long-term |
|------|---------|------------|-----------|
| HITL | 100 | 1,000 | 10,000 |
| Orchs | 50 | 500 | 5,000 |
| Metagoats | 30 | 300 | 3,000 |
| Agents | 20 | 200 | 1,000 |
| Bots | 10 | 100 | 500 |

---

### Abilities

Each entity has abilities across categories:

| Category | Description | Example Abilities |
|----------|-------------|-------------------|
| Communication | Speaking, writing | Respond, clarify, translate |
| Analysis | Research, evaluation | Analyze, synthesize, compare |
| Creation | Building, designing | Generate, compose, design |
| Coordination | Managing, delegating | Schedule, delegate, prioritize |
| Learning | Adapting, improving | Train, adapt, certify |
| Decision | Choosing, judging | Approve, reject, recommend |
| Execution | Performing tasks | Execute, process, complete |
| Observation | Monitoring, detecting | Monitor, detect, report |

**Ability Sources:**
- **Innate**: Built-in for the tier level
- **Learned**: Acquired through training/experience
- **Delegated**: Granted by higher tier
- **Restricted**: Explicitly blocked

---

## Delegation Flow

```
HITL ─────────────────────────────────────────────────────────┐
  │                                                           │
  ├──► Orch ──────────────────────────────────────────────────┤
  │      │                                                    │
  │      ├──► Metagoat ───────────────────────────────────────┤
  │      │       │                                            │
  │      │       ├──► Agent ──────────────────────────────────┤
  │      │       │       │                                    │
  │      │       │       └──► Bot                             │
  │      │       │                                            │
  │      │       └──► Bot (direct delegation)                 │
  │      │                                                    │
  │      └──► Agent (skip metagoat)                           │
  │              │                                            │
  │              └──► Bot                                     │
  │                                                           │
  └──► Bot (emergency direct)                                 │
                                                              │
        ◄──────── Escalation flows upward ────────────────────┘
```

---

## Reporting Chain

Every entity has a clear reporting chain:

| Entity | Reports To | Escalation Path |
|--------|------------|-----------------|
| Bot | Agent | Bot → Agent → Metagoat → Orch → HITL |
| Agent | Metagoat | Agent → Metagoat → Orch → HITL |
| Metagoat | Orch | Metagoat → Orch → HITL |
| Orch | HITL | Orch → HITL |
| HITL | None | Terminal |

---

## Trust Requirements

Trust scores gate tier access:

| Tier | Min Trust | Trust Tier Name |
|------|-----------|-----------------|
| HITL | N/A | Human |
| Orch | 800 | Verified |
| Metagoat | 600 | Trusted |
| Agent | 400 | Established |
| Bot | 200 | Provisional |

---

## Implementation

Types defined in: `lib/hierarchy/types.ts`

```typescript
import {
  HierarchyLevel,
  HIERARCHY_LEVELS,
  HITL,
  Orch,
  Metagoat,
  Agent,
  Bot,
  KnowledgeBase,
  MemoryStore,
  AbilitySet,
  createDefaultKnowledgeBase,
  createDefaultMemoryStore,
  createDefaultAbilitySet,
} from '@/lib/hierarchy'
```

---

## Related Documentation

- [System Architecture](./architecture.md) - Overall platform architecture
- [Trust System](./trust-system.md) - Trust score mechanics
- [Governance](./governance.md) - Council and validation

---

*"Agents you can anchor to."*
