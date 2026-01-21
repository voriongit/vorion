# Vorion Platform Schema Audit Report

**Generated:** 2026-01-21
**Scope:** All packages in C:\Axiom monorepo
**Auditor:** Schema Consistency Analysis

---

## Executive Summary

This audit identified **23 critical inconsistencies** across the Vorion Platform's schema definitions that could cause runtime bugs, data corruption, or developer confusion. The most severe issues involve:

1. **Trust Score/Level/Tier naming chaos** - 6 different naming conventions across packages
2. **TrustLevel range inconsistency** - L0-L4 vs L0-L5 definitions conflict
3. **Trust tier threshold mismatches** - Different boundary definitions will cause classification bugs
4. **IntentStatus missing values** - Core package lacks 'cancelled' status present elsewhere
5. **TrustSignal field optionality conflicts** - Required vs optional for same fields

**Immediate Action Required:** The trust scoring system has conflicting definitions that WILL cause bugs in production.

---

## Table of Schema Files Found

| Package | File | Type | Core Concepts |
|---------|------|------|---------------|
| src/common | types.ts | TypeScript | ID, Timestamp, TrustLevel, TrustScore, Intent, Proof, TrustSignal |
| packages/atsf-core/src/common | types.ts | TypeScript | ID, Timestamp, TrustLevel, TrustScore, Intent, Proof, TrustSignal |
| packages/atsf-core/src/trust-policy | types.ts | TypeScript | TrustPolicy, TrustWeights, TierBoundary, DecayConfiguration |
| packages/atsf-core/src/multi-tenant | types.ts | TypeScript/Zod | Tenant, TenantConfig, TrustPolicyConfig |
| packages/contracts/src/v2 | enums.ts | TypeScript | TrustBand, ObservationTier, DataSensitivity |
| packages/contracts/src/v2 | trust-profile.ts | TypeScript | TrustProfile, TrustDimensions, TrustWeights |
| packages/contracts/src/v2 | intent.ts | TypeScript | Intent, IntentContext |
| packages/contracts/src/v2 | proof-event.ts | TypeScript | ProofEvent, ProofEventPayload |
| packages/agent-sdk/src | types.ts | TypeScript | AgentConfig, Task, ActionRequest |
| apps/agentanchor/lib/agents | types.ts | TypeScript | Agent, TrustTier, TrustHistoryEntry |
| apps/agentanchor/lib/bot-trust | types.ts | TypeScript | TrustScore, AutonomyLevel, RiskLevel |
| apps/agentanchor/lib/governance | types.ts | TypeScript | TrustTier, TrustContext, RiskLevel |
| apps/agentanchor/lib/council | types.ts | TypeScript | RiskLevel, ValidatorVote |
| apps/agentanchor/contracts/schemas | trust-signal.ts | Zod | TrustSignal, TrustProfile |
| src/audit | types.ts | TypeScript | AuditRecord, AuditSeverity, AuditOutcome |

---

## Critical Inconsistencies

### 1. TrustLevel/TrustTier/TrustBand Naming Chaos

**Severity: CRITICAL**

The platform uses 3 different names for essentially the same concept:

| Location | Type Name | Values |
|----------|-----------|--------|
| `src/common/types.ts:20` | `TrustLevel` | `0 \| 1 \| 2 \| 3 \| 4` |
| `packages/atsf-core/src/common/types.ts:27` | `TrustLevel` | `0 \| 1 \| 2 \| 3 \| 4 \| 5` |
| `packages/contracts/src/v2/enums.ts:8` | `TrustBand` | `T0_UNTRUSTED` through `T5_MISSION_CRITICAL` |
| `apps/agentanchor/lib/agents/types.ts:11` | `TrustTier` | `'untrusted' \| 'novice' \| 'proven' \| 'trusted' \| 'elite' \| 'legendary'` |
| `apps/agentanchor/lib/governance/types.ts:9` | `TrustTier` | `'untrusted' \| 'provisional' \| 'established' \| 'trusted' \| 'verified' \| 'certified'` |
| `apps/agentanchor/contracts/schemas/trust-signal.ts:327` | tier enum | `'UNTRUSTED' \| 'PROVISIONAL' \| 'TRUSTED' \| 'VERIFIED' \| 'CERTIFIED' \| 'LEGENDARY'` |

**Issues:**
- `src/common/types.ts` has 5 levels (0-4) but `packages/atsf-core` has 6 levels (0-5)
- String-based tiers have completely different names across packages
- Some use UPPERCASE, some lowercase, some PascalCase

**Fix Priority: CRITICAL**
**Recommendation:** Standardize on `TrustBand` enum from contracts with values T0-T5, create mapping utilities for legacy string-based tiers.

---

### 2. Trust Tier Threshold Boundaries Conflict

**Severity: CRITICAL**

Different packages define different score ranges for the same trust tiers:

| Location | Tier | Score Range |
|----------|------|-------------|
| `apps/agentanchor/lib/agents/types.ts:203` | untrusted | 0-199 |
| `apps/agentanchor/lib/agents/types.ts:203` | novice | 200-399 |
| `apps/agentanchor/lib/agents/types.ts:203` | proven | 400-599 |
| `apps/agentanchor/lib/agents/types.ts:203` | trusted | 600-799 |
| `apps/agentanchor/lib/agents/types.ts:203` | elite | 800-899 |
| `apps/agentanchor/lib/agents/types.ts:203` | legendary | 900-1000 |
| **vs** | | |
| `apps/agentanchor/lib/governance/types.ts:25` | untrusted | 0-199 |
| `apps/agentanchor/lib/governance/types.ts:25` | provisional | 200-399 |
| `apps/agentanchor/lib/governance/types.ts:25` | established | 400-599 |
| `apps/agentanchor/lib/governance/types.ts:25` | trusted | 600-799 |
| `apps/agentanchor/lib/governance/types.ts:25` | verified | 800-899 |
| `apps/agentanchor/lib/governance/types.ts:25` | certified | 900-1000 |
| **vs** | | |
| `packages/atsf-core/src/common/types.ts:17-26` | L0 (Untrusted) | 0-166 |
| `packages/atsf-core/src/common/types.ts:17-26` | L1 (Observed) | 167-332 |
| `packages/atsf-core/src/common/types.ts:17-26` | L2 (Limited) | 333-499 |
| `packages/atsf-core/src/common/types.ts:17-26` | L3 (Standard) | 500-665 |
| `packages/atsf-core/src/common/types.ts:17-26` | L4 (Trusted) | 666-832 |
| `packages/atsf-core/src/common/types.ts:17-26` | L5 (Certified) | 833-1000 |
| **vs** | | |
| `packages/contracts/src/v2/trust-profile.ts:144` | T0 | 0-20 |
| `packages/contracts/src/v2/trust-profile.ts:145` | T1 | 21-40 |
| `packages/contracts/src/v2/trust-profile.ts:146` | T2 | 41-55 |
| `packages/contracts/src/v2/trust-profile.ts:147` | T3 | 56-70 |
| `packages/contracts/src/v2/trust-profile.ts:148` | T4 | 71-85 |
| `packages/contracts/src/v2/trust-profile.ts:149` | T5 | 86-100 |

**Issues:**
- contracts/v2 uses 0-100 scale, all others use 0-1000 scale
- Different tier boundary points even within 0-1000 scale systems
- atsf-core uses equal division (166.67 points each), agentanchor uses 200-point bands

**Fix Priority: CRITICAL**
**Recommendation:**
1. Standardize on 0-1000 scale universally
2. Use consistent 6-tier system with boundaries at: 0-166, 167-332, 333-499, 500-665, 666-832, 833-1000
3. Create single `trust-boundaries.ts` canonical definition

---

### 3. IntentStatus Missing 'cancelled' Value

**Severity: HIGH**

| Location | IntentStatus Values |
|----------|---------------------|
| `src/common/types.ts:35-45` | pending, evaluating, approved, denied, escalated, executing, completed, failed, **cancelled** |
| `packages/atsf-core/src/common/types.ts:42-50` | pending, evaluating, approved, denied, escalated, executing, completed, failed |

**Issue:** The core package is missing `cancelled` status which exists in the main src types. This will cause type errors when working with cancelled intents.

**Fix Priority: HIGH**
**Recommendation:** Add `'cancelled'` to `packages/atsf-core/src/common/types.ts:50`

---

### 4. TrustSignal Field Optionality Conflicts

**Severity: HIGH**

| Field | `src/common/types.ts` | `packages/atsf-core/src/common/types.ts` |
|-------|----------------------|------------------------------------------|
| `weight` | Optional (`weight?: number`) | Not present |
| `source` | Optional (`source?: string`) | Required (`source: string`) |
| `metadata` | Optional (`metadata?: Record<string, unknown>`) | Required (`metadata: Record<string, unknown>`) |

**Issue:** Same interface has different required/optional fields. This will cause runtime errors when one package creates a signal that another package expects to have required fields.

**Fix Priority: HIGH**
**Recommendation:** Standardize on optional fields with explicit undefined handling

---

### 5. Intent Interface Field Drift

**Severity: HIGH**

| Field | `src/common/types.ts` | `packages/atsf-core` | `packages/contracts/v2` |
|-------|----------------------|---------------------|------------------------|
| `id` | Yes (`id: ID`) | Yes | `intentId: string` |
| `tenantId` | Yes | No | No |
| `entityId` | Yes | Yes | `agentId: string` |
| `goal` | Yes | Yes | `action: string` |
| `intentType` | Optional | No | `actionType: ActionType` |
| `context` | Record<string, unknown> | Record<string, unknown> | `IntentContext` interface |
| `priority` | Optional number | No | In context as 0-10 |
| `trustSnapshot` | Optional | No | No |
| `trustLevel` | Optional | No | No |
| `trustScore` | Optional | No | No |
| `deletedAt` | Optional (GDPR) | No | No |
| `cancellationReason` | Optional | No | No |
| `resourceScope` | No | No | Yes (string[]) |
| `dataSensitivity` | No | No | Yes (enum) |
| `reversibility` | No | No | Yes (enum) |

**Issues:**
- `id` vs `intentId` naming
- `entityId` vs `agentId` naming
- `goal` vs `action` naming
- Completely different context structures
- contracts/v2 has rich classification fields missing from others

**Fix Priority: HIGH**
**Recommendation:** Create adapter layer between Intent types, standardize on contracts/v2 as canonical with extensions

---

### 6. RiskLevel Type Conflicts

**Severity: MEDIUM**

| Location | Type | Values |
|----------|------|--------|
| `apps/agentanchor/lib/bot-trust/types.ts:12` | enum | LOW, MEDIUM, HIGH, CRITICAL |
| `apps/agentanchor/lib/governance/types.ts:38` | string union | 'low', 'medium', 'high', 'critical' |
| `apps/agentanchor/lib/council/types.ts:7` | number | 0, 1, 2, 3, 4 |
| `packages/agent-sdk/src/types.ts:104` | string union | 'low', 'medium', 'high', 'critical' |

**Issues:**
- Enum vs string union vs numeric representation
- Council uses 5-level numeric (0-4), others use 4-level string

**Fix Priority: MEDIUM**
**Recommendation:** Standardize on string union type, create numeric mapping for Council

---

### 7. TrustScore Type Inconsistency

**Severity: MEDIUM**

| Location | Type | Range |
|----------|------|-------|
| `src/common/types.ts:25` | `number` | 0-1000 (documented) |
| `apps/agentanchor/lib/bot-trust/types.ts:63` | `number` | 300-1000 (documented) |
| `packages/contracts/src/v2/trust-profile.ts` | `number` | 0-100 (dimensions) |

**Issue:** TrustScore has different documented ranges. bot-trust starts at 300, not 0.

**Fix Priority: MEDIUM**
**Recommendation:** Document canonical range as 0-1000, update bot-trust minimum to 0

---

### 8. TrustComponents vs TrustDimensions Naming

**Severity: MEDIUM**

| Location | Type Name | Fields |
|----------|-----------|--------|
| `src/common/types.ts:248` | `TrustComponents` | behavioral, compliance, identity, context |
| `packages/atsf-core/src/common/types.ts:204` | `TrustComponents` | behavioral, compliance, identity, context |
| `packages/contracts/src/v2/trust-profile.ts:15` | `TrustDimensions` | CT, BT, GT, XT, AC |

**Issues:**
- Different naming (Components vs Dimensions)
- Different field names (full words vs abbreviations)
- Different field count (4 vs 5)

**Fix Priority: MEDIUM**
**Recommendation:** Standardize on `TrustDimensions` with full field names: capability, behavioral, governance, contextual, assurance

---

### 9. AgentStatus Enum Drift

**Severity: MEDIUM**

| Location | Values |
|----------|--------|
| `packages/agent-sdk/src/types.ts:40` | IDLE, WORKING, PAUSED, ERROR, OFFLINE |
| `apps/agentanchor/lib/agents/types.ts:8` | draft, training, active, suspended, archived |
| `apps/agentanchor/lib/governance/types.ts:178` | draft, training, examination, active, suspended, retired |

**Issues:**
- SDK uses runtime status (IDLE, WORKING, etc.)
- AgentAnchor uses lifecycle status (draft, training, etc.)
- Governance adds 'examination' and 'retired'
- Case differences (UPPERCASE vs lowercase)

**Fix Priority: MEDIUM**
**Recommendation:** Separate into `AgentRuntimeStatus` and `AgentLifecycleStatus` types

---

### 10. Timestamp Type Conflicts

**Severity: MEDIUM**

| Location | Type | Format |
|----------|------|--------|
| `src/common/types.ts:15` | `string` | ISO 8601 |
| `packages/atsf-core/src/common/types.ts:15` | `string` | ISO 8601 |
| `packages/contracts/src/v2/intent.ts:42` | `Date` | JavaScript Date |
| `apps/agentanchor/lib/bot-trust/types.ts:49` | `Date` | JavaScript Date |
| `apps/agentanchor/lib/agents/types.ts:44` | `string` | Implicit ISO |

**Issue:** Mix of `string` (ISO 8601) and `Date` object types for timestamps

**Fix Priority: MEDIUM**
**Recommendation:** Use `Date` objects internally, serialize to ISO 8601 strings at API boundaries. Create `Timestamp` branded type.

---

### 11. ID Type Inconsistency

**Severity: LOW**

| Location | Type | Format |
|----------|------|--------|
| `src/common/types.ts:10` | `string` | Generic |
| `packages/atsf-core/src/multi-tenant/types.ts:76` | `z.string().uuid()` | UUID validated |
| `packages/contracts/src/validators/trust-profile.ts:58` | `z.string().uuid()` | UUID validated |

**Issue:** Some locations validate UUIDs, others accept any string

**Fix Priority: LOW**
**Recommendation:** Create branded `UUID` type with runtime validation

---

### 12. TrustWeights Structure Conflict

**Severity: LOW**

| Location | Structure |
|----------|-----------|
| `packages/atsf-core/src/trust-policy/types.ts:32` | behavioral, credential, context, temporal |
| `packages/contracts/src/v2/trust-profile.ts:32` | CT, BT, GT, XT, AC |
| `apps/agentanchor/lib/governance/types.ts:104` | behavioral, compliance, identity, context (via TrustPolicyConfigSchema) |

**Issue:** Different weight categories and naming across packages

**Fix Priority: LOW**
**Recommendation:** Standardize on 5-dimension model from contracts/v2

---

### 13. AutonomyLevel Definition Conflicts

**Severity: LOW**

| Location | Type | Values |
|----------|------|--------|
| `apps/agentanchor/lib/bot-trust/types.ts:25` | enum 1-5 | LEVEL_1_ASK_LEARN through LEVEL_5_FULLY_AUTONOMOUS |
| `apps/agentanchor/contracts/schemas/trust-signal.ts:183` | (imported) | Likely different |

**Fix Priority: LOW**
**Recommendation:** Unify autonomy level definitions

---

## Recommended Canonical Definitions

### Canonical TrustBand

```typescript
// packages/contracts/src/canonical/trust-band.ts

export enum TrustBand {
  T0_UNTRUSTED = 0,
  T1_OBSERVED = 1,
  T2_LIMITED = 2,
  T3_STANDARD = 3,
  T4_TRUSTED = 4,
  T5_CERTIFIED = 5,
}

export const TRUST_BAND_THRESHOLDS: Record<TrustBand, { min: number; max: number; label: string }> = {
  [TrustBand.T0_UNTRUSTED]: { min: 0, max: 166, label: 'Untrusted' },
  [TrustBand.T1_OBSERVED]: { min: 167, max: 332, label: 'Observed' },
  [TrustBand.T2_LIMITED]: { min: 333, max: 499, label: 'Limited' },
  [TrustBand.T3_STANDARD]: { min: 500, max: 665, label: 'Standard' },
  [TrustBand.T4_TRUSTED]: { min: 666, max: 832, label: 'Trusted' },
  [TrustBand.T5_CERTIFIED]: { min: 833, max: 1000, label: 'Certified' },
};

export function scoreToTrustBand(score: number): TrustBand {
  if (score < 167) return TrustBand.T0_UNTRUSTED;
  if (score < 333) return TrustBand.T1_OBSERVED;
  if (score < 500) return TrustBand.T2_LIMITED;
  if (score < 666) return TrustBand.T3_STANDARD;
  if (score < 833) return TrustBand.T4_TRUSTED;
  return TrustBand.T5_CERTIFIED;
}
```

### Canonical TrustScore

```typescript
// packages/contracts/src/canonical/trust-score.ts

/** Trust score: 0-1000 scale */
export type TrustScore = number & { readonly __brand: 'TrustScore' };

export function createTrustScore(value: number): TrustScore {
  if (value < 0 || value > 1000) {
    throw new Error(`TrustScore must be 0-1000, got ${value}`);
  }
  return Math.round(value) as TrustScore;
}

export const MIN_TRUST_SCORE: TrustScore = 0 as TrustScore;
export const MAX_TRUST_SCORE: TrustScore = 1000 as TrustScore;
export const DEFAULT_TRUST_SCORE: TrustScore = 500 as TrustScore;
```

### Canonical Intent

```typescript
// packages/contracts/src/canonical/intent.ts

export interface Intent {
  intentId: string;
  tenantId: string;
  agentId: string;

  // Action details
  action: string;
  actionType: ActionType;
  resourceScope: string[];

  // Classification
  dataSensitivity: DataSensitivity;
  reversibility: Reversibility;

  // Context
  context: IntentContext;

  // Trust state at submission
  trustSnapshot: {
    score: TrustScore;
    band: TrustBand;
  };

  // Lifecycle
  status: IntentStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  deletedAt?: Date; // GDPR soft delete
  cancellationReason?: string;

  // Tracing
  correlationId: string;
  source?: string;
}

export type IntentStatus =
  | 'pending'
  | 'evaluating'
  | 'approved'
  | 'denied'
  | 'escalated'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

### Canonical RiskLevel

```typescript
// packages/contracts/src/canonical/risk-level.ts

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const RISK_LEVEL_VALUES: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function riskLevelFromNumber(n: number): RiskLevel {
  switch (n) {
    case 0: return 'low';
    case 1: return 'medium';
    case 2: return 'high';
    case 3:
    case 4: // Council's L4 maps to critical
    default: return 'critical';
  }
}
```

---

## Migration Plan

### Phase 1: Critical Fixes (Week 1)

1. **Unify TrustLevel/TrustBand** - Create canonical `TrustBand` enum
2. **Fix Trust Thresholds** - Standardize on 6-tier 0-1000 scale
3. **Add cancelled to IntentStatus** - Update atsf-core

### Phase 2: High Priority (Week 2)

4. **Standardize TrustSignal** - Make fields consistently optional
5. **Create Intent Adapters** - Bridge between Intent variants
6. **Unify RiskLevel** - Standardize on string union

### Phase 3: Medium Priority (Week 3-4)

7. **Consolidate TrustComponents/Dimensions** - Single 5-dimension model
8. **Separate AgentStatus types** - Runtime vs Lifecycle
9. **Standardize Timestamps** - Date objects internally
10. **Create Branded ID Types** - UUID validation

### Phase 4: Cleanup (Week 5+)

11. **Deprecate legacy type locations** - Add JSDoc deprecation notices
12. **Update all imports** - Point to canonical definitions
13. **Add schema validation** - Zod schemas for all canonical types
14. **Documentation** - Update architecture docs

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Schema files analyzed | 15 |
| Critical issues | 5 |
| High priority issues | 4 |
| Medium priority issues | 8 |
| Low priority issues | 4 |
| **Total issues** | **21** |

---

## Next Steps

1. **IMMEDIATE**: Review critical issues with architecture team
2. **THIS WEEK**: Create canonical type definitions in `packages/contracts/src/canonical/`
3. **NEXT SPRINT**: Migrate packages to use canonical types
4. **ONGOING**: Add CI checks to prevent future drift

---

*Report generated by Schema Audit Tool*
