# Aurais - Trust-Verified AI Agents

Aurais is the consumer/business frontend for the Vorion AI governance platform. It provides access to trust-verified AI agents backed by AgentAnchor certification.

## Product Tiers

| Tier | Target | Key Features |
|------|--------|--------------|
| **Aurais Core** | Individual/SMB | Trust-verified agents, standard workflows, basic memory |
| **Aurais Pro** | Professional/Teams | Multi-agent orchestration, custom workflows, advanced memory |
| **Aurais Exec** | Enterprise | Fleet management, compliance reporting, dedicated support |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (via shared Vorion infrastructure)
- **Trust**: AgentAnchor API integration

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Backend Access

| Tier | AgentAnchor | Kaizen | Cognigate |
|------|-------------|--------|-----------|
| Core | Query only | Basic logging | — |
| Pro | Query + submit | Full layers | Lite |
| Exec | Full API + webhooks | Custom policies | Dedicated |

## URLs

- Production: `aurais.net`
- Pro: `aurais.net/pro` or `pro.aurais.net`
- Exec: `exec.aurais.net`

## Part of Vorion

Aurais is a product of the [Vorion](https://vorion.org) AI governance ecosystem:

- **AgentAnchor** - Trust authority & certification
- **Kaizen** - Execution integrity layers
- **Cognigate** - Optimized governance runtime
- **BASIS** - Open capability standard
