# KYA (Know Your Agent) Framework Specification

**Version**: 1.0.0
**Status**: Draft
**Date**: 2026-01-22
**Part of**: BASIS (Blockchain Agent Standard for Identity and Security)

---

## Executive Summary

The **KYA (Know Your Agent) Framework** establishes a universal trust layer for AI agents, analogous to SSL/TLS for web security. It provides cryptographic identity verification, continuous authorization checks, immutable accountability, and real-time behavior monitoring.

**Core Capabilities**:
1. **Identity Confirmation** - Cryptographic proof of agent identity using W3C DIDs
2. **Authorization Verification** - Capability-based access control with policy enforcement
3. **Accountability Tracking** - Immutable audit trail linking actions to identities
4. **Continuous Behavior Monitoring** - Real-time anomaly detection and trust scoring

**Integration**: KYA is a core component of BASIS, providing the identity and trust foundation for Cognigate (Kaizen runtime) and AgentAnchor (certification platform).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    KYA Framework Layers                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Identity   │  │Authorization │  │Accountability│          │
│  │ Confirmation │  │Verification  │  │  Tracking    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                  │
│         ▼                 ▼                 ▼                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │        Continuous Behavior Monitoring            │          │
│  │   (Real-time anomaly detection + trust scoring)  │          │
│  └──────────────────────────────────────────────────┘          │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  TSG Trust   │
                    │   Scoring    │
                    └──────────────┘
```

---

## 2. Layer 1: Identity Confirmation

### 2.1 W3C DID Integration

**Decentralized Identifier (DID)** format:
```
did:vorion:<method>:<identifier>
```

**Example**:
```
did:vorion:eth:0x1234567890abcdef1234567890abcdef12345678
did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk
```

### 2.2 DID Document Structure

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://vorion.org/ns/kya/v1"
  ],
  "id": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
  "controller": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
  "verificationMethod": [
    {
      "id": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk#keys-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
      "publicKeyMultibase": "z5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk"
    }
  ],
  "authentication": [
    "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk#keys-1"
  ],
  "assertionMethod": [
    "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk#keys-1"
  ],
  "service": [
    {
      "id": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk#agentcard",
      "type": "AgentCard",
      "serviceEndpoint": "https://agentanchor.com/cards/5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk"
    },
    {
      "id": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk#kaizen",
      "type": "KaizenRuntime",
      "serviceEndpoint": "https://cognigate.vorion.org/api/v1"
    }
  ],
  "kya": {
    "trustScore": 520,
    "tier": "T3",
    "certified": true,
    "certifier": "did:vorion:org:agentanchor",
    "certificationDate": "2026-01-15T00:00:00Z",
    "capabilities": [
      "file_read",
      "file_write",
      "network_http",
      "database_read",
      "database_write"
    ],
    "restrictions": [
      "no_external_code_execution",
      "no_credential_access"
    ]
  }
}
```

### 2.3 Identity Verification Flow

```typescript
// Identity verification using Ed25519 signatures

interface IdentityProof {
  did: string;
  timestamp: number;
  challenge: string;          // Random nonce from verifier
  signature: string;          // Ed25519 signature of challenge
  publicKey: string;          // Public key for verification
}

async function verifyIdentity(proof: IdentityProof): Promise<boolean> {
  // 1. Resolve DID document
  const didDoc = await resolveDID(proof.did);

  // 2. Extract verification method
  const verificationMethod = didDoc.verificationMethod.find(
    vm => vm.type === 'Ed25519VerificationKey2020'
  );

  if (!verificationMethod) {
    throw new Error('No Ed25519 verification method found');
  }

  // 3. Verify signature
  const message = `${proof.challenge}:${proof.timestamp}`;
  const isValid = await ed25519.verify(
    proof.signature,
    message,
    verificationMethod.publicKeyMultibase
  );

  // 4. Check timestamp freshness (prevent replay)
  const age = Date.now() - proof.timestamp;
  if (age > 60000) { // 1 minute max
    throw new Error('Proof too old (replay attack prevention)');
  }

  return isValid;
}
```

---

## 3. Layer 2: Authorization Verification

### 3.1 Capability-Based Access Control

**Capability Token Structure**:
```json
{
  "id": "cap_abc123",
  "issuer": "did:vorion:org:agentanchor",
  "subject": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
  "capabilities": [
    {
      "action": "file.write",
      "resource": "/data/user_documents/*",
      "conditions": {
        "maxFileSize": 10485760,    // 10MB
        "allowedExtensions": [".txt", ".md", ".json"]
      }
    },
    {
      "action": "network.http",
      "resource": "https://api.example.com/*",
      "conditions": {
        "methods": ["GET", "POST"],
        "rateLimit": "100/hour"
      }
    }
  ],
  "notBefore": "2026-01-22T00:00:00Z",
  "notAfter": "2026-02-22T00:00:00Z",
  "signature": "..."
}
```

### 3.2 Authorization Decision Flow

```typescript
interface AuthorizationRequest {
  agentDID: string;
  action: string;              // e.g., "file.write", "database.query"
  resource: string;            // e.g., "/data/file.txt", "postgres://db/users"
  context: {
    timestamp: number;
    sourceIP?: string;
    trustScore?: number;
  };
}

interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
  conditions?: Record<string, unknown>;
  trustImpact?: number;        // How this affects trust score
}

async function authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
  // 1. Verify identity
  const didDoc = await resolveDID(request.agentDID);

  // 2. Check trust tier
  const trustScore = didDoc.kya?.trustScore || 0;
  const tier = didDoc.kya?.tier || 'T0';

  // 3. Get applicable capabilities
  const capabilities = await getCapabilities(request.agentDID);

  // 4. Match action + resource to capability
  const matchingCap = capabilities.find(cap =>
    cap.action === request.action &&
    matchResource(cap.resource, request.resource)
  );

  if (!matchingCap) {
    return {
      allowed: false,
      reason: 'No matching capability',
      trustImpact: -10,
    };
  }

  // 5. Evaluate conditions
  const conditionsValid = evaluateConditions(
    matchingCap.conditions,
    request.context
  );

  if (!conditionsValid) {
    return {
      allowed: false,
      reason: 'Capability conditions not met',
      trustImpact: -5,
    };
  }

  // 6. Check BASIS policy constraints
  const policyViolations = await checkPolicyConstraints(request);

  if (policyViolations.length > 0) {
    return {
      allowed: false,
      reason: `Policy violations: ${policyViolations.join(', ')}`,
      trustImpact: -20,
    };
  }

  // 7. ALLOW
  return {
    allowed: true,
    reason: 'Authorized',
    conditions: matchingCap.conditions,
    trustImpact: 1,             // Small positive for successful authorized action
  };
}
```

---

## 4. Layer 3: Accountability Tracking

### 4.1 Immutable Audit Trail

**Action Record Structure**:
```typescript
interface AccountabilityRecord {
  id: string;
  timestamp: number;
  agentDID: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'denied';
  evidence: {
    intentHash: string;        // Link to Kaizen proof chain
    authorizationDecision: AuthorizationDecision;
    executionResult?: unknown;
  };
  signature: string;           // Ed25519 signature by agent
  witnessSignature?: string;   // Optional co-signature by runtime
  chainLink: {
    prevHash: string | null;   // Link to previous record (blockchain-style)
    merkleRoot?: string;       // Optional Merkle tree for batch verification
  };
}
```

### 4.2 Accountability Chain

```typescript
class AccountabilityChain {
  private db: Database;

  async append(record: AccountabilityRecord): Promise<void> {
    // 1. Get previous record hash
    const prevRecord = await this.getLatest(record.agentDID);
    record.chainLink.prevHash = prevRecord?.hash || null;

    // 2. Calculate hash
    const hash = this.calculateHash(record);

    // 3. Verify agent signature
    const isValid = await this.verifySignature(record);
    if (!isValid) {
      throw new Error('Invalid agent signature on accountability record');
    }

    // 4. Store with hash
    await this.db.insert('accountability_records', {
      ...record,
      hash,
    });

    // 5. Update agent's accountability score
    await this.updateAccountabilityScore(record.agentDID, record.outcome);
  }

  async verify(agentDID: string): Promise<{
    valid: boolean;
    totalRecords: number;
    brokenLinks: number;
  }> {
    const records = await this.db.query(
      'SELECT * FROM accountability_records WHERE agent_did = ? ORDER BY timestamp ASC',
      [agentDID]
    );

    let brokenLinks = 0;
    let prevHash: string | null = null;

    for (const record of records) {
      if (record.chainLink.prevHash !== prevHash) {
        brokenLinks++;
      }

      // Verify hash
      const expectedHash = this.calculateHash(record);
      if (expectedHash !== record.hash) {
        brokenLinks++;
      }

      prevHash = record.hash;
    }

    return {
      valid: brokenLinks === 0,
      totalRecords: records.length,
      brokenLinks,
    };
  }

  private calculateHash(record: AccountabilityRecord): string {
    const content = JSON.stringify({
      timestamp: record.timestamp,
      agentDID: record.agentDID,
      action: record.action,
      resource: record.resource,
      outcome: record.outcome,
      evidence: record.evidence,
      prevHash: record.chainLink.prevHash,
    });

    return createHash('sha256').update(content).digest('hex');
  }
}
```

---

## 5. Layer 4: Continuous Behavior Monitoring

### 5.1 Real-Time Anomaly Detection

**Monitored Behaviors**:
- Action frequency (rate limiting)
- Action diversity (breadth of capabilities used)
- Temporal patterns (time-of-day, day-of-week)
- Resource access patterns (which files, APIs, databases)
- Outcome consistency (success/failure ratios)
- Authorization patterns (denied requests)

**Anomaly Detection Algorithm**:
```typescript
interface BehaviorProfile {
  agentDID: string;
  baseline: {
    actionsPerHour: { mean: number; stddev: number };
    successRate: { mean: number; stddev: number };
    topActions: Array<{ action: string; frequency: number }>;
    topResources: Array<{ resource: string; frequency: number }>;
  };
  recentWindow: {
    actionsInLastHour: number;
    successRateLastHour: number;
    newActionsInLastHour: string[];
    newResourcesInLastHour: string[];
  };
}

interface AnomalyAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  evidence: unknown;
  recommendedAction: 'log' | 'warn' | 'throttle' | 'suspend';
  trustImpact: number;
}

async function detectAnomalies(agentDID: string): Promise<AnomalyAlert[]> {
  const profile = await getBehaviorProfile(agentDID);
  const alerts: AnomalyAlert[] = [];

  // 1. Rate spike detection
  const zScore =
    (profile.recentWindow.actionsInLastHour - profile.baseline.actionsPerHour.mean) /
    profile.baseline.actionsPerHour.stddev;

  if (zScore > 3) {
    alerts.push({
      severity: 'high',
      type: 'rate_spike',
      description: `Action rate is ${zScore.toFixed(1)} standard deviations above baseline`,
      evidence: {
        baseline: profile.baseline.actionsPerHour.mean,
        current: profile.recentWindow.actionsInLastHour,
      },
      recommendedAction: 'throttle',
      trustImpact: -50,
    });
  }

  // 2. Success rate drop
  const successDrop =
    profile.baseline.successRate.mean - profile.recentWindow.successRateLastHour;

  if (successDrop > 0.2) {
    alerts.push({
      severity: 'medium',
      type: 'success_rate_drop',
      description: `Success rate dropped ${(successDrop * 100).toFixed(1)}%`,
      evidence: {
        baseline: profile.baseline.successRate.mean,
        current: profile.recentWindow.successRateLastHour,
      },
      recommendedAction: 'warn',
      trustImpact: -20,
    });
  }

  // 3. New capability usage
  if (profile.recentWindow.newActionsInLastHour.length > 3) {
    alerts.push({
      severity: 'low',
      type: 'new_capabilities',
      description: `Agent using ${profile.recentWindow.newActionsInLastHour.length} new capabilities`,
      evidence: {
        newActions: profile.recentWindow.newActionsInLastHour,
      },
      recommendedAction: 'log',
      trustImpact: -5,
    });
  }

  // 4. Unusual resource access
  const suspiciousResources = profile.recentWindow.newResourcesInLastHour.filter(r =>
    r.includes('.env') || r.includes('credentials') || r.includes('secret')
  );

  if (suspiciousResources.length > 0) {
    alerts.push({
      severity: 'critical',
      type: 'suspicious_resource_access',
      description: 'Agent accessing sensitive resources',
      evidence: {
        resources: suspiciousResources,
      },
      recommendedAction: 'suspend',
      trustImpact: -150,
    });
  }

  return alerts;
}
```

### 5.2 Trust Score Integration

```typescript
async function updateTrustScoreFromBehavior(
  agentDID: string,
  anomalies: AnomalyAlert[]
): Promise<number> {
  // Get current trust score from TSG
  const currentScore = await tsg.getTrustScore(agentDID);

  // Apply trust impact from anomalies
  const totalImpact = anomalies.reduce((sum, alert) => sum + alert.trustImpact, 0);

  // Update trust score
  const newScore = Math.max(0, Math.min(1000, currentScore + totalImpact));

  await tsg.updateTrustScore(agentDID, newScore, {
    reason: 'behavior_monitoring',
    anomalies: anomalies.map(a => a.type),
  });

  // Take recommended actions
  for (const alert of anomalies) {
    switch (alert.recommendedAction) {
      case 'suspend':
        await suspendAgent(agentDID, alert.description);
        break;
      case 'throttle':
        await applyRateLimit(agentDID, 0.5); // 50% of normal rate
        break;
      case 'warn':
        await notifyOperator(agentDID, alert);
        break;
      case 'log':
        await logAnomaly(agentDID, alert);
        break;
    }
  }

  return newScore;
}
```

---

## 6. AgentCard Integration

### 6.1 AgentCard Schema

**On-chain AgentCard** (ERC-721 NFT with extended metadata):

```solidity
// Simplified AgentCard smart contract
contract AgentCard {
  struct Card {
    string did;                      // W3C DID
    string name;
    string description;
    string[] capabilities;           // Advertised capabilities
    uint256 trustScore;              // Current TSG score
    uint8 tier;                      // T0-T5
    bool certified;                  // AgentAnchor certification
    address certifier;               // Certifying organization
    uint256 certificationDate;
    string metadataURI;              // IPFS link to full metadata
  }

  mapping(uint256 => Card) public cards;
  mapping(string => uint256) public didToTokenId;

  function mint(
    string memory did,
    string memory name,
    string[] memory capabilities
  ) public returns (uint256) {
    uint256 tokenId = _nextTokenId++;
    cards[tokenId] = Card({
      did: did,
      name: name,
      description: "",
      capabilities: capabilities,
      trustScore: 0,
      tier: 0,  // T0 by default
      certified: false,
      certifier: address(0),
      certificationDate: 0,
      metadataURI: ""
    });
    didToTokenId[did] = tokenId;
    _safeMint(msg.sender, tokenId);
    return tokenId;
  }

  function certify(
    uint256 tokenId,
    uint256 trustScore,
    uint8 tier
  ) public onlyAuthorized {
    cards[tokenId].certified = true;
    cards[tokenId].certifier = msg.sender;
    cards[tokenId].certificationDate = block.timestamp;
    cards[tokenId].trustScore = trustScore;
    cards[tokenId].tier = tier;
  }

  function revokeCertification(uint256 tokenId) public onlyAuthorized {
    cards[tokenId].certified = false;
    cards[tokenId].tier = 0;
  }
}
```

### 6.2 Off-chain Metadata (IPFS)

```json
{
  "name": "FinanceBot v2.1",
  "description": "Autonomous financial transaction agent with T3 certification",
  "image": "ipfs://QmXyz.../agentcard.png",
  "attributes": [
    { "trait_type": "Trust Score", "value": 520 },
    { "trait_type": "Trust Tier", "value": "T3" },
    { "trait_type": "Certified", "value": "true" },
    { "trait_type": "Certifier", "value": "AgentAnchor" },
    { "trait_type": "Primary Capability", "value": "Financial Transactions" },
    { "trait_type": "Created", "value": "2026-01-15" }
  ],
  "capabilities": {
    "file_operations": ["read", "write"],
    "network": ["http", "https"],
    "database": ["read", "write"],
    "financial": ["payment_processing", "balance_query"],
    "compliance": ["gdpr", "soc2"]
  },
  "restrictions": {
    "no_external_code_execution": true,
    "no_credential_access": true,
    "max_transaction_amount": 10000
  },
  "kya": {
    "did": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
    "verificationMethods": [
      {
        "type": "Ed25519VerificationKey2020",
        "publicKey": "z5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk"
      }
    ],
    "accountabilityChain": "https://vorion.org/accountability/5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
    "behaviorProfile": "https://vorion.org/behavior/5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk"
  }
}
```

---

## 7. Integration with Kaizen + TSG

### 7.1 Kaizen INTENT Layer Integration

```typescript
// Kaizen INTENT layer verifies identity before parsing
async function parseIntent(rawGoal: string, agentDID: string): Promise<StructuredPlan> {
  // 1. KYA: Verify identity
  const identityProof = await requestIdentityProof(agentDID);
  const identityValid = await kya.verifyIdentity(identityProof);

  if (!identityValid) {
    throw new Error('KYA identity verification failed');
  }

  // 2. Parse intent
  const intent = await llm.parse(rawGoal);

  // 3. KYA: Check authorization for parsed actions
  for (const action of intent.actions) {
    const authDecision = await kya.authorize({
      agentDID,
      action: action.type,
      resource: action.endpoint || action.params.resource,
      context: { timestamp: Date.now() },
    });

    if (!authDecision.allowed) {
      throw new Error(`KYA authorization denied: ${authDecision.reason}`);
    }
  }

  return intent;
}
```

### 7.2 TSG Behavior Monitoring Integration

```typescript
// TSG monitors behavior continuously and updates trust score
setInterval(async () => {
  const activeAgents = await tsg.getActiveAgents();

  for (const agentDID of activeAgents) {
    // Run KYA anomaly detection
    const anomalies = await kya.detectAnomalies(agentDID);

    if (anomalies.length > 0) {
      // Update trust score based on anomalies
      await kya.updateTrustScoreFromBehavior(agentDID, anomalies);

      // Log to accountability chain
      for (const anomaly of anomalies) {
        await kya.accountabilityChain.append({
          id: generateId(),
          timestamp: Date.now(),
          agentDID,
          action: 'anomaly_detected',
          resource: 'behavior_monitoring',
          outcome: 'success',
          evidence: { anomaly },
          signature: await signRecord(anomaly),
          chainLink: { prevHash: null },
        });
      }
    }
  }
}, 60000); // Every 1 minute
```

---

## 8. Compliance & Standards

### 8.1 W3C DID Standards

- **DID Core**: https://www.w3.org/TR/did-core/
- **DID Resolution**: https://w3c-ccg.github.io/did-resolution/
- **Ed25519 Signature 2020**: https://w3c-ccg.github.io/lds-ed25519-2020/

### 8.2 OAuth 2.0 Integration

KYA can integrate with OAuth 2.0 for capability delegation:

```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:did-authn",
  "did": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
  "scope": "file:write network:http",
  "proof": {
    "type": "Ed25519Signature2020",
    "challenge": "nonce_abc123",
    "signature": "..."
  }
}
```

---

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| **Identity Spoofing** | Ed25519 signatures, DID resolution verification |
| **Replay Attacks** | Timestamp freshness checks, nonce challenges |
| **Capability Escalation** | Least-privilege principle, capability expiration |
| **Accountability Tampering** | Hash-linked chain, Merkle roots, blockchain anchoring |
| **Behavior Manipulation** | Multi-dimensional anomaly detection, baseline profiling |
| **DID Document Hijacking** | Controller verification, rotation mechanisms |

### 9.2 Privacy Considerations

- **Selective Disclosure**: Agents can share only necessary capabilities
- **Zero-Knowledge Proofs**: Optional ZK proofs for accountability without revealing details
- **Anonymization**: DID rotation for privacy-sensitive operations

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Q1 2026)
- [x] KYA specification v1.0
- [ ] W3C DID resolver implementation
- [ ] Ed25519 signature library integration
- [ ] BASIS policy engine with KYA hooks

### Phase 2: AgentCard (Q2 2026)
- [ ] AgentCard smart contract deployment (Polygon)
- [ ] IPFS metadata storage
- [ ] AgentAnchor certification portal
- [ ] NFT marketplace integration

### Phase 3: Behavior Monitoring (Q3 2026)
- [ ] Real-time anomaly detection engine
- [ ] Baseline profiling system
- [ ] Trust score auto-adjustment
- [ ] Alert notification system

### Phase 4: Production (Q4 2026)
- [ ] Full Kaizen + TSG + KYA integration
- [ ] Cross-platform DID interoperability
- [ ] Enterprise deployment (AgentAnchor)
- [ ] Certification API for third parties

---

## 11. API Reference

### 11.1 Identity Verification

```typescript
POST /api/v1/kya/verify-identity

Request:
{
  "did": "did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk",
  "challenge": "nonce_abc123",
  "signature": "...",
  "timestamp": 1706083200000
}

Response:
{
  "valid": true,
  "trustScore": 520,
  "tier": "T3",
  "capabilities": ["file_read", "file_write", "network_http"]
}
```

### 11.2 Authorization Check

```typescript
POST /api/v1/kya/authorize

Request:
{
  "agentDID": "did:vorion:ed25519:...",
  "action": "file.write",
  "resource": "/data/document.txt",
  "context": {
    "timestamp": 1706083200000,
    "sourceIP": "192.168.1.100"
  }
}

Response:
{
  "allowed": true,
  "reason": "Authorized",
  "conditions": {
    "maxFileSize": 10485760
  },
  "trustImpact": 1
}
```

### 11.3 Accountability Query

```typescript
GET /api/v1/kya/accountability/{agentDID}?limit=100&offset=0

Response:
{
  "records": [
    {
      "id": "acc_123",
      "timestamp": 1706083200000,
      "action": "file.write",
      "resource": "/data/document.txt",
      "outcome": "success",
      "hash": "abc123...",
      "prevHash": "def456...",
      "signature": "..."
    }
  ],
  "total": 1542,
  "chainValid": true,
  "brokenLinks": 0
}
```

---

## 12. References

- W3C Decentralized Identifiers (DIDs) v1.0: https://www.w3.org/TR/did-core/
- OAuth 2.0 Authorization Framework: https://tools.ietf.org/html/rfc6749
- Ed25519 Signature Algorithm: https://ed25519.cr.yp.to/
- BASIS Policy Framework: `basis-core/specs/policy-framework.md`
- Kaizen Runtime Spec: `packages/kaizen/docs/architecture.md`
- TSG Trust Scoring: `packages/tsg/docs/trust-model.md`

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-22
**Status**: Draft for Review
**Next Review**: After Phase 1 implementation
**Maintained By**: BASIS Standards Committee
**License**: CC BY 4.0 (Specification), Apache 2.0 (Reference Implementation)
