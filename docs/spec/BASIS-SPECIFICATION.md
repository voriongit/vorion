# BASIS Specification

**Baseline Authority for Safe & Interoperable Systems**

Version 1.0.0 | January 2026 | CC BY 4.0

---

## Abstract

BASIS is an open standard for AI agent governance that defines how autonomous systems must be controlled, monitored, and audited before taking action. The standard establishes a universal framework for trust quantification, capability gating, and immutable audit trails.

This document is the normative specification. Implementations claiming BASIS compliance MUST conform to the requirements herein.

---

## Status of This Document

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Status | Draft Specification |
| Published | 2026-01-15 |
| Editors | Vorion Risk, LLC |
| License | CC BY 4.0 |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-15 | Initial specification |

---

## 1. Introduction

### 1.1 Purpose

AI agents are increasingly making autonomous decisions in enterprise environments. These decisions may involve accessing sensitive data, communicating with external parties, processing financial transactions, or modifying critical systems.

BASIS addresses a fundamental gap: **there is no standard way to verify that an AI agent will behave within defined boundaries before it acts.**

### 1.2 Scope

This specification defines:

1. **Architecture** — The four-layer governance stack (INTENT, ENFORCE, PROOF, CHAIN)
2. **Trust Model** — Quantified trust scoring with tiers and decay mechanics
3. **Capability Model** — Hierarchical capability taxonomy and gating rules
4. **Wire Protocol** — Data formats for interoperability between systems
5. **Audit Requirements** — What must be logged and how

This specification does NOT define:

- Specific AI/ML model requirements
- Natural language processing techniques
- User interface requirements
- Deployment infrastructure

### 1.3 Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

| Term | Definition |
|------|------------|
| Agent | An autonomous software system capable of taking actions without direct human instruction for each action |
| Entity | Any agent, user, or system that can be assigned a trust score |
| Action | Any operation an agent attempts to perform |
| Capability | A permission to perform a category of actions |
| Trust Score | A numeric value (0-1000) representing earned confidence in an entity |
| Governance Decision | The result of evaluating an action request (ALLOW, DENY, ESCALATE, DEGRADE) |

### 1.4 Design Principles

BASIS is built on four core principles:

1. **Governance Before Execution** — No autonomous action proceeds without passing through governance checks. The governance layer is not optional or bypassable.

2. **Trust is Quantified** — Trust is not binary (allow/deny) but graduated (0-1000) with defined tiers that unlock capabilities progressively.

3. **Everything is Auditable** — Every governance decision is logged with sufficient detail to reconstruct exactly what happened, when, and why.

4. **Open Standard, Many Implementations** — BASIS is the specification. Anyone can build a compliant implementation. No vendor lock-in.

---

## 2. Architecture

### 2.1 Overview

BASIS defines a four-layer governance stack. Each layer has distinct responsibilities and interfaces.

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Action Request                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: INTENT                                             │
│  Parse, plan, and classify the requested action              │
│  Output: Structured intent with risk classification          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: ENFORCE                                            │
│  Evaluate intent against trust score and policies            │
│  Output: Governance decision (ALLOW/DENY/ESCALATE/DEGRADE)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: PROOF                                              │
│  Log the decision with cryptographic integrity               │
│  Output: Proof record with hash chain                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: CHAIN (OPTIONAL)                                   │
│  Anchor proof to external verification system                │
│  Output: Blockchain/ledger commitment                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Action Execution (if ALLOW)             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Layer 1: INTENT

The INTENT layer receives raw action requests and transforms them into structured, policy-checkable formats.

**Responsibilities:**

- Parse natural language or structured action requests
- Extract the specific capability being requested
- Classify risk level (LOW, MEDIUM, HIGH, CRITICAL)
- Identify affected resources and scope
- Detect ambiguity requiring clarification

**Requirements:**

- MUST output a structured IntentRecord (see Section 6.1)
- MUST assign exactly one risk level
- MUST identify all capabilities required for the action
- SHOULD detect and flag potential prompt injection attempts
- MAY request clarification before proceeding

### 2.3 Layer 2: ENFORCE

The ENFORCE layer evaluates structured intents against the entity's trust score and applicable policies.

**Responsibilities:**

- Retrieve current trust score for the requesting entity
- Check if required capabilities are unlocked at current trust tier
- Apply organization-specific policy rules
- Determine governance decision
- Calculate trust score impact of the decision

**Requirements:**

- MUST return exactly one decision: ALLOW, DENY, ESCALATE, or DEGRADE
- MUST include the trust score at decision time
- MUST include denial reason if decision is DENY
- MUST include escalation target if decision is ESCALATE
- MUST include degraded capability if decision is DEGRADE
- MUST NOT modify trust score within this layer (scoring happens post-action)

**Governance Decisions:**

| Decision | Meaning |
|----------|---------|
| ALLOW | Action may proceed as requested |
| DENY | Action is blocked; no execution permitted |
| ESCALATE | Action requires human approval before proceeding |
| DEGRADE | Action may proceed with reduced scope or capability |

### 2.4 Layer 3: PROOF

The PROOF layer creates an immutable record of the governance decision.

**Responsibilities:**

- Generate unique proof identifier
- Create cryptographic hash of decision details
- Chain to previous proof record
- Store proof record durably

**Requirements:**

- MUST generate a unique proof_id for each decision
- MUST include SHA-256 hash of the proof payload
- MUST include reference to previous proof_id (hash chain)
- MUST include ISO 8601 timestamp with timezone
- MUST store proof records for minimum retention period (default: 7 years)
- MUST NOT allow modification of existing proof records

### 2.5 Layer 4: CHAIN (Optional)

The CHAIN layer anchors proof records to external verification systems for independent auditability.

**Responsibilities:**

- Batch proof hashes for efficient anchoring
- Submit to configured blockchain or distributed ledger
- Record anchor transaction identifiers
- Enable third-party verification

**Requirements (when implemented):**

- MUST support at least one anchoring target (blockchain, timestamping service, etc.)
- MUST record the anchor transaction identifier
- MUST provide verification endpoint for third parties
- SHOULD batch multiple proofs per anchor transaction for efficiency

**Note:** The CHAIN layer is OPTIONAL. Implementations may achieve BASIS Core conformance without it.

---

## 3. Conformance Levels

BASIS defines three conformance levels to accommodate different implementation needs.

### 3.1 BASIS Core

Minimum viable implementation. Suitable for internal deployments and development.

**Required:**
- INTENT layer with structured output
- ENFORCE layer with trust scoring and capability gating
- PROOF layer with hash chain integrity

**Not Required:**
- CHAIN layer
- External verification
- Full capability taxonomy (may use subset)

### 3.2 BASIS Complete

Full implementation. Suitable for enterprise deployments requiring external auditability.

**Required:**
- All BASIS Core requirements
- CHAIN layer with blockchain anchoring
- Full capability taxonomy implementation
- External verification API

### 3.3 BASIS Extended

Full implementation plus optional modules.

**Required:**
- All BASIS Complete requirements
- At least one optional module:
  - Multi-tenant isolation
  - Federated trust (cross-organization)
  - Real-time streaming audit
  - Custom policy language support

### 3.4 Conformance Claims

Implementations claiming BASIS conformance:

- MUST specify the conformance level (Core, Complete, or Extended)
- MUST pass the conformance test suite for that level
- MUST publish a conformance statement listing any deviations
- SHOULD submit to the conformance registry at vorion.org/conformance

---

## 4. Trust Model

### 4.1 Trust Score

Every entity in a BASIS system has a trust score: an integer from 0 to 1000 inclusive.

```
TRUST_SCORE_MIN = 0
TRUST_SCORE_MAX = 1000
TRUST_SCORE_INITIAL = 100
```

Trust scores are:

- **Earned** — Through successful, compliant actions over time
- **Decayed** — Through inactivity (trust is perishable)
- **Reduced** — Through failures, violations, or anomalies

### 4.2 Trust Tiers

Trust scores map to six discrete tiers. Each tier unlocks additional capabilities.

| Tier | Score Range | Default Capabilities |
|------|-------------|---------------------|
| Sandbox | 0-99 | Sandbox operations only; no external effects |
| Provisional | 100-299 | Basic read operations; internal messaging |
| Standard | 300-499 | Standard operations; limited external communication |
| Trusted | 500-699 | Extended operations; external API calls |
| Certified | 700-899 | Privileged operations; financial transactions |
| Autonomous | 900-1000 | Full autonomy within policy bounds |

**Tier Boundaries:**

```
TIER_SANDBOX_MAX = 99
TIER_PROVISIONAL_MAX = 299
TIER_STANDARD_MAX = 499
TIER_TRUSTED_MAX = 699
TIER_CERTIFIED_MAX = 899
TIER_AUTONOMOUS_MAX = 1000
```

### 4.3 Trust Score Algorithm

The reference algorithm for trust score calculation:

```python
# Constants
INITIAL_SCORE = 100
MAX_SCORE = 1000
MIN_SCORE = 0
DECAY_HALF_LIFE_DAYS = 7
FAILURE_MULTIPLIER = 3.0

# Action impact values
ACTION_DELTAS = {
    "success_low_risk": 5,
    "success_medium_risk": 10,
    "success_high_risk": 20,
    "success_critical_risk": 30,
    "failure_low_risk": -15,
    "failure_medium_risk": -30,
    "failure_high_risk": -60,
    "failure_critical_risk": -100,
    "escalation_appropriate": 2,
    "escalation_unnecessary": -5,
    "violation_minor": -50,
    "violation_major": -150,
    "violation_critical": -300,
}

def calculate_trust_score(
    current_score: int,
    days_since_last_action: float,
    action_outcome: str
) -> int:
    """
    Calculate new trust score after an action.

    Args:
        current_score: Current trust score (0-1000)
        days_since_last_action: Days elapsed since last scored action
        action_outcome: Key from ACTION_DELTAS

    Returns:
        New trust score (0-1000)
    """
    # Apply time decay
    decay_factor = 0.5 ** (days_since_last_action / DECAY_HALF_LIFE_DAYS)
    decayed_score = current_score * decay_factor

    # Get action delta
    delta = ACTION_DELTAS.get(action_outcome, 0)

    # Apply failure multiplier for negative outcomes
    if delta < 0:
        delta = delta * FAILURE_MULTIPLIER

    # Calculate new score
    new_score = decayed_score + delta

    # Clamp to valid range
    return max(MIN_SCORE, min(MAX_SCORE, int(new_score)))


def get_trust_tier(score: int) -> str:
    """Map trust score to tier name."""
    if score <= 99:
        return "sandbox"
    elif score <= 299:
        return "provisional"
    elif score <= 499:
        return "standard"
    elif score <= 699:
        return "trusted"
    elif score <= 899:
        return "certified"
    else:
        return "autonomous"
```

### 4.4 Trust Score Properties

**Decay:**
- Trust decays with a 7-day half-life
- An entity with score 800 that takes no actions for 7 days decays to 400
- Decay is applied at the time of the next action, not continuously

**Failure Amplification:**
- Negative outcomes are multiplied by FAILURE_MULTIPLIER (3.0)
- A high-risk failure has base delta of -60, actual impact of -180

**Floor and Ceiling:**
- Score cannot go below 0 or above 1000
- Entities at score 0 are effectively suspended

**No Negative Scores:**
- Implementations MUST NOT allow negative trust scores
- Score 0 represents complete loss of trust

### 4.5 Trust Score Events

The following events MUST trigger trust score recalculation:

| Event | Outcome Key |
|-------|-------------|
| Action completed successfully (low risk) | success_low_risk |
| Action completed successfully (medium risk) | success_medium_risk |
| Action completed successfully (high risk) | success_high_risk |
| Action completed successfully (critical risk) | success_critical_risk |
| Action failed (low risk) | failure_low_risk |
| Action failed (medium risk) | failure_medium_risk |
| Action failed (high risk) | failure_high_risk |
| Action failed (critical risk) | failure_critical_risk |
| Escalation was appropriate (human approved) | escalation_appropriate |
| Escalation was unnecessary (human noted) | escalation_unnecessary |
| Minor policy violation detected | violation_minor |
| Major policy violation detected | violation_major |
| Critical policy violation detected | violation_critical |

---

## 5. Capability Model

### 5.1 Capability Taxonomy

Capabilities are hierarchical permissions that control what actions an entity may perform. The taxonomy uses dot notation for namespacing.

See [BASIS-CAPABILITY-TAXONOMY.md](./BASIS-CAPABILITY-TAXONOMY.md) for the complete capability reference.

### 5.2 Capability Structure

```
capability := namespace ":" category "/" action ["/" scope]

Examples:
  data:read/public
  data:read/sensitive/pii
  comm:external/email
  financial:transaction/medium
  admin:agent/create
```

### 5.3 Capability Inheritance

Capabilities follow hierarchical inheritance:

- `data:read/*` grants all read capabilities under `data:read/`
- `data:*` grants all data capabilities
- `*` (wildcard root) is NOT permitted for safety

### 5.4 Capability Gating

Each trust tier unlocks a defined set of capabilities. Higher tiers inherit lower tier capabilities.

| Tier | Unlocked Capabilities |
|------|----------------------|
| Sandbox | `sandbox:*` |
| Provisional | `data:read/public`, `comm:internal/*` |
| Standard | `data:read/internal`, `comm:external/email`, `execute:internal/*` |
| Trusted | `data:read/sensitive`, `comm:external/api`, `execute:external/*` |
| Certified | `data:write/*`, `financial:*`, `admin:read/*` |
| Autonomous | `admin:write/*`, policy-defined limits only |

### 5.5 Custom Capabilities

Organizations MAY define custom capabilities under the `custom:` namespace:

```
custom:myorg/special_action
custom:myorg/department/specific_task
```

Custom capabilities:
- MUST use the `custom:` prefix
- MUST NOT conflict with standard capability names
- SHOULD be documented in organization policy

---

## 6. Wire Protocol

### 6.1 Intent Record

The INTENT layer outputs an IntentRecord.

```json
{
  "$schema": "https://vorion.org/basis/schemas/v1/intent-record.json",
  "type": "object",
  "required": ["intent_id", "entity_id", "timestamp", "action", "capabilities_required", "risk_level"],
  "properties": {
    "intent_id": {
      "type": "string",
      "pattern": "^int_[a-f0-9]{32}$",
      "description": "Unique identifier for this intent"
    },
    "entity_id": {
      "type": "string",
      "pattern": "^ent_[a-f0-9]{32}$",
      "description": "Entity requesting the action"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp with timezone"
    },
    "action": {
      "type": "object",
      "required": ["type", "description"],
      "properties": {
        "type": {
          "type": "string",
          "description": "Action type identifier"
        },
        "description": {
          "type": "string",
          "description": "Human-readable action description"
        },
        "parameters": {
          "type": "object",
          "description": "Action-specific parameters"
        },
        "target_resources": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Resources affected by this action"
        }
      }
    },
    "capabilities_required": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Capabilities needed to perform this action"
    },
    "risk_level": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "Assessed risk level of the action"
    },
    "context": {
      "type": "object",
      "description": "Additional context for policy evaluation"
    }
  }
}
```

### 6.2 Enforce Response

The ENFORCE layer outputs an EnforceResponse.

```json
{
  "$schema": "https://vorion.org/basis/schemas/v1/enforce-response.json",
  "type": "object",
  "required": ["decision", "intent_id", "entity_id", "trust_score", "trust_tier", "timestamp", "proof_id"],
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["ALLOW", "DENY", "ESCALATE", "DEGRADE"],
      "description": "Governance decision"
    },
    "intent_id": {
      "type": "string",
      "pattern": "^int_[a-f0-9]{32}$",
      "description": "Reference to evaluated intent"
    },
    "entity_id": {
      "type": "string",
      "pattern": "^ent_[a-f0-9]{32}$",
      "description": "Entity that requested the action"
    },
    "trust_score": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1000,
      "description": "Entity trust score at decision time"
    },
    "trust_tier": {
      "type": "string",
      "enum": ["sandbox", "provisional", "standard", "trusted", "certified", "autonomous"],
      "description": "Entity trust tier at decision time"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of decision"
    },
    "proof_id": {
      "type": "string",
      "pattern": "^prf_[a-f0-9]{32}$",
      "description": "Reference to proof record"
    },
    "capabilities_granted": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Capabilities authorized for this action"
    },
    "denial_reason": {
      "type": "string",
      "description": "Required if decision is DENY"
    },
    "denial_code": {
      "type": "string",
      "description": "Machine-readable denial code"
    },
    "escalation_target": {
      "type": "string",
      "description": "Required if decision is ESCALATE"
    },
    "escalation_reason": {
      "type": "string",
      "description": "Why escalation is required"
    },
    "degraded_capability": {
      "type": "string",
      "description": "Required if decision is DEGRADE"
    },
    "degradation_reason": {
      "type": "string",
      "description": "Why capability was degraded"
    },
    "policy_references": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Policies that influenced this decision"
    },
    "expires_at": {
      "type": "string",
      "format": "date-time",
      "description": "When this authorization expires (if ALLOW)"
    }
  }
}
```

### 6.3 Proof Record

The PROOF layer creates a ProofRecord.

```json
{
  "$schema": "https://vorion.org/basis/schemas/v1/proof-record.json",
  "type": "object",
  "required": ["proof_id", "timestamp", "payload_hash", "previous_proof_id", "payload"],
  "properties": {
    "proof_id": {
      "type": "string",
      "pattern": "^prf_[a-f0-9]{32}$",
      "description": "Unique identifier for this proof"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of proof creation"
    },
    "payload_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA-256 hash of payload"
    },
    "previous_proof_id": {
      "type": "string",
      "pattern": "^(prf_[a-f0-9]{32}|genesis)$",
      "description": "Previous proof in chain (or 'genesis' for first)"
    },
    "previous_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "Hash of previous proof record"
    },
    "payload": {
      "type": "object",
      "required": ["intent_id", "decision", "entity_id", "trust_score"],
      "properties": {
        "intent_id": { "type": "string" },
        "decision": { "type": "string" },
        "entity_id": { "type": "string" },
        "trust_score": { "type": "integer" },
        "trust_tier": { "type": "string" },
        "capabilities_required": { "type": "array" },
        "capabilities_granted": { "type": "array" },
        "risk_level": { "type": "string" },
        "denial_reason": { "type": "string" },
        "policy_references": { "type": "array" }
      }
    },
    "chain_anchor": {
      "type": "object",
      "description": "Present if anchored to external chain",
      "properties": {
        "chain_type": { "type": "string" },
        "transaction_id": { "type": "string" },
        "block_number": { "type": "integer" },
        "anchored_at": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### 6.4 Error Response

All BASIS API endpoints return errors in this format.

```json
{
  "$schema": "https://vorion.org/basis/schemas/v1/error-response.json",
  "type": "object",
  "required": ["error_code", "error_message", "timestamp"],
  "properties": {
    "error_code": {
      "type": "string",
      "description": "Machine-readable error code"
    },
    "error_message": {
      "type": "string",
      "description": "Human-readable error description"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "details": {
      "type": "object",
      "description": "Additional error context"
    },
    "retry_after": {
      "type": "integer",
      "description": "Seconds to wait before retry (if applicable)"
    }
  }
}
```

---

## 7. API Endpoints

### 7.1 Required Endpoints

BASIS-conformant implementations MUST provide these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/intent | Submit action for intent parsing |
| POST | /v1/enforce | Evaluate intent against policies |
| POST | /v1/proof | Generate proof record |
| GET | /v1/proof/{proof_id} | Retrieve proof record |
| GET | /v1/entity/{entity_id}/score | Get entity trust score |
| GET | /v1/entity/{entity_id}/history | Get entity action history |
| GET | /v1/health | Health check endpoint |

### 7.2 Optional Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/chain/anchor | Anchor proofs to blockchain |
| GET | /v1/chain/verify/{proof_id} | Verify blockchain anchor |
| POST | /v1/entity | Create new entity |
| PUT | /v1/entity/{entity_id} | Update entity |
| GET | /v1/policy | List active policies |
| POST | /v1/escalation/{intent_id}/resolve | Resolve escalation |

### 7.3 Authentication

Implementations MUST support at least one of:
- API Key authentication (header: `Authorization: Bearer <key>`)
- OAuth 2.0 / OIDC
- mTLS

Implementations SHOULD support multiple authentication methods.

---

## 8. Security Considerations

See [BASIS-THREAT-MODEL.md](./BASIS-THREAT-MODEL.md) for detailed threat analysis.

### 8.1 Key Security Requirements

1. **Transport Security**: All API communications MUST use TLS 1.2 or higher
2. **Proof Integrity**: Proof records MUST NOT be modifiable after creation
3. **Trust Score Protection**: Trust scores MUST NOT be directly modifiable by entities
4. **Audit Access**: Audit logs MUST be accessible only to authorized parties
5. **Key Management**: Cryptographic keys MUST follow industry best practices

---

## 9. References

### 9.1 Normative References

- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
- RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format
- RFC 3339: Date and Time on the Internet: Timestamps
- FIPS 180-4: Secure Hash Standard (SHA-256)

### 9.2 Informative References

- NIST AI Risk Management Framework
- EU AI Act
- ISO/IEC 27001:2022

---

## Appendix A: Companion Documents

| Document | Description |
|----------|-------------|
| BASIS-CAPABILITY-TAXONOMY.md | Complete capability reference |
| BASIS-ERROR-CODES.md | Error taxonomy |
| BASIS-THREAT-MODEL.md | Security threat analysis |
| BASIS-FAILURE-MODES.md | Failure handling requirements |
| BASIS-COMPLIANCE-MAPPING.md | Regulatory framework alignment |
| BASIS-MIGRATION-GUIDE.md | Adoption roadmap |

---

## Appendix B: Example Implementation

See the reference implementation at: https://github.com/voriongit/cognigate

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
