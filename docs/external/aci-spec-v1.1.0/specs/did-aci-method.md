# DID Method Specification: did:aci

**DID Method for Agent Classification Identifiers**  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** January 2026

---

## Abstract

This specification defines the `did:aci` DID method, which provides decentralized identifiers for AI agents registered with the Agent Classification Identifier (ACI) system. The method enables cryptographic verification of agent identity and capabilities.

---

## 1. Introduction

### 1.1 Purpose

The `did:aci` method bridges the ACI specification with the W3C Decentralized Identifier standard, enabling:

- Cryptographic verification of agent identity
- Decentralized capability attestation
- Interoperability with DID-based systems
- Verifiable credential issuance for agents

### 1.2 Conformance

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

---

## 2. Method Syntax

### 2.1 Method Name

The method name is: `aci`

### 2.2 Method-Specific Identifier

```
did:aci:<registry>:<organization>:<agent-class>[:<instance>]
```

### 2.3 ABNF

```abnf
did-aci        = "did:aci:" method-specific-id
method-specific-id = registry ":" organization ":" agent-class [":" instance]

registry       = 1*ALPHA
organization   = 1*(ALPHA / DIGIT / "-")
agent-class    = 1*(ALPHA / DIGIT / "-")
instance       = 1*(ALPHA / DIGIT)
```

### 2.4 Examples

```
did:aci:a3i:vorion:banquet-advisor
did:aci:a3i:vorion:banquet-advisor:prod001
did:aci:a3i:acme:support-agent
did:aci:eu-ai:example:data-processor:staging
```

---

## 3. DID Document

### 3.1 Structure

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://aci.agentanchor.io/ns/aci/v1"
  ],
  "id": "did:aci:a3i:vorion:banquet-advisor",
  "controller": "did:web:vorion.org",
  
  "verificationMethod": [
    {
      "id": "did:aci:a3i:vorion:banquet-advisor#keys-1",
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
  
  "authentication": [
    "did:aci:a3i:vorion:banquet-advisor#keys-1"
  ],
  
  "assertionMethod": [
    "did:aci:a3i:vorion:banquet-advisor#keys-1"
  ],
  
  "service": [
    {
      "id": "did:aci:a3i:vorion:banquet-advisor#agent-endpoint",
      "type": "AgentService",
      "serviceEndpoint": "https://agents.vorion.org/banquet-advisor"
    },
    {
      "id": "did:aci:a3i:vorion:banquet-advisor#aci-registry",
      "type": "ACIRegistry",
      "serviceEndpoint": "https://registry.agentanchor.io"
    }
  ],
  
  "aciCapabilities": {
    "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
    "domains": 164,
    "domainList": ["F", "H", "C"],
    "level": 3,
    "trustTier": 2,
    "version": "1.2.0"
  },
  
  "aciAttestations": [
    {
      "id": "did:aci:a3i:vorion:banquet-advisor#att-1",
      "type": "ACIAttestation",
      "issuer": "did:web:agentanchor.io",
      "issuanceDate": "2025-12-01T00:00:00Z",
      "expirationDate": "2026-06-01T00:00:00Z",
      "credentialSubject": {
        "id": "did:aci:a3i:vorion:banquet-advisor",
        "scope": "full",
        "trustTier": 2
      },
      "proof": {
        "type": "JsonWebSignature2020",
        "created": "2025-12-01T00:00:00Z",
        "verificationMethod": "did:web:agentanchor.io#signing-key",
        "proofPurpose": "assertionMethod",
        "jws": "eyJhbGciOiJFUzI1NiJ9..."
      }
    }
  ],
  
  "created": "2025-11-15T00:00:00Z",
  "updated": "2025-12-01T00:00:00Z"
}
```

### 3.2 ACI-Specific Properties

#### 3.2.1 aciCapabilities

The `aciCapabilities` property MUST be present and contain:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `aci` | string | Yes | Full ACI string |
| `domains` | integer | Yes | Domain bitmask |
| `domainList` | string[] | Yes | Domain code array |
| `level` | integer | Yes | Capability level (0-5) |
| `trustTier` | integer | Yes | Trust tier (0-5) |
| `version` | string | Yes | Semantic version |
| `skills` | string | No | Base64 skill bitmask |

#### 3.2.2 aciAttestations

The `aciAttestations` property contains an array of Verifiable Credentials attesting to agent properties.

---

## 4. CRUD Operations

### 4.1 Create

Agent registration is performed through the registry API:

```http
POST /agents HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
Content-Type: application/json

{
  "organization": "vorion",
  "agentClass": "banquet-advisor",
  "capabilities": {
    "domains": ["F", "H", "C"],
    "level": 3
  },
  "publicKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  }
}
```

### 4.2 Read (Resolve)

DID resolution is performed via:

```http
GET /did/aci/a3i/vorion/banquet-advisor HTTP/1.1
Host: registry.agentanchor.io
Accept: application/did+json
```

### 4.3 Update

Updates require authentication with the agent's private key:

```http
PATCH /agents/vorion/banquet-advisor HTTP/1.1
Host: registry.agentanchor.io
Authorization: DIDAuth <signed-challenge>
Content-Type: application/json

{
  "capabilities": {
    "level": 4
  }
}
```

### 4.4 Deactivate

```http
DELETE /agents/vorion/banquet-advisor HTTP/1.1
Host: registry.agentanchor.io
Authorization: DIDAuth <signed-challenge>
```

---

## 5. Resolution

### 5.1 Resolution Algorithm

1. Parse the DID to extract registry, organization, and agent-class
2. Determine registry endpoint from known registries
3. Query registry API for DID Document
4. Verify document signature
5. Return DID Document or resolution error

### 5.2 Resolution Metadata

```json
{
  "didResolutionMetadata": {
    "contentType": "application/did+json",
    "duration": 42
  },
  "didDocument": { ... },
  "didDocumentMetadata": {
    "created": "2025-11-15T00:00:00Z",
    "updated": "2025-12-01T00:00:00Z",
    "versionId": "1.2.0"
  }
}
```

### 5.3 Error Handling

| Error | Description |
|-------|-------------|
| `notFound` | DID does not exist |
| `deactivated` | Agent has been deactivated |
| `invalidDid` | DID format is invalid |
| `registryUnavailable` | Registry is unreachable |

---

## 6. Security Considerations

### 6.0 Pairwise DID Requirement (MANDATORY for Private Data)

When agents interact with services involving non-public data (PII, financial, health), they MUST use pairwise DIDs to prevent correlation attacks.

#### 6.0.1 The Correlation Risk

If Agent A uses the same DID to book a flight and a medical appointment, the verifiers (airline and hospital) can collude to build a profile by comparing DIDs across transactions.

#### 6.0.2 Pairwise DID Generation

For each unique relying party relationship, agents MUST derive a unique DID:

```typescript
function derivePairwiseDID(
  masterDID: string,
  relierPartyDID: string,
  salt: string
): string {
  const input = `${masterDID}:${relierPartyDID}:${salt}`;
  const hash = sha256(input);
  return `did:aci:${hash.substring(0, 32)}`;
}
```

#### 6.0.3 DID Method Selection by Context

| Context | Required DID Method | Rationale |
|---------|---------------------|-----------|
| Public discovery | `did:web` or `did:aci` | Resolvability needed |
| Agent-to-agent (public) | `did:aci` | Verifiable identity |
| Agent-to-agent (private) | `did:peer` (pairwise) | Unlinkable |
| User data interactions | Pairwise derived | Correlation prevention |
| Financial transactions | Pairwise + TEE-bound | Maximum security |

#### 6.0.4 Prohibition on DID Reuse

Agents MUST NOT reuse the same DID across:
- Different relying parties handling private data
- Different user delegation contexts
- Cross-organizational boundaries

Violation of pairwise requirements SHOULD result in trust tier demotion.

---

### 6.1 Key Management

- Agents SHOULD use hardware-backed keys when available
- Key rotation SHOULD be performed annually
- Compromised keys MUST be revoked immediately

### 6.2 Registry Trust

- Resolvers SHOULD maintain a list of trusted registries
- Cross-registry resolution requires explicit trust configuration

### 6.3 Attestation Verification

- Attestations MUST be verified before trusting capability claims
- Expired attestations MUST be rejected
- Revocation status SHOULD be checked

---

## 7. Privacy Considerations

### 7.1 Correlation Risk

DID:ACI identifiers are persistent and can be used for correlation. Organizations should:

- Use instance identifiers for ephemeral agents
- Consider privacy implications of public registry listings

### 7.2 Capability Exposure

The aciCapabilities property reveals agent capabilities. Consider:

- Restricting access to full DID Documents
- Using capability tokens instead of full resolution

---

## 8. Registry Endpoints

### 8.1 Known Registries

| Registry | Resolver Endpoint |
|----------|-------------------|
| `a3i` | `https://registry.agentanchor.io` |
| `eu-ai` | `https://ai-registry.europa.eu` |
| `self` | (Self-resolution required) |

### 8.2 Universal Resolver Integration

The `did:aci` method is designed for integration with the DIF Universal Resolver:

```
https://resolver.identity.foundation/1.0/identifiers/did:aci:a3i:vorion:banquet-advisor
```

---

## 9. References

- [W3C DID Core Specification](https://www.w3.org/TR/did-core/)
- [W3C DID Resolution](https://w3c-ccg.github.io/did-resolution/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [ACI Core Specification](./aci-core.md)

---

*Specification authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
