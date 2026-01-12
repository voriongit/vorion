# AgentAnchor (A3I) - Gap Analysis & Completion Roadmap

**Date:** December 4, 2025
**Status:** MVP ~85% Complete
**Remaining:** Critical gaps for production launch

---

## Executive Summary

AgentAnchor has strong foundational implementation across all core pillars. The following analysis identifies gaps between the PRD (149 FRs) and current implementation, prioritized for MVP completion.

---

## Current Implementation Status

### Core Services (lib/)

| Service | Status | Coverage | Notes |
|---------|--------|----------|-------|
| **Trust Score** | Done | FR50-57 | Decay service, tier progression |
| **Council** | Done | FR58-67 | Claude AI validators, voting |
| **Upchain** | Done | FR68-75 | Request/approval flow |
| **Observer** | Done | FR82-91 | Anomaly detection, logging |
| **Truth Chain** | Done | FR92-100 | Hash chain, verification |
| **Marketplace** | Done | FR101-108 | Listings, search, acquire |
| **Earnings** | Done | FR109-115 | Commission tracking |
| **Notifications** | Done | FR137-143 | Dashboard, preferences |
| **API** | Done | FR144-149 | Keys, webhooks, OpenAPI |

### UI Pages (app/)

| Page | Status | Notes |
|------|--------|-------|
| /dashboard | Done | Role-based (Trainer/Consumer) |
| /academy | Done | Enrollment UI |
| /agents/[id]/training | Done | Training progress |
| /agents/[id]/trust | Done | Trust score detail |
| /council | Done | Decisions, voting |
| /observer | Done | Real-time feed |
| /truth-chain | Done | Records browser |
| /marketplace | Done | Browse & search |
| /marketplace/[id] | Done | Listing detail |
| /earnings | Done | Trainer earnings |
| /verify/[hash] | Done | Public verification |
| /docs/api | Done | Scalar OpenAPI docs |
| /settings/api-keys | Done | API key management |
| /settings/notifications | Done | Notification prefs |

---

## Critical Gaps for MVP

### 1. Academy Curriculum System (Priority: HIGH)

**Missing FRs:** FR42-44, FR47-48

| Gap | Description | Effort |
|-----|-------------|--------|
| Training Modules | Structured curriculum content delivery | 3 days |
| Progress Tracking | Module completion with measurable progress | 2 days |
| Specialization Tracks | Additional training after core graduation | Deferred |
| Mentorship | Elite agents as mentors | Deferred |

**Required Files:**
- `lib/academy/curriculum-service.ts`
- `lib/academy/module-types.ts`
- `app/academy/curriculum/[moduleId]/page.tsx`

### 2. Human-in-the-Loop (Priority: HIGH)

**Missing FRs:** FR76-81

| Gap | Description | Effort |
|-----|-------------|--------|
| Escalation Queue | UI for human review of Level 4 decisions | 2 days |
| Override Recording | Human overrides → Truth Chain | 1 day |
| Role Configuration | Teacher → Guardian progression | 1 day |

**Required Files:**
- `app/(dashboard)/escalations/page.tsx`
- `lib/council/human-override-service.ts`

### 3. Consumer Protection Features (Priority: MEDIUM)

**Missing FRs:** FR123-128

| Gap | Description | Effort |
|-----|-------------|--------|
| Ownership Change Notifications | Alert consumers when agent changes hands | 1 day |
| Opt-Out Flow | Walk-away UI for consumers | 1 day |
| Platform Protection Requests | Consumer → Platform takeover request | 1 day |

**Required Files:**
- `lib/protection/client-protection-service.ts`
- `app/(dashboard)/portfolio/opt-out/page.tsx`

### 4. Payment Integration (Priority: HIGH)

**Missing FRs:** FR113-114, FR117

| Gap | Description | Effort |
|-----|-------------|--------|
| Stripe Connect | Trainer payout setup | 2 days |
| Usage Billing | Track and bill per-task usage | 2 days |
| Payout Schedule | Weekly/threshold payouts | 1 day |

**Required Files:**
- `lib/payments/stripe-service.ts`
- `app/settings/payouts/page.tsx`
- `app/api/webhooks/stripe/route.ts`

### 5. Public Verification API (Priority: MEDIUM)

**Missing FRs:** FR98, FR99, FR147

| Gap | Description | Effort |
|-----|-------------|--------|
| Embeddable Badge API | `GET /api/badge/:agentId` returns SVG | 1 day |
| oEmbed Endpoint | For rich embeds | 0.5 day |
| Verification Widget | JavaScript snippet for external sites | 1 day |

**Required Files:**
- `app/api/badge/[agentId]/route.ts`
- `app/api/oembed/route.ts`
- `public/widget/bai-badge.js`

---

## Deferred to Post-MVP

### Clone & Enterprise Acquisition
- FR28, FR29: Clone and Enterprise Lock models
- Revenue split on clone/transfer
- Code protection architecture
- Effort: 2 weeks

### MIA Protocol
- FR116-122: Author inactivity detection
- Revenue decay schedule (90/180/270/360 days)
- Escrow fund management
- Platform takeover workflow
- Effort: 1 week

### Maintainer Marketplace
- FR21, FR269-270: Author delegation
- Bidding system for maintenance transfers
- Effort: 1 week

### Full Blockchain
- FR92-97 enhancements: Move from hash chain to L2
- Ethereum L2 or Solana integration
- On-chain certification NFTs
- Effort: 3 weeks

### Enterprise Features
- SSO (FR2 enhancement): SAML/OIDC
- RBAC improvements
- Audit log exports
- Effort: 2 weeks

---

## Component Gaps

### TrustBadge (COMPLETED in this session)
- [x] BAI brand colors alignment
- [x] Certification tier mapping (Bronze/Silver/Gold/Platinum/Genesis)
- [x] BAICertificationBadge component (full/compact/inline variants)
- [x] ProbationIndicator component
- [x] Verification link integration

### Missing Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| EscalationCard | Display pending human reviews | HIGH |
| PayoutDashboard | Trainer payout management | HIGH |
| CurriculumModule | Training module viewer | HIGH |
| ConsumerOptOut | Walk-away flow | MEDIUM |
| MaintenanceRequest | Request platform maintenance | LOW |

---

## Database Schema Gaps

Current schemas in `lib/db/schema/`:
- agents.ts, users.ts, council.ts, marketplace.ts, observer.ts, truth-chain.ts, academy.ts

### Missing Tables

```sql
-- Human escalations queue
CREATE TABLE escalations (
  id UUID PRIMARY KEY,
  decision_id UUID REFERENCES council_decisions,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES users,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training curriculum modules
CREATE TABLE academy_modules (
  id UUID PRIMARY KEY,
  curriculum_id UUID REFERENCES academy_curricula,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  order_index INT NOT NULL,
  estimated_duration INT, -- minutes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module completions
CREATE TABLE academy_progress (
  id UUID PRIMARY KEY,
  enrollment_id UUID REFERENCES academy_enrollments,
  module_id UUID REFERENCES academy_modules,
  completed_at TIMESTAMPTZ,
  score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout requests
CREATE TABLE payouts (
  id UUID PRIMARY KEY,
  trainer_id UUID REFERENCES users,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_transfer_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Gaps

### Missing Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/badge/:agentId` | GET | Return embeddable SVG badge |
| `/api/badge/:agentId/html` | GET | Return embed HTML snippet |
| `/api/oembed` | GET | oEmbed for rich previews |
| `/api/escalations` | GET/POST | Human escalation queue |
| `/api/payouts` | GET/POST | Trainer payout requests |
| `/api/curriculum/:id/progress` | GET/POST | Training progress |
| `/api/protection/opt-out` | POST | Consumer walk-away |

---

## Integration Gaps

| Integration | Status | Priority | Notes |
|-------------|--------|----------|-------|
| Stripe Connect | Not Started | HIGH | Required for payouts |
| Pusher | Done | - | Real-time events working |
| Supabase Auth | Done | - | Auth flow complete |
| Claude API | Done | - | Council validators working |
| Email (Resend) | Partial | MEDIUM | Notifications need templates |
| Blockchain L2 | Not Started | LOW | Deferred post-MVP |

---

## Recommended Priority Order

### Week 1: Revenue Infrastructure
1. Stripe Connect integration
2. Payout dashboard UI
3. Usage billing tracking

### Week 2: Academy Completion
1. Curriculum module system
2. Progress tracking
3. Examination flow improvements

### Week 3: Human Oversight
1. Escalation queue UI
2. Human override flow
3. Role configuration

### Week 4: Public Launch Prep
1. Embeddable badge API
2. Verification widget
3. Consumer protection flows
4. Production hardening

---

## Quick Wins (Can ship immediately)

1. **Badge API Endpoint** - Simple SVG generation from existing components
2. **Escalation List** - Basic table of pending human reviews
3. **Curriculum Content** - Static JSON modules for core training
4. **Email Templates** - Resend templates for notifications

---

## Metrics for Launch Readiness

| Metric | Target | Current |
|--------|--------|---------|
| PRD FR Coverage | 100% MVP | ~85% |
| Core Services | All operational | Done |
| UI Pages | All MVP pages | Done |
| Payment Integration | Stripe working | 0% |
| Public API | Badge + verify | 50% |
| Test Coverage | >70% | Unknown |

---

## Conclusion

AgentAnchor is well-positioned for MVP launch. The separation of powers architecture is fully implemented. Critical gaps are:

1. **Payment infrastructure** - No revenue without Stripe
2. **Academy curriculum** - Training is core to trust progression
3. **Human escalation UI** - Required for Level 4 decisions
4. **Public verification** - Badge embeds for trust signaling

Estimated effort to MVP completion: **3-4 weeks** of focused development.

---

*Generated by BMad Master - December 4, 2025*
