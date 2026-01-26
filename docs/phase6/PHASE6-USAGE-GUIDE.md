# Phase 6: Trust Engine Hardening - Usage Guide

This guide covers the complete implementation of Phase 6 Trust Engine Hardening, which includes 5 architecture decisions for production-grade AI governance.

## Quick Start

```typescript
import { createPhase6TrustEngine, RegulatoryFramework } from '@vorion/atsf-core';

// Create fully initialized engine
const engine = await createPhase6TrustEngine({
  regulatoryFramework: RegulatoryFramework.HIPAA,
  initializeDefaults: true,
});

// Access individual services
const { context, presets, provenance, ceiling, roleGates } = engine;
```

## Architecture Decisions

| Decision | Component | Purpose |
|----------|-----------|---------|
| Q1 | Ceiling Enforcement | Hybrid dual-layer ceiling with regulatory observability |
| Q2 | Hierarchical Context | 4-tier context with tiered immutability |
| Q3 | Role Gates | Stratified 3-layer role+trust enforcement |
| Q4 | Weight Presets | Federated presets with derivation chains |
| Q5 | Provenance | Immutable provenance + mutable policy modifiers |

---

## Q2: Hierarchical Context

The context system implements 4 tiers with different immutability guarantees:

### Tier 1: Deployment Context (IMMUTABLE)

Set once at deployment, cannot be modified.

```typescript
import { createDeploymentContext, RegulatoryFramework, TrustTier, ContextType } from '@vorion/atsf-core';

const deployment = await createDeploymentContext({
  deploymentId: 'prod-us-west-1',
  regulatoryFramework: RegulatoryFramework.HIPAA,
  maxAllowedTier: TrustTier.T4,
  allowedContextTypes: [ContextType.ENTERPRISE],
  deployedBy: 'admin@company.com',
});

// Verify integrity
const result = await verifyDeploymentContext(deployment);
console.log(result.valid); // true
```

### Tier 2: Organizational Context (LOCKED POST-STARTUP)

Configurable during startup, then locked permanently.

```typescript
import { OrganizationalContextBuilder } from '@vorion/atsf-core';

const builder = new OrganizationalContextBuilder({
  orgId: 'org-001',
  tenantId: 'tenant-001',
  parentDeployment: deployment,
  constraints: {
    deniedDomains: ['F'], // Deny financial domain
    requiredAttestations: ['identity', 'compliance'],
    dataClassification: 'confidential',
    auditLevel: 'comprehensive',
  },
});

// Modify before locking
builder.addDeniedDomain('H'); // Add healthcare domain restriction

// Lock permanently
const orgContext = await builder.lock();

// Throws error - cannot modify after lock
builder.addDeniedDomain('A'); // Error!
```

### Tier 3: Agent Context (FROZEN AT CREATION)

Created once for each agent, immutable for agent lifetime.

```typescript
import { createAgentContext, ContextType } from '@vorion/atsf-core';

const agentContext = await createAgentContext({
  agentId: 'agent-001',
  parentOrg: orgContext,
  contextType: ContextType.ENTERPRISE,
  createdBy: 'system',
});

// Get effective ceiling for this agent
const ceiling = getAgentContextCeiling(agentContext);
console.log(ceiling); // 900 (enterprise ceiling)
```

### Tier 4: Operation Context (EPHEMERAL)

Per-request context with automatic expiration.

```typescript
import { createOperationContext, isOperationExpired } from '@vorion/atsf-core';

const operation = await createOperationContext({
  parentAgent: agentContext,
  requestMetadata: { action: 'analyze', target: 'document.pdf' },
  ttlMs: 300000, // 5 minutes
});

// Check expiration
if (isOperationExpired(operation)) {
  throw new Error('Operation context expired');
}
```

---

## Q4: Federated Weight Presets

Three-tier preset federation with cryptographic derivation chains.

### ACI Canonical Presets (Immutable)

```typescript
import { getACIPreset, getAllACIPresets } from '@vorion/atsf-core';

const balanced = getACIPreset('aci:preset:balanced');
console.log(balanced.weights);
// { observability: 0.20, capability: 0.20, behavior: 0.20, governance: 0.20, context: 0.20 }

const conservative = getACIPreset('aci:preset:conservative');
const capabilityFocused = getACIPreset('aci:preset:capability-focused');
```

### Vorion Reference Presets

```typescript
import { createPresetService, initializeVorionPresets } from '@vorion/atsf-core';

const presetService = createPresetService();
await initializeVorionPresets(presetService);

// Create custom Vorion preset
const customPreset = await presetService.createVorionPreset(
  'vorion:preset:custom',
  'Custom Security Preset',
  'High observability for regulated environments',
  'aci:preset:conservative', // Parent preset
  { observability: 0.35, governance: 0.30 }, // Overrides
  'Custom preset for financial sector',
  'security-team'
);
```

### Axiom Deployment Presets

```typescript
// Derive organization-specific preset
const orgPreset = await presetService.createAxiomPreset(
  'axiom:org-001:high-trust',
  'Org-001 High Trust Preset',
  'For internal high-trust agents',
  'vorion:preset:balanced-autonomy',
  { behavior: 0.30 }, // Emphasize behavior
  'Tailored for internal operations',
  'org-admin@company.com'
);

// Verify lineage chain
const lineage = presetService.getLineage('axiom:org-001:high-trust');
console.log(lineage.chain);
// ['aci:preset:balanced', 'vorion:preset:balanced-autonomy', 'axiom:org-001:high-trust']
```

---

## Q5: Provenance + Policy Modifiers

### Creating Agent Provenance

```typescript
import { createProvenanceService, CreationType, initializeDefaultPolicies } from '@vorion/atsf-core';

const provenanceService = createProvenanceService();
await initializeDefaultPolicies(provenanceService);

// Fresh agent (no modifier)
await provenanceService.createProvenance({
  agentId: 'agent-fresh-001',
  creationType: CreationType.FRESH,
  createdBy: 'system',
});

// Cloned agent (inherits from parent)
await provenanceService.createProvenance({
  agentId: 'agent-clone-001',
  creationType: CreationType.CLONED,
  parentAgentId: 'agent-fresh-001',
  createdBy: 'system',
});

// Evaluate modifier
const modifierRecord = await provenanceService.evaluateModifier('agent-clone-001');
console.log(modifierRecord.computedModifier); // -50 (clone penalty)
```

### Default Modifiers

| Creation Type | Modifier | Rationale |
|--------------|----------|-----------|
| FRESH | 0 | Baseline trust |
| CLONED | -50 | Inherits parent concerns |
| EVOLVED | +100 | Verifiable history |
| PROMOTED | +150 | Earned advancement |
| IMPORTED | -100 | Unknown external origin |

### Custom Modifier Policies

```typescript
// Create policy for trusted imports
await provenanceService.createPolicy({
  policyId: 'trusted:imported',
  creationType: CreationType.IMPORTED,
  baselineModifier: -30, // Reduced penalty
  conditions: {
    trustedSources: ['org:verified-partner', 'org:internal'],
  },
  createdBy: 'security-team',
});
```

---

## Q1: Ceiling Enforcement

### Three-Layer Enforcement

```typescript
import {
  createCeilingEnforcementService,
  RegulatoryFramework
} from '@vorion/atsf-core';

const ceilingService = createCeilingEnforcementService(RegulatoryFramework.HIPAA);

// Compute trust with automatic ceiling enforcement
const { event, auditEntry } = await ceilingService.computeTrust(
  'agent-001',
  950, // Raw score
  { agentContext } // Provides context ceiling
);

console.log(event.rawScore);      // 950
console.log(event.clampedScore);  // 899 (clamped to T4 ceiling)
console.log(event.ceilingApplied); // true
console.log(auditEntry.retentionRequired); // true (HIPAA = 6 years)
```

### Gaming Detection

The system automatically detects gaming attempts:

```typescript
// After multiple rapid score changes
const alerts = ceilingService.getGamingAlerts();
for (const alert of alerts) {
  console.log(`Agent ${alert.agentId}: ${alert.alertCount} alerts, status: ${alert.latestStatus}`);
}
```

### Retention Requirements

| Framework | Retention | Anomaly Retention |
|-----------|-----------|-------------------|
| NONE | 30 days | 90 days |
| HIPAA | 6 years | 6 years |
| GDPR | 1 year | 1 year |
| EU AI Act | 10 years | 10 years |
| SOC2 | 1 year | 1 year |
| ISO 42001 | 3 years | 3 years |

---

## Q3: Stratified Role Gates

### Role Gate Matrix

9 roles (R-L0 to R-L8) × 6 tiers (T0 to T5):

| Role | Minimum Tier | Description |
|------|-------------|-------------|
| R-L0 | T0 | Listener (passive) |
| R-L1 | T0 | Executor (single task) |
| R-L2 | T1 | Planner (multi-step) |
| R-L3 | T2 | Orchestrator (multi-agent) |
| R-L4 | T3 | Architect (system design) |
| R-L5 | T4 | Governor (policy control) |
| R-L6 | T5 | Sovereign (full autonomy) |
| R-L7 | T5 | Meta-agent |
| R-L8 | T5 | Ecosystem controller |

### Quick Check (Kernel Layer Only)

```typescript
import { validateRoleGateKernel, AgentRole, TrustTier } from '@vorion/atsf-core';

// Fast matrix lookup
const allowed = validateRoleGateKernel(AgentRole.R_L3, TrustTier.T3);
console.log(allowed); // true
```

### Full 3-Layer Evaluation

```typescript
import { createRoleGateService, AgentRole, TrustTier } from '@vorion/atsf-core';

const roleGateService = createRoleGateService();
await roleGateService.initialize();

const evaluation = await roleGateService.evaluate(
  'agent-001',
  AgentRole.R_L3, // Orchestrator
  TrustTier.T3,
  {
    agentId: 'agent-001',
    contextConstraints: {
      allowedRoles: [AgentRole.R_L0, AgentRole.R_L1, AgentRole.R_L2, AgentRole.R_L3],
    },
  }
);

console.log(evaluation.decision); // 'ALLOW' | 'DENY' | 'ESCALATE'
console.log(evaluation.kernelResult.valid); // true
console.log(evaluation.policyResult.appliedRuleId); // Rule that matched
```

### Dual-Control Override

For exceptional cases requiring human approval:

```typescript
const evaluation = await roleGateService.evaluate(
  'agent-002',
  AgentRole.R_L4, // Architect
  TrustTier.T3,
  {
    agentId: 'agent-002',
    contextConstraints: {
      requiresOverride: true,
      overrideRequest: {
        requestedBy: 'operator@company.com',
        approvedBy: 'supervisor@company.com', // Different person
        reason: 'Emergency maintenance window',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    },
  }
);
```

---

## Complete Flow Example

```typescript
import {
  createPhase6TrustEngine,
  RegulatoryFramework,
  TrustTier,
  ContextType,
  AgentRole,
  CreationType,
  createDeploymentContext,
  createOrganizationalContext,
  createAgentContext,
  getTierFromScore,
} from '@vorion/atsf-core';

async function main() {
  // 1. Initialize engine
  const engine = await createPhase6TrustEngine({
    regulatoryFramework: RegulatoryFramework.GDPR,
    initializeDefaults: true,
  });

  // 2. Create context hierarchy
  const deployment = await createDeploymentContext({
    deploymentId: 'eu-production',
    regulatoryFramework: RegulatoryFramework.GDPR,
    maxAllowedTier: TrustTier.T4,
    allowedContextTypes: [ContextType.ENTERPRISE],
    deployedBy: 'devops@company.eu',
  });
  engine.context.registerDeployment(deployment);

  const org = await createOrganizationalContext({
    orgId: 'company-eu',
    tenantId: 'eu-001',
    parentDeployment: deployment,
    constraints: {
      maxTrustTier: TrustTier.T4,
      deniedDomains: [],
      requiredAttestations: ['gdpr-compliance'],
      dataClassification: 'confidential',
      auditLevel: 'comprehensive',
    },
  });
  engine.context.registerOrganization(org);

  const agentContext = await createAgentContext({
    agentId: 'eu-agent-001',
    parentOrg: org,
    contextType: ContextType.ENTERPRISE,
    createdBy: 'system',
  });
  engine.context.registerAgent(agentContext);

  // 3. Create provenance
  await engine.provenance.createProvenance({
    agentId: 'eu-agent-001',
    creationType: CreationType.FRESH,
    createdBy: 'system',
  });

  // 4. Evaluate modifier
  const modifier = await engine.provenance.evaluateModifier('eu-agent-001');
  console.log(`Creation modifier: ${modifier.computedModifier}`);

  // 5. Compute trust with ceiling
  const rawScore = 750 + modifier.computedModifier;
  const { event, auditEntry } = await engine.ceiling.computeTrust(
    'eu-agent-001',
    rawScore,
    { agentContext }
  );
  console.log(`Trust: ${event.rawScore} → ${event.clampedScore}`);
  console.log(`Retention required: ${auditEntry.retentionRequired}`);

  // 6. Evaluate role gate
  const tier = getTierFromScore(event.clampedScore);
  const roleEval = await engine.roleGates.evaluate(
    'eu-agent-001',
    AgentRole.R_L2, // Planner
    tier,
    {
      agentId: 'eu-agent-001',
      contextConstraints: {},
    }
  );
  console.log(`Role gate decision: ${roleEval.decision}`);
}

main().catch(console.error);
```

---

## Statistics and Monitoring

Each service provides statistics:

```typescript
// Context statistics
const contextStats = engine.context.getStats();
// { deployments: 1, organizations: 1, agents: 1, activeOperations: 0 }

// Preset statistics
const presetStats = engine.presets.getStats();
// { aciPresets: 3, vorionPresets: 3, axiomPresets: 1, verifiedLineages: 0 }

// Provenance statistics
const provenanceStats = engine.provenance.getStats();
// { provenanceCount: 2, policyCount: 7, evaluationCount: 1, byCreationType: {...} }

// Ceiling enforcement statistics
const ceilingStats = engine.ceiling.getStats();
// { totalEvents: 1, totalAuditEntries: 1, complianceBreakdown: {...}, agentsWithAlerts: 0 }

// Role gate statistics
const roleGateStats = engine.roleGates.getStats();
// { totalEvaluations: 1, byDecision: { ALLOW: 1, DENY: 0, ESCALATE: 0 }, ... }
```

---

## Version Information

```typescript
import { PHASE6_VERSION } from '@vorion/atsf-core';

console.log(PHASE6_VERSION);
// { major: 1, minor: 0, patch: 0, label: 'phase6-trust-engine', decisions: ['Q1','Q2','Q3','Q4','Q5'] }
```
