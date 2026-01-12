---
sidebar_position: 4
title: CHAIN Layer
description: Blockchain anchoring for immutable verification
---

# CHAIN Layer

## Blockchain Anchoring — Immutable, Independent Verification

**Don't trust. Verify. CHAIN puts proofs on-chain.**

---

## What is CHAIN?

The CHAIN layer is the final step in BASIS governance — anchoring proof hashes to a public blockchain:

1. **Commit** — Write proof hash to smart contract
2. **Confirm** — Wait for block confirmation
3. **Index** — Track anchored proofs
4. **Verify** — Enable trustless verification

```
┌─────────────────────────────────────────────────────────────┐
│                        CHAIN LAYER                          │
└─────────────────────────────────────────────────────────────┘

     ┌─────────────────────┐
     │   From PROOF Layer  │
     │   High-Risk Record  │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │    BATCH PROOFS     │──▶ Collect pending proofs
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │   COMPUTE MERKLE    │──▶ Root hash of batch
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │  SUBMIT TO POLYGON  │──▶ anchorBatch()
     └──────────┬──────────┘
                │
                ▼
         ON-CHAIN STATE
         
         ✓ Immutable
         ✓ Public
         ✓ Independently verifiable
```

---

## Why Blockchain?

| Question | Answer |
|----------|--------|
| **Why not just a database?** | Databases can be altered by operators. Blockchain can't. |
| **Why Polygon?** | Low cost (~$0.01/tx), fast finality (~2s), EVM compatible |
| **Who can verify?** | Anyone. No permission needed. |

---

## Anchor Strategy

Not everything needs blockchain anchoring:

### Always Anchor
- Gate decisions with HIGH risk
- Escalation resolutions
- Certification events
- Trust tier changes
- Incident reports

### Batch Anchor (Daily)
- Daily checkpoint of all decisions
- Aggregated Merkle root
- Cost-efficient

### Never Anchor
- MINIMAL risk decisions
- Internal logging
- Debug data

---

## Anchor Contract

```solidity
contract BASISAnchor {
    
    event BatchAnchored(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        uint32 proofCount,
        uint64 timestamp
    );
    
    function anchorBatch(
        bytes32 merkleRoot,
        bytes32[] calldata proofHashes,
        bytes32[] calldata agentIds
    ) external returns (uint256 batchId);
    
    function verifyProof(
        bytes32 proofHash,
        bytes32[] calldata merkleProof,
        uint256 batchId
    ) external view returns (bool);
}
```

---

## Verification

Anyone can verify a proof:

```bash
# Verify a proof from command line
npx @basis-protocol/verify prf_9h0i1j2k

# Output:
✓ Proof found: prf_9h0i1j2k
✓ Hash valid: 0x1a2b3c4d...
✓ Chain valid: Linked correctly
✓ Signature valid: Agent ag_7x8k2mN3p
✓ Anchor valid: Block 52847193
  └─ Tx: https://polygonscan.com/tx/0x8f2a...

VERIFIED ✓
```

---

## Cost Analysis

| Operation | Gas | Cost (at 30 gwei) |
|-----------|-----|-------------------|
| Single proof anchor | ~65,000 | ~$0.02 |
| Batch anchor (50 proofs) | ~150,000 | ~$0.05 |
| Merkle verification | ~30,000 | ~$0.01 |

**Monthly estimate (1000 high-risk decisions):**
- Individual anchors: $20
- Batched (daily): $1.50

---

## API Endpoints

```
POST /v1/chain/anchor         # Anchor proof(s)
GET  /v1/chain/anchor/{id}    # Get anchor status
GET  /v1/chain/verify/{hash}  # Verify on-chain
```

---

## Implementation Requirements

| Requirement | Description |
|-------------|-------------|
| **REQ-CHN-001** | Anchor HIGH risk proofs within 60s |
| **REQ-CHN-002** | Use Merkle trees for batch efficiency |
| **REQ-CHN-003** | Store Merkle proofs for verification |
| **REQ-CHN-004** | Handle chain reorgs gracefully |
| **REQ-CHN-005** | Provide independent verification path |

---

## Network Configuration

| Parameter | Value |
|-----------|-------|
| **Network** | Polygon PoS (Mainnet) |
| **Chain ID** | 137 |
| **Avg Block Time** | ~2 seconds |
| **Finality** | ~128 blocks (~4 min) |

---

*CHAIN is Layer 4 of the BASIS governance stack — the immutable anchor.*
