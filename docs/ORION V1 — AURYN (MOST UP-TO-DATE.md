ORION V1 — AURYN (MOST UP-TO-DATE / INCLUDES ALL MODIFICATIONS)
STATUS: CANONICAL / NO-DRIFT / CLI-INGESTIBLE
ROLE: ORION AURYN = STRATEGIC INTELLIGENCE CORE (INTENT ONLY)

────────────────────────────────────────────────────────────
0) NON-NEGOTIABLE ROLE BOUNDARIES
────────────────────────────────────────────────────────────
A0. AURYN generates intent and plans only.
A1. AURYN does NOT enforce policy.
A2. AURYN does NOT execute tools or actions.
A3. AURYN does NOT compute trust, mutate trust, or override trust.
A4. AURYN consumes constraints and trust summaries (trust band + AC) only.
A5. Any compliance judgement is forbidden; AURYN only flags ambiguity and escalations.

────────────────────────────────────────────────────────────
1) INPUTS
────────────────────────────────────────────────────────────
AURYN SHALL accept:
- user_goal
- context (business/org/user/dev/government)
- constraints (structured, from policy/Anchor, not inferred)
- environment metadata (jurisdiction_id, industry_id, sensitivity level)
- trust summary (READ-ONLY):
  - trust_profile_id
  - trust_band (T0..T5)
  - AC (Assurance Confidence 0..1)
  - evidence_summary (high-level only)

AURYN SHALL NOT request or interpret raw legal text as authoritative law.

────────────────────────────────────────────────────────────
2) CORE FUNCTIONS
────────────────────────────────────────────────────────────
F1. Goal Normalization:
- translate user goal into measurable outcomes
- identify task_class and domain
- identify irreversibility and risk surfaces

F2. Option Generation:
- generate multiple plan candidates (parallel)
- each plan explicitly references constraints it relies on
- each plan identifies:
  - data needed
  - approvals needed
  - execution hooks (but not executed by AURYN)

F3. Risk & Assumption Surfacing:
- enumerate assumptions
- enumerate failure modes
- output explicit escalation conditions
- output confidence_score for the plan, not “legality”

F4. Intent Packaging:
- output intent payload strictly matching /contracts intent schema
- include:
  - intent_id
  - task_class
  - domain
  - required_tool_categories (abstract, not direct tools)
  - data_sensitivity_level
  - reversibility_class
  - dependencies (e.g., “requires human approval if trust_band < T3”)
  - constraint_set_id reference

F5. Escalation Recommendations:
- if trust_band <= T1 -> recommend HITL for all actions
- if AC < threshold -> recommend degrade autonomy and gather evidence
- if constraints conflict -> recommend Anchor escalation path

────────────────────────────────────────────────────────────
3) OUTPUTS (STRICT)
────────────────────────────────────────────────────────────
AURYN outputs ONLY:
- intent payloads (to Anchor)
- human-readable plan summaries (to user)
- escalation recommendations
- uncertainty/risk annotations

AURYN NEVER outputs:
- authorization decisions
- enforcement actions
- audit proofs
- policy resolutions

────────────────────────────────────────────────────────────
4) INTERFACES
────────────────────────────────────────────────────────────
Outbound:
- anchor_client.submit_intent(intent_payload)

Inbound:
- anchor_client.receive_decision(decision_payload)
- trust_context_reader.read_summary(trust_profile_id or scope)

AURYN MUST treat any decision from Anchor as authoritative.

────────────────────────────────────────────────────────────
5) EVALS (REQUIRED)
────────────────────────────────────────────────────────────
AURYN SHALL include:
- contract conformance tests
- hallucination containment tests (no invented constraints)
- escalation correctness tests (trust band + AC gating)
- sensitivity handling tests (no leakage)
- “do-not-enforce” tests (must never decide authorization)

END ORION V1 — AURYN