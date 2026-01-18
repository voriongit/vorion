# AgentAnchor Project Context

## Project Overview
**AgentAnchor** is an Enterprise AI Agent Governance Platform - deploy governed AI agents with trust scoring, policy enforcement, and complete auditability.

**Tagline:** *"Agents you can anchor to."*

## B2B Focus (January 2026)
AgentAnchor has been converted from a marketplace model to a B2B enterprise platform:
- **Removed:** Marketplace, token economy, staking, tribunal
- **Core Focus:** Trust scoring, governance, escalations, audit trails, compliance

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
| **atsf-core** | `packages/atsf-core` | Core governance library |
| **Cognigate API** | `cognigate-api` | Trust-Enforced Cognition Runtime |
| **BASIS Docs** | `docs/basis-docs` | BASIS specification site |

## Domain Strategy
- `vorion.org` -> Corporate / Parent entity
- `basis.vorion.org` -> BASIS specification documentation
- `cognigate.dev` -> Developer platform (SDK, API reference)
- `agentanchorai.com` -> AgentAnchor marketing (apps/agentanchor-www)
- `app.agentanchorai.com` -> AgentAnchor platform (apps/agentanchor)

## BASIS Standard (Open Source)
- **Site:** basis.vorion.org
- **Source:** docs/basis-docs/ in monorepo
- **License:** Open standard (CC BY 4.0)

## Architecture
AgentAnchor implements the BASIS four-layer governance model:
- **INTENT:** Parse and classify agent action requests
- **ENFORCE:** Policy evaluation against trust scores
- **PROOF:** SHA-256 chained audit records
- **HUMAN:** Escalation for high-risk decisions

## Trust Scoring
- **Range:** 0-1000 scale
- **Tiers:** Sandbox (0-99), Provisional (100-299), Standard (300-499), Trusted (500-699), Certified (700-899), Autonomous (900-1000)
- **Decay:** 7-day default half-life (14-day enterprise)

## Key Routes
- `/dashboard` - Main command center
- `/agents` - Agent registry and management
- `/governance` - Policy enforcement and decisions
- `/escalations` - Human review queue
- `/audit` - Cryptographic proof chain
- `/compliance` - EU AI Act, ISO 42001 reports
- `/observer` - Real-time monitoring
- `/sandbox` - Agent testing

## Key Documentation
- `docs/B2B-CONVERSION-PLAN.md` - B2B conversion roadmap
- `docs/architecture.md` - System architecture
- `docs/frontend-architecture.md` - Frontend patterns

## Development Notes
- Part of Vorion monorepo - use `npm run dev` from root or this directory
- Database: Neon PostgreSQL with Drizzle ORM
- Auth: Supabase
- Realtime: Pusher
