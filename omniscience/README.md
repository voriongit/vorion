# Omniscience

**The Agentic AI Knowledge Base** — A comprehensive documentation platform with integrated AI assistance.

## Features

- **NEXUS Triad Chat** - AI assistant that synthesizes answers from Gemini, Claude, and Grok perspectives
- **Local-First Knowledge** - 25+ terms in the built-in lexicon, checked before any API call
- **Glassmorphism UI** - Dark cyberpunk theme with smooth animations
- **Documentation Hub** - Guides on agent architecture, orchestration, protocols, and safety
- **SDK Reference** - AgentAnchor and BASIS protocol documentation

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Add your GOOGLE_GENERATIVE_AI_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
omniscience/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/chat/          # AI synthesis API route
│   │   ├── lexicon/           # Knowledge browser
│   │   ├── neural/            # Term submission
│   │   ├── cortex/            # Settings
│   │   └── docs/              # Documentation hub
│   ├── components/
│   │   ├── nexus/             # NEXUS components
│   │   │   ├── nexus-chat.tsx # Chat interface
│   │   │   ├── lexicon-browser.tsx
│   │   │   ├── neural-link.tsx
│   │   │   └── ...
│   │   └── ui/                # Base UI components
│   ├── lib/
│   │   ├── ai-providers.ts    # Multi-model synthesis
│   │   ├── lexicon-data.ts    # Static knowledge base
│   │   └── utils.ts
│   └── types/                 # TypeScript definitions
├── .env.example               # Environment template
└── package.json
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key for synthesis |
| `ANTHROPIC_API_KEY` | No | Enables native Claude (instead of simulation) |
| `XAI_API_KEY` | No | Enables native Grok (instead of simulation) |
| `NEXT_PUBLIC_FIREBASE_*` | No | Firebase config for cloud sync |

## How It Works

### Local-First Architecture

1. User asks a question via the Triad Chat
2. System checks the local lexicon (25+ agentic AI terms)
3. If found → instant response from local data
4. If not found → synthesize from AI models

### Triad Synthesis

When local knowledge is insufficient:

1. **Gemini** provides a balanced, multimodal-aware perspective
2. **Claude** (simulated) provides academic, safety-focused analysis
3. **Grok** (simulated) provides direct, technical insights
4. All perspectives are synthesized into a unified answer

Currently, Claude and Grok are simulated using Gemini with persona prompts. Add API keys to enable native models.

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
gh repo create voriongit/omniscience --public --source=. --push

# Deploy on Vercel
# 1. Import from GitHub at vercel.com
# 2. Add environment variables
# 3. Deploy
```

### Custom Domain

Configure DNS for `learn.vorion.org`:
```
CNAME learn -> cname.vercel-dns.com
```

## Vorion Ecosystem

| Product | Description |
|---------|-------------|
| [BASIS](https://vorion.org/basis) | Open standard for AI agent governance |
| [AgentAnchor](https://agentanchorai.com) | AI governance platform with certification |
| [Cognigate](https://cognigate.dev) | Reference implementation of BASIS runtime |

## Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS 4.0 + custom glassmorphism
- **AI**: Vercel AI SDK with Google Gemini
- **Icons**: Lucide React
- **Fonts**: Inter + JetBrains Mono

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Submit a pull request

See [Contributing Guide](/docs/contributing) for detailed guidelines.

## License

Content licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Code licensed under MIT.

---

**Omniscience** is part of the [Vorion](https://vorion.org) ecosystem.
