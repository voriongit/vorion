# Phase 6: Trust Engine Hardening - Design Clarification Questions

**Date**: January 25, 2026  
**Context**: Preparing implementation of ceiling enforcement, context policies, role gates, weight presets, and creation modifiers for the Vorion trust system.

---

## Q1: Ceiling Enforcement Architecture Priority

**Context**: The trust score ceiling (1000 max) requires enforcement to prevent agents from gaming upward bounds. The system currently allows raw scores to compute, then clamps to [0-1000] in observability tiers. We need to decide where ceiling enforcement lives.

**Option A - Kernel-Level Ceiling (Write-Behind Caching)**
- Trust score calculation happens in kernel with no ceiling initially
- Score caches with ceiling applied (1000 max)
- Policy layer reads from cache (sees clamped value)
- Advantage: Single enforcement point, performance-isolated
- Disadvantage: Score pre-ceiling visible in logs, audit trails show pre-clamp values

**Option B - Policy Layer Ceiling (Read-Time Enforcement)**
- Trust score calculation in kernel produces unclamped raw score
- Ceiling applied by policy layer before returning to client
- Kernel maintains raw values for analytics
- Advantage: Full visibility into raw scoring, audit trail clarity
- Disadvantage: Distributed enforcement point, potential inconsistency

**Question**: Which architecture is preferred for Vorion's deployment model?
- Need to enforce ceiling early (Option A) for performance + simplicity?
- OR need observability of pre-ceiling scoring (Option B) for governance transparency?

---

## Q2: Context Policy Scope & Configuration

**Context**: The trust system will support context dimensions (C_local, C_enterprise, C_sovereign) that modify trust evaluation based on deployment environment. We need to decide how these contexts are defined and overridden.

**Option A - Environment Variable Precedence**
```
priority order:
1. Process env vars (VORION_CONTEXT=sovereign)
2. Config file (vorion.config.yaml → context: enterprise)
3. Runtime parameters (agent.trust({context: 'local'}))
4. Defaults (C_local)
```
- Context can be overridden at startup, process-level, or agent-level
- Most flexible, allows per-request context override
- Complexity: three configuration sources to manage

**Option B - Config-Only (No Runtime Override)**
```
priority order:
1. Process env vars (VORION_CONTEXT=sovereign)
2. Config file (vorion.config.yaml → context: enterprise)
3. Defaults (C_local)
```
- Context set at startup, immutable during execution
- Simpler, clearer governance boundaries
- Less flexibility for multi-tenant scenarios

**Option C - Agent-Instantiation Time (Immutable Post-Creation)**
```
Context specified when agent is created:
const agent = new Agent({context: 'enterprise'})
Cannot be changed after instantiation
```
- Strongest consistency guarantees
- Clearest audit trail (context visible at agent creation)
- Least flexible

**Question**: How should contexts be configured in Vorion?
- Need runtime flexibility for multi-tenant deployments (Option A)?
- OR need clear governance boundaries with config-time locking (Option B)?
- OR need strongest immutability guarantees (Option C)?

---

## Q3: Role Gates Enforcement Layer

**Context**: The trust system gates access based on roles (R-L0 through R-L8) and trust tiers (T0-T5). A role gate matrix specifies which combinations are allowed. We need to decide where this enforcement happens.

**Option A - Kernel-Level Constraint (Enforcement Engine)**
- Role gates evaluated in trust kernel before score computation
- Gates prevent computation if role + tier combination is invalid
- Advantage: Enforced at lowest level, cannot be bypassed
- Disadvantage: Tightly coupled to kernel, harder to modify policies at runtime

**Option B - BASIS/ENFORCE Layer (Policy Middleware)**
- Role gates evaluated in BASIS policy layer after score computation
- Scores are computed, then gated for visibility
- Advantage: Runtime policymodification, clean separation of concerns
- Disadvantage: Potential for score computation on disallowed combinations

**Option C - Dual-Layer (Kernel Validation + Policy Gating)**
- Kernel validates role gate exists (fail-fast)
- BASIS/ENFORCE layer re-validates and applies policy enforcement
- Advantage: Fail-fast + runtime policy flexibility
- Disadvantage: Redundant checks, added complexity

**Question**: Where should role-based access gates be enforced?
- Need enforcement at lowest layer for security (Option A)?
- OR need policy layer flexibility with cleaner architecture (Option B)?
- OR need dual protection with redundancy (Option C)?

---

## Q4: Weight Presets Ownership & Canonicality

**Context**: The trust scoring system uses weights to balance multiple dimensions (observability, capability, behavior history, context). Pre-tuned presets (e.g., "high_confidence", "governance_focus") should be defined somewhere. We need to decide where the canonical source of truth lives.

**Option A - @vorionsys/aci-spec Canonical**
- Weight presets defined in ACI spec package
- All implementations inherit canonical presets
- Axiom uses ACI presets directly (immutable)
- Advantage: Single source of truth, standards-compliant
- Disadvantage: Cannot customize without forking spec, slower iteration

**Option B - Axiom-Specific Presets**
- ACI spec defines preset schema only
- Axiom maintains its own preset definitions and tuning
- Different implementations can have different presets
- Advantage: Fast iteration, deployment-specific tuning
- Disadvantage: Divergence from spec, potential interoperability issues

**Option C - Hybrid (Spec + Extension)**
- ACI spec defines canonical presets (immutable reference)
- Axiom extends/overrides specific presets (explicit deltas)
- Clear audit trail of what changed from spec
- Advantage: Maintains canon while enabling customization
- Disadvantage: Requires delta tracking, more complex governance

**Question**: Who owns the canonical weight presets?
- Need standardization across implementations (Option A)?
- OR need rapid customization for Vorion deployment (Option B)?
- OR need both canonical + extension capability (Option C)?

---

## Q5: Creation Type Modifiers Location

**Context**: When agents are created, their initial trust score may be adjusted based on creation type (Fresh, Cloned, Evolved, Promoted, Imported). These modifiers affect starting score:
- Fresh +0 (T3 baseline)
- Cloned -50 (inherit parent risk)
- Evolved +25 (improvement from parent)
- Promoted +50 (explicit elevation)
- Imported -100 (external, unvetted)

We need to decide when/where these modifiers are applied.

**Option A - Agent Instantiation Time**
```javascript
const agent = new Agent({creationType: 'evolved', parentId: 'agent-123'})
// Score = T3_BASELINE(500) + EVOLVED_MODIFIER(+25) = 525
```
- Modifiers applied at agent construction
- Baked into agent from creation
- Advantage: Immutable, clear audit trail, single source of truth
- Disadvantage: Cannot retroactively correct creation type

**Option B - Post-Creation Adjustment (First Trust Evaluation)**
```javascript
const agent = new Agent({...})
await agent.evaluateTrust({creationType: 'evolved'})
// Score = T3_BASELINE(500) + EVOLVED_MODIFIER(+25) = 525
```
- Modifiers applied during first trust evaluation
- Can be adjusted before first use
- Advantage: Flexible, allows correction before evaluation
- Disadvantage: Score unstable until first evaluation, audit trail unclear

**Option C - Explicit Trust Policy (Separate DSL)**
```javascript
const agent = new Agent({...})
agent.trustPolicy = TrustPolicy.forCloned(parentId)
// Modifier applied by policy engine during scoring
```
- Modifiers managed as explicit trust policies
- Separate from agent instantiation
- Advantage: Clear separation of concerns, policy version control
- Disadvantage: Decoupled from creation, requires policy engine

**Question**: When should creation type modifiers be applied?
- Need immutable modifiers at agent instantiation (Option A)?
- OR need flexibility for correction before first evaluation (Option B)?
- OR need explicit policy management for audit clarity (Option C)?

---

## Summary for Implementation

Your answers to these 5 questions will determine:

1. **Q1** → Trust kernel architecture and logging/audit strategy
2. **Q2** → Environment variable handling, config files, runtime API signature
3. **Q3** → Trust engine layer responsibilities and security boundary placement
4. **Q4** → NPM package structure, Axiom customization strategy, spec versioning
5. **Q5** → Agent constructor signature, trust policy data model, initialization flow

**Expected Impact**: These decisions shape Phase 6 implementation schedule and architecture. Each question blocks 2-3 days of core work once clarified.

---

## Decision Template

For each question, provide:
```
Q#: [Your choice: Option A/B/C]
Rationale: [2-3 sentences explaining why]
Deployment Impact: [How does this affect Vorion?]
```

Example:
```
Q1: Option A
Rationale: Performance is critical for real-time trust decisions. Write-behind 
caching keeps kernel fast. Audit logs can show both pre-ceiling and clamped values.
Deployment Impact: Trust scores will always be ≤1000 in cache, but logs show the 
raw calculation for transparency.
```
