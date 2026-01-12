VORION — FULL REMAINDER BUILD SPEC (MASTER)

0\) System Truth (Anchor)  
Vorion is a governed cognition kernel.

Invariant pipeline (must be true after completion):

Request  
 → Validation  
 → Intent Classification  
 → Rigor & Risk Scaling  
 → Governance / Authority Arbitration  
 → Plan Construction  
 → Evaluator Selection  
 → Evaluator Execution  
 → Output Normalization  
 → Evidence \+ Assumptions Ledger  
 → Confidence \+ Invalidity Conditions  
 → Trace \+ Audit  
 → Response

All future features must compose onto this pipeline, not bypass it.

\---

1\) Output Contract (FOUNDATIONAL — FIRST TASK)

Purpose  
Guarantee machine-readable, auditable, replayable outputs.

Files  
src/common/contracts/output.ts  
src/common/contracts/errors.ts  
src/common/contracts/evidence.ts

Required Structures  
\- VorionResponse  
  \- decision  
  \- summary  
  \- confidence (0–1 \+ descriptor)  
  \- assumptions\[\]  
  \- invalidityConditions\[\]  
  \- evidence\[\]  
  \- trace  
\- VorionErrorResponse  
  \- errorCode  
  \- message  
  \- recoverable  
  \- trace  
\- Trace  
  \- requestId  
  \- intent  
  \- rigor  
  \- selectedEvaluator  
  \- ruleHits\[\]  
  \- timings  
\- EvidenceItem  
  \- type (input | computed | codepath | external)  
  \- pointer  
  \- summary

Acceptance  
\- API never returns raw strings or unstructured objects  
\- All success \+ failure paths conform to contract  
\- Schema tests exist

\---

2\) Governance & Authority Engine (NON-NEGOTIABLE)

Purpose  
Make Vorion trustworthy, not clever.

Files  
src/governance/rules.ts  
src/governance/engine.ts  
src/governance/policy.ts  
src/governance/conflicts.ts

Authority Hierarchy  
1\. System Rules (hard, cannot be overridden)  
2\. Policy Rules (env-specific)  
3\. Engine Defaults  
4\. Evaluator Output

Rule Capabilities  
\- Hard disqualifiers  
\- Soft constraints  
\- Mandatory clarification triggers  
\- Prohibited claim categories  
\- Evidence sufficiency thresholds

Enforcement  
\- All rule hits recorded into trace.ruleHits  
\- Hard rule → refusal OR clarification (never guess)

Acceptance  
\- Identical inputs → identical rule outcomes  
\- Tests prove hard-rule refusal  
\- Governance runs before evaluator execution

\---

3\) Intent System (VORION-GRADE)

Files  
src/intent/taxonomy.ts  
src/intent/classifier.ts  
src/intent/rigor.ts  
src/intent/clarify.ts

Required Intent Classes  
\- UNDERSTAND  
\- REFERENCE  
\- EVALUATE  
\- DECIDE  
\- PLAN  
\- BUILD  
\- DEBUG  
\- EXECUTE (restricted)

Rigor Scaling  
\- Light / Standard / Deep  
\- Risk-based escalation  
\- Determines:  
  \- Evidence requirements  
  \- Assumption tolerance  
  \- Output verbosity

Clarification Contract  
\- At most one clarifying question  
\- If ambiguity remains → proceed with explicit assumptions

Acceptance  
\- Deterministic classification  
\- Rigor impacts output structure  
\- Clarification behavior tested

\---

4\) Planner Layer (MISSING MIDDLE)

Purpose  
Explicit orchestration between intent and evaluators.

Files  
src/planner/plan.ts  
src/planner/builder.ts  
src/planner/executor.ts

Plan Steps  
\- VALIDATE\_INPUT  
\- APPLY\_GOVERNANCE  
\- BUILD\_PLAN  
\- SELECT\_EVALUATOR  
\- RUN\_EVALUATOR  
\- NORMALIZE\_OUTPUT  
\- ASSEMBLE\_RESPONSE  
\- LOG\_TRACE

Acceptance  
\- Trace shows step timings  
\- Failures stop execution cleanly  
\- Planner is deterministic

\---

5\) Evaluator System (SAFE EXTENSIBILITY)

Files  
src/basis/interfaces.ts  
src/basis/registry.ts  
src/basis/evaluators/\*

Evaluator Interface  
Each evaluator declares:  
\- id  
\- version  
\- supportedIntents  
\- requiredInputs  
\- riskLevel  
\- run(ctx)

Required Baseline Evaluators  
\- clarification\_evaluator  
\- structure\_evaluator  
\- decision\_evaluator  
\- planning\_evaluator  
\- build\_spec\_evaluator

Registry Rules  
\- Reject invalid or incompatible evaluators  
\- Version compatibility enforced  
\- Governance can disable evaluators

Acceptance  
\- Drop-in evaluator addition  
\- Registry tests exist  
\- Evaluator selection deterministic

\---

6\) API HARDENING (PRODUCTION-GRADE)

Files  
src/api/server.ts  
src/api/routes/v1.ts  
src/api/controllers/evaluate.ts  
src/api/middleware/requestId.ts  
src/api/middleware/validation.ts  
src/api/middleware/rateLimit.ts

Endpoints  
\- POST /v1/evaluate  
\- GET /v1/health  
\- GET /v1/version  
\- Optional: POST /v1/simulate (verbose trace)

Acceptance  
\- Request ID in every response  
\- Clean validation errors  
\- Works in Docker  
\- Supertest or integration tests exist

\---

7\) Observability & Audit (ENTERPRISE CREDIBILITY)

Files  
src/common/logging/logger.ts  
src/common/telemetry/trace.ts  
src/common/audit/audit.ts

Requirements  
\- Structured JSON logs  
\- Append-only audit log (file or sqlite)  
\- No secrets or raw PII

Acceptance  
\- Full run reconstructable from logs  
\- Audit entries versioned  
\- Trace included in responses (or referenceable)

\---

8\) Determinism & Replay (KEY DIFFERENTIATOR)

Files  
src/replay/record.ts  
src/replay/replay.ts

Replay Guarantees  
\- Same intent  
\- Same evaluator selection  
\- Same governance decisions  
\- Same trace structure

Acceptance  
\- Recorded run replays deterministically  
\- Non-deterministic evaluator outputs explicitly marked

\---

9\) TEST SUITE (PROOF IT’S REAL)

Files  
tests/e2e/evaluate.test.ts  
tests/governance/\*.test.ts  
tests/intent/\*.test.ts  
tests/replay/\*.test.ts  
tests/fixtures/\*.json

Required Tests  
\- Intent determinism  
\- Hard rule refusal  
\- Single clarification behavior  
\- Output contract validation  
\- Evaluator registry rejection  
\- Replay fidelity

\---

10\) DX, PACKAGING, & RELIABILITY

Files  
.env.example  
Dockerfile (verify)  
docker-compose.yml (if missing)  
README.md (update)

README Must Include  
\- Exact install commands  
\- Example curl request \+ response  
\- Replay example  
\- How to add an evaluator  
\- How to add a rule

\---

11\) BUILD ORDER (ENFORCED)

1\. Output contracts  
2\. Governance engine  
3\. Intent system  
4\. Planner  
5\. Evaluator registry  
6\. API hardening  
7\. Observability & audit  
8\. Replay  
9\. Tests  
10\. DX polish

\---

CLAUDE CODE — SINGLE EXECUTION PROMPT (MASTER)

You are Claude Code with full read/write access to this repository.

OBJECTIVE  
Complete the Vorion cognition kernel by implementing all missing production-grade components: output contracts, governance & authority, intent system upgrades, planner orchestration, evaluator registry hardening, API middleware, observability & audit, determinism & replay, comprehensive tests, and developer experience polish — fully aligned to the existing repo structure.

NON-NEGOTIABLE RULES  
1\) Extend existing code; do not rename or break modules.  
2\) Every response must conform to a strict VorionResponse or VorionErrorResponse.  
3\) Governance rules always run before evaluator execution.  
4\) Intent classification and evaluator selection must be deterministic.  
5\) At most one clarifying question is allowed.  
6\) Every decision includes assumptions, confidence, invalidity conditions, and trace.  
7\) Add tests for every subsystem you implement.

STEP 0 — RECON  
Map existing files under:  
\- src/api  
\- src/intent  
\- src/basis  
\- src/common  
\- src/configs  
\- tests  
\- docker  
Identify what exists vs missing.

STEP 1 — OUTPUT CONTRACT  
Implement standardized response, error, evidence, and trace contracts.

STEP 2 — GOVERNANCE ENGINE  
Implement rule hierarchy, enforcement, conflict resolution, and tracing.

STEP 3 — INTENT SYSTEM  
Implement taxonomy, deterministic classifier, rigor scaling, and clarification contract.

STEP 4 — PLANNER  
Implement plan builder and executor that orchestrates the full pipeline.

STEP 5 — EVALUATOR REGISTRY  
Standardize evaluator interface, registry validation, and baseline evaluators.

STEP 6 — API HARDENING  
Add middleware, controllers, routes, health/version endpoints.

STEP 7 — OBSERVABILITY & AUDIT  
Implement structured logging, trace capture, and append-only audit logging.

STEP 8 — DETERMINISM & REPLAY  
Implement run recording and deterministic replay.

STEP 9 — TEST SUITE  
Add unit, integration, and E2E tests validating behavior and contracts.

STEP 10 — DX & PACKAGING  
Verify Docker, add .env.example, update README with exact commands and examples.

FINAL CHECKS  
\- All tests pass.  
\- Docker build/run works.  
\- curl example returns valid VorionResponse.  
\- No undocumented env vars.  
\- No unhandled promise rejections.

EXECUTE NOW.