# Epic Technical Specification: Foundation & Infrastructure

Date: 2025-11-28
Author: frank the tank
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 establishes the foundational infrastructure for AgentAnchor - the AI Governance Operating System. This epic delivers the core platform scaffolding that all subsequent features depend on: project setup, deployment pipeline, database schema, authentication system, user profiles with role selection, and the base navigation/layout components.

Upon completion, developers will have a fully deployable Next.js 14 application with Supabase backend, and users will be able to register, authenticate, select their role (Trainer/Consumer/Both), and navigate the platform shell.

## Objectives and Scope

**In Scope:**
- Next.js 14 project with App Router and TypeScript strict mode
- CI/CD pipeline via GitHub Actions → Vercel
- Supabase project configuration (Auth, Database, RLS)
- Core database schema for all platform entities
- User registration with email verification
- Password reset functionality
- MFA setup (optional for MVP, required for payouts)
- User profile management and notification preferences
- Role selection (Trainer, Consumer, or Both)
- Responsive sidebar navigation with role-based menu items
- Basic layout shell matching UX design specification

**Out of Scope:**
- Agent creation (Epic 2)
- Council governance logic (Epic 3)
- Trust Score calculations (Epic 4)
- Observer event logging (Epic 5)
- Marketplace functionality (Epic 6)
- Dashboard content beyond layout (Epic 7)
- API endpoints for external integration (Epic 8)

## System Architecture Alignment

This epic implements the following from the Architecture document:

| Architecture Section | Implementation |
|---------------------|----------------|
| Section 2.1 - Tech Stack | Next.js 14, TypeScript, Tailwind, shadcn/ui |
| Section 2.2 - Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Section 2.3 - Hosting | Vercel Edge Functions + Serverless |
| Section 4.0 - Data Model | Core schema for users, agents, trust_history, etc. |
| Section 4.3 - Security | Row Level Security (RLS) policies |
| UX Design Section 5.2 | Information architecture and navigation structure |

**Constraints:**
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Session tokens with 24-hour expiry
- Rate limiting: 5 login attempts per hour per IP
- WCAG 2.1 AA accessibility compliance

---

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| `app/layout.tsx` | Root layout with providers | Session | Rendered shell | Frontend |
| `app/(auth)/*` | Authentication pages | User input | Auth state | Frontend |
| `app/(dashboard)/layout.tsx` | Dashboard shell with nav | Session, Role | Rendered layout | Frontend |
| `lib/supabase/client.ts` | Browser Supabase client | Env vars | Client instance | Infra |
| `lib/supabase/server.ts` | Server Supabase client | Cookies | Server client | Infra |
| `lib/supabase/middleware.ts` | Session refresh middleware | Request | Response | Infra |
| `middleware.ts` | Route protection | Request | Redirect/Continue | Infra |
| `components/ui/*` | Base UI components | Props | JSX | Frontend |
| `components/navigation/*` | Sidebar, header, breadcrumbs | Role, Route | JSX | Frontend |

### Data Models and Contracts

#### Core Tables

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('trainer', 'consumer', 'both')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  notification_preferences JSONB DEFAULT '{"email": true, "in_app": true, "webhook": false}'::jsonb,
  storefront_name TEXT, -- For trainers
  storefront_bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'training', 'active', 'paused', 'archived')),
  trust_score INTEGER NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 1000),
  capabilities TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trust History
CREATE TABLE public.trust_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  previous_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('task', 'council', 'feedback', 'decay', 'milestone', 'violation')),
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Council Decisions
CREATE TABLE public.council_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  agent_id UUID REFERENCES public.agents(id),
  decision_type TEXT NOT NULL CHECK (decision_type IN ('examination', 'upchain', 'escalation')),
  risk_level INTEGER NOT NULL CHECK (risk_level >= 0 AND risk_level <= 4),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'escalated')),
  votes JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning TEXT,
  creates_precedent BOOLEAN DEFAULT FALSE,
  human_override BOOLEAN DEFAULT FALSE,
  human_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Truth Chain Records
CREATE TABLE public.truth_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_num BIGSERIAL UNIQUE,
  record_type TEXT NOT NULL CHECK (record_type IN ('graduation', 'council_decision', 'human_override', 'ownership_change', 'certification')),
  subject_id UUID NOT NULL,
  subject_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  hash TEXT NOT NULL,
  previous_hash TEXT,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Observer Events (append-only)
CREATE TABLE public.observer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_num BIGSERIAL,
  agent_id UUID REFERENCES public.agents(id),
  event_type TEXT NOT NULL,
  risk_level INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace Listings
CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  commission_rate DECIMAL(10,4) NOT NULL,
  clone_price DECIMAL(10,2),
  enterprise_lock_available BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acquisitions
CREATE TABLE public.acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES public.profiles(id),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id),
  agent_id UUID NOT NULL REFERENCES public.agents(id),
  acquisition_type TEXT NOT NULL CHECK (acquisition_type IN ('commission', 'clone', 'enterprise_lock')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated')),
  total_usage DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Academy Progress
CREATE TABLE public.academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  curriculum TEXT NOT NULL DEFAULT 'core',
  module_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  progress_pct INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_agents_owner ON public.agents(owner_id);
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_trust_history_agent ON public.trust_history(agent_id);
CREATE INDEX idx_council_decisions_agent ON public.council_decisions(agent_id);
CREATE INDEX idx_truth_chain_subject ON public.truth_chain(subject_id);
CREATE INDEX idx_truth_chain_type ON public.truth_chain(record_type);
CREATE INDEX idx_observer_events_agent ON public.observer_events(agent_id);
CREATE INDEX idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX idx_acquisitions_consumer ON public.acquisitions(consumer_id);
```

#### Row Level Security Policies

```sql
-- Profiles: Users can read public profiles, only own profile is editable
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Agents: Owners can CRUD, others can view published
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own agents" ON public.agents
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Published agents are viewable" ON public.agents
  FOR SELECT USING (status = 'active');

-- Observer Events: Append-only (insert only, no update/delete)
ALTER TABLE public.observer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert events" ON public.observer_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Events are viewable by agent owner" ON public.observer_events
  FOR SELECT USING (
    agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid())
  );

-- Truth Chain: Append-only, publicly readable
ALTER TABLE public.truth_chain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Truth chain is public" ON public.truth_chain
  FOR SELECT USING (true);

CREATE POLICY "System can insert records" ON public.truth_chain
  FOR INSERT WITH CHECK (true);
```

### APIs and Interfaces

#### Authentication Endpoints (Supabase Auth)

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| POST | `/auth/v1/signup` | `{email, password}` | `{user, session}` | Email verification required |
| POST | `/auth/v1/token?grant_type=password` | `{email, password}` | `{access_token, refresh_token}` | Login |
| POST | `/auth/v1/recover` | `{email}` | `{}` | Password reset |
| POST | `/auth/v1/logout` | `{}` | `{}` | Session invalidation |

#### Profile API Routes

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | `/api/profile` | - | `Profile` | Required |
| PATCH | `/api/profile` | `Partial<Profile>` | `Profile` | Required |
| POST | `/api/profile/role` | `{role}` | `Profile` | Required |

#### Types

```typescript
// lib/types/user.ts
export type UserRole = 'trainer' | 'consumer' | 'both';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  notification_preferences: NotificationPreferences;
  storefront_name: string | null;
  storefront_bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  email: boolean;
  in_app: boolean;
  webhook: boolean;
  webhook_url?: string;
}
```

### Workflows and Sequencing

#### User Registration Flow

```
1. User visits /register
2. User enters email, password (validates: 8+ chars, 1 upper, 1 number, 1 special)
3. Password strength meter provides feedback
4. User submits form
5. Supabase creates auth.users record
6. Email verification sent (15 min expiry)
7. User clicks verification link
8. Email confirmed, profile record created
9. User redirected to /onboarding
10. User selects role (Trainer/Consumer/Both)
11. User completes profile basics
12. Redirect to /dashboard
```

#### Session Management Flow

```
1. User authenticates (login)
2. Supabase returns access_token (JWT, 1hr) + refresh_token (30d)
3. Middleware checks token on each request
4. If access_token expired but refresh valid → auto-refresh
5. If refresh expired → redirect to login
6. Session stored in httpOnly cookie
```

---

## Non-Functional Requirements

### Performance

| Metric | Target | Source |
|--------|--------|--------|
| Page Load (LCP) | < 2s | PRD NFR |
| Time to Interactive | < 3s | UX Spec |
| API Response (P95) | < 200ms | PRD NFR |
| Auth Flow Complete | < 3s | UX Spec |

**Implementation:**
- Next.js App Router with React Server Components
- Static generation for public pages
- Edge middleware for auth checks
- Optimistic UI updates

### Security

| Requirement | Implementation | Source |
|-------------|----------------|--------|
| Password hashing | bcrypt (cost 12+) via Supabase | PRD Security |
| Session tokens | JWT, 24hr expiry, httpOnly cookies | PRD Security |
| Rate limiting | 5 login attempts/hr/IP via Upstash | PRD Security |
| Data encryption at rest | AES-256 (Supabase default) | PRD Security |
| Data encryption in transit | TLS 1.3 | PRD Security |
| MFA | Optional for MVP, required for payouts | PRD FR2 |

**Threat Considerations:**
- XSS: React auto-escaping + CSP headers
- CSRF: SameSite cookies + CSRF tokens
- SQL Injection: Parameterized queries via Supabase client
- Session hijacking: httpOnly, Secure, SameSite=Strict cookies

### Reliability/Availability

| Metric | Target | Notes |
|--------|--------|-------|
| Platform Uptime | 99.9% | Vercel SLA |
| Database Uptime | 99.9% | Supabase SLA |
| RTO | < 4 hours | Supabase point-in-time recovery |
| RPO | < 1 hour | Continuous WAL archiving |

**Degradation Behavior:**
- If Supabase unreachable → Show maintenance page
- If auth service down → Queue requests, retry with backoff

### Observability

| Signal | Implementation | Tool |
|--------|----------------|------|
| Error tracking | Exception capture + breadcrumbs | Sentry |
| Performance monitoring | Web vitals, API timing | Vercel Analytics |
| Structured logging | JSON logs with correlation IDs | Pino |
| Audit logging | User actions logged to observer_events | Custom |

**Required Log Events:**
- User registration (success/failure)
- Login attempts (success/failure)
- Password reset requests
- Role changes
- Profile updates

---

## Dependencies and Integrations

### NPM Dependencies (from package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^14.1.0 | App framework |
| react | ^18.2.0 | UI library |
| @supabase/supabase-js | ^2.39.1 | Database + Auth client |
| @supabase/auth-helpers-nextjs | ^0.8.7 | Next.js auth integration |
| tailwindcss | ^3.4.1 | Styling |
| lucide-react | ^0.316.0 | Icons |
| zod | ^3.22.4 | Validation |
| zustand | ^4.5.0 | Client state |
| @sentry/nextjs | ^8.0.0 | Error tracking |
| @upstash/ratelimit | ^1.0.0 | Rate limiting |
| @upstash/redis | ^1.28.0 | Rate limit store |
| pino | ^8.17.0 | Logging |

### External Services

| Service | Purpose | Required For |
|---------|---------|--------------|
| Supabase | Auth, Database, Realtime | All stories |
| Vercel | Hosting, Edge Functions | Deployment |
| GitHub | Source control, CI/CD | Story 1.1 |
| Upstash | Redis for rate limiting | Story 1.3 |
| Sentry | Error tracking | Story 1.1 |

### Integration Points

| Integration | Type | Notes |
|-------------|------|-------|
| Supabase Auth | REST + WebSocket | Email verification, sessions |
| Supabase Database | REST + Realtime | All data operations |
| GitHub Actions | Webhook | CI/CD triggers |
| Vercel | Git integration | Auto-deploy on push |

---

## Acceptance Criteria (Authoritative)

### AC1: Project builds and deploys successfully
- `npm run build` completes without errors
- Deployment to Vercel succeeds
- Application loads at production URL

### AC2: Database schema is complete
- All core tables created per data model
- RLS policies active and tested
- Indexes created for common queries

### AC3: User can register with email/password
- Registration form validates password strength
- Email verification sent within 30 seconds
- Verification link works within 15 minutes
- Account created after verification

### AC4: User can log in securely
- Login with valid credentials succeeds
- Session persists across page refreshes
- Invalid credentials show appropriate error
- Rate limiting prevents brute force (5 attempts/hr)

### AC5: User can reset password
- "Forgot password" sends reset email
- Reset link expires after 15 minutes
- New password must meet strength requirements

### AC6: User can manage profile
- Profile page loads current data
- Updates save successfully
- Notification preferences persist

### AC7: User can select role
- Role selection required for new users
- Role can be changed in settings
- Menu items reflect current role

### AC8: Navigation works on all viewports
- Sidebar visible on desktop (>1024px)
- Sidebar collapses to hamburger on mobile (<768px)
- All navigation links work correctly
- Active state highlighted

### AC9: Authentication is secure
- Passwords hashed with bcrypt
- Session tokens are httpOnly, Secure, SameSite
- Rate limiting enforced
- No sensitive data in client-side storage

### AC10: Application is accessible
- Color contrast meets WCAG 2.1 AA (4.5:1)
- All interactive elements keyboard accessible
- Forms have proper labels
- Focus states visible

---

## Traceability Mapping

| AC | Spec Section | Components | Test Approach |
|----|--------------|------------|---------------|
| AC1 | Services/Modules | All | CI/CD smoke test |
| AC2 | Data Models | Supabase migrations | Migration test + RLS test |
| AC3 | Workflows (Registration) | /register, Supabase Auth | E2E test |
| AC4 | Workflows (Session) | /login, middleware | E2E + security test |
| AC5 | APIs (Auth) | /api/auth/*, Supabase | E2E test |
| AC6 | APIs (Profile) | /api/profile, /settings | Integration test |
| AC7 | Data Models (role) | Onboarding, Settings | E2E test |
| AC8 | Services (Navigation) | Sidebar, Header | Visual regression + responsive test |
| AC9 | Security NFRs | Auth middleware, Supabase | Security scan + penetration test |
| AC10 | Accessibility NFRs | All components | aXe automated + manual audit |

---

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **R1:** Supabase outage affects all users | High | Multi-region planned for Growth; local dev setup for development |
| **R2:** Email deliverability issues | Medium | Use established sender domain; monitor bounce rates |
| **R3:** Rate limiting false positives | Low | Implement IP allowlist for known good actors |

### Assumptions

| Assumption | Validation |
|------------|------------|
| **A1:** Supabase free tier sufficient for MVP | Monitor usage, upgrade if needed |
| **A2:** Users have modern browsers (ES2020+) | Add browser check, show upgrade notice |
| **A3:** Email verification acceptable friction | Track abandonment rate |

### Open Questions

| Question | Owner | Due |
|----------|-------|-----|
| **Q1:** Should MFA be mandatory for trainers? | Product | Before Story 1.3 |
| **Q2:** Social login (Google, GitHub) for MVP? | Product | Before Story 1.3 |
| **Q3:** What analytics events to track? | Product | Before Story 1.1 |

---

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage |
|-------|-----------|----------|
| Unit | Vitest | Utility functions, hooks |
| Component | Testing Library + Vitest | UI components in isolation |
| Integration | Vitest + MSW | API routes, Supabase operations |
| E2E | Playwright | Critical user flows |

### Test Plan by AC

| AC | Test Type | Priority |
|----|-----------|----------|
| AC1 | CI/CD smoke | P0 |
| AC2 | Migration + RLS | P0 |
| AC3 | E2E registration flow | P0 |
| AC4 | E2E login + security | P0 |
| AC5 | E2E password reset | P1 |
| AC6 | Integration profile API | P1 |
| AC7 | E2E role selection | P1 |
| AC8 | Visual regression | P2 |
| AC9 | Security scan | P0 |
| AC10 | Accessibility audit | P1 |

### Edge Cases to Cover

- Registration with existing email
- Expired verification links
- Concurrent session management
- Network failures during auth
- Invalid role values
- Very long profile fields
- Special characters in names
- Empty notification preferences
