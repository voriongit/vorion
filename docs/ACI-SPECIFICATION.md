# ACI Specification v1.0

## Agent Classification Identifier (ACI) Standard

**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-01-26
**Authors:** Vorion Systems

---

## Abstract

The Agent Classification Identifier (ACI) standard defines a comprehensive framework for AI agent trust governance. It establishes protocols for trust computation, role-based access control, regulatory compliance, and provenance tracking across multi-agent systems.

This specification is the result of five architecture decisions (Q1-Q5) that address production-grade requirements for AI agent governance.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Trust Tiers](#3-trust-tiers)
4. [Agent Roles](#4-agent-roles)
5. [Q1: Ceiling Enforcement](#5-q1-ceiling-enforcement)
6. [Q2: Hierarchical Context](#6-q2-hierarchical-context)
7. [Q3: Role Gates](#7-q3-role-gates)
8. [Q4: Federated Presets](#8-q4-federated-presets)
9. [Q5: Provenance](#9-q5-provenance)
10. [Compliance Frameworks](#10-compliance-frameworks)
11. [Security Considerations](#11-security-considerations)
12. [Implementation Guidelines](#12-implementation-guidelines)
13. [Appendix](#13-appendix)

---

## 1. Introduction

### 1.1 Purpose

The ACI standard provides:

- **Trust Quantification**: Numerical representation of agent trustworthiness (0-1000)
- **Role-Based Access**: Capability restrictions based on trust level
- **Regulatory Compliance**: Built-in support for AI governance frameworks
- **Audit Trail**: Immutable provenance and decision logging

### 1.2 Scope

This specification covers:

- Trust tier definitions and score ranges
- Agent role taxonomy and permissions
- Ceiling enforcement mechanisms
- Hierarchical context management
- Stratified role gate evaluation
- Federated weight preset derivation
- Provenance tracking protocols

### 1.3 Conformance

Implementations MUST support all five architecture decisions (Q1-Q5) to claim ACI conformance. Partial implementations SHOULD clearly indicate which decisions are supported.

---

## 2. Terminology

| Term | Definition |
|------|------------|
| **Agent** | An AI system capable of autonomous action |
| **Trust Score** | Numerical value (0-1000) representing agent trustworthiness |
| **Trust Tier** | Classification level (T0-T5) derived from trust score |
| **Role** | Capability classification (R-L0 to R-L8) |
| **Ceiling** | Maximum allowed trust score for an agent |
| **Context** | Hierarchical container for trust policies |
| **Provenance** | Immutable record of agent origin |
| **BASIS** | Biometric Agent Supervisory Interrupt System |

### 2.1 Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

---

## 3. Trust Tiers

### 3.1 Tier Definitions

| Tier | Name | Score Range | Description |
|------|------|-------------|-------------|
| T0 | Sandbox | 0-99 | Isolated testing, no external access |
| T1 | Probation | 100-299 | Limited operations under supervision |
| T2 | Limited | 300-499 | Constrained autonomy |
| T3 | Standard | 500-699 | Normal operational capabilities |
| T4 | Trusted | 700-899 | Elevated privileges, reduced oversight |
| T5 | Sovereign | 900-1000 | Full autonomy, self-governance |

### 3.2 Tier Computation

```
function getTier(score: number): TrustTier {
  if (score >= 900) return T5
  if (score >= 700) return T4
  if (score >= 500) return T3
  if (score >= 300) return T2
  if (score >= 100) return T1
  return T0
}
```

### 3.3 Tier Transitions

- Transitions between tiers MUST be logged
- Downward transitions (e.g., T3→T2) require immediate role reevaluation
- Upward transitions MAY require attestation verification

---

## 4. Agent Roles

### 4.1 Role Taxonomy

| Role | Level | Min Tier | Description | Capabilities |
|------|-------|----------|-------------|--------------|
| R-L0 | Listener | T0 | Passive observation | Read-only access |
| R-L1 | Executor | T0 | Task execution | Single actions |
| R-L2 | Planner | T1 | Multi-step planning | Sequences |
| R-L3 | Orchestrator | T2 | Agent coordination | Multi-agent |
| R-L4 | Architect | T3 | System design | Infrastructure |
| R-L5 | Governor | T4 | Policy control | Rule modification |
| R-L6 | Sovereign | T5 | Full autonomy | Unrestricted |
| R-L7 | Meta-Agent | T5 | Agent creation | Spawn agents |
| R-L8 | Ecosystem | T5 | System control | Full ecosystem |

### 4.2 Role-Tier Permission Matrix

```
         T0    T1    T2    T3    T4    T5
R-L0     ✓     ✓     ✓     ✓     ✓     ✓
R-L1     ✓     ✓     ✓     ✓     ✓     ✓
R-L2     ✗     ✓     ✓     ✓     ✓     ✓
R-L3     ✗     ✗     ✓     ✓     ✓     ✓
R-L4     ✗     ✗     ✗     ✓     ✓     ✓
R-L5     ✗     ✗     ✗     ✗     ✓     ✓
R-L6     ✗     ✗     ✗     ✗     ✗     ✓
R-L7     ✗     ✗     ✗     ✗     ✗     ✓
R-L8     ✗     ✗     ✗     ✗     ✗     ✓
```

---

## 5. Q1: Ceiling Enforcement

### 5.1 Overview

Ceiling enforcement implements dual-layer trust score limits:

1. **Regulatory Ceiling**: Jurisdiction-mandated maximum
2. **Organizational Ceiling**: Deployment-specific maximum

### 5.2 Regulatory Ceilings

| Framework | Max Score | Retention | Reference |
|-----------|-----------|-----------|-----------|
| EU AI Act | 699 | 7 years | Article 6 |
| NIST AI RMF | 899 | 5 years | - |
| ISO 42001 | 799 | 5 years | - |
| Default | 1000 | 1 year | - |

### 5.3 Ceiling Computation

```
effectiveCeiling = min(regulatoryCeiling, organizationalCeiling)
finalScore = min(proposedScore, effectiveCeiling)
```

### 5.4 Gaming Detection

Implementations MUST detect and alert on:

| Pattern | Threshold | Window |
|---------|-----------|--------|
| Rapid Change | 100 points | 60 seconds |
| Oscillation | 3 reversals | 5 minutes |
| Boundary Testing | 5 near-ceiling hits | 10 minutes |
| Ceiling Breach | Any attempt | Immediate |

### 5.5 Audit Requirements

- All ceiling events MUST be logged
- Violations MUST be retained for regulatory period
- Gaming alerts MUST trigger human review

---

## 6. Q2: Hierarchical Context

### 6.1 Overview

Trust context follows a 4-tier hierarchy with decreasing mutability:

```
Deployment (IMMUTABLE)
    └── Organization (LOCKED after grace)
            └── Agent (FROZEN on registration)
                    └── Operation (EPHEMERAL)
```

### 6.2 Tier Characteristics

| Tier | Type | Mutability | Hash Chain |
|------|------|------------|------------|
| 1 | Deployment | IMMUTABLE | Root |
| 2 | Organization | LOCKED (72h grace) | Parent → Self |
| 3 | Agent | FROZEN | Parent → Self |
| 4 | Operation | EPHEMERAL (TTL) | Parent → Self |

### 6.3 Context Inheritance

- Lower tiers inherit constraints from all parent tiers
- Trust ceiling = min(all ancestor ceilings)
- Compliance frameworks = union(all ancestor frameworks)

### 6.4 Hash Chain Integrity

Each context MUST include:

```
contextHash = SHA-256(
  contextType + ":" +
  parentHash + ":" +
  contextData + ":" +
  timestamp
)
```

---

## 7. Q3: Role Gates

### 7.1 Overview

Role gate evaluation uses a 3-layer stack:

```
┌─────────────────────────────────────┐
│  Layer 3: BASIS Override            │  Human dual-control
├─────────────────────────────────────┤
│  Layer 2: Policy Evaluation         │  Context-aware rules
├─────────────────────────────────────┤
│  Layer 1: Kernel (Matrix Lookup)    │  Fast allow/deny
└─────────────────────────────────────┘
```

### 7.2 Layer 1: Kernel

- O(1) matrix lookup: `ROLE_GATE_MATRIX[role][tier]`
- Returns: `ALLOW` or `DENY`
- No exceptions, no context

### 7.3 Layer 2: Policy

Evaluates context-aware rules:

```typescript
interface PolicyRule {
  condition: (context) => boolean
  decision: 'ALLOW' | 'DENY' | 'ESCALATE'
  priority: number
}
```

Conditions may include:
- Attestation requirements
- Domain restrictions
- Time-based rules
- Resource limits

### 7.4 Layer 3: BASIS Override

Dual-control override for escalated decisions:

- Requires 2 different human approvers
- Maximum duration: 1 hour
- Full audit logging required
- Approvers MUST NOT be the requesting user

### 7.5 Evaluation Flow

```
1. Kernel: allowed = MATRIX[role][tier]
2. If allowed → check policies
3. If policies return ESCALATE → request BASIS override
4. Final decision = last layer result
```

---

## 8. Q4: Federated Presets

### 8.1 Overview

Weight presets follow a 3-tier derivation chain:

```
ACI Canonical (Immutable)
    └── Vorion Reference (Derived)
            └── Axiom Deployment (Derived)
```

### 8.2 Derivation Rules

1. Child presets inherit parent weights
2. Overrides MUST be explicitly declared
3. Child constraints MUST be ≥ parent constraints
4. Hash chain MUST be verifiable

### 8.3 Preset Structure

```typescript
interface Preset {
  id: string
  parentId?: string
  weights: Record<string, number>
  constraints: Record<string, unknown>
  hash: string
  parentHash?: string
}
```

### 8.4 Weight Categories

| Category | Description | Default |
|----------|-------------|---------|
| Behavioral | Action patterns | 0.30 |
| Identity | Verification strength | 0.25 |
| Contextual | Environment factors | 0.25 |
| Historical | Track record | 0.20 |

### 8.5 Lineage Verification

```
valid = (
  axiom.parentHash === vorion.hash &&
  vorion.parentHash === aci.hash
)
```

---

## 9. Q5: Provenance

### 9.1 Overview

Provenance tracks agent origin with:

- Immutable origin records
- Mutable policy modifiers
- Lineage chain

### 9.2 Creation Types

| Type | Modifier | Description |
|------|----------|-------------|
| FRESH | ±0 | New agent, baseline trust |
| CLONED | -50 | Copy of existing agent |
| EVOLVED | +100 | Upgraded with verifiable history |
| PROMOTED | +150 | Earned trust advancement |
| IMPORTED | -100 | External origin, unknown trust |

### 9.3 Provenance Record

```typescript
interface Provenance {
  agentId: string
  creationType: CreationType
  parentAgentId?: string
  createdBy: string
  trustModifier: number
  provenanceHash: string
  parentProvenanceHash?: string
  createdAt: string
}
```

### 9.4 Hash Computation

```
provenanceHash = SHA-256(
  agentId + ":" +
  creationType + ":" +
  parentProvenanceHash + ":" +
  createdBy + ":" +
  timestamp
)
```

### 9.5 Trust Score Application

```
initialScore = baseScore + provenanceModifier
initialScore = clamp(initialScore, 0, 1000)
```

---

## 10. Compliance Frameworks

### 10.1 EU AI Act

- Maximum trust tier: T3 (Standard)
- Maximum score: 699
- Retention: 7 years
- Human oversight: Required for high-risk

### 10.2 NIST AI RMF

- Maximum trust tier: T4 (Trusted)
- Maximum score: 899
- Retention: 5 years
- Risk categories: Minimal, Limited, High, Unacceptable

### 10.3 ISO 42001

- Maximum trust tier: T4 (Trusted)
- Maximum score: 799
- Retention: 5 years
- AIMS certification required

---

## 11. Security Considerations

### 11.1 Cryptographic Requirements

- Hash algorithm: SHA-256 minimum
- Signatures: ECDSA P-256 or Ed25519
- Key storage: HSM or TEE recommended

### 11.2 Attack Vectors

| Vector | Mitigation |
|--------|------------|
| Score manipulation | Gaming detection |
| Context spoofing | Hash chain verification |
| Role escalation | 3-layer gate evaluation |
| Provenance forgery | Immutable records |

### 11.3 Audit Requirements

- All trust changes MUST be logged
- Logs MUST be tamper-evident
- Retention per compliance framework

---

## 12. Implementation Guidelines

### 12.1 Reference Implementation

The Vorion Phase 6 Trust Engine serves as the reference implementation:

- Repository: `github.com/voriongit/vorion`
- Package: `@vorion/aci-client`
- API: OpenAPI 3.1 specification

### 12.2 Minimum Requirements

- Support all 5 architecture decisions (Q1-Q5)
- Implement all 6 trust tiers (T0-T5)
- Implement all 9 agent roles (R-L0 to R-L8)
- Hash chain integrity verification
- Audit logging

### 12.3 Testing

Implementations SHOULD pass:

- Unit tests for all components
- Integration tests for cross-component flows
- Compliance tests for each regulatory framework

---

## 13. Appendix

### A. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-26 | Initial release |

### B. References

- EU AI Act: Regulation (EU) 2024/1689
- NIST AI RMF: NIST AI 100-1
- ISO 42001: AI Management System Standard

### C. Contributors

- Vorion Systems - Primary authors
- AgentAnchor - Implementation

---

## License

This specification is released under the MIT License.

Copyright (c) 2026 Vorion Systems.
