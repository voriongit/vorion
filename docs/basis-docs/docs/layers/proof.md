---
sidebar_position: 3
title: PROOF Layer
description: Immutable audit trail
---

# PROOF Layer

## Immutable Audit Trail — What Happened and Why

**If it's not logged, it didn't happen. PROOF makes governance verifiable.**

---

## What is PROOF?

The PROOF layer creates an immutable, tamper-evident record of every governance decision:

1. **Capture** — Record all governance data
2. **Chain** — Link records cryptographically
3. **Store** — Persist with integrity guarantees
4. **Anchor** — Commit hashes to blockchain
5. **Verify** — Enable independent verification

```
┌─────────────────────────────────────────────────────────────┐
│                        PROOF LAYER                          │
└─────────────────────────────────────────────────────────────┘

     ┌─────────────────────┐
     │  From ENFORCE       │
     │  Gate Decision      │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │      CAPTURE        │──▶ Intent + Decision + Context
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │       CHAIN         │──▶ Hash + link to previous
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │       STORE         │──▶ Append-only, 7+ years
     └──────────┬──────────┘
                │
                │ High-risk records
                ▼
     ┌─────────────────────┐
     │   ANCHOR (Chain)    │──▶ Polygon blockchain
     └─────────────────────┘
```

---

## Why PROOF Matters

| Without PROOF | With PROOF |
|---------------|------------|
| "The agent did it" | Exact decision trail |
| Trust the operator | Verify independently |
| Logs can be altered | Cryptographically chained |
| Compliance theater | Auditable compliance |
| Disputes are "he said/she said" | Mathematical proof |

---

## The Chain

Each record links to the previous, creating a tamper-evident chain:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Record 1   │    │  Record 2   │    │  Record 3   │
│             │    │             │    │             │
│ hash: 0xabc │◀───│ prev: 0xabc │◀───│ prev: 0xdef │
│             │    │ hash: 0xdef │    │ hash: 0x123 │
└─────────────┘    └─────────────┘    └─────────────┘

If anyone modifies Record 2:
- Its hash changes
- Record 3's previousHash no longer matches
- Chain is broken → tampering detected
```

---

## Proof Record Schema

```typescript
interface ProofRecord {
  proofId: string;
  version: "1.2";
  
  // Chain
  hash: string;
  previousHash: string;
  sequenceNumber: number;
  
  // Temporal
  timestamp: string; // ISO8601
  
  // Subject
  agentId: string;
  sessionId: string;
  
  // Event
  eventType: "intent_evaluated" | "gate_decision" | "escalation_created" | "escalation_resolved";
  
  // Data
  data: Record<string, any>;
  
  // Integrity
  signature: string;
  
  // Anchoring (if applicable)
  anchor?: {
    network: "polygon";
    txHash: string;
    blockNumber: number;
  };
}
```

---

## API Endpoints

```
POST /v1/proof/log          # Log a record
GET  /v1/proof/{proofId}    # Get a record
GET  /v1/proof/verify/{id}  # Verify a record
```

---

## Implementation Requirements

| Requirement | Description |
|-------------|-------------|
| **REQ-PRF-001** | Log every governance decision |
| **REQ-PRF-002** | Chain records cryptographically |
| **REQ-PRF-003** | Sign records with agent key |
| **REQ-PRF-004** | Anchor HIGH risk to blockchain |
| **REQ-PRF-005** | Anchor within 60s of decision |
| **REQ-PRF-006** | Retain for 7+ years |
| **REQ-PRF-007** | Enable independent verification |

---

## Enhanced Security (Optional)

Beyond the required linear hash chain, PROOF supports optional security enhancements:

### Merkle Tree Aggregation

Batch verification for high-volume environments with O(log n) proof verification:

```
       ┌─────────────┐
       │ Merkle Root │
       │   0xabc...  │
       └──────┬──────┘
              │
     ┌────────┴────────┐
     │                 │
┌────▼────┐      ┌────▼────┐
│  Hash   │      │  Hash   │
│ 0x12... │      │ 0x34... │
└────┬────┘      └────┬────┘
     │                 │
 ┌───┴───┐        ┌───┴───┐
 │       │        │       │
┌▼┐     ┌▼┐      ┌▼┐     ┌▼┐
│P│     │P│      │P│     │P│
│1│     │2│      │3│     │4│
└─┘     └─┘      └─┘     └─┘
```

- **External Anchoring**: Ethereum, Polygon, RFC 3161 TSA
- **Batch Windows**: Configurable aggregation periods
- **Inclusion Proofs**: Verify individual record membership

### Zero-Knowledge Proofs

Privacy-preserving trust attestation via Circom/Groth16:

| ZK Claim Type | Description |
|---------------|-------------|
| `score_gte_threshold` | Prove score meets minimum without revealing actual value |
| `trust_level_gte` | Prove trust level without revealing exact score |
| `decay_milestone_lte` | Prove recent activity without revealing exact dates |
| `chain_valid` | Prove proof chain integrity |
| `no_denials_since` | Prove clean record without revealing history details |

---

## Tiered Audit System

PROOF supports three audit modes to balance transparency and privacy:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Full** | Complete proof chain export | Regulatory compliance, legal discovery |
| **Selective** | Filtered, redacted disclosure | Partner due diligence, incident review |
| **ZK** | Zero-knowledge claims only | Privacy-preserving verification |

```typescript
// Example: Request ZK audit
const audit = await proof.requestAudit({
  mode: 'zk',
  claims: [
    { type: 'score_gte_threshold', threshold: 75 },
    { type: 'trust_level_gte', level: 2 },
    { type: 'no_denials_since', days: 30 }
  ]
});
// Returns: proofs without revealing actual scores/history
```

---

## Next Layer

For high-risk decisions, PROOF commits to [**CHAIN**](/layers/chain) for blockchain anchoring.

```
[PROOF] ──high-risk proofs──▶ [CHAIN]
```
