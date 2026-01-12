ORION V1 — AGENT ANCHOR (MOST UP-TO-DATE / INCLUDES ALL MODIFICATIONS)
STATUS: CANONICAL / NO-DRIFT / CLI-INGESTIBLE
ROLE: ORION AGENT ANCHOR = TRUST / AUTHORIZATION / PROOF CORE

────────────────────────────────────────────────────────────
0) NON-NEGOTIABLE ROLE BOUNDARIES
────────────────────────────────────────────────────────────
B0. Agent Anchor is the sole authority for policy enforcement and execution gating.
B1. Agent Anchor is deterministic given identical inputs.
B2. Agent Anchor never performs strategic reasoning or goal invention.
B3. Agent Anchor maintains audit-grade proof and evidence preservation.
B4. Agent Anchor runs acceptance conflict detection (EASE) as release-blocking gate.

────────────────────────────────────────────────────────────
1) POLICY & JURISDICTION ENGINE (JSAL)
────────────────────────────────────────────────────────────
Anchor SHALL implement JSAL to represent law/standards as policy bundles:
- jurisdictional
- industry
- organizational
- contractual

Rules:
- “law as data, not logic”
- policy bundles are versioned and signed
- most restrictive wins
- conflicts trigger escalation

Outputs:
- constraint_set_id
- resolved policy bundle set (with signatures)
- allowed/denied actions by category

────────────────────────────────────────────────────────────
2) TRUST SYSTEM (ATP) — AUTHORITATIVE
────────────────────────────────────────────────────────────
Anchor SHALL compute Trust Profiles (scoped) with dimensions:
- CT Capability Trust
- BT Behavioral Trust
- GT Governance Trust
- XT Contextual Trust
- AC Assurance Confidence

Anchor SHALL derive Trust Band T0..T5 via:
- GT/AC/XT gating caps
- asymmetric updates (fast loss, slow gain)
- hysteresis (sustained evidence to rise)
- decay (stale evidence reduces CT/BT/AC)

Anchor SHALL emit trust_delta_event for all trust changes and write into Proof Plane.

Trust Band SHALL be the sole autonomy driver.

────────────────────────────────────────────────────────────
3) AUTHORIZATION ENGINE (DETERMINISTIC)
────────────────────────────────────────────────────────────
Given:
- intent payload
- policy resolution (JSAL)
- Trust Profile + Band

Anchor SHALL output:
- permit/deny
- required approvals (HITL thresholds)
- allowed tool categories
- data access scopes
- budget/rate caps
- reversibility requirements
- correlation_id and decision_id

No execution is allowed without a permit decision.

────────────────────────────────────────────────────────────
4) AUTONOMY CONTROLLER (ENFORCEMENT)
────────────────────────────────────────────────────────────
Anchor SHALL enforce Trust Band to autonomy mapping:
- T0 deny execution
- T1 HITL mandatory; no irreversible actions
- T2 constrained autonomy; reversible only; strict allowlists
- T3 supervised autonomy; rollback required
- T4 broad autonomy; continuous monitoring
- T5 mission-critical; strongest proof; strict GT/AC requirements

────────────────────────────────────────────────────────────
5) PROOF PLANE (FORENSIC-GRADE)
────────────────────────────────────────────────────────────
Anchor SHALL write immutable proof events for:
- intent receipt
- policy resolution
- authorization decisions
- trust delta events
- execution digests (from ERA)
- incidents and rollbacks
- export generation

Proof events SHALL be hash-chained and correlation-linked.

────────────────────────────────────────────────────────────
6) ERPL — EVIDENCE RETENTION & PRESERVATION (WORM)
────────────────────────────────────────────────────────────
Anchor SHALL implement ERPL to guarantee:
- retention windows by jurisdiction/industry/org
- write-once-read-many immutability for finalized evidence
- legal holds with auditable dual approval
- cryptographic sealing of evidence windows
- seal verification tests required for release

────────────────────────────────────────────────────────────
7) PROOF EXPORTS (FRAMEWORK MAPPINGS)
────────────────────────────────────────────────────────────
Anchor SHALL export canonical proof into mappings for:
- SOC 2
- ISO 27001
- NIST 800-53
- FedRAMP-style audits
- GDPR/EU AI Act accountability principles
- custom government formats

Internal proof format SHALL NOT change.
Mappings SHALL adapt externally.

────────────────────────────────────────────────────────────
8) EASE — EXTERNAL ACCEPTANCE SIMULATION (RELEASE BLOCKER)
────────────────────────────────────────────────────────────
Anchor SHALL run EASE on every release candidate:
- simulate auditors, procurement, regulators, vendor risk, CTO/CISO panels
- detect missing acceptance artifacts as SYSTEM CONFLICTS
- block release if any conflict exists

Anchor SHALL generate acceptance packets:
- procurement packets
- enterprise assurance packs
- vendor/partner packs
- developer compliance packs (SDK conformance + redacted traces + audit dry runs)

Absence of any required packet is a release-blocking conflict.

────────────────────────────────────────────────────────────
9) ADMIN API (AUDIT & GOVERNANCE)
────────────────────────────────────────────────────────────
Anchor SHALL provide admin endpoints for:
- policy bundle management (signed versions)
- audit queries and evidence retrieval
- access review report generation
- change record generation
- trust profile queries (band + summaries)
- acceptance packet generation
- incident artifacts generation

────────────────────────────────────────────────────────────
10) EVALS (REQUIRED)
────────────────────────────────────────────────────────────
Anchor SHALL include:
- policy conflict tests
- bypass tests
- trust stability + anti-gaming tests
- WORM/retention/legal hold tests
- sealing verification tests
- export integrity tests
- EASE conflict tests
- deterministic replay tests (same input => same decision)

END ORION V1 — AGENT ANCHOR