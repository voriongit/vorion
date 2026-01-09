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
- **Immutable Evidence** - Complete audit trail for every AI decision
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
| **PROOF** | Immutable evidence chain | In Development |
| **Trust Engine** | Behavioral trust scoring | In Development |

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
| L0 | 0-199 | Untrusted | Human approval required |
| L1 | 200-399 | Provisional | Limited operations |
| L2 | 400-599 | Trusted | Standard operations |
| L3 | 600-799 | Verified | Extended operations |
| L4 | 800-1000 | Privileged | Full autonomy |

### Security Model

- Zero Trust Architecture
- Defense in Depth
- Cryptographic Integrity (SHA-3-256, Ed25519)
- Immutable Audit Trail

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
- [ ] Core component implementation
- [ ] Basic rule engine (BASIS)
- [ ] Intent processing
- [ ] PROOF evidence system

### Phase 2: Trust & Security
- [ ] Trust Engine implementation
- [ ] Advanced security controls
- [ ] Anomaly detection

### Phase 3: Enterprise
- [ ] Multi-tenant support
- [ ] Advanced analytics
- [ ] Enterprise integrations

### Phase 4: Ecosystem
- [ ] Partner SDK
- [ ] Marketplace
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
