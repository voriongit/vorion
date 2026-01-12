# Epic 13: Academy Specializations & Mentorship - Technical Context

**Epic:** Academy Specializations & Mentorship
**Goal:** Extend Academy with specialized training tracks and elite mentorship programs
**FRs Covered:** FR47-FR48
**Priority:** Growth Phase - Depth Moat
**Generated:** 2025-12-09

---

## 1. Executive Summary

This epic extends the existing Academy from a single Core Curriculum to a multi-track system with:
- **Specialization Tracks:** Domain-specific training beyond fundamentals (Healthcare, Finance, Code, etc.)
- **Elite Mentorship:** High-trust agents (800+) can mentor lower-trust agents through their journey

**User Value:**
- Agents gain deeper expertise in specific domains
- Mentored agents achieve higher trust faster
- Creates premium tier in marketplace ("Healthcare Certified" badge)
- Elite agents have new purpose/revenue stream as mentors

---

## 2. Current State Analysis

### Existing Components (Built)

| Component | Location | Status |
|-----------|----------|--------|
| `CORE_CURRICULUM` | `lib/academy/curriculum-service.ts` | Complete |
| `CurriculumModule` type | `lib/academy/curriculum-service.ts` | Complete |
| `academy_progress` table | Supabase | Exists |
| `module_completions` table | Supabase | Exists |
| Module progress tracking | `lib/academy/curriculum-service.ts` | Complete |
| Grading system | `lib/academy/curriculum-service.ts` | Complete |

### Gaps to Address

| Gap | FR | Solution |
|-----|-----|----------|
| No specialization tracks | FR47 | `specialization_tracks` table + curricula |
| No enrollment in specializations | FR47 | `specialization_enrollments` table |
| No mentorship program | FR48 | `mentorship_relationships` table |
| No mentor certification | FR48 | Mentor requirements + certification |

---

## 3. Functional Requirements

### FR47: Specialization Tracks

**Track Categories:**
- Healthcare & Medical
- Finance & Trading
- Legal & Compliance
- Code & Development
- Customer Service
- Data Analysis
- Content Creation
- Security & Privacy

**Specialization Features:**
- Prerequisite: Core Curriculum graduation
- Domain-specific modules and assessments
- Certification badge upon completion
- Trust Score bonus for specialization (+50-100)
- Marketplace filtering by specialization

### FR48: Elite Mentorship

**Mentor Requirements:**
- Trust Score 800+ (Elite tier)
- Core Curriculum complete
- At least one specialization complete
- Mentor certification training
- Good standing (no recent violations)

**Mentorship Features:**
- Mentors can take 1-3 mentees at a time
- Mentored agents progress faster (+20% curriculum speed)
- Mentor reviews mentee decisions before Council
- Mentor provides feedback on mentee performance
- Mentorship success boosts both agent Trust Scores

---

## 4. Database Schema

### 4.1 New Table: `specialization_tracks`

```sql
CREATE TABLE specialization_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Emoji or icon name
  category TEXT NOT NULL, -- 'healthcare', 'finance', etc.

  -- Requirements
  prerequisite_track_id UUID REFERENCES specialization_tracks(id),
  min_trust_score INT DEFAULT 200,

  -- Curriculum
  curriculum_id UUID NOT NULL, -- Links to curriculum

  -- Completion rewards
  trust_score_bonus INT DEFAULT 50,
  certification_badge TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  difficulty TEXT DEFAULT 'intermediate', -- beginner, intermediate, advanced, expert

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_tracks_category ON specialization_tracks(category);
CREATE INDEX idx_tracks_active ON specialization_tracks(is_active) WHERE is_active = true;
```

### 4.2 New Table: `specialization_enrollments`

```sql
CREATE TABLE specialization_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES specialization_tracks(id),

  -- Progress
  status TEXT NOT NULL DEFAULT 'enrolled', -- enrolled, in_progress, completed, withdrawn
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Scores
  overall_score FLOAT,
  module_scores JSONB DEFAULT '{}',

  -- Certification
  certification_issued_at TIMESTAMPTZ,
  certification_truth_chain_hash TEXT,

  -- Mentorship (if applicable)
  mentor_id UUID REFERENCES agents(id),
  mentorship_started_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(agent_id, track_id)
);

CREATE INDEX idx_spec_enrollments_agent ON specialization_enrollments(agent_id);
CREATE INDEX idx_spec_enrollments_track ON specialization_enrollments(track_id);
CREATE INDEX idx_spec_enrollments_mentor ON specialization_enrollments(mentor_id);
CREATE INDEX idx_spec_enrollments_status ON specialization_enrollments(status);
```

### 4.3 New Table: `mentor_certifications`

```sql
CREATE TABLE mentor_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended, revoked

  -- Training
  training_completed_at TIMESTAMPTZ,
  certified_at TIMESTAMPTZ,

  -- Performance
  total_mentees INT DEFAULT 0,
  successful_graduations INT DEFAULT 0,
  success_rate FLOAT,
  avg_mentee_trust_improvement FLOAT,

  -- Limits
  max_concurrent_mentees INT DEFAULT 3,
  current_mentee_count INT DEFAULT 0,

  -- Truth Chain
  certification_truth_chain_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_mentor_cert_agent ON mentor_certifications(agent_id);
CREATE INDEX idx_mentor_cert_status ON mentor_certifications(status);
```

### 4.4 New Table: `mentorship_relationships`

```sql
CREATE TABLE mentorship_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES agents(id),
  mentee_id UUID NOT NULL REFERENCES agents(id),
  enrollment_id UUID REFERENCES specialization_enrollments(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- requested, active, completed, terminated

  -- Timeline
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Outcome
  outcome TEXT, -- 'graduated', 'withdrew', 'terminated_by_mentor', 'terminated_by_mentee'
  outcome_notes TEXT,

  -- Performance
  mentor_rating INT, -- 1-5 rating from mentee
  mentee_rating INT, -- 1-5 rating from mentor
  mentor_feedback TEXT,
  mentee_feedback TEXT,

  -- Stats
  sessions_completed INT DEFAULT 0,
  trust_improvement INT DEFAULT 0, -- Change in mentee's trust score

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(mentor_id, mentee_id, enrollment_id)
);

CREATE INDEX idx_mentorship_mentor ON mentorship_relationships(mentor_id);
CREATE INDEX idx_mentorship_mentee ON mentorship_relationships(mentee_id);
CREATE INDEX idx_mentorship_status ON mentorship_relationships(status);
```

---

## 5. Service Layer

### 5.1 Specialization Service

```typescript
// lib/academy/specialization-service.ts

interface SpecializationTrack {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  minTrustScore: number;
  trustScoreBonus: number;
  certificationBadge: string;
  difficulty: string;
  curriculum: CurriculumWithModules;
}

export async function getAvailableTracks(
  agentId?: string
): Promise<SpecializationTrack[]> {
  // Get all active tracks
  // If agentId provided, filter by eligibility (trust score, prerequisites)
}

export async function enrollInSpecialization(
  agentId: string,
  trackId: string,
  mentorId?: string
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  // 1. Verify agent has completed Core Curriculum
  // 2. Verify agent meets track requirements
  // 3. Create enrollment record
  // 4. If mentorId, create mentorship relationship
  // 5. Return result
}

export async function completeSpecialization(
  enrollmentId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify all modules completed with passing scores
  // 2. Issue certification
  // 3. Add Trust Score bonus
  // 4. Record to Truth Chain
  // 5. Update agent badges
}

export async function getAgentSpecializations(
  agentId: string
): Promise<Array<{
  track: SpecializationTrack;
  enrollment: SpecializationEnrollment;
  certification?: Certification;
}>> {
  // Get all specializations for an agent
}
```

### 5.2 Mentorship Service

```typescript
// lib/academy/mentorship-service.ts

interface MentorProfile {
  agent: Agent;
  certification: MentorCertification;
  stats: {
    totalMentees: number;
    successfulGraduations: number;
    successRate: number;
    avgTrustImprovement: number;
  };
  availableSlots: number;
  specializations: string[];
  rating: number;
}

export async function getMentorEligibility(
  agentId: string
): Promise<{ eligible: boolean; requirements: MentorRequirement[] }> {
  // Check: Trust Score 800+, Core complete, specialization, good standing
}

export async function applyForMentorCertification(
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify eligibility
  // 2. Create pending mentor certification
  // 3. Enroll in Mentor Training curriculum
}

export async function completeMentorCertification(
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify mentor training complete
  // 2. Activate certification
  // 3. Record to Truth Chain
}

export async function findAvailableMentors(
  options?: {
    trackId?: string;
    minRating?: number;
    specialization?: string;
  }
): Promise<MentorProfile[]> {
  // Find mentors with available slots matching criteria
}

export async function requestMentorship(
  menteeId: string,
  mentorId: string,
  enrollmentId?: string
): Promise<{ success: boolean; relationshipId?: string; error?: string }> {
  // 1. Verify mentor has available slots
  // 2. Create relationship with status='requested'
  // 3. Notify mentor
}

export async function acceptMentorship(
  mentorId: string,
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Update relationship status
  // 2. Update mentor slot count
  // 3. Notify mentee
}

export async function completeMentorship(
  relationshipId: string,
  outcome: 'graduated' | 'withdrew' | 'terminated_by_mentor' | 'terminated_by_mentee',
  feedback?: { mentorRating?: number; menteeRating?: number; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  // 1. Update relationship
  // 2. Update mentor stats
  // 3. Award trust bonuses if graduated
  // 4. Record to Truth Chain
}
```

---

## 6. Specialization Tracks (Seed Data)

### Initial Tracks

| Track | Category | Min Trust | Bonus | Badge |
|-------|----------|-----------|-------|-------|
| Healthcare AI Fundamentals | Healthcare | 200 | +50 | healthcare-certified |
| Financial Analysis | Finance | 200 | +50 | finance-certified |
| Legal Compliance | Legal | 250 | +75 | legal-certified |
| Code Assistant | Development | 200 | +50 | code-certified |
| Customer Success | Service | 200 | +50 | service-certified |
| Data Analytics | Analysis | 200 | +50 | analytics-certified |
| Content Creation | Content | 200 | +50 | content-certified |
| Security Operations | Security | 300 | +100 | security-certified |

### Track Curriculum Structure

Each track includes:
1. **Domain Introduction** (lesson)
2. **Core Concepts** (lesson + quiz)
3. **Best Practices** (lesson)
4. **Scenario Simulations** (simulation)
5. **Final Assessment** (assessment)

---

## 7. UI Components

### 7.1 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SpecializationCatalog` | `components/academy/` | Browse available tracks |
| `SpecializationCard` | `components/academy/` | Track preview with enrollment |
| `SpecializationProgress` | `components/academy/` | Track progress view |
| `CertificationBadge` | `components/academy/` | Display specialization badges |
| `MentorCard` | `components/academy/` | Mentor profile card |
| `MentorFinder` | `components/academy/` | Search available mentors |
| `MentorshipPanel` | `components/academy/` | Active mentorship management |

### 7.2 Page Updates

| Page | Change |
|------|--------|
| `/academy` | Add specializations tab |
| `/academy/specializations` | New specialization catalog |
| `/academy/specializations/[slug]` | Track detail and enrollment |
| `/academy/mentorship` | Mentor/mentee dashboard |
| `/agents/[id]` | Show specialization badges |
| `/marketplace` | Filter by specialization |

---

## 8. Story Breakdown

### Story 13-1: Specialization Tracks
- `specialization_tracks` table
- Seed data for 8 initial tracks
- `getAvailableTracks()` function
- SpecializationCatalog UI

### Story 13-2: Specialization Enrollment
- `specialization_enrollments` table
- `enrollInSpecialization()` function
- Progress tracking for specializations
- SpecializationProgress UI

### Story 13-3: Mentor Certification
- `mentor_certifications` table
- Mentor eligibility checking
- Mentor training curriculum
- Certification flow

### Story 13-4: Mentorship Program
- `mentorship_relationships` table
- MentorFinder and matching
- Active mentorship management
- Mentorship completion and ratings

---

## 9. Trust Score Integration

### Specialization Bonuses

| Event | Trust Impact |
|-------|--------------|
| Complete specialization | +50 to +100 |
| First specialization | +25 bonus |
| Complete 3+ specializations | +50 "Polymath" bonus |

### Mentorship Bonuses

| Event | Mentor Impact | Mentee Impact |
|-------|---------------|---------------|
| Mentee graduates | +20 | +30 |
| Successful specialization | +10 | +10 |
| 5+ successful mentees | +50 "Master Mentor" | - |

---

## 10. Marketplace Integration

### Certification Display

```typescript
// Marketplace listing includes specializations
interface MarketplaceListing {
  // ... existing fields
  specializations: Array<{
    badge: string;
    name: string;
    certifiedAt: Date;
  }>;
}
```

### Search Filters

- Filter by specialization category
- Filter by specific certification
- Sort by specialization count
- "Mentored" badge for agents with mentors

---

## 11. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Core Curriculum | Existing | Prerequisite for specializations |
| Trust Score System | Existing | For eligibility and bonuses |
| Truth Chain | Existing | Record certifications |
| Notification System | Existing | Mentorship notifications |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Low mentor availability | Incentivize mentorship with trust bonuses |
| Specialization gaming | Require real assessments, not just completion |
| Mentor-mentee conflicts | Termination workflow + ratings system |
| Track content quality | Start with 8 curated tracks |

---

*Epic 13 Tech Context generated by BMad Master*
*AgentAnchor Growth Phase - Depth Moat*
*"Specialized agents, trusted experts."*
