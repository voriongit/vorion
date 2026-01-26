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

## Smart Contract

### BASISAnchor.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title BASISAnchor
 * @notice Immutable proof anchoring for BASIS governance decisions
 * @dev Deployed on Polygon PoS for low-cost, fast finality
 */
contract BASISAnchor is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    struct Batch {
        bytes32 merkleRoot;
        uint32 proofCount;
        uint64 timestamp;
        address submitter;
    }

    uint256 public batchCount;
    mapping(uint256 => Batch) public batches;
    mapping(bytes32 => uint256) public proofToBatch;

    event BatchAnchored(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        uint32 proofCount,
        uint64 timestamp,
        address indexed submitter
    );

    event ProofAnchored(
        bytes32 indexed proofHash,
        uint256 indexed batchId,
        bytes32 agentId
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ANCHOR_ROLE, msg.sender);
    }

    /**
     * @notice Anchor a batch of proofs with their Merkle root
     * @param merkleRoot Root hash of the proof Merkle tree
     * @param proofHashes Individual proof hashes in the batch
     * @param agentIds Corresponding agent IDs for each proof
     * @return batchId The ID of the anchored batch
     */
    function anchorBatch(
        bytes32 merkleRoot,
        bytes32[] calldata proofHashes,
        bytes32[] calldata agentIds
    ) external onlyRole(ANCHOR_ROLE) returns (uint256 batchId) {
        require(proofHashes.length == agentIds.length, "Length mismatch");
        require(proofHashes.length > 0, "Empty batch");

        batchId = ++batchCount;

        batches[batchId] = Batch({
            merkleRoot: merkleRoot,
            proofCount: uint32(proofHashes.length),
            timestamp: uint64(block.timestamp),
            submitter: msg.sender
        });

        for (uint256 i = 0; i < proofHashes.length; i++) {
            proofToBatch[proofHashes[i]] = batchId;
            emit ProofAnchored(proofHashes[i], batchId, agentIds[i]);
        }

        emit BatchAnchored(
            batchId,
            merkleRoot,
            uint32(proofHashes.length),
            uint64(block.timestamp),
            msg.sender
        );
    }

    /**
     * @notice Verify a proof exists in an anchored batch
     * @param proofHash The proof hash to verify
     * @param merkleProof Merkle proof path
     * @param batchId The batch ID to verify against
     * @return valid Whether the proof is valid
     */
    function verifyProof(
        bytes32 proofHash,
        bytes32[] calldata merkleProof,
        uint256 batchId
    ) external view returns (bool valid) {
        require(batchId > 0 && batchId <= batchCount, "Invalid batch");

        Batch memory batch = batches[batchId];
        return MerkleProof.verify(merkleProof, batch.merkleRoot, proofHash);
    }

    /**
     * @notice Get batch info for a proof
     * @param proofHash The proof hash to look up
     */
    function getProofBatch(bytes32 proofHash) external view returns (
        uint256 batchId,
        bytes32 merkleRoot,
        uint64 timestamp
    ) {
        batchId = proofToBatch[proofHash];
        require(batchId > 0, "Proof not found");

        Batch memory batch = batches[batchId];
        return (batchId, batch.merkleRoot, batch.timestamp);
    }
}
```

---

## TypeScript Implementation

### Installation

```bash
npm install ethers @vorionsys/atsf-core
```

### Chain Anchor Service

```typescript
import { ethers } from 'ethers';
import { createLogger } from '@vorionsys/atsf-core';

const logger = createLogger({ component: 'chain-anchor' });

// Polygon PoS network configuration
const POLYGON_CONFIG = {
  mainnet: {
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    blockExplorer: 'https://polygonscan.com',
  },
  amoy: {
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    chainId: 80002,
    blockExplorer: 'https://amoy.polygonscan.com',
  },
};

// Contract ABI (subset for anchoring)
const ANCHOR_ABI = [
  'function anchorBatch(bytes32 merkleRoot, bytes32[] proofHashes, bytes32[] agentIds) returns (uint256)',
  'function verifyProof(bytes32 proofHash, bytes32[] merkleProof, uint256 batchId) view returns (bool)',
  'function getProofBatch(bytes32 proofHash) view returns (uint256 batchId, bytes32 merkleRoot, uint64 timestamp)',
  'event BatchAnchored(uint256 indexed batchId, bytes32 merkleRoot, uint32 proofCount, uint64 timestamp, address indexed submitter)',
];

interface AnchorConfig {
  network: 'mainnet' | 'amoy';
  contractAddress: string;
  privateKey: string;
}

interface ProofToAnchor {
  proofHash: string;
  agentId: string;
}

interface AnchorResult {
  batchId: bigint;
  transactionHash: string;
  blockNumber: number;
  merkleRoot: string;
  explorerUrl: string;
}

/**
 * ChainAnchorService - Anchors BASIS proofs to Polygon
 */
export class ChainAnchorService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private config: AnchorConfig;
  private networkConfig: typeof POLYGON_CONFIG.mainnet;

  constructor(config: AnchorConfig) {
    this.config = config;
    this.networkConfig = POLYGON_CONFIG[config.network];

    this.provider = new ethers.JsonRpcProvider(
      this.networkConfig.rpcUrl,
      this.networkConfig.chainId
    );

    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contract = new ethers.Contract(
      config.contractAddress,
      ANCHOR_ABI,
      this.wallet
    );
  }

  /**
   * Compute Merkle root from proof hashes
   */
  private computeMerkleRoot(proofHashes: string[]): string {
    if (proofHashes.length === 0) {
      throw new Error('Cannot compute Merkle root of empty list');
    }

    let layer = proofHashes.map(h => h);

    while (layer.length > 1) {
      const nextLayer: string[] = [];

      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          // Hash pair together (sorted to ensure deterministic ordering)
          const [left, right] = [layer[i], layer[i + 1]].sort();
          nextLayer.push(ethers.keccak256(
            ethers.concat([left, right])
          ));
        } else {
          // Odd element, promote to next layer
          nextLayer.push(layer[i]);
        }
      }

      layer = nextLayer;
    }

    return layer[0];
  }

  /**
   * Anchor a batch of proofs to Polygon
   */
  async anchorBatch(proofs: ProofToAnchor[]): Promise<AnchorResult> {
    if (proofs.length === 0) {
      throw new Error('Cannot anchor empty batch');
    }

    const proofHashes = proofs.map(p => p.proofHash);
    const agentIds = proofs.map(p =>
      ethers.encodeBytes32String(p.agentId.slice(0, 31))
    );

    const merkleRoot = this.computeMerkleRoot(proofHashes);

    logger.info({
      proofCount: proofs.length,
      merkleRoot,
      network: this.config.network,
    }, 'Anchoring batch to Polygon');

    // Estimate gas and add 20% buffer
    const gasEstimate = await this.contract.anchorBatch.estimateGas(
      merkleRoot,
      proofHashes,
      agentIds
    );

    const tx = await this.contract.anchorBatch(
      merkleRoot,
      proofHashes,
      agentIds,
      { gasLimit: gasEstimate * 120n / 100n }
    );

    logger.info({ txHash: tx.hash }, 'Transaction submitted');

    // Wait for confirmation
    const receipt = await tx.wait();

    // Parse BatchAnchored event
    const event = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return this.contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: ethers.LogDescription | null) => e?.name === 'BatchAnchored');

    const batchId = event?.args?.batchId ?? 0n;

    const result: AnchorResult = {
      batchId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      merkleRoot,
      explorerUrl: `${this.networkConfig.blockExplorer}/tx/${receipt.hash}`,
    };

    logger.info(result, 'Batch anchored successfully');

    return result;
  }

  /**
   * Verify a proof on-chain
   */
  async verifyProof(
    proofHash: string,
    merkleProof: string[],
    batchId: bigint
  ): Promise<boolean> {
    return this.contract.verifyProof(proofHash, merkleProof, batchId);
  }

  /**
   * Get anchor info for a proof
   */
  async getProofAnchor(proofHash: string): Promise<{
    batchId: bigint;
    merkleRoot: string;
    timestamp: Date;
    explorerUrl: string;
  } | null> {
    try {
      const [batchId, merkleRoot, timestamp] = await this.contract.getProofBatch(proofHash);

      return {
        batchId,
        merkleRoot,
        timestamp: new Date(Number(timestamp) * 1000),
        explorerUrl: `${this.networkConfig.blockExplorer}/address/${this.config.contractAddress}`,
      };
    } catch {
      return null;
    }
  }
}

// Factory function
export function createChainAnchor(config: AnchorConfig): ChainAnchorService {
  return new ChainAnchorService(config);
}
```

### Usage Example

```typescript
import { createChainAnchor } from './chain-anchor';
import { createProofService } from '@vorionsys/atsf-core/proof';

// Initialize services
const proofService = createProofService({ /* config */ });
const chainAnchor = createChainAnchor({
  network: 'amoy', // Use 'mainnet' for production
  contractAddress: '0x...', // Deployed BASISAnchor address
  privateKey: process.env.POLYGON_PRIVATE_KEY!,
});

// Collect high-risk proofs for anchoring
const pendingProofs = await proofService.getPendingForAnchor({
  riskLevel: 'HIGH',
  limit: 50,
});

// Anchor to Polygon
const result = await chainAnchor.anchorBatch(
  pendingProofs.map(p => ({
    proofHash: p.hash,
    agentId: p.agentId,
  }))
);

console.log(`Anchored ${pendingProofs.length} proofs`);
console.log(`Batch ID: ${result.batchId}`);
console.log(`View on PolygonScan: ${result.explorerUrl}`);

// Later: Verify a proof
const isValid = await chainAnchor.verifyProof(
  proofHash,
  merkleProofPath,
  result.batchId
);
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
| **Testnet** | Polygon Amoy (Chain ID: 80002) |
| **Avg Block Time** | ~2 seconds |
| **Finality** | ~128 blocks (~4 min) |

---

## Ethereum Compatibility

The BASISAnchor contract is EVM-compatible and can be deployed to:

- **Polygon PoS** (recommended) - Low cost, fast finality
- **Ethereum Mainnet** - Higher security guarantees, higher cost
- **Arbitrum/Optimism** - L2 alternatives with Ethereum security
- **Base** - Coinbase L2, growing ecosystem

For multi-chain deployments, use the same contract address across chains via CREATE2.

---

*CHAIN is Layer 4 of the BASIS governance stack — the immutable anchor.*
