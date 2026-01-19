# Aurais

> **Governed Intelligence - AI Agent Platform powered by Vorion BASIS**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Web](https://img.shields.io/badge/Web-live-success)](https://aurais.agentanchorai.com)

## Overview

Aurais is an AI agent governance platform implementing the **Vorion BASIS** (Behavioral Agent Standard for Integrity and Safety) specification. It demonstrates real-time trust scoring, capability gating, and cryptographic audit trails for AI agents.

### Key Features

- **Trust Scoring**: Dynamic 0-1000 scale with 6 tiers (BASIS specification)
- **Capability Gating**: Permission control based on trust levels
- **Audit Trail**: Cryptographic proof chain for all decisions
- **Multi-LLM Support**: Claude, Gemini, Grok integration
- **Real-time Governance**: HITL oversight with progressive autonomy

### Trust Tiers (BASIS Specification)

| Level | Name | Score Range | Capabilities |
|-------|------|-------------|--------------|
| L0 | Sandbox | 0-99 | Isolated testing only |
| L1 | Provisional | 100-299 | Basic read; internal messaging |
| L2 | Standard | 300-499 | Standard ops; limited external |
| L3 | Trusted | 500-699 | Extended ops; external APIs |
| L4 | Certified | 700-899 | Privileged ops; financial |
| L5 | Autonomous | 900-1000 | Full autonomy within policy |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/BanquetAI/trustbot.git
cd trustbot

# Install dependencies
npm install
cd web && npm install && cd ..

# Start API server
npm run api

# Start web frontend (separate terminal)
cd web && npm run dev
```

### Live Demo

- **Web App**: https://aurais.agentanchorai.com
- **Governance Engine**: https://cognigate.dev
- **Trust Scoring SDK**: `npm install @vorionsys/atsf-core`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Aurais Console (Web)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Agent   │ │  Task    │ │  Trust   │ │  Audit   │           │
│  │ Overview │ │ Pipeline │ │ Metrics  │ │  Trail   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST/WebSocket
┌────────────────────────────┴────────────────────────────────────┐
│                        Aurais API                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Governance Pipeline (BASIS)                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │   │
│  │  │  INTENT  │→ │ ENFORCE  │→ │  PROOF   │               │   │
│  │  └──────────┘  └──────────┘  └──────────┘               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │     Services: Trust, Tasks, Agents, Governance           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    Cognigate Engine                              │
│                   (BASIS Implementation)                         │
│  • Trust score calculation (0-1000)                              │
│  • Capability permission matrix                                  │
│  • Cryptographic proof chain                                     │
│  • Policy enforcement                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Vorion Ecosystem

Aurais is part of the Vorion AI governance ecosystem:

| Component | Description | URL |
|-----------|-------------|-----|
| **BASIS** | Behavioral Agent Standard for Integrity and Safety | [vorion.org/basis](https://vorion.org/basis) |
| **atsf-core** | TypeScript SDK for trust scoring | [npm](https://npmjs.com/package/@vorionsys/atsf-core) |
| **Cognigate** | Governance engine API | [cognigate.dev](https://cognigate.dev) |
| **Aurais** | Reference implementation | [aurais.agentanchorai.com](https://aurais.agentanchorai.com) |
| **AgentAnchor** | Enterprise governance platform | [agentanchorai.com](https://agentanchorai.com) |

---

## Development

```bash
# Run tests
npm run test:run

# Type check
npm run build:strict

# Build for production
npm run build:prod

# Deploy to Vercel
cd web && vercel --prod
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with Vorion BASIS** - Learn more at [vorion.org](https://vorion.org)
