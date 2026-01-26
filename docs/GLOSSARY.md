# Vorion Ecosystem Glossary

A comprehensive glossary of terms used across the Vorion ecosystem, including ATSF, BASIS, and related components.

---

## Core Concepts

### Vorion
The parent organization and ecosystem providing AI governance infrastructure. Vorion encompasses multiple products and standards designed to enable trustworthy autonomous AI systems.

### ATSF (Agentic Trust Scoring Framework)
The core runtime framework for calculating and managing trust scores for AI agents. ATSF provides:
- Behavioral trust scoring (0-1000 scale)
- Signal-based trust updates
- Persistence layer for trust records
- Event emission for observability

**Package**: `@vorionsys/atsf-core`

### BASIS (Baseline Authority for Safe & Interoperable Systems)
The governance standard that defines rules and policies for autonomous AI systems. BASIS is the "legislative branch" of the ecosystem, providing:
- Policy definitions
- Risk classification
- Capability frameworks
- Audit requirements

**Documentation**: [basis.vorion.org](https://basis.vorion.org)

### Cognigate
The enforcement runtime that validates agent actions against BASIS policies. Cognigate acts as the "executive branch," providing:
- Real-time policy enforcement
- Constrained execution environments
- Circuit breakers for emergency stops

---

## Architecture Layers

### The Cohesive Stack
Vorion's four-layer architecture for AI governance:

```
┌─────────────────────────────────────────┐
│  CHAIN  │ Blockchain anchoring (Polygon) │
├─────────────────────────────────────────┤
│  PROOF  │ Cryptographic audit trails     │
├─────────────────────────────────────────┤
│  ENFORCE│ Policy enforcement (Cognigate) │
├─────────────────────────────────────────┤
│  INTENT │ Goal normalization             │
├─────────────────────────────────────────┤
│  BASIS  │ Governance standards           │
└─────────────────────────────────────────┘
```

### INTENT Layer
Parses natural language agent goals into structured, machine-readable plans. Normalizes agent desires into actionable intents with clear accountability.

### ENFORCE Layer
Validates structured plans against BASIS policies. Makes real-time allow/deny decisions based on:
- Trust scores
- Policy rules
- Risk levels
- Context signals

### PROOF Layer
Generates immutable audit trails using cryptographic signatures (Ed25519). Creates verifiable "receipts" for every governance decision.

### CHAIN Layer
Anchors high-risk proofs to public blockchain (Polygon) for independent verification. Provides:
- Merkle tree batching
- On-chain verification
- Trustless auditability

---

## Trust System

### Trust Score
A numerical value (0-1000) representing an entity's trustworthiness. Calculated from weighted signal components:
- **Behavioral** (40%): Task completion, error rates
- **Compliance** (25%): Policy adherence
- **Identity** (20%): Verification strength
- **Context** (15%): Environmental signals

### Trust Levels (L0-L5)

Vorion implements a **dual-tier system** to separate external certification from operational autonomy:

#### RuntimeTier (Operational Autonomy)
Used by the TrustEngine for day-to-day governance decisions. Defines what an agent can do in a specific deployment:

| Level | Name | Score Range | Description |
|-------|------|-------------|-------------|
| L0 | Sandbox | 0-99 | Isolated testing, no external access |
| L1 | Provisional | 100-299 | Limited operations, high oversight |
| L2 | Standard | 300-499 | Normal operations with guardrails |
| L3 | Trusted | 500-699 | Standard operations without approval |
| L4 | Certified | 700-899 | Independent operation within bounds |
| L5 | Autonomous | 900-1000 | Full authority, minimal oversight |

#### CertificationTier (External Attestation)
Defined in the ACI (Agent Certification Interface) spec. Represents the level of external verification an agent has received:

| Level | Name | Score Range | Description |
|-------|------|-------------|-------------|
| T0 | Unverified | 0-99 | No external verification |
| T1 | Registered | 100-299 | Organization identity verified |
| T2 | Tested | 300-499 | Automated capability tests passed |
| T3 | Certified | 500-699 | Third-party audit completed |
| T4 | Verified | 700-899 | Continuous behavioral monitoring |
| T5 | Sovereign | 900-1000 | Highest assurance level |

#### Tier Mapping
These tiers are conceptually different but can be mapped:
- **CertificationTier** answers: "What has this agent proven it can do?"
- **RuntimeTier** answers: "What is this agent allowed to do here?"

An agent with high certification (T4 Verified) might still operate at lower runtime autonomy (L2 Standard) in a sensitive environment.

**Canonical definitions**: `@vorion/contracts/aci/tiers`

### Trust Signal
An event that affects an entity's trust score. Signals have:
- **Type**: Category (behavioral, compliance, identity, context)
- **Value**: Impact (0.0-1.0)
- **Source**: Origin of the signal
- **Timestamp**: When it occurred

### Trust Decay
Automatic reduction of trust scores over time to ensure continued engagement. Features:
- **Base decay rate**: Default 1% per interval
- **Half-life**: 7-day weighted average for signals
- **Accelerated decay**: 3x multiplier after repeated failures

### Trust Recovery
Mechanism for rebuilding trust after failures:
- Success signals above threshold (0.7) trigger recovery
- Consecutive successes enable accelerated recovery
- Peak score tracking for milestone detection

---

## Governance Concepts

### Policy
A declarative rule defining allowed/denied agent behaviors. Policies specify:
- Capabilities required
- Risk thresholds
- Escalation triggers
- Human oversight requirements

### Capability
A specific permission or ability granted to an agent. Examples:
- `file:read` - Read file system
- `network:external` - External network access
- `tool:execute` - Run external tools

### Risk Classification
Four-tier risk assessment for agent actions:
- **MINIMAL**: Logging only
- **LOW**: Standard enforcement
- **HIGH**: Enhanced monitoring, anchoring required
- **CRITICAL**: Human approval mandatory

### Escalation
Process of elevating a decision to higher authority (human or senior agent) when:
- Risk exceeds threshold
- Policy is ambiguous
- Trust is insufficient

### Circuit Breaker
Emergency mechanism to halt agent operations when:
- Repeated failures detected
- Anomalous behavior observed
- Manual intervention triggered

---

## Technical Components

### Persistence Provider
Pluggable storage backend for trust records:
- **Memory**: In-memory (testing)
- **File**: JSON file with auto-save
- **SQLite**: Lightweight SQL database
- **Supabase**: PostgreSQL via Supabase

### Event Emitter
Trust engine publishes events for observability:
- `trust:initialized` - New entity registered
- `trust:signal_recorded` - Signal processed
- `trust:score_changed` - Score updated
- `trust:tier_changed` - Level promotion/demotion
- `trust:decay_applied` - Time-based decay
- `trust:failure_detected` - Failure signal received
- `trust:recovery_applied` - Recovery signal processed

### Proof Record
Cryptographically signed audit entry containing:
- Decision details
- Entity IDs
- Timestamp
- Hash chain link
- Ed25519 signature

### Anchor Batch
Collection of proofs submitted to blockchain:
- Merkle root of proof hashes
- Transaction hash
- Block number
- Verification path

---

## Packages and Products

### @vorionsys/atsf-core
Core ATSF runtime package providing:
- Trust engine
- Persistence layer
- LangChain integration
- Proof generation

> **Note on Package Naming**: The ATSF core package uses `@vorionsys` namespace for historical reasons. All other packages use `@vorion` namespace. New packages should use `@vorion/`. A rename to `@vorion/atsf-core` is planned for v2.0.

### @vorion/basis
Blockchain contracts and governance primitives for BASIS compliance.

### @vorion/agent-sdk
TypeScript SDK for building ATSF-compliant agents.

### @vorion/council
16-agent governance council orchestrator for distributed decision-making.

### AgentAnchor
B2B platform for enterprise AI governance, built on the Vorion stack.

### Cognigate
Constrained execution runtime for policy enforcement.

---

## External Standards

### EU AI Act
European Union regulation on artificial intelligence. Vorion helps achieve compliance through:
- Risk classification alignment
- Human oversight mechanisms
- Audit trail requirements

### NIST AI RMF
National Institute of Standards and Technology AI Risk Management Framework. Vorion maps to:
- MAP: Identify AI risks
- MEASURE: Assess with trust scores
- MANAGE: Enforce with policies
- GOVERN: Audit with proofs

### ISO 42001
AI management system standard. Vorion supports certification through documented governance processes.

---

## Abbreviations

| Abbr | Full Form |
|------|-----------|
| ATSF | Agentic Trust Scoring Framework |
| BASIS | Baseline Authority for Safe & Interoperable Systems |
| HITL | Human-in-the-Loop |
| RMF | Risk Management Framework |
| RBAC | Role-Based Access Control |
| ABAC | Attribute-Based Access Control |
| JWT | JSON Web Token |
| JWKS | JSON Web Key Set |
| RLS | Row-Level Security |
| WAL | Write-Ahead Logging |

---

## Related Documentation

- [BASIS Specification](./basis-docs/docs/spec/overview.md)
- [Trust Scoring Guide](./basis-docs/docs/spec/trust-scoring.md)
- [Implementation Guide](./basis-docs/docs/implement/getting-started.md)
- [API Reference](./basis-docs/docs/spec/capabilities.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
