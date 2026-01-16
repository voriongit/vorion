# Malleable Cryptography Assessment for Vorion Suite

> **Purpose**: Dev team assessment document for implementing configurable cryptography layers across the Vorion ecosystem (Cognigate, Aurais, AgentAnchor, ATSF).

## Executive Summary

Users need flexibility in how their AI agent data is stored:
- **Full Transparency**: Public/unencrypted for audits, open ecosystems
- **Lock Box**: Encrypted with user-controlled keys for privacy
- **Hybrid**: Mix of both (e.g., public scores, private logs)

The system must be **malleable** - users configure crypto modes per-project, per-agent, or per-session.

---

## Storage Modes Comparison

| Mode | Description | Pros | Cons |
|------|-------------|------|------|
| **Transparent** | Data stored openly, hashed for integrity | Easy audits, simple implementation, full data utility for AI | Privacy risks, regulatory issues (GDPR), vulnerability to tampering |
| **Lock Box** | AES-256 encrypted, user keys required | Strong privacy, compliance-friendly, selective sharing | Key management overhead, reduced utility, higher compute cost |
| **Hybrid** | Partial encryption (public scores, private logs) | Balanced approach, flexible per-field | More complex implementation, config management |

---

## Tech Stack Iterations

### V1: Basic MVP (Quick Launch)
**Focus**: Simple toggles, low overhead

| Component | Technology | Notes |
|-----------|------------|-------|
| Storage | PostgreSQL + `pg_crypto` extension | AES-256 at rest |
| Crypto Libs | `cryptography` (Python), `crypto-js` (TS) | Key gen/access |
| Framework | LangChain with encryption hooks | Agent orchestration |
| Security | Auth0/Firebase + TLS 1.3 | Basic access controls |

**Assessment Tasks**:
- [ ] Latency tests: Query times with/without encryption
- [ ] Security audit: Penetration testing for key leaks
- [ ] Cost estimate: AWS/GCP hosting for 1K users

### V2: Enterprise-Ready (Advanced)
**Focus**: In-use encryption, hybrid modes

| Component | Technology | Notes |
|-----------|------------|-------|
| Storage | PostgreSQL + Pinecone (vectors) | Metadata encryption |
| Crypto | Microsoft SEAL (homomorphic), Opacus (differential privacy) | Compute on encrypted data |
| Framework | Semantic Kernel / LangGraph | Encrypted runtime state |
| Security | AWS Nitro Enclaves, Redis (key cache) | Confidential computing |

**Assessment Tasks**:
- [ ] Utility impact: Test AI accuracy with differential privacy noise
- [ ] Scalability: Load test for 10K agents
- [ ] Integration POC: Cognigate API with encrypted payloads

### V3: Legendary (Full Ecosystem)
**Focus**: User-defined policies, blockchain hybrid, ZK proofs

| Component | Technology | Notes |
|-----------|------------|-------|
| Storage | PostgreSQL + Pinecone + Kafka | Encrypted streams |
| Crypto | Homomorphic + ZK-SNARKs (Circom/snarkjs) + Federated Learning | Full PETs suite |
| Framework | MCP Gateway + LangChain + Polygon L2 | Agent security mesh |
| Security | AI SOC (Torq/Conifers) | Agentic monitoring |

**Assessment Tasks**:
- [ ] Adoption sim: User testing for toggle UX
- [ ] Threat modeling: Simulate breaches in each mode
- [ ] Roadmap: Cost-benefit for open-sourcing crypto modules

---

## ZK-SNARKs for AI Governance

### Why ZK-SNARKs?
- Prove AI decisions/compliance **without revealing** underlying data
- Verify trust scores, model integrity, audit trails privately
- Enable "lock box" mode with auditable proofs

### Key Applications

1. **Privacy-Preserving Decision Verification**
   - Prove agent acted within policy without exposing decision logic
   - Use case: Healthcare AI proving treatment compliance

2. **Verifiable AI Inferences**
   - Cryptographically verify model outputs
   - Trust scoring proofs without revealing scores

3. **zkML (Zero-Knowledge Machine Learning)**
   - Prove training processes align with standards
   - E-governance: Budget allocation proofs

### Dynamic ZK-SNARKs (2024 Research)
**Problem**: Static proofs require full recomputation on data change
**Solution**: Incremental proof updates for evolving AI models

| Variant | Update Time | Proof Size | Use Case |
|---------|-------------|------------|----------|
| Dynaverse | O(√n log²n) | O(1) constant | Minimal storage |
| Dynalog | O(log³n) | O(log³n) | Balanced efficiency |

**Benefits for Vorion**:
- Trust score decay can be proven without decrypting
- Agent state changes generate incremental proofs
- Blockchain sync only needs proof deltas

---

## Implementation Architecture

```
[User/App (Aurais Console / AgentAnchor Dashboard)]
          |
          v
[Config Layer]  <-- Toggle: transparent | lockbox | hybrid
          |
          v
[Encryption Router]
  - Transparent: Hash only (SHA-256)
  - Lockbox: AES-256 + optional HE/ZKP
          |
          v
[Storage Backend]
  - PostgreSQL (metadata, scores)
  - Pinecone (vector embeddings)
  - Optional: Polygon (transparent proofs)
          |
          v
[Runtime Ops (Cognigate / Aurais)]
  - Encrypt/decrypt on-the-fly
  - Compute on encrypted data (HE)
  - Prove integrity (ZKP)
```

---

## Console Commands (Aurais)

```bash
/crypto-mode [transparent|lockbox|hybrid]  # Set mode
/crypto-status                              # Show current config
/crypto-toggle                              # Quick switch
/decrypt-log [id]                          # Access encrypted log (requires key)
/prove-score [agent_id]                    # Generate ZK proof of score
```

---

## Key Management Strategy

1. **User-Controlled Keys**
   - Generate client-side (WebCrypto API)
   - Never transmit raw keys to server

2. **Key Derivation**
   - PBKDF2 with 480,000 iterations
   - Unique salt per user

3. **Recovery**
   - Encrypted backup in DB
   - Recovery phrase prompt on setup
   - **Warning**: Lost keys = permanent data loss

---

## Security Recommendations

| Area | Recommendation |
|------|----------------|
| Libraries | `cryptography` (Python), `crypto-js`/`libsodium` (TS), Microsoft SEAL (HE) |
| Audits | OWASP ASVS, Bandit (Python), penetration testing |
| Transit | Always TLS 1.3 |
| At-Rest | AES-256 (optional based on mode) |
| In-Use | Homomorphic encryption for lock box computations |

---

## Code Examples

### Basic AES-256 Encryption (Python)

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import base64, os

def derive_key(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
    if salt is None:
        salt = os.urandom(16)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=480000)
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key, salt

def encrypt_data(data: str, password: str) -> str:
    key, salt = derive_key(password)
    fernet = Fernet(key)
    encrypted = fernet.encrypt(data.encode())
    return base64.b64encode(salt + encrypted).decode()

def decrypt_data(encrypted_str: str, password: str) -> str:
    data = base64.b64decode(encrypted_str)
    salt, encrypted = data[:16], data[16:]
    key, _ = derive_key(password, salt)
    return Fernet(key).decrypt(encrypted).decode()
```

### Crypto Mode Config (TypeScript)

```typescript
type CryptoMode = 'transparent' | 'lockbox' | 'hybrid';

interface CryptoConfig {
  mode: CryptoMode;
  encryptScores: boolean;
  encryptLogs: boolean;
  encryptState: boolean;
}

const DEFAULT_CONFIG: Record<CryptoMode, CryptoConfig> = {
  transparent: { mode: 'transparent', encryptScores: false, encryptLogs: false, encryptState: false },
  lockbox: { mode: 'lockbox', encryptScores: true, encryptLogs: true, encryptState: true },
  hybrid: { mode: 'hybrid', encryptScores: false, encryptLogs: true, encryptState: true },
};

async function setCryptoMode(agentId: string, mode: CryptoMode): Promise<void> {
  const config = DEFAULT_CONFIG[mode];
  await db.query('UPDATE agent_crypto SET config = $1 WHERE agent_id = $2', [config, agentId]);
}
```

---

## Assessment Checklist for Dev

### Phase 1 (V1 MVP)
- [ ] Implement `crypto_mode` enum in PostgreSQL schema
- [ ] Add `/crypto-toggle` command to Aurais console
- [ ] Wrap Cognigate PROOF endpoints with mode check
- [ ] Benchmark: Latency impact of AES-256 on log writes
- [ ] Test: Key derivation with PBKDF2

### Phase 2 (V2 Enterprise)
- [ ] POC: Microsoft SEAL for homomorphic trust decay
- [ ] Integrate Pinecone metadata encryption
- [ ] Add differential privacy option for transparent mode
- [ ] Load test: 10K agents with mixed modes

### Phase 3 (V3 ZK Integration)
- [ ] Research: Circom circuits for trust score proofs
- [ ] POC: ZK-SNARK proof generation for audit logs
- [ ] Design: Dynamic zk-SNARK update mechanism for evolving agents
- [ ] Blockchain: Optional Polygon sync for transparent proofs

---

## References

- [Microsoft SEAL](https://github.com/microsoft/SEAL) - Homomorphic encryption
- [Circom](https://docs.circom.io/) - ZK-SNARK circuit compiler
- [snarkjs](https://github.com/iden3/snarkjs) - ZK-SNARK JavaScript implementation
- [Dynamic zk-SNARKs Paper](https://eprint.iacr.org/2024/1566) - IACR 2024
- [Lagrange ZK Coprocessor](https://lagrange.dev) - Verifiable AI infrastructure

---

**Created**: 2026-01-16
**Status**: Assessment Ready
**Next Step**: Dev team review and POC prioritization
