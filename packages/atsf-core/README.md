# @vorion/atsf-core

Agentic Trust Scoring Framework - Core runtime for AI agent governance, trust scoring, and policy enforcement.

## Installation

```bash
npm install @vorion/atsf-core
```

## Quick Start

```typescript
import {
  TrustEngine,
  createTrustEngine,
  IntentService,
  createIntentService,
  EnforcementService,
  createEnforcementService,
} from '@vorion/atsf-core';

// Create a trust engine
const trustEngine = createTrustEngine();

// Initialize an agent with trust
const agent = await trustEngine.initializeEntity('agent-001', 1);
console.log(agent.score); // 200 (L1 minimum)

// Record behavioral signals
await trustEngine.recordSignal({
  id: crypto.randomUUID(),
  entityId: 'agent-001',
  type: 'behavioral.task_completed',
  value: 0.9,
  source: 'system',
  timestamp: new Date().toISOString(),
  metadata: {},
});

// Get updated score
const record = await trustEngine.getScore('agent-001');
console.log(record?.score, record?.level);
```

## Modules

### Trust Engine

0-1000 trust scoring with 6 tiers, time-based decay, and accelerated decay on failure.

```typescript
import { TrustEngine, createTrustEngine } from '@vorion/atsf-core';

// Basic usage
const engine = createTrustEngine();

// With full configuration
const configuredEngine = createTrustEngine({
  decayRate: 0.01,              // 1% decay per interval
  decayIntervalMs: 60000,       // 1 minute intervals
  failureThreshold: 0.3,        // Signals below 0.3 = failure
  acceleratedDecayMultiplier: 3.0, // 3x decay on failure
  failureWindowMs: 3600000,     // 1 hour failure window
  minFailuresForAcceleration: 2,// 2+ failures = accelerated
});
```

### BASIS Rule Engine

Constraint evaluation for governance policies.

```typescript
import { createEvaluator, parseNamespace } from '@vorion/atsf-core';

const evaluator = createEvaluator();
evaluator.registerNamespace(parseNamespace(ruleDefinition));
const result = await evaluator.evaluate(context);
```

### Intent Service

Submit and track agent intents through the governance pipeline.

```typescript
import { createIntentService } from '@vorion/atsf-core';

const intentService = createIntentService();
const intent = await intentService.submit({
  entityId: 'agent-001',
  goal: 'Send email to user',
  context: { recipient: 'user@example.com' },
});
```

### Enforcement Service

Policy decision point for allow/deny/escalate decisions.

```typescript
import { createEnforcementService } from '@vorion/atsf-core';

const enforcer = createEnforcementService({
  defaultAction: 'deny',
  requireMinTrustLevel: 2,
});
const decision = await enforcer.decide(context);
```

### Proof Service

Immutable audit chain with SHA-256 hashing.

```typescript
import { createProofService } from '@vorion/atsf-core';

const proofService = createProofService();
const proof = await proofService.create({ intent, decision, inputs, outputs });
const verification = await proofService.verify(proof.id);
```

### Cognigate Runtime

Constrained execution with resource limits.

```typescript
import { createGateway } from '@vorion/atsf-core';

const gateway = createGateway({
  maxMemoryMb: 256,
  timeoutMs: 30000,
});
gateway.registerHandler('email', emailHandler);
const result = await gateway.execute(context);
```

## Trust Levels (6 Tiers)

| Level | Name | Score Range |
|-------|------|-------------|
| 0 | Untrusted | 0-166 |
| 1 | Observed | 167-332 |
| 2 | Limited | 333-499 |
| 3 | Standard | 500-665 |
| 4 | Trusted | 666-832 |
| 5 | Certified | 833-1000 |

## Events

The Trust Engine extends `EventEmitter` and emits the following events:

```typescript
import { TrustEngine } from '@vorion/atsf-core';

const engine = new TrustEngine();

// Listen for all trust events
engine.on('trust:*', (event) => {
  console.log('Trust event:', event);
});

// Listen for specific events
engine.on('trust:initialized', (event) => {
  console.log(`Entity ${event.entityId} initialized at L${event.initialLevel}`);
});

engine.on('trust:tier_changed', (event) => {
  console.log(`${event.entityId} ${event.direction}: ${event.previousLevelName} → ${event.newLevelName}`);
});

engine.on('trust:decay_applied', (event) => {
  console.log(`Decay: ${event.entityId} lost ${event.decayAmount} points`);
});

engine.on('trust:score_changed', (event) => {
  console.log(`Score: ${event.entityId} changed by ${event.delta}`);
});

engine.on('trust:signal_recorded', (event) => {
  console.log(`Signal: ${event.signal.type} for ${event.entityId}`);
});
```

### Event Types

| Event | Description |
|-------|-------------|
| `trust:initialized` | New entity registered |
| `trust:signal_recorded` | Behavioral signal recorded |
| `trust:score_changed` | Score changed by ≥5 points |
| `trust:tier_changed` | Entity promoted or demoted |
| `trust:decay_applied` | Trust decayed due to staleness (includes `accelerated` flag) |
| `trust:failure_detected` | Low-value signal detected as failure |
| `trust:*` | Wildcard - all events |

### Accelerated Decay

When an entity accumulates failures (signals with value < 0.3), the decay rate increases:

```typescript
engine.on('trust:failure_detected', (event) => {
  console.log(`Failure #${event.failureCount} for ${event.entityId}`);
  if (event.acceleratedDecayActive) {
    console.log('Accelerated decay is now active (3x normal rate)');
  }
});

engine.on('trust:decay_applied', (event) => {
  if (event.accelerated) {
    console.log(`Accelerated decay: -${event.decayAmount} points`);
  }
});

// Check status
const isAccelerated = engine.isAcceleratedDecayActive('agent-001');
const failureCount = engine.getFailureCount('agent-001');
```

## Persistence

Trust records can be persisted using pluggable storage backends:

```typescript
import {
  createTrustEngine,
  createFileProvider,
  createMemoryProvider,
} from '@vorion/atsf-core';

// File-based persistence
const fileProvider = createFileProvider({
  path: './trust-records.json',
  autoSaveIntervalMs: 5000, // Auto-save every 5 seconds
});
await fileProvider.initialize();

const engine = createTrustEngine({
  persistence: fileProvider,
  autoPersist: true, // Auto-save on changes
});

// Load existing records
await engine.loadFromPersistence();

// Records are automatically saved on changes
await engine.initializeEntity('agent-001', 2);

// Manual save/close
await engine.saveToPersistence();
await engine.close();
```

Available providers:
- `MemoryPersistenceProvider` - Fast, non-persistent (default)
- `FilePersistenceProvider` - JSON file storage

## LangChain Integration

Integrate trust scoring with LangChain agents:

```typescript
import {
  createTrustEngine,
  createTrustAwareExecutor,
  createTrustTools,
} from '@vorion/atsf-core';

// Create trust-aware executor
const engine = createTrustEngine();
const executor = createTrustAwareExecutor(engine, {
  agentId: 'my-agent',
  initialTrustLevel: 2,
  minTrustLevel: 2,
  recordToolUsage: true,
  recordLlmCalls: true,
  recordErrors: true,
});
await executor.initialize();

// Use callback handler with LangChain
const callbacks = [executor.callbackHandler];

// Execute with trust gating
const result = await executor.execute(async () => {
  // Your agent execution here
  return await agent.invoke({ input: 'Hello' }, { callbacks });
});

console.log(result.trustCheck.allowed);
console.log(result.finalScore);

// Add trust tools to your agent
const trustTools = createTrustTools(engine, 'my-agent');
// Tools: check_my_trust, check_trust_requirements, get_trust_levels,
//        report_task_success, report_task_failure
```

### Trust-Aware Execution Flow

1. **Check Trust** - Verify agent has sufficient trust level
2. **Execute** - Run the agent with callback tracking
3. **Record Signals** - Tool/LLM success/failure recorded automatically
4. **Update Score** - Trust score updates based on behavior
5. **Return Context** - Execution result includes trust state

## License

MIT
