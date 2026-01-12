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