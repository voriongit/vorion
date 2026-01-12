# @agent-anchor/contracts

Canonical contract schemas for the **Agent Anchor Trust Validation System**.

## Overview

This package defines the shared schemas and types used across all Agent Anchor components. These contracts establish the interface between:

- **AURYN** (Strategic Intelligence) → **Agent Anchor** (Trust & Authorization)
- **Agent Anchor** → **Execution Runtimes / Agents / Tools**

## Schema Modules

| Module | Description | Spec Section |
|--------|-------------|--------------|
| `common` | Shared primitives (UUID, Actor, Autonomy, etc.) | - |
| `intent-package` | Structured intent from strategic layer | III.1 |
| `policy-set` | Declarative policies for enforcement | IV.1 (PINL) |
| `authorization-decision` | Authorization output from ACE | IV.3, V.1-2 |
| `execution-event` | Telemetry from observation layer | IV.5 |
| `proof-pack` | Cryptographic audit bundles | IV.6 |
| `trust-signal` | Accountability signals | IV.7 |
| `entitlement` | Commercial/operational boundaries | IV.8 |

## Installation

```bash
npm install @agent-anchor/contracts
# or
pnpm add @agent-anchor/contracts
```

## Usage

```typescript
import {
  IntentPackage,
  IntentPackageSchema,
  AuthorizationDecision,
  AuthorizationDecisionSchema,
  PolicySet,
  PolicySetSchema,
} from '@agent-anchor/contracts';

// Validate an intent package
const intent: IntentPackage = IntentPackageSchema.parse(rawIntent);

// Create an authorization decision
const decision: AuthorizationDecision = {
  id: crypto.randomUUID(),
  intentId: intent.id,
  outcome: 'APPROVED',
  // ...
};

// Validate with Zod
AuthorizationDecisionSchema.parse(decision);
```

### Selective Imports

```typescript
// Import only what you need
import { IntentPackageSchema } from '@agent-anchor/contracts/intent';
import { PolicySetSchema } from '@agent-anchor/contracts/policy';
import { TrustSignalSchema } from '@agent-anchor/contracts/trust';
```

## Design Principles

Per the Agent Anchor canonical specification:

1. **Declarative Policies**: Policies are data, not code. Agent Anchor validates structure, not meaning.

2. **Deterministic Authorization**: Every decision is explainable. No probabilistic reasoning.

3. **Append-Only Audit**: All records are immutable and hash-chained.

4. **Descriptive Signals**: Trust signals describe accountability, they don't punish.

5. **Enforcement at Authorization**: UI-only gating is forbidden. All limits are enforced at the ACE layer.

## Schema Versioning

Schemas follow semantic versioning. Breaking changes increment the major version.

Current version: **1.0.0**

Version manifests are stored in `versions/` directory.

## Agent Anchor Role

Agent Anchor is the **Trust & Authorization** core in a dual-core system:

```
[ AURYN — STRATEGIC INTELLIGENCE ]
        ↓ (INTENT ONLY)
[ AGENT ANCHOR — TRUST & AUTHORIZATION ]
        ↓ (CONSTRAINED PERMISSION)
[ EXECUTION RUNTIMES / AGENTS / TOOLS ]
```

Agent Anchor:
- ✅ OBSERVES
- ✅ AUTHORIZES
- ✅ CONSTRAINS
- ✅ RECORDS
- ✅ PROVES
- ✅ SIGNALS VIOLATIONS

Agent Anchor does NOT:
- ❌ Generate goals
- ❌ Perform strategic reasoning
- ❌ Optimize outcomes
- ❌ Decompose plans
- ❌ Orchestrate workflows

## License

MIT
