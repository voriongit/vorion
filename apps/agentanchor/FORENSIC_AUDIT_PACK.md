# AgentAnchor Forensic Audit Pack

**Generated:** 2026-01-05
**Auditor:** Claude Opus 4.5 (Automated)
**Repository:** C:\S_A\agentanchorai
**Git Status:** NOT A GIT REPO (no .git folder)
**Last Updated:** 2026-01-05 (Post-Remediation)

---

## Remediation Status

| Issue | Severity | Status | Fix Applied |
|-------|----------|--------|-------------|
| Vercel OIDC token exposed | 🔴 HIGH | ✅ **FIXED** | Deleted `.env.vercel`, added to `.gitignore` |
| CORS wildcard origins | 🟡 MEDIUM | ✅ **FIXED** | Environment-aware defaults in `lib/config.ts` |
| Cryptographic audit in-memory | 🟡 MEDIUM | ✅ **FIXED** | Added persistence adapter + DB migration |
| Rate limit bypass | 🟢 LOW | ✅ **FIXED** | Added in-memory fallback + fail-closed behavior |

---

## Table of Contents

1. [Section 0 — Environment & Repo Identity](#section-0--environment--repo-identity)
2. [Section 1 — Full Project Map](#section-1--full-project-map)
3. [Section 2 — Build & Runtime Entrypoints](#section-2--build--runtime-entrypoints)
4. [Section 3 — Agent/Bot Core](#section-3--agentbot-core)
5. [Section 4 — Database & Auth Truth](#section-4--database--auth-truth)
6. [Section 5 — Security Boundaries & Threat Surface](#section-5--security-boundaries--threat-surface)
7. [Section 6 — Observability & Audit Logging](#section-6--observability--audit-logging)
8. [Section 7 — Productization](#section-7--productization)
9. [Section 8 — Documentation Truth](#section-8--documentation-truth)
10. [Section 9 — Final Summary](#section-9--final-summary)

---

## Section 0 — Environment & Repo Identity

| Item | Value |
|------|-------|
| Working Directory | `C:\S_A\agentanchorai` |
| Git Commit | NOT A GIT REPO |
| Git Remotes | NO REMOTES |
| Git Status | (no .git folder) |
| Node.js | v22.17.1 |
| npm | 10.9.2 |
| pnpm | NOT INSTALLED |
| yarn | NOT INSTALLED |

---

## Section 1 — Full Project Map

### Top-Level Modules

| Folder | Purpose (Inferred from Files) |
|--------|-------------------------------|
| `.bmad/` | BMAD methodology agents/workflows (YAML configs, chatmodes) |
| `.bmad-core/` | Core BMAD configuration (core-config.yaml) |
| `.claude/` | Claude Code MCP settings |
| `.gemini/` | Gemini commands (TOML) |
| `.github/` | GitHub workflows + chatmodes |
| `.storybook/` | Storybook UI component stories |
| `.vercel/` | Vercel deployment config |
| `.vscode/` | VS Code settings |
| `app/` | **Next.js App Router** - pages, layouts, API routes |
| `components/` | React UI components (agents, academy, council, etc.) |
| `data/` | Static data files |
| `docs/` | Project documentation |
| `drizzle/` | Drizzle ORM migrations |
| `hooks/` | React custom hooks |
| `lib/` | Core library code (services, utilities) |
| `mcp/` | MCP (Model Context Protocol) configs |
| `public/` | Static assets |
| `scripts/` | Build/deploy scripts |
| `stories/` | Storybook story files |
| `supabase/` | Supabase migrations/schema |
| `tests/` | Test files |
| **`trustbot/`** | **CRITICAL: Standalone agent runtime** - orchestration, trust engine, HITL |
| `types/` | TypeScript type definitions |

---

## Section 2 — Build & Runtime Entrypoints

### package.json (Key Dependencies)

```json
{
  "name": "agentanchor",
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@supabase/supabase-js": "latest",
    "@supabase/auth-helpers-nextjs": "latest",
    "next": "14.x",
    "react": "18.x",
    "drizzle-orm": "latest",
    "pusher": "latest",
    "pusher-js": "latest",
    "pino": "latest",
    "@sentry/nextjs": "latest",
    "zod": "latest"
  }
}
```

### next.config.js

- Standard Next.js 14 configuration
- Image domains configured for Supabase storage
- Sentry integration enabled

### middleware.ts

**Key Security Headers Applied:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- CSP with connect-src to supabase.co and anthropic.com
- HSTS in production

**Protected Routes:**
- `/dashboard`, `/bots`, `/teams`, `/chat`, `/orchestrator`, `/mcp`, `/settings`, `/collaborate`, `/conversations`, `/onboarding`

### Environment Variables (.env.example)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Neon PostgreSQL)
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Anthropic API
ANTHROPIC_API_KEY=

# Pusher (Realtime)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Sentry
SENTRY_DSN=

# Feature Flags
FEATURE_MCP_SERVERS=
FEATURE_TEAM_CHAT=
FEATURE_PUBLIC_BOTS=
FEATURE_API_KEYS=
```

### Security Finding

> **✅ REMEDIATED:** `.env.vercel` contained an exposed Vercel OIDC JWT token.
> - **Action Taken:** File deleted, added to `.gitignore`
> - **Manual Action Required:** Rotate token on Vercel dashboard
> - Original details (for rotation reference):
>   - Variable: `VERCEL_OIDC_TOKEN`
>   - Owner: `baiq`
>   - Project: `agentanchorai`
>   - Project ID: `prj_3MBypX0Mvl4Guytyi0zYaPOD922q`

---

## Section 3 — Agent/Bot Core

### Core Engine Files

| Component | Path | Description |
|-----------|------|-------------|
| **TrustEngine** | `trustbot/src/core/TrustEngine.ts` | Trust score calculation engine |
| **Orchestrator** | `trustbot/src/core/Orchestrator.ts` | Agent workflow orchestration |
| **HITLGateway** | `trustbot/src/core/HITLGateway.ts` | Human-in-the-loop decision gateway |
| **AIProvider** | `trustbot/src/core/AIProvider.ts` | AI model abstraction layer |
| **CryptographicAuditLogger** | `trustbot/src/core/CryptographicAuditLogger.ts` | SHA-256 hash-chained audit log |
| **SecurityLayer** | `trustbot/src/core/SecurityLayer.ts` | Security validation |

### Chat API Route

**Path:** `app/api/chat/route.ts`

**Key Features:**
- Streaming responses via SSE
- Anthropic Claude integration
- MCP tool integration (MAX_TOOL_ITERATIONS = 10)
- Rate limiting via Upstash Redis
- Circuit breaker pattern for Anthropic API
- Token usage tracking and cost calculation

**Authentication Flow:**
```typescript
// Line 49-56
const supabase = createRouteHandlerClient({ cookies })
const { data: { session } } = await supabase.auth.getSession()

if (!session) {
  throw new AuthError('Authentication required for chat')
}
```

### AI Provider Integration

**Models Supported:**
- Claude 3.5 Sonnet (default: `claude-3-5-sonnet-20241022`)
- Claude Opus
- Claude Haiku

---

## Section 4 — Database & Auth Truth

### Supabase Migrations

| Migration | Purpose |
|-----------|---------|
| `20241209_compliance_tables.sql` | Compliance tracking |
| `20241212_agent_birth_certificates.sql` | Agent lifecycle |
| `20241214_testing_studio.sql` | Testing infrastructure |
| `20241214_trust_bridge.sql` | External trust integration |
| `20250124000000_bot_trust_infrastructure.sql` | Core bot trust system |
| `20250129000000_agents_evolution.sql` | Agent evolution tracking |
| `20250201000000_council_precedents.sql` | Council decision history |
| `20250202000000_escalation_queue.sql` | HITL escalation |
| `20250203000000_trust_decay_probation.sql` | Trust degradation |
| `20250204000000_observer_events.sql` | Observer layer events |
| `20250206000000_agent_memory_system.sql` | Agent memory |
| `20250206000000_truth_chain.sql` | Immutable audit chain |
| `20250207000000_marketplace.sql` | Marketplace infrastructure |
| `20250211000000_hitl_fade_logic.sql` | HITL automation |
| `20250212000000_clone_enterprise.sql` | Clone/enterprise features |
| `20251212300000_a3i_os_v2_trust_edition.sql` | Trust OS v2 |

### Data Model Index

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, roles (trainer/consumer), subscription tiers |
| `agents` | AI agents with trust scores (0-1000), status, config |
| `trust_history` | Audit trail of trust score changes |
| `council_decisions` | Governance decisions (transparent/public) |
| `truth_chain` | Immutable audit log (append-only, no update/delete) |
| `observer_events` | System event log (append-only) |
| `marketplace_listings` | Agent listings for sale |
| `acquisitions` | Agent purchases/subscriptions |
| `academy_progress` | Training progress tracking |
| `payout_accounts` | Stripe Connect accounts |
| `payouts` | Trainer payouts |
| `usage_billing` | Usage-based billing records |
| `user_wallets` | Anchor Credits balances |
| `credit_transactions` | Credit transaction history |

### Drizzle Schema

**Agents Schema (`lib/db/schema/agents.ts`):**
```typescript
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt'),
  model: text('model').default('claude-3-5-sonnet-20241022').notNull(),
  status: agentStatusEnum('status').default('draft').notNull(),
  trustScore: integer('trust_score').default(100).notNull(), // 0-1000
  config: jsonb('config'),
  metadata: jsonb('metadata'),
  totalInteractions: integer('total_interactions').default(0).notNull(),
  successfulInteractions: integer('successful_interactions').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### Row Level Security (RLS)

**Path:** `drizzle/0002_rls_policies.sql`

| Table | Policy |
|-------|--------|
| `profiles` | Read all, update own only |
| `agents` | Owner-only modify, active publicly visible |
| `trust_history` | Read own agents, system insert only |
| `council_decisions` | Public read, system insert only |
| `truth_chain` | **Public read, system insert, NO UPDATE/DELETE** |
| `observer_events` | **Owner read, system insert, NO UPDATE/DELETE** |
| `marketplace_listings` | Active public, seller manages own |
| `acquisitions` | Consumer/trainer read own |
| `academy_progress` | Owner agents only |

---

## Section 5 — Security Boundaries & Threat Surface

### Authentication

| Method | Implementation |
|--------|----------------|
| Supabase Auth | Primary auth provider |
| Google OAuth | Optional provider |
| Session Cookies | httpOnly, secure in production |

### Route Protection

**Public Routes (Unauthenticated):**
- `/` - Landing page
- `/auth/login`, `/auth/signup` - Authentication
- `/api/health` - Health check

**Protected Routes (Authenticated):**
- `/dashboard`, `/bots`, `/teams`, `/chat`
- `/orchestrator`, `/mcp`, `/settings`
- `/collaborate`, `/conversations`, `/onboarding`

### Security Headers

```typescript
// middleware.ts:52-91
headers.set('X-Frame-Options', 'DENY')
headers.set('X-Content-Type-Options', 'nosniff')
headers.set('X-XSS-Protection', '1; mode=block')
headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
// CSP configured for supabase.co, anthropic.com
// HSTS in production
```

### XSS/Injection Scan Results

**No dangerous patterns found in user code:**
- `dangerouslySetInnerHTML` - Not used in application code
- `eval()` - Not used in application code
- `Function()` - Not used in application code

(Matches found only in `node_modules/@types/node` type definitions)

### External Integrations

| Service | Purpose | Config Location |
|---------|---------|-----------------|
| Anthropic Claude | AI inference | `lib/config.ts:47-53` |
| Supabase | Auth + Database | `lib/config.ts:22-27` |
| Pusher | Real-time events | `lib/config.ts:37-44` |
| Upstash Redis | Rate limiting | `lib/config.ts:55-64` |
| Sentry | Error monitoring | `lib/config.ts:67-75` |
| Stripe Connect | Payments (schema only) | `lib/db/schema/payments.ts` |

### Threat Surface Inventory

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARIES                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INTERNET                                                    │
│     │                                                        │
│     ▼                                                        │
│  ┌─────────────────────────────────────────┐                │
│  │  Vercel Edge (middleware.ts)            │                │
│  │  - Security headers                      │                │
│  │  - Route protection                      │                │
│  │  - Session validation                    │                │
│  └─────────────────┬───────────────────────┘                │
│                    │                                         │
│                    ▼                                         │
│  ┌─────────────────────────────────────────┐                │
│  │  Next.js API Routes                      │                │
│  │  - Zod validation                        │                │
│  │  - Rate limiting                         │                │
│  │  - Circuit breaker                       │                │
│  └─────────────────┬───────────────────────┘                │
│                    │                                         │
│         ┌─────────┼─────────┐                               │
│         ▼         ▼         ▼                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ Supabase │ │ Anthropic│ │  Pusher  │                    │
│  │   (RLS)  │ │  Claude  │ │          │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Section 6 — Observability & Audit Logging

### Logging Infrastructure

**Path:** `lib/logger.ts`

**Logger:** Pino (structured JSON logging)

**Log Levels:** trace, debug, info, warn, error, fatal

**Log Types:**
- `request` - Incoming requests
- `response` - Outgoing responses
- `error` - Error details with stack traces
- `api_call` - External API calls
- `query` - Database queries
- `audit` - Sensitive operations
- `performance` - Performance metrics

### Sentry Integration

**Path:** `sentry.client.config.ts`

**Features:**
- Error tracking with context
- Session replay (masked text, blocked media)
- Performance tracing (10% sample rate)
- Filtered errors (ResizeObserver, network errors)

### Cryptographic Audit Logger

**Path:** `trustbot/src/core/CryptographicAuditLogger.ts`

**Features:**
- SHA-256 hash chain (blockchain-style)
- Sequence-numbered entries
- Genesis hash: `0000000000000000000000000000000000000000000000000000000000000000`
- Chain verification
- Tamper detection
- Compliance export (JSON/CSV)

**Entry Structure:**
```typescript
interface CryptographicAuditEntry {
  id: string;
  sequenceNumber: number;
  timestamp: Date;
  action: AuditAction;
  actor: { type: 'HUMAN' | 'AGENT' | 'SYSTEM'; id: string; tier?: AgentTier };
  target?: { type: 'AGENT' | 'ENTRY' | 'SYSTEM'; id: string };
  details: Record<string, unknown>;
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  reason?: string;
  previousHash: string;
  entryHash: string;
  merkleRoot?: string;
}
```

**✅ REMEDIATED - Persistence Support Added:**

| File | Purpose |
|------|---------|
| `trustbot/src/core/types/audit-persistence.ts` | Persistence adapter interface |
| `trustbot/src/core/adapters/SupabaseAuditAdapter.ts` | Supabase/PostgreSQL adapter |
| `supabase/migrations/20260105000000_crypto_audit_log.sql` | Database migration |
| `lib/db/schema/crypto-audit-log.ts` | Drizzle schema |

**Usage:**
```typescript
// Default (in-memory, backward compatible)
import { cryptographicAuditLogger } from '@/trustbot/src/core/CryptographicAuditLogger';

// With database persistence
import { createPersistentAuditLogger } from '@/trustbot/src/core/CryptographicAuditLogger';
import { SupabaseAuditAdapter } from '@/trustbot/src/core/adapters';

const adapter = new SupabaseAuditAdapter({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});
const logger = createPersistentAuditLogger(adapter);
await logger.initialize();
```

---

## Section 7 — Productization

### Marketplace Model

**Path:** `lib/db/schema/marketplace.ts`

**Acquisition Types:**
| Type | Description |
|------|-------------|
| `commission` | Pay per use |
| `clone` | One-time purchase, own a copy |
| `enterprise_lock` | Exclusive enterprise license |

**Listing Features:**
- Commission rate (per-use)
- Clone price (one-time)
- Enterprise price
- Max clones limit
- Tags and categories
- View/acquisition counts
- Average rating

### Payments Infrastructure

**Path:** `lib/db/schema/payments.ts`

**Stripe Connect:**
- `stripeAccountId` - Connected account
- `stripeAccountStatus` - Onboarding status
- `stripeOnboardingComplete` - Boolean flag

**Payout Options:**
- Bank transfer
- Stripe
- Crypto (future)

**Payout Schedules:**
- Weekly
- Monthly
- Threshold-based

### Anchor Credits (Internal Currency)

**Path:** `lib/credits/wallet-service.ts`

**Features:**
- 500 AC signup bonus
- Atomic debit/credit operations (via Supabase RPC)
- Transaction history
- Balance checks

**Revenue Split:**
```typescript
// Line 177
const trainerShare = Math.floor(saleAmount * 0.70)  // 70% trainer
const platformShare = Math.floor(saleAmount * 0.20) // 20% platform
// Validator share (10%) stays in platform pool
```

### Subscription Tiers

**Path:** `lib/db/schema/users.ts:9`

| Tier | Description |
|------|-------------|
| `free` | Default tier |
| `pro` | Professional features |
| `enterprise` | Enterprise features |

### User Roles

| Role | Description |
|------|-------------|
| `trainer` | Creates and sells agents |
| `consumer` | Acquires and uses agents |
| `both` | Hybrid role |

---

## Section 8 — Documentation Truth

### Claims vs Code Pointers

| Claim (from Docs) | Code Path(s) | Status |
|-------------------|--------------|--------|
| Trust Score 0-1000 | `lib/db/schema/agents.ts:40` | ✅ Implemented |
| Cryptographic audit log / hash chain | `trustbot/src/core/CryptographicAuditLogger.ts` | ✅ Implemented |
| 5-level graduated autonomy | `BOT_TRUST_README.md` | ⚠️ Schema only |
| Council of Nine validators | `docs/architecture.md:29` | ❌ Design only |
| HITL Gateway | `trustbot/src/core/HITLGateway.ts` | ✅ Implemented |
| Separation of Powers / Observer Isolation | `drizzle/0002_rls_policies.sql` | ✅ RLS enforced |
| Truth Chain (immutable) | `lib/db/schema/truth-chain.ts` | ✅ No UPDATE/DELETE |
| Marketplace with commission/clone/enterprise | `lib/db/schema/marketplace.ts` | ✅ Implemented |
| Stripe Connect payouts | `lib/db/schema/payments.ts:33` | ⚠️ Schema only |
| MCP Tool Integration | `app/api/chat/route.ts:24` | ✅ Implemented |
| Anchor Credits (internal currency) | `lib/credits/wallet-service.ts` | ✅ Implemented |
| 70/20/10 revenue split | `lib/credits/wallet-service.ts:177` | ✅ Implemented |
| Supabase + Neon PostgreSQL | `lib/config.ts:22-35` | ✅ Configured |
| Real-time updates (Pusher) | `lib/config.ts:37-44` | ✅ Configured |
| Sentry monitoring | `sentry.client.config.ts` | ✅ Configured |
| Rate limiting (Upstash Redis) | `lib/config.ts:55-64` | ✅ Configured |

---

## Section 9 — Final Summary

### Tech Stack (Verified via package.json)

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18, Tailwind CSS, shadcn/ui |
| Auth | Supabase Auth (+ optional Clerk) |
| Database | PostgreSQL via Supabase/Neon + Drizzle ORM |
| AI | Anthropic Claude (@anthropic-ai/sdk) |
| Real-time | Pusher |
| Cache | Upstash Redis |
| Monitoring | Sentry, Pino logger |
| Testing | Vitest, Playwright |

### Agent Runtime Location

| Component | Path |
|-----------|------|
| **TrustEngine** | `trustbot/src/core/TrustEngine.ts` |
| **Orchestrator** | `trustbot/src/core/Orchestrator.ts` |
| **HITLGateway** | `trustbot/src/core/HITLGateway.ts` |
| **AIProvider** | `trustbot/src/core/AIProvider.ts` |
| **CryptographicAuditLogger** | `trustbot/src/core/CryptographicAuditLogger.ts` |
| **Chat API (streaming)** | `app/api/chat/route.ts` |

### Trust/Governance Computation

| Component | Path | Description |
|-----------|------|-------------|
| Trust Score | `lib/db/schema/agents.ts:40` | Integer 0-1000, stored per agent |
| Trust History | `lib/db/schema/agents.ts:72-95` | Audit trail of score changes |
| Audit Logger | `trustbot/src/core/CryptographicAuditLogger.ts` | SHA-256 hash chain |
| RLS Policies | `drizzle/0002_rls_policies.sql` | Append-only for truth_chain/observer |

### Auth Flow

| Path | Description |
|------|-------------|
| `middleware.ts` | Session validation, security headers, route protection |
| `lib/supabase/server.ts` | Supabase client creation |
| `app/api/chat/route.ts:49-56` | Session check before API access |

### Data Storage & Protection

| Table | Protection Mechanism |
|-------|---------------------|
| `profiles` | RLS: read all, update own only |
| `agents` | RLS: owner-only modify, active publicly visible |
| `truth_chain` | RLS: **append-only (no UPDATE/DELETE)** |
| `observer_events` | RLS: **append-only (no UPDATE/DELETE)** |
| `marketplace_listings` | RLS: active public, seller manages own |

### Monetization Hooks

| Hook | Path |
|------|------|
| Marketplace Schema | `lib/db/schema/marketplace.ts` |
| Payments Schema (Stripe Connect) | `lib/db/schema/payments.ts` |
| Wallet Service (Anchor Credits) | `lib/credits/wallet-service.ts` |
| Revenue Split (70/20/10) | `lib/credits/wallet-service.ts:177` |

---

## Top 10 Audit Attention Points

| # | Risk/Unknown | File Path | Severity | Status |
|---|--------------|-----------|----------|--------|
| 1 | ~~Vercel OIDC token exposed~~ | `.env.vercel` | 🔴 HIGH | ✅ **FIXED** |
| 2 | **No git repo** - cannot verify code integrity/history | (root) | 🟡 MEDIUM | ⏳ Pending |
| 3 | **Council of Nine validators** - documented but no runtime implementation | `docs/architecture.md:29` | 🔵 INFO | 📋 Roadmap |
| 4 | **Graduated autonomy (5 levels)** - documented but autonomous execution not wired | `BOT_TRUST_README.md` | 🔵 INFO | 📋 Roadmap |
| 5 | ~~CORS origins = ['*'] by default~~ | `lib/config.ts` | 🟡 MEDIUM | ✅ **FIXED** |
| 6 | **Service role key** in config required - ensure never exposed client-side | `lib/config.ts:26` | 🟡 MEDIUM | ⏳ Pending |
| 7 | ~~Rate limit bypass when Redis not configured~~ | `lib/rate-limit.ts` | 🟢 LOW | ✅ **FIXED** |
| 8 | **Stripe Connect** schema exists but no webhook handlers found | `lib/db/schema/payments.ts` | 🔵 INFO | 📋 Roadmap |
| 9 | **MCP Runtime** initialized per-request (potential resource leak if not cleaned) | `app/api/chat/route.ts:106-123` | 🟢 LOW | ⏳ Pending |
| 10 | ~~Cryptographic audit uses in-memory storage~~ | `trustbot/src/core/CryptographicAuditLogger.ts` | 🟡 MEDIUM | ✅ **FIXED** |

---

## Remediation Details

### ✅ Fixed Issues

#### 1. Vercel OIDC Token (HIGH → FIXED)
- **File deleted:** `.env.vercel`
- **Gitignore updated:** Added `.env.vercel` to prevent future commits
- **Manual action required:** Rotate token on Vercel dashboard

#### 5. CORS Wildcard Origins (MEDIUM → FIXED)
- **File modified:** `lib/config.ts`
- **New behavior:**
  - Development: `localhost:3000`, `localhost:3001`, `127.0.0.1:3000`
  - Production/Staging: `agentanchorai.com` domains or derived from `NEXT_PUBLIC_APP_URL`
  - Never defaults to `*` in production

#### 7. Rate Limit Bypass (LOW → FIXED)
- **File modified:** `lib/rate-limit.ts`
- **New behavior:**
  - Added `InMemoryRateLimiter` fallback when Redis unavailable
  - Auth endpoints: Fail closed on error (blocks requests)
  - Other endpoints: Conservative 10 req/min fallback limit
  - Logs warning when using in-memory fallback

#### 10. Cryptographic Audit Persistence (MEDIUM → FIXED)
- **New files:**
  - `trustbot/src/core/types/audit-persistence.ts` - Adapter interface
  - `trustbot/src/core/adapters/SupabaseAuditAdapter.ts` - DB adapter
  - `supabase/migrations/20260105000000_crypto_audit_log.sql` - Migration
  - `lib/db/schema/crypto-audit-log.ts` - Drizzle schema
- **Modified:** `trustbot/src/core/CryptographicAuditLogger.ts`
- **New behavior:** Supports pluggable persistence adapters (in-memory default, Supabase optional)

---

## Recommended Actions

### Immediate (High Priority)

1. ~~Remove/rotate exposed Vercel OIDC token~~ ✅ **DONE** (Manual: rotate on Vercel)
2. **Initialize git repository** for code versioning and integrity
3. ~~Restrict CORS origins from ['*'] to specific domains~~ ✅ **DONE**

### Short-Term (Medium Priority)

4. ~~Persist cryptographic audit logs to database~~ ✅ **DONE** (Run migration)
5. **Ensure service role key** is only used server-side
6. **Implement Stripe webhooks** for payment processing

### Long-Term (Roadmap)

7. **Implement Council of Nine** validator agents
8. **Wire up graduated autonomy** to actual execution flow
9. ~~Add Redis requirement or graceful degradation for rate limiting~~ ✅ **DONE**

---

## Post-Remediation Checklist

- [ ] Rotate Vercel OIDC token on dashboard
- [ ] Run database migration: `npx supabase db push`
- [ ] Initialize git repository: `git init`
- [ ] Test rate limiting fallback behavior
- [ ] Verify CORS headers in production

---

**END OF FORENSIC AUDIT PACK**

---

*This document was generated automatically by Claude Opus 4.5 forensic audit task.*
