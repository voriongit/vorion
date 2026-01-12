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
     │      CAPTURE        │
     │                     │
     │  Intent + Decision  │
     │  Trust Score Used   │
     │  Policies Checked   │
     │  Timestamp          │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │       CHAIN         │
     │                     │
     │  Hash this record   │
     │  Link to previous   │
     │  Create chain       │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │       STORE         │
     │                     │
     │  Append-only log    │
     │  Replicated storage │
     │  7+ year retention  │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────────────────────────────────────┐
     │                  PROOF RECORD                       │
     │                                                     │
     │  {                                                  │
     │    "proofId": "prf_9h0i1j2k",                      │
     │    "hash": "0x1a2b3c4d...",                        │
     │    "previousHash": "0x9f8e7d6c...",                │
     │    "timestamp": "2026-01-08T15:42:30Z",            │
     │    "data": { ... },                                │
     │    "signature": "..."                              │
     │  }                                                 │
     │                                                     │
     └─────────────────────────────────────────────────────┘
                │
                │ High-risk records
                ▼
     ┌─────────────────────┐
     │   ANCHOR (Chain)    │
     │                     │
     │  Polygon tx: 0x...  │
     │  Immutable proof    │
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

## Proof Record Schema

```typescript
interface ProofRecord {
  // Identification
  proofId: string;
  version: "1.2";
  
  // Chain
  hash: string;           // SHA-256 of this record
  previousHash: string;   // Link to previous record
  sequenceNumber: number; // Ordering
  
  // Temporal
  timestamp: ISO8601;
  
  // Subject
  agentId: string;
  sessionId: string;
  userId?: string;
  
  // Event Type
  eventType: 
    | "intent_evaluated"
    | "gate_decision"
    | "escalation_created"
    | "escalation_resolved"
    | "action_executed"
    | "incident_reported";
  
  // Data (varies by event type)
  data: {
    // For gate_decision:
    intentId?: string;
    gateId?: string;
    decision?: "ALLOW" | "DENY" | "ESCALATE" | "DEGRADE";
    trustScore?: number;
    capabilities?: string[];
    policiesChecked?: PolicyResult[];
    
    // Other fields per event type...
  };
  
  // Integrity
  signature: string;      // Agent signature
  
  // Anchoring (if applicable)
  anchor?: {
    network: "polygon";
    txHash: string;
    blockNumber: number;
    status: "pending" | "confirmed";
  };
}
```

---

## The Chain

Each record links to the previous, creating a tamper-evident chain:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Record 1   │    │  Record 2   │    │  Record 3   │    │  Record 4   │
│             │    │             │    │             │    │             │
│ hash: 0xabc │◀───│ prev: 0xabc │◀───│ prev: 0xdef │◀───│ prev: 0x123 │
│             │    │ hash: 0xdef │    │ hash: 0x123 │    │ hash: 0x456 │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

If anyone modifies Record 2:
- Its hash changes
- Record 3's previousHash no longer matches
- Chain is broken → tampering detected
```

---

## Anchoring to Blockchain

For high-risk decisions, PROOF anchors hashes to Polygon:

```
┌─────────────────────────────────────────────────────────────┐
│                   BLOCKCHAIN ANCHORING                      │
└─────────────────────────────────────────────────────────────┘

When to Anchor:
├── HIGH risk decisions (always)
├── Tier transitions (trust score crosses boundary)
├── Significant trust changes (>50 points)
├── Certification events
├── Daily checkpoints (batch anchor)
└── Manual request

         ┌─────────────────┐
         │  PROOF Record   │
         │  (high risk)    │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Compute Anchor │
         │                 │
         │  Merkle root of │
         │  record batch   │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Polygon TX     │
         │                 │
         │  Contract call: │
         │  anchorProof()  │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────────────────────────────────────────┐
         │                ON-CHAIN RECORD                      │
         │                                                     │
         │  Event: ProofAnchored(                             │
         │    agentId: 0x...,                                 │
         │    proofHash: 0x1a2b3c4d...,                       │
         │    timestamp: 1704729750                           │
         │  )                                                  │
         │                                                     │
         │  Tx: 0x8f2a3b4c5d6e...                             │
         │  Block: 52847193                                    │
         │                                                     │
         └─────────────────────────────────────────────────────┘
```

---

## Verification

Anyone can verify a proof:

```bash
# Verify a proof record
curl https://api.cognigate.dev/v1/proof/verify/prf_9h0i1j2k

# Response
{
  "valid": true,
  "proofId": "prf_9h0i1j2k",
  "verification": {
    "hashValid": true,
    "chainValid": true,
    "signatureValid": true,
    "anchorValid": true
  },
  "anchor": {
    "network": "polygon",
    "txHash": "0x8f2a3b4c5d6e...",
    "blockNumber": 52847193,
    "explorerUrl": "https://polygonscan.com/tx/0x8f2a..."
  }
}
```

### Verification Steps

```python
def verify_proof(proof_id: str) -> VerificationResult:
    record = get_proof_record(proof_id)
    
    # 1. Verify hash matches content
    computed_hash = sha256(serialize(record.data))
    hash_valid = computed_hash == record.hash
    
    # 2. Verify chain linkage
    previous = get_proof_record(record.previous_proof_id)
    chain_valid = record.previous_hash == previous.hash
    
    # 3. Verify signature
    signature_valid = verify_signature(
        record.hash,
        record.signature,
        record.agent_public_key
    )
    
    # 4. Verify blockchain anchor (if present)
    anchor_valid = True
    if record.anchor:
        on_chain = get_chain_record(record.anchor.tx_hash)
        anchor_valid = on_chain.proof_hash == record.hash
    
    return VerificationResult(
        valid=all([hash_valid, chain_valid, signature_valid, anchor_valid]),
        hash_valid=hash_valid,
        chain_valid=chain_valid,
        signature_valid=signature_valid,
        anchor_valid=anchor_valid
    )
```

---

## API Endpoints

### Log a Proof Record

```
POST /v1/proof/log
```

```json
{
  "agentId": "ag_7x8k2mN3p",
  "eventType": "gate_decision",
  "data": {
    "intentId": "int_9h8g7f6e",
    "gateId": "gate_5e6f7g8h",
    "decision": "ALLOW",
    "trustScore": 687,
    "capabilities": ["send_external", "read_user"]
  }
}
```

### Get a Proof Record

```
GET /v1/proof/{proofId}
```

### Verify a Proof

```
GET /v1/proof/verify/{proofId}
```

### Verify by Transaction Hash

```
GET /v1/proof/verify/tx/{txHash}
```

### Query Proof History

```
GET /v1/proof/history/{agentId}?from=2026-01-01&to=2026-01-08
```

---

## Retention & Storage

| Requirement | Specification |
|-------------|---------------|
| **Retention** | Minimum 7 years |
| **Storage** | Append-only, replicated |
| **Encryption** | At rest (AES-256) |
| **Access** | Read via API, no direct modification |
| **Backup** | Daily, geographically distributed |
| **Deletion** | Only per legal requirement, logged |

---

## Event Types

| Event | When Logged | Anchored? |
|-------|-------------|-----------|
| `intent_evaluated` | Every intent evaluation | No |
| `gate_decision` | Every ENFORCE decision | If HIGH risk |
| `escalation_created` | Escalation initiated | Yes |
| `escalation_resolved` | Human decision made | Yes |
| `action_executed` | Action completed | If HIGH risk |
| `incident_reported` | Governance violation | Yes |
| `trust_changed` | Score change >50 | Yes |
| `certification_event` | Cert issued/revoked | Yes |

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
| **REQ-PRF-008** | Append-only storage |

---

## Integration

```
[ENFORCE]                   [PROOF]                    [CHAIN]
    │                          │                          │
    │   Gate Decision          │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │  If HIGH risk            │
    │                          │─────────────────────────▶│
    │                          │                          │
    │   proofId                │   Anchor confirmation    │
    │◀─────────────────────────│◀─────────────────────────│
    │                          │                          │
```

---

## Public Verification Page

Every proof can be verified at a public URL:

```
https://basis.vorion.org/verify/prf_9h0i1j2k
```

Shows:
- Record contents
- Hash verification ✓
- Chain verification ✓
- Signature verification ✓
- Blockchain anchor (with link to explorer)

---

## Resources

- [PROOF Specification](/spec/proof)
- [Reference Implementation](https://github.com/voriongit/cognigate/tree/main/proof)
- [Verification Guide](/docs/verification)
- [Anchor Contract](https://polygonscan.com/address/0x...)
- [API Reference](/api#proof)

---

*PROOF is Layer 3 of the BASIS governance stack.*
