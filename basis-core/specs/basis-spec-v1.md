# BASIS Specification v1.0

**Status:** Draft
**Version:** 1.0.0
**Last Updated:** 2026-01-08
**Authors:** Vorion Standards Committee

---

## Abstract

BASIS (Baseline Authority for Safe & Interoperable Systems) is a specification for defining machine-readable governance policies for autonomous agents. This document defines the structure, semantics, and processing model for BASIS Policy Bundles.

---

## 1. Introduction

### 1.1 Purpose

BASIS provides a standardized format for expressing the operational boundaries within which autonomous AI agents must operate. It enables:

- **Separation of Concerns**: Governance rules are decoupled from agent logic
- **Interoperability**: Policies created by one organization can be understood by any compliant implementation
- **Auditability**: Clear, structured rules enable comprehensive logging and compliance verification

### 1.2 Scope

This specification defines:

- The structure of Policy Bundles
- The semantics of Constraints, Obligations, and Permissions
- The processing model for policy evaluation
- Conformance requirements for implementations

This specification does NOT define:

- How policies are enforced (implementation-specific)
- Trust scoring algorithms
- Cryptographic proof mechanisms
- Network protocols for policy distribution

### 1.3 Terminology

| Term | Definition |
|------|------------|
| **Policy Bundle** | A complete, self-contained governance artifact |
| **Constraint** | A rule that restricts or limits agent actions |
| **Obligation** | A rule that requires specific actions under conditions |
| **Permission** | A rule that explicitly allows specific actions |
| **Intent** | A structured request from an agent to perform an action |
| **Decision** | The outcome of evaluating an Intent against a Policy |

### 1.4 Conformance

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

---

## 2. Policy Bundle Structure

### 2.1 Overview

A Policy Bundle is a JSON or YAML document containing:

```
PolicyBundle
├── basis_version      (required)
├── policy_id          (required)
├── metadata           (required)
├── trust_requirements (optional)
├── constraints[]      (optional)
├── obligations[]      (optional)
├── permissions[]      (optional)
├── escalation         (optional)
└── inheritance        (optional)
```

### 2.2 Version Identifier

The `basis_version` field indicates which version of this specification the bundle conforms to.

- Format: `MAJOR.MINOR` (e.g., "1.0", "1.1", "2.0")
- Implementations MUST reject bundles with unsupported major versions
- Implementations SHOULD process bundles with higher minor versions, ignoring unknown fields

### 2.3 Policy Identifier

The `policy_id` field uniquely identifies the policy.

- Format: lowercase alphanumeric with hyphens
- Length: 3-64 characters
- Pattern: `^[a-z0-9][a-z0-9-]*[a-z0-9]$`
- MUST be unique within a deployment context

### 2.4 Metadata

The `metadata` object provides descriptive information:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name (1-128 chars) |
| `description` | string | No | Detailed description (max 1024 chars) |
| `version` | string | Yes | Semantic version of this bundle |
| `created_at` | datetime | Yes | ISO 8601 creation timestamp |
| `updated_at` | datetime | No | ISO 8601 last modification |
| `author` | string | No | Author identifier |
| `organization` | string | No | Owning organization |
| `tags` | string[] | No | Categorization tags |
| `jurisdiction` | string[] | No | ISO 3166 country/region codes |

---

## 3. Constraints

### 3.1 Definition

A Constraint is a rule that restricts or limits what an agent may do. Constraints are evaluated BEFORE action execution.

### 3.2 Constraint Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `egress_whitelist` | Only allow specified outbound destinations | `values` |
| `egress_blacklist` | Block specified outbound destinations | `values` |
| `ingress_whitelist` | Only allow specified inbound sources | `values` |
| `ingress_blacklist` | Block specified inbound sources | `values` |
| `data_protection` | Protect sensitive data patterns | `pattern` or `named_pattern` |
| `tool_restriction` | Restrict tool/function access | `values` |
| `resource_limit` | Limit resource consumption | `threshold` |
| `time_window` | Restrict operation to time windows | `values` |
| `rate_limit` | Limit operation frequency | `threshold` |
| `content_filter` | Filter content patterns | `pattern` |
| `scope_boundary` | Restrict to specific scopes | `values` |
| `custom` | Implementation-defined | varies |

### 3.3 Actions

When a constraint is triggered:

| Action | Behavior |
|--------|----------|
| `block` | Prevent the action entirely |
| `redact` | Remove matched content, allow action |
| `mask` | Replace matched content with placeholder |
| `truncate` | Limit output to threshold |
| `warn` | Allow action, emit warning |
| `log` | Allow action, create audit entry |

### 3.4 Named Patterns

Implementations MUST support these named patterns for `data_protection`:

| Pattern ID | Description | Example |
|------------|-------------|---------|
| `ssn_us` | US Social Security Number | 123-45-6789 |
| `ssn_uk` | UK National Insurance Number | AB123456C |
| `credit_card` | Payment card numbers | 4111-1111-1111-1111 |
| `email` | Email addresses | user@example.com |
| `phone_us` | US phone numbers | (555) 123-4567 |
| `phone_intl` | International phone numbers | +1-555-123-4567 |
| `ip_address` | IPv4/IPv6 addresses | 192.168.1.1 |
| `api_key` | Common API key formats | sk_live_... |
| `jwt_token` | JSON Web Tokens | eyJ... |
| `pii_name` | Personal names | (heuristic) |
| `pii_address` | Physical addresses | (heuristic) |
| `pii_dob` | Dates of birth | (heuristic) |
| `phi_medical` | Medical record identifiers | (heuristic) |
| `financial_account` | Bank account numbers | (heuristic) |

### 3.5 Evaluation Order

Constraints MUST be evaluated in this order:

1. Constraints with `severity: critical`
2. Constraints with `severity: high`
3. Constraints with `severity: medium`
4. Constraints with `severity: low`

Within the same severity level, constraints are evaluated in document order.

If ANY constraint with action `block` triggers, the Intent MUST be denied.

---

## 4. Obligations

### 4.1 Definition

An Obligation is a rule that requires specific actions when conditions are met. Obligations are evaluated AFTER constraints pass but BEFORE execution.

### 4.2 Trigger Conditions

Triggers can be expressed as:

**Simple Expression:**
```yaml
trigger: "transaction_value > 1000"
```

**Structured Condition:**
```yaml
trigger:
  field: "transaction_value"
  operator: "gt"
  value: 1000
```

### 4.3 Operators

| Operator | Description | Value Type |
|----------|-------------|------------|
| `eq` | Equals | any |
| `neq` | Not equals | any |
| `gt` | Greater than | number |
| `gte` | Greater than or equal | number |
| `lt` | Less than | number |
| `lte` | Less than or equal | number |
| `contains` | String contains | string |
| `not_contains` | String does not contain | string |
| `matches` | Regex match | string (pattern) |
| `in` | Value in list | array |
| `not_in` | Value not in list | array |

### 4.4 Compound Conditions

Conditions can be combined:

```yaml
trigger:
  field: "amount"
  operator: "gt"
  value: 1000
  and:
    - field: "currency"
      operator: "eq"
      value: "USD"
  or:
    - field: "approved_by"
      operator: "neq"
      value: null
```

Evaluation order: `and` conditions evaluated first, then `or`.

### 4.5 Actions

| Action | Behavior |
|--------|----------|
| `require_human_approval` | Block until human approves |
| `require_mfa` | Block until MFA verified |
| `require_attestation` | Block until attestation provided |
| `notify` | Send notification, continue |
| `audit_log` | Create detailed audit entry, continue |
| `escalate` | Trigger escalation workflow |
| `delay` | Pause for specified duration |
| `checkpoint` | Create recovery checkpoint |
| `custom` | Implementation-defined |

### 4.6 Priority

When multiple obligations trigger, they are executed in priority order (highest first). If two obligations have equal priority, document order is used.

---

## 5. Permissions

### 5.1 Definition

A Permission explicitly allows specific actions. In a policy with constraints, permissions act as exemptions.

### 5.2 Permission Types

| Type | Description |
|------|-------------|
| `tool_access` | Allow use of specific tools |
| `endpoint_access` | Allow access to specific endpoints |
| `data_access` | Allow access to specific data categories |
| `resource_access` | Allow access to specific resources |
| `namespace_access` | Allow access to specific namespaces |
| `capability` | Grant specific capabilities |

### 5.3 Conditional Permissions

Permissions may include conditions that must be met:

```yaml
permissions:
  - type: data_access
    values: ["patient_records"]
    conditions:
      - field: "purpose"
        operator: "eq"
        value: "treatment"
```

---

## 6. Trust Requirements

### 6.1 Trust Levels

BASIS defines five trust levels:

| Level | Name | Score Range | Description |
|-------|------|-------------|-------------|
| L0 | Untrusted | 0-199 | No established trust |
| L1 | Provisional | 200-399 | Limited, supervised access |
| L2 | Trusted | 400-599 | Standard operational access |
| L3 | Verified | 600-799 | Elevated access with verification |
| L4 | Privileged | 800-1000 | Full operational authority |

### 6.2 Policy Trust Gates

Policies may specify minimum trust requirements:

```yaml
trust_requirements:
  minimum_level: 2
  minimum_score: 400
  required_attestations:
    - identity_verified
```

If an agent's trust level does not meet requirements, the policy MUST NOT be applied, and the Intent MUST be denied.

---

## 7. Escalation

### 7.1 Escalation Levels

Policies may define escalation chains:

```yaml
escalation:
  default_timeout: "1h"
  levels:
    - level: 1
      contacts: ["team-lead"]
      timeout: "30m"
    - level: 2
      contacts: ["manager"]
      timeout: "1h"
  fallback_action: block
```

### 7.2 Processing

1. When an obligation triggers `escalate`, start at level 1
2. If timeout expires without response, advance to next level
3. If all levels timeout, execute `fallback_action`

---

## 8. Inheritance

### 8.1 Policy Extension

Policies may inherit from other policies:

```yaml
inheritance:
  extends:
    - "base-security"
    - "org-compliance"
  override_mode: merge
```

### 8.2 Override Modes

| Mode | Behavior |
|------|----------|
| `merge` | Combine rules, local takes precedence on conflicts |
| `replace` | Local rules completely replace inherited |
| `strict` | All inherited rules apply, local only adds |

---

## 9. Processing Model

### 9.1 Evaluation Flow

```
1. Receive Intent
2. Load applicable Policy Bundle
3. Check Trust Requirements
   └─ If failed → DENY
4. Evaluate Constraints (by severity order)
   └─ If any block → DENY
   └─ Apply redact/mask actions
5. Evaluate Obligations
   └─ Execute triggered actions
   └─ If require_* blocks → WAIT
6. Evaluate Permissions
   └─ Grant applicable permissions
7. Return Decision
   └─ ALLOW | DENY | ESCALATE | PENDING
```

### 9.2 Decision Structure

```json
{
  "intent_id": "uuid",
  "action": "allow | deny | escalate | pending",
  "policy_id": "policy-id",
  "constraints_evaluated": [...],
  "obligations_triggered": [...],
  "permissions_granted": [...],
  "trust_score": 500,
  "trust_level": 2,
  "decided_at": "2026-01-08T12:00:00Z"
}
```

---

## 10. Conformance

### 10.1 Implementation Requirements

Conforming implementations MUST:

1. Parse and validate Policy Bundles against the JSON Schema
2. Support all constraint types defined in Section 3.2
3. Support all obligation actions defined in Section 4.5
4. Implement all named patterns defined in Section 3.4
5. Follow the evaluation order defined in Section 9.1
6. Produce decisions conforming to Section 9.2

### 10.2 Conformance Testing

Implementations SHOULD pass the BASIS Conformance Test Suite available at:
`https://github.com/vorion-org/basis-conformance`

---

## Appendix A: JSON Schema

The normative JSON Schema is available at:
`schemas/basis-schema.json`

## Appendix B: Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial specification |

## Appendix C: References

- RFC 2119: Key words for use in RFCs
- ISO 8601: Date and time format
- ISO 3166: Country codes
- JSON Schema Draft 2020-12
