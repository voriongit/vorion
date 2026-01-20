# Vorion

**Governed AI Execution Platform**

[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](LICENSE)
[![ISO 42001](https://img.shields.io/badge/ISO-42001%20Ready-green.svg)](docs/VORION_V1_FULL_APPROVAL_PDFS/ISO_42001_GAP_ANALYSIS.md)
[![AI TRiSM](https://img.shields.io/badge/AI%20TRiSM-Compliant-green.svg)](docs/VORION_V1_FULL_APPROVAL_PDFS/AI_TRISM_COMPLIANCE_MAPPING.md)

---

## Overview

Vorion is an enterprise AI governance platform that enables organizations to deploy autonomous AI systems with confidence. Built on control theory principles (STPA), Vorion provides:

- **Constraint-Based Governance** - Define what AI can and cannot do
- **Trust-Based Autonomy** - Graduated autonomy levels based on behavioral trust
- **Immutable Evidence** - Cryptographic proof chain with optional Merkle tree aggregation
- **Zero-Knowledge Audits** - Privacy-preserving trust verification via ZK proofs
- **Stepped Trust Decay** - 182-day half-life with behavioral milestones
- **Real-Time Enforcement** - Sub-millisecond policy evaluation

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VORION ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│    ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     │
│    │ INTENT  │────►│  BASIS  │────►│ ENFORCE │────►│COGNIGATE│     │
│    │ (Goals) │     │ (Rules) │     │(Decide) │     │(Execute)│     │
│    └─────────┘     └─────────┘     └─────────┘     └────┬────┘     │
│                                                          │          │
│                                                          ▼          │
│    ┌─────────────────────────────────────────────────────────┐     │
│    │                        PROOF                             │     │
│    │              (Immutable Evidence Chain)                  │     │
│    └─────────────────────────────────────────────────────────┘     │
│                              │                                      │
│                              ▼                                      │
│    ┌─────────────────────────────────────────────────────────┐     │
│    │                    TRUST ENGINE                          │     │
│    │              (Behavioral Trust Scoring)                  │     │
│    └─────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

| Component | Description | Status |
|-----------|-------------|--------|
| **BASIS** | Rule engine for constraint evaluation | In Development |
| **INTENT** | Goal and context processing | In Development |
| **ENFORCE** | Policy decision point | In Development |
| **Cognigate** | Constrained execution runtime | In Development |
| **PROOF** | Immutable evidence chain with Merkle aggregation | In Development |
| **Trust Engine** | Behavioral trust scoring with stepped decay | In Development |
| **ZK Audit** | Zero-knowledge proof generation for privacy-preserving audits | Specified |
| **Merkle Service** | Batch verification and external anchoring | Specified |

---

## Quick Start

### Prerequisites

- Node.js 20+ or Python 3.11+
- Docker (for local development)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/vorion.git
cd vorion

# Install dependencies
npm install
# or
pip install -r requirements.txt

# Copy environment configuration
cp configs/environments/.env.example .env

# Start development environment
npm run dev
# or
docker-compose up -d
```

### Basic Usage

```python
from vorion import VorionClient, Intent

client = VorionClient()

# Submit an intent for governance
intent = Intent(
    goal="Process customer refund",
    context={
        "customer_id": "cust_123",
        "amount": 150.00,
        "reason": "defective_product"
    }
)

result = client.intents.submit(intent)
print(f"Status: {result.status}")
print(f"Proof ID: {result.proof_id}")
```

---

## Project Structure

```
vorion/
├── src/
│   ├── basis/           # Rule engine
│   ├── cognigate/       # Execution gateway
│   ├── enforce/         # Policy enforcement
│   ├── intent/          # Intent processing
│   ├── proof/           # Evidence system
│   ├── trust-engine/    # Trust scoring
│   ├── api/             # API layer
│   └── common/          # Shared utilities
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── e2e/             # End-to-end tests
├── configs/
│   ├── environments/    # Environment configs
│   └── rules/           # Example rule sets
├── docs/                # Documentation
├── scripts/             # Utility scripts
└── examples/            # Example implementations
```

---

## Documentation

### Core Documentation

- [Developer Quick Start](docs/VORION_V1_FULL_APPROVAL_PDFS/DEVELOPER_QUICK_START.md)
- [STPA Implementation Guide](docs/VORION_V1_FULL_APPROVAL_PDFS/STPA_IMPLEMENTATION_GUIDE.md)
- [Platform Operations Runbook](docs/VORION_V1_FULL_APPROVAL_PDFS/PLATFORM_OPERATIONS_RUNBOOK.md)

### Technical Specifications

- [SPEC-001: ZK Audit & Merkle Tree Enhancement](docs/specs/SPEC-001-zk-audit-merkle-enhancement.md) - Zero-knowledge proofs, Merkle aggregation, stepped decay model

### Compliance & Security

- [Security Whitepaper](docs/VORION_V1_FULL_APPROVAL_PDFS/SECURITY_WHITEPAPER_ENTERPRISE.md)
- [AI TRiSM Compliance Mapping](docs/VORION_V1_FULL_APPROVAL_PDFS/AI_TRISM_COMPLIANCE_MAPPING.md)
- [ISO 42001 Gap Analysis](docs/VORION_V1_FULL_APPROVAL_PDFS/ISO_42001_GAP_ANALYSIS.md)
- [Compliance Audit Checklist](docs/VORION_V1_FULL_APPROVAL_PDFS/COMPLIANCE_AUDIT_PREPARATION_CHECKLIST.md)

### Business Documentation

- [Executive Briefing](docs/VORION_V1_FULL_APPROVAL_PDFS/EXECUTIVE_BRIEFING.md)
- [Partner Onboarding Guide](docs/VORION_V1_FULL_APPROVAL_PDFS/PARTNER_ONBOARDING_GUIDE.md)
- [Board Presentation](docs/VORION_V1_FULL_APPROVAL_PDFS/BOARD_PRESENTATION_SLIDES.md)

---

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage
```

### Code Style

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Building

```bash
# Build for production
npm run build

# Build Docker image
docker build -t vorion:latest .
```

---

## Contributing

We welcome contributions from partners and the community. Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development workflow
- Pull request process
- Coding standards

---

## Architecture Principles

### Control Theory Foundation

Vorion is built on **STPA (Systems-Theoretic Process Analysis)** principles:

- **Controller**: BASIS + ENFORCE evaluate constraints
- **Actuator**: Cognigate enforces decisions
- **Controlled Process**: AI agent execution
- **Sensor**: PROOF + Trust Engine provide feedback

### Trust Model

| Level | Score | Name | Autonomy |
|-------|-------|------|----------|
| L0 | 0-24 | Untrusted | Human approval required |
| L1 | 25-49 | Provisional | Limited operations |
| L2 | 50-74 | Trusted | Standard operations |
| L3 | 75-89 | Verified | Extended operations |
| L4 | 90-100 | Privileged | Full autonomy |

### Trust Score Decay

Trust scores decay over inactivity using a **stepped decay model** with 182-day half-life:

| Days Inactive | Score Factor | Effect |
|---------------|--------------|--------|
| 0-6 | 100% | Grace period |
| 7 | ~93% | Early warning |
| 14 | ~87% | Two-week checkpoint |
| 28 | ~80% | One-month threshold |
| 56 | ~70% | Two-month mark |
| 112 | ~58% | Four-month drop |
| 182 | 50% | **Half-life reached** |

Activity resets the decay clock. Positive signals can provide recovery bonuses.

### Proof Chain & Audit System

The PROOF component provides cryptographic evidence for every governance decision:

**Baseline Security (Required):**
- Linear hash-chain linking (tamper-evident)
- Cryptographic signatures (Ed25519/ECDSA)
- Per-entity chain isolation

**Enhanced Security (Optional):**
- **Merkle Tree Aggregation** - Batch verification, O(log n) proof verification
- **External Anchoring** - Ethereum, Polygon, RFC 3161 Timestamp Authority
- **Zero-Knowledge Proofs** - Privacy-preserving trust attestation

**Audit Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| Full | Complete proof chain export | Regulatory compliance |
| Selective | Filtered, redacted disclosure | Partner due diligence |
| ZK | Zero-knowledge claims only | Privacy-preserving verification |

**ZK Claim Types:**
- `score_gte_threshold` - Prove score meets minimum without revealing actual value
- `trust_level_gte` - Prove trust level without revealing score
- `decay_milestone_lte` - Prove recent activity without revealing exact dates
- `chain_valid` - Prove proof chain integrity

### Security Model

- Zero Trust Architecture
- Defense in Depth
- Cryptographic Integrity (SHA-256, Ed25519/ECDSA)
- Immutable Audit Trail
- Optional Merkle Tree Verification
- Zero-Knowledge Proof Support (Groth16/Circom)

---

## Security Configuration

### Environment Variables

Vorion requires the following security-related environment variables:

#### Authentication & Authorization

```bash
# JWT Secret - REQUIRED in production
# Must be at least 32 characters for HMAC-SHA256
VORION_JWT_SECRET="your-secure-jwt-secret-at-least-32-characters"

# JWT settings (optional)
VORION_JWT_EXPIRES_IN="1h"       # Token expiration (default: 1h)
VORION_JWT_ISSUER="vorion"       # JWT issuer claim
```

#### Cryptographic Signing

```bash
# Ed25519/ECDSA Signing Key - Recommended for production
# Generate with: node -e "import('./src/common/crypto.js').then(c => c.generateKeyPair().then(kp => c.exportKeyPair(kp).then(e => console.log(JSON.stringify(e)))))"
VORION_SIGNING_KEY='{"publicKey":"base64...","privateKey":"base64..."}'

# If not set, an ephemeral key is generated (warning logged in production)
```

#### Database Security

```bash
# PostgreSQL connection - REQUIRED
DATABASE_URL="postgresql://user:password@host:5432/vorion?sslmode=require"

# Connection pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL_MODE="require"      # require, verify-full, or disable
```

#### Logging & Redaction

```bash
# Log level
VORION_LOG_LEVEL="info"          # debug, info, warn, error

# Production mode enables log redaction
NODE_ENV="production"
```

### Security Best Practices

#### 1. JWT Configuration

**DO:**
- Use a cryptographically secure random secret (32+ characters)
- Rotate secrets periodically
- Use short expiration times (15m-1h for access tokens)
- Validate issuer and audience claims

**DON'T:**
- Use default or weak secrets
- Store secrets in code or version control
- Use long-lived tokens without refresh mechanism

#### 2. Signing Key Management

For production deployments:

```bash
# Generate a persistent signing key
npx tsx -e "
import { generateKeyPair, exportKeyPair } from './src/common/crypto.js';
const kp = await generateKeyPair();
const exported = await exportKeyPair(kp);
console.log('VORION_SIGNING_KEY=' + JSON.stringify(JSON.stringify(exported)));
"
```

Store the generated key securely (e.g., AWS Secrets Manager, HashiCorp Vault).

#### 3. Database Security

- Enable SSL/TLS for all database connections
- Use least-privilege database users
- Enable connection encryption in transit
- Implement proper backup encryption

#### 4. API Security

Rate limiting is configured per-tenant tier:

| Tier | Requests/Min | Requests/Hour | Burst |
|------|--------------|---------------|-------|
| Free | 60 | 1,000 | 10 |
| Pro | 300 | 10,000 | 50 |
| Enterprise | 1,000 | 50,000 | 100 |

Custom rate limits can be configured:

```typescript
import { TenantRateLimiter } from '@vorion/api/rate-limit';

const limiter = new TenantRateLimiter({
  custom: {
    requestsPerMinute: 500,
    requestsPerHour: 20000,
    burstLimit: 75,
  },
});
```

#### 5. Input Validation

All API inputs are validated with:
- Zod schema validation
- Injection pattern detection (SQL, NoSQL, XSS, command injection)
- Payload size limits (default 1MB)
- String sanitization

Configure validation:

```typescript
import { validateBody } from '@vorion/api/validation';

app.post('/endpoint', {
  preHandler: [
    validateBody(schema, {
      maxPayloadSize: 1048576,  // 1MB
      checkInjection: true,
      sanitize: true,
    }),
  ],
});
```

#### 6. Sensitive Data Handling

Vorion automatically redacts sensitive data in logs:

- Passwords, secrets, tokens
- API keys and credentials
- Authorization headers
- JWT tokens
- Private keys

Additional patterns can be configured in `src/common/redaction.ts`.

### Security Checklist

Before deploying to production:

- [ ] Set `VORION_JWT_SECRET` to a cryptographically secure value
- [ ] Generate and configure `VORION_SIGNING_KEY`
- [ ] Enable SSL for database connections
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate log level
- [ ] Review rate limit settings
- [ ] Ensure secrets are not in version control
- [ ] Set up secret rotation procedures
- [ ] Configure backup encryption
- [ ] Enable audit logging

---

## Compliance

Vorion supports compliance with:

- **EU AI Act** - High-risk AI system requirements
- **ISO 42001** - AI Management System
- **NIST AI RMF** - AI Risk Management Framework
- **SOC 2 Type II** - Security controls
- **GDPR** - Data privacy
- **CCPA** - California privacy

---

## Roadmap

### Phase 1: Foundation (Current)
- [x] Core component implementation
- [x] Basic rule engine (BASIS)
- [x] Intent processing
- [x] PROOF evidence system
- [x] Trust Engine with stepped decay (182-day half-life)

### Phase 2: Trust & Security (In Progress)
- [x] Trust Engine implementation
- [x] Stepped decay milestones (7, 14, 28, 56, 112, 182 days)
- [ ] Merkle tree aggregation for proof chain
- [ ] External anchoring (Ethereum, TSA)
- [ ] Zero-knowledge proof system (Circom/Groth16)
- [ ] Tiered audit system (Full, Selective, ZK)

### Phase 3: Enterprise
- [ ] Multi-tenant support
- [ ] Advanced analytics
- [ ] Enterprise integrations
- [ ] ZK audit API endpoints

### Phase 4: Ecosystem
- [ ] Partner SDK
- [ ] Privacy-preserving trust credentials
- [ ] Certification program

---

## Support

- **Documentation**: [docs.vorion.io](https://docs.vorion.io)
- **Issues**: [GitHub Issues](https://github.com/your-org/vorion/issues)
- **Email**: support@vorion.io
- **Community**: [community.vorion.io](https://community.vorion.io)

---

## License

Copyright 2026 Vorion, Inc. All rights reserved.

See [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with support from our partners and the AI safety community.
