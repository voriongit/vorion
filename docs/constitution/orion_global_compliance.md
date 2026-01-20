# ORION Global Compliance & Adaptability

**STATUS:** CANONICAL / NO-DRIFT
**PRINCIPLE:** Law as data, not logic

---

## Overview

ORION achieves global compliance through:

1. **JSAL** — Jurisdiction & Standards Abstraction Layer
2. **Policy Bundles** — Modular, versioned, signed policy packages
3. **Most Restrictive Wins** — Deterministic conflict resolution
4. **No Interpretation** — Enforce policy, don't interpret law

---

## JSAL (Jurisdiction & Standards Abstraction Layer)

JSAL represents legal and regulatory requirements as data that can be:

- Loaded at runtime
- Composed from multiple sources
- Versioned and signed
- Enforced deterministically

### JSAL Does NOT:

- Interpret legal text
- Make legal judgments
- Provide legal advice
- Replace legal counsel

### JSAL DOES:

- Translate legal requirements into enforceable constraints
- Compose constraints from multiple jurisdictions
- Resolve conflicts via "most restrictive wins"
- Escalate unresolvable conflicts

---

## Policy Bundle Structure

Policy bundles are organized hierarchically:

```
policy-bundles/
├── jurisdictions/
│   ├── US/
│   │   ├── federal.yaml
│   │   ├── california.yaml
│   │   └── new_york.yaml
│   ├── EU/
│   │   ├── gdpr.yaml
│   │   └── ai_act.yaml
│   ├── CA/
│   │   └── pipeda.yaml
│   └── SG/
│       └── pdpa.yaml
├── industries/
│   ├── finance/
│   │   ├── sec.yaml
│   │   └── finra.yaml
│   ├── healthcare/
│   │   └── hipaa.yaml
│   └── government/
│       └── fedramp.yaml
├── standards/
│   ├── SOC2/
│   ├── ISO27001/
│   ├── NIST_800_53/
│   └── FedRAMP/
└── org_profiles/
    ├── default_low_risk.yaml
    ├── default_enterprise.yaml
    └── default_government.yaml
```

---

## Policy Bundle Format

```yaml
# policy_bundle.yaml
bundle_id: us-federal-2024
version: "1.0.0"
effective_date: "2024-01-01"
expires_date: null
jurisdiction: US
scope: federal

constraints:
  - id: data_residency
    type: location
    rule: "data_at_rest MUST be in [US]"
    enforcement: strict

  - id: retention_minimum
    type: duration
    rule: "audit_logs MUST be retained >= 7 years"
    enforcement: strict

  - id: encryption_transit
    type: security
    rule: "data_in_transit MUST use TLS >= 1.2"
    enforcement: strict

escalation_triggers:
  - condition: "constraint_conflict"
    action: "human_review"

signatures:
  - signer: "policy_admin@orion"
    algorithm: "ed25519"
    signature: "base64..."
```

---

## Policy Resolution

When an intent is received, Anchor resolves applicable policies:

### Step 1: Identify Applicable Bundles

Based on:
- Jurisdiction (from context)
- Industry (from org profile)
- Standards (from org profile)
- Custom org policies

### Step 2: Compose Constraints

All applicable constraints are merged into a single set.

### Step 3: Resolve Conflicts

**Rule:** Most restrictive wins.

| Bundle A | Bundle B | Result |
|----------|----------|--------|
| Retain 5 years | Retain 7 years | Retain 7 years |
| TLS 1.2+ | TLS 1.3+ | TLS 1.3+ |
| US residency | EU residency | **CONFLICT** |

### Step 4: Handle Conflicts

Unresolvable conflicts (like contradictory residency requirements):
- Trigger escalation
- Block execution until resolved
- Generate conflict report

---

## No Code Forks

ORION does NOT fork code for different jurisdictions.

Instead:
- Single codebase
- Policy bundles loaded at runtime
- Behavior varies by policy, not code
- Audit proves which policies applied

---

## Multi-Jurisdiction Deployment

For global deployment:

1. Deploy single ORION instance (or federated instances)
2. Load jurisdiction-appropriate policy bundles
3. Context determines which bundles apply
4. Proof shows exactly which policies enforced

---

## Policy Bundle Lifecycle

### Creation

1. Legal/compliance team defines requirements
2. Policy engineer translates to bundle format
3. Review by legal counsel
4. Sign with authorized key

### Versioning

- Semantic versioning (major.minor.patch)
- Major: Breaking changes
- Minor: New constraints
- Patch: Clarifications

### Signing

- All bundles must be signed
- Signature verified at load time
- Unsigned bundles rejected

### Revocation

- Bundles can be revoked
- Revocation propagates to all instances
- Audit trail preserved

---

## Testing Requirements

Policy bundle changes require:

- [ ] Schema validation
- [ ] Constraint conflict tests
- [ ] Resolution determinism tests
- [ ] Performance impact tests
- [ ] Signature verification tests
- [ ] Backward compatibility tests
