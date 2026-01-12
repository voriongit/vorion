# Story 5-4: Truth Chain Records

**Epic:** 5 - Observer & Truth Chain
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform stakeholder
**I want** critical decisions recorded in a cryptographically-linked chain
**So that** governance actions have immutable, verifiable proof

---

## Acceptance Criteria

- [ ] `truth_chain` table with hash-linked records
- [ ] Records created for critical events: certification, decision, ownership, milestone
- [ ] Each record includes SHA-256 hash of content
- [ ] Hash chain links each record to previous
- [ ] Chain integrity validation function
- [ ] Record types: agent graduation, council decisions, ownership transfers, trust tier changes
- [ ] Placeholder fields for future blockchain anchoring

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE truth_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type VARCHAR(50) NOT NULL,
  subject_type VARCHAR(50) NOT NULL,
  subject_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  sequence BIGSERIAL UNIQUE,
  previous_hash VARCHAR(64),
  hash VARCHAR(64) NOT NULL,
  anchor_tx VARCHAR(66),      -- Future: blockchain tx hash
  anchor_block INTEGER,       -- Future: block number
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for subject lookups
CREATE INDEX idx_truth_chain_subject ON truth_chain(subject_type, subject_id);

-- Prevent modifications
CREATE RULE truth_chain_no_update AS ON UPDATE TO truth_chain DO INSTEAD NOTHING;
CREATE RULE truth_chain_no_delete AS ON DELETE TO truth_chain DO INSTEAD NOTHING;
```

### Record Types

| Type | Trigger | Subject |
|------|---------|---------|
| `certification` | Agent graduates academy | Agent |
| `decision` | Council makes ruling | Decision |
| `ownership` | Agent acquired/transferred | Agent |
| `milestone` | Trust tier change | Agent |

### Service Implementation

```typescript
// lib/truth-chain/truth-chain-service.ts
interface TruthChainRecord {
  recordType: 'certification' | 'decision' | 'ownership' | 'milestone';
  subjectType: string;
  subjectId: string;
  action: string;
  payload: Record<string, unknown>;
}

async function recordToTruthChain(record: TruthChainRecord): Promise<string> {
  const previousRecord = await getLatestRecord();
  const previousHash = previousRecord?.hash || '0'.repeat(64);

  const hash = calculateHash({
    ...record,
    previousHash,
    timestamp: new Date().toISOString()
  });

  // Insert and return record ID
}

async function verifyChainIntegrity(): Promise<boolean> {
  // Walk chain and verify all hashes
}
```

### Integration Points

- `lib/agents/graduation-service.ts` - Record certification on graduation
- `lib/council/decision-service.ts` - Record decisions
- `lib/marketplace/acquisition-service.ts` - Record ownership transfers
- `lib/agents/trust-service.ts` - Record tier milestones

### Files to Create/Modify

- `lib/db/schema/truth-chain.ts` - Schema definition
- `lib/truth-chain/truth-chain-service.ts` - Core service
- `lib/truth-chain/types.ts` - Type definitions
- Modify existing services to call truth chain on critical events

---

## Dependencies

- Database migration system
- Epic 2: Agent graduation events
- Epic 3: Council decision events
- Epic 4: Trust tier change events

---

## Out of Scope

- Blockchain anchoring (future enhancement)
- Public verification UI (Story 5-5)
- Merkle tree batching
