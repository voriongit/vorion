# BASIS (Baseline Authority for Safe & Interoperable Systems)

[![Status](https://img.shields.io/badge/Status-V1.0.0-green)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue)]()
[![Docs](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey)]()
[![Steward](https://img.shields.io/badge/Steward-VORION-black)](https://vorion.org)

**BASIS** is an open governance standard for AI agent systems. It defines how autonomous systems must be controlled, monitored, and audited before taking action.

The standard establishes a universal framework for:
- **Trust Quantification** — 0-1000 scoring with 6 tiers (Sandbox → Autonomous)
- **Capability Gating** — 100+ hierarchical permissions across 7 namespaces
- **Immutable Audit Trails** — Cryptographic proof chains with optional blockchain anchoring

---

## 📐 The Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: INTENT    → Parse & classify action requests      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: ENFORCE   → Evaluate against trust & policies     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: PROOF     → Log with cryptographic integrity      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: CHAIN     → Anchor to blockchain (optional)       │
└─────────────────────────────────────────────────────────────┘
```

**Governance Before Execution**: No autonomous action proceeds without passing through governance checks.

---

## 📂 Repository Structure

```text
basis-core/
├── specs/             # Complete specification documents
│   ├── BASIS-SPECIFICATION.md        # Core normative spec
│   ├── BASIS-CAPABILITY-TAXONOMY.md  # 100+ capabilities reference
│   ├── BASIS-JSON-SCHEMAS.md         # Wire protocol schemas
│   ├── BASIS-ERROR-CODES.md          # 60+ error codes
│   ├── BASIS-THREAT-MODEL.md         # Security analysis
│   ├── BASIS-FAILURE-MODES.md        # Failure handling
│   ├── BASIS-COMPLIANCE-MAPPING.md   # SOC2, ISO, GDPR, HIPAA mapping
│   └── BASIS-MIGRATION-GUIDE.md      # Adoption roadmap
├── schemas/           # JSON Schema definitions
├── examples/          # Reference policy sets
├── lib/               # Validation libraries (Python/TS)
└── proposals/         # Community RFCs
```

---

## 📚 Specification Documents

| Document | Size | Description |
|----------|------|-------------|
| [BASIS-SPECIFICATION.md](specs/BASIS-SPECIFICATION.md) | 28K | Core spec: architecture, trust model, conformance levels |
| [BASIS-CAPABILITY-TAXONOMY.md](specs/BASIS-CAPABILITY-TAXONOMY.md) | 18K | 100+ capabilities across 7 namespaces |
| [BASIS-JSON-SCHEMAS.md](specs/BASIS-JSON-SCHEMAS.md) | 28K | Complete wire protocol schemas |
| [BASIS-ERROR-CODES.md](specs/BASIS-ERROR-CODES.md) | 16K | 60+ error codes in 12 categories |
| [BASIS-THREAT-MODEL.md](specs/BASIS-THREAT-MODEL.md) | 20K | STRIDE analysis, 20+ threats with mitigations |
| [BASIS-FAILURE-MODES.md](specs/BASIS-FAILURE-MODES.md) | 16K | Layer-by-layer failure handling |
| [BASIS-COMPLIANCE-MAPPING.md](specs/BASIS-COMPLIANCE-MAPPING.md) | 17K | SOC 2, ISO 27001, GDPR, HIPAA, EU AI Act |
| [BASIS-MIGRATION-GUIDE.md](specs/BASIS-MIGRATION-GUIDE.md) | 21K | 5-phase adoption roadmap |

---

## ⚡ Quick Start

### Conformance Levels

| Level | Requirements |
|-------|--------------|
| **BASIS Core** | INTENT + ENFORCE + PROOF layers |
| **BASIS Complete** | + CHAIN layer + full capability taxonomy |
| **BASIS Extended** | + optional modules (multi-tenant, federated trust) |

### Trust Tiers

| Tier | Score | Default Capabilities |
|------|-------|---------------------|
| Sandbox | 0-99 | Isolated testing only |
| Provisional | 100-299 | Read public data, internal messaging |
| Standard | 300-499 | Limited external communication |
| Trusted | 500-699 | External API calls |
| Certified | 700-899 | Financial transactions |
| Autonomous | 900-1000 | Full autonomy within policy |

### Example Policy Snippet

```yaml
basis_version: "1.0"
policy_id: "corp-finance-limited"
constraints:
  - type: "capability_gate"
    capabilities: ["financial:transaction/medium"]
    minimum_tier: "certified"
  - type: "escalation_required"
    capabilities: ["admin:policy/modify"]
obligations:
  - trigger: "transaction_value > 10000"
    action: "require_human_approval"
```

---

## 🚀 Reference Implementation

For the operational engine implementing BASIS, see [Cognigate](https://github.com/voriongit/cognigate).

Validation libraries:
```bash
npm install @vorion/basis-core
# or
pip install basis-core
```

---

## 🏛 Governance & Stewardship

**VORION** serves as the commercial steward of the BASIS standard, ensuring it remains:

- **Free**: No licensing fees for the standard itself
- **Adoptable**: Easy to integrate into existing LLM/Agent stacks
- **Capture-Resistant**: Governance is separated from tooling vendors

To contribute to the specification, please see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📜 License

- Standard and schemas: **Apache 2.0**
- Documentation: **CC BY 4.0**

---

*Copyright © 2026 Vorion Risk, LLC*
