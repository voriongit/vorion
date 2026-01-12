# Omniscience

**The Agentic AI Knowledge Base**

A comprehensive documentation site covering autonomous AI agents, multi-agent systems, and the protocols that govern them.

## Content Structure

- **Taxonomy** - Agent type classifications (Reflex, Model-Based, Goal-Based, Utility-Based, Learning, BDI)
- **Architecture** - Cognitive architectures (ReAct, Memory Systems, Planning, Tool Use, Neuro-Symbolic)
- **Orchestration** - Multi-agent coordination (Hierarchical, Swarm, Event-Driven, Debate, Consensus)
- **Protocols** - Standards (MCP, A2A, DID/VC, BASIS)
- **Domains** - Application areas (Software, Research, Finance, Enterprise)
- **Evolution** - Agent improvement (Seeding, Optimization, Memetic Learning, Self-Improvement)
- **Safety** - Governance (Trust Scoring, Capability Gating, Audit Trails, Human Oversight)

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm start

# Build for production
npm run build
```

## Deployment to learn.vorion.org

### Option 1: Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   # Create repo on GitHub (run from omniscience-docs directory)
   gh repo create voriongit/omniscience --public --source=. --push

   # Or push to existing repo
   git remote add origin https://github.com/voriongit/omniscience.git
   git push -u origin master
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import the `voriongit/omniscience` repository
   - Framework will be auto-detected as Docusaurus 2
   - Deploy

3. **Configure Custom Domain**
   - In Vercel project settings, go to Domains
   - Add `learn.vorion.org`
   - Add DNS record at your registrar:
     ```
     CNAME learn -> cname.vercel-dns.com
     ```

### Option 2: Netlify

1. **Push to GitHub** (same as above)

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Import from GitHub
   - Build settings are in `netlify.toml`
   - Deploy

3. **Configure Custom Domain**
   - In Netlify site settings, go to Domain management
   - Add `learn.vorion.org`
   - Add DNS record:
     ```
     CNAME learn -> [your-site].netlify.app
     ```

## Configuration Files

| File | Purpose |
|------|---------|
| `docusaurus.config.ts` | Main site configuration |
| `sidebars.ts` | Navigation sidebar structure |
| `vercel.json` | Vercel deployment config |
| `netlify.toml` | Netlify deployment config |

## Contributing

See [Contributing Guide](./docs/contributing.md) for guidelines on adding content.

## License

Content licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
