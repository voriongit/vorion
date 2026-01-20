# ORION Audit & Forensic Completeness (ERPL)

**STATUS:** CANONICAL / NO-DRIFT
**COMPONENT:** Evidence Retention & Preservation Layer

---

## Overview

ERPL (Evidence Retention & Preservation Layer) guarantees forensic-grade audit completeness for ORION. It provides:

- Immutable evidence storage (WORM)
- Legal hold support
- Cryptographic sealing
- Retention policy enforcement
- Framework-specific audit exports

---

## Core Guarantees

### 1. Append-Only Storage (WORM)

- All proof events are write-once-read-many
- No modification after write
- No deletion except by retention policy expiry
- Cryptographic integrity verification

### 2. Hash-Chained Integrity

- Every proof event links to previous
- Chain breaks are detectable
- Merkle trees for efficient verification
- Tamper-evident by design

### 3. Correlation Linking

- All events share correlation_id
- Full trace from intent → decision → execution → outcome
- Cross-component traceability
- Lifecycle completeness

---

## Retention Policies

Retention windows are configured per:

| Factor | Examples |
|--------|----------|
| Jurisdiction | US: 7 years, EU: varies by regulation |
| Industry | Healthcare: HIPAA requirements, Finance: SEC rules |
| Organization | Custom org policies |
| Data Classification | PII, trade secrets, public data |

### Default Retention Windows

| Data Type | Default Retention |
|-----------|-------------------|
| Authorization decisions | 7 years |
| Trust delta events | 7 years |
| Execution digests | 5 years |
| Policy resolutions | 7 years |
| Incident records | 10 years |

---

## Legal Holds

Legal holds freeze evidence deletion for litigation or investigation.

### Hold Requirements

- Dual approval required (two authorized parties)
- Scope definition (time range, correlation IDs, profiles)
- Audit trail of hold creation/release
- Notification to affected parties (configurable)

### Hold Lifecycle

1. **Request:** Authorized party requests hold
2. **Approval:** Second authorized party approves
3. **Activation:** Hold applied to matching evidence
4. **Maintenance:** Evidence protected from deletion
5. **Release:** Dual approval to release
6. **Audit:** Full audit trail preserved

```json
{
  "hold_id": "uuid",
  "status": "active|released",
  "scope": {
    "time_range": {
      "start": "iso8601",
      "end": "iso8601"
    },
    "correlation_ids": ["uuid1", "uuid2"],
    "profile_ids": ["uuid3"]
  },
  "requested_by": "user_id",
  "approved_by": "user_id",
  "created_at": "iso8601",
  "released_at": null,
  "release_approved_by": null,
  "reason": "Investigation reference XYZ"
}
```

---

## Cryptographic Sealing

At the end of each retention window, evidence is cryptographically sealed.

### Seal Properties

- Covers all evidence in window
- Includes Merkle root of all events
- Timestamped by trusted authority
- Signature by Anchor signing key
- Verifiable by third parties

### Seal Event

```json
{
  "seal_id": "uuid",
  "window": {
    "start": "iso8601",
    "end": "iso8601"
  },
  "merkle_root": "sha256_hash",
  "event_count": 12345,
  "sealed_at": "iso8601",
  "signature": "base64_signature",
  "certificate_chain": ["cert1", "cert2"]
}
```

### Seal Verification

Seals can be verified by:
- Recomputing Merkle root from events
- Verifying signature against certificate
- Checking timestamp from trusted authority

**Seal verification tests are required for release.**

---

## Proof Exports (Framework Mappings)

ORION exports canonical proof into framework-specific formats:

### Supported Frameworks

| Framework | Export Format |
|-----------|---------------|
| SOC 2 | Control evidence mapping |
| ISO 27001 | Annex A control mapping |
| NIST 800-53 | Control family mapping |
| FedRAMP | OSCAL-compatible format |
| GDPR | Data processing records |
| EU AI Act | Accountability documentation |

### Export Principles

- Internal proof format NEVER changes
- Mappings adapt externally
- Exports are generated on-demand
- Exports include verification metadata
- Exports are themselves auditable

---

## Process Artifacts

Beyond technical evidence, ERPL preserves process artifacts:

| Artifact | Purpose |
|----------|---------|
| Change records | What changed, who approved |
| Access review reports | Who has access, why |
| Incident reports | What happened, response |
| Rollback records | When, why, outcome |
| Promotion/demotion records | Component lifecycle |

---

## Testing Requirements

All ERPL changes require:

- [ ] WORM immutability tests
- [ ] Retention policy enforcement tests
- [ ] Legal hold lifecycle tests
- [ ] Seal generation tests
- [ ] Seal verification tests
- [ ] Export integrity tests
- [ ] Chain integrity tests

---

## Incident Response Integration

When incidents occur, ERPL automatically:

1. Generates evidence pack for affected scope
2. Applies preservation hold (pending approval)
3. Exports relevant proof for investigation
4. Links to incident record
5. Preserves chain of custody
