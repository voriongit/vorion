# SPEC-001: Zero-Knowledge Audit & Merkle Tree Enhancement

**Version:** 1.0.0-draft
**Status:** Draft
**Authors:** Winston (Architect), Amelia (Developer), Murat (Test Architect)
**Date:** 2026-01-19
**Stakeholder:** RION

---

## Executive Summary

This specification defines enhancements to the Vorion proof chain system:

1. **Merkle Tree Aggregation** — Optional higher-security layer for batch verification and external anchoring
2. **Zero-Knowledge Proofs** — Privacy-preserving trust score verification via ZK circuits
3. **Tiered Audit System** — Full, selective, and ZK-based audit modes

**Core Principle:** The linear hash chain and signatures remain **mandatory** for all deployments. Merkle and ZK layers are **optional enhancements** that build upon—not replace—the baseline security model.

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Security Model](#2-security-model)
3. [Trust Score Decay Model](#3-trust-score-decay-model)
4. [Merkle Tree Aggregation](#4-merkle-tree-aggregation)
5. [Zero-Knowledge Proof System](#5-zero-knowledge-proof-system)
6. [Audit Service](#6-audit-service)
7. [Database Schema](#7-database-schema)
8. [API Specification](#8-api-specification)
9. [Implementation Plan](#9-implementation-plan)
10. [Test Requirements](#10-test-requirements)
11. [Security Considerations](#11-security-considerations)

---

## 1. Motivation

### 1.1 Current State

The Vorion proof chain provides:
- Linear hash-linking between consecutive proofs
- Cryptographic signatures (Ed25519/ECDSA) for non-repudiation
- Per-entity chain isolation
- Full audit trail for compliance

### 1.2 Gaps Identified

| Gap | Impact |
|-----|--------|
| No batch verification | O(n) verification for large chains |
| No external anchoring | Trust relies solely on Vorion infrastructure |
| No privacy-preserving verification | Full disclosure required for trust assertions |
| Single audit mode | All-or-nothing transparency |

### 1.3 Goals

1. Enable O(log n) verification for individual proofs via Merkle trees
2. Support external anchoring (blockchain, TSA) for third-party trust
3. Allow entities to prove trust claims without revealing sensitive data
4. Provide flexible audit modes for different use cases

---

## 2. Security Model

### 2.1 Security Tiers

| Tier | Linear Chain | Signatures | Merkle Roots | External Anchor | ZK Proofs |
|------|--------------|------------|--------------|-----------------|-----------|
| **Baseline** (required) | YES | YES | - | - | - |
| **Enhanced** | YES | YES | YES | - | - |
| **Anchored** | YES | YES | YES | YES | - |
| **Privacy-Preserving** | YES | YES | Optional | Optional | YES |

### 2.2 Non-Negotiable Requirements

The following are **mandatory** for all configurations:

```typescript
interface BaselineSecurityConfig {
  // These cannot be disabled
  linearHashChain: true;      // Every proof links to predecessor
  signatureRequired: true;    // Every proof cryptographically signed
  hashAlgorithm: 'SHA-256';   // Consistent hash function
  signatureAlgorithms: ['Ed25519', 'ECDSA-P256'];
}
```

### 2.3 Threat Model

| Threat | Baseline Mitigation | Enhanced Mitigation |
|--------|---------------------|---------------------|
| Proof tampering | Hash chain breaks | Merkle root invalidates |
| Proof insertion | Chain position gap detected | Merkle tree recomputation required |
| Proof deletion | previousHash mismatch | External anchor proves existence |
| Repudiation | Signature verification | Timestamped external anchor |
| Score disclosure | N/A (full disclosure) | ZK proof reveals nothing |

---

## 3. Trust Score Decay Model

The trust engine implements a **stepped decay model** designed to encourage consistent engagement while providing clear, predictable consequences for inactivity.

### 3.1 Design Philosophy

Unlike continuous exponential decay, Vorion uses **discrete step decay** with the following properties:

1. **Predictability** — Entities know exactly when score drops occur
2. **Grace periods** — Activity before a milestone resets the decay clock
3. **Escalating intervals** — Early drops are frequent (behavioral nudges), later drops are infrequent but significant
4. **Half-life anchor** — 182 days (6 months) to reach 50% of original score

### 3.2 Decay Milestones

| Days Inactive | Decay Factor | Resulting Score (from 100) | Purpose |
|---------------|--------------|---------------------------|---------|
| 0-6 | 1.000 | 100 | Grace period — no penalty |
| 7 | 0.930 | **~93** | Early warning — gentle nudge |
| 14 | 0.875 | **~87** | Two-week checkpoint |
| 28 | 0.800 | **~80** | One-month threshold |
| 56 | 0.700 | **~70** | Two-month mark |
| 112 | 0.580 | **~58** | Four-month significant drop |
| 182 | 0.500 | **50** | **Half-life reached** |
| 182+ | Continues | <50 | Extended inactivity |

### 3.3 Milestone Doubling Pattern

The intervals follow a **doubling progression** after the initial two-week period:

```
Day 7 ──▶ Day 14 ──▶ Day 28 ──▶ Day 56 ──▶ Day 112 ──▶ Day 182
    7 days    14 days    28 days    56 days     70 days
     (1x)      (2x)       (4x)       (8x)      (to half-life)
```

**Behavioral rationale:**
- **Days 7-14:** Frequent early drops create urgency without panic
- **Days 28-56:** Monthly cadence aligns with business cycles
- **Days 112-182:** Longer intervals for entities with legitimate extended gaps

### 3.4 Implementation

```typescript
interface DecayMilestone {
  days: number;
  factor: number;
  label: string;
}

const DECAY_MILESTONES: DecayMilestone[] = [
  { days: 7,   factor: 0.930, label: 'early_warning' },
  { days: 14,  factor: 0.875, label: 'two_week' },
  { days: 28,  factor: 0.800, label: 'one_month' },
  { days: 56,  factor: 0.700, label: 'two_month' },
  { days: 112, factor: 0.580, label: 'four_month' },
  { days: 182, factor: 0.500, label: 'half_life' },
];

const HALF_LIFE_DAYS = 182;

export function calculateDecayedScore(
  baseScore: number,
  daysSinceLastActivity: number,
): DecayResult {
  // No decay within grace period
  if (daysSinceLastActivity < 7) {
    return {
      score: baseScore,
      decayApplied: false,
      nextMilestone: { days: 7, inDays: 7 - daysSinceLastActivity },
    };
  }

  // Find applicable milestone
  let appliedMilestone: DecayMilestone | null = null;
  let nextMilestone: DecayMilestone | null = null;

  for (let i = 0; i < DECAY_MILESTONES.length; i++) {
    const milestone = DECAY_MILESTONES[i];
    if (daysSinceLastActivity >= milestone.days) {
      appliedMilestone = milestone;
      nextMilestone = DECAY_MILESTONES[i + 1] ?? null;
    } else {
      nextMilestone = milestone;
      break;
    }
  }

  // Apply stepped decay
  const decayedScore = appliedMilestone
    ? baseScore * appliedMilestone.factor
    : baseScore;

  // For extended inactivity beyond 182 days, continue decay
  if (daysSinceLastActivity > HALF_LIFE_DAYS) {
    const additionalDays = daysSinceLastActivity - HALF_LIFE_DAYS;
    const additionalHalfLives = additionalDays / HALF_LIFE_DAYS;
    const extendedFactor = Math.pow(0.5, additionalHalfLives);
    return {
      score: baseScore * 0.5 * extendedFactor,
      decayApplied: true,
      milestone: 'extended',
      nextMilestone: null,
    };
  }

  return {
    score: decayedScore,
    decayApplied: !!appliedMilestone,
    milestone: appliedMilestone?.label,
    nextMilestone: nextMilestone
      ? { days: nextMilestone.days, inDays: nextMilestone.days - daysSinceLastActivity }
      : null,
  };
}
```

### 3.5 Recovery Mechanics

When an entity resumes activity, the decay clock resets:

```typescript
interface RecoveryEvent {
  entityId: ID;
  previousScore: number;
  activityType: string;
  recoveryBonus?: number;  // Optional positive signal bonus
}

export function processRecovery(event: RecoveryEvent): RecoveryResult {
  // Reset decay clock to day 0
  const newLastActivity = new Date();

  // Apply recovery bonus if positive signal
  const bonusScore = event.recoveryBonus ?? 0;
  const newScore = Math.min(100, event.previousScore + bonusScore);

  return {
    score: newScore,
    lastActivity: newLastActivity,
    decayResetTo: 0,
    nextMilestone: { days: 7, inDays: 7 },
  };
}
```

### 3.6 Decay Visualization

```
Score
  │
100├─────┐
   │     │
 93├─────┴──┐                                    Day 7: First drop
   │        │
 87├────────┴──┐                                 Day 14: Second drop
   │           │
 80├───────────┴──────┐                          Day 28: Monthly threshold
   │                  │
 70├──────────────────┴──────────┐               Day 56: Two months
   │                             │
 58├─────────────────────────────┴───────────┐   Day 112: Four months
   │                                         │
 50├─────────────────────────────────────────┴─  Day 182: Half-life
   │
   └──────────────────────────────────────────────▶ Days
        7   14   28        56           112        182
```

### 3.7 ZK Integration with Decay

ZK proofs can attest to decay status without revealing exact scores:

| ZK Claim | Public Input | Proves |
|----------|--------------|--------|
| `score_gte_threshold` | threshold=70 | Score hasn't decayed below 70 |
| `decay_milestone_lte` | milestone=28 | Entity active within last 28 days |
| `no_half_life_reached` | — | Entity has never hit 182-day inactivity |

```typescript
// Example: Prove "I've been active within 28 days" without revealing exact activity
const zkProof = await zkService.generateProof({
  entityId,
  claim: 'decay_milestone_lte',
  params: { maxDaysInactive: 28 },
});
```

### 3.8 Configuration

```typescript
interface DecayConfig {
  // Core settings
  halfLifeDays: number;              // Default: 182
  gracePeriodDays: number;           // Default: 7

  // Milestone customization (optional)
  customMilestones?: DecayMilestone[];

  // Recovery settings
  recoveryBonusEnabled: boolean;     // Default: true
  maxRecoveryBonus: number;          // Default: 5 points

  // Notification triggers
  notifyAtMilestones: number[];      // Default: [7, 28, 112]
}

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 182,
  gracePeriodDays: 7,
  recoveryBonusEnabled: true,
  maxRecoveryBonus: 5,
  notifyAtMilestones: [7, 28, 112],
};
```

---

## 4. Merkle Tree Aggregation

### 4.1 Architecture

```
Periodic Merkle Root Computation:

Time ────────────────────────────────────────────────────────▶

Proofs:    P1   P2   P3   P4   P5   P6   P7   P8   P9   P10
           │    │    │    │    │    │    │    │    │    │
Linear:    P1──▶P2──▶P3──▶P4──▶P5──▶P6──▶P7──▶P8──▶P9──▶P10
                          │                        │
Merkle:              ┌────┴────┐              ┌────┴────┐
Roots:               │ Root A  │              │ Root B  │
                     │ (P1-P4) │              │ (P5-P8) │
                     └─────────┘              └─────────┘
                          │                        │
Anchors:             [External]               [External]
(optional)            Anchor A                 Anchor B
```

### 4.2 Configuration

```typescript
interface MerkleAggregationConfig {
  enabled: boolean;

  // Aggregation triggers (OR logic)
  triggers: {
    proofCount?: number;        // Every N proofs (e.g., 100)
    timeInterval?: string;      // Every T duration (e.g., "1 hour")
    onDemand?: boolean;         // Manual trigger via API
  };

  // External anchoring (optional)
  anchoring?: {
    enabled: boolean;
    destination: AnchorDestination;
    credentials?: AnchorCredentials;
  };
}

type AnchorDestination =
  | { type: 'database' }                              // Internal only
  | { type: 'ethereum'; network: 'mainnet' | 'sepolia'; contract?: string }
  | { type: 'polygon'; network: 'mainnet' | 'amoy' }
  | { type: 'timestampAuthority'; url: string }       // RFC 3161 TSA
  | { type: 'custom'; endpoint: string };
```

### 4.3 Merkle Tree Construction

```typescript
interface MerkleTree {
  root: string;                    // SHA-256 of top node
  leaves: string[];                // Proof hashes (in order)
  depth: number;                   // Tree depth
  algorithm: 'SHA-256';
}

function buildMerkleTree(proofHashes: string[]): MerkleTree {
  // Pad to power of 2 if needed
  const paddedLeaves = padToPowerOfTwo(proofHashes);

  let currentLevel = paddedLeaves;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1];
      const parent = sha256(left + right);
      nextLevel.push(parent);
    }
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    leaves: proofHashes,
    depth: Math.ceil(Math.log2(paddedLeaves.length)),
    algorithm: 'SHA-256',
  };
}
```

### 4.4 Merkle Proof Generation

```typescript
interface MerkleProof {
  leaf: string;                    // The proof hash being verified
  leafIndex: number;               // Position in tree
  siblings: string[];              // Sibling hashes for path to root
  root: string;                    // Expected root
}

function generateMerkleProof(tree: MerkleTree, leafIndex: number): MerkleProof {
  const siblings: string[] = [];
  let index = leafIndex;
  let currentLevel = tree.leaves;

  while (currentLevel.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    siblings.push(currentLevel[siblingIndex]);

    // Move to parent level
    index = Math.floor(index / 2);
    currentLevel = computeParentLevel(currentLevel);
  }

  return {
    leaf: tree.leaves[leafIndex],
    leafIndex,
    siblings,
    root: tree.root,
  };
}

function verifyMerkleProof(proof: MerkleProof): boolean {
  let hash = proof.leaf;
  let index = proof.leafIndex;

  for (const sibling of proof.siblings) {
    if (index % 2 === 0) {
      hash = sha256(hash + sibling);
    } else {
      hash = sha256(sibling + hash);
    }
    index = Math.floor(index / 2);
  }

  return hash === proof.root;
}
```

---

## 5. Zero-Knowledge Proof System

### 5.1 Supported Claims

| Claim Type | Description | Public Inputs | Private Inputs |
|------------|-------------|---------------|----------------|
| `score_gte_threshold` | Score >= threshold | threshold, timestamp | actualScore, chainHash |
| `score_in_range` | Score in [min, max] | min, max, timestamp | actualScore |
| `chain_valid` | Proof chain intact | entityId, timestamp | chainHash, proofCount |
| `no_denials_since` | No deny decisions since date | sinceDate, timestamp | decisionHistory |
| `trust_level_gte` | Trust level >= level | level, timestamp | actualLevel, score |

### 5.2 Circuit Design

#### 5.2.1 Score Threshold Circuit (Circom)

```circom
pragma circom 2.1.0;

include "comparators.circom";
include "poseidon.circom";

template ScoreThresholdProof() {
    // Public inputs
    signal input threshold;
    signal input timestamp;
    signal input entityIdHash;

    // Private inputs
    signal input actualScore;
    signal input chainRootHash;
    signal input signatureValid;      // 1 if valid, 0 if not

    // Output
    signal output valid;

    // Constraint: actualScore >= threshold
    component gte = GreaterEqThan(8);  // 8-bit scores (0-255)
    gte.in[0] <== actualScore;
    gte.in[1] <== threshold;

    // Constraint: signature must be valid
    signatureValid === 1;

    // Constraint: score must be in valid range
    component rangeCheck = LessThan(8);
    rangeCheck.in[0] <== actualScore;
    rangeCheck.in[1] <== 256;
    rangeCheck.out === 1;

    // Output validity
    valid <== gte.out;
}

component main {public [threshold, timestamp, entityIdHash]} = ScoreThresholdProof();
```

#### 5.2.2 Trust Level Circuit

```circom
pragma circom 2.1.0;

template TrustLevelProof() {
    // Public inputs
    signal input requiredLevel;       // 0-4 (untrusted to fully_trusted)
    signal input timestamp;
    signal input entityIdHash;

    // Private inputs
    signal input actualScore;
    signal input actualLevel;

    // Output
    signal output valid;

    // Level thresholds: 0=0, 1=25, 2=50, 3=75, 4=90
    signal levelThresholds[5];
    levelThresholds[0] <== 0;
    levelThresholds[1] <== 25;
    levelThresholds[2] <== 50;
    levelThresholds[3] <== 75;
    levelThresholds[4] <== 90;

    // Verify actualLevel matches actualScore
    component levelCheck = GreaterEqThan(8);
    levelCheck.in[0] <== actualScore;
    levelCheck.in[1] <== levelThresholds[actualLevel];
    levelCheck.out === 1;

    // Verify actualLevel >= requiredLevel
    component levelGte = GreaterEqThan(3);
    levelGte.in[0] <== actualLevel;
    levelGte.in[1] <== requiredLevel;

    valid <== levelGte.out;
}

component main {public [requiredLevel, timestamp, entityIdHash]} = TrustLevelProof();
```

### 5.3 ZK Service Implementation

```typescript
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

export interface ZKProof {
  protocol: 'groth16' | 'plonk';
  curve: 'bn128' | 'bls12381';
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
  claim: ZKClaimType;
  metadata: {
    generatedAt: string;
    expiresAt?: string;
    nonce: string;
  };
}

export type ZKClaimType =
  | 'score_gte_threshold'
  | 'score_in_range'
  | 'chain_valid'
  | 'no_denials_since'
  | 'trust_level_gte';

export interface ZKProofRequest {
  entityId: ID;
  claim: ZKClaimType;
  params: {
    threshold?: number;
    min?: number;
    max?: number;
    level?: TrustLevel;
    sinceDate?: Date;
  };
  expiresIn?: string;  // e.g., "1 hour"
}

export class ZKTrustService {
  private circuits: Map<ZKClaimType, CompiledCircuit>;
  private provingKeys: Map<ZKClaimType, Uint8Array>;
  private verificationKeys: Map<ZKClaimType, VerificationKey>;
  private poseidon: PoseidonHash;

  constructor(
    private trustEngine: TrustEngine,
    private proofService: ProofService,
    private config: ZKConfig,
  ) {}

  async initialize(): Promise<void> {
    this.poseidon = await buildPoseidon();

    // Load circuits and keys for each claim type
    for (const claimType of SUPPORTED_CLAIMS) {
      this.circuits.set(claimType, await this.loadCircuit(claimType));
      this.provingKeys.set(claimType, await this.loadProvingKey(claimType));
      this.verificationKeys.set(claimType, await this.loadVerificationKey(claimType));
    }
  }

  async generateProof(request: ZKProofRequest): Promise<ZKProof> {
    const { entityId, claim, params } = request;

    // Gather private inputs
    const trustData = await this.trustEngine.getScore(entityId);
    const chainValid = await this.proofService.verifyChain(entityId);

    if (!chainValid.valid) {
      throw new Error('Cannot generate ZK proof: chain integrity compromised');
    }

    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const entityIdHash = this.poseidon.F.toString(
      this.poseidon([BigInt('0x' + entityId.replace(/-/g, ''))])
    );

    // Build circuit inputs based on claim type
    const inputs = this.buildCircuitInputs(claim, {
      trustData,
      chainValid,
      params,
      timestamp,
      entityIdHash,
      nonce,
    });

    // Generate proof
    const circuit = this.circuits.get(claim)!;
    const provingKey = this.provingKeys.get(claim)!;

    const { proof, publicSignals } = await groth16.fullProve(
      inputs,
      circuit.wasm,
      provingKey,
    );

    return {
      protocol: 'groth16',
      curve: 'bn128',
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
      },
      publicSignals,
      claim,
      metadata: {
        generatedAt: new Date(timestamp).toISOString(),
        expiresAt: request.expiresIn
          ? new Date(timestamp + parseDuration(request.expiresIn)).toISOString()
          : undefined,
        nonce,
      },
    };
  }

  async verifyProof(zkProof: ZKProof): Promise<ZKVerificationResult> {
    const verificationKey = this.verificationKeys.get(zkProof.claim);

    if (!verificationKey) {
      return { valid: false, reason: 'Unknown claim type' };
    }

    // Check expiration
    if (zkProof.metadata.expiresAt) {
      if (new Date(zkProof.metadata.expiresAt) < new Date()) {
        return { valid: false, reason: 'Proof expired' };
      }
    }

    // Verify the proof
    const valid = await groth16.verify(
      verificationKey,
      zkProof.publicSignals,
      zkProof.proof,
    );

    return {
      valid,
      claim: zkProof.claim,
      publicInputs: this.parsePublicSignals(zkProof.claim, zkProof.publicSignals),
      verifiedAt: new Date().toISOString(),
    };
  }

  private buildCircuitInputs(
    claim: ZKClaimType,
    data: CircuitInputData,
  ): Record<string, bigint | string> {
    switch (claim) {
      case 'score_gte_threshold':
        return {
          threshold: BigInt(data.params.threshold!),
          timestamp: BigInt(data.timestamp),
          entityIdHash: data.entityIdHash,
          actualScore: BigInt(Math.floor(data.trustData.score)),
          chainRootHash: data.chainValid.rootHash,
          signatureValid: 1n,
        };

      case 'trust_level_gte':
        return {
          requiredLevel: BigInt(data.params.level!),
          timestamp: BigInt(data.timestamp),
          entityIdHash: data.entityIdHash,
          actualScore: BigInt(Math.floor(data.trustData.score)),
          actualLevel: BigInt(data.trustData.level),
        };

      // ... other claim types

      default:
        throw new Error(`Unsupported claim type: ${claim}`);
    }
  }
}
```

---

## 6. Audit Service

### 6.1 Audit Modes

```typescript
export type AuditMode = 'full' | 'selective' | 'zk';

export interface AuditService {
  // Full transparency - complete proof chain
  exportFullAudit(entityId: ID, options?: FullAuditOptions): Promise<FullAuditPackage>;

  // Selective disclosure - filtered and optionally redacted
  exportSelectiveAudit(entityId: ID, options: SelectiveAuditOptions): Promise<SelectiveAuditPackage>;

  // Zero-knowledge - prove claims without disclosure
  generateZKAudit(entityId: ID, claims: ZKClaimRequest[]): Promise<ZKAuditPackage>;

  // Verification
  verifyAuditPackage(pkg: AuditPackage): Promise<AuditVerificationResult>;
}
```

### 6.2 Full Audit Package

```typescript
export interface FullAuditPackage {
  version: '1.0';
  type: 'full';
  entityId: ID;
  generatedAt: string;

  // Complete proof chain
  proofChain: {
    proofs: SignedProof[];
    chainLength: number;
    genesisHash: string;
    latestHash: string;
  };

  // Current trust state
  trustState: {
    currentScore: number;
    currentLevel: TrustLevel;
    lastActivity: string;
    decayStatus: DecayStatus;
  };

  // Merkle roots (if enabled)
  merkleRoots?: MerkleAnchor[];

  // Package signature
  signature: {
    algorithm: string;
    publicKey: string;
    value: string;
    signedAt: string;
  };
}
```

### 6.3 Selective Audit Package

```typescript
export interface SelectiveAuditOptions {
  // Time range filter
  fromDate?: Date;
  toDate?: Date;

  // Decision filter
  decisionTypes?: ControlAction[];  // ['allow', 'deny', 'escalate']

  // Field redaction
  redactFields?: string[];  // ['inputs.sensitiveData', 'context.privateInfo']

  // Proof selection
  proofIds?: ID[];  // Specific proofs only

  // Include Merkle proof for verification
  includeMerkleProof?: boolean;
}

export interface SelectiveAuditPackage {
  version: '1.0';
  type: 'selective';
  entityId: ID;
  generatedAt: string;

  // Filtered proofs
  proofs: RedactedProof[];

  // Selection criteria (for transparency)
  criteria: SelectiveAuditOptions;

  // Merkle proofs for included items (if requested)
  merkleProofs?: {
    proofId: ID;
    merkleProof: MerkleProof;
    anchorRef: string;
  }[];

  // Attestation that this is a valid subset
  attestation: {
    totalProofsInChain: number;
    includedProofCount: number;
    redactedFieldCount: number;
    signature: string;
  };
}
```

### 6.4 ZK Audit Package

```typescript
export interface ZKClaimRequest {
  claim: ZKClaimType;
  params: Record<string, unknown>;
  label?: string;  // Human-readable label
}

export interface ZKAuditPackage {
  version: '1.0';
  type: 'zk';
  entityId: ID;  // Note: can be hashed for additional privacy
  generatedAt: string;

  // ZK proofs for requested claims
  claims: {
    label?: string;
    claim: ZKClaimType;
    proof: ZKProof;
    publicInputs: Record<string, unknown>;
  }[];

  // Verification info
  verification: {
    verificationKeys: Record<ZKClaimType, string>;  // Or URL to fetch
    instructions: string;
  };
}
```

---

## 7. Database Schema

### 7.1 New Tables

```typescript
// Merkle anchor storage
export const merkleAnchors = pgTable('merkle_anchors', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  entityId: uuid('entity_id').notNull(),

  // Tree data
  rootHash: text('root_hash').notNull(),
  fromPosition: integer('from_position').notNull(),
  toPosition: integer('to_position').notNull(),
  proofCount: integer('proof_count').notNull(),
  treeDepth: integer('tree_depth').notNull(),

  // External anchoring
  anchoredTo: text('anchored_to'),           // 'ethereum', 'polygon', 'tsa', etc.
  externalRef: text('external_ref'),          // tx hash, receipt ID, etc.
  anchoredAt: timestamp('anchored_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  entityIdx: index('merkle_entity_idx').on(table.entityId),
  rangeIdx: index('merkle_range_idx').on(table.entityId, table.fromPosition, table.toPosition),
}));

// ZK proof cache (optional, for replay protection)
export const zkProofLog = pgTable('zk_proof_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  entityId: uuid('entity_id').notNull(),

  // Proof data
  claimType: text('claim_type').notNull(),
  proofHash: text('proof_hash').notNull(),    // Hash of proof for dedup
  nonce: text('nonce').notNull().unique(),    // Replay protection

  // Validity
  generatedAt: timestamp('generated_at').notNull(),
  expiresAt: timestamp('expires_at'),

  // Audit
  requestedBy: uuid('requested_by'),          // User/service that requested
  verifiedCount: integer('verified_count').default(0),
  lastVerifiedAt: timestamp('last_verified_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  nonceIdx: uniqueIndex('zk_nonce_idx').on(table.nonce),
  entityClaimIdx: index('zk_entity_claim_idx').on(table.entityId, table.claimType),
}));

// Audit export log
export const auditExportLog = pgTable('audit_export_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  entityId: uuid('entity_id').notNull(),

  // Export details
  auditType: text('audit_type').notNull(),    // 'full', 'selective', 'zk'
  exportedAt: timestamp('exported_at').notNull(),
  exportedBy: uuid('exported_by'),

  // For selective audits
  criteria: jsonb('criteria'),
  proofCount: integer('proof_count'),
  redactedFields: text('redacted_fields').array(),

  // Package reference
  packageHash: text('package_hash').notNull(),
  packageSize: integer('package_size'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 7.2 Migrations

```typescript
// Migration: Add Merkle and ZK support
export async function up(db: Database): Promise<void> {
  await db.schema.createTable('merkle_anchors')...
  await db.schema.createTable('zk_proof_log')...
  await db.schema.createTable('audit_export_log')...

  // Add index for efficient Merkle range queries
  await db.schema.createIndex('proofs_entity_position_idx')
    .on('proofs')
    .columns(['entity_id', 'chain_position']);
}

export async function down(db: Database): Promise<void> {
  await db.schema.dropTable('audit_export_log');
  await db.schema.dropTable('zk_proof_log');
  await db.schema.dropTable('merkle_anchors');
}
```

---

## 8. API Specification

### 8.1 Merkle Endpoints

```typescript
// POST /api/v1/merkle/compute
// Trigger Merkle root computation for entity
interface ComputeMerkleRequest {
  entityId: ID;
  fromPosition?: number;  // Default: last anchor + 1
  toPosition?: number;    // Default: latest proof
}

interface ComputeMerkleResponse {
  anchor: MerkleAnchor;
  treeStats: {
    leafCount: number;
    depth: number;
    computeTimeMs: number;
  };
}

// POST /api/v1/merkle/anchor
// Anchor Merkle root to external system
interface AnchorMerkleRequest {
  anchorId: ID;
  destination: AnchorDestination;
}

interface AnchorMerkleResponse {
  anchorId: ID;
  externalRef: string;
  anchoredAt: string;
  destination: string;
}

// GET /api/v1/merkle/proof/:proofId
// Get Merkle proof for specific proof
interface GetMerkleProofResponse {
  proof: MerkleProof;
  anchor: MerkleAnchor;
  verificationInstructions: string;
}
```

### 8.2 ZK Endpoints

```typescript
// POST /api/v1/zk/prove
// Generate ZK proof for claim
interface GenerateZKProofRequest {
  entityId: ID;
  claim: ZKClaimType;
  params: Record<string, unknown>;
  expiresIn?: string;
}

interface GenerateZKProofResponse {
  proof: ZKProof;
  verificationKey: string;  // Or URL
}

// POST /api/v1/zk/verify
// Verify a ZK proof
interface VerifyZKProofRequest {
  proof: ZKProof;
}

interface VerifyZKProofResponse {
  valid: boolean;
  claim: ZKClaimType;
  publicInputs: Record<string, unknown>;
  verifiedAt: string;
  reason?: string;  // If invalid
}

// GET /api/v1/zk/verification-keys/:claimType
// Get verification key for client-side verification
interface GetVerificationKeyResponse {
  claimType: ZKClaimType;
  verificationKey: VerificationKey;
  circuit: {
    name: string;
    version: string;
    hash: string;
  };
}
```

### 8.3 Audit Endpoints

```typescript
// POST /api/v1/audit/full
// Export full audit package
interface ExportFullAuditRequest {
  entityId: ID;
  format?: 'json' | 'cbor';
  includeSignature?: boolean;
}

// POST /api/v1/audit/selective
// Export selective audit package
interface ExportSelectiveAuditRequest {
  entityId: ID;
  options: SelectiveAuditOptions;
  format?: 'json' | 'cbor';
}

// POST /api/v1/audit/zk
// Export ZK audit package
interface ExportZKAuditRequest {
  entityId: ID;
  claims: ZKClaimRequest[];
}

// POST /api/v1/audit/verify
// Verify any audit package
interface VerifyAuditRequest {
  package: AuditPackage;
}

interface VerifyAuditResponse {
  valid: boolean;
  type: AuditMode;
  checks: {
    name: string;
    passed: boolean;
    details?: string;
  }[];
}
```

---

## 9. Implementation Plan

### 9.1 Phase 1: Merkle Tree Foundation (Week 1-2)

| Task | Owner | Estimate |
|------|-------|----------|
| Database schema migration | Dev | 2h |
| MerkleTree utility class | Dev | 4h |
| MerkleService implementation | Dev | 8h |
| Merkle proof generation/verification | Dev | 4h |
| Unit tests for Merkle operations | QA | 8h |
| Integration with ProofService | Dev | 4h |

### 9.2 Phase 2: External Anchoring (Week 2-3)

| Task | Owner | Estimate |
|------|-------|----------|
| Anchor interface abstraction | Architect | 2h |
| Ethereum anchor implementation | Dev | 8h |
| RFC 3161 TSA implementation | Dev | 6h |
| Anchor verification | Dev | 4h |
| Integration tests | QA | 8h |

### 9.3 Phase 3: ZK Proof System (Week 3-5)

| Task | Owner | Estimate |
|------|-------|----------|
| Circom circuit development | Dev | 16h |
| Trusted setup ceremony | Security | 4h |
| ZKTrustService implementation | Dev | 12h |
| Proof generation optimization | Dev | 8h |
| Verification implementation | Dev | 4h |
| Security audit of circuits | Security | 8h |
| Performance testing | QA | 8h |

### 9.4 Phase 4: Audit Service (Week 5-6)

| Task | Owner | Estimate |
|------|-------|----------|
| AuditService implementation | Dev | 8h |
| Full audit export | Dev | 4h |
| Selective audit with redaction | Dev | 6h |
| ZK audit package | Dev | 4h |
| API endpoints | Dev | 6h |
| End-to-end tests | QA | 8h |
| Documentation | Tech Writer | 8h |

---

## 10. Test Requirements

### 10.1 Merkle Tree Tests

```typescript
describe('MerkleTree', () => {
  describe('construction', () => {
    it('should build tree from proof hashes');
    it('should handle power-of-2 leaf counts');
    it('should pad non-power-of-2 leaf counts');
    it('should compute consistent root hash');
  });

  describe('proof generation', () => {
    it('should generate valid proof for any leaf');
    it('should include correct sibling path');
    it('should handle edge leaves (first/last)');
  });

  describe('verification', () => {
    it('should verify valid Merkle proof');
    it('should reject tampered leaf');
    it('should reject tampered sibling');
    it('should reject wrong root');
  });
});

describe('MerkleService', () => {
  describe('aggregation', () => {
    it('should aggregate proofs on count trigger');
    it('should aggregate proofs on time trigger');
    it('should handle concurrent aggregation requests');
    it('should maintain chain continuity across anchors');
  });

  describe('anchoring', () => {
    it('should anchor to Ethereum testnet');
    it('should anchor to RFC 3161 TSA');
    it('should handle anchor failures gracefully');
    it('should verify external anchors');
  });
});
```

### 10.2 ZK Proof Tests

```typescript
describe('ZKTrustService', () => {
  describe('score_gte_threshold', () => {
    it('should generate valid proof when score >= threshold');
    it('should fail to generate proof when score < threshold');
    it('should verify valid proof');
    it('should reject tampered proof');
    it('should reject expired proof');
    it('should prevent replay with nonce');
  });

  describe('trust_level_gte', () => {
    it('should prove level 3 when score is 80');
    it('should fail to prove level 4 when score is 80');
    it('should handle level boundaries correctly');
  });

  describe('performance', () => {
    it('should generate proof in < 5 seconds');
    it('should verify proof in < 100ms');
    it('should handle concurrent proof requests');
  });
});
```

### 10.3 Audit Service Tests

```typescript
describe('AuditService', () => {
  describe('full audit', () => {
    it('should export complete proof chain');
    it('should include current trust state');
    it('should sign the package');
    it('should verify exported package');
  });

  describe('selective audit', () => {
    it('should filter by date range');
    it('should filter by decision type');
    it('should redact specified fields');
    it('should include Merkle proofs when requested');
    it('should attest to selection validity');
  });

  describe('zk audit', () => {
    it('should generate proofs for multiple claims');
    it('should include verification keys');
    it('should verify all claims in package');
  });
});
```

---

## 11. Security Considerations

### 11.1 Trusted Setup

For Groth16 ZK proofs, a trusted setup ceremony is required:

1. **Multi-party computation (MPC)** — Multiple participants contribute randomness
2. **Toxic waste disposal** — All participants must destroy their random values
3. **Verification** — Published transcript allows verification of ceremony integrity

**Recommendation:** Use PLONK or STARKs for trustless setup, or conduct MPC ceremony with ≥10 independent participants.

### 11.2 Circuit Security

| Risk | Mitigation |
|------|------------|
| Constraint under-specification | Formal verification of circuits |
| Integer overflow | Range checks on all inputs |
| Malleability | Include nonce and timestamp in public inputs |
| Side-channel leaks | Constant-time implementations |

### 11.3 Key Management

```typescript
interface ZKKeyManagement {
  // Proving keys - can be public, large (~50MB)
  provingKeys: {
    storage: 'filesystem' | 's3';
    encryption: false;  // No need to encrypt
  };

  // Verification keys - must be public, small (~1KB)
  verificationKeys: {
    storage: 'database' | 'cdn';
    integrity: 'hash-verified';
  };

  // Circuit source - should be public for auditability
  circuits: {
    storage: 'git' | 'ipfs';
    versioning: 'semantic';
  };
}
```

### 11.4 Replay Protection

All ZK proofs include:
- **Nonce** — Unique per-proof, stored in database
- **Timestamp** — Proof generation time
- **Expiration** — Optional validity window

Verification checks:
1. Nonce not previously used
2. Timestamp within acceptable skew (±5 minutes)
3. Not expired (if expiration set)

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Merkle Tree** | Binary tree where each non-leaf node is hash of its children |
| **Merkle Proof** | Sibling hashes needed to verify a leaf belongs to a root |
| **ZK Proof** | Cryptographic proof that a statement is true without revealing why |
| **Groth16** | ZK-SNARK proof system with small proofs, requires trusted setup |
| **PLONK** | ZK-SNARK with universal trusted setup |
| **STARK** | ZK proof system with no trusted setup, larger proofs |
| **Circom** | Domain-specific language for ZK circuit development |
| **Trusted Setup** | Ceremony to generate proving/verification keys |
| **Anchor** | External timestamp or record proving existence at point in time |

---

## Appendix B: References

1. [Merkle Trees - Wikipedia](https://en.wikipedia.org/wiki/Merkle_tree)
2. [snarkjs - GitHub](https://github.com/iden3/snarkjs)
3. [Circom Documentation](https://docs.circom.io/)
4. [Groth16 Paper](https://eprint.iacr.org/2016/260)
5. [RFC 3161 - Time-Stamp Protocol](https://datatracker.ietf.org/doc/html/rfc3161)
6. [EIP-191 - Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)

---

**Document Status:** Draft - Pending RION Review

**Next Steps:**
1. RION review and approval
2. Security team review of ZK circuits
3. Implementation kickoff per Phase 1
