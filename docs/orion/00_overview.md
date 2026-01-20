# ORION Platform Overview

**Version:** 1.0
**Status:** CANONICAL / NO-DRIFT

## What is ORION?

ORION is a dual-core AI governance platform that enables **managed autonomy with proof**. It provides:

- **Trust computation and enforcement** via Adaptive Trust Profiles (ATP)
- **Policy-driven authorization** where law and standards are data, not logic
- **Forensic-grade audit** with WORM storage, legal holds, and cryptographic sealing
- **External acceptance simulation** (EASE) that blocks releases without required artifacts

## Core Principles

### Two Cores, No More

ORION operates as a dual-core system with strict role separation:

| Core | Role | Never Does |
|------|------|------------|
| **AURYN** | Strategic Intelligence (intent only) | Enforce policy, execute tools, compute trust |
| **Agent Anchor** | Trust & Authorization (enforcement only) | Strategic reasoning, goal invention |

**No third core is permitted.** All additional layers must wrap, measure, or evolve the two cores without introducing new authority domains.

### Joint Ownership

ORION is jointly owned in full by Alex and Ryan. All components, subsystems, repositories, documentation, contracts, policies, artifacts, and outputs belong to ORION as a single system.

- There are NO privately owned subsystems
- There is NO concept of "my area" vs "your area"
- Accountability for security, compliance, and system behavior is SHARED and INDIVISIBLE

### Execution Responsibility (Focus, Not Ownership)

| Component | Primary Lead | Required Reviewer |
|-----------|--------------|-------------------|
| AURYN | Alex | Ryan |
| Agent Anchor | Ryan | Alex |
| PAL, ERA, Evolution, Contracts | Joint | Joint |

Primary execution lead drives implementation, not decisions. Either party may propose or block changes anywhere in the system.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PAL (WRAPPER)                           │
│     Provenance, Accountability & Lifecycle                      │
└─────────────────────────────────────────────────────────────────┘
        ↑ wraps                                    ↑ wraps
┌───────────────────┐                    ┌────────────────────────┐
│      AURYN        │  ───(intent)───►   │    AGENT ANCHOR        │
│   Strategic       │                    │    Trust & Auth        │
│   Intelligence    │  ◄──(decision)──   │    Proof & Audit       │
└───────────────────┘                    └────────────────────────┘
                                                   │
                                          (authorized execution)
                                                   ↓
                              ┌─────────────────────────────────────┐
                              │              ERA                    │
                              │   Execution Runtime Architecture    │
                              └─────────────────────────────────────┘
```

## Key Concepts

### Adaptive Trust Profile (ATP)

Five-dimensional trust model computed by Agent Anchor:

- **CT** - Capability Trust: What can this agent do well?
- **BT** - Behavioral Trust: How has this agent behaved historically?
- **GT** - Governance Trust: Is this agent properly governed?
- **XT** - Contextual Trust: Does the current context support trust?
- **AC** - Assurance Confidence: How certain are we of our assessment?

### Trust Bands (T0-T5)

| Band | Autonomy Level | Description |
|------|----------------|-------------|
| T0 | None | Deny execution |
| T1 | HITL Mandatory | Human-in-the-loop for all actions; no irreversible |
| T2 | Constrained | Reversible actions only; strict allowlists |
| T3 | Supervised | Rollback required; monitored execution |
| T4 | Broad | Continuous monitoring; expanded capabilities |
| T5 | Mission-Critical | Strongest proof requirements; strict GT/AC gates |

### JSAL (Jurisdiction & Standards Abstraction Layer)

- Law and standards as data, not logic
- Policy bundles: jurisdiction + industry + org + contractual
- Most restrictive wins in conflict resolution
- Conflicts trigger escalation, not interpretation

### ERPL (Evidence Retention & Preservation Layer)

- WORM (Write-Once-Read-Many) immutability
- Legal holds with auditable dual approval
- Cryptographic sealing of evidence windows
- Seal verification tests required for release

### EASE (External Acceptance Simulation Engine)

- Simulates auditors, procurement, regulators, vendor risk panels
- Missing acceptance artifacts = SYSTEM CONFLICT
- **Release blocker** - no release ships without passing EASE

## Target Markets

- **Enterprise**: SOC 2, ISO 27001, internal governance
- **Government**: FedRAMP, NIST 800-53, regulatory compliance
- **Healthcare**: HIPAA, FDA AI/ML guidance
- **Finance**: SEC, FINRA, banking regulations
- **Global**: GDPR, EU AI Act, multi-jurisdiction deployment

## Getting Started

See [01_architecture.md](./01_architecture.md) for detailed architecture documentation.
