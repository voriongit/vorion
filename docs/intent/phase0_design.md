# Intent Phase 0 Design

## Objectives
- Replace the in-memory `IntentService` (`src/intent/index.ts`) with a persistent, schema-enforced service that can survive restarts and provide lifecycle telemetry.
- Deliver executable API contracts for `/intents` endpoints inside the Fastify server (`src/api/server.ts`) so BASIS/Trust/PROOF pipelines can rely on deterministic ingress behavior.
- Prepare clean migration artifacts (Drizzle) so platform/DBA teams can version and review structural changes before deploying to shared environments.

## Scope & Alignment
- **In-scope**: schema validation, persistence (Postgres via Drizzle), API wiring, request tracing, audit event storage.
- **Out-of-scope (Phase 1+)**: async queues, BASIS rule execution, ENFORCE integration, PROOF record sealing (refer to Claude plan for sequencing).
- **Consumers**: Fastify API, BASIS service (reads evaluation payloads later), Trust Engine (receives submission snapshots), PROOF (reads audit events to stitch evidence chain).

## Architecture Snapshot
```
Client ──► Fastify Route (/intents)
            │  (Zod validation, auth, requestId)
            ▼
        IntentController
            │  (maps DTO ↔ domain)
            ▼
        IntentService (DB-backed)
            │  (state machine, audit log)
            ▼
        Drizzle Repository ──► Postgres (intents + intent_events)
```

## Data Model
### `intents`
| Column        | Type            | Notes |
|---------------|-----------------|-------|
| `id`          | `uuid` PK       | Generated via `crypto.randomUUID()` | 
| `entity_id`   | `uuid`          | Foreign key to entities directory (future) |
| `tenant_id`   | `text`          | Required for multi-tenant isolation |
| `goal`        | `text`          | Text search enabled |
| `intent_type` | `text`          | Optional classification for routing |
| `status`      | `text` enum     | Must match `IntentStatus` union |
| `priority`    | `integer`       | 0 (default) higher = faster processing |
| `trust_snapshot` | `jsonb`      | Cached output from Trust Engine |
| `context`     | `jsonb`         | Arbitrary metadata; enforce size limit |
| `metadata`    | `jsonb`         | Client-specified tandem metadata |
| `dedupe_hash` | `text` unique   | Hash of entity+goal+context for idempotency |
| `created_at`  | `timestamptz`   | auto default now() |
| `updated_at`  | `timestamptz`   | auto default now(), updated trigger |

Indexes: `(tenant_id, created_at desc)` for listing, `dedupe_hash unique`, `gin(context)` for future search.

### `intent_events`
| Column       | Type          | Notes |
|--------------|---------------|-------|
| `id`         | `uuid` PK     | |
| `intent_id`  | `uuid` FK     | references `intents.id` |
| `event_type` | `text`        | e.g. `intent.submitted`, `intent.status.changed` |
| `payload`    | `jsonb`       | structured detail (previous/new status, actor) |
| `occurred_at`| `timestamptz` | default now() |

Indexes: `(intent_id, occurred_at)`, `(event_type)`.

## API Contracts (v1)
### POST `/api/v1/intents`
- **Auth**: JWT (`@fastify/jwt`) with tenant claims.
- **Request Body** (`IntentSubmissionSchema`):
```json
{
  "entityId": "uuid",
  "goal": "string <= 1024 chars",
  "context": {"any": "json", "max": 64kb},
  "metadata": {"optional": true},
  "intentType": "optional string",
  "priority": 0-9,
  "idempotencyKey": "optional client-specified key"
}
```
- **Responses**:
  * `202 Accepted` + Intent resource (status `pending`).
  * `409 Conflict` if dedupe/idempotency check hits existing intent.
  * `422` validation errors with Zod issue list.

### GET `/api/v1/intents/:id`
- Returns canonical Intent resource with embedded `events` array (Phase 0 limited to last 10 events).
- `404` if tenant does not own intent.

### GET `/api/v1/intents`
- Query params: `entityId`, `status`, `cursor`, `limit` (≤100).
- Returns paginated list + next cursor for client polling.

### Intent Resource Shape
```json
{
  "id": "uuid",
  "entityId": "uuid",
  "tenantId": "uuid",
  "goal": "string",
  "intentType": "string|null",
  "status": "pending|evaluating|...",
  "priority": 0,
  "context": {...},
  "metadata": {...},
  "trustSnapshot": {...},
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

## Migration Plan
1. **Create Schema Definitions**: add Drizzle table builders (`src/intent/schema.ts`) defining `intents` and `intent_events` with enums derived from `IntentStatus`.
2. **Generate Migration**: use `drizzle-kit` to emit SQL into `drizzle/migrations/0001_intent_init.sql`.
3. **Apply Locally**: run `npm run db:migrate` (uses `scripts/migrate.ts`) to validate structure; add seed fixtures via `scripts/seed.ts` if needed for testing.
4. **Backfill Plan**: no legacy data; future migrations will include dual-write period instructions.
5. **Rollout**: require DBA sign-off; add migration to release checklist.

## Integration Touchpoints
- **Trust Engine**: `IntentService.submit` will optionally call `trustEngine.getScore(entityId)` and save snapshot; this requires non-blocking fallback when trust record absent.
- **BASIS**: no runtime dependency in Phase 0, but event log must capture `intent.submitted` for Phase 1 queue listeners.
- **PROOF**: `intent_events` table acts as pre-proof ledger; PROOF service can poll by `intent_id`.

## Risks & Mitigations
- **Schema Drift**: single source in Drizzle + `IntentStatus` union ensures TS + DB alignment; add tests asserting enum parity.
- **Large Context Payloads**: enforce size caps (Zod + DB constraint) and reject >64KB requests.
- **Multi-tenant Leakage**: all queries must scope by tenant_id extracted from JWT; add integration tests for isolation.

## Validation Strategy
- Unit tests for DTO schema, repositories, and state transitions.
- API contract tests (Vitest + Fastify inject) verifying responses and errors.
- Migration smoke test wired into `npm run verify-setup`.

## Open Questions
1. Should trust snapshot be mandatory or best-effort (fallback to null) when Trust Engine offline?
2. What tenant identifier format is canonical (UUID vs slug) in auth tokens?
3. Do compliance teams require “reason” fields during submission (e.g., policy id) or is metadata enough?
4. Maximum retention for `intent_events` before PROOF ingestion takes over?

---

## Phase 1 Preview – Orchestration & Decoupling
- **Queues & Workers**: BullMQ queues (`intent:intake`, `intent:evaluate`, `intent:decision`) with Redis Streams mirror for observability. Job payload: `{ intentId, tenantId, trustSnapshotVersion }`. Scheduler + retries with exponential backoff.
- **State Machine**: Implement deterministic transitions with guards (allowed edges: pending→evaluating, evaluating→approved|denied|escalated, escalated→executing|denied, executing→completed|failed). Persist transitions + timestamps to `intent_events`.
- **Trust Snapshotting**: On intake worker, call Trust Engine, attach `trust_snapshot` and `trust_level`, record `intent.trustSnapshot` column. Fallback to cached record if Trust Engine offline, mark event `intent.trust.degraded`.
- **BASIS Integration**: Evaluation worker fetches constraints per namespace, invokes BASIS evaluator (timeout from config). Persist outputs in `intent_evaluations` table (intent_id, constraint_id, action, duration, payload) for PROOF/analytics.
- **ENFORCE Hook**: Decision worker posts evaluation result + trust context to ENFORCE. Update intent status from response and emit events (`intent.decision.allow`, `intent.decision.deny`, etc.).
- **Observability**: Add metrics for queue depth, processing latency, failure counts; propagate Fastify requestId into job metadata and logger.

### Status (2026-01-13)
- BullMQ queues and schedulers are live with intake → evaluate → decision flow (`src/intent/queues.ts`).
- Trust metadata persisted on intents plus `intent_evaluations` table records each stage.
- BASIS evaluator + ENFORCE decision hooks run inside workers and transition statuses automatically.
- API returns events + evaluations for a transparent audit trail.

## Phase 2 Preview – Policy-Aware Autonomy
- **Namespace Routing**: Introduce config mapping `intentType`→`basisNamespace` (`configs/rules/*.json`). Validate submission includes `intentType`; fallback classification plugin for missing values.
- **Rate Limiting & Priority**: Use BullMQ priorities for escalations/critical intents; per-tenant concurrency caps loaded from config/service; store `priority` in DB.
- **Dedupe & Idempotency**: Redis key `intent:dedupe:{tenant}:{hash}` with TTL to prevent replay storms. Provide `idempotencyKey` in API; respond with 409 when duplicate is in-flight.
- **Trust Gates**: Policies define minimum trust per intent type; pre-BASIS filter denies/escalates when trust below threshold, raising `TrustInsufficientError`. Provide override flags for administrators.
- **Security & Privacy**: Encrypt sensitive context fields using envelope key (`intent_sensitive_context`). Build GDPR delete path to tombstone context while preserving audit metadata.
- **Admin & Replay Tools**: Add endpoints to reprocess intents, inspect events, and force transitions (RBAC gated). Build CLI for SRE to replay stuck intents.

### Status (2026-01-13)
- Namespace routing + defaults now load from `.env` (see `VORION_INTENT_NAMESPACE_ROUTING`) and metadata is propagated through queue jobs.
- Tenant-specific concurrent-intent caps enforced at submission time prevent overloads.
- Redis dedupe locks (`intent:dedupe:{tenant}:{hash}`) with configurable TTL protect against replay storms.
- Sensitive context/metadata paths are redacted before persistence using the configurable list.

## Phase 3 Preview – Experience & Compliance Layer
- **SDK/Webhooks**: Ship TypeScript/Python SDKs for submission + polling; implement webhook delivery with signature + retry policy. Provide search/pagination endpoints (`/intents/search`) using cursor-based pagination and JSON path filters.
- **Dashboards**: Grafana dashboards for throughput, SLA attainment, escalation counts, stuck intents. Integrate tracing (OpenTelemetry) to visualize pipeline.
- **Compliance Automation**: Auto-forward completed intents to PROOF for immutable chaining; add export endpoints for auditors (`/intents/:id/proof`). Embed SLA monitors that alert when >0.5% intents stuck >5m.
- **Human-in-the-Loop**: Escalation queue integrates Slack/ServiceNow via webhook when ENFORCE returns `escalate`. Provide API for human reviewer to respond, updating intent status and events.
- **Resilience**: Chaos drills, snapshot/replay scripts, multi-region replication for Postgres/Redis. Add disaster recovery runbooks referencing this spec.
---
Prepared for review with BASIS & Trust teams.
