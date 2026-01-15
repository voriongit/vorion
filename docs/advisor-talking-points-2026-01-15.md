# Advisor Meeting Talking Points
**Date:** January 15, 2026

---

## 1. THE HOOK (30 seconds)

> "We've built a credit score for AI agents. As enterprises deploy autonomous AI, they need governance - visibility into what agents are doing, control over what they can do, and proof of what they did. That's what ATSF provides."

---

## 2. THE PROBLEM (1 minute)

**AI agents are ungoverned today:**
- Enterprises deploying AI agents (LangChain, CrewAI, AutoGen)
- Thousands of autonomous decisions daily
- No audit trail, no accountability
- One rogue action = legal, financial, reputational damage

**The gap:**
- Traditional access control doesn't work for AI (too binary)
- Need dynamic, behavioral trust - earned over time
- Compliance teams asking "how do we prove what the AI did?"

---

## 3. THE SOLUTION (2 minutes)

**ATSF - Agentic Trust Scoring Framework**

| Component | What It Does |
|-----------|--------------|
| **Trust Scoring** | 0-1000 score, 6 tiers (L0-L5), like a credit score |
| **Capability Gating** | High trust = more capabilities, low trust = restricted |
| **Decay by Design** | Trust erodes over time, 3x faster after failures |
| **Proof Chain** | SHA-256 audit trail, every decision provable |

**Key differentiators:**
- Framework-agnostic (works with any AI framework)
- Callback-based integration (no architectural changes)
- Open source core, enterprise services on top

---

## 4. TRACTION & PROOF POINTS

**What we've shipped:**
- `atsf-core` published on npm (live today)
- 80+ tests passing
- <10ms scoring latency
- Full PRD and architecture documentation

**Live demos:**
- **vorion.org/pitch** - Enterprise pitch with interactive TrustBot
- TrustBot shows real-time governance decisions (ALLOW/DENY/ESCALATE)

---

## 5. MARKET OPPORTUNITY

**Why now:**
- AI agent adoption exploding (LangChain 100k+ GitHub stars)
- EU AI Act requires transparency and accountability
- Enterprise AI budgets growing 40%+ YoY
- No dominant player in AI governance infrastructure

**Target customers:**
- Enterprises deploying AI agents at scale
- AI platform providers needing governance layer
- Regulated industries (finance, healthcare, legal)

---

## 6. BUSINESS MODEL

**Open core:**
- `atsf-core` - Free, open source (npm)
- AgentAnchor Platform - Paid SaaS (dashboard, analytics, compliance)
- Enterprise - Custom deployments, support, SLAs

**Revenue streams:**
- Per-agent-seat licensing
- API calls / signals processed
- Enterprise support contracts

---

## 7. THE ASK

**From advisors:**
- Introductions to enterprise AI teams
- Feedback on positioning and messaging
- Guidance on go-to-market timing

**Current focus:**
- Landing 2-3 design partners for pilot
- Refining enterprise packaging
- Building case studies

---

## 8. DEMO FLOW (if showing)

1. **Open:** vorion.org/pitch
2. **Scroll:** Problem → Solution → How it works
3. **Demo:** TrustBot chat
   - Type "send an email" → ALLOW (trust sufficient)
   - Type "process payment" → DENY (needs higher trust)
   - Type "delete users" → ESCALATE (human approval required)
4. **Show:** Proof IDs, capability list, trust score
5. **Close:** Contact form / Discord community

---

## 9. OBJECTION HANDLING

**"Why not just use traditional RBAC?"**
> RBAC is static and binary. AI agents need dynamic trust that changes based on behavior. An agent that's been reliable for weeks should have more autonomy than a new one.

**"Isn't this just logging?"**
> Logging tells you what happened. ATSF prevents bad things from happening by gating capabilities in real-time based on earned trust.

**"Why would enterprises adopt this?"**
> They're already asking "how do we govern AI?" The EU AI Act requires it. One AI incident costs millions. This is insurance + compliance + control.

**"What's the moat?"**
> First-mover in trust infrastructure. Network effects as more agents get scored. Data on agent behavior patterns becomes valuable for anomaly detection.

---

## 10. KEY METRICS TO MENTION

| Metric | Value |
|--------|-------|
| npm package | Published (atsf-core) |
| Test coverage | 80+ tests |
| Scoring latency | <10ms |
| Signal throughput | 1000+/sec |
| Trust tiers | 6 levels (L0-L5) |
| Integration time | Minutes, not months |

---

## 11. CLOSING

> "AI agents are the next platform shift. Every agent will need governance. We're building the trust infrastructure layer. The question isn't if enterprises need this - it's who builds it. We're already shipping."

**Next step:** "Can you introduce us to [specific person/company]?"

---

## LINKS TO SHARE

- **Pitch:** https://vorion.org/pitch
- **npm:** https://npmjs.com/package/atsf-core
- **GitHub:** https://github.com/voriongit/vorion
- **Discord:** https://discord.gg/basis-protocol
- **Docs:** https://learn.vorion.org
