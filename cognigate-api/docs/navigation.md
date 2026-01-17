# Site Structure & Navigation

## Domain Architecture

```
vorion.org                    ← Corporate / Movement home
├── /manifesto               ← The "why"
├── /about                   ← Team, mission
└── /blog                    ← Updates, thought leadership

vorion.org/basis             ← The Open Standard
├── /                        ← BASIS overview
├── /intent                  ← INTENT layer
├── /enforce                 ← ENFORCE layer
├── /proof                   ← PROOF layer
├── /chain                   ← CHAIN layer
├── /spec                    ← Full specification
├── /community               ← How to participate
├── /verify/{proofId}        ← Public verification
└── /docs                    ← Documentation

cognigate.dev                ← Reference Implementation
├── /                        ← Cognigate overview
├── /docs                    ← Getting started, guides
├── /api                     ← API reference (Swagger)
└── /status                  ← Service status

agentanchorai.com            ← Certification Platform
├── /                        ← Marketing / landing
├── /register                ← Sign up
├── /dashboard               ← Authenticated portal
├── /registry                ← Public agent registry
├── /verify/{agentId}        ← Public verification
├── /docs                    ← Documentation
└── /api                     ← API reference
```

---

## Navigation Structure

### Main Navigation (All Sites)

```yaml
primary_nav:
  - label: BASIS
    url: https://vorion.org/basis
    description: The Open Standard

  - label: Cognigate
    url: https://cognigate.dev
    description: Reference Implementation

  - label: AgentAnchor
    url: https://agentanchorai.com
    description: Certification Platform

  - label: Community
    url: https://discord.gg/basis-protocol
    description: Get Involved

secondary_nav:
  - label: GitHub
    url: https://github.com/voriongit
    
  - label: Discord
    url: https://discord.gg/basis-protocol
    
  - label: Twitter
    url: https://twitter.com/BASISprotocol
```

### BASIS Site Navigation

```yaml
basis_nav:
  - section: Overview
    items:
      - label: What is BASIS?
        url: /
      - label: Quick Start
        url: /quickstart
      - label: Why Open?
        url: /why-open

  - section: The Stack
    items:
      - label: INTENT Layer
        url: /intent
      - label: ENFORCE Layer
        url: /enforce
      - label: PROOF Layer
        url: /proof
      - label: CHAIN Layer
        url: /chain

  - section: Specification
    items:
      - label: Full Spec
        url: /spec
      - label: Capability Taxonomy
        url: /spec/capabilities
      - label: Risk Classification
        url: /spec/risk
      - label: Compliance Requirements
        url: /spec/compliance

  - section: Implement
    items:
      - label: Getting Started
        url: /implement
      - label: Reference Implementation
        url: /cognigate
      - label: Test Suite
        url: /tests
      - label: Certification
        url: /certify

  - section: Community
    items:
      - label: How to Contribute
        url: /community
      - label: Governance
        url: /governance
      - label: Grants
        url: /grants
      - label: RFCs
        url: /rfcs
```

### Cognigate Site Navigation

```yaml
cognigate_nav:
  - section: Getting Started
    items:
      - label: Overview
        url: /
      - label: Quick Start
        url: /docs/quickstart
      - label: Installation
        url: /docs/install
      - label: Configuration
        url: /docs/config

  - section: Layers
    items:
      - label: INTENT
        url: /docs/intent
      - label: ENFORCE
        url: /docs/enforce
      - label: PROOF
        url: /docs/proof
      - label: CHAIN
        url: /docs/chain

  - section: Integration
    items:
      - label: Trust Providers
        url: /docs/trust
      - label: Policy Engine
        url: /docs/policies
      - label: Webhooks
        url: /docs/webhooks
      - label: SDKs
        url: /docs/sdks

  - section: API
    items:
      - label: API Reference
        url: /api
      - label: Authentication
        url: /api/auth
      - label: Rate Limits
        url: /api/limits

  - section: Deploy
    items:
      - label: Docker
        url: /docs/deploy/docker
      - label: Kubernetes
        url: /docs/deploy/k8s
      - label: Self-Hosted
        url: /docs/deploy/self-hosted
```

### AgentAnchor Site Navigation

```yaml
agentanchor_nav:
  - section: Product
    items:
      - label: Overview
        url: /
      - label: For Developers
        url: /developers
      - label: For Enterprises
        url: /enterprise
      - label: Pricing
        url: /pricing

  - section: Platform
    items:
      - label: Agent Registry
        url: /registry
      - label: Trust Scores
        url: /trust
      - label: Certification
        url: /certification
      - label: Token Economy
        url: /tokens

  - section: Documentation
    items:
      - label: Getting Started
        url: /docs/quickstart
      - label: SDK Reference
        url: /docs/sdk
      - label: API Reference
        url: /api
      - label: Webhooks
        url: /docs/webhooks

  - section: Resources
    items:
      - label: Case Studies
        url: /cases
      - label: Blog
        url: /blog
      - label: Status
        url: https://status.agentanchorai.com
```

---

## Page Templates

### Layer Page (INTENT, ENFORCE, PROOF, CHAIN)

```
1. Hero
   - Layer name
   - One-line description
   - Position in stack diagram

2. What is {Layer}?
   - Explanation
   - Visual flow diagram

3. Key Concepts
   - Core ideas (3-5)
   - With examples

4. Technical Detail
   - Schema/Interface
   - API endpoints
   - Code examples

5. Requirements
   - Compliance requirements table

6. Integration
   - How it connects to adjacent layers

7. Resources
   - Links to spec, implementation, API
```

### Product Page (Cognigate, AgentAnchor)

```
1. Hero
   - Product name
   - Value proposition
   - CTA buttons

2. What is {Product}?
   - Overview
   - Key visual

3. Features
   - 4-6 key features
   - With icons/illustrations

4. How It Works
   - Step-by-step or flow

5. Integration/API
   - Quick code examples
   - SDK links

6. Pricing (if applicable)

7. Get Started
   - CTA to docs/signup
```

---

## URL Structure

### Consistent Patterns

```
/                       # Home/overview
/docs                   # Documentation root
/docs/{topic}           # Doc section
/api                    # API reference
/api/{endpoint}         # Endpoint detail
/verify/{id}            # Public verification
/community              # Community info
/blog                   # Blog
/blog/{slug}            # Blog post
```

### Canonical URLs

Each page should have exactly one canonical URL:
- No trailing slashes (except root)
- Lowercase only
- Hyphens for word separation

---

## Deployment Configuration

### Docusaurus (Recommended for Docs)

```javascript
// docusaurus.config.js
module.exports = {
  title: 'BASIS',
  tagline: 'The open standard for AI agent governance',
  url: 'https://vorion.org/basis',
  baseUrl: '/',
  
  themeConfig: {
    navbar: {
      title: 'BASIS',
      items: [
        { to: '/intent', label: 'INTENT' },
        { to: '/enforce', label: 'ENFORCE' },
        { to: '/proof', label: 'PROOF' },
        { to: '/chain', label: 'CHAIN' },
        { to: '/spec', label: 'Spec' },
        { to: '/community', label: 'Community' },
        { href: 'https://github.com/voriongit', label: 'GitHub' },
      ],
    },
  },
};
```

### Next.js (For AgentAnchor Platform)

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/docs/:path*',
        destination: 'https://docs.agentanchorai.com/:path*',
      },
    ];
  },
};
```

---

## SEO Configuration

### Meta Tags Per Page

```html
<!-- BASIS Home -->
<title>BASIS - Open Standard for AI Agent Governance</title>
<meta name="description" content="The open standard defining how AI agents should be governed before they act. Trust scores, capability gating, immutable audit trails." />

<!-- INTENT Layer -->
<title>INTENT Layer | BASIS Standard</title>
<meta name="description" content="The first layer of BASIS governance. Parse, plan, and classify AI agent intents before enforcement." />

<!-- ENFORCE Layer -->
<title>ENFORCE Layer | BASIS Standard</title>
<meta name="description" content="The gatekeeper of BASIS. Trust verification, capability gating, and policy enforcement for AI agents." />

<!-- PROOF Layer -->
<title>PROOF Layer | BASIS Standard</title>
<meta name="description" content="Immutable audit trails for AI governance. Cryptographic chaining and blockchain anchoring." />

<!-- Cognigate -->
<title>Cognigate - BASIS Reference Implementation</title>
<meta name="description" content="Production-ready AI governance runtime. Open source implementation of the BASIS standard." />

<!-- AgentAnchor -->
<title>AgentAnchor - AI Agent Certification Platform</title>
<meta name="description" content="Trust scores, certification, and registry for AI agents. The UL Listing for AI." />
```

---

## Implementation Priority

### Phase 1: MVP
1. ✅ BASIS landing page
2. ✅ Layer pages (INTENT, ENFORCE, PROOF, CHAIN)
3. ✅ Cognigate landing page
4. ✅ AgentAnchor landing page
5. 🔲 Deploy to Vercel/Netlify

### Phase 2: Documentation
6. 🔲 Full specification (render from markdown)
7. 🔲 API reference (Swagger/Redoc)
8. 🔲 Getting started guides

### Phase 3: Platform
9. 🔲 AgentAnchor dashboard
10. 🔲 Public registry
11. 🔲 Verification pages

---

## File Structure

```
site/
├── basis/
│   ├── index.md           ← ✅ Created
│   ├── intent/
│   │   └── index.md       ← ✅ Created
│   ├── enforce/
│   │   └── index.md       ← ✅ Created
│   ├── proof/
│   │   └── index.md       ← ✅ Created
│   ├── chain/
│   │   └── index.md       ← ✅ Created
│   ├── spec/
│   │   └── index.md       ← Reference 06_BASIS_STANDARD.md
│   └── community/
│       └── index.md       ← Reference 07_COMMUNITY_MOVEMENT_PLAYBOOK.md
│
├── cognigate/
│   └── index.md           ← ✅ Created
│
├── agentanchor/
│   └── index.md           ← ✅ Created
│
└── _config/
    └── navigation.yaml    ← This file
```
