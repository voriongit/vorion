# Phase 6: Architecture Decisions & Implementation Roadmap

**Date**: January 25, 2026  
**Status**: Design Clarifications Answered → Implementation Ready  
**Decision Authority**: Senior Architecture Review  

---

## Decision Summary Table

| Question | Choice | Rationale | Impact |
|----------|--------|-----------|--------|
| **Q1: Ceiling Enforcement** | Option A: Kernel-Level | Single enforcement point (unforgeable), dual logging (raw + clamped) | Simpler architecture, faster decisions, better audit trail |
| **Q2: Context Policy** | Option C: Immutable at Instantiation | Answer audit questions with certainty, multi-tenant via separate instances | Cleaner lifecycle, stronger compliance, slightly more instances |
| **Q3: Role Gates** | Option C: Dual-Layer | Kernel validation (fail-fast) + BASIS enforcement (policy flexibility) | Defense in depth, ~1ms latency, hot policy updates enabled |
| **Q4: Weight Presets** | Option C: Hybrid (Spec + Extensions) | Canonical presets in ACI spec, deployment deltas in Axiom | Spec stability + fast iteration, audit trail of divergence |
| **Q5: Creation Modifiers** | Option A: Instantiation Time | Creation type is immutable origin fact, corrections require migration | Trustworthy metadata, unforgeable history, audit trail is clear |

---

## Q1: Ceiling Enforcement - DECISION: Option A (Kernel-Level)

### Architecture

```typescript
// trust-kernel.ts
class TrustKernel {
  computeScore(agentId: string, metrics: TrustMetrics): TrustEvent {
    // Compute raw score (may exceed 1000)
    const rawScore = this.calculateRawScore(metrics);
    
    // Apply ceiling enforcement at kernel level
    const clampedScore = Math.min(rawScore, 1000);
    
    // Dual logging for analytics + enforcement
    const event: TrustEvent = {
      agentId,
      timestamp: Date.now(),
      raw_score: rawScore,           // For analytics/trending
      score: clampedScore,           // Enforced value (what policy sees)
      ceiling_applied: rawScore > 1000,
      metrics,
      // Audit trail shows both values
    };
    
    this.eventStore.log(event);
    return event;
  }
}
```

### Deployment Impact

✅ **Advantages**:
- Single source of truth (kernel cannot be bypassed)
- Audit events show exactly when ceiling was applied
- Policy layer always receives clamped scores (no surprises)
- Performance: Ceiling check is O(1), no distributed consensus needed

❌ **Trade-offs**:
- Raw scores only visible in audit logs (not in real-time APIs)
- Analytics tools must read event store for pre-ceiling values

### Implementation Checklist

- [ ] Add `raw_score` field to TrustEvent type
- [ ] Update TrustKernel.computeScore() to dual-log
- [ ] Add ceiling validation tests (verify score ≤ 1000 always returned to policy)
- [ ] Update audit trail schema to include raw_score
- [ ] Create analytics dashboard query for "raw score trending"

---

## Q2: Context Policy - DECISION: Option C (Immutable at Instantiation)

### Architecture

```typescript
// agent.ts
interface AgentConstructionOptions {
  id: string;
  context: 'local' | 'enterprise' | 'sovereign';  // Set at construction
  capabilities: Capability[];
  // ... other fields
}

class Agent {
  readonly context: Context;  // Readonly after construction
  
  constructor(options: AgentConstructionOptions) {
    this.context = options.context;  // Immutable
    // context cannot be changed after this point
  }
  
  // ✗ This method does NOT exist
  // setContext(newContext: Context) { ... }
}

// For multi-tenant: Create separate instances per context
const agents = {
  local: new Agent({ context: 'local', ... }),
  enterprise: new Agent({ context: 'enterprise', ... }),
  sovereign: new Agent({ context: 'sovereign', ... }),
};
```

### Governance Implications

**Audit Trail Guarantee**: Any question about "what context was this agent operating under at time T?" has a definitive answer:
- Agent was created with context = X
- Context never changed
- All decisions made within that context boundary

**Multi-Tenant Deployment**:
```typescript
// Organization deploying agents in different contexts
class OrganizationAgentFactory {
  createAgent(orgId: string, config: AgentConfig, context: 'local' | 'enterprise') {
    // Create NEW instance per context
    return new Agent({
      ...config,
      id: `${orgId}:${config.name}:${context}`,
      context,
    });
  }
}

// Result: One logical agent, three instances
const agent_v1_local = factory.createAgent('acme', agentConfig, 'local');
const agent_v1_enterprise = factory.createAgent('acme', agentConfig, 'enterprise');
const agent_v1_sovereign = factory.createAgent('acme', agentConfig, 'sovereign');
```

### Deployment Impact

✅ **Advantages**:
- Audit trail is simple: "context was X, immutable from construction"
- Governance compliance: Easy to answer "what rules applied?"
- Instance isolation: Each context instance has its own trust score

⚠️ **Trade-offs**:
- More agent instances (3x for full multi-tenant)
- No runtime context switching (by design)

### Implementation Checklist

- [ ] Mark Agent.context as `readonly`
- [ ] Remove any `setContext()` methods from codebase
- [ ] Add AgentFactory pattern for multi-context deployments
- [ ] Create migration utility for "cloning to new context" (creates new instance)
- [ ] Update documentation: "Context is set at construction, never changes"
- [ ] Add tests: Verify readonly enforcement

---

## Q3: Role Gates - DECISION: Option C (Dual-Layer)

### Architecture

```
Request → [Kernel Validation] → [Score Computation] → [BASIS Enforcement] → Response
             ↓ fail-fast               (compute score)         ↓ policy denial
        Does role+tier combo            using valid            Apply current
        exist in matrix?                 role gate              policy rules
```

### Implementation

```typescript
// trust-kernel.ts - Layer 0: Validation
class TrustKernel {
  validateRoleGate(role: Role, tier: TrustTier): boolean {
    // Fail-fast: Does this role+tier combination exist?
    return ROLE_GATE_MATRIX[role][tier] !== null;
  }
  
  computeScore(agentId: string, role: Role, metrics: TrustMetrics): TrustEvent | Error {
    // Validate role gate EXISTS (fail-fast)
    if (!this.validateRoleGate(role, metrics.currentTier)) {
      return new Error(`Invalid role+tier: ${role}/${metrics.currentTier}`);
    }
    
    // Compute score (only if gate is valid)
    return this.calculateScore(metrics);
  }
}

// basis/enforce-layer.ts - Layer 4: Policy Enforcement
class BASISEnforceLayer {
  private policyEngine: PolicyEngine;
  
  applyRoleGatePolicy(event: TrustEvent, role: Role): boolean {
    // Check current policy rules
    const policy = this.policyEngine.getRoleGatePolicy(role);
    
    // Example: T0/T1 require human approval
    if (policy.requires_approval && event.score < 300) {
      return this.escalateToHuman(event, role);
    }
    
    // Example: T4/T5 require attestation
    if (policy.requires_attestation && event.score > 700) {
      return this.verifyAttestation(event);
    }
    
    return true;  // Policy allows
  }
}
```

### Defense in Depth

**Kernel validates** → "Is this gate valid?" (structural check)  
**Basis enforces** → "Does policy allow?" (runtime policy check)

This prevents two classes of attack:
1. Invalid role+tier combos (caught by kernel)
2. Valid-but-not-allowed combinations (caught by BASIS)

### Deployment Impact

✅ **Advantages**:
- Hot policy updates: Change BASIS policies without kernel rebuild
- Fail-fast: Invalid gates error immediately (no wasted computation)
- Auditability: Two-stage validation visible in trace logs

⚠️ **Trade-offs**:
- ~1ms additional latency for dual validation
- Requires governance team to manage both kernel matrix AND BASIS policies
- Policies can drift from matrix (mitigated by clear ownership)

### Implementation Checklist

- [ ] Create ROLE_GATE_MATRIX constant (kernel validation source)
- [ ] Implement TrustKernel.validateRoleGate() (structural validation)
- [ ] Implement BASISEnforceLayer.applyRoleGatePolicy() (runtime enforcement)
- [ ] Create PolicyEngine for managing role gate policies
- [ ] Add tracing for dual-layer validation (log both stages)
- [ ] Document role gate policy DSL for governance team
- [ ] Add tests: Valid gate rejected by policy, invalid gate fails early

---

## Q4: Weight Presets - DECISION: Option C (Hybrid: Spec + Extensions)

### Architecture

**@vorionsys/aci-spec** (Canonical Reference)
```typescript
// packages/aci-spec/src/trust-presets.ts
export const TRUST_PRESETS = {
  // Standard presets - these are the canonical reference
  high_confidence: {
    observability_weight: 0.30,
    capability_weight: 0.25,
    behavior_weight: 0.30,
    context_weight: 0.15,
  },
  governance_focus: {
    observability_weight: 0.40,
    capability_weight: 0.10,
    behavior_weight: 0.30,
    context_weight: 0.20,
  },
  // ... other presets
} as const;

export type TrustPresetName = keyof typeof TRUST_PRESETS;
```

**Axiom** (Deployment-Specific Deltas)
```typescript
// axiom/src/trust/presets.ts
import { TRUST_PRESETS as SPEC_PRESETS } from '@vorionsys/aci-spec';

export const AXIOM_PRESET_DELTAS: Record<string, Partial<typeof SPEC_PRESETS['high_confidence']>> = {
  high_confidence: {
    // ✓ Canonical from ACI spec
    observability_weight: 0.30,
    capability_weight: 0.25,
    
    // △ Axiom override: Emphasize behavior history for Vorion agents
    behavior_weight: 0.35,  // Was 0.30, +0.05 delta
    
    // ✓ Keep spec value
    context_weight: 0.15,
  },
};

// At runtime: Merge canonical + deltas
export const AXIOM_PRESETS = mergePresets(SPEC_PRESETS, AXIOM_PRESET_DELTAS);

function mergePresets(canonical, deltas) {
  return Object.entries(canonical).reduce((acc, [name, spec]) => {
    acc[name] = { ...spec, ...deltas[name] };
    return acc;
  }, {});
}
```

### Audit Trail

```typescript
// axiom/src/trust/audit.ts
export function getPresetAudit(presetName: string) {
  const spec = SPEC_PRESETS[presetName];
  const axiom = AXIOM_PRESETS[presetName];
  
  // Show exactly what changed
  return {
    preset: presetName,
    canonical_source: '@vorionsys/aci-spec',
    deltas: Object.entries(axiom).reduce((acc, [key, value]) => {
      if (value !== spec[key]) {
        acc[key] = { from: spec[key], to: value };
      }
      return acc;
    }, {}),
  };
}

// Output:
// {
//   preset: 'high_confidence',
//   canonical_source: '@vorionsys/aci-spec',
//   deltas: {
//     behavior_weight: { from: 0.30, to: 0.35 }
//   }
// }
```

### Deployment Impact

✅ **Advantages**:
- ACI spec remains stable (good for standards adoption)
- Axiom can iterate fast on preset tuning
- Clear audit trail: What changed, why, from what baseline
- Easy to compare Axiom tuning vs. spec

⚠️ **Trade-offs**:
- Requires delta-tracking mechanism
- Governance must review/approve deltas
- Divergence could fragment implementations (mitigated by clear delta auditing)

### Implementation Checklist

- [ ] Create @vorionsys/aci-spec/trust-presets.ts with canonical presets
- [ ] Create axiom/presets.ts with delta tracking
- [ ] Implement mergePresets() utility
- [ ] Create getPresetAudit() function
- [ ] Add tests: Verify deltas correctly override spec
- [ ] Document preset governance policy
- [ ] Create preset tuning process: spec → proposal → delta → audit

---

## Q5: Creation Modifiers - DECISION: Option A (Instantiation Time)

### Architecture

```typescript
// agent.ts
interface AgentCreationType {
  type: 'fresh' | 'cloned' | 'evolved' | 'promoted' | 'imported';
  parentId?: string;  // For cloned/evolved/promoted
}

interface AgentConstructionOptions {
  id: string;
  creationType: AgentCreationType;  // Set at construction
  capabilities: Capability[];
  // ... other fields
}

class Agent {
  readonly creationType: AgentCreationType;  // Immutable
  readonly createdAt: Date;
  readonly creationHash: string;  // Cryptographic proof of origin
  
  constructor(options: AgentConstructionOptions) {
    this.creationType = options.creationType;
    this.createdAt = new Date();
    this.creationHash = hashCreation({
      agentId: options.id,
      creationType: options.creationType,
      timestamp: this.createdAt,
    });
  }
}
```

### Trust Score Modifiers

```typescript
// trust-engine/creation-modifiers.ts
const CREATION_TYPE_MODIFIERS: Record<AgentCreationType['type'], number> = {
  fresh: 0,          // T3 baseline (500)
  cloned: -50,       // Inherit parent risk
  evolved: +25,      // Improvement from parent
  promoted: +50,     // Explicit elevation
  imported: -100,    // External, unvetted
};

function applyCreationModifier(baselineScore: number, creationType: AgentCreationType): number {
  const modifier = CREATION_TYPE_MODIFIERS[creationType.type];
  return Math.max(0, Math.min(1000, baselineScore + modifier));
}

// Example:
const freshAgent = new Agent({ creationType: { type: 'fresh' } });
// Initial score = T3_BASELINE(500) + FRESH_MODIFIER(0) = 500

const clonedAgent = new Agent({ 
  creationType: { type: 'cloned', parentId: freshAgent.id } 
});
// Initial score = T3_BASELINE(500) + CLONED_MODIFIER(-50) = 450
```

### Immutability & Migration

```typescript
// agent.ts - Immutable by design
const agent = new Agent({
  creationType: { type: 'cloned', parentId: 'parent-123' },
  // ✓ This is now permanent
});

// ✗ Cannot change creation type
// agent.creationType = { type: 'promoted' }  // TypeError: readonly

// If creation type is wrong: MIGRATE (create new agent)
class Agent {
  static async migrate(
    sourceAgent: Agent,
    newCreationType: AgentCreationType,
    reason: string
  ): Promise<Agent> {
    // Create new agent with corrected creation type
    const migratedAgent = new Agent({
      ...sourceAgent.config,
      id: `${sourceAgent.id}:migrated:${Date.now()}`,
      creationType: newCreationType,
    });
    
    // Create migration audit event
    const event = {
      type: 'agent_migration',
      sourceAgentId: sourceAgent.id,
      targetAgentId: migratedAgent.id,
      creationTypeChanged: {
        from: sourceAgent.creationType,
        to: newCreationType,
      },
      reason,
      timestamp: Date.now(),
      migratedBy: /* current user/service */,
    };
    
    await auditLog.record(event);
    return migratedAgent;
  }
}

// Usage: If we discover agent was created as 'cloned' but should be 'evolved'
const corrected = await Agent.migrate(
  wrongAgent,
  { type: 'evolved', parentId: 'parent-456' },
  'Initial parent ID was incorrect - corrected to actual parent'
);
```

### Deployment Impact

✅ **Advantages**:
- Creation metadata is unforgeable (immutable from construction)
- Audit trail is clear: agent origin is factual, not mutable
- Trust score history is reliable: modifiers don't change retroactively
- Corrections are explicit: Migration creates audit event

⚠️ **Trade-offs**:
- Cannot "change your mind" about creation type (by design)
- Corrections require migration (ceremony, but that's the point)
- Agent IDs change on migration (new identity for new creation context)

### Implementation Checklist

- [ ] Add `creationType` to Agent constructor
- [ ] Mark `creationType` as `readonly`
- [ ] Implement `creationHash` for cryptographic proof
- [ ] Create CREATION_TYPE_MODIFIERS mapping
- [ ] Implement `applyCreationModifier()` in TrustEngine
- [ ] Implement `Agent.migrate()` static method
- [ ] Add migration audit event schema
- [ ] Add tests: Verify readonly enforcement, modifier application, migration events

---

## Phase 6 Implementation Timeline

### Week 1-2: Architecture Validation & Setup
- [ ] Create architecture decision documents (this file + implementation guides)
- [ ] Set up test suites for each layer (kernel, governance, observability, gating, remediation, semantic)
- [ ] Implement type definitions for all decisions
- [ ] Create performance testing harness

### Week 3: Kernel Hardening (Ceiling Enforcement + Dual Logging)
- [ ] Implement TrustKernel ceiling enforcement (Option A)
- [ ] Add dual logging (raw_score + clamped_score)
- [ ] Create audit trail schema updates
- [ ] 40 test cases (ceiling edge cases, logging verification)

### Week 4: Context & Creation (Immutable At Instantiation)
- [ ] Implement readonly Agent.context
- [ ] Implement readonly Agent.creationType
- [ ] Create Agent migration utilities
- [ ] Create multi-context deployment factory pattern
- [ ] 30 test cases (immutability enforcement, migration events)

### Week 5: Dual-Layer Role Gates
- [ ] Implement TrustKernel role gate validation
- [ ] Implement BASISEnforceLayer policy application
- [ ] Create ROLE_GATE_MATRIX constant
- [ ] Create PolicyEngine for runtime policy management
- [ ] 35 test cases (dual-layer validation, policy hot updates)

### Week 6: Weight Presets (Spec + Deltas)
- [ ] Publish canonical presets in @vorionsys/aci-spec
- [ ] Implement delta-tracking in Axiom
- [ ] Create mergePresets() utility
- [ ] Create preset audit functions
- [ ] 25 test cases (delta merging, audit trail accuracy)

### Week 7: Integration & Efficiency Metrics
- [ ] Integrate all layers (kernel → governance → observability → gating → remediation)
- [ ] Implement 6th trust dimension (efficiency metrics)
- [ ] Create system-wide integration tests
- [ ] 50 test cases (multi-layer flows, efficiency signal validation)

### Week 8: Hardening & Validation
- [ ] Performance testing (P99 latency, throughput)
- [ ] Security review (all decisions vs. threat model)
- [ ] Documentation (decision rationales, operator guides)
- [ ] Final validation suite (80+ tests across all 6 layers)

**Expected Outcome**: Phase 6 complete, trust engine ready for security hardening phase (DPoP, TEE, semantic governance).

---

## Decision Validation Checklist

Use this to verify implementation matches decisions:

### Q1 (Ceiling Enforcement)
- [ ] Kernel computes raw_score without ceiling
- [ ] Score returned to policy is always ≤ 1000
- [ ] Audit events contain both raw_score and clamped score
- [ ] Analytics can access raw_score from event store

### Q2 (Context Policy)
- [ ] Agent.context is marked readonly
- [ ] setContext() method does not exist
- [ ] Multi-tenant deployments create separate agent instances
- [ ] Audit trail clearly shows context at agent creation

### Q3 (Role Gates)
- [ ] Kernel validates role+tier combo exists (fail-fast)
- [ ] BASIS layer applies policy rules (runtime enforcement)
- [ ] Invalid gates error immediately (no wasted computation)
- [ ] Trace logs show both validation stages

### Q4 (Weight Presets)
- [ ] @vorionsys/aci-spec exports canonical presets
- [ ] Axiom has delta tracking from spec
- [ ] Audit function shows what changed from spec
- [ ] Merging correctly applies deltas

### Q5 (Creation Modifiers)
- [ ] Agent.creationType is readonly
- [ ] Creation type set at instantiation
- [ ] Modifiers applied to initial score
- [ ] Migration creates new agent + audit event

---

## Success Criteria

Phase 6 is complete when:

✅ All 5 architecture decisions implemented as designed  
✅ 200+ unit tests passing (40+35+35+25+50+15)  
✅ Integration tests verify all layers work together  
✅ Performance benchmarks show <1ms latency for trust decisions  
✅ Security review validates defense-in-depth approach  
✅ Audit trails demonstrate immutability & compliance  
✅ Documentation explains rationale for all decisions  

**Next Phase**: Security hardening (DPoP, TEE binding, pairwise DIDs, semantic governance)
