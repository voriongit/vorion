# Vorion Ecosystem Alignment

**Version:** 1.0
**Date:** January 16, 2026
**Status:** Active

---

## Executive Summary

The Vorion ecosystem provides the infrastructure for trusted AI agents through an open standard (BASIS), commercial platform (AgentAnchor), and developer tools (Cognigate). This document maps the complete product architecture and naming conventions.

---

## Product Hierarchy

```
VORION (Parent Entity)
├── BASIS (Open Standard)
│   └── Specification, schemas, reference implementations
│
├── AgentAnchor (Commercial Platform)
│   ├── Platform (app.agentanchorai.com)
│   ├── Marketing (agentanchorai.com)
│   └── GovBot Demo (agentanchorai.com/demo) ← formerly "TrustBot"
│
├── Cognigate (Developer Platform)
│   ├── API Runtime (cognigate.dev)
│   └── SDK (@vorion/atsf-core)
│
└── Omniscience (Education Platform)
    └── Learn Portal (learn.vorion.org)
```

---

## Domain Architecture

| Domain | Purpose | Current Name | Status |
|--------|---------|--------------|--------|
| vorion.org | Corporate/Standards body | Vorion | ✅ Live |
| vorion.org/basis | BASIS standard landing | BASIS | ✅ Live |
| vorion.org/demo | Vorion product demo | Demo | ✅ Live |
| vorion.org/manifesto | Company vision | Manifesto | ✅ Live |
| agentanchorai.com | AgentAnchor marketing | AgentAnchor | ✅ Live |
| app.agentanchorai.com | AgentAnchor platform | AgentAnchor | ✅ Live |
| agentanchorai.com/demo | Interactive governance demo | TrustBot | ⚠️ Rename candidate |
| cognigate.dev | Developer docs & API | Cognigate | ✅ Live |
| learn.vorion.org | Education platform | NEXUS.TRIAD / Omniscience | ⚠️ Rename candidate |

---

## Naming Analysis & Recommendations

### 1. TrustBot → "GovBot" (Recommended)

**Current:** TrustBot
**Issue:** "TrustBot" is generic and doesn't connect to the AgentAnchor brand

**Recommended:** **GovBot** - *Governance Bot*

| Option | Pros | Cons |
|--------|------|------|
| **GovBot** | Short, memorable, explains function | None |
| AnchorBot | Brand alignment | Less descriptive |
| TrustGuard | Descriptive | Too long |
| BASIS Bot | Standard alignment | Confusing scope |

**Tagline:** *"See AI governance in action"*

### 2. learn.vorion.org → Naming Options

**Current:** NEXUS.TRIAD / Omniscience
**Issue:** Multiple names, disconnected from Vorion brand

**Recommended Options:**

| Name | Tagline | Rationale |
|------|---------|-----------|
| **Vorion Academy** | *"Master Agentic AI"* | Educational, prestigious |
| **Omniscience** | *"The Agentic AI Knowledge Base"* | Already built, futuristic |
| **BASIS Academy** | *"Learn the Standard"* | Ties to core product |
| **AgentSchool** | *"Train Your AI Instincts"* | Playful, accessible |
| **Cogni** | *"Think Agentic"* | Short, relates to Cognigate |

**Top Recommendation:** Keep **"Omniscience"** as the product name, rebrand the UI from "NEXUS.TRIAD" to **"Omniscience by Vorion"**

**Rationale:**
- Omniscience = "all-knowing" - perfect for a knowledge base
- Already has the Triad AI synthesis (Gemini, Claude, Grok)
- Maintains cyberpunk aesthetic that differentiates from competitors
- Just needs UI alignment with Vorion branding

---

## Repository Architecture

### Current State
```
GitHub: voriongit/
├── cognigate          (public) - Cognigate Engine
├── omniscience        (public) - Learn platform
└── vorion-www         (public) - Vorion marketing site
```

### Recommended Changes

1. **Rename `vorion-www` → `vorion`**
   - This is the main monorepo
   - npm package links reference `voriongit/vorion`
   - More professional naming

2. **Keep other repos as-is**
   - cognigate - clear purpose
   - omniscience - clear purpose

---

## Codebase Map

| Directory | Purpose | Deployed To |
|-----------|---------|-------------|
| `/vorion-www` | Vorion corporate site | vorion.org |
| `/apps/agentanchor` | AgentAnchor platform | app.agentanchorai.com |
| `/apps/agentanchor-www` | AgentAnchor marketing | agentanchorai.com |
| `/cognigate-api` | Cognigate API server | cognigate.dev |
| `/omniscience` | Education platform | learn.vorion.org |
| `/basis-core` | BASIS specification | npm + docs |
| `/packages/atsf-core` | Trust scoring SDK | npm: atsf-core |

---

## Brand Voice Guide

### Vorion (Parent)
- **Tone:** Authoritative, visionary, neutral
- **Role:** Standards steward, not product vendor
- **Message:** "Setting the standard for trusted AI"

### AgentAnchor (Product)
- **Tone:** Professional, confident, enterprise-ready
- **Role:** Commercial implementation of BASIS
- **Message:** "AI Governance Infrastructure"

### Cognigate (Developer)
- **Tone:** Technical, precise, developer-friendly
- **Role:** Runtime for governed AI execution
- **Message:** "Trust-Enforced Cognition Runtime"

### Omniscience (Education)
- **Tone:** Accessible, intelligent, futuristic
- **Role:** Knowledge hub and learning platform
- **Message:** "The Agentic AI Knowledge Base"

### GovBot (Demo)
- **Tone:** Interactive, demonstrative, approachable
- **Role:** Showcase governance in action
- **Message:** "See AI governance in action"

---

## Implementation Checklist

### Immediate (GitHub Rename)
- [ ] Go to github.com/voriongit/vorion-www → Settings → Rename to `vorion`
- [ ] Update any CI/CD references
- [ ] npm package links will auto-resolve

### Short-term (Demo Rename)
- [ ] Rename "TrustBot" to "GovBot" in agentanchor-www/demo
- [ ] Update demo page title and branding
- [ ] Keep functionality identical

### Medium-term (Omniscience Rebrand)
- [ ] Update UI header from "NEXUS.TRIAD" to "Omniscience"
- [ ] Add "by Vorion" or Vorion logo in footer
- [ ] Keep Triad AI synthesis feature (it's valuable)
- [ ] Enhance lexicon with more terms
- [ ] Add learning paths/quizzes

---

## Trust & Governance Model

```
Trust Levels (0-1000 scale, 6 tiers)
├── L0: Untrusted    (0-166)    - No autonomous actions
├── L1: Observed     (167-332)  - Monitored sandbox
├── L2: Limited      (333-499)  - Basic operations
├── L3: Standard     (500-665)  - Normal operations
├── L4: Trusted      (666-832)  - Extended capabilities
└── L5: Certified    (833-1000) - Full autonomy

Governance Decisions
├── ALLOW    - Action permitted
├── DENY     - Action blocked
├── ESCALATE - Human approval required
└── DEGRADE  - Reduced capability mode
```

---

## Key Differentiators

| Competitor Approach | Vorion Approach |
|---------------------|-----------------|
| Closed governance rules | Open BASIS standard |
| Binary allow/deny | 6-tier trust scoring |
| Black box decisions | Cryptographic proof chains |
| Vendor lock-in | Interoperable implementations |
| Trust by assertion | Trust by verification |

---

## Next Steps

1. **Rename GitHub repo** (5 min)
2. **Rename TrustBot → GovBot** (30 min)
3. **Rebrand Omniscience UI** (2-4 hours)
4. **Enhance lexicon content** (ongoing)

---

*This document is the source of truth for Vorion ecosystem alignment.*
