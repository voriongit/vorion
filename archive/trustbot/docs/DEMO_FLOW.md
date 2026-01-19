# Aurais Investor Demo Script

> **Aurais** - Governed Intelligence | Part of the Vorion AI Safety Ecosystem

## Pre-Demo Setup

### Checklist
- [ ] Clear browser cache for fresh experience
- [ ] Reset Genesis Protocol: Open DevTools → `localStorage.clear()`
- [ ] Ensure API is running: `npm start` (port 3003)
- [ ] Set screen resolution to 1920x1080 or higher
- [ ] Turn off notifications, hide dock/taskbar

### Demo URL
```
http://localhost:5173  (development)
https://aurais.agentanchorai.com  (production)
```

---

## Demo Flow (15 minutes)

### Opening (1 min)
**Talking Point**: "AI agents are getting more capable every day. But how do you let them work autonomously while maintaining control? That's what Aurais solves - with BASIS-compliant trust scoring and Cognigate governance."

---

### Act 1: First Impressions (3 min)

#### 1.1 Login Screen
- Show the HQ entrance with security theme
- **Point out**: "Even the login establishes trust as a core concept"
- Click "AUTHENTICATE" (code: ALPHA2024)

#### 1.2 Genesis Protocol
- Let the first agent message play
- **Point out**: "New users get a guided tour from an AI agent itself"
- Click through 2-3 steps, then skip for time

#### 1.3 Building View
- Pan across the building visualization
- **Point out**: "Visual metaphor - agents work in an office building"
- Hover over an agent to show status tooltip
- **Point out**: "Executive floor for T5 agents, Operations for workers"

---

### Act 2: Trust System Deep Dive (4 min)

#### 2.1 Trust Score Dashboard
- Click on an Autonomous-tier agent
- **Point out**: "BASIS-compliant trust score from 0-1000"
- Show the gauge visualization with tier boundaries
- **Point out**: "Six tiers: Sandbox → Provisional → Standard → Trusted → Certified → Autonomous"

#### 2.2 Multi-Dimensional Trust
- Show the trust signal breakdown
- **Point out**: "Four weighted signals: Behavioral (40%), Compliance (25%), Identity (20%), Context (15%)"
- Show the complexity-aware decay indicator
- **Point out**: "High-complexity tasks reduce trust decay by up to 50%"

#### 2.3 Autonomy Query
- Click "Evaluate Autonomy" button
- **Point out**: "AI-driven promotion evaluation"
- Show the performance metrics breakdown
- **Point out**: "Weighted algorithm: success rate, efficiency, compliance"
- Show recommendation: PROMOTE/MAINTAIN/DEMOTE

#### 2.4 Recovery Path (NEW)
- If an agent is demoted, show recovery status
- **Point out**: "Demoted agents can earn their way back through sustained performance"
- Show recovery progress: points earned, consecutive successes required

#### 2.5 HITL Controls
- Open Control Panel
- Drag the HITL slider from 50% to 75%
- **Point out**: "Globally adjust how much oversight agents need"
- **Point out**: "0% = full autonomy, 100% = approve everything"

---

### Act 3: Skill System (3 min)

#### 3.1 Skill Library
- Click the Skill Library button (game controller icon)
- **Point out**: "Video game-style progression system"
- Filter by category: DEVELOPMENT
- Click on "Deep Code Review" skill
- **Point out**: "Skills have tier requirements and resource costs"
- **Point out**: "Rarity levels create progression: common → legendary"

#### 3.2 Skill Assignment
- Drag a skill onto an agent
- **Point out**: "Drag-and-drop to assign capabilities"
- Show the XP reward popup
- **Point out**: "Gamification keeps operators engaged"

---

### Act 4: Governance in Action (3 min)

#### 4.1 Code Governance
- Click the Code Governance button (shield icon)
- **Point out**: "Tier-based code access permissions"
- Show permission matrix: T0-T2 read-only, T3-T4 sandbox, T5 production
- Scroll to pending changes
- **Point out**: "Visual diff review before code modifications"
- Approve a change
- **Point out**: "Full audit trail for compliance"

#### 4.2 Request/Grant Flow
- Click Request/Grant button (handshake icon)
- **Point out**: "Agents can request help from upper tiers"
- Show pending requests tab
- **Point out**: "Capability grants, resource access, decision approval"
- Approve a request
- **Point out**: "Temporary elevated permissions with expiry"

#### 4.3 Thought Log
- Click the Thought Log button (brain icon)
- **Point out**: "Watch agents think out loud"
- Expand a log entry
- **Point out**: "Observation → Reasoning → Intent → Action → Result"
- **Point out**: "Delta analysis: did outcome match intent?"
- **Point out**: "This is how you audit AI decision-making"

---

### Act 5: Integration Ready (1 min)

#### 5.1 Guided Onboarding
- Click the Integration Setup button (plug icon)
- **Point out**: "Step-by-step wizard for MCP, RAG, APIs"
- Show MCP templates: GitHub, Filesystem, Database
- **Point out**: "Pre-built templates for common integrations"
- Show API webhooks: Slack, Jira
- **Point out**: "Connect to your existing tools"

---

### Closing (2 min)

#### Summary Slide
**Talking Points**:
1. "BASIS-compliant trust scoring for AI agents"
2. "Six-tier permission hierarchy (Sandbox → Autonomous)"
3. "Multi-dimensional trust signals"
4. "Recovery path for demoted agents"
5. "Cognigate integration for production governance"
6. "Full audit trail for compliance"

#### Competitive Advantage
**Point out**: "No one else has combined:
- BASIS-compliant trust scoring
- Multi-dimensional trust signals
- Recovery paths for demoted agents
- Cognigate governance integration
- Enterprise-grade audit trail"

#### Ecosystem Integration
**Point out**: "Aurais is part of the Vorion AI Safety Ecosystem:
- **Cognigate** (cognigate.dev) - Governance engine
- **Agent Anchor AI** (agentanchorai.com) - Agent platform
- **@vorionsys/atsf-core** - Trust engine npm package"

#### Call to Action
"We're raising a $2M seed round to:
- Complete Cognigate integration
- Launch Aurais at aurais.agentanchorai.com
- Reach $500K ARR in 12 months"

---

## Quick Reference: Floating Buttons

| Icon | Feature | Demo Highlight |
|------|---------|----------------|
| ? | Help Panel | Searchable documentation |
| rocket | Project Wizard | 7 persona templates |
| brain | Thought Log | AI reasoning transparency |
| controller | Skill Library | Video game progression |
| handshake | Request/Grant | Cross-tier collaboration |
| shield | Code Governance | Tier-based permissions |
| plug | Onboarding | MCP/RAG/API setup |

---

## Handling Q&A

### "How is this different from LangChain?"
LangChain is a developer framework for building agents. Aurais is the governance layer that controls what those agents can do. We're complementary - you build with LangChain, you govern with Aurais. Our `@vorionsys/atsf-core` package even includes LangChain integration tools.

### "What about AutoGPT/CrewAI?"
They're agent orchestrators without enterprise governance. No trust scoring, no HITL controls, no audit trails. Aurais adds the compliance layer enterprises need with BASIS-compliant governance.

### "Why would agents need trust scores?"
Same reason employees have performance reviews. You wouldn't give a new hire production access on day one. Trust is earned through demonstrated competence - and with our recovery path, agents can earn back trust after mistakes.

### "What's the BASIS specification?"
BASIS (Behavioral AI Safety and Integrity Standard) defines a 6-tier trust system with capability gating. We're fully compliant - our trust engine matches the spec exactly.

### "What's Cognigate?"
Cognigate is the governance engine at cognigate.dev. It provides the INTENT → ENFORCE → PROOF pipeline for production governance. Aurais integrates with Cognigate for enterprise deployments.

### "How do you make money?"
SaaS subscriptions: $99/mo (10 agents), $499/mo (50 agents), Enterprise (unlimited). Plus compute credits and professional services.

### "What's your unfair advantage?"
We're building the trust infrastructure that becomes required for enterprise AI deployment. BASIS compliance, Cognigate integration, and recovery paths give us a moat that competitors can't easily replicate.

---

## Demo Fallbacks

### If API is down
The UI gracefully falls back to demo data. All features work in offline mode with simulated responses.

### If a modal breaks
Escape key closes any modal. Refresh if needed - state persists.

### If they want to see code
Open `src/components/` - show TypeScript quality, component architecture.

---

## Post-Demo

### Follow-up Materials
1. Product spec document (`docs/PRODUCT_SPEC.md`)
2. GitHub repo access
3. Architecture diagram
4. Competitive analysis

### Next Steps
1. Schedule deep-dive technical demo
2. Introduce to technical advisor
3. Share term sheet timeline
