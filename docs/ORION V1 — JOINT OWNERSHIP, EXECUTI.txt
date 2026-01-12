ORION V1 — JOINT OWNERSHIP, EXECUTION GOVERNANCE & GITHUB ENFORCEMENT
STATUS: CANONICAL / NO-DRIFT / ENTERPRISE + GOVERNMENT GRADE / CLI-INGESTIBLE

────────────────────────────────────────────────────────────
RULE
────────────────────────────────────────────────────────────

- ALL listed reviewers are REQUIRED.
- CODEOWNERS indicate execution responsibility only.
- Ownership is always joint.

────────────────────────────────────────────────────────────
VI. BRANCH STRATEGY (LOCKED)
────────────────────────────────────────────────────────────

Protected branches:
- main        → production
- develop     → integration
- release/*   → release candidates

Feature branches:
- feature/auryn/*
- feature/anchor/*
- feature/platform/*
- feature/evolution/*

Direct commits to protected branches are FORBIDDEN.

────────────────────────────────────────────────────────────
VII. BRANCH PROTECTION RULES (MANDATORY)
────────────────────────────────────────────────────────────

Apply to: main, develop, release/*

1) Pull request required
   - Minimum approvals: 2
   - CODEOWNERS review: REQUIRED
   - Stale approvals dismissed

2) Required status checks:
   - CI (lint + unit tests)
   - Integration tests
   - Security scans
   - Audit gates (EASE)
   - Contract/schema validation

3) Branch must be up to date before merge
4) Conversations must be resolved
5) Signed commits REQUIRED
6) Linear history REQUIRED
7) Force pushes DISABLED
8) Branch deletion DISABLED
9) Push access restricted to admins (Alex + Ryan)

────────────────────────────────────────────────────────────
VIII. RELEASE GATES (NON-NEGOTIABLE)
────────────────────────────────────────────────────────────

A release SHALL NOT merge if ANY of the following fail:
- External Acceptance Simulation (EASE) reports conflict
- Audit or forensic artifacts fail generation
- Trust regression or anti-gaming tests fail
- Retention/WORM/sealing tests fail
- Deterministic replay fails
- Acceptance packets cannot be generated

Every release MUST include:
- acceptance packets
- pinned trust model version
- pinned policy bundle versions
- rollback plan

────────────────────────────────────────────────────────────
IX. VIOLATION HANDLING
────────────────────────────────────────────────────────────

Any attempt to:
- bypass CODEOWNERS
- weaken branch protections
- skip audit gates
- merge without joint approval

SHALL:
- fail CI automatically
- generate an audit event
- require postmortem review
- trigger rollback if merged in error

────────────────────────────────────────────────────────────
X. FINAL ASSERTION
────────────────────────────────────────────────────────────

ORION operates as:
- One system
- One repository
- One acceptance bar
- Joint ownership
- Clear execution focus
- Enforced by GitHub, not memory

This model prevents drift, protects trust,
and supports enterprise and government adoption.

END ORION V1 — JOINT OWNERSHIP, EXECUTION GOVERNANCE & GITHUB ENFORCEMENT

On Tue, Jan 6, 2026 at 1:58 PM Alex Blanc <alexbla2011@gmail.com> wrote:
ORION V1 — JOINT OWNERSHIP, EXECUTION GOVERNANCE & GITHUB ENFORCEMENT
STATUS: CANONICAL / NO-DRIFT / ENTERPRISE + GOVERNMENT GRADE / CLI-INGESTIBLE
SCOPE: DEFINES OWNERSHIP, EXECUTION RESPONSIBILITY, DECISION AUTHORITY,
       AND GITHUB-LEVEL ENFORCEMENT FOR THE ENTIRE ORION SYSTEM

This directive supersedes all prior governance language that implied
segmented ownership. It reflects the correct operating reality:
ORION is ONE system, jointly owned, jointly accountable, with execution
responsibilities split only for focus and velocity.

────────────────────────────────────────────────────────────
I. OWNERSHIP MODEL (NON-NEGOTIABLE)
────────────────────────────────────────────────────────────

O1. ORION is jointly owned in full by:
    - Alex
    - Ryan

O2. All components, subsystems, repositories, documentation, contracts,
    policies, artifacts, and outputs belong to ORION as a single system.

O3. There are NO privately owned subsystems.
    There is NO concept of “my area” vs “your area.”

O4. Accountability for:
    - security
    - compliance
    - audit readiness
    - regulatory acceptance
    - enterprise acceptance
    - system failure or misuse

    is SHARED and INDIVISIBLE.

────────────────────────────────────────────────────────────
II. EXECUTION RESPONSIBILITY (FOCUS, NOT OWNERSHIP)
────────────────────────────────────────────────────────────

To prevent thrash and duplication, ORION assigns PRIMARY EXECUTION LEADS.
These assignments DO NOT confer authority or ownership.

PRIMARY EXECUTION LEADS:

- AURYN (Intent & Reasoning Core)
  Primary execution lead: Alex
  Required reviewer: Ryan

- AGENT ANCHOR (Policy, Trust, Enforcement, Proof)
  Primary execution lead: Ryan
  Required reviewer: Alex

- PAL, ERA, Evolution, Contracts, Policy Bundles, Constitution
  Joint execution
  Joint approval REQUIRED

RULES:
- Either party may propose changes anywhere in the system.
- Either party may block a change anywhere in the system.
- Primary execution lead drives implementation, not decisions.

────────────────────────────────────────────────────────────
III. DECISION AUTHORITY (RELEASE-CRITICAL)
────────────────────────────────────────────────────────────

The following REQUIRE JOINT APPROVAL:

- Any change to system boundaries or roles
- Any change to trust computation or autonomy mapping
- Any change to audit, forensic, or compliance guarantees
- Any change impacting government, enterprise, or vendor acceptance
- Any change to contracts, schemas, or constitutions
- Any change that weakens determinism, explainability, or safety

The following MAY be unilateral IF non-breaking and scoped:
- Internal refactors
- Performance optimizations
- Test additions
- Documentation improvements

If disagreement exists → CHANGE DOES NOT SHIP.

────────────────────────────────────────────────────────────
IV. GITHUB ORGANIZATION MODEL (REQUIRED)
────────────────────────────────────────────────────────────

GitHub Organization:
- Name: orion-platform
- Visibility: PRIVATE
- All work occurs in a SINGLE MONOREPO.

External collaborators:
- Scoped access only
- NDA required
- No direct merge rights to protected branches

────────────────────────────────────────────────────────────
V. CODEOWNERS (EXECUTION RESPONSIBILITY, NOT OWNERSHIP)
────────────────────────────────────────────────────────────

File: .github/CODEOWNERS