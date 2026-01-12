---
sidebar_position: 4
title: Agent Identity (DID/VC)
description: Decentralized identity standards for autonomous AI agents
tags: [protocols, identity, did, verifiable-credentials, authentication]
---

# Agent Identity

## Decentralized Identity for Autonomous AI Agents

As AI agents become autonomous actors in digital systems, they need verifiable, persistent identities. Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) provide the cryptographic foundation for agent identity, authentication, and capability delegation.

## The Identity Challenge

### Why Agents Need Identity

```
                    Identity Requirements
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Without Identity:                With Identity:                     │
│                                                                      │
│  ┌───────┐    ???    ┌───────┐   ┌───────┐    DID    ┌───────┐     │
│  │Agent A│ ─────────▶│Agent B│   │Agent A│ ─────────▶│Agent B│     │
│  └───────┘           └───────┘   │did:..1│    VC     │did:..2│     │
│                                  └───────┘           └───────┘     │
│  • Who is this agent?            • Cryptographically verified       │
│  • What can it do?               • Capabilities attested            │
│  • Should I trust it?            • Trust score verifiable           │
│  • Who created it?               • Provenance established           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Identity vs Authentication

| Concept | Purpose | Technology |
|---------|---------|------------|
| **Identity** | "Who is this agent?" | DIDs |
| **Authentication** | "Prove you are who you claim" | Cryptographic signatures |
| **Authorization** | "What can this agent do?" | Verifiable Credentials |
| **Reputation** | "Should I trust this agent?" | Trust scores, attestations |

## Decentralized Identifiers (DIDs)

### DID Structure

A DID is a URI that resolves to a DID Document:

```
did:method:specific-identifier
│   │       │
│   │       └── Unique identifier within the method
│   └────────── DID method (defines how to resolve)
└────────────── DID scheme (always "did")

Examples:
• did:web:agent.example.com
• did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
• did:basis:agent_abc123
• did:ethr:0x1234...5678
```

### DID Document

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  "id": "did:basis:agent_trading_bot_001",
  "controller": "did:basis:enterprise_corp",

  "verificationMethod": [
    {
      "id": "did:basis:agent_trading_bot_001#keys-1",
      "type": "JsonWebKey2020",
      "controller": "did:basis:agent_trading_bot_001",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "..."
      }
    }
  ],

  "authentication": [
    "did:basis:agent_trading_bot_001#keys-1"
  ],

  "assertionMethod": [
    "did:basis:agent_trading_bot_001#keys-1"
  ],

  "service": [
    {
      "id": "did:basis:agent_trading_bot_001#a2a",
      "type": "A2AEndpoint",
      "serviceEndpoint": "https://agent.example.com/a2a"
    },
    {
      "id": "did:basis:agent_trading_bot_001#metadata",
      "type": "AgentMetadata",
      "serviceEndpoint": "https://agent.example.com/.well-known/agent.json"
    }
  ]
}
```

### DID Methods for Agents

| Method | Anchoring | Resolution Speed | Decentralization | Best For |
|--------|-----------|------------------|------------------|----------|
| **did:web** | DNS | Fast | Low | Enterprise agents |
| **did:key** | None (self-certifying) | Instant | High | Ephemeral agents |
| **did:ethr** | Ethereum | Medium | High | On-chain verification |
| **did:basis** | BASIS network | Fast | High | Trust-scored agents |
| **did:ion** | Bitcoin | Slow | Very High | Long-term identity |

### Creating Agent DIDs

```python
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import json
import hashlib
import base64

class AgentDIDManager:
    """Manage agent decentralized identifiers."""

    def create_did_key(self) -> Tuple[str, dict]:
        """Create a did:key identifier."""
        # Generate key pair
        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        public_key = private_key.public_key()

        # Encode public key
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint
        )

        # Create multibase-encoded identifier
        multicodec_prefix = bytes([0x80, 0x24])  # p256-pub
        identifier = base64.urlsafe_b64encode(
            multicodec_prefix + public_bytes
        ).decode().rstrip('=')

        did = f"did:key:z{identifier}"

        did_document = {
            "@context": ["https://www.w3.org/ns/did/v1"],
            "id": did,
            "verificationMethod": [{
                "id": f"{did}#key-1",
                "type": "JsonWebKey2020",
                "controller": did,
                "publicKeyJwk": self._key_to_jwk(public_key)
            }],
            "authentication": [f"{did}#key-1"],
            "assertionMethod": [f"{did}#key-1"]
        }

        return did, did_document, private_key

    def create_did_web(self, domain: str, path: str = "") -> str:
        """Create a did:web identifier."""
        if path:
            return f"did:web:{domain}:{path.replace('/', ':')}"
        return f"did:web:{domain}"

    async def resolve_did(self, did: str) -> dict:
        """Resolve a DID to its document."""
        method = did.split(":")[1]

        if method == "key":
            return self._resolve_did_key(did)
        elif method == "web":
            return await self._resolve_did_web(did)
        elif method == "basis":
            return await self._resolve_did_basis(did)
        else:
            raise ValueError(f"Unsupported DID method: {method}")

    async def _resolve_did_web(self, did: str) -> dict:
        """Resolve did:web by fetching DID document from domain."""
        # did:web:example.com -> https://example.com/.well-known/did.json
        # did:web:example.com:agents:bot1 -> https://example.com/agents/bot1/did.json

        parts = did.split(":")[2:]
        domain = parts[0]
        path = "/".join(parts[1:]) if len(parts) > 1 else ".well-known"

        url = f"https://{domain}/{path}/did.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            return response.json()
```

## Verifiable Credentials

### Credential Structure

A Verifiable Credential attests to claims about an agent:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://basis.vorion.org/credentials/v1"
  ],
  "id": "https://issuer.example.com/credentials/agent-capability-001",
  "type": ["VerifiableCredential", "AgentCapabilityCredential"],
  "issuer": {
    "id": "did:basis:issuer_authority",
    "name": "Agent Certification Authority"
  },
  "issuanceDate": "2025-01-15T00:00:00Z",
  "expirationDate": "2026-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:basis:agent_trading_bot_001",
    "agentType": "AutonomousTrader",
    "capabilities": [
      "market_data_analysis",
      "order_execution",
      "risk_assessment"
    ],
    "constraints": {
      "maxOrderSize": 10000,
      "tradingPairs": ["BTC/USD", "ETH/USD"],
      "requiresHumanApproval": {
        "threshold": 5000
      }
    },
    "trustScore": {
      "overall": 0.87,
      "components": {
        "performance": 0.92,
        "security": 0.85,
        "compliance": 0.84
      }
    }
  },
  "proof": {
    "type": "JsonWebSignature2020",
    "created": "2025-01-15T00:00:00Z",
    "verificationMethod": "did:basis:issuer_authority#keys-1",
    "proofPurpose": "assertionMethod",
    "jws": "eyJhbGciOiJFUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..."
  }
}
```

### Common Credential Types

| Credential Type | Purpose | Issued By |
|-----------------|---------|-----------|
| **AgentCapabilityCredential** | Attests to agent capabilities | Certification authority |
| **AgentOwnershipCredential** | Proves who controls agent | Owner/enterprise |
| **AgentTrustCredential** | Current trust score | Trust oracle |
| **AgentComplianceCredential** | Regulatory compliance | Auditor |
| **AgentDelegationCredential** | Delegated permissions | Delegating agent |

### Issuing Credentials

```python
from datetime import datetime, timedelta
import jwt

class CredentialIssuer:
    """Issue verifiable credentials for agents."""

    def __init__(self, issuer_did: str, private_key):
        self.issuer_did = issuer_did
        self.private_key = private_key

    def issue_capability_credential(
        self,
        subject_did: str,
        capabilities: List[str],
        constraints: dict = None,
        validity_days: int = 365
    ) -> dict:
        """Issue a capability credential."""

        credential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://basis.vorion.org/credentials/v1"
            ],
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": ["VerifiableCredential", "AgentCapabilityCredential"],
            "issuer": self.issuer_did,
            "issuanceDate": datetime.utcnow().isoformat() + "Z",
            "expirationDate": (
                datetime.utcnow() + timedelta(days=validity_days)
            ).isoformat() + "Z",
            "credentialSubject": {
                "id": subject_did,
                "capabilities": capabilities,
                "constraints": constraints or {}
            }
        }

        # Sign the credential
        credential["proof"] = self._create_proof(credential)

        return credential

    def _create_proof(self, credential: dict) -> dict:
        """Create cryptographic proof for credential."""
        # Create canonical form for signing
        canonical = self._canonicalize(credential)

        # Sign with private key
        signature = self._sign(canonical, self.private_key)

        return {
            "type": "JsonWebSignature2020",
            "created": datetime.utcnow().isoformat() + "Z",
            "verificationMethod": f"{self.issuer_did}#keys-1",
            "proofPurpose": "assertionMethod",
            "jws": signature
        }

    def issue_delegation_credential(
        self,
        from_did: str,
        to_did: str,
        delegated_capabilities: List[str],
        conditions: dict = None
    ) -> dict:
        """Issue credential delegating capabilities to another agent."""

        return self.issue_capability_credential(
            subject_did=to_did,
            capabilities=delegated_capabilities,
            constraints={
                "delegatedFrom": from_did,
                "conditions": conditions or {},
                "revocable": True
            }
        )
```

### Verifying Credentials

```python
class CredentialVerifier:
    """Verify agent credentials."""

    async def verify(self, credential: dict) -> VerificationResult:
        """Verify a verifiable credential."""
        results = []

        # 1. Check structure
        results.append(await self._verify_structure(credential))

        # 2. Check expiration
        results.append(self._verify_temporal(credential))

        # 3. Verify issuer
        results.append(await self._verify_issuer(credential))

        # 4. Verify signature
        results.append(await self._verify_signature(credential))

        # 5. Check revocation status
        results.append(await self._verify_not_revoked(credential))

        return VerificationResult(
            valid=all(r.valid for r in results),
            checks=results
        )

    async def _verify_signature(self, credential: dict) -> CheckResult:
        """Verify the cryptographic signature."""
        proof = credential.get("proof", {})

        # Resolve issuer's DID document
        issuer_did = credential["issuer"]
        if isinstance(issuer_did, dict):
            issuer_did = issuer_did["id"]

        did_document = await self.did_resolver.resolve(issuer_did)

        # Find verification method
        vm_id = proof.get("verificationMethod")
        verification_method = next(
            (vm for vm in did_document.get("verificationMethod", [])
             if vm["id"] == vm_id),
            None
        )

        if not verification_method:
            return CheckResult(valid=False, error="Verification method not found")

        # Verify signature
        public_key = self._extract_public_key(verification_method)
        credential_without_proof = {k: v for k, v in credential.items() if k != "proof"}
        canonical = self._canonicalize(credential_without_proof)

        try:
            self._verify_jws(proof["jws"], canonical, public_key)
            return CheckResult(valid=True)
        except Exception as e:
            return CheckResult(valid=False, error=str(e))
```

## Credential Presentation

### Verifiable Presentations

Agents present credentials to prove capabilities:

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiablePresentation"],
  "holder": "did:basis:agent_trading_bot_001",
  "verifiableCredential": [
    {
      "...capability credential..."
    },
    {
      "...trust score credential..."
    }
  ],
  "proof": {
    "type": "JsonWebSignature2020",
    "created": "2025-01-15T12:00:00Z",
    "challenge": "random-challenge-from-verifier",
    "domain": "https://exchange.example.com",
    "verificationMethod": "did:basis:agent_trading_bot_001#keys-1",
    "proofPurpose": "authentication",
    "jws": "..."
  }
}
```

### Selective Disclosure

Reveal only necessary information:

```python
class SelectiveDisclosure:
    """Create presentations with minimal disclosure."""

    def create_presentation(
        self,
        credentials: List[dict],
        required_claims: List[str],
        challenge: str,
        domain: str
    ) -> dict:
        """Create presentation revealing only required claims."""

        disclosed_credentials = []
        for cred in credentials:
            # Create derived credential with only required claims
            derived = self._derive_credential(cred, required_claims)
            disclosed_credentials.append(derived)

        presentation = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiablePresentation"],
            "holder": self.agent_did,
            "verifiableCredential": disclosed_credentials
        }

        # Sign presentation
        presentation["proof"] = self._create_presentation_proof(
            presentation,
            challenge,
            domain
        )

        return presentation
```

## Agent Authentication Flow

```
┌─────────────┐                              ┌─────────────┐
│  Agent A    │                              │  Agent B    │
│  (Client)   │                              │  (Server)   │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │  1. Request access                         │
       │ ─────────────────────────────────────────▶ │
       │                                            │
       │  2. Challenge (nonce + required claims)    │
       │ ◀───────────────────────────────────────── │
       │                                            │
       │  3. Verifiable Presentation                │
       │     (credentials + proof over challenge)   │
       │ ─────────────────────────────────────────▶ │
       │                                            │
       │                           4. Verify:       │
       │                           - Resolve DIDs   │
       │                           - Check sigs     │
       │                           - Validate VCs   │
       │                           - Check trust    │
       │                                            │
       │  5. Access granted/denied                  │
       │ ◀───────────────────────────────────────── │
       │                                            │
```

### Implementation

```python
class AgentAuthenticator:
    """Authenticate agents using DIDs and VCs."""

    async def authenticate(self, request: AuthRequest) -> AuthResult:
        """Authenticate an agent request."""

        # 1. Generate challenge
        challenge = secrets.token_hex(32)

        # 2. Request presentation
        presentation = await self._request_presentation(
            agent_endpoint=request.agent_url,
            challenge=challenge,
            required_credentials=["AgentCapabilityCredential"]
        )

        # 3. Verify presentation
        verification = await self.verifier.verify_presentation(
            presentation=presentation,
            challenge=challenge,
            domain=self.domain
        )

        if not verification.valid:
            return AuthResult(authenticated=False, error=verification.error)

        # 4. Extract agent identity and capabilities
        agent_did = presentation["holder"]
        capabilities = self._extract_capabilities(presentation)

        # 5. Check trust score
        trust_score = await self.trust_oracle.get_score(agent_did)

        return AuthResult(
            authenticated=True,
            agent_did=agent_did,
            capabilities=capabilities,
            trust_score=trust_score
        )
```

## Revocation

### Credential Status

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "id": "https://issuer.example.com/credentials/123",
  "type": ["VerifiableCredential", "AgentCapabilityCredential"],
  "credentialStatus": {
    "id": "https://issuer.example.com/status/123#0",
    "type": "StatusList2021Entry",
    "statusPurpose": "revocation",
    "statusListIndex": "0",
    "statusListCredential": "https://issuer.example.com/status/123"
  },
  "...": "..."
}
```

### Revocation Check

```python
async def check_revocation(credential: dict) -> bool:
    """Check if credential has been revoked."""
    status = credential.get("credentialStatus")
    if not status:
        return False  # No status = not revocable

    if status["type"] == "StatusList2021Entry":
        # Fetch status list
        status_list = await fetch_status_list(status["statusListCredential"])

        # Check bit at index
        index = int(status["statusListIndex"])
        return is_bit_set(status_list, index)

    return False
```

## Research Foundations

Agent identity builds on established standards:

- **W3C DID Core** (2022) - Decentralized Identifier specification
- **W3C Verifiable Credentials** (2022) - Data model for credentials
- **DIF Presentation Exchange** - Credential request/response protocol
- **KERI** - Key Event Receipt Infrastructure for key management

---

## See Also

- [BASIS Standard](./basis-standard.md) - Comprehensive agent framework
- [Trust Scoring](../safety/trust-scoring.md) - Agent reputation
- [A2A Protocol](./a2a.md) - Using identity in agent communication
