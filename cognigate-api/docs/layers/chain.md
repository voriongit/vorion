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
     │    BATCH PROOFS     │
     │                     │
     │  Collect pending    │
     │  proofs for anchor  │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │   COMPUTE MERKLE    │
     │                     │
     │  Root hash of all   │
     │  proofs in batch    │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │  SUBMIT TO POLYGON  │
     │                     │
     │  Contract call:     │
     │  anchorBatch()      │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────────────────────────────────────┐
     │                  ON-CHAIN STATE                     │
     │                                                     │
     │  Block: 52,847,193                                  │
     │  Tx: 0x8f2a3b4c5d6e7f8g9h0i...                     │
     │                                                     │
     │  Event: BatchAnchored(                              │
     │    batchId: 1234,                                   │
     │    merkleRoot: 0x1a2b3c4d...,                      │
     │    proofCount: 47,                                  │
     │    timestamp: 1704729750                            │
     │  )                                                  │
     │                                                     │
     │  ✓ Immutable                                        │
     │  ✓ Public                                           │
     │  ✓ Independently verifiable                         │
     │                                                     │
     └─────────────────────────────────────────────────────┘
```

---

## Why Blockchain?

| Question | Answer |
|----------|--------|
| **Why not just a database?** | Databases can be altered by operators. Blockchain can't. |
| **Why Polygon?** | Low cost (~$0.01/tx), fast finality (~2s), EVM compatible |
| **Who can verify?** | Anyone. No permission needed. |
| **What if Polygon goes down?** | Proofs exist in PROOF layer; anchor is additional guarantee |

---

## Anchor Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BASISAnchor {
    
    struct Batch {
        bytes32 merkleRoot;
        uint64 timestamp;
        uint32 proofCount;
        address submitter;
    }
    
    // Batch ID => Batch data
    mapping(uint256 => Batch) public batches;
    
    // Agent ID => Latest anchor
    mapping(bytes32 => uint256) public latestAgentBatch;
    
    // Individual proof => Batch ID
    mapping(bytes32 => uint256) public proofToBatch;
    
    uint256 public batchCount;
    
    event BatchAnchored(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        uint32 proofCount,
        uint64 timestamp
    );
    
    event ProofAnchored(
        bytes32 indexed proofHash,
        bytes32 indexed agentId,
        uint256 batchId
    );
    
    function anchorBatch(
        bytes32 merkleRoot,
        bytes32[] calldata proofHashes,
        bytes32[] calldata agentIds
    ) external returns (uint256 batchId) {
        require(proofHashes.length == agentIds.length, "Length mismatch");
        require(proofHashes.length > 0, "Empty batch");
        
        batchId = ++batchCount;
        
        batches[batchId] = Batch({
            merkleRoot: merkleRoot,
            timestamp: uint64(block.timestamp),
            proofCount: uint32(proofHashes.length),
            submitter: msg.sender
        });
        
        for (uint i = 0; i < proofHashes.length; i++) {
            proofToBatch[proofHashes[i]] = batchId;
            latestAgentBatch[agentIds[i]] = batchId;
            
            emit ProofAnchored(proofHashes[i], agentIds[i], batchId);
        }
        
        emit BatchAnchored(
            batchId,
            merkleRoot,
            uint32(proofHashes.length),
            uint64(block.timestamp)
        );
    }
    
    function verifyProof(
        bytes32 proofHash,
        bytes32[] calldata merkleProof,
        uint256 batchId
    ) external view returns (bool) {
        Batch memory batch = batches[batchId];
        require(batch.timestamp > 0, "Batch not found");
        
        // Verify Merkle proof
        bytes32 computedRoot = proofHash;
        for (uint i = 0; i < merkleProof.length; i++) {
            if (computedRoot < merkleProof[i]) {
                computedRoot = keccak256(abi.encodePacked(computedRoot, merkleProof[i]));
            } else {
                computedRoot = keccak256(abi.encodePacked(merkleProof[i], computedRoot));
            }
        }
        
        return computedRoot == batch.merkleRoot;
    }
    
    function getProofBatch(bytes32 proofHash) external view returns (uint256) {
        return proofToBatch[proofHash];
    }
    
    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return batches[batchId];
    }
}
```

---

## Anchor Strategy

Not everything needs blockchain anchoring. Strategy:

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

## Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  INDEPENDENT VERIFICATION                   │
└─────────────────────────────────────────────────────────────┘

Verifier has:
├── proofId: prf_9h0i1j2k
└── Claimed data from agent/platform

Step 1: Get proof record
         │
         ▼
┌─────────────────────┐
│  Fetch from API     │
│  or from own copy   │
│                     │
│  Record contains:   │
│  - data             │
│  - hash             │
│  - batchId          │
│  - merkleProof      │
└──────────┬──────────┘
           │
Step 2: Verify hash locally
           │
           ▼
┌─────────────────────┐
│  sha256(data) ==    │
│  claimed hash?      │
│                     │
│  ✓ Data integrity   │
└──────────┬──────────┘
           │
Step 3: Verify on-chain
           │
           ▼
┌─────────────────────┐
│  Call contract:     │
│  verifyProof(       │
│    hash,            │
│    merkleProof,     │
│    batchId          │
│  )                  │
│                     │
│  ✓ Chain integrity  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   VERIFIED ✓                                                │
│                                                             │
│   This proof:                                               │
│   • Contains the claimed data (hash matches)                │
│   • Was anchored at block 52,847,193                       │
│   • Cannot have been altered since                          │
│   • Can be verified by anyone                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
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

### Anchor a Proof

```
POST /v1/chain/anchor
```

```json
{
  "proofIds": ["prf_9h0i1j2k", "prf_8g7f6e5d"],
  "priority": "normal"
}
```

### Get Anchor Status

```
GET /v1/chain/anchor/{proofId}
```

```json
{
  "proofId": "prf_9h0i1j2k",
  "status": "confirmed",
  "anchor": {
    "network": "polygon",
    "contract": "0x1234567890abcdef...",
    "batchId": 1234,
    "txHash": "0x8f2a3b4c5d6e...",
    "blockNumber": 52847193,
    "timestamp": "2026-01-08T15:43:00Z"
  },
  "verification": {
    "merkleProof": ["0xabc...", "0xdef..."],
    "verifyUrl": "https://polygonscan.com/tx/0x8f2a..."
  }
}
```

### Verify On-Chain

```
GET /v1/chain/verify/{proofHash}
```

---

## Network Configuration

| Parameter | Value |
|-----------|-------|
| **Network** | Polygon PoS (Mainnet) |
| **Chain ID** | 137 |
| **Contract** | `0x...` (TBD) |
| **RPC** | https://polygon-rpc.com |
| **Explorer** | https://polygonscan.com |
| **Avg Block Time** | ~2 seconds |
| **Finality** | ~128 blocks (~4 min) |

---

## Fallback & Redundancy

```
┌─────────────────────────────────────────────────────────────┐
│                    ANCHOR REDUNDANCY                        │
└─────────────────────────────────────────────────────────────┘

Primary: Polygon PoS
    │
    │ If unavailable (rare)
    ▼
Fallback 1: Queue locally, retry
    │
    │ If extended outage
    ▼
Fallback 2: Alternative L2 (Arbitrum/Optimism)
    │
    │ Always
    ▼
Backup: Proofs always stored in PROOF layer
        (anchoring is additional guarantee, not sole copy)
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
| **REQ-CHN-006** | Support multiple networks (future) |

---

## Verification Tools

### CLI Tool

```bash
# Verify a proof from command line
npx @basis-protocol/verify prf_9h0i1j2k

# Output:
✓ Proof found: prf_9h0i1j2k
✓ Hash valid: 0x1a2b3c4d...
✓ Chain valid: Linked to prf_8g7f6e5d
✓ Signature valid: Agent ag_7x8k2mN3p
✓ Anchor valid: Block 52847193
  └─ Tx: https://polygonscan.com/tx/0x8f2a...

VERIFIED ✓
```

### JavaScript SDK

```javascript
import { verify } from '@basis-protocol/sdk';

const result = await verify('prf_9h0i1j2k');

console.log(result);
// {
//   valid: true,
//   proofId: 'prf_9h0i1j2k',
//   hash: '0x1a2b3c4d...',
//   anchor: {
//     txHash: '0x8f2a...',
//     blockNumber: 52847193,
//     verified: true
//   }
// }
```

### Web Verification

```
https://basis.vorion.org/verify/prf_9h0i1j2k

[Shows visual verification with all checks]
```

---

## Resources

- [CHAIN Specification](/spec/chain)
- [Smart Contract Source](https://github.com/voriongit/basis-contracts)
- [Contract on Polygonscan](https://polygonscan.com/address/0x...)
- [Verification Guide](/docs/verification)
- [API Reference](/api#chain)

---

*CHAIN is Layer 4 of the BASIS governance stack — the immutable anchor.*
