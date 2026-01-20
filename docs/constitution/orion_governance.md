# ORION V1 — Joint Ownership, Execution Governance & GitHub Enforcement

**STATUS:** CANONICAL / NO-DRIFT / ENTERPRISE + GOVERNMENT GRADE / CLI-INGESTIBLE

This directive supersedes all prior governance language. ORION is ONE system, jointly owned, jointly accountable, with execution responsibilities split only for focus and velocity.

---

## I. Ownership Model (Non-Negotiable)

**O1.** ORION is jointly owned in full by:
- Alex
- Ryan

**O2.** All components, subsystems, repositories, documentation, contracts, policies, artifacts, and outputs belong to ORION as a single system.

**O3.** There are NO privately owned subsystems. There is NO concept of "my area" vs "your area."

**O4.** Accountability for:
- Security
- Compliance
- Audit readiness
- Regulatory acceptance
- Enterprise acceptance
- System failure or misuse

is **SHARED and INDIVISIBLE**.

---

## II. Execution Responsibility (Focus, Not Ownership)

To prevent thrash and duplication, ORION assigns PRIMARY EXECUTION LEADS. These assignments DO NOT confer authority or ownership.

### Primary Execution Leads

| Component | Primary Lead | Required Reviewer |
|-----------|--------------|-------------------|
| AURYN (Intent & Reasoning Core) | Alex | Ryan |
| Agent Anchor (Policy, Trust, Enforcement, Proof) | Ryan | Alex |
| PAL, ERA, Evolution, Contracts, Policy Bundles, Constitution | Joint | Joint |

### Rules

- Either party may propose changes anywhere in the system
- Either party may block a change anywhere in the system
- Primary execution lead drives implementation, not decisions

---

## III. Decision Authority (Release-Critical)

### Require Joint Approval

- Any change to system boundaries or roles
- Any change to trust computation or autonomy mapping
- Any change to audit, forensic, or compliance guarantees
- Any change impacting government, enterprise, or vendor acceptance
- Any change to contracts, schemas, or constitutions
- Any change that weakens determinism, explainability, or safety

### May Be Unilateral (if non-breaking and scoped)

- Internal refactors
- Performance optimizations
- Test additions
- Documentation improvements

**If disagreement exists → CHANGE DOES NOT SHIP.**

---

## IV. GitHub Organization Model

- **Organization:** orion-governance
- **Visibility:** PRIVATE
- **Structure:** SINGLE MONOREPO

### External Collaborators

- Scoped access only
- NDA required
- No direct merge rights to protected branches

---

## V. Branch Strategy

### Protected Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production |
| `develop` | Integration |
| `release/*` | Release candidates |

### Feature Branches

- `feature/auryn/*`
- `feature/anchor/*`
- `feature/platform/*`
- `feature/evolution/*`

Direct commits to protected branches are **FORBIDDEN**.

---

## VI. Branch Protection Rules

Apply to: `main`, `develop`, `release/*`

1. Pull request required
   - Minimum approvals: 2
   - CODEOWNERS review: REQUIRED
   - Stale approvals dismissed

2. Required status checks:
   - CI (lint + unit tests)
   - Integration tests
   - Security scans
   - Audit gates (EASE)
   - Contract/schema validation

3. Branch must be up to date before merge
4. Conversations must be resolved
5. Signed commits REQUIRED
6. Linear history REQUIRED
7. Force pushes DISABLED
8. Branch deletion DISABLED
9. Push access restricted to admins (Alex + Ryan)

---

## VII. Release Gates (Non-Negotiable)

A release **SHALL NOT** merge if ANY of the following fail:

- External Acceptance Simulation (EASE) reports conflict
- Audit or forensic artifacts fail generation
- Trust regression or anti-gaming tests fail
- Retention/WORM/sealing tests fail
- Deterministic replay fails
- Acceptance packets cannot be generated

Every release **MUST** include:

- Acceptance packets
- Pinned trust model version
- Pinned policy bundle versions
- Rollback plan

---

## VIII. Violation Handling

Any attempt to:
- Bypass CODEOWNERS
- Weaken branch protections
- Skip audit gates
- Merge without joint approval

**SHALL:**
- Fail CI automatically
- Generate an audit event
- Require postmortem review
- Trigger rollback if merged in error

---

## IX. Final Assertion

ORION operates as:
- One system
- One repository
- One acceptance bar
- Joint ownership
- Clear execution focus
- Enforced by GitHub, not memory

This model prevents drift, protects trust, and supports enterprise and government adoption.
