# @vorion/aci-client

TypeScript client SDK for the **Agent Classification Identifier (ACI)** standard - a production-grade framework for AI agent trust governance.

## Installation

```bash
npm install @vorion/aci-client
# or
pnpm add @vorion/aci-client
# or
yarn add @vorion/aci-client
```

## Quick Start

```typescript
import { createACIClient } from '@vorion/aci-client'

const client = createACIClient({
  baseUrl: 'https://api.agentanchor.ai',
  apiKey: process.env.ACI_API_KEY,
})

// Get dashboard statistics
const { stats } = await client.getStats()
console.log(`${stats.contextStats.agents} agents registered`)

// Evaluate a role gate
const result = await client.evaluateRoleGate({
  agentId: 'agent-123',
  requestedRole: 'R_L3',
  currentTier: 'T3',
})

if (result.evaluation.finalDecision === 'ALLOW') {
  // Proceed with operation
}
```

## Features

### Phase 6 Trust Engine (Q1-Q5)

| Decision | Feature | Description |
|----------|---------|-------------|
| Q1 | Ceiling Enforcement | Dual-layer trust ceilings with regulatory compliance |
| Q2 | Hierarchical Context | 4-tier context (Deployment → Org → Agent → Operation) |
| Q3 | Role Gates | 3-layer evaluation (Kernel → Policy → BASIS) |
| Q4 | Federated Presets | ACI → Vorion → Axiom derivation chains |
| Q5 | Provenance | Immutable origin tracking with policy modifiers |

## API Reference

### Client Configuration

```typescript
interface ACIClientConfig {
  baseUrl: string           // API base URL
  apiKey?: string           // Bearer token authentication
  timeout?: number          // Request timeout (default: 30000ms)
  headers?: Record<string, string>  // Custom headers
  debug?: boolean           // Enable debug logging
}
```

### Role Gate Evaluation (Q3)

```typescript
// Evaluate whether an agent can assume a role
const result = await client.evaluateRoleGate({
  agentId: 'agent-123',
  requestedRole: 'R_L3',      // Orchestrator
  currentTier: 'T3',          // Standard
  currentScore: 550,
  attestations: ['security-audit'],
})

// Result includes 3-layer evaluation
console.log(result.layers.kernel.allowed)   // Matrix lookup
console.log(result.layers.policy.result)    // Policy evaluation
console.log(result.layers.basis.overrideUsed) // Override used
```

### Ceiling Check (Q1)

```typescript
// Check proposed score against regulatory ceilings
const ceiling = await client.checkCeiling({
  agentId: 'agent-123',
  proposedScore: 750,
  complianceFramework: 'EU_AI_ACT',  // Max 699 for EU AI Act
})

if (ceiling.result.ceilingApplied) {
  console.log(`Score capped: ${ceiling.result.finalScore}`)
}
```

### Provenance Tracking (Q5)

```typescript
// Register a new agent
const provenance = await client.createProvenance({
  agentId: 'agent-new',
  creationType: 'FRESH',
  createdBy: 'system',
})

// Clone an existing agent (applies -50 modifier)
const cloned = await client.createProvenance({
  agentId: 'agent-clone',
  creationType: 'CLONED',
  parentAgentId: 'agent-original',
  createdBy: 'admin@company.com',
})
```

### Context Hierarchy (Q2)

```typescript
// Get full hierarchy
const hierarchy = await client.getContextHierarchy()

// Navigate tiers
const deployments = await client.getDeployments()
const orgs = await client.getOrganizations(deploymentId)
const agents = await client.getAgents(deploymentId, orgId)
const operations = await client.getOperations(agentId)
```

### Presets (Q4)

```typescript
// Get preset hierarchy
const presets = await client.getPresetHierarchy()

// Verify lineage
const verification = await client.verifyPresetLineage('axiom-preset-123')
if (verification.verified) {
  console.log('Lineage verified from ACI → Vorion → Axiom')
}
```

### Gaming Alerts

```typescript
// Get active alerts
const { alerts } = await client.getGamingAlerts('ACTIVE')

// Resolve an alert
await client.updateGamingAlertStatus(
  alertId,
  'RESOLVED',
  'admin@company.com',
  'False positive - batch processing'
)
```

## Trust Tiers

| Tier | Label | Score Range | Description |
|------|-------|-------------|-------------|
| T0 | Sandbox | 0-99 | Isolated testing environment |
| T1 | Probation | 100-299 | New/untrusted agents |
| T2 | Limited | 300-499 | Limited autonomy |
| T3 | Standard | 500-699 | Normal operations |
| T4 | Trusted | 700-899 | Elevated privileges |
| T5 | Sovereign | 900-1000 | Full autonomy |

## Agent Roles

| Role | Level | Min Tier | Description |
|------|-------|----------|-------------|
| R-L0 | Listener | T0 | Passive observation |
| R-L1 | Executor | T0 | Single task execution |
| R-L2 | Planner | T1 | Multi-step planning |
| R-L3 | Orchestrator | T2 | Multi-agent coordination |
| R-L4 | Architect | T3 | System design |
| R-L5 | Governor | T4 | Policy control |
| R-L6 | Sovereign | T5 | Full autonomy |
| R-L7 | Meta-Agent | T5 | Agent creation |
| R-L8 | Ecosystem | T5 | Ecosystem control |

## Utility Functions

```typescript
import { getTierFromScore, isRoleAllowedForTier } from '@vorion/aci-client'

// Compute tier from score
const tier = getTierFromScore(550)  // 'T3'

// Check role permission (kernel layer)
const allowed = isRoleAllowedForTier('R_L3', 'T3')  // true
```

## Error Handling

```typescript
import { ACIError } from '@vorion/aci-client'

try {
  await client.evaluateRoleGate(request)
} catch (error) {
  if (error instanceof ACIError) {
    if (error.isClientError()) {
      console.log('Invalid request:', error.message)
    } else if (error.isServerError()) {
      console.log('Server error, retry later')
    } else if (error.isTimeout()) {
      console.log('Request timed out')
    }
  }
}
```

## License

MIT
