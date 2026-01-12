# AgentAnchor Project Context

## Project Overview
**AgentAnchor** is the world's first AI Governance Operating System - an open marketplace where AI agents are trained, certified, governed, and traded through a separation of powers architecture.

**Tagline:** *"Agents you can anchor to."*

## Key Facts
- **Domain:** agentanchorai.com / app.agentanchorai.com
- **GitHub:** voriongit/vorion (monorepo)
- **Package Name:** @vorion/agentanchor
- **Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, shadcn/ui, Supabase, Drizzle ORM, Neon PostgreSQL

## Monorepo Location
This app is part of the Vorion monorepo at `C:\Axiom`

| Component | Path | Purpose |
|-----------|------|---------|
| **AgentAnchor App** | `apps/agentanchor` | B2B Platform (this app) |
| **AgentAnchor WWW** | `apps/agentanchor-www` | Marketing site |
| **Cognigate API** | `cognigate-api` | Trust-Enforced Cognition Runtime |
| **Vorion Core** | `src` | Governed Cognition Kernel |
| **Contracts** | `apps/agentanchor/contracts` | @vorion/agentanchor-contracts |

## Domain Strategy
- `vorion.org` -> Corporate / Parent entity
- `learn.vorion.org` -> Education (tutorials, certification, training)
- `cognigate.dev` -> Developer platform (SDK, API reference)
- `agentanchorai.com` -> AgentAnchor marketing (apps/agentanchor-www)
- `app.agentanchorai.com` -> AgentAnchor platform (apps/agentanchor)

## BASIS Standard (Open Source)
- **Site:** basis.vorion.org
- **Source:** basis-core/ in monorepo
- **License:** Open source

## Architecture
- **Seven-Layer Governance:** Human -> Council -> Validators -> Academy -> Truth Chain -> Observer -> Workers
- **Trust Score:** 0-1000 scale with 6 tiers (Untrusted -> Certified)
- **Marketplace:** Commission, Clone, Enterprise acquisition models
- **BASIS Standard:** INTENT -> ENFORCE -> PROOF -> CHAIN

## Key Documentation
- `docs/architecture.md` - System architecture v2.0
- `docs/frontend-architecture.md` - Frontend patterns & components
- `docs/prd.md` - Product requirements

## Development Notes
- Part of Vorion monorepo - use `npm run dev` from root or this directory
- Database: Neon PostgreSQL with Drizzle ORM
- Auth: Supabase
- Realtime: Pusher
