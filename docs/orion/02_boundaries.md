# ORION System Boundaries

**Version:** 1.0
**Status:** CANONICAL / NO-DRIFT

This document defines "what starts and ends where" to prevent drift.

## Core Boundary Rules

### Rule 1: AURYN Thinks, Anchor Governs

| Action | AURYN | Agent Anchor |
|--------|-------|--------------|
| Generate intent | ✅ | ❌ |
| Evaluate policy | ❌ | ✅ |
| Compute trust | ❌ | ✅ |
| Authorize execution | ❌ | ✅ |
| Execute tools | ❌ | ❌ (via ERA) |
| Produce proof | ❌ | ✅ |

### Rule 2: Trust Authority

Agent Anchor is the **sole authority** for trust computation.

- AURYN may READ trust summaries (band + AC)
- AURYN may NOT compute, mutate, or override trust
- PAL may RECORD trust history
- PAL may NOT compute trust

### Rule 3: Policy Authority

Agent Anchor is the **sole authority** for policy enforcement.

- Policy bundles are data, not code
- Anchor enforces bundles without interpretation
- Conflicts trigger escalation, not resolution
- AURYN receives constraints, does not evaluate them

### Rule 4: Execution Authority

ERA runtimes execute, but ONLY with Anchor authorization.

- No execution without decision_id
- All actions emit digests to Proof Plane
- Correlation IDs propagate through all layers

## Interface Contracts

### AURYN → Agent Anchor

**Input:** `intent_payload` conforming to contracts/v2/intent.schema.json

**Output:** `decision_payload` conforming to contracts/v2/decision.schema.json

AURYN MUST treat any decision from Anchor as authoritative.

### Agent Anchor → ERA

**Input:** `authorized_step` with:
- decision_id
- allowed_tools
- constraints
- correlation_id

**Output:** `execution_digest` with:
- step_id
- tool_invocations
- outcomes
- digests (not raw data)

### PAL → Both Cores

PAL wraps both cores for lifecycle management:

**From Cores:**
- Component registration
- Version declarations
- Trust delta events (from Anchor)

**To Cores:**
- Promotion/demotion signals
- Rollback commands
- Incident triggers

## Forbidden Cross-Boundary Actions

### AURYN Must Never:

- Call ERA directly (must go through Anchor)
- Store or cache authorization decisions
- Maintain trust state
- Bypass Anchor for "simple" operations
- Interpret policy bundles as law

### Agent Anchor Must Never:

- Generate goals or plans
- Optimize for business outcomes
- Make probabilistic authorization (must be deterministic)
- Store raw execution data (only digests)
- Modify intent from AURYN

### PAL Must Never:

- Intercept intent→decision flow
- Override authorization decisions
- Compute trust scores
- Execute tools

### ERA Must Never:

- Execute without decision_id
- Skip digest emission
- Access resources outside scope
- Retain state between executions

## Data Residency Boundaries

| Data Type | Stored In | Retention Owner |
|-----------|-----------|-----------------|
| Intent payloads | Agent Anchor | ERPL |
| Decision payloads | Agent Anchor | ERPL |
| Trust profiles | Agent Anchor | ERPL |
| Execution digests | Agent Anchor | ERPL |
| Policy bundles | Policy Bundles repo | Anchor |
| Version lineage | PAL | PAL |
| Acceptance packets | Anchor (generated) | Docs |

## Escalation Boundaries

### When AURYN Escalates:

- Trust band <= T1 → recommend HITL
- AC < threshold → recommend autonomy reduction
- Constraint conflict detected → flag for Anchor

### When Anchor Escalates:

- Policy conflict unresolvable
- Trust computation inconclusive
- Evidence insufficient for band
- Legal hold triggered

### When PAL Escalates:

- Incident threshold exceeded
- Drift detected
- Promotion blocked
- Rollback required

## Version Compatibility

| Contract Version | AURYN | Anchor | ERA | PAL |
|-----------------|-------|--------|-----|-----|
| v1 | 1.x | 1.x | 1.x | 1.x |
| v2 | 2.x | 2.x | 2.x | 2.x |

Cross-version communication is NOT supported. All components must use the same contract version.
