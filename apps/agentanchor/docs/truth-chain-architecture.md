# AgentAnchor Truth Chain Architecture

**Version:** 1.0
**Date:** 2025-11-28
**Author:** frank the tank

---

## Executive Summary

The Truth Chain is AgentAnchor's **immutable record system** - a cryptographically-secured ledger that records every significant decision, certification, ownership change, and governance action. It provides the permanent, tamper-proof foundation for trust verification.

**Core Principle:** Once recorded, truth cannot be rewritten.

**Design Philosophy:**
> "The Truth Chain doesn't just store data - it stores proof. Every certification, every decision, every precedent becomes permanent and verifiable by anyone."

---

## Why Truth Chain?

### The Problem

AI systems need accountability that extends beyond the platform:
- Decisions have long-term consequences
- Certifications must be verifiable externally
- Precedents must be permanent for consistency
- Ownership changes need indisputable records
- Audit trails must survive platform changes

### The Solution

A hybrid approach combining:
1. **Internal Hash Chain** - Fast, cost-effective for high-volume records
2. **External Blockchain Anchoring** - Periodic anchoring to public chain for maximum trust
3. **Public Verification API** - Anyone can verify any record

---

## Architecture Overview

### Hybrid Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRUTH CHAIN SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    RECORD SOURCES                                │    │
│  │                                                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│  │  │ Council  │ │ Academy  │ │Marketplace│ │ Human    │           │    │
│  │  │ Decisions│ │Graduations│ │ Transfers│ │ Overrides│           │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │    │
│  │       └────────────┴────────────┴────────────┘                  │    │
│  │                          │                                       │    │
│  └──────────────────────────┼───────────────────────────────────────┘    │
│                             │                                            │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    TRUTH CHAIN ENGINE                             │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                 Record Processor                             │ │   │
│  │  │  • Validates record structure                                │ │   │
│  │  │  • Computes cryptographic hash                               │ │   │
│  │  │  • Links to previous record                                  │ │   │
│  │  │  • Generates proof                                           │ │   │
│  │  └──────────────────────────┬──────────────────────────────────┘ │   │
│  │                             │                                     │   │
│  │                             ▼                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │              Internal Hash Chain (PostgreSQL)                │ │   │
│  │  │  • High-volume storage                                       │ │   │
│  │  │  • Millisecond writes                                        │ │   │
│  │  │  • Merkle tree structure                                     │ │   │
│  │  │  • Append-only with triggers                                 │ │   │
│  │  └──────────────────────────┬──────────────────────────────────┘ │   │
│  │                             │                                     │   │
│  │               ┌─────────────┴─────────────┐                      │   │
│  │               │    Anchor Scheduler       │                      │   │
│  │               │    (Hourly/Daily)         │                      │   │
│  │               └─────────────┬─────────────┘                      │   │
│  │                             │                                     │   │
│  │                             ▼                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │            External Blockchain Anchor                        │ │   │
│  │  │  • Merkle root published to Ethereum/Polygon                 │ │   │
│  │  │  • Transaction hash stored locally                           │ │   │
│  │  │  • Periodic (cost-optimized)                                 │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    VERIFICATION LAYER                             │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ Public API   │  │ Verification │  │ Certificate  │           │   │
│  │  │ (No Auth)    │  │ Widget       │  │ Generator    │           │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Record Types

### What Gets Recorded

| Record Type | Trigger | Criticality | Anchor Frequency |
|-------------|---------|-------------|------------------|
| **Council Decisions** | Every approval/denial | Critical | Hourly |
| **Certifications** | Agent graduation | Critical | Immediate |
| **Trust Score Milestones** | Tier change | High | Hourly |
| **Ownership Changes** | Transfer, delegation | Critical | Immediate |
| **Human Overrides** | HITL decisions | Critical | Immediate |
| **Precedents** | New precedent created | High | Hourly |
| **Agent Creation** | New agent registered | Medium | Daily |
| **Marketplace Transactions** | Acquisition completed | High | Hourly |
| **Client Protection Events** | Opt-out, walk-away | Critical | Immediate |

### Record Schema

```typescript
interface TruthChainRecord {
  // Identity
  id: string;                      // UUID v7 (time-ordered)
  version: number;                 // Schema version
  type: RecordType;                // e.g., 'council.decision', 'certification.issued'

  // Timestamp
  timestamp: ISO8601;              // When event occurred
  recordedAt: ISO8601;             // When added to chain

  // Content
  subject: {
    type: 'agent' | 'user' | 'organization' | 'decision';
    id: string;
    name?: string;
  };

  payload: {
    action: string;                // Human-readable action
    details: Record<string, any>;  // Type-specific data
    outcome?: string;              // Result if applicable
  };

  // Provenance
  provenance: {
    source: string;                // System that created record
    actor?: string;                // User/agent that triggered
    witnesses: string[];           // Council members, observers
  };

  // Chain Linking
  chain: {
    sequence: bigint;              // Global sequence number
    previousHash: string;          // Hash of previous record
    merkleRoot?: string;           // If this is anchor point
    anchorTxHash?: string;         // Blockchain transaction if anchored
  };

  // Integrity
  hash: string;                    // SHA-256 of this record
  signature: string;               // Platform signature
}
```

---

## Internal Hash Chain

### Database Schema

```sql
-- Main truth chain table
CREATE TABLE truth_chain (
  id UUID PRIMARY KEY,
  version SMALLINT NOT NULL DEFAULT 1,
  record_type VARCHAR(50) NOT NULL,

  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Subject
  subject_type VARCHAR(20) NOT NULL,
  subject_id VARCHAR(100) NOT NULL,
  subject_name VARCHAR(255),

  -- Payload
  action VARCHAR(255) NOT NULL,
  details JSONB NOT NULL,
  outcome VARCHAR(255),

  -- Provenance
  source VARCHAR(50) NOT NULL,
  actor_id VARCHAR(100),
  witnesses TEXT[],

  -- Chain
  sequence BIGSERIAL UNIQUE NOT NULL,
  previous_hash VARCHAR(64) NOT NULL,
  merkle_root VARCHAR(64),
  anchor_tx_hash VARCHAR(66),
  anchor_block_number BIGINT,

  -- Integrity
  record_hash VARCHAR(64) NOT NULL,
  signature TEXT NOT NULL,

  -- Indexes
  CONSTRAINT valid_hash CHECK (length(record_hash) = 64),
  CONSTRAINT valid_prev_hash CHECK (length(previous_hash) = 64)
);

-- Indexes for common queries
CREATE INDEX idx_truth_chain_type ON truth_chain(record_type);
CREATE INDEX idx_truth_chain_subject ON truth_chain(subject_type, subject_id);
CREATE INDEX idx_truth_chain_timestamp ON truth_chain(event_timestamp);
CREATE INDEX idx_truth_chain_sequence ON truth_chain(sequence);
CREATE INDEX idx_truth_chain_anchor ON truth_chain(anchor_tx_hash) WHERE anchor_tx_hash IS NOT NULL;

-- Prevent modifications
CREATE OR REPLACE FUNCTION prevent_truth_chain_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Truth Chain records are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_truth_chain
  BEFORE UPDATE ON truth_chain
  FOR EACH ROW EXECUTE FUNCTION prevent_truth_chain_modification();

CREATE TRIGGER no_delete_truth_chain
  BEFORE DELETE ON truth_chain
  FOR EACH ROW EXECUTE FUNCTION prevent_truth_chain_modification();

-- Merkle tree nodes for efficient verification
CREATE TABLE truth_chain_merkle (
  id SERIAL PRIMARY KEY,
  level SMALLINT NOT NULL,           -- 0 = leaf, higher = internal nodes
  position BIGINT NOT NULL,          -- Position at this level
  hash VARCHAR(64) NOT NULL,
  left_child_id INT REFERENCES truth_chain_merkle(id),
  right_child_id INT REFERENCES truth_chain_merkle(id),
  record_id UUID REFERENCES truth_chain(id),  -- Only for leaves
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(level, position)
);

-- Anchor points to external blockchain
CREATE TABLE truth_chain_anchors (
  id SERIAL PRIMARY KEY,
  anchor_time TIMESTAMPTZ NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  first_sequence BIGINT NOT NULL,
  last_sequence BIGINT NOT NULL,
  record_count INT NOT NULL,

  -- Blockchain details
  chain_name VARCHAR(20) NOT NULL,   -- 'ethereum', 'polygon', 'arbitrum'
  tx_hash VARCHAR(66) NOT NULL,
  block_number BIGINT,
  block_hash VARCHAR(66),
  gas_used BIGINT,
  cost_usd DECIMAL(10, 4),

  -- Verification
  verified_at TIMESTAMPTZ,
  verification_status VARCHAR(20) DEFAULT 'pending',

  UNIQUE(tx_hash)
);
```

### Hash Computation

```typescript
class TruthChainHasher {
  private algorithm = 'sha256';

  computeRecordHash(record: Omit<TruthChainRecord, 'hash' | 'signature'>): string {
    // Canonical JSON serialization (sorted keys, no whitespace)
    const canonical = this.canonicalize({
      id: record.id,
      version: record.version,
      type: record.type,
      timestamp: record.timestamp,
      subject: record.subject,
      payload: record.payload,
      provenance: record.provenance,
      chain: {
        sequence: record.chain.sequence,
        previousHash: record.chain.previousHash,
      },
    });

    return crypto.createHash(this.algorithm).update(canonical).digest('hex');
  }

  private canonicalize(obj: any): string {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }

  // Merkle tree operations
  computeMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return this.hashEmpty();
    if (hashes.length === 1) return hashes[0];

    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] || left; // Duplicate if odd
      nextLevel.push(this.hashPair(left, right));
    }

    return this.computeMerkleRoot(nextLevel);
  }

  private hashPair(left: string, right: string): string {
    const combined = left < right ? left + right : right + left; // Canonical ordering
    return crypto.createHash(this.algorithm).update(combined).digest('hex');
  }

  private hashEmpty(): string {
    return crypto.createHash(this.algorithm).update('').digest('hex');
  }
}
```

### Record Creation

```typescript
class TruthChainService {
  private hasher: TruthChainHasher;
  private signer: PlatformSigner;
  private db: Database;

  async addRecord(input: RecordInput): Promise<TruthChainRecord> {
    return await this.db.transaction(async (tx) => {
      // 1. Get previous record
      const previous = await tx.query(
        'SELECT record_hash, sequence FROM truth_chain ORDER BY sequence DESC LIMIT 1'
      );
      const previousHash = previous?.record_hash || this.genesisHash();
      const sequence = (previous?.sequence || 0n) + 1n;

      // 2. Build record
      const record: Omit<TruthChainRecord, 'hash' | 'signature'> = {
        id: uuidv7(),
        version: 1,
        type: input.type,
        timestamp: input.timestamp,
        recordedAt: new Date().toISOString(),
        subject: input.subject,
        payload: input.payload,
        provenance: input.provenance,
        chain: {
          sequence,
          previousHash,
        },
      };

      // 3. Compute hash
      const hash = this.hasher.computeRecordHash(record);

      // 4. Sign
      const signature = await this.signer.sign(hash);

      // 5. Store
      const fullRecord: TruthChainRecord = { ...record, hash, signature };
      await this.storeRecord(tx, fullRecord);

      // 6. Update Merkle tree
      await this.updateMerkleTree(tx, hash, sequence);

      return fullRecord;
    });
  }

  private async storeRecord(tx: Transaction, record: TruthChainRecord): Promise<void> {
    await tx.query(`
      INSERT INTO truth_chain (
        id, version, record_type, event_timestamp, recorded_at,
        subject_type, subject_id, subject_name,
        action, details, outcome,
        source, actor_id, witnesses,
        sequence, previous_hash, record_hash, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      record.id, record.version, record.type, record.timestamp, record.recordedAt,
      record.subject.type, record.subject.id, record.subject.name,
      record.payload.action, record.payload.details, record.payload.outcome,
      record.provenance.source, record.provenance.actor, record.provenance.witnesses,
      record.chain.sequence, record.chain.previousHash, record.hash, record.signature
    ]);
  }

  private genesisHash(): string {
    return crypto.createHash('sha256').update('AGENTANCHOR_GENESIS_2025').digest('hex');
  }
}
```

---

## External Blockchain Anchoring

### Why Anchor Externally?

| Benefit | Description |
|---------|-------------|
| **Maximum Trust** | Records verifiable even if AgentAnchor disappears |
| **Regulatory Acceptance** | Public blockchain = recognized timestamp authority |
| **Third-Party Audit** | External auditors can verify without platform access |
| **Immutability Guarantee** | Blockchain consensus > single database |

### Anchor Strategy

```typescript
interface AnchorStrategy {
  // Timing
  anchorInterval: 'hourly' | 'daily' | 'immediate';
  immediateTypes: RecordType[];  // Types that trigger immediate anchor

  // Chain selection
  primaryChain: 'polygon' | 'arbitrum' | 'ethereum';
  fallbackChain: 'polygon' | 'arbitrum' | 'ethereum';

  // Cost management
  maxGasPrice: bigint;           // Don't anchor if gas too high
  batchSize: number;             // Records per anchor
}

const productionStrategy: AnchorStrategy = {
  anchorInterval: 'hourly',
  immediateTypes: [
    'certification.issued',
    'ownership.transferred',
    'human.override',
    'client.walkaway',
  ],
  primaryChain: 'polygon',       // Low cost, fast finality
  fallbackChain: 'arbitrum',     // Backup
  maxGasPrice: 500n * 10n ** 9n, // 500 gwei max
  batchSize: 1000,
};
```

### Anchor Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentAnchorTruthChain
 * @notice Stores Merkle roots from AgentAnchor Truth Chain for external verification
 */
contract AgentAnchorTruthChain {
    address public immutable agentAnchor;

    struct Anchor {
        bytes32 merkleRoot;
        uint256 firstSequence;
        uint256 lastSequence;
        uint256 recordCount;
        uint256 timestamp;
    }

    // Anchors by sequence range
    mapping(uint256 => Anchor) public anchors;
    uint256 public anchorCount;

    // Events
    event AnchorCreated(
        uint256 indexed anchorId,
        bytes32 merkleRoot,
        uint256 firstSequence,
        uint256 lastSequence,
        uint256 recordCount
    );

    constructor(address _agentAnchor) {
        agentAnchor = _agentAnchor;
    }

    modifier onlyAgentAnchor() {
        require(msg.sender == agentAnchor, "Only AgentAnchor can anchor");
        _;
    }

    /**
     * @notice Create a new anchor point
     * @param merkleRoot The Merkle root of records in this batch
     * @param firstSequence First record sequence number in batch
     * @param lastSequence Last record sequence number in batch
     * @param recordCount Number of records in batch
     */
    function anchor(
        bytes32 merkleRoot,
        uint256 firstSequence,
        uint256 lastSequence,
        uint256 recordCount
    ) external onlyAgentAnchor returns (uint256 anchorId) {
        anchorId = anchorCount++;

        anchors[anchorId] = Anchor({
            merkleRoot: merkleRoot,
            firstSequence: firstSequence,
            lastSequence: lastSequence,
            recordCount: recordCount,
            timestamp: block.timestamp
        });

        emit AnchorCreated(anchorId, merkleRoot, firstSequence, lastSequence, recordCount);
    }

    /**
     * @notice Verify a record is included in an anchor
     * @param anchorId The anchor to check
     * @param recordHash The hash of the record to verify
     * @param proof Merkle proof (sibling hashes)
     * @param index Position of record in the tree
     */
    function verify(
        uint256 anchorId,
        bytes32 recordHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool) {
        Anchor storage a = anchors[anchorId];
        require(a.timestamp > 0, "Anchor does not exist");

        bytes32 computedRoot = recordHash;
        for (uint256 i = 0; i < proof.length; i++) {
            if (index % 2 == 0) {
                computedRoot = keccak256(abi.encodePacked(computedRoot, proof[i]));
            } else {
                computedRoot = keccak256(abi.encodePacked(proof[i], computedRoot));
            }
            index /= 2;
        }

        return computedRoot == a.merkleRoot;
    }

    /**
     * @notice Get anchor details
     */
    function getAnchor(uint256 anchorId) external view returns (Anchor memory) {
        return anchors[anchorId];
    }
}
```

### Anchor Service

```typescript
class BlockchainAnchorService {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private contract: AgentAnchorTruthChain;
  private hasher: TruthChainHasher;

  async anchorBatch(records: TruthChainRecord[]): Promise<AnchorResult> {
    // 1. Compute Merkle root
    const hashes = records.map(r => r.hash);
    const merkleRoot = this.hasher.computeMerkleRoot(hashes);

    // 2. Check gas price
    const gasPrice = await this.provider.getGasPrice();
    if (gasPrice > this.strategy.maxGasPrice) {
      throw new Error(`Gas price too high: ${gasPrice}`);
    }

    // 3. Submit anchor transaction
    const tx = await this.contract.anchor(
      merkleRoot,
      records[0].chain.sequence,
      records[records.length - 1].chain.sequence,
      records.length,
      { gasPrice }
    );

    // 4. Wait for confirmation
    const receipt = await tx.wait(2); // 2 confirmations

    // 5. Store anchor record
    const anchor: TruthChainAnchor = {
      anchorTime: new Date(),
      merkleRoot,
      firstSequence: records[0].chain.sequence,
      lastSequence: records[records.length - 1].chain.sequence,
      recordCount: records.length,
      chainName: 'polygon',
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: receipt.gasUsed,
      costUsd: await this.calculateCostUsd(receipt),
    };

    await this.storeAnchor(anchor);

    // 6. Update records with anchor info
    await this.updateRecordsWithAnchor(records, anchor);

    return { success: true, anchor };
  }

  // Generate Merkle proof for a specific record
  async generateProof(recordId: string): Promise<MerkleProof> {
    const record = await this.getRecord(recordId);
    const anchor = await this.getAnchorForRecord(record);

    if (!anchor) {
      throw new Error('Record not yet anchored');
    }

    // Get all records in this anchor batch
    const batchRecords = await this.getRecordsInRange(
      anchor.firstSequence,
      anchor.lastSequence
    );

    const hashes = batchRecords.map(r => r.hash);
    const index = batchRecords.findIndex(r => r.id === recordId);

    // Build proof
    const proof = this.buildMerkleProof(hashes, index);

    return {
      recordHash: record.hash,
      merkleRoot: anchor.merkleRoot,
      proof,
      index,
      anchorTxHash: anchor.txHash,
      blockNumber: anchor.blockNumber,
      chainName: anchor.chainName,
    };
  }

  private buildMerkleProof(hashes: string[], index: number): string[] {
    const proof: string[] = [];
    let level = hashes;

    while (level.length > 1) {
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      if (siblingIndex < level.length) {
        proof.push(level[siblingIndex]);
      } else {
        proof.push(level[index]); // Duplicate for odd count
      }

      // Move to next level
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        nextLevel.push(this.hasher.hashPair(left, right));
      }
      level = nextLevel;
      index = Math.floor(index / 2);
    }

    return proof;
  }
}
```

---

## Public Verification

### Verification API

```typescript
// Public endpoints - no authentication required
const verificationRouter = express.Router();

/**
 * GET /verify/:recordId
 * Verify a Truth Chain record exists and is valid
 */
verificationRouter.get('/verify/:recordId', async (req, res) => {
  const { recordId } = req.params;

  const record = await truthChain.getRecord(recordId);
  if (!record) {
    return res.status(404).json({ verified: false, error: 'Record not found' });
  }

  // Verify hash chain integrity
  const chainValid = await truthChain.verifyChainIntegrity(record);

  // Get anchor proof if available
  let anchorProof = null;
  try {
    anchorProof = await anchorService.generateProof(recordId);
  } catch (e) {
    // Record may not be anchored yet
  }

  res.json({
    verified: chainValid,
    record: {
      id: record.id,
      type: record.type,
      timestamp: record.timestamp,
      subject: record.subject,
      action: record.payload.action,
      hash: record.hash,
    },
    chain: {
      sequence: record.chain.sequence,
      previousHash: record.chain.previousHash,
      chainIntegrity: chainValid,
    },
    anchor: anchorProof ? {
      anchored: true,
      merkleRoot: anchorProof.merkleRoot,
      txHash: anchorProof.anchorTxHash,
      blockNumber: anchorProof.blockNumber,
      chain: anchorProof.chainName,
      verifyUrl: `https://polygonscan.com/tx/${anchorProof.anchorTxHash}`,
    } : {
      anchored: false,
      message: 'Record will be anchored in next batch',
    },
    verificationUrl: `https://verify.agentanchorai.com/${recordId}`,
  });
});

/**
 * GET /verify/agent/:agentId
 * Get all certifications for an agent
 */
verificationRouter.get('/verify/agent/:agentId', async (req, res) => {
  const { agentId } = req.params;

  const certifications = await truthChain.getAgentCertifications(agentId);

  res.json({
    agentId,
    certifications: certifications.map(cert => ({
      id: cert.id,
      type: cert.type,
      timestamp: cert.timestamp,
      details: cert.payload.details,
      hash: cert.hash,
      verified: true,
      verifyUrl: `https://verify.agentanchorai.com/${cert.id}`,
    })),
    trustScore: await trustService.getCurrentScore(agentId),
    verificationWidget: `<script src="https://agentanchorai.com/widget.js" data-agent="${agentId}"></script>`,
  });
});

/**
 * POST /verify/proof
 * Verify a Merkle proof against blockchain
 */
verificationRouter.post('/verify/proof', async (req, res) => {
  const { recordHash, merkleRoot, proof, index, chainName, txHash } = req.body;

  // Verify locally
  const localValid = verifyMerkleProof(recordHash, merkleRoot, proof, index);

  // Verify on-chain
  const onChainValid = await anchorService.verifyOnChain(
    chainName,
    txHash,
    recordHash,
    proof,
    index
  );

  res.json({
    verified: localValid && onChainValid,
    localVerification: localValid,
    onChainVerification: onChainValid,
    explorerUrl: getExplorerUrl(chainName, txHash),
  });
});
```

### Verification Widget

```typescript
// Embeddable verification badge
const widgetScript = `
(function() {
  const agentId = document.currentScript.dataset.agent;

  fetch('https://api.agentanchorai.com/verify/agent/' + agentId)
    .then(r => r.json())
    .then(data => {
      const container = document.createElement('div');
      container.className = 'agentanchor-badge';
      container.innerHTML = \`
        <a href="https://verify.agentanchorai.com/agent/\${agentId}" target="_blank">
          <div class="badge-content">
            <img src="https://agentanchorai.com/badge-icon.svg" alt="AgentAnchor Verified" />
            <div class="badge-text">
              <span class="badge-title">AgentAnchor Certified</span>
              <span class="badge-score">Trust Score: \${data.trustScore}</span>
            </div>
          </div>
        </a>
      \`;
      document.currentScript.parentNode.insertBefore(container, document.currentScript);
    });
})();
`;
```

### Verification Page

```typescript
// Public verification page component
function VerificationPage({ recordId }: { recordId: string }) {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/verify/${recordId}`)
      .then(r => r.json())
      .then(setVerification)
      .finally(() => setLoading(false));
  }, [recordId]);

  if (loading) return <LoadingSpinner />;
  if (!verification) return <NotFound />;

  return (
    <div className="verification-page">
      <div className="verification-header">
        <div className={`status ${verification.verified ? 'verified' : 'failed'}`}>
          {verification.verified ? '✓ Verified' : '✕ Verification Failed'}
        </div>
        <h1>Truth Chain Record</h1>
      </div>

      <div className="record-details">
        <DetailRow label="Record ID" value={verification.record.id} />
        <DetailRow label="Type" value={verification.record.type} />
        <DetailRow label="Timestamp" value={formatDate(verification.record.timestamp)} />
        <DetailRow label="Subject" value={`${verification.record.subject.type}: ${verification.record.subject.id}`} />
        <DetailRow label="Action" value={verification.record.action} />
        <DetailRow label="Hash" value={verification.record.hash} monospace />
      </div>

      <div className="chain-integrity">
        <h2>Chain Integrity</h2>
        <DetailRow label="Sequence" value={verification.chain.sequence} />
        <DetailRow label="Previous Hash" value={verification.chain.previousHash} monospace />
        <DetailRow label="Chain Valid" value={verification.chain.chainIntegrity ? '✓ Yes' : '✕ No'} />
      </div>

      {verification.anchor.anchored && (
        <div className="blockchain-anchor">
          <h2>Blockchain Anchor</h2>
          <DetailRow label="Network" value={verification.anchor.chain} />
          <DetailRow label="Block" value={verification.anchor.blockNumber} />
          <DetailRow label="Transaction" value={verification.anchor.txHash} monospace />
          <a href={verification.anchor.verifyUrl} target="_blank" className="explorer-link">
            View on Block Explorer →
          </a>
        </div>
      )}

      <div className="verification-proof">
        <h2>Cryptographic Proof</h2>
        <p>Anyone can independently verify this record:</p>
        <ol>
          <li>Hash the record content using SHA-256</li>
          <li>Verify the hash matches: <code>{verification.record.hash}</code></li>
          <li>Check the hash chain links to previous: <code>{verification.chain.previousHash}</code></li>
          {verification.anchor.anchored && (
            <li>Verify Merkle proof on {verification.anchor.chain} blockchain</li>
          )}
        </ol>
      </div>
    </div>
  );
}
```

---

## Record Types Detail

### Certification Records

```typescript
interface CertificationRecord extends TruthChainRecord {
  type: 'certification.issued' | 'certification.revoked' | 'certification.renewed';
  payload: {
    action: string;
    details: {
      certificationLevel: 0 | 1 | 2 | 3 | 4 | 5;
      certificationName: string;
      trustScore: number;
      trustTier: string;
      curricula: string[];
      examinationResults: {
        validator: string;
        vote: 'approve' | 'deny';
        reasoning: string;
      }[];
      validFrom: ISO8601;
      validUntil: ISO8601;
      specializations?: string[];
    };
    outcome: 'granted' | 'denied' | 'revoked';
  };
}

// Example certification record
const certificationExample: CertificationRecord = {
  id: '01234567-89ab-cdef-0123-456789abcdef',
  version: 1,
  type: 'certification.issued',
  timestamp: '2025-11-28T14:30:00Z',
  recordedAt: '2025-11-28T14:30:01Z',
  subject: {
    type: 'agent',
    id: 'agent-abc123',
    name: 'ComplianceBot-Alpha',
  },
  payload: {
    action: 'Agent graduated from Academy with Level 3 Certification',
    details: {
      certificationLevel: 3,
      certificationName: 'Trusted',
      trustScore: 650,
      trustTier: 'Trusted',
      curricula: ['core-fundamentals', 'safety-ethics', 'compliance-specialist'],
      examinationResults: [
        { validator: 'arbiter', vote: 'approve', reasoning: 'The scales balance. This agent shows ethical judgment.' },
        { validator: 'guardian', vote: 'approve', reasoning: 'Safety protocols verified. No threat detected.' },
        { validator: 'scholar', vote: 'approve', reasoning: 'Compliant with Articles 3.1, 7.4, 12.2.' },
        { validator: 'advocate', vote: 'approve', reasoning: 'The users this agent serves will be well protected.' },
      ],
      validFrom: '2025-11-28T14:30:00Z',
      validUntil: '2026-11-28T14:30:00Z',
      specializations: ['regulatory-compliance', 'data-privacy'],
    },
    outcome: 'granted',
  },
  provenance: {
    source: 'academy-service',
    actor: 'trainer-frank',
    witnesses: ['arbiter', 'guardian', 'scholar', 'advocate'],
  },
  chain: {
    sequence: 1000001n,
    previousHash: 'abc123...',
  },
  hash: 'def456...',
  signature: 'sig789...',
};
```

### Council Decision Records

```typescript
interface CouncilDecisionRecord extends TruthChainRecord {
  type: 'council.approval' | 'council.denial' | 'council.escalation';
  payload: {
    action: string;
    details: {
      requestId: string;
      requestedAction: string;
      riskLevel: 0 | 1 | 2 | 3 | 4;
      votes: {
        validator: string;
        vote: 'approve' | 'deny' | 'abstain';
        reasoning: string;
      }[];
      precedentsApplied: string[];
      humanOverride?: {
        userId: string;
        decision: 'approve' | 'deny';
        reasoning: string;
      };
    };
    outcome: 'approved' | 'denied' | 'escalated';
  };
}
```

### Ownership Records

```typescript
interface OwnershipRecord extends TruthChainRecord {
  type: 'ownership.transferred' | 'ownership.delegated' | 'ownership.mia_takeover';
  payload: {
    action: string;
    details: {
      agentId: string;
      previousOwner: string;
      newOwner: string;
      transferType: 'sale' | 'delegation' | 'platform_takeover' | 'mia_protocol';
      salePrice?: number;
      royaltyRate?: number;
      clientNotificationStatus: 'notified' | 'accepted' | 'opted_out'[];
    };
    outcome: 'completed' | 'pending_client_approval';
  };
}
```

---

## Cost Optimization

### Anchoring Costs

| Chain | Avg Gas | Cost/Anchor | Frequency | Monthly Cost |
|-------|---------|-------------|-----------|--------------|
| Ethereum Mainnet | 50,000 | $5-50 | Daily | $150-1500 |
| Polygon | 50,000 | $0.01-0.05 | Hourly | $7-36 |
| Arbitrum | 50,000 | $0.05-0.20 | Hourly | $36-144 |

**Recommendation:** Use Polygon for hourly anchoring, Ethereum for critical immediate anchors.

### Batching Strategy

```typescript
const batchingConfig = {
  // Normal operations - batch hourly
  hourlyBatch: {
    maxRecords: 1000,
    maxWaitTime: '1h',
    triggerTypes: ['council.approval', 'council.denial', 'trust.milestone'],
  },

  // Critical records - batch every 5 minutes or immediate
  criticalBatch: {
    maxRecords: 100,
    maxWaitTime: '5m',
    triggerTypes: ['certification.issued', 'ownership.transferred', 'human.override'],
  },

  // Immediate anchoring for maximum trust
  immediate: {
    types: ['client.walkaway', 'certification.revoked', 'security.incident'],
  },
};
```

---

## Implementation Phases

### Phase 1: Internal Hash Chain (MVP)

- PostgreSQL-based hash chain
- Record creation and storage
- Chain integrity verification
- Basic public verification API
- Verification page

**No blockchain anchoring yet - prove the model first**

### Phase 2: Blockchain Anchoring

- Smart contract deployment (Polygon)
- Hourly anchoring service
- Merkle proof generation
- On-chain verification
- Explorer integration

### Phase 3: Advanced Verification

- Verification widgets
- Certificate generation (PDF)
- QR codes for mobile verification
- Batch verification API
- Historical proof retrieval

### Phase 4: Multi-Chain & Decentralization

- Ethereum mainnet anchoring (critical records)
- Cross-chain verification
- Decentralized anchor nodes
- Community anchor validators

---

## Summary

The Truth Chain provides:

| Capability | Implementation |
|------------|---------------|
| **Immutability** | Append-only database + blockchain anchoring |
| **Verifiability** | Public API + Merkle proofs + on-chain verification |
| **Efficiency** | Internal hash chain for speed, batched anchoring for cost |
| **Transparency** | Public verification pages, embeddable widgets |
| **Compliance** | Export-ready audit trails, timestamped records |
| **Permanence** | Records survive platform changes via blockchain |

**Key Guarantees:**

1. **Records cannot be altered** - Hash chain + blockchain + triggers
2. **Anyone can verify** - Public API, no authentication required
3. **External proof exists** - Blockchain anchor independent of AgentAnchor
4. **Efficient at scale** - Batched anchoring, Merkle trees

---

_"Once recorded, truth cannot be rewritten."_

_AgentAnchor Truth Chain Architecture v1.0_
