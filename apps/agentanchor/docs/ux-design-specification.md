# AgentAnchor UX Design Specification

_Created on 2025-11-28 by frank the tank_
_Generated using BMad Method - Create UX Design Workflow v1.0_

---

## Executive Summary

**AgentAnchor** is an AI Governance Operating System built on the principle: *"Other platforms ask you to trust AI. We give you an AI system that doesn't trust itself - with independent oversight you can audit."*

The platform serves two primary user types:
- **Trainers** - Build, train, certify, and publish AI agents to the marketplace
- **Consumers** - Discover, acquire, and use certified AI agents with full transparency

**Core Tagline:** *"Agents you can anchor to."*

**Design Philosophy:** Calm Confidence - The UX should feel like a trusted institution, not a flashy startup. Every interaction reinforces reliability, transparency, and human control.

---

## 1. Design System Foundation

### 1.1 Design System Choice

**Decision:** Custom design system built on Tailwind CSS primitives with shadcn/ui components as the foundation.

**Rationale:**
- Tailwind provides utility-first flexibility for our unique governance UI patterns
- shadcn/ui offers accessible, unstyled components we can customize
- Custom tokens allow us to express our "calm confidence" aesthetic
- Existing codebase already uses this stack

**Key Extensions:**
- Trust Score visualization components
- Observer feed real-time display
- Council decision cards
- Graduation ceremony UI (dignified, not gimmicky)

---

## 2. Core User Experience

### 2.1 Defining Experience

**Primary UX Emotion:** Calm Confidence

Users should feel:
- **In Control** - Clear escalation paths, always know what agents are doing
- **Informed** - Real-time Observer feeds, transparent Council decisions
- **Protected** - Client Bill of Rights visible, opt-out always available
- **Professional** - This is serious infrastructure, not a toy

**Design Principles:**
1. **Transparency Over Mystery** - Show the governance working
2. **Dignity Over Gamification** - Milestones matter, but aren't gimmicky
3. **Information Density Without Overwhelm** - Data-rich but organized
4. **Human Authority Always Visible** - Escalation paths clear

### 2.2 Novel UX Patterns

**1. Live Observer Feed**
- Monospace, terminal-style display
- Color-coded severity levels (L0-L3)
- Real-time streaming without being distracting
- Expandable to full audit view

**2. Trust Score Display**
- 0-1000 scale with 6 tiers
- Visual indicator (not FICO-like, more progress bar)
- Tier badges: Untrusted, Novice, Proven, Trusted, Elite, Legendary

**3. Council Summary Widget**
- Daily approve/deny/pending counts
- Council agent "voice" quotes (Arbiter, Guardian, etc.)
- Link to full decision log

**4. Escalation Banner**
- Prominent but not alarming
- Clear action buttons (Approve/Deny/Details)
- Context summary visible immediately

**5. Graduation Moments**
- Still, dignified, permanent
- Council speaks (one sentence each)
- Truth Chain hash displayed
- Typography as emotion (not confetti)

---

## 3. Visual Foundation

### 3.1 Color System

**Primary Palette: Deep Navy + Subtle Accents**

```css
:root {
  /* Backgrounds - Dark, professional */
  --bg-primary: #0a0f1a;
  --bg-secondary: #111827;
  --bg-card: #1a2332;
  --bg-card-hover: #222d3d;

  /* Borders */
  --border-subtle: #2a3a4a;
  --border-accent: #3b5068;

  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Semantic Colors */
  --accent-blue: #3b82f6;      /* Primary actions */
  --accent-green: #10b981;     /* Success, active, earnings */
  --accent-amber: #f59e0b;     /* Warning, pending, training */
  --accent-red: #ef4444;       /* Error, denied */
  --accent-purple: #8b5cf6;    /* Council, governance */

  /* Trust Tiers */
  --tier-untrusted: #ef4444;
  --tier-novice: #64748b;
  --tier-proven: #3b82f6;
  --tier-trusted: #8b5cf6;
  --tier-elite: #f59e0b;
  --tier-legendary: #10b981;

  /* Certification Badges */
  --badge-bronze: #cd7f32;
  --badge-silver: #c0c0c0;
  --badge-gold: #ffd700;
  --badge-platinum: #e5e4e2;
  --badge-diamond: #b9f2ff;
}
```

**Brand Colors:**
- Primary: Deep Navy (#1e3a5f) - Anchor/maritime feel
- Secondary: Steel Blue (#2d5a87) - Professional trust
- Accent: Muted Gold (#c9a227) - Achievement without flashiness

**Interactive Visualizations:**

- Dashboard Mockup: [ux-dashboard-mockup.html](./ux-dashboard-mockup.html)

---

## 4. Design Direction

### 4.1 Chosen Design Approach

**Direction: "Command Center" - Professional Dashboard Aesthetic**

**Characteristics:**
- Information-dense but well-organized grid layouts
- Real-time data feeds (Observer) as first-class citizens
- Sidebar navigation for quick access to all platform areas
- Cards for discrete information units
- Subtle animations (nothing flashy)

**Why This Direction:**
- Matches the "governance operating system" positioning
- Trainers need visibility into agent operations
- Consumers need confidence in agent quality
- Regulatory/compliance users expect professional tools

**Rejected Alternatives:**
- Consumer app aesthetic (too casual for governance)
- Crypto/Web3 aesthetic (too speculative)
- Minimalist (not enough information density)

**Interactive Mockups:**

- Dashboard Mockup: [ux-dashboard-mockup.html](./ux-dashboard-mockup.html)

---

## 5. User Journey Flows

### 5.1 Critical User Paths

**Trainer Journeys:**

1. **New Agent Creation**
   - Dashboard → + Train New Agent → Academy Setup → Curriculum Selection → Training Begins

2. **Responding to Escalation**
   - Notification → Escalation Banner → View Details → Approve/Deny → Confirmation

3. **Publishing to Marketplace**
   - Agent Card → Publish → Set Terms (Commission/Clone/Locked) → Council Review → Listed

4. **Graduation Ceremony**
   - Training Complete Notification → Graduation Page → Council Speaks → Truth Chain Record → Certificate Generated

**Consumer Journeys:**

1. **Finding an Agent**
   - Marketplace → Browse/Search → Filter by Trust Score/Category → View Agent Profile → Public Reports

2. **Acquiring an Agent**
   - Agent Profile → Select Acquisition Type → Review Terms → Confirm → Agent Added

3. **Monitoring Usage**
   - Dashboard → My Agents → Usage Stats → Costs → Observer Feed

4. **Opting Out (Client Protection)**
   - Settings → Agent Management → Ownership Change Notice → Opt Out → Walk Away Clean

### 5.2 Information Architecture

```
AgentAnchor
├── Dashboard (role-specific)
├── Academy
│   ├── My Agents
│   ├── Curricula
│   ├── Graduations
│   └── Certifications
├── Council
│   ├── Pending Decisions
│   ├── Decision History
│   └── Council Agents (profiles)
├── Marketplace
│   ├── Browse Agents
│   ├── My Listings (Trainer)
│   ├── My Agents (Consumer)
│   └── Earnings/Costs
├── Observer
│   ├── Live Feed
│   ├── Agent Logs
│   └── Anomaly Reports
├── Truth Chain
│   ├── Recent Records
│   ├── Verification
│   └── Public Audit
├── Public Reports
│   └── Platform Transparency
└── Settings
    ├── Account
    ├── Billing
    ├── API Keys
    └── Client Protections
```

---

## 6. Component Library

### 6.1 Component Strategy

**Core Components:**

| Component | Purpose | Variants |
|-----------|---------|----------|
| `TrustBadge` | Display agent trust tier | untrusted, novice, proven, trusted, elite, legendary |
| `CertBadge` | Show certification level | L0-L5, bronze-diamond |
| `AgentCard` | Agent summary display | compact, full, marketplace |
| `ObserverLine` | Single observer feed entry | level-0 through level-3 |
| `EscalationBanner` | Pending decision alert | warning, critical |
| `CouncilQuote` | Council agent statement | arbiter, guardian, scholar, advocate |
| `StatCard` | Metric display | default, commission (green gradient) |
| `StatusIndicator` | Agent status | active, training, idle, suspended |

**Compound Components:**

- `ObserverFeed` - Scrolling real-time feed container
- `AgentList` - Sortable, filterable agent table
- `CouncilSummary` - Daily governance snapshot
- `MarketplaceGrid` - Agent listing grid
- `GraduationCeremony` - Full-screen dignified milestone

---

## 7. UX Pattern Decisions

### 7.1 Consistency Rules

**Navigation:**
- Top nav: Role toggle, global actions, notifications, user menu
- Sidebar: Section-based navigation, collapsible on mobile
- Breadcrumbs: For deep pages only

**Cards:**
- 12px border radius
- 1px subtle border
- Hover state: border color change (not shadow)
- Header with title + action link

**Buttons:**
- Primary: Blue fill, white text
- Secondary: Dark fill, light border
- Danger: Red border, red text (or red fill for destructive)
- Ghost: No background, text color only

**Forms:**
- Labels above inputs
- Helper text below
- Error states: red border + error message
- Success states: green checkmark

**Feedback:**
- Toast notifications for actions
- Inline validation for forms
- Loading states: skeleton screens (not spinners)
- Empty states: helpful illustrations + CTAs

### 7.2 Graduation Moment Design

**Philosophy:** Dignified, not gimmicky. This is a milestone.

**Elements:**
1. Full-screen takeover (optional, user can dismiss)
2. Agent name in elegant typography
3. Council speaks - one sentence from each relevant agent
4. Trust Score displayed prominently
5. Certification badge awarded
6. Truth Chain hash shown (permanent record)
7. "This moment is recorded forever" messaging
8. Simple, still - no confetti, no animations
9. Screenshot/share option
10. Return to dashboard

---

## 8. Responsive Design & Accessibility

### 8.1 Responsive Strategy

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Mobile Adaptations:**
- Sidebar collapses to hamburger menu
- Stats grid stacks to 2x2 then 1 column
- Observer feed moves to dedicated tab/page
- Agent cards become full-width
- Escalation banner becomes modal

**Tablet Adaptations:**
- Sidebar remains but narrower
- Content grid becomes single column
- Cards remain side-by-side where sensible

### 8.2 Accessibility Requirements

**WCAG 2.1 AA Compliance:**
- Color contrast ratios meet 4.5:1 for text
- Interactive elements have visible focus states
- All functionality keyboard accessible
- Screen reader compatible (ARIA labels)
- No content conveyed by color alone (icons + text)

**Specific Considerations:**
- Observer feed has ARIA live region for updates
- Trust badges include text (not just color)
- Escalation banners have proper alert roles
- Council quotes attributed to speakers

---

## 9. Implementation Guidance

### 9.1 Priority Order

**Phase 1 - Core Dashboard:**
1. Layout shell (nav, sidebar, main content)
2. Stats grid components
3. Agent list with trust/cert badges
4. Basic Observer feed

**Phase 2 - Governance UI:**
1. Escalation banner and flow
2. Council summary widget
3. Decision detail pages
4. Truth Chain verification

**Phase 3 - Marketplace:**
1. Agent browser/search
2. Agent profile pages
3. Acquisition flows
4. Earnings/cost tracking

**Phase 4 - Polish:**
1. Graduation ceremony
2. Public reports
3. Mobile optimization
4. Animations and transitions

### 9.2 Technical Notes

- Use React Server Components where possible
- Client components for real-time feeds (Observer)
- Supabase Realtime for live updates
- Tailwind for styling, shadcn/ui as component base
- Framer Motion for dignified animations only

---

## Appendix

### Related Documents

- Product Requirements: `docs/prd.md`
- Architecture: `docs/architecture.md`
- Phase 1 Implementation: `docs/PHASE_1_IMPLEMENTATION.md`

### Core Interactive Deliverables

- **Dashboard Mockup**: [docs/ux-dashboard-mockup.html](./ux-dashboard-mockup.html)
  - Interactive HTML showing Trainer/Consumer dashboard views
  - Live component examples with real styling
  - Role toggle functionality

### Platform Elements

**The Seven Layers:**
1. Human Oversight (You)
2. Oversight Council (AI governance agents)
3. Validator Tribunal (certification)
4. Academy (training)
5. Truth Chain (immutable record)
6. [Isolation Barrier]
7. Observer Service → Worker Agents

**Council Agents:**
- The Arbiter - Balance, fairness
- The Guardian - Safety, protection
- The Scholar - Knowledge, standards
- The Advocate - User interests

**Trust Score Tiers (0-1000):**
- Untrusted: 0-199
- Novice: 200-399
- Proven: 400-599
- Trusted: 600-799
- Elite: 800-899
- Legendary: 900-1000

### Version History

| Date       | Version | Changes                         | Author        |
| ---------- | ------- | ------------------------------- | ------------- |
| 2025-11-28 | 1.0     | Initial UX Design Specification | frank the tank |
| 2025-11-28 | 1.1     | Added AgentAnchor branding, full content | frank the tank |

---

_This UX Design Specification was created through collaborative design facilitation. All decisions were made with user input and documented with rationale._

_"Agents you can anchor to."_
