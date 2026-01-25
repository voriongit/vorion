# ACI Security Hardening Specification

**Cryptographic and Runtime Security Controls for AI Agents**  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** January 24, 2026

---

## Abstract

This specification defines mandatory and recommended security controls for ACI-compliant systems. It addresses cryptographic token security, hardware attestation, privacy-preserving identity, and revocation enforcement. These controls harden the ACI architecture against token theft, impersonation, correlation attacks, and revocation bypass.

---

## 1. Introduction

### 1.1 Motivation

The base ACI specification establishes identity and capability encoding for AI agents. However, deploying AI agents in production environments requires additional security controls:

1. **Token Theft:** Stolen tokens can be replayed by attackers
2. **Code Integrity:** Certified agents may be swapped with malicious code
3. **Correlation Attacks:** Reused identifiers enable cross-service tracking
4. **Revocation Latency:** Compromised agents execute transactions before revocation propagates

### 1.2 Scope

This specification covers:

- Sender-constrained tokens (DPoP)
- Hardware-bound keys (TEE attestation)
- Pairwise identity requirements
- Revocation enforcement SLAs
- Delegation chain security

### 1.3 Conformance Levels

| Level | Name | Requirements |
|-------|------|--------------|
| **SH-1** | Basic | DPoP, short-lived tokens |
| **SH-2** | Standard | SH-1 + pairwise DIDs, recursive revocation |
| **SH-3** | Hardened | SH-2 + TEE binding, sync revocation checks |

Trust tier mapping:

| Trust Tier | Minimum Conformance |
|------------|---------------------|
| T0-T1 | None (not recommended) |
| T2 | SH-1 |
| T3 | SH-2 |
| T4-T5 | SH-3 |

---

## 2. Sender-Constrained Tokens (DPoP)

### 2.1 Requirement

All ACI Access Tokens MUST be bound to a proof-of-possession key using DPoP (RFC 9449).

### 2.2 Rationale

Traditional bearer tokens can be stolen and replayed. For AI agents that may have their storage compromised (via side-channel attacks, memory dumps, or host compromise), sender-constrained tokens ensure stolen tokens are unusable without the private key.

### 2.3 Implementation

#### 2.3.1 Token Request

```http
POST /token HTTP/1.1
Host: auth.agentanchor.io
Content-Type: application/x-www-form-urlencoded
DPoP: <dpop_proof>

grant_type=authorization_code&
code=<auth_code>&
client_id=<agent_client_id>&
redirect_uri=<redirect_uri>
```

#### 2.3.2 DPoP Proof Structure

```json
{
  "typ": "dpop+jwt",
  "alg": "ES256",
  "jwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  }
}
.
{
  "jti": "unique-token-id",
  "htm": "POST",
  "htu": "https://auth.agentanchor.io/token",
  "iat": 1706097600,
  "ath": "sha256-hash-of-access-token"
}
```

#### 2.3.3 Token Response

The access token includes a confirmation claim binding it to the DPoP key:

```json
{
  "access_token": "eyJ...",
  "token_type": "DPoP",
  "expires_in": 300,
  "cnf": {
    "jkt": "sha256-thumbprint-of-dpop-key"
  }
}
```

#### 2.3.4 Resource Access

```http
GET /api/resource HTTP/1.1
Host: api.example.com
Authorization: DPoP <access_token>
DPoP: <fresh_dpop_proof>
```

### 2.4 Key Requirements

| Requirement | Specification |
|-------------|---------------|
| Algorithm | ES256 (P-256) REQUIRED; ES384, ES512 RECOMMENDED |
| Key Storage | Hardware-backed RECOMMENDED (TPM, Secure Enclave) |
| Proof Lifetime | Maximum 60 seconds |
| JTI Uniqueness | MUST be unique; servers MUST reject replays |
| Clock Skew | Maximum 5 seconds tolerance |

### 2.5 Replay Prevention

Authorization servers and resource servers MUST maintain a JTI cache:

```typescript
interface JTICache {
  // Store JTI with expiration
  store(jti: string, expiresAt: Date): Promise<void>;
  
  // Check if JTI has been seen
  exists(jti: string): Promise<boolean>;
}

// Reject if JTI exists
if (await jtiCache.exists(proof.jti)) {
  throw new Error('DPoP proof replay detected');
}
```

---

## 3. Trusted Execution Environment (TEE) Binding

### 3.1 Requirement

For Trust Tier T4 and above, agent DID keys MUST be bound to a Trusted Execution Environment with remote attestation.

### 3.2 Rationale

Verifiable Credentials attest to what was certified at issuance time. They cannot guarantee that the certified code is actually running. An attacker could obtain valid credentials for "Safe-Agent-v1" but execute "Malicious-Agent-v9".

TEE binding solves this by:
1. Generating keys inside the secure enclave
2. Binding the DID to the enclave's measurement
3. Proving at runtime that the expected code is executing

### 3.3 Supported Platforms

| Platform | Attestation Type | Use Case |
|----------|------------------|----------|
| Intel SGX | DCAP/EPID | Cloud workloads |
| AWS Nitro Enclaves | Nitro Attestation | AWS deployments |
| AMD SEV-SNP | SNP Attestation | AMD cloud instances |
| ARM TrustZone | Platform-specific | Edge/mobile agents |
| Apple Secure Enclave | DeviceCheck | Apple platform agents |

### 3.4 Attestation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │     │  Attestation │     │   Relying   │
│  (in TEE)   │     │   Service    │     │   Party     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Generate key   │                   │
       │    inside enclave │                   │
       │                   │                   │
       │ 2. Request        │                   │
       │    attestation ──►│                   │
       │                   │                   │
       │ 3. Attestation    │                   │
       │    report ◄───────│                   │
       │                   │                   │
       │ 4. Present DID + attestation ────────►│
       │                   │                   │
       │                   │ 5. Verify         │
       │                   │    attestation ◄──│
       │                   │                   │
       │                   │ 6. Confirm ──────►│
       │                   │                   │
```

### 3.5 DID Document with TEE Binding

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://aci.agentanchor.io/ns/aci/v1",
    "https://aci.agentanchor.io/ns/tee/v1"
  ],
  "id": "did:aci:a3i:vorion:banquet-advisor",
  
  "verificationMethod": [
    {
      "id": "did:aci:a3i:vorion:banquet-advisor#tee-key-1",
      "type": "JsonWebKey2020",
      "controller": "did:aci:a3i:vorion:banquet-advisor",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "..."
      }
    }
  ],
  
  "aciTeeBinding": {
    "platform": "nitro",
    "enclaveId": "enclave-abc123",
    "pcrs": {
      "PCR0": "sha384:...",
      "PCR1": "sha384:...",
      "PCR2": "sha384:..."
    },
    "attestationEndpoint": "https://attestation.agentanchor.io/nitro",
    "keyBinding": {
      "verificationMethodId": "#tee-key-1",
      "bindingProof": "base64-attestation-document"
    },
    "validUntil": "2026-02-24T00:00:00Z"
  }
}
```

### 3.6 Runtime Attestation Verification

Relying parties MUST verify TEE attestation for T4+ agents:

```typescript
async function verifyTeeBinding(
  agent: AgentIdentity,
  attestationService: AttestationService
): Promise<TeeVerificationResult> {
  const binding = agent.didDocument.aciTeeBinding;
  
  // 1. Verify attestation document signature
  const attestationValid = await attestationService.verify(
    binding.platform,
    binding.keyBinding.bindingProof
  );
  
  if (!attestationValid) {
    return { valid: false, reason: 'Invalid attestation signature' };
  }
  
  // 2. Verify PCR measurements match expected values
  const expectedPcrs = await getExpectedPcrs(agent.aci);
  for (const [pcr, value] of Object.entries(binding.pcrs)) {
    if (expectedPcrs[pcr] !== value) {
      return { valid: false, reason: `PCR mismatch: ${pcr}` };
    }
  }
  
  // 3. Verify key is bound to enclave
  const keyBound = await verifyKeyBinding(
    binding.keyBinding,
    agent.didDocument.verificationMethod
  );
  
  if (!keyBound) {
    return { valid: false, reason: 'Key not bound to enclave' };
  }
  
  // 4. Check attestation freshness
  if (new Date(binding.validUntil) < new Date()) {
    return { valid: false, reason: 'Attestation expired' };
  }
  
  return { valid: true };
}
```

---

## 4. Pairwise Identity Requirements

### 4.1 Requirement

Agents interacting with services that handle non-public data MUST use pairwise (relationship-specific) DIDs.

### 4.2 Rationale

Reusing the same DID across services creates a "correlation super-cookie." If Agent A uses the same DID with an airline and a hospital, those services can collude to build a comprehensive profile.

### 4.3 Data Classification

| Data Type | Pairwise Required | Example |
|-----------|-------------------|---------|
| Public | No | Weather queries, public APIs |
| Business | Recommended | B2B transactions |
| Personal | Yes | User preferences, history |
| Sensitive | Yes | Financial, health, location |
| Regulated | Yes + Audit | PII under GDPR, PHI under HIPAA |

### 4.4 Pairwise DID Derivation

```typescript
interface PairwiseDerivation {
  masterDid: string;           // Agent's root DID
  relierPartyDid: string;      // Service's DID
  contextSalt: string;         // Random salt per relationship
  derivedDid: string;          // Unique DID for this relationship
}

function derivePairwiseDid(
  masterDid: string,
  relierPartyDid: string,
  salt: string
): string {
  // HKDF derivation
  const ikm = Buffer.from(`${masterDid}:${relierPartyDid}`);
  const info = Buffer.from('aci-pairwise-did-v1');
  const derivedKey = hkdf('sha256', ikm, salt, info, 32);
  
  // Generate DID from derived key
  const keyPair = generateKeyPairFromSeed(derivedKey);
  return `did:key:${multibaseEncode(keyPair.publicKey)}`;
}
```

### 4.5 Pairwise DID Registry

Agents MUST maintain a secure mapping of pairwise DIDs:

```typescript
interface PairwiseRegistry {
  // Store pairwise relationship
  store(
    masterDid: string,
    relierPartyDid: string,
    pairwiseDid: string,
    salt: string
  ): Promise<void>;
  
  // Retrieve pairwise DID for relationship
  get(
    masterDid: string,
    relierPartyDid: string
  ): Promise<PairwiseDerivation | null>;
  
  // List all relationships (for audit)
  list(masterDid: string): Promise<PairwiseDerivation[]>;
  
  // Revoke specific relationship
  revoke(pairwiseDid: string): Promise<void>;
}
```

### 4.6 Negotiation Protocol

During the ACI handshake, agents negotiate pairwise DID usage:

```json
// Agent → Service (initial contact)
{
  "type": "aci-handshake-request",
  "from": "did:aci:a3i:vorion:agent-master",
  "to": "did:web:api.example.com",
  "pairwiseSupport": true,
  "dataClassification": "sensitive"
}

// Service → Agent (response)
{
  "type": "aci-handshake-response",
  "requirePairwise": true,
  "serviceDid": "did:web:api.example.com",
  "nonce": "random-nonce-for-derivation"
}

// Agent → Service (pairwise DID)
{
  "type": "aci-handshake-complete",
  "pairwiseDid": "did:key:z6Mk...",
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "did:aci:a3i:vorion:agent-master#key-1",
    "proofValue": "..."
  }
}
```

---

## 5. Revocation Enforcement

### 5.1 Requirement

ACI systems MUST enforce revocation within defined SLA windows based on trust tier and operation criticality.

### 5.2 Revocation SLAs

| Trust Tier | Max Propagation | Sync Check Required |
|------------|-----------------|---------------------|
| T0-T1 | 60 seconds | No |
| T2 | 30 seconds | For L3+ operations |
| T3 | 10 seconds | For L3+ operations |
| T4-T5 | 1 second | Always |

### 5.3 Operation Criticality

Regardless of trust tier, certain operations require synchronous revocation checks:

| Operation Type | Sync Check Required |
|----------------|---------------------|
| Financial transaction | Always |
| PII access | Always |
| External API call | Always |
| Data export | Always |
| Privilege escalation | Always |
| Delegation creation | Always |

### 5.4 Revocation Check Implementation

```typescript
async function checkRevocation(
  agent: AgentIdentity,
  operation: Operation
): Promise<RevocationStatus> {
  const requiresSync = 
    agent.trustTier >= TrustTier.T4 ||
    isCriticalOperation(operation);
  
  if (requiresSync) {
    // Synchronous check - call registry
    return await registry.checkRevocationSync(agent.did);
  } else {
    // Cached check with SLA-based TTL
    const ttl = getRevocationCacheTTL(agent.trustTier);
    return await cache.getOrFetch(
      `revocation:${agent.did}`,
      () => registry.checkRevocationAsync(agent.did),
      ttl
    );
  }
}

function getRevocationCacheTTL(tier: TrustTier): number {
  switch (tier) {
    case TrustTier.T0:
    case TrustTier.T1: return 60000; // 60 seconds
    case TrustTier.T2: return 30000; // 30 seconds
    case TrustTier.T3: return 10000; // 10 seconds
    default: return 0; // No caching for T4+
  }
}
```

### 5.5 Recursive Revocation

When an agent in a delegation chain is revoked, all downstream capabilities MUST be invalidated:

```typescript
async function revokeRecursive(
  agentDid: string,
  reason: string
): Promise<RecursiveRevocationResult> {
  // 1. Revoke the agent
  await registry.revoke(agentDid, reason);
  
  // 2. Find all delegations from this agent
  const delegations = await registry.getDelegationsFrom(agentDid);
  
  // 3. Recursively revoke each delegate
  const revokedDescendants: string[] = [];
  for (const delegation of delegations) {
    const result = await revokeRecursive(
      delegation.delegateDid,
      `Parent revoked: ${agentDid}`
    );
    revokedDescendants.push(delegation.delegateDid);
    revokedDescendants.push(...result.revokedDescendants);
  }
  
  // 4. Invalidate all active tokens
  const tokensInvalidated = await tokenService.invalidateForAgent(agentDid);
  
  // 5. Notify webhooks
  await webhooks.notify('revocation', {
    agentDid,
    reason,
    revokedDescendants,
    tokensInvalidated
  });
  
  return { agentDid, revokedDescendants, tokensInvalidated };
}
```

---

## 6. Delegation Chain Security

### 6.1 Chain Validation

Relying parties MUST validate the entire delegation chain:

```typescript
async function validateDelegationChain(
  token: ACIToken
): Promise<ChainValidationResult> {
  const chain = token.claims.delegation_chain;
  
  for (let i = 0; i < chain.length; i++) {
    const link = chain[i];
    
    // 1. Verify issuer signature
    const signatureValid = await verifySignature(link);
    if (!signatureValid) {
      return { valid: false, failedAt: i, reason: 'Invalid signature' };
    }
    
    // 2. Check issuer not revoked
    const revoked = await checkRevocation(link.issuer);
    if (revoked) {
      return { valid: false, failedAt: i, reason: 'Issuer revoked' };
    }
    
    // 3. Verify scope reduction (monotonic)
    if (i > 0) {
      const parentScope = chain[i - 1].scope;
      if (!isScopeSubset(link.scope, parentScope)) {
        return { valid: false, failedAt: i, reason: 'Scope escalation' };
      }
    }
    
    // 4. Check chain depth limit
    if (i >= MAX_CHAIN_DEPTH) {
      return { valid: false, failedAt: i, reason: 'Chain too deep' };
    }
  }
  
  return { valid: true };
}
```

### 6.2 Chain Depth Limits

| Trust Tier | Max Chain Depth |
|------------|-----------------|
| T0-T1 | 1 (no delegation) |
| T2 | 2 |
| T3 | 3 |
| T4-T5 | 5 |

### 6.3 Scope Reduction Enforcement

Each delegation MUST reduce or maintain (never expand) capabilities:

```typescript
function isScopeSubset(child: Scope, parent: Scope): boolean {
  // Domain check: child domains must be subset of parent
  const childDomains = new Set(child.domains);
  const parentDomains = new Set(parent.domains);
  for (const domain of childDomains) {
    if (!parentDomains.has(domain)) return false;
  }
  
  // Level check: child level must be <= parent
  if (child.level > parent.level) return false;
  
  // Trust check: child trust must be <= parent
  if (child.trustTier > parent.trustTier) return false;
  
  return true;
}
```

---

## 7. Security Levels Summary

### SH-1: Basic Security

- [ ] DPoP for all tokens
- [ ] Access token lifetime ≤ 5 minutes
- [ ] JTI replay prevention
- [ ] ES256 minimum algorithm

### SH-2: Standard Security

- [ ] All SH-1 requirements
- [ ] Pairwise DIDs for sensitive data
- [ ] Recursive revocation support
- [ ] Delegation chain validation
- [ ] Chain depth limits

### SH-3: Hardened Security

- [ ] All SH-2 requirements
- [ ] TEE-bound keys
- [ ] Remote attestation verification
- [ ] Synchronous revocation checks
- [ ] Hardware-backed key storage

---

## 8. References

- [RFC 9449 - DPoP](https://www.rfc-editor.org/rfc/rfc9449)
- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [Intel SGX Remote Attestation](https://www.intel.com/content/www/us/en/developer/tools/software-guard-extensions/overview.html)
- [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)
- [ACI Core Specification](./aci-core.md)
- [ACI OpenID Claims](./openid-aci-claims.md)

---

*Specification authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
