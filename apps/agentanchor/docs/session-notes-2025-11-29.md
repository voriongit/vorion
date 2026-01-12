# Session Notes - November 29, 2025

## Summary
Major progress on AgentAnchor - built Governance SDK, updated website with new sections, set up separate repos.

---

## Completed Today

### 1. Git Repository Separation
- **agentanchorai** (website) - `chunkstar/agentanchorai` on main branch
- **agentanchor-app** (app) - `chunkstar/agentanchor-app` on main branch
- Fixed remote URL issues (was pointing to non-existent `fresh.git`)

### 2. Governance SDK Built (lib/governance/)
10 files, 3,083 lines of TypeScript:

| File | Purpose |
|------|---------|
| `types.ts` | Full TypeScript types for Trust, Risk, Persona, Capabilities, MCP, Roles, Audit |
| `trust.ts` | Trust score calculation with decay (90-day grace, 50% floor) |
| `persona.ts` | Dynamic system prompt generation from personality traits |
| `capabilities.ts` | Skill registry with trust tier requirements |
| `mcp.ts` | MCP server configuration and permission checking |
| `roles.ts` | RBAC permission enforcement, agent status transitions |
| `agent-wrapper.ts` | Main integration - `wrapDatabaseBot()`, `prepareAnthropicConfig()` |
| `shadow-mode.ts` | Training in production with parallel execution |
| `observer-queue.ts` | Async Merkle tree batching for audit |
| `index.ts` | Exports all modules |

Key features:
- Dynamic Risk Routing: low/medium/high/critical actions route differently
- Optimistic Governance: post-action audit trails, not pre-action blockers
- Shadow Mode: 95% match rate over 100 executions for graduation
- Merkle batching: 1000 events hashed, anchored hourly to Polygon

### 3. Website Updates (agentanchorai)

**New Sections Added:**
- **Governance SDK section** - Trust Engine, Persona Injection, Capability Gating, Async Observer with code example
- **Shadow Mode section** - Training progress visualization with match rate and execution tracking
- **Developer section** - TypeScript SDK, REST API, MCP Integration (all marked Private Beta / Coming Soon)

**Pricing Changes:**
- Removed free tier
- **Starter $29/mo**: 1 agent, 500 calls, basic audit (no Shadow Mode, no blockchain)
- **Pro $149/mo**: 10 agents, 25k calls, full governance stack, Shadow Mode, blockchain anchoring
- **Enterprise Custom**: Unlimited everything, SSO, on-premise, SLA

**Navigation:**
- Changed "Enterprise" to "Developers" in nav
- Added "Developer / Builder" option to waitlist dropdown

### 4. 7-Layer Governance Stack Updated
Descriptions now reflect optimistic governance:
1. Human Override - Lifeguard mode (real-time feed, not approval queues)
2. Council Governance - Multi-validator consensus for high-risk only
3. Validator Agents - Risk routing (low skips, high gets full review)
4. Academy + Shadow Mode - Train in production with parallel output comparison
5. Truth Chain - Merkle tree batching, anchored hourly to Polygon
6. Observer System - Async queue, fire-and-forget logging
7. Worker Agents - Dynamic personas, capability-based tools, trust-gated autonomy

---

## App Status (agentanchor-app)

**Build**: Passing (fixed TypeScript error in chat route)

**Existing Routes:**
- `/dashboard`, `/bots`, `/chat`, `/teams`, `/mcp`, `/templates`, `/orchestrator`
- `/marketplace`, `/academy`, `/storefront`, `/portfolio`
- `/truth-chain`, `/observer`, `/usage`, `/settings`

**Governance SDK**: Built but NOT yet wired to chat/bot flows

---

## Tomorrow's Priorities

1. **Wire Governance SDK to app** - Connect SDK to actual chat/bot execution flows
2. **Test Shadow Mode** - Verify training mode works with parallel execution
3. **Deploy to Vercel** - Get app running live
4. **Database migrations** - Ensure Supabase schema is up to date

---

## Notes
- BMad Master agent available via `/bmad:bmad-master`
- App has BMAD integration installed at `.bmad/`
- Website deployed on Vercel from `agentanchorai` repo
