# Vorion Developer Onboarding Guide

**Welcome to the Vorion Platform!**

This guide will help you get up and running with the Vorion AI governance ecosystem. By the end, you'll understand the architecture, have your development environment set up, and be ready to contribute.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture Concepts](#architecture-concepts)
3. [Development Environment Setup](#development-environment-setup)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Key Modules Deep Dive](#key-modules-deep-dive)
7. [Testing Guide](#testing-guide)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

---

## Platform Overview

### What is Vorion?

Vorion is an enterprise AI governance platform that enables organizations to deploy autonomous AI agents with confidence. We provide:

- **Trust Scoring:** Behavioral trust measurement for AI agents
- **Policy Enforcement:** Rule-based governance for agent actions
- **Audit Trails:** Cryptographic proof of all decisions
- **Human Escalation:** Human-in-the-loop for high-risk decisions

### The Vorion Ecosystem

| Component | Purpose | URL |
|-----------|---------|-----|
| **BASIS** | Open standard for AI governance | basis.vorion.org |
| **Cognigate** | Constrained execution runtime | cognigate.dev |
| **AgentAnchor** | B2B enterprise platform | app.agentanchorai.com |
| **atsf-core** | Core SDK/library | npm: @vorionsys/atsf-core |

### Key Terminology

| Term | Definition |
|------|------------|
| **Intent** | A request from an agent to perform an action |
| **Trust Score** | Numerical measure (0-1000) of agent trustworthiness |
| **Trust Level** | Tier (L0-L5) determining agent capabilities |
| **Proof** | Cryptographic record of a governance decision |
| **Escalation** | Human review required for a decision |
| **Constraint** | Limitation applied to an approved action |

---

## Architecture Concepts

### The Four-Layer Governance Model (BASIS)

Every agent action flows through four layers:

```
1. INTENT   → Parse and classify the request
2. ENFORCE  → Evaluate against policies and trust
3. PROOF    → Create cryptographic audit record
4. HUMAN    → Escalate if needed
```

### Trust Levels

| Level | Name | Score | Capabilities |
|-------|------|-------|--------------|
| L0 | Sandbox | 0-99 | Human approval for everything |
| L1 | Provisional | 100-299 | Limited internal operations |
| L2 | Standard | 300-499 | Basic read/write operations |
| L3 | Trusted | 500-699 | Cross-system communication |
| L4 | Certified | 700-899 | Extended autonomy |
| L5 | Autonomous | 900-1000 | Full autonomy |

### Decision Outcomes

| Decision | Meaning |
|----------|---------|
| `ALLOW` | Execute the action |
| `DENY` | Block the action |
| `ESCALATE` | Send to human review |
| `LIMIT` | Allow with constraints |
| `MONITOR` | Allow with enhanced logging |

---

## Development Environment Setup

### Prerequisites

- **Node.js:** v20.x or later
- **npm:** v10.x or later
- **Git:** Latest version
- **PostgreSQL:** v15+ (or use Neon/Supabase)
- **Redis:** v7+ (or use Upstash)

### Step 1: Clone the Repository

```bash
git clone https://github.com/voriongit/vorion.git
cd vorion
```

### Step 2: Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### Step 3: Configure Environment

Create environment files for each app/package:

```bash
# Root environment
cp .env.example .env

# AgentAnchor
cp apps/agentanchor/.env.example apps/agentanchor/.env.local

# atsf-core (for testing)
cp packages/atsf-core/.env.example packages/atsf-core/.env
```

### Step 4: Configure Required Variables

**Minimum required for local development:**

```bash
# .env.local (AgentAnchor)
DATABASE_URL=postgresql://user:pass@localhost:5432/agentanchor
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
NEXTAUTH_SECRET=development-secret-min-32-chars!!
```

### Step 5: Setup Database

```bash
# Navigate to AgentAnchor
cd apps/agentanchor

# Run migrations
npx drizzle-kit push

# (Optional) Seed development data
npm run db:seed
```

### Step 6: Start Development Server

```bash
# From repository root
npm run dev

# Or start specific app
npm run dev --filter=@vorion/agentanchor
```

### Step 7: Verify Setup

Open your browser:

- AgentAnchor: http://localhost:3000
- API Health: http://localhost:3001/api/v1/health

---

## Project Structure

### Monorepo Layout

```
vorion/
├── apps/                      # Applications
│   ├── agentanchor/           # B2B Platform (Next.js 14)
│   ├── agentanchor-www/       # Marketing site
│   └── bai-cc-www/            # Portfolio site
│
├── packages/                  # Shared packages
│   ├── atsf-core/             # Core SDK
│   ├── contracts/             # Type definitions
│   ├── a3i/                   # AI utilities
│   └── ...
│
├── src/                       # Core kernel
│   ├── api/                   # REST API server
│   ├── trust-engine/          # Trust scoring
│   ├── intent/                # Intent processing
│   ├── enforce/               # Policy enforcement
│   ├── proof/                 # Audit system
│   └── escalation/            # Human review
│
├── docs/                      # Documentation
├── package.json               # Root package
├── turbo.json                 # Turborepo config
└── tsconfig.base.json         # Shared TS config
```

### Key Directories Explained

| Directory | Purpose | When to Modify |
|-----------|---------|----------------|
| `apps/agentanchor/` | Main B2B platform UI | Adding features, fixing UI bugs |
| `packages/atsf-core/` | Core governance logic | Changing trust/governance behavior |
| `src/api/` | REST API server | Adding endpoints, auth changes |
| `src/trust-engine/` | Trust calculations | Modifying scoring algorithms |

### Important Files

| File | Purpose |
|------|---------|
| `apps/agentanchor/CLAUDE.md` | AI assistant context for AgentAnchor |
| `packages/atsf-core/package.json` | SDK exports and dependencies |
| `src/api/server.ts` | Main API server entry |
| `src/common/types.ts` | Shared type definitions |
| `turbo.json` | Build pipeline configuration |

---

## Development Workflow

### Branching Strategy

```
main                    # Production-ready code
├── develop             # Integration branch
│   ├── feature/xyz     # New features
│   ├── fix/abc         # Bug fixes
│   └── refactor/123    # Refactoring
```

### Creating a Feature Branch

```bash
# Start from develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit
git add .
git commit -m "feat(module): add new feature"

# Push and create PR
git push -u origin feature/my-feature
```

### Commit Message Format

We use Conventional Commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

**Examples:**
```
feat(trust-engine): add accelerated decay on failure
fix(agentanchor): resolve mobile navigation issue
docs(api): update authentication examples
```

### Running the Build

```bash
# Build everything
npm run build

# Build specific package
npm run build --filter=@vorionsys/atsf-core

# Type check only
npm run typecheck
```

### Running Tests

```bash
# All tests
npm run test

# Specific package
npm run test --filter=@vorionsys/atsf-core

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

---

## Key Modules Deep Dive

### Trust Engine (`packages/atsf-core/src/trust-engine/`)

The Trust Engine calculates and manages trust scores.

**Key Concepts:**
- **Components:** behavioral (40%), compliance (25%), identity (20%), context (15%)
- **Decay:** Scores decay over time (7-day half-life)
- **Signals:** Events that modify trust (success, failure, compliance, violation)

**Usage:**
```typescript
import { createTrustEngine } from '@vorionsys/atsf-core/trust-engine';

const engine = createTrustEngine(config);

// Initialize entity
await engine.initializeEntity('agent-123', { startingScore: 500 });

// Record signal
await engine.recordSignal('agent-123', {
  signalType: 'success',
  impact: 15,
  source: 'automation'
});

// Get current score
const score = await engine.getScore('agent-123');
```

### Governance Engine (`packages/atsf-core/src/governance/`)

Evaluates rules and makes governance decisions.

**Rule Categories (Priority Order):**
1. `hard_disqualifier` - Immediate block
2. `regulatory_mandate` - Compliance requirement
3. `security_critical` - Security-first
4. `policy_enforcement` - Standard policies
5. `soft_constraint` - Advisory rules

**Usage:**
```typescript
import { GovernanceEngine } from '@vorionsys/atsf-core/governance';

const governance = new GovernanceEngine();

// Register rule
governance.registerRule({
  id: 'external-api-trust-check',
  category: 'policy_enforcement',
  condition: {
    type: 'composite',
    operator: 'and',
    conditions: [
      { field: 'action', operator: 'equals', value: 'external_api_call' },
      { field: 'trustLevel', operator: 'less_than', value: 4 }
    ]
  },
  action: 'escalate',
  message: 'External API calls require trust level 4+'
});

// Evaluate
const result = await governance.evaluate(context);
```

### Proof System (`packages/atsf-core/src/proof/`)

Creates cryptographic audit records.

**Features:**
- SHA-256 content hashing
- Ed25519 digital signatures
- Chain linkage verification

**Usage:**
```typescript
import { createProofService } from '@vorionsys/atsf-core/proof';

const proofService = createProofService(config);

// Create proof
const proof = await proofService.create({
  intentId: 'int-123',
  entityId: 'agent-456',
  decision: { action: 'allow', trustScore: 650 },
  inputs: { goal: 'Send email' },
  outputs: { result: 'success' }
});

// Verify proof
const isValid = await proofService.verify(proof.id);

// Verify entire chain
const chainValid = await proofService.verifyChain();
```

---

## Testing Guide

### Test Structure

```
tests/
├── unit/                 # Unit tests
│   ├── trust-engine/
│   ├── governance/
│   └── proof/
├── integration/          # Integration tests
│   ├── api/
│   └── persistence/
└── e2e/                  # End-to-end tests
    └── scenarios/
```

### Writing Unit Tests

```typescript
// tests/unit/trust-engine/scoring.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTrustEngine } from '../../../src/trust-engine';

describe('TrustEngine', () => {
  let engine;

  beforeEach(() => {
    engine = createTrustEngine({ persistence: 'memory' });
  });

  describe('scoring', () => {
    it('should initialize entity with default score', async () => {
      await engine.initializeEntity('test-agent');
      const score = await engine.getScore('test-agent');
      expect(score).toBe(0);
    });

    it('should increase score on positive signal', async () => {
      await engine.initializeEntity('test-agent');
      await engine.recordSignal('test-agent', {
        signalType: 'success',
        impact: 20
      });
      const score = await engine.getScore('test-agent');
      expect(score).toBeGreaterThan(0);
    });
  });
});
```

### Writing Integration Tests

```typescript
// tests/integration/api/intents.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '../../helpers/server';

describe('Intents API', () => {
  let server;
  let authToken;

  beforeAll(async () => {
    server = await createTestServer();
    authToken = await getTestToken();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should submit intent with valid auth', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/intents',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        entityId: 'test-agent-uuid',
        goal: 'Test intent'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().success).toBe(true);
  });
});
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Define types** in `src/common/types.ts`
2. **Add validation schema** in `src/api/validation.ts`
3. **Implement route** in `src/api/server.ts`
4. **Add tests** in `tests/integration/api/`

### Adding a Trust Signal Type

1. **Update enum** in `packages/atsf-core/src/common/types.ts`
2. **Add handling** in `packages/atsf-core/src/trust-engine/index.ts`
3. **Update validation** in `src/api/validation.ts`
4. **Add tests**

### Adding a UI Page

1. **Create route** in `apps/agentanchor/app/(dashboard)/new-page/page.tsx`
2. **Add navigation** in `apps/agentanchor/components/navigation/Sidebar.tsx`
3. **Create components** in `apps/agentanchor/components/new-page/`
4. **Add API routes** if needed in `apps/agentanchor/app/api/`

### Modifying Database Schema

1. **Update Drizzle schema** in `apps/agentanchor/lib/db/schema/`
2. **Generate migration:**
   ```bash
   cd apps/agentanchor
   npx drizzle-kit generate
   ```
3. **Apply migration:**
   ```bash
   npx drizzle-kit push
   ```

---

## Troubleshooting

### Common Issues

#### "Module not found" errors

```bash
# Clear caches and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
npm install
```

#### TypeScript errors after pull

```bash
# Rebuild all packages
npm run build
```

#### Database connection issues

1. Check `DATABASE_URL` is correct
2. Ensure PostgreSQL is running
3. Verify network access (if using Neon/Supabase)

#### Port already in use

```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Getting Help

1. **Check existing docs** in `/docs` folder
2. **Search issues** on GitHub
3. **Ask in #dev-help** Slack channel
4. **Create GitHub issue** with reproduction steps

---

## Resources

### Internal Documentation

- `docs/B2B-CONVERSION-PLAN.md` - Strategic direction
- `apps/agentanchor/docs/` - AgentAnchor-specific docs
- `packages/atsf-core/README.md` - SDK documentation

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Fastify](https://www.fastify.io/docs/latest/)
- [Vitest](https://vitest.dev)
- [Turborepo](https://turbo.build/repo/docs)

### Useful Commands Cheatsheet

```bash
# Development
npm run dev                    # Start all apps
npm run dev --filter=app       # Start specific app

# Building
npm run build                  # Build everything
npm run typecheck              # Type check only

# Testing
npm run test                   # Run all tests
npm run test -- --watch        # Watch mode
npm run test -- --coverage     # With coverage

# Database
npx drizzle-kit push           # Apply migrations
npx drizzle-kit studio         # Open Drizzle Studio

# Linting
npm run lint                   # Run linter
npm run lint -- --fix          # Auto-fix issues

# Git
git checkout develop           # Switch to develop
git pull origin develop        # Update develop
git checkout -b feature/xyz    # Create feature branch
```

---

## Next Steps

1. **Explore the codebase** - Read through key modules
2. **Run the tests** - Understand how things work
3. **Pick a starter issue** - Look for "good first issue" labels
4. **Ask questions** - We're here to help!

Welcome to the team!

---

*Onboarding guide created by BMad Master*
*Last updated: January 19, 2026*
