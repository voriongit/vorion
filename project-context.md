---
project_name: 'Vorion Platform'
user_name: 'Racas'
date: '2026-01-17'
sections_completed: ['overview', 'technology_stack', 'workspace_structure', 'naming_conventions', 'critical_rules']
status: 'complete'
rule_count: 35
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns for working in the Vorion Platform monorepo. Focus on unobvious details that agents might miss._

---

## Project Overview

**Vorion** is an AI Governance Platform providing trust scoring, policy enforcement, and audit trails for AI agents. The monorepo contains:

- **BASIS** - Open governance standard (CC BY 4.0)
- **AgentAnchor** - B2B marketplace for governed AI agents
- **Cognigate** - Developer runtime for constrained AI execution
- **Omniscience** - Learning platform for AI governance
- **TrustBot/Aurais** - Governance demonstration platform

### Live Deployments

| Site | URL | Source |
|------|-----|--------|
| AgentAnchor App | app.agentanchorai.com | apps/agentanchor |
| AgentAnchor WWW | agentanchorai.com | apps/agentanchor-www |
| BASIS Docs | basis.vorion.org | docs/basis-docs |
| Vorion Corporate | vorion.org | vorion-www |
| Omniscience | learn.vorion.org | omniscience |

---

## Technology Stack & Versions

### Core Technologies

| Technology | Version | Notes |
|------------|---------|-------|
| TypeScript | ^5.x | Strict mode enabled across all packages |
| Node.js | 20+ | ES2022 target |
| React | 18-19 | Functional components only |
| Next.js | 14-16 | App Router preferred |
| Tailwind CSS | 3-4 | Utility-first styling |
| Turborepo | Latest | Monorepo orchestration |

### Backend Technologies

| Technology | Version | Notes |
|------------|---------|-------|
| Fastify | 4-5 | API framework (src/) |
| Hono | ^4.x | Lightweight HTTP (packages/) |
| Drizzle ORM | Latest | Type-safe database |
| Zod | Latest | Schema validation everywhere |

### Databases

| Service | Usage |
|---------|-------|
| Neon PostgreSQL | Primary database (serverless) |
| Supabase | Auth + Realtime + PostgREST |
| Redis (Upstash) | Caching + Rate limiting |

### AI Integration

| Provider | Usage |
|----------|-------|
| Anthropic Claude | Primary AI (agent building, governance) |
| OpenAI | Fallback + Whisper (voice) |

---

## Workspace Structure

### Turborepo Workspaces

```
C:\axiom\
├── apps/                    # Frontend applications
│   ├── agentanchor/         # B2B platform (Next.js 14)
│   └── agentanchor-www/     # Marketing site (Next.js 16)
│
├── packages/                # Shared libraries
│   ├── atsf-core/           # Trust scoring SDK (@vorion/atsf-core)
│   ├── contracts/           # Shared schemas (@vorion/contracts)
│   ├── a3i/                 # AI utilities (@vorion/a3i)
│   └── orion/               # Proof plane (@vorion/orion)
│
├── basis-core/              # BASIS open standard
│   └── specs/               # 9 specification documents
│
├── trustbot/                # Governance demo platform
│   └── docs/                # Comprehensive architecture docs
│
├── cognigate-api/           # Constrained execution runtime
├── omniscience/             # Learning platform
├── omniscience-docs/        # Docusaurus docs
├── vorion-www/              # Corporate website
│
├── src/                     # Core kernel (shared implementation)
│   ├── api/                 # Fastify API server
│   ├── basis/               # Rule engine
│   ├── cognigate/           # Execution gateway
│   ├── enforce/             # Policy decisions
│   ├── intent/              # Intent parsing
│   ├── proof/               # Evidence chain
│   └── trust-engine/        # Trust scoring
│
├── _bmad/                   # BMAD methodology framework (v6.0-alpha.22)
├── _bmad-output/            # Generated planning artifacts
└── docs/                    # Documentation hub
```

### Package Dependencies

```
@vorion/contracts (base schemas)
├── @vorion/a3i (uses contracts)
├── @vorion/orion (uses contracts)
└── @vorion/atsf-core (uses contracts)

src/ (core kernel)
└── Used by: apps/agentanchor, trustbot
```

---

## Critical Implementation Rules

### TypeScript Rules

**CRITICAL - These cause subtle bugs if ignored:**

- **ES Module imports require `.js` extension in packages:**
  ```typescript
  // WRONG
  import { TrustEngine } from './TrustEngine';

  // CORRECT
  import { TrustEngine } from './TrustEngine.js';
  ```

- **Use `import type` for type-only imports:**
  ```typescript
  import type { AgentId, TrustLevel } from '@vorion/contracts';
  ```

- **Zod validation for all external inputs** - Never trust API inputs
  ```typescript
  const schema = z.object({ agentId: z.string().uuid() });
  const validated = schema.parse(input);
  ```

### Trust Model

The platform uses a 6-tier trust system (0-1000 scale):

| Tier | Score Range | Name | Autonomy Level |
|------|-------------|------|----------------|
| L0 | 0-166 | Sandbox | Human approval required |
| L1 | 167-332 | Provisional | Limited operations |
| L2 | 333-499 | Standard | Read public data |
| L3 | 500-665 | Trusted | External communication |
| L4 | 666-832 | Verified | Extended autonomy |
| L5 | 833-1000 | Certified | Maximum autonomy |

### BASIS Four-Layer Architecture

All governance flows through:

1. **INTENT** - Parse and classify action requests
2. **ENFORCE** - Evaluate against trust scores and policies
3. **PROOF** - Log with cryptographic integrity
4. **CHAIN** - Optional blockchain anchoring

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| React Components | PascalCase.tsx | `TrustBadge.tsx` |
| Services | PascalCase.ts | `TrustEngine.ts` |
| Utilities | camelCase.ts | `hashChain.ts` |
| Tests | *.test.ts | `TrustEngine.test.ts` |
| Schemas | camelCase.ts | `agentSchema.ts` |

### Code

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `TrustScoreCalculator` |
| Functions | camelCase | `calculateTrustScore` |
| Constants | UPPER_SNAKE | `TRUST_DECAY_RATE` |
| Types/Interfaces | PascalCase | `TrustScore`, `AgentId` |
| Events | entity:action | `'trust:updated'` |

### Packages

| Convention | Example |
|------------|---------|
| npm scope | `@vorion/package-name` |
| Internal imports | `@vorion/contracts` |

---

## Testing Rules

### Test Structure

- **Test framework:** Vitest
- **Coverage threshold:** 70% minimum
- **Co-locate tests:** `feature.ts` → `feature.test.ts`

### Running Tests

```bash
# All tests
npm test

# Specific workspace
npm --workspace=packages/atsf-core test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Development Commands

### Common Commands

```bash
# Install dependencies
npm install

# Development (all workspaces)
npm run dev

# Build all
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Database
npm run db:migrate
npm run db:seed
```

### Workspace-Specific

```bash
# AgentAnchor development
cd apps/agentanchor && npm run dev

# Build specific package
npm --workspace=packages/atsf-core run build
```

---

## Security Rules

**CRITICAL - Never compromise on these:**

- **Never expose internal IDs in URLs** - Use auth context for org_id
- **Always validate with Zod** before processing any external input
- **Hash chain verification** - Never skip on audit reads
- **Rate limiting** - All public APIs use @upstash/ratelimit
- **Secrets** - Never commit .env files; use Vercel/Supabase secrets

---

## Documentation Locations

| Document Type | Location |
|---------------|----------|
| Master Index | docs/index.md |
| Project Inventory | docs/MASTER-PROJECT-INVENTORY.md |
| BASIS Specifications | basis-core/specs/ |
| TrustBot Architecture | trustbot/docs/ARCHITECTURE.md |
| TrustBot Context | trustbot/_bmad-output/project-context.md |
| Ecosystem Alignment | docs/VORION-ECOSYSTEM-ALIGNMENT.md |
| BMAD Outputs | _bmad-output/planning-artifacts/ |

---

## Known TODOs

**Critical implementations pending:**

| File | Issue |
|------|-------|
| src/cognigate/index.ts:140 | Resource limiting not implemented |
| src/proof/index.ts:69 | Cryptographic signing TODO |
| src/basis/evaluator.ts:222 | Expression evaluation incomplete |

---

## Related Projects

This monorepo is part of a larger ecosystem:

| Directory | Purpose |
|-----------|---------|
| C:\axiom | Vorion governance platform (this repo) |
| C:\bai | BAI hospitality SaaS ecosystem |
| C:\S_A | Personal/legacy projects |

See `docs/MASTER-PROJECT-INVENTORY.md` for complete inventory.

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Check workspace-specific contexts (e.g., trustbot/_bmad-output/project-context.md)
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review monthly for outdated rules

---

_Generated by BMad Method_
_Last Updated: 2026-01-17_
