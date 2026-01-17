# Unified Repositories and Websites Registry

**Last Updated:** January 17, 2026
**Owner:** Ryan Cason and Alex Blanc

This document is the single source of truth for all repositories, websites, and deployment configurations across the entire project ecosystem.

---

## Quick Reference

### Production Websites

| Domain | Purpose | Source | Platform |
|--------|---------|--------|----------|
| [agentanchorai.com](https://agentanchorai.com) | AgentAnchor Marketing | axiom/apps/agentanchor-www | Vercel |
| [app.agentanchorai.com](https://app.agentanchorai.com) | AgentAnchor Platform | axiom/apps/agentanchor | Vercel |
| [vorion.org](https://vorion.org) | Vorion Corporate | axiom/vorion-www | Vercel |
| [learn.vorion.org](https://learn.vorion.org) | Omniscience Learning | axiom/omniscience | Vercel |
| [basis.vorion.org](https://basis.vorion.org) | BASIS Documentation | axiom/docs/basis-docs | Vercel |
| [cognigate.dev](https://cognigate.dev) | Cognigate Developer | axiom/cognigate-api | Vercel |

### GitHub Organizations

| Org | Purpose | Primary Repos |
|-----|---------|---------------|
| [voriongit](https://github.com/voriongit) | Vorion ecosystem | vorion, basis-core |
| [BanquetAI](https://github.com/BanquetAI) | BAI ecosystem | trustbot |
| [chunkstar](https://github.com/chunkstar) | Personal/legacy | flightFind, A3I-web |

---

## Detailed Repository Inventory

### Track 1: Vorion Ecosystem (C:\axiom)

#### Primary Repository

| Repository | URL | Branch | Status |
|------------|-----|--------|--------|
| **vorion** | https://github.com/voriongit/vorion.git | master | Active |

**Contains:**
- apps/agentanchor - B2B platform
- apps/agentanchor-www - Marketing site
- packages/atsf-core - Trust SDK (@vorion/atsf-core)
- packages/contracts - Shared schemas
- packages/a3i - AI utilities
- packages/orion - Proof plane
- basis-core - BASIS specification
- cognigate-api - Execution runtime
- omniscience - Learning platform
- omniscience-docs - Documentation
- vorion-www - Corporate site
- src/ - Core kernel

#### Submodules

| Submodule | URL | Path | Status |
|-----------|-----|------|--------|
| **trustbot** | https://github.com/BanquetAI/trustbot.git | trustbot/ | Active |

#### Related Repositories

| Repository | URL | Relationship |
|------------|-----|--------------|
| **basis-core** | https://github.com/voriongit/basis-core.git | Standalone spec repo |

---

### Track 2: BAI Ecosystem (C:\bai)

#### Repositories (To Be Created)

| Project | Recommended Repo | Status |
|---------|-----------------|--------|
| **AIQ** | github.com/BanquetAI/aiq | Not created |
| **AIP** | github.com/BanquetAI/aip | Not created |
| **AIS** | github.com/BanquetAI/ais | Not created |
| **AIX** | github.com/BanquetAI/aix | Not created |
| **BAI Command Center** | github.com/BanquetAI/bai-command-center | Not created |
| **Aria Advisors** | github.com/BanquetAI/aria-advisors | Not created |

**Note:** BAI projects are currently local only. Consider creating repos when ready for collaboration/deployment.

---

### Track 3: Personal/Legacy (C:\S_A)

#### Active Repositories

| Repository | URL | Status | Action |
|------------|-----|--------|--------|
| **flightFind** | https://github.com/chunkstar/flightFind.git | Active | Keep |

#### Duplicate Repositories (Archive)

| Repository | URL | Duplicate Of | Action |
|------------|-----|--------------|--------|
| **A3I-web** | https://github.com/chunkstar/A3I-web.git | axiom/apps/agentanchor-www | Archive |
| **agentanchor-app** | https://github.com/chunkstar/agentanchor-app.git | axiom/apps/agentanchor | Archive |

---

## Website Registry

### Production (Live)

| Website | Domain | SSL | CDN | Analytics |
|---------|--------|-----|-----|-----------|
| AgentAnchor Marketing | agentanchorai.com | Vercel | Vercel Edge | Vercel |
| AgentAnchor App | app.agentanchorai.com | Vercel | Vercel Edge | Vercel + Sentry |
| Vorion Corporate | vorion.org | Vercel | Vercel Edge | Vercel |
| Omniscience | learn.vorion.org | Vercel | Vercel Edge | Vercel |
| BASIS Docs | basis.vorion.org | Vercel | Vercel Edge | Vercel |
| Cognigate | cognigate.dev | Vercel | Vercel Edge | Vercel |

### Staging/Development

| Website | Domain | Purpose |
|---------|--------|---------|
| Local Dev | localhost:3000 | Development |
| Preview | *.vercel.app | PR previews |

### Planned (Not Yet Live)

| Website | Planned Domain | Project |
|---------|----------------|---------|
| AIQ | aiq.banquetai.com | bai/aiq |
| AIP | aip.banquetai.com | bai/aip |
| BAI Command Center | command.banquetai.com | bai/bai-command-center |
| Aria Advisors | aria.banquetai.com | bai/aria-advisors |

---

## Deployment Configuration

### Vercel Projects

| Project | Path | Framework | Region |
|---------|------|-----------|--------|
| agentanchor | axiom/apps/agentanchor | Next.js | iad1 |
| agentanchor-www | axiom/apps/agentanchor-www | Next.js | auto |
| cognigate-api | axiom/cognigate-api | Python | auto |
| vorion-www | axiom/vorion-www | Next.js | auto |
| basis-docs | axiom/docs/basis-docs | Docusaurus | auto |
| omniscience | axiom/omniscience | Next.js | auto |
| omniscience-docs | axiom/omniscience-docs | Docusaurus | auto |

### Netlify Projects

| Project | Path | Framework |
|---------|------|-----------|
| omniscience-docs | axiom/omniscience-docs | Docusaurus |

---

## Service Integrations

### Authentication

| Service | Used By | Dashboard |
|---------|---------|-----------|
| Supabase Auth | AgentAnchor, TrustBot | https://supabase.com/dashboard |
| Google OAuth | AgentAnchor | https://console.cloud.google.com |

### Databases

| Service | Used By | Dashboard |
|---------|---------|-----------|
| Neon PostgreSQL | AgentAnchor | https://neon.tech |
| Supabase | TrustBot, Omniscience | https://supabase.com/dashboard |
| Firebase Firestore | BAI projects | https://console.firebase.google.com |

### AI Providers

| Service | API Key Location | Dashboard |
|---------|-----------------|-----------|
| Anthropic Claude | ANTHROPIC_API_KEY | https://console.anthropic.com |
| OpenAI | OPENAI_API_KEY | https://platform.openai.com |
| Google AI | GOOGLE_AI_API_KEY | https://aistudio.google.com |
| xAI | XAI_API_KEY | https://console.x.ai |

### Monitoring

| Service | Used By | Dashboard |
|---------|---------|-----------|
| Sentry | AgentAnchor | https://sentry.io |
| Vercel Analytics | All Vercel projects | Vercel Dashboard |

---

## Contact & Support

### Email Addresses

| Email | Purpose |
|-------|---------|
| contact@vorion.org | General inquiries |
| support@agentanchorai.com | Customer support |
| enterprise@agentanchorai.com | Enterprise sales |

### Social Media

| Platform | Handle | URL |
|----------|--------|-----|
| Twitter/X | @agentanchorai | https://x.com/agentanchorai |
| Discord | BASIS Protocol | https://discord.gg/basis-protocol |

---

## Domain Registry

### Owned Domains

| Domain | Registrar | Expires | Auto-Renew |
|--------|-----------|---------|------------|
| vorion.org | TBD | TBD | Yes |
| agentanchorai.com | TBD | TBD | Yes |
| cognigate.dev | TBD | TBD | Yes |
| banquetai.com | TBD | TBD | Yes |

### DNS Configuration

| Domain | DNS Provider | CDN |
|--------|-------------|-----|
| vorion.org | Cloudflare | Vercel |
| agentanchorai.com | Cloudflare | Vercel |
| cognigate.dev | Cloudflare | Vercel |

---

## Repository Naming Conventions

### Vorion Ecosystem
- Org: `voriongit`
- Pattern: `{project-name}` (lowercase, hyphenated)
- Examples: `vorion`, `basis-core`

### BAI Ecosystem
- Org: `BanquetAI`
- Pattern: `{project-name}` (lowercase, hyphenated)
- Examples: `trustbot`, `aiq`, `aip`

### Personal
- Org: `chunkstar`
- Pattern: `{project-name}` (camelCase or lowercase)
- Examples: `flightFind`

---

## Migration Notes

### Completed Migrations

| From | To | Date | Notes |
|------|-----|------|-------|
| agentanchor.ai | agentanchorai.com | Jan 2026 | Domain change |

### Planned Migrations

| From | To | Target Date | Notes |
|------|-----|-------------|-------|
| chunkstar/A3I-web | Archive | Jan 2026 | Duplicate of axiom |
| chunkstar/agentanchor-app | Archive | Jan 2026 | Duplicate of axiom |

---

## Maintenance

- **Owner:** Ryan Cason and Alex Blanc
- **Review Frequency:** Monthly
- **Last Review:** January 17, 2026
- **Next Review:** February 17, 2026

### Update Checklist

- [ ] Verify all production URLs are accessible
- [ ] Check SSL certificate expiration dates
- [ ] Confirm DNS configurations
- [ ] Update domain expiration dates
- [ ] Review and archive deprecated repos

---

*This document is the single source of truth for all repositories and websites.*
*Update immediately when adding new projects or changing configurations.*
