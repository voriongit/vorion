# Dilly Bot's Memory Bank

## Infrastructure Snapshot

### Last Audit: 2025-11-30

**BAI:**
- Folder cleanup completed (deleted scattered_asprirations duplicate, nul files)
- GitHub org BanquetAI has 12 repos
- Vercel team: baiq

**Scattered Aspirations:**
- Folder renamed correctly from scattered_asprirations
- agentanchorai renamed from aiBotBuild
- flightfinder renamed from flightFind
- Pending cleanup: AiBookConsolidate, web-git_agent

### Recent Actions

#### 2025-12-01
- **Branding Fix**: Updated all "AI Bot Builder" references to "AgentAnchor"
  - Files: layout.tsx, signup/page.tsx, login/page.tsx, Navigation.tsx, config.ts, errors.ts, orchestrator/page.tsx
- **Localhost Redirect Fix**: Updated NEXT_PUBLIC_APP_URL on Vercel from localhost:3000 to https://agentanchorai.vercel.app
- **Redeployed**: Production now at https://agentanchorai.vercel.app
- **Domain Architecture Decision**:
  - `app.agentanchorai.com` → Vercel app (agentanchorai project)
  - `agentanchorai.com` → Marketing site (Cloudflare Pages)
  - Marketing site repo: https://github.com/chunkstar/agentanchor-website ✅
- **Note**: AgentAnchor is a Scattered Aspirations (S_A) production, NOT BAI
- **All S_A repos should be under chunkstar account, not BanquetAI**
- **Cleanup**: Delete duplicate repo at BanquetAI/agentanchor-website when convenient
- **Git Issue Discovered**: Remote `main` branch was overwritten with landing page only
  - Full app code preserved on `app-main` branch
  - Remote `main` = minimal landing page (3 files in app/)
  - Local `app-main` = full application (deployed to Vercel)
  - Decision needed: merge app-main → main or keep branches separate

#### 2025-11-30
- Deployed AgentAnchor to Vercel (https://agentanchorai-3uhq80pdt-baiq.vercel.app)
- Set 13 environment variables on Vercel
- Fixed git author issue (amended commit from frank@agentanchor.com to racason@gmail.com)
- Invited frank@agentanchor.com to bai Vercel team
- Added Node.js engine version (22.x) to package.json

### Known Issues

1. **GitHub Repo Missing** - chunkstar/agentanchor-app doesn't exist (was renamed?)
2. **Pending Archives** - AiBookConsolidate, web-git_agent, aiq-admin, baiq2

### Resolved Issues

1. ~~Vercel Deployment Protection~~ - Production aliases work (agentanchorai.vercel.app returns 200)
2. ~~AI Bot Builder branding~~ - Updated to AgentAnchor
3. ~~Localhost redirect~~ - Fixed NEXT_PUBLIC_APP_URL env var

### Patterns Observed

- Git author mismatches cause Vercel deployment blocks
- ORGANIZE.md drifts when changes made without updating docs
- Folder typos (asprirations vs aspirations) cause duplication

## Orchestrator Preferences

- Prefers tables for status reports
- Wants red/yellow/green priority ordering
- Values quick status checks over lengthy explanations
