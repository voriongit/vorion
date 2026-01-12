# AgentAnchor - Epic Breakdown

**Author:** frank the tank
**Date:** 2025-12-05
**Project Level:** Enterprise SaaS
**Target Scale:** 100 Trainers, 500 Consumers, 1000 Agents (MVP)

---

## Overview

This document provides the complete epic and story breakdown for AgentAnchor, decomposing the 149 functional requirements from the [PRD](./prd.md) into implementable stories.

**Key Architecture Changes (v3.0):**
- **Council of Nine** - 9 specialized validators (not 4) + 3 Elder Wisdom advisors
- **Unified Marketplace** - Single marketplace with Live Ticker, prebuilt agents, and custom requests
- **Founding Agents** - 150+ seed agents imported from AI Workforce and BAI CC
- **LangGraph.js** - Agent orchestration framework for stateful governance workflows

### Epic Summary

| Epic | Title | Stories | Key Value |
|------|-------|---------|-----------|
| 1 | Foundation & Infrastructure | 5 | Platform deployable, users can register |
| 2 | Agent Creation & Academy | 6 | Trainers create and train agents |
| 3 | Council of Nine Governance | 5 | 9-validator tribunal with precedent |
| 4 | Trust Score System | 4 | Trust earned through behavior |
| 5 | Observer & Truth Chain | 5 | Complete audit trail and verification |
| 6 | Unified Marketplace | 7 | Live Ticker, prebuilt, custom requests |
| 7 | Dashboard & Notifications | 5 | Unified management interface |
| 8 | API & Integration | 4 | External system integration |

**Total:** 8 Epics, 41 Stories

---

## Functional Requirements Inventory

### User Account & Access (FR1-FR8)
- FR1: Users can create accounts with email and password
- FR2: Users can authenticate with MFA
- FR3: Users can reset passwords via email
- FR4: Users can manage profile and notifications
- FR5: Users can choose role: Trainer, Consumer, or Both
- FR6: Trainers can manage storefront profile
- FR7: Consumers can view agent portfolio and usage
- FR8: Users can view subscription tier and usage

### Trainer Features (FR9-FR22)
- FR9: Trainers can create new AI agents
- FR10: Trainers can specify agent purpose/capabilities
- FR11: Trainers can enroll agents in Academy
- FR12: Trainers can publish agents to marketplace
- FR13: Trainers can set commission rates
- FR14: Trainers can set clone pricing (Growth)
- FR15: Trainers can enable Enterprise Lock (Growth)
- FR16: Trainers can view earnings dashboard
- FR17: Trainers can withdraw earnings
- FR18-FR22: Maintenance delegation features (Growth)

### Consumer Features (FR23-FR34)
- FR23: Consumers can browse marketplace
- FR24: Consumers can search/filter agents
- FR25: Consumers can view agent profiles
- FR26: Consumers can view Observer reports
- FR27: Consumers can acquire agents (commission)
- FR28-FR29: Clone/Enterprise acquisition (Growth)
- FR30: Consumers can view usage and costs
- FR31: Consumers can provide feedback
- FR32-FR34: Client protection features

### Agent Lifecycle (FR35-FR40)
- FR35: New agents start at Trust Score 0
- FR36: Agents must complete Academy to publish
- FR37: Agents receive Trust Score upon graduation
- FR38: Users can view agent history
- FR39: Agents can be archived
- FR40: Agents cannot be deleted (Truth Chain)

### The Academy (FR41-FR49)
- FR41: New agents enroll in Core Curriculum
- FR42: Academy provides structured training
- FR43: Agents progress through curriculum
- FR44: Trainers observe training progress
- FR45: Agents must pass Council examination
- FR46: Graduated agents receive Trust Score 200-399
- FR47: Specialization tracks (Growth)
- FR48: Elite mentorship (Growth)
- FR49: Graduation recorded on Truth Chain

### Trust Score System (FR50-FR57)
- FR50: Every agent has Trust Score 0-1000
- FR51: Score increases with successful tasks
- FR52: Score decreases with Council denials
- FR53: Score determines Trust Tier
- FR54: Tier determines autonomy limits
- FR55: Users can view score history
- FR56: Inactive agents decay
- FR57: Recovery through probation

### The Council (FR58-FR67) - UPDATED FOR COUNCIL OF NINE
- FR58: Council has specialized validators
- FR59: **9 Core Validators:** Guardian, Arbiter, Scholar, Advocate, Economist, Sentinel, Adversary, Oracle, Orchestrator
- FR59b: **3 Elder Wisdom Advisors:** Steward, Conscience, Witness (advisory only)
- FR60: Council evaluates by Risk Level
- FR61: Level 0-1: Auto-execute (logged)
- FR62: Level 2: 3-Bot Review approval
- FR63: Level 3: Full Council (5/9) majority
- FR64: Level 4: Supermajority (7/9) + human
- FR65: Decisions include reasoning from all 9 validators
- FR66: Precedent library built
- FR67: Decisions reference precedent

### Upchain Protocol (FR68-FR75)
- FR68: Workers request via Upchain
- FR69: Requests include action, justification, risk
- FR70: Validators vote on requests
- FR71: Voting rules by risk level
- FR72: Denied requests return reasoning
- FR73: Approved requests proceed
- FR74: Deadlocks escalate to human
- FR75: All decisions on Truth Chain

### Human-in-the-Loop (FR76-FR81)
- FR76: Humans notified for escalations
- FR77: Humans approve/deny with comments
- FR78: Humans can override Council
- FR79: Human decisions become precedent
- FR80: Configurable notification channels
- FR81: Human role configurable

### Observer Layer (FR82-FR91)
- FR82: Observers record every action
- FR83: Logs are append-only
- FR84: Logs include crypto signatures
- FR85: Observers isolated from Worker/Council
- FR86: Observers cannot influence behavior
- FR87: Real-time Observer feed
- FR88: Filterable by agent, action, risk
- FR89: Exportable for compliance
- FR90: Anomaly detection
- FR91: Automated compliance reports

### Truth Chain (FR92-FR100)
- FR92: All Council decisions recorded
- FR93: All certifications recorded
- FR94: All human overrides recorded
- FR95: All ownership changes recorded
- FR96: Records cryptographically linked
- FR97: Timestamps and signatures
- FR98: Public verification API
- FR99: Public verification URLs
- FR100: Records exportable

### Marketplace (FR101-FR108) - UPDATED FOR UNIFIED MARKETPLACE
- FR101: Trainers list agents
- FR102: Listing includes description, pricing
- FR103: Shows Trust Score and tier
- FR104: Shows consumer ratings
- FR105: Shows Observer summary
- FR106: Search by category, score, price
- FR107: **Live Ticker** shows real-time activity
- FR107b: **Custom Agent Requests** with Trainer bidding
- FR108: Trainer storefront pages

### Commission & Payments (FR109-FR115)
- FR109: Commission per usage
- FR110: Complexity multiplier
- FR111: Platform commission by tier
- FR112: Real-time earnings tracking
- FR113: Payout schedule
- FR114: Payment methods
- FR115: Earnings history

### MIA & Maintenance (FR116-FR122) - GROWTH
- FR116-FR122: All deferred to Growth phase

### Client Protection (FR123-FR128)
- FR123: Ownership change notifications
- FR124: 30-day notice period
- FR125: Consumer opt-out flow
- FR126: Walk away clean termination
- FR127: Platform continuity
- FR128: Decisions on Truth Chain

### Dashboard (FR129-FR136)
- FR129: Role toggle Trainer/Consumer
- FR130: Trainer dashboard
- FR131: Consumer dashboard
- FR132: Academy tab
- FR133: Council tab
- FR134: Observer tab
- FR135: Marketplace tab
- FR136: Truth Chain tab

### Notifications (FR137-FR143)
- FR137: Escalation alerts
- FR138: Graduation notifications
- FR139: Anomaly alerts
- FR140: Ownership change notifications
- FR141: Earnings milestones
- FR142: Configurable per type
- FR143: Email, in-app, webhook

### API & Integration (FR144-FR149)
- FR144: RESTful API
- FR145: API key authentication
- FR146: Webhook support
- FR147: Public verification API
- FR148: Rate limiting
- FR149: OpenAPI 3.0 spec

---

## FR Coverage Map

| Epic | FRs Covered |
|------|-------------|
| Epic 1 | FR1-FR8 (User Account) |
| Epic 2 | FR9-FR11, FR35-FR49 (Agent + Academy) |
| Epic 3 | FR58-FR75, FR76-FR81 (Council of Nine + HITL) |
| Epic 4 | FR50-FR57 (Trust Score) |
| Epic 5 | FR82-FR100 (Observer + Truth Chain) |
| Epic 6 | FR12-FR13, FR23-FR31, FR101-FR115 (Unified Marketplace) |
| Epic 7 | FR129-FR143 (Dashboard + Notifications) |
| Epic 8 | FR144-FR149 (API) |

**Deferred to Growth:** FR14-FR22, FR28-FR29, FR32-FR34, FR47-FR48, FR116-FR128

---

## Epic 1: Foundation & Infrastructure

**Goal:** Establish the platform foundation so developers can deploy and users can access the system.

**User Value:** Users can register, authenticate, and access a working platform with role selection.

**FRs Covered:** FR1-FR8

---

### Story 1.1: Project Setup & Deployment Pipeline

As a **developer**,
I want the project scaffolded with CI/CD pipeline,
So that code changes automatically deploy to staging/production.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** I run `npm install && npm run dev`
**Then** the application starts locally on port 3000

**And** given a push to the `main` branch
**When** GitHub Actions workflow triggers
**Then** the app deploys to Vercel preview environment

**And** given a merge to `production` branch
**When** deployment completes
**Then** the app is live at app.agentanchorai.com

**Prerequisites:** None (first story)

**Technical Notes:**
- Next.js 14 with App Router (per Architecture v3.0)
- TypeScript 5.x strict mode
- Tailwind CSS + shadcn/ui components
- Supabase for auth and database
- Vercel for hosting
- GitHub Actions for CI/CD
- Sentry for error tracking
- Environment variables for all secrets

---

### Story 1.2: Database Schema & Supabase Setup

As a **developer**,
I want the core database schema deployed,
So that all features have proper data persistence.

**Acceptance Criteria:**

**Given** Supabase project is configured
**When** migrations run
**Then** all core tables exist: users, agents, trust_history, council_decisions, truth_chain, observer_events, marketplace_listings, acquisitions, custom_requests, request_bids

**And** given Row Level Security policies
**When** a user queries agents
**Then** they only see their own agents or public marketplace listings

**And** given the schema
**When** I inspect foreign key relationships
**Then** all entities are properly linked per Architecture v3.0 section 8

**Prerequisites:** Story 1.1

**Technical Notes:**
- Use Drizzle ORM for schema management
- Implement RLS policies per Architecture section 12
- Create indexes for common queries
- Set up database functions for trust tier calculation
- Configure realtime subscriptions for Observer feed and Live Ticker
- Include tables for Council of Nine: council_decisions with 9-vote structure

---

### Story 1.3: User Registration & Authentication

As a **user**,
I want to create an account and log in securely,
So that I can access the platform.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter valid email and password (8+ chars, 1 uppercase, 1 number, 1 special)
**Then** my account is created and I receive a verification email

**And** given I click the verification link within 15 minutes
**When** the page loads
**Then** my email is verified and I can log in

**And** given I am on the login page with valid credentials
**When** I submit the form
**Then** I am authenticated and redirected to dashboard

**And** given I am logged in
**When** I click "Forgot Password"
**Then** I receive a password reset email (FR3)

**Prerequisites:** Story 1.2

**Technical Notes:**
- Supabase Auth for authentication
- Email verification required before first login
- Password strength meter with visual feedback
- Rate limit: 5 login attempts per hour per IP
- Session tokens with 24-hour expiry
- Responsive design with 44x44px touch targets

---

### Story 1.4: User Profile & Role Selection

As a **user**,
I want to set up my profile and choose my role,
So that I can use the platform as Trainer, Consumer, or Both.

**Acceptance Criteria:**

**Given** I am a newly verified user
**When** I complete onboarding
**Then** I must select role: Trainer, Consumer, or Both (FR5)

**And** given I am logged in
**When** I visit /settings/profile
**Then** I can edit my name, avatar, and notification preferences (FR4)

**And** given I selected "Trainer" role
**When** I view my profile
**Then** I see storefront settings section (FR6)

**And** given I selected "Consumer" role
**When** I view dashboard
**Then** I see my agent portfolio and usage summary (FR7)

**Prerequisites:** Story 1.3

**Technical Notes:**
- Onboarding wizard for new users (3 steps max)
- Role stored in users table
- Role can be changed in settings
- Subscription tier display (FR8) - default to Free

---

### Story 1.5: Basic Navigation & Layout

As a **user**,
I want a consistent navigation experience,
So that I can easily find platform features.

**Acceptance Criteria:**

**Given** I am logged in
**When** I view any page
**Then** I see sidebar navigation with: Dashboard, Agents, Academy, Council, Observer, Marketplace, Truth Chain

**And** given I am on desktop (>1024px)
**When** sidebar is visible
**Then** it shows icons + labels, collapsible to icons only

**And** given I am on mobile (<768px)
**When** I tap hamburger menu
**Then** sidebar slides in as overlay

**And** given I have Trainer role
**When** I view navigation
**Then** I see "My Agents" and "Earnings" options

**Prerequisites:** Story 1.4

**Technical Notes:**
- shadcn/ui Sidebar component
- Role-based menu items
- Active state highlighting
- Breadcrumb navigation on inner pages
- Global search in header (placeholder for MVP)

---

## Epic 2: Agent Creation & Academy

**Goal:** Enable Trainers to create AI agents and train them through the Academy system.

**User Value:** Trainers can build agents from scratch, enroll them in training, and graduate them for marketplace publishing.

**FRs Covered:** FR9-FR11, FR35-FR49

---

### Story 2.1: Create New Agent

As a **Trainer**,
I want to create a new AI agent,
So that I can start building my bot's capabilities.

**Acceptance Criteria:**

**Given** I am a Trainer on /agents/new
**When** I fill in agent name, description, and purpose
**Then** I can create the agent

**And** given the agent is created
**When** I view its profile
**Then** Trust Score shows 0 (Untrusted) with red badge (FR35)

**And** given I specify capabilities
**When** I save the agent
**Then** system_prompt is stored with my specifications (FR10)

**And** given I try to publish an untrained agent
**When** I click "Publish"
**Then** I see error: "Agent must complete Academy training first" (FR36)

**Prerequisites:** Epic 1 complete

**Technical Notes:**
- Agent creation form with validation
- Model selection: claude-sonnet-4-20250514 default
- System prompt builder with templates
- Capability tags for categorization
- Auto-save draft functionality
- LangGraph.js agent definition structure

---

### Story 2.2: Academy Enrollment

As a **Trainer**,
I want to enroll my agent in the Academy,
So that it can begin structured training.

**Acceptance Criteria:**

**Given** I have an Untrusted agent (Score 0)
**When** I click "Enroll in Academy"
**Then** agent is enrolled in Core Curriculum (FR41)

**And** given enrollment is complete
**When** I view Academy tab
**Then** I see curriculum: "Platform Fundamentals", "Safety & Ethics", "Council Integration"

**And** given agent is enrolled
**When** I view agent status
**Then** it shows "Training" state

**Prerequisites:** Story 2.1

**Technical Notes:**
- Academy enrollment creates curriculum record
- Core Curriculum is mandatory for all agents
- Curriculum modules are sequential
- Progress tracked in academy_progress table

---

### Story 2.3: Training Progress & Curriculum

As a **Trainer**,
I want to observe my agent's training progress,
So that I know when it's ready for examination.

**Acceptance Criteria:**

**Given** my agent is enrolled in Academy
**When** I view /academy/[agentId]
**Then** I see progress through each module (FR43, FR44)

**And** given a module is completed
**When** progress updates
**Then** I see completion percentage and checkmark

**And** given all modules are complete
**When** I view the agent
**Then** "Request Examination" button is enabled

**Prerequisites:** Story 2.2

**Technical Notes:**
- Progress visualization with progress bar
- Module completion triggers next module unlock
- Training content stored as markdown
- Simulated training for MVP (actual AI training is future)

---

### Story 2.4: Council Examination

As a **Trainer**,
I want my agent to be examined by the Council of Nine,
So that it can graduate and be published.

**Acceptance Criteria:**

**Given** my agent completed all curriculum
**When** I click "Request Examination"
**Then** examination request is sent to Council of Nine (FR45)

**And** given Council examines the agent
**When** 5 of 9 validators approve (majority)
**Then** agent passes examination

**And** given examination passes
**When** I view results
**Then** I see all 9 validators' votes and reasoning (FR65)

**And** given examination fails
**When** I view results
**Then** I see which validator(s) denied and why, with Orchestrator synthesis

**Prerequisites:** Story 2.3, Epic 3 (Council) must be started

**Technical Notes:**
- Examination is Council decision with risk_level = 2
- Requires majority (5/9) validators to pass
- All 9 votes recorded with individual rationales
- Orchestrator provides synthesis
- Failed exams can be retried after 24 hours

---

### Story 2.5: Agent Graduation

As a **Trainer**,
I want my agent to graduate from the Academy,
So that it receives Trust Score and can be published.

**Acceptance Criteria:**

**Given** my agent passed examination
**When** graduation processes
**Then** agent receives initial Trust Score between 200-399 (FR46)

**And** given graduation completes
**When** I view agent profile
**Then** Trust Tier shows "Probation" (200-249) or "Developing" (250-399)

**And** given graduation occurs
**When** I check Truth Chain
**Then** graduation is recorded with timestamp and signature (FR49)

**And** given agent is graduated
**When** I view status
**Then** "Publish to Marketplace" button is enabled

**Prerequisites:** Story 2.4

**Technical Notes:**
- Initial Trust Score: 200-399 based on exam performance
- Graduation ceremony UI with animation
- Truth Chain record created immediately
- Status changes from "Training" to "Active"
- Notification sent to Trainer

---

### Story 2.6: Agent History & Archive

As a **Trainer**,
I want to view my agent's complete history and archive old agents,
So that I can track progress and manage my portfolio.

**Acceptance Criteria:**

**Given** I view an agent's profile
**When** I click "History" tab
**Then** I see complete timeline: creation, enrollment, training, graduation, actions (FR38)

**And** given I want to retire an agent
**When** I click "Archive"
**Then** agent is archived but audit trail preserved (FR39)

**And** given I try to delete an agent
**When** I look for delete option
**Then** there is none - agents cannot be deleted (FR40)

**Prerequisites:** Story 2.5

**Technical Notes:**
- History timeline component with infinite scroll
- Archive sets status = 'archived'
- Archived agents excluded from marketplace
- Truth Chain records immutable

---

## Epic 3: Council of Nine Governance

**Goal:** Implement the Council of Nine governance layer that validates and approves agent actions.

**User Value:** All significant agent actions are reviewed by 9 specialized validators, creating unprecedented trust through oversight.

**FRs Covered:** FR58-FR75, FR76-FR81

---

### Story 3.1: Council of Nine Validator Agents

As the **platform**,
I want 9 specialized Council validator agents plus 3 Elder Wisdom advisors,
So that governance decisions have comprehensive domain expertise.

**Acceptance Criteria:**

**Given** the platform initializes
**When** Council is set up
**Then** 9 core validators exist (FR58, FR59):
1. Guardian (Safety & Risk)
2. Arbiter (Justice & Precedent)
3. Scholar (Knowledge & Analysis)
4. Advocate (User Champion)
5. Economist (Value & Sustainability)
6. Sentinel (Compliance & Regulation)
7. Adversary (Red Team)
8. Oracle (Long-term Consequences)
9. Orchestrator (Synthesis & Tie-breaker)

**And** given Elder Wisdom Council
**When** I view advisors
**Then** 3 advisory bots exist: Steward, Conscience, Witness (non-voting)

**And** given any validator
**When** evaluating a request
**Then** it provides vote, rationale, and confidence score

**Prerequisites:** Epic 1 complete

**Technical Notes:**
- Each validator is a Claude instance with specific system prompt
- Validators defined per Architecture v3.0 section 3
- Validators return: decision, reasoning, confidence (0-100)
- Temperature = 0 for deterministic governance
- LangGraph.js for parallel validator execution
- Elder Wisdom advisors inform but don't vote

---

### Story 3.2: Risk Level Classification

As the **platform**,
I want actions classified by risk level,
So that appropriate approval is required.

**Acceptance Criteria:**

**Given** an agent action request
**When** the system classifies it
**Then** risk level is assigned 0-4 (FR60)

**And** given Level 0-1 (Routine/Standard)
**When** action is requested
**Then** it executes automatically with logging (FR61)

**And** given Level 2 (Elevated)
**When** action is requested
**Then** 3-Bot Review must approve (FR62)

**And** given Level 3 (Significant)
**When** action is requested
**Then** Full Council majority (5/9) must approve (FR63)

**And** given Level 4 (Critical)
**When** action is requested
**Then** Supermajority (7/9) + human confirmation required (FR64)

**Prerequisites:** Story 3.1

**Technical Notes:**
- Risk classification uses pattern matching + AI assessment
- Level 0: Read data, format text
- Level 1: Generate content, analyze
- Level 2: External API call, create file
- Level 3: Modify system, send email
- Level 4: Delete data, financial action

---

### Story 3.3: Upchain Decision Protocol

As a **worker agent**,
I want to request Council approval via Upchain,
So that high-risk actions are properly governed.

**Acceptance Criteria:**

**Given** a worker agent needs to perform Level 2+ action
**When** it calls the Upchain API
**Then** request is submitted with action, justification, risk assessment (FR68, FR69)

**And** given request is submitted
**When** all 9 Council validators evaluate in parallel
**Then** each votes: approve, deny, or abstain with rationale (FR70)

**And** given voting completes per risk level rules
**When** threshold met (3-bot, 5/9, or 7/9)
**Then** Orchestrator synthesizes final decision with reasoning (FR71, FR72, FR73)

**And** given a deadlock occurs (4-4-1)
**When** no clear majority
**Then** request escalates to human (FR74)

**Prerequisites:** Story 3.2

**Technical Notes:**
- POST /api/council/request endpoint
- Request includes: agentId, action, details, justification
- LangGraph.js parallel evaluation of all 9 validators
- Orchestrator synthesizes, resolves ties
- Decision timeout: 30 seconds
- All decisions recorded to Truth Chain (FR75)

---

### Story 3.4: Precedent Library

As the **Council**,
I want to build a precedent library,
So that future decisions are consistent.

**Acceptance Criteria:**

**Given** a Council decision is made
**When** decision is significant (creates new pattern)
**Then** it's marked as precedent (FR66)

**And** given a new request comes in
**When** Council evaluates
**Then** Arbiter retrieves relevant precedents and references them (FR67)

**And** given precedent exists for similar action
**When** validators reason
**Then** reasoning includes: "Per precedent #123: [reasoning]"

**And** given I view Council tab
**When** I click "Precedents"
**Then** I see searchable list of all precedents

**Prerequisites:** Story 3.3

**Technical Notes:**
- Precedents stored in council_decisions with creates_precedent = true
- Vector similarity search for relevant precedents
- Arbiter validator specifically handles precedent matching
- Manual precedent flagging by human reviewers

---

### Story 3.5: Human Escalation & Override

As a **human operator**,
I want to handle escalations and override Council when needed,
So that human judgment remains supreme.

**Acceptance Criteria:**

**Given** a Level 4 action or deadlock
**When** escalation triggers
**Then** I receive notification via configured channel (FR76, FR80)

**And** given I review escalation
**When** I approve or deny
**Then** decision includes my comments (FR77)

**And** given I disagree with Council
**When** I click "Override"
**Then** my decision supersedes Council, logged to Truth Chain (FR78)

**And** given I make a decision
**When** it's significant
**Then** it becomes precedent for future Council decisions (FR79)

**And** given I am setting up my account
**When** I configure human role
**Then** I can set level: Teacher, Judge, Auditor, or Guardian (FR81)

**Prerequisites:** Story 3.4

**Technical Notes:**
- Escalation notifications via email and in-app
- Override requires MFA confirmation
- Human decisions have special flag in Truth Chain
- Escalation queue in dashboard

---

## Epic 4: Trust Score System

**Goal:** Implement the Trust Score system that quantifies agent reliability.

**User Value:** Users can objectively assess agent trustworthiness through earned scores rather than configured permissions.

**FRs Covered:** FR50-FR57

---

### Story 4.1: Trust Score Display & Tiers

As a **user**,
I want to see an agent's Trust Score and Tier,
So that I can assess its trustworthiness.

**Acceptance Criteria:**

**Given** I view any agent profile
**When** page loads
**Then** I see Trust Score (0-1000) prominently displayed (FR50)

**And** given Trust Score tiers per Architecture v3.0:
- 0-99: Untrusted (red)
- 100-249: Probation (orange)
- 250-499: Developing (yellow)
- 500-749: Established (blue)
- 750-899: Trusted (emerald)
- 900-1000: Legendary (gold)

**And** given I view tier badge
**Then** I see appropriate color and label (FR53)

**Prerequisites:** Epic 2 complete

**Technical Notes:**
- TrustBadge component with score and tier
- Tier calculated via database function get_trust_tier()
- Tooltip shows tier benefits and autonomy level
- Score displayed as "742 / 1000" format

---

### Story 4.2: Trust Score Changes

As an **agent**,
I want my Trust Score to change based on behavior,
So that trust is earned through demonstrated reliability.

**Acceptance Criteria:**

**Given** I complete a task successfully
**When** task is logged
**Then** Trust Score increases (FR51)

**And** given Council denies my action
**When** denial is recorded
**Then** Trust Score decreases (FR52)

**And** given I receive positive consumer feedback
**When** feedback is submitted
**Then** Trust Score increases

**And** given I violate a policy
**When** violation is flagged
**Then** Trust Score decreases significantly

**Prerequisites:** Story 4.1

**Technical Notes:**
- Score changes logged to trust_history table
- Increase amounts: +1 (task), +5 (commendation), +10 (milestone)
- Decrease amounts: -5 (denial), -20 (complaint), -50 (violation)
- Event-driven updates via database triggers

---

### Story 4.3: Trust Score History & Trends

As a **user**,
I want to view an agent's Trust Score history,
So that I can see how trust has evolved over time.

**Acceptance Criteria:**

**Given** I view agent profile
**When** I click "Trust History"
**Then** I see timeline of all score changes (FR55)

**And** given history view
**When** I look at chart
**Then** I see score trend line over time

**And** given a score change entry
**When** I view details
**Then** I see: timestamp, previous score, new score, reason, source

**Prerequisites:** Story 4.2

**Technical Notes:**
- Recharts line chart for trend visualization
- Trust history stored with full audit trail
- Milestone markers at tier boundaries
- Export as CSV for compliance

---

### Story 4.4: Trust Decay & Autonomy Limits

As the **platform**,
I want inactive agents to decay and tiers to limit autonomy,
So that trust requires ongoing demonstration.

**Acceptance Criteria:**

**Given** an agent is inactive for 7+ days
**When** decay timer triggers
**Then** Trust Score decreases by 1 point (FR56)

**And** given decay reduces score below tier threshold
**When** new tier is calculated
**Then** tier updates with notification to Trainer

**And** given agent's Trust Tier
**When** it attempts action
**Then** action is limited by tier autonomy rules (FR54)

**And** given agent enters probation (score dropped significantly)
**When** probation period ends with good behavior
**Then** trust can recover (FR57)

**Prerequisites:** Story 4.3

**Technical Notes:**
- Decay runs via scheduled function (daily)
- Minimum decay floor at tier boundary - 10
- Autonomy levels per Architecture v3.0 section 13.3
- Probation = 30 days of supervised operation
- ProbationIndicator component for UI

---

## Epic 5: Observer & Truth Chain

**Goal:** Implement the immutable audit layer that records all actions and decisions.

**User Value:** Complete transparency and auditability - every action can be traced and verified.

**FRs Covered:** FR82-FR100

---

### Story 5.1: Observer Event Logging

As the **Observer service**,
I want to record every agent action,
So that complete audit trail exists.

**Acceptance Criteria:**

**Given** any agent performs an action
**When** action completes
**Then** Observer logs event with timestamp and details (FR82)

**And** given event is logged
**When** I try to modify it
**Then** modification is rejected - logs are append-only (FR83)

**And** given event is created
**When** I view signature
**Then** it includes cryptographic signature (FR84)

**And** given I view Observer architecture
**When** I check network paths
**Then** Observer is isolated from Worker/Council (FR85, FR86)

**Prerequisites:** Epic 1 complete

**Technical Notes:**
- Observer logs to separate database/schema
- Append-only enforced via RLS policies
- Signature uses platform signing key
- Event schema: id, sequence, source, type, data, timestamp, hash
- No write path from Observer to operational systems

---

### Story 5.2: Observer Dashboard Feed

As a **user**,
I want to view real-time Observer feed,
So that I can monitor agent activity.

**Acceptance Criteria:**

**Given** I am on Observer tab
**When** page loads
**Then** I see real-time event feed (FR87)

**And** given the feed is active
**When** new events occur
**Then** they appear at top without refresh

**And** given I want to filter events
**When** I select filters
**Then** I can filter by agent, action type, risk level, time range (FR88)

**And** given I need compliance export
**When** I click "Export"
**Then** I receive filtered events as CSV/JSON (FR89)

**Prerequisites:** Story 5.1

**Technical Notes:**
- Pusher for real-time updates
- Pagination with infinite scroll
- Filter state persisted in URL
- Export limited to 10,000 events per request

---

### Story 5.3: Anomaly Detection

As the **Observer service**,
I want to detect anomalies in agent behavior,
So that problems are flagged early.

**Acceptance Criteria:**

**Given** Observer is monitoring
**When** unusual pattern detected (high error rate, rapid actions, etc.)
**Then** anomaly is flagged (FR90)

**And** given anomaly is flagged
**When** severity is high
**Then** alert is sent to relevant users (FR139)

**And** given I view Observer dashboard
**When** anomalies exist
**Then** I see anomaly section with details

**Prerequisites:** Story 5.2

**Technical Notes:**
- Anomaly detection via pattern matching
- Types: spike (>3x normal), error_cluster, timing_anomaly
- Severity: low (log), medium (alert), high (pause agent)
- Anomaly stored in observer_anomalies table

---

### Story 5.4: Truth Chain Records

As the **Truth Chain service**,
I want to record immutable decision records,
So that governance is verifiable forever.

**Acceptance Criteria:**

**Given** Council makes a decision
**When** decision is finalized
**Then** record is created on Truth Chain (FR92)

**And** given agent graduates
**When** graduation completes
**Then** certification is recorded on Truth Chain (FR93)

**And** given human overrides Council
**When** override is executed
**Then** override is recorded on Truth Chain (FR94)

**And** given ownership changes
**When** change is processed
**Then** change is recorded on Truth Chain (FR95)

**And** given a new record
**When** it's created
**Then** it includes hash of previous record (FR96) with timestamp and signature (FR97)

**Prerequisites:** Story 5.1

**Technical Notes:**
- Hash chain: SHA-256(previous_hash + payload + timestamp)
- Records stored in truth_chain table
- Sequence number for ordering
- Future: Trillian integration for verifiable logs

---

### Story 5.5: Public Verification

As **anyone**,
I want to verify records without authentication,
So that trust can be externally validated.

**Acceptance Criteria:**

**Given** I have a record hash
**When** I visit /verify/[hash]
**Then** I see verification result without needing login (FR98)

**And** given a certification
**When** I access its public URL
**Then** I see verification page with certificate details (FR99)

**And** given I need legal documentation
**When** I request export
**Then** I receive cryptographically signed record package (FR100)

**Prerequisites:** Story 5.4

**Technical Notes:**
- Public API requires no authentication
- Verification URL format: /verify/[hash]
- Verification checks: hash integrity, chain continuity
- Certificate displays agent name, graduation date, initial score

---

## Epic 6: Unified Marketplace

**Goal:** Enable a single marketplace experience with Live Ticker, prebuilt agents, and custom requests.

**User Value:** Trainers publish and earn from agents; Consumers discover, acquire, and request custom agents - all with real-time activity visibility.

**FRs Covered:** FR12-FR13, FR23-FR31, FR101-FR115

---

### Story 6.1: Founding Agents Import

As the **platform**,
I want to import 150+ founding agents from AI Workforce and BAI CC,
So that the marketplace has activity from day 1.

**Acceptance Criteria:**

**Given** I have agent definitions from AI Workforce and BAI CC
**When** I run the import script
**Then** agents are created with appropriate metadata

**And** given imported agents
**When** they appear in marketplace
**Then** they have initial Trust Scores (200-400 based on source quality)

**And** given the Live Ticker
**When** marketplace launches
**Then** founding agents provide immediate activity

**Prerequisites:** Epic 2 complete

**Technical Notes:**
- Import script reads agent definitions (JSON/YAML)
- Agents assigned to platform Trainer account initially
- Founding agents marked with "Founding Collection" badge
- Trust Scores assigned based on complexity/quality assessment
- Categories auto-assigned based on capabilities

---

### Story 6.2: Agent Publishing

As a **Trainer**,
I want to publish my graduated agent to the marketplace,
So that Consumers can discover and use it.

**Acceptance Criteria:**

**Given** I have a graduated agent
**When** I click "Publish to Marketplace"
**Then** I enter publishing flow (FR12)

**And** given publishing flow
**When** I complete listing details
**Then** I set: description, category, tags, commission rate (FR13, FR102)

**And** given I set commission rate
**When** I view options
**Then** I see platform fee: 15% Free / 10% Pro / 7% Enterprise (FR111)

**And** given listing is complete
**When** I publish
**Then** agent appears in marketplace with Trust Score and tier (FR103)

**And** given publication completes
**When** I check Live Ticker
**Then** ticker shows: "🟢 [AgentName] listed (Trust: XXX)"

**Prerequisites:** Story 6.1, Epic 4

**Technical Notes:**
- Publishing creates marketplace_listings record
- Categories: General, Customer Service, Data Analysis, Creative, Development
- Tags are searchable
- Commission rate: 0.01-1.00 per task unit
- Pusher broadcasts to marketplace-activity channel

---

### Story 6.3: Live Ticker

As a **user**,
I want to see real-time marketplace activity,
So that I can see the platform is active and discover opportunities.

**Acceptance Criteria:**

**Given** I am on /marketplace
**When** page loads
**Then** I see Live Ticker at top with scrolling activity (FR107)

**And** given ticker is active
**When** agent is listed
**Then** ticker shows: "🟢 [AgentName] listed (Trust: XXX)"

**And** given ticker is active
**When** agent is acquired
**Then** ticker shows: "🔵 [AgentName] acquired by [Consumer]"

**And** given ticker is active
**When** custom request is posted
**Then** ticker shows: "🟡 Custom: [Title] - X bids"

**And** given ticker is active
**When** bid is placed
**Then** ticker shows: "🟠 New bid on [RequestTitle]"

**Prerequisites:** Story 6.2

**Technical Notes:**
- Pusher channel: marketplace-activity
- Event types: LISTING_CREATED, ACQUISITION_COMPLETE, REQUEST_CREATED, BID_PLACED
- Ticker holds last 50 events
- Auto-scrolling with pause on hover
- Mobile: condensed single-line format

---

### Story 6.4: Marketplace Browse & Search

As a **Consumer**,
I want to browse and search the marketplace,
So that I can find agents that meet my needs.

**Acceptance Criteria:**

**Given** I am on /marketplace
**When** page loads
**Then** I see tabs: Prebuilt Agents | Custom Requests | My Agents (FR23)

**And** given I am on Prebuilt Agents tab
**When** I use search/filters
**Then** I can filter by category, Trust Score range, price range, rating (FR24, FR106)

**And** given I view a listing card
**When** I look at details
**Then** I see: name, description, Trust Score badge, rating, price indicator

**And** given I want more details
**When** I click a listing
**Then** I go to full agent profile with Observer summary stats (FR25, FR105)

**Prerequisites:** Story 6.3

**Technical Notes:**
- Grid/List view toggle
- Pagination with 20 items per page
- Search uses full-text search on name, description, tags
- Trust Score filter: ranges (Any, 200+, 400+, 600+, 800+)
- Sort by: Trust Score, Rating, Price, Newest

---

### Story 6.5: Custom Agent Requests

As a **Consumer**,
I want to post a request for a custom agent,
So that Trainers can bid to build what I need.

**Acceptance Criteria:**

**Given** I am on Custom Requests tab
**When** I click "Post Request"
**Then** I can describe my needs with title, description, requirements, budget range

**And** given my request is posted
**When** Trainers view it
**Then** they see my requirements and can submit bids

**And** given bids are submitted
**When** I view my request
**Then** I see all bids with Trainer Trust Score, proposed price, timeline

**And** given I select a bid
**When** I confirm
**Then** Trainer is notified and work begins

**And** given request is posted
**When** I check Live Ticker
**Then** ticker shows: "🟡 Custom: [Title] posted"

**Prerequisites:** Story 6.4

**Technical Notes:**
- custom_requests table with status tracking
- request_bids table links Trainers to requests
- Bid includes: proposed_price, timeline, proposal text
- Consumer can message Trainers for clarification
- Status: open, bidding, selected, in_progress, completed, cancelled

---

### Story 6.6: Agent Acquisition (Commission Model)

As a **Consumer**,
I want to acquire an agent using the commission model,
So that I can use it for my work.

**Acceptance Criteria:**

**Given** I am viewing an agent I want
**When** I click "Acquire"
**Then** I see acquisition options (commission for MVP) (FR27)

**And** given I select commission model
**When** I confirm acquisition
**Then** agent is added to my portfolio

**And** given acquisition completes
**When** I view my dashboard
**Then** I see the agent in "My Agents" section (FR7)

**And** given I use the agent
**When** tasks complete
**Then** usage is tracked and I see costs (FR30)

**And** given acquisition completes
**When** I check Live Ticker
**Then** ticker shows: "🔵 [AgentName] acquired"

**Prerequisites:** Story 6.5

**Technical Notes:**
- Acquisition creates acquisitions record
- acquisition_type = 'commission' for MVP
- Usage tracked per task with complexity multiplier (FR110)
- No upfront payment required for commission model

---

### Story 6.7: Earnings Dashboard & Payouts

As a **Trainer**,
I want to view my earnings and receive payouts,
So that I'm compensated for my agents' work.

**Acceptance Criteria:**

**Given** I am a Trainer
**When** I visit /earnings
**Then** I see earnings dashboard (FR16)

**And** given my agents are used
**When** I view dashboard
**Then** I see real-time earnings tracking (FR112)

**And** given earnings exceed threshold
**When** payout period arrives
**Then** payout is processed (FR113)

**And** given I configure payout
**When** I set preferences
**Then** I can choose: bank transfer or crypto, weekly or threshold (FR114)

**And** given I want history
**When** I click "History"
**Then** I see all earnings and payouts with reports (FR115)

**Prerequisites:** Story 6.6

**Technical Notes:**
- Earnings calculated: (task_value × complexity) × (1 - platform_fee)
- Dashboard shows: today, this week, this month, all time
- Payout threshold: $100 minimum
- Stripe Connect for bank payouts
- FR17: Withdraw button triggers payout

---

## Epic 7: Dashboard & Notifications

**Goal:** Provide unified management interface and proactive notifications.

**User Value:** Users can manage everything from one place and stay informed of important events.

**FRs Covered:** FR129-FR143

---

### Story 7.1: Role-Based Dashboard

As a **user**,
I want a dashboard tailored to my role,
So that I see relevant information immediately.

**Acceptance Criteria:**

**Given** I am logged in
**When** I visit /dashboard
**Then** I see role toggle if I have both roles (FR129)

**And** given I am viewing as Trainer
**When** dashboard loads
**Then** I see: my agents, earnings summary, training progress (FR130)

**And** given I am viewing as Consumer
**When** dashboard loads
**Then** I see: acquired agents, usage summary, costs (FR131)

**And** given I toggle roles
**When** view switches
**Then** dashboard updates without page reload

**Prerequisites:** Epic 1 complete

**Technical Notes:**
- Dashboard uses card-based layout
- Quick stats at top
- Recent activity feed
- Role preference persisted
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop

---

### Story 7.2: Dashboard Tabs

As a **user**,
I want dedicated tabs for each platform feature,
So that I can navigate to detailed views easily.

**Acceptance Criteria:**

**Given** I am on dashboard
**When** I view tabs
**Then** I see: Academy, Council, Observer, Marketplace, Truth Chain (FR132-FR136)

**And** given I click Academy tab
**When** tab loads
**Then** I see enrolled agents, progress, graduates (FR132)

**And** given I click Council tab
**When** tab loads
**Then** I see recent decisions (all 9 votes), pending, precedents (FR133)

**And** given I click Observer tab
**When** tab loads
**Then** I see event feed, anomalies (FR134)

**And** given I click Marketplace tab
**When** tab loads
**Then** I see listings/browse + Live Ticker (FR135)

**And** given I click Truth Chain tab
**When** tab loads
**Then** I see recent records, verification tool (FR136)

**Prerequisites:** Story 7.1

**Technical Notes:**
- Tabs use URL routing: /dashboard/academy, etc.
- Each tab has sub-navigation
- Tab content lazy-loaded
- Breadcrumbs show current location

---

### Story 7.3: Escalation Notifications

As a **human operator**,
I want immediate notifications for escalations,
So that I can respond to urgent decisions.

**Acceptance Criteria:**

**Given** a Level 4 action or deadlock escalates
**When** escalation triggers
**Then** I receive high-priority notification (FR137)

**And** given notification arrives
**When** I view it
**Then** I see: agent, action, risk level, all 9 Council votes, urgency

**And** given I am configured for email
**When** escalation occurs
**Then** email arrives within 30 seconds

**And** given I am in app
**When** escalation occurs
**Then** toast notification appears with sound

**Prerequisites:** Epic 3 complete

**Technical Notes:**
- Escalation notifications are highest priority
- Channels: email, in-app, webhook (FR143)
- Email uses SendGrid or similar
- In-app uses Pusher real-time
- Notification includes direct link to escalation

---

### Story 7.4: Event Notifications

As a **user**,
I want notifications for important events,
So that I stay informed without constant checking.

**Acceptance Criteria:**

**Given** my agent graduates
**When** graduation completes
**Then** I receive celebration notification (FR138)

**And** given Observer detects anomaly
**When** anomaly is flagged
**Then** I receive anomaly alert (FR139)

**And** given ownership of agent I use changes
**When** change is announced
**Then** I receive ownership change notification (FR140)

**And** given my earnings hit milestone
**When** threshold crossed
**Then** I receive milestone notification (FR141)

**Prerequisites:** Story 7.3

**Technical Notes:**
- Notification types: graduation, anomaly, ownership, milestone, council_decision
- Each type has configurable urgency
- Milestones: first earning, $100, $1000, etc.

---

### Story 7.5: Notification Preferences

As a **user**,
I want to configure my notification preferences,
So that I receive only what matters to me.

**Acceptance Criteria:**

**Given** I am in /settings/notifications
**When** page loads
**Then** I see list of all notification types (FR142)

**And** given a notification type
**When** I configure it
**Then** I can enable/disable channels: email, in-app, webhook (FR143)

**And** given I disable a type
**When** event occurs
**Then** I don't receive that notification

**And** given I configure webhook
**When** I enter URL
**Then** notifications POST to my endpoint

**Prerequisites:** Story 7.4

**Technical Notes:**
- Preferences stored in user_notification_preferences table
- Webhook includes retry logic (3 attempts)
- Email has unsubscribe link
- Escalations cannot be fully disabled (minimum: in-app)

---

## Epic 8: API & Integration

**Goal:** Provide comprehensive API for external integrations.

**User Value:** External systems can integrate with AgentAnchor for verification and automation.

**FRs Covered:** FR144-FR149

---

### Story 8.1: RESTful API

As a **developer**,
I want a RESTful API,
So that I can integrate AgentAnchor with my systems.

**Acceptance Criteria:**

**Given** I have an API key
**When** I call any endpoint
**Then** I receive structured JSON response (FR144)

**And** given I call GET /api/agents
**When** I provide valid auth
**Then** I receive list of my agents

**And** given I call POST /api/council/request
**When** I provide valid payload
**Then** Upchain request is submitted to Council of Nine

**And** given any API call
**When** I check headers
**Then** I see rate limit info (FR148)

**Prerequisites:** All previous epics provide functionality

**Technical Notes:**
- All endpoints under /api/v1/
- Consistent error format: {error: string, code: string, details?: object}
- Pagination via cursor
- Rate limits per tier: Free (100/hr), Pro (1000/hr), Enterprise (10000/hr)

---

### Story 8.2: API Authentication

As a **developer**,
I want secure API authentication,
So that my integrations are protected.

**Acceptance Criteria:**

**Given** I am in /settings/api-keys
**When** I click "Create Key"
**Then** I receive new API key (FR145)

**And** given I create a key
**When** I configure it
**Then** I can set scope: read-only, read-write, admin

**And** given I use a key
**When** I call API with header `Authorization: Bearer <key>`
**Then** request is authenticated

**And** given I suspect compromise
**When** I click "Revoke"
**Then** key is immediately invalidated

**Prerequisites:** Story 8.1

**Technical Notes:**
- API keys stored hashed (bcrypt)
- Key format: aa_live_xxx or aa_test_xxx
- Scopes limit available endpoints
- Maximum 10 keys per user

---

### Story 8.3: Webhooks

As a **developer**,
I want webhook notifications,
So that my system reacts to AgentAnchor events.

**Acceptance Criteria:**

**Given** I am in /settings/webhooks
**When** I click "Add Webhook"
**Then** I can configure endpoint URL and events (FR146)

**And** given I select events
**When** I choose from list
**Then** I can subscribe to: agent.graduated, council.decision, acquisition.created, ticker.event, etc.

**And** given subscribed event occurs
**When** webhook fires
**Then** my endpoint receives POST with event payload

**And** given my endpoint fails
**When** webhook retry triggers
**Then** 3 retries with exponential backoff occur

**Prerequisites:** Story 8.2

**Technical Notes:**
- Webhook payload includes signature for verification
- Signature: HMAC-SHA256 of payload with webhook secret
- Webhook logs show delivery status
- Test webhook button for debugging

---

### Story 8.4: OpenAPI Documentation

As a **developer**,
I want complete API documentation,
So that I can integrate quickly and correctly.

**Acceptance Criteria:**

**Given** I visit /docs/api
**When** page loads
**Then** I see interactive OpenAPI documentation (FR149)

**And** given I view an endpoint
**When** I expand details
**Then** I see: parameters, request body, responses, examples

**And** given I want to test
**When** I use "Try it" feature
**Then** I can make live API calls from docs

**And** given I need OpenAPI spec
**When** I download openapi.json
**Then** I receive valid OpenAPI 3.1 specification

**Prerequisites:** Story 8.3

**Technical Notes:**
- Scalar for interactive documentation
- OpenAPI spec maintained manually or generated
- Examples for all endpoints
- Authentication section explains API key usage

---

## Summary

### Epic & Story Count

| Epic | Title | Stories |
|------|-------|---------|
| 1 | Foundation & Infrastructure | 5 |
| 2 | Agent Creation & Academy | 6 |
| 3 | Council of Nine Governance | 5 |
| 4 | Trust Score System | 4 |
| 5 | Observer & Truth Chain | 5 |
| 6 | Unified Marketplace | 7 |
| 7 | Dashboard & Notifications | 5 |
| 8 | API & Integration | 4 |
| **Total** | | **41 Stories** |

### FR Coverage Summary

**MVP FRs Covered:** 95 of 149 (64%)
**Growth FRs Deferred:** 54 (36%)

| Category | Total | MVP | Growth |
|----------|-------|-----|--------|
| User Account (FR1-8) | 8 | 8 | 0 |
| Trainer Features (FR9-22) | 14 | 5 | 9 |
| Consumer Features (FR23-34) | 12 | 9 | 3 |
| Agent Lifecycle (FR35-40) | 6 | 6 | 0 |
| Academy (FR41-49) | 9 | 7 | 2 |
| Trust Score (FR50-57) | 8 | 8 | 0 |
| Council (FR58-67) | 10 | 10 | 0 |
| Upchain (FR68-75) | 8 | 8 | 0 |
| HITL (FR76-81) | 6 | 6 | 0 |
| Observer (FR82-91) | 10 | 10 | 0 |
| Truth Chain (FR92-100) | 9 | 9 | 0 |
| Marketplace (FR101-108) | 8 | 8 | 0 |
| Payments (FR109-115) | 7 | 7 | 0 |
| MIA Protocol (FR116-122) | 7 | 0 | 7 |
| Client Protection (FR123-128) | 6 | 0 | 6 |
| Dashboard (FR129-136) | 8 | 8 | 0 |
| Notifications (FR137-143) | 7 | 7 | 0 |
| API (FR144-149) | 6 | 6 | 0 |

### Deferred to Growth Phase

| FR Range | Feature | Rationale |
|----------|---------|-----------|
| FR14-15 | Clone/Enterprise Lock pricing | Commission-only for MVP |
| FR18-22 | Maintenance delegation | Core value must be proven first |
| FR28-29 | Clone/Enterprise acquisition | Commission-only for MVP |
| FR32-34 | Advanced client protection | Basic protection in MVP |
| FR47-48 | Specializations, Mentorship | Core Academy must work first |
| FR116-122 | MIA detection & protocol | Requires mature marketplace |
| FR123-128 | Full client protection flow | 30-day notice, walk away |

### Key Architecture Alignments

| Decision | Implementation |
|----------|----------------|
| **Council of Nine** | Story 3.1 defines all 9 validators + Elder Wisdom |
| **LangGraph.js** | Stories 2.1, 3.1, 3.3 use for agent orchestration |
| **Unified Marketplace** | Epic 6 with Live Ticker (6.3), Custom Requests (6.5) |
| **Founding Agents** | Story 6.1 imports 150+ agents from AI Workforce/BAI CC |
| **Trust Tiers** | Story 4.1 uses Architecture v3.0 tier definitions |
| **Hash Chain** | Story 5.4 implements per Architecture v3.0 section 6 |

### Implementation Order Recommendation

1. **Epic 1** - Foundation (required for all others)
2. **Epic 2** - Agent Creation (depends on Epic 1)
3. **Epic 3** - Council of Nine (depends on Epic 1, needed for Epic 2.4)
4. **Epic 4** - Trust Score (depends on Epic 2)
5. **Epic 5** - Observer & Truth Chain (can parallel with Epic 4)
6. **Epic 6** - Marketplace (depends on Epics 2, 4)
7. **Epic 7** - Dashboard & Notifications (depends on Epics 2-6)
8. **Epic 8** - API & Integration (depends on Epics 2-7)

---

## Appendix: Story Quick Reference

### Epic 1: Foundation & Infrastructure
- 1.1: Project Setup & Deployment Pipeline
- 1.2: Database Schema & Supabase Setup
- 1.3: User Registration & Authentication
- 1.4: User Profile & Role Selection
- 1.5: Basic Navigation & Layout

### Epic 2: Agent Creation & Academy
- 2.1: Create New Agent
- 2.2: Academy Enrollment
- 2.3: Training Progress & Curriculum
- 2.4: Council Examination
- 2.5: Agent Graduation
- 2.6: Agent History & Archive

### Epic 3: Council of Nine Governance
- 3.1: Council of Nine Validator Agents
- 3.2: Risk Level Classification
- 3.3: Upchain Decision Protocol
- 3.4: Precedent Library
- 3.5: Human Escalation & Override

### Epic 4: Trust Score System
- 4.1: Trust Score Display & Tiers
- 4.2: Trust Score Changes
- 4.3: Trust Score History & Trends
- 4.4: Trust Decay & Autonomy Limits

### Epic 5: Observer & Truth Chain
- 5.1: Observer Event Logging
- 5.2: Observer Dashboard Feed
- 5.3: Anomaly Detection
- 5.4: Truth Chain Records
- 5.5: Public Verification

### Epic 6: Unified Marketplace
- 6.1: Founding Agents Import
- 6.2: Agent Publishing
- 6.3: Live Ticker
- 6.4: Marketplace Browse & Search
- 6.5: Custom Agent Requests
- 6.6: Agent Acquisition (Commission Model)
- 6.7: Earnings Dashboard & Payouts

### Epic 7: Dashboard & Notifications
- 7.1: Role-Based Dashboard
- 7.2: Dashboard Tabs
- 7.3: Escalation Notifications
- 7.4: Event Notifications
- 7.5: Notification Preferences

### Epic 8: API & Integration
- 8.1: RESTful API
- 8.2: API Authentication
- 8.3: Webhooks
- 8.4: OpenAPI Documentation

---

## Growth Phase Epics

### Epic 16: Circuit Breaker & Kill Switch [COUNCIL PRIORITY]

**Goal:** Emergency stop capability for all agent operations - Council Vote #3 Priority (39 points)

**User Value:** Platform operators can instantly halt problematic agents, ensuring safety remains paramount.

**FRs Covered:** FR163-FR166 (new)

---

### Story 16.1: Agent Pause/Resume

As a **Trainer**,
I want to pause my agent with a reason,
So that I can stop operations during issues without losing state.

**Acceptance Criteria:**

**Given** I am viewing my agent
**When** I click "Pause Agent"
**Then** I must provide a reason and agent stops accepting new tasks

**And** given agent is paused
**When** I view agent status
**Then** I see "PAUSED" badge with reason and timestamp

**And** given agent is paused
**When** I click "Resume Agent"
**Then** agent becomes active and pause period is logged to Truth Chain

**Prerequisites:** Epic 5 (Observer & Truth Chain)

**Technical Notes:**
- Pause state stored in agents table
- Active tasks complete, new tasks rejected
- Pause reason required (enum: investigation, maintenance, consumer_request, other)
- Resume requires confirmation

---

### Story 16.2: Global Kill Switch

As a **Platform Admin**,
I want to halt all agent operations instantly,
So that I can respond to platform-wide emergencies.

**Acceptance Criteria:**

**Given** I am a platform admin
**When** I access Admin Panel > Safety
**Then** I see "GLOBAL KILL SWITCH" with MFA confirmation required

**And** given I activate kill switch
**When** I confirm with MFA
**Then** ALL agents stop immediately, all pending tasks cancelled

**And** given kill switch is active
**When** users visit platform
**Then** they see emergency maintenance banner with expected resolution

**And** given incident is resolved
**When** I deactivate kill switch
**Then** agents return to pre-halt state, event recorded to Truth Chain

**Prerequisites:** Story 16.1

**Technical Notes:**
- Kill switch is atomic operation
- Stored in platform_settings with timestamp
- Broadcasts via Pusher to all connected clients
- Automatic notification to all Trainers/Consumers
- Requires 2 admin approvals for activation (future)

---

### Story 16.3: Cascade Halt Protocol

As the **platform**,
I want dependent agents to halt when parent agent halts,
So that cascading failures are prevented.

**Acceptance Criteria:**

**Given** Agent A depends on Agent B
**When** Agent B is paused/halted
**Then** Agent A receives warning and enters "waiting" state

**And** given multiple agents in dependency chain
**When** root agent halts
**Then** all downstream agents halt in order with notification

**And** given dependency is broken
**When** I view affected agents
**Then** I see dependency graph with halt propagation path

**Prerequisites:** Story 16.2

**Technical Notes:**
- agent_dependencies table tracks relationships
- Halt propagates depth-first
- Maximum cascade depth: 5 (configurable)
- Circular dependency detection

---

### Story 16.4: Kill Switch Truth Chain Records

As the **platform**,
I want all halt events recorded immutably,
So that safety actions are auditable and legally defensible.

**Acceptance Criteria:**

**Given** any agent is paused
**When** pause occurs
**Then** Truth Chain record created with: agent, reason, initiator, timestamp

**And** given kill switch is activated
**When** activation completes
**Then** Truth Chain record includes: all affected agents, reason, admin, timestamp

**And** given I need audit trail
**When** I view Truth Chain
**Then** I can filter by halt events and see full history

**Prerequisites:** Story 16.3

**Technical Notes:**
- New Truth Chain event types: AGENT_PAUSED, AGENT_RESUMED, KILL_SWITCH_ACTIVATED, KILL_SWITCH_DEACTIVATED
- Hash chain continuity maintained
- Public verification available
- Compliance export includes halt events

---

### Epic 16 Summary

| Story | Title | Status |
|-------|-------|--------|
| 16.1 | Agent Pause/Resume | Backlog |
| 16.2 | Global Kill Switch | Backlog |
| 16.3 | Cascade Halt Protocol | Backlog |
| 16.4 | Kill Switch Truth Chain Records | Backlog |

**Total Stories:** 4
**Council Priority:** #3 (39 points)
**Rationale:** "Build the kill switch FIRST." - Jocko Willink

---

**Document Updated:** 2025-12-07
**Workflow:** create-epics-and-stories (BMad Method)
**Source:** PRD v2.0 + Architecture v3.0 + Council Vote

*"Agents you can anchor to."*

