# @vorion/cognigate

Official TypeScript SDK for the [Cognigate](https://cognigate.dev) AI Governance API.

## Installation

```bash
npm install @vorionsys/cognigate
```

## Quick Start

```typescript
import { Cognigate } from '@vorionsys/cognigate';

const client = new Cognigate({
  apiKey: process.env.COGNIGATE_API_KEY,
});

// Get trust status for an agent
const status = await client.trust.getStatus('agent-123');
console.log(`Trust Score: ${status.trustScore}`);
console.log(`Tier: ${status.tierName}`);
console.log(`Capabilities: ${status.capabilities.join(', ')}`);
```

## Features

- **Full TypeScript Support**: Complete type definitions with Zod runtime validation
- **Trust Management**: Query and update agent trust scores
- **Governance Enforcement**: Parse intents and enforce governance rules
- **Proof Chain**: Immutable audit trail for all agent actions
- **Webhook Support**: Handle Cognigate webhooks with signature verification

## API Reference

### Initialization

```typescript
const client = new Cognigate({
  apiKey: 'your-api-key',      // Required
  baseUrl: 'https://...',       // Optional: custom API URL
  timeout: 30000,               // Optional: request timeout in ms
  retries: 3,                   // Optional: number of retries
  debug: false,                 // Optional: enable debug logging
  webhookSecret: 'secret',      // Optional: for webhook verification
});
```

### Agents

```typescript
// List agents
const agents = await client.agents.list({ status: 'ACTIVE' });

// Get agent
const agent = await client.agents.get('agent-123');

// Create agent
const newAgent = await client.agents.create({
  name: 'DataProcessor',
  description: 'Processes data pipelines',
  template: 'data-processor',
});

// Update agent
await client.agents.update('agent-123', { name: 'New Name' });

// Pause/Resume
await client.agents.pause('agent-123');
await client.agents.resume('agent-123');

// Delete agent
await client.agents.delete('agent-123');
```

### Trust

```typescript
// Get trust status
const status = await client.trust.getStatus('agent-123');
// Returns: { trustScore, trustTier, tierName, capabilities, factorScores, ... }

// Get trust history
const history = await client.trust.getHistory('agent-123', {
  from: new Date('2024-01-01'),
  limit: 100,
});

// Submit outcome (updates trust score)
const updated = await client.trust.submitOutcome('agent-123', 'proof-456', {
  success: true,
  metrics: { latency: 234, accuracy: 0.98 },
});
```

### Governance

```typescript
// Parse intent
const parsed = await client.governance.parseIntent(
  'agent-123',
  'Read customer data from the sales database'
);

// Enforce governance
const result = await client.governance.enforce(parsed.intent);
// Returns: { decision, trustScore, grantedCapabilities, reasoning, proofId }

// Combined: parse + enforce
const { intent, result } = await client.governance.evaluate(
  'agent-123',
  'Send email to customer'
);

if (result.decision === 'ALLOW') {
  // Proceed with action
} else if (result.decision === 'ESCALATE') {
  // Request human approval
} else {
  // Action denied
  console.log(result.reasoning);
}

// Check capability without creating proof
const check = await client.governance.canPerform(
  'agent-123',
  'write_file',
  ['file_write', 'approved_directories']
);
```

### Proofs

```typescript
// Get proof record
const proof = await client.proofs.get('proof-123');

// List proofs for entity
const proofs = await client.proofs.list('agent-123', {
  from: new Date('2024-01-01'),
  outcome: 'SUCCESS',
});

// Get chain statistics
const stats = await client.proofs.getStats('agent-123');
// Returns: { totalRecords, successRate, averageTrustScore, chainIntegrity }

// Verify chain integrity
const verification = await client.proofs.verify('agent-123');
```

### Webhooks

```typescript
import { WebhookRouter, parseWebhookPayload } from '@vorionsys/cognigate';

const router = new WebhookRouter();

// Handle specific events
router.on('trust.tier_changed', async (event) => {
  console.log(`Agent ${event.entityId} tier changed:`, event.payload);
});

router.on('governance.decision', async (event) => {
  if (event.payload.decision === 'ESCALATE') {
    // Alert human reviewer
  }
});

// Handle all events
router.onAll(async (event) => {
  await logEvent(event);
});

// Express middleware
app.post('/webhooks/cognigate', router.middleware(process.env.WEBHOOK_SECRET));

// Or manual verification
app.post('/webhooks/cognigate', async (req, res) => {
  try {
    const event = await parseWebhookPayload(
      req.body,
      req.headers['x-cognigate-signature'],
      process.env.WEBHOOK_SECRET
    );
    await router.handle(event);
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Trust Tiers

```typescript
import { Cognigate, TrustTier, TIER_THRESHOLDS } from '@vorionsys/cognigate';

// Get tier from score
const tier = Cognigate.getTierFromScore(750);
// Returns: TrustTier.T4_OPERATIONAL

// Get tier name
const name = Cognigate.getTierName(TrustTier.T5_TRUSTED);
// Returns: "Trusted"

// Get tier thresholds
const thresholds = Cognigate.getTierThresholds(TrustTier.T4_OPERATIONAL);
// Returns: { min: 650, max: 799, name: "Operational" }

// All tiers
console.log(TIER_THRESHOLDS);
// T0_SANDBOX: 0-199
// T1_OBSERVED: 200-349
// T2_PROVISIONAL: 350-499
// T3_VERIFIED: 500-649
// T4_OPERATIONAL: 650-799
// T5_TRUSTED: 800-875
// T6_CERTIFIED: 876-949
// T7_AUTONOMOUS: 950-1000
```

## Error Handling

```typescript
import { Cognigate, CognigateError } from '@vorionsys/cognigate';

try {
  const status = await client.trust.getStatus('invalid-id');
} catch (error) {
  if (error instanceof CognigateError) {
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Status:', error.status);
    console.log('Details:', error.details);
  }
}
```

## TypeScript Types

All types are exported and can be imported:

```typescript
import type {
  Agent,
  TrustStatus,
  GovernanceResult,
  Intent,
  ProofRecord,
  WebhookEvent,
  TrustTier,
  GovernanceDecision,
} from '@vorionsys/cognigate';
```

## Runtime Validation

Zod schemas are exported for runtime validation:

```typescript
import { TrustStatusSchema, AgentSchema } from '@vorionsys/cognigate';

const validatedStatus = TrustStatusSchema.parse(untrustedData);
```

## License

MIT
