# @vorion/council

16-Agent Governance Council Orchestration System for AI oversight, compliance, and quality assurance.

> Extracted from BAI Command Center for the Vorion AI Governance Platform

## Features

- **Master Planner Agent** - Hierarchical task decomposition and planning
- **Compliance Team (4 agents)** - PII detection, ethics, policy enforcement (parallel)
- **Routing Agents (2)** - Agent selection and dispatch
- **QA Critique Team (4 agents)** - Quality review and feedback
- **Meta-Orchestrators (2)** - Metrics tracking and optimization
- **Human-Gateway (3 agents)** - Escalation, context building, decision tracking

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Council Orchestrator         │
                    └─────────────────────────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │        1. Master Planner        │
                    │   Task decomposition & planning  │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │   2. Compliance Team (4 agents)  │
                    │  PII detection, ethics, policy   │
                    │      [Parallel execution]        │
                    └────────────────┬────────────────┘
                                     │
                    ┌───────┴───────┐
              [Failed]            [Passed]
                    │                │
        ┌───────────▼───────────┐   │
        │   Human-Gateway (3)   │   │
        │   Escalation flow     │   │
        └───────────────────────┘   │
                                    │
                    ┌───────────────▼─────────────────┐
                    │      3. Routing Agents (2)       │
                    │     Agent selection & dispatch   │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │         4. Execution             │
                    │    Advisors / Workforce teams    │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │    5. QA Critique (4 agents)     │
                    │   Quality review (up to 3 loops) │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │          6. Complete             │
                    └─────────────────────────────────┘
```

## Installation

```bash
npm install @vorion/council
```

## Usage

### Basic Usage

```typescript
import { CouncilOrchestrator } from '@vorion/council'

const council = new CouncilOrchestrator()

const result = await council.process({
  userRequest: 'Help me create a marketing strategy for our new product launch',
  userId: 'user_123',
  metadata: {
    priority: 'high',
    maxCost: 0.50
  }
})

console.log(result.output?.content)        // Final response
console.log(result.compliance?.passed)     // Did it pass compliance?
console.log(result.qa?.passed)             // Did it pass QA?
console.log(result.output?.totalCost)      // Total cost in USD
```

### With Human Approval Required

```typescript
const result = await council.process({
  userRequest: 'Make a critical business decision about our pricing strategy',
  userId: 'user_123',
  metadata: {
    priority: 'critical',
    requiresHumanApproval: true,
    maxCost: 1.00
  }
})

if (result.humanEscalation?.required) {
  console.log('Human review required!')
  console.log('Review ID:', result.humanEscalation.reviewId)
  console.log('Severity:', result.humanEscalation.severity)
  console.log('Deadline:', result.humanEscalation.deadline)
}
```

### Using Individual Agents

```typescript
import {
  MasterPlannerAgent,
  ComplianceAgent,
  runComplianceCheck
} from '@vorion/council'

// Use Master Planner directly
const planner = new MasterPlannerAgent()
const plannedState = await planner.plan(initialState)

// Run all 4 compliance agents in parallel
const complianceState = await runComplianceCheck(state)
```

## Agent Details

### Master Planner (1 agent)
Analyzes requests and creates hierarchical execution plans with cost/time estimates.

### Compliance & Ethics (4 agents)
Run in parallel to check for:
- PII (emails, phones, SSN, credit cards, etc.)
- Sensitive business data
- Ethical concerns (bias, discrimination, harmful content)
- Policy violations

### Routing & Dispatch (2 agents)
Select appropriate advisors or workforce teams for execution.

### QA Critique (4 agents)
Review outputs across 5 dimensions:
- Accuracy (0-10)
- Completeness (0-10)
- Clarity (0-10)
- Relevance (0-10)
- Tone (0-10)

### Meta-Orchestrator (2 agents)
Track costs, performance metrics, and optimize routing rules.

### Human-Gateway (3 agents)
1. **TriageAgent** - Determines severity and escalation type
2. **ContextBuilderAgent** - Prepares context for human reviewers
3. **DecisionTrackerAgent** - Logs decisions for learning

## Escalation Triggers

| Trigger | Severity | Action |
|---------|----------|--------|
| PII detected | CRITICAL | Immediate escalation |
| Budget exceeded | HIGH | Review & approval |
| Low confidence (<70%) | MEDIUM | Review output |
| Multiple QA failures | MEDIUM | Review & approval |
| User-requested approval | Varies | Per priority |
| Critical + high cost | CRITICAL | High-risk review |

## State Flow

```typescript
interface CouncilState {
  // Input
  userRequest: string
  userId: string
  requestId: string
  metadata: { priority, maxCost, requiresHumanApproval }

  // Phases
  plan?: { steps, estimatedCost, estimatedTime, complexity }
  compliance?: { passed, issues, containsPII, sensitivityLevel }
  routing?: { selectedAgents, rationale }
  execution?: { results, status }
  qa?: { passed, feedback, requiresRevision }
  humanEscalation?: { required, reason, reviewId, severity, deadline }

  // Output
  output?: { content, confidence, totalCost, totalTime, model }

  // Metadata
  currentStep: CouncilStep
  errors: CouncilError[]
}
```

## Integration with AI Gateway

The council uses `@vorion/ai-gateway` for all LLM operations:

```typescript
// Compliance checks use high-security policy (routes to Ollama)
policy: 'high-security'

// Planning uses reasoning models
taskType: 'reasoning', priority: 'high'

// Execution respects PII detection
policy: state.compliance?.containsPII ? 'high-security' : 'standard'
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Build
npm run build

# Test
npm run test
```

## Current Implementation Status

| Agent | Status | Notes |
|-------|--------|-------|
| Master Planner | ✅ Full | LLM-based task decomposition |
| Compliance (4) | ✅ Full | Parallel PII/ethics checks |
| Routing (2) | ⚠️ Basic | Simple advisor/workforce selection |
| QA Critique (4) | ⚠️ Basic | Simplified approval |
| Meta-Orchestrator (2) | ⚠️ Stub | Logging only |
| Human-Gateway (3) | ✅ Full | Full escalation workflow |

## License

MIT - Vorion AI Governance Platform
