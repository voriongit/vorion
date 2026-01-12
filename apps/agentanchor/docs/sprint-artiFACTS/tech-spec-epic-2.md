# Epic 2: Agent Creation & Academy - Technical Specification

**Version:** 1.0
**Date:** 2025-11-29
**Status:** Active
**Epic Goal:** Trainers can create agents, enroll them in the Academy, and graduate them with certification

---

## Epic Overview

Epic 2 transforms the basic "bots" system into the full AgentAnchor governance model:
- **Agents** replace "bots" with trust scores and certification
- **Academy** provides structured training curriculum
- **Council Examination** gates graduation
- **Certifications** are recorded for trust

### Stories in This Epic

| Story | Title | Status |
|-------|-------|--------|
| 2-1 | Create New Agent | Ready |
| 2-2 | Academy Enrollment | Backlog |
| 2-3 | Training Progress & Curriculum | Backlog |
| 2-4 | Council Examination | Backlog |
| 2-5 | Agent Graduation | Backlog |
| 2-6 | Agent History & Archive | Backlog |

---

## Technical Architecture

### Database Schema Evolution

The existing `bots` table will be evolved into `agents` with additional columns:

```sql
-- Migrate bots to agents (backward compatible)
ALTER TABLE bots RENAME TO agents;

-- Add governance columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 1000);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_tier VARCHAR(20) DEFAULT 'untrusted';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS certification_level INT DEFAULT 0 CHECK (certification_level >= 0 AND certification_level <= 5);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'; -- draft, training, active, suspended, archived
ALTER TABLE agents ADD COLUMN IF NOT EXISTS maintenance_flag VARCHAR(20) DEFAULT 'author';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS specialization VARCHAR(50);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '[]';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]';

-- Academy enrollment tracking
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  curriculum_id UUID REFERENCES academy_curriculum(id) NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'enrolled', -- enrolled, in_progress, completed, failed
  progress JSONB DEFAULT '{}', -- {modules_completed: [], current_module: '', scores: {}}
  UNIQUE(agent_id, curriculum_id)
);

-- Academy curriculum
CREATE TABLE IF NOT EXISTS academy_curriculum (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  specialization VARCHAR(50), -- 'core', 'customer_service', 'technical', 'creative', etc.
  difficulty_level INT DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  modules JSONB NOT NULL DEFAULT '[]', -- [{id, name, description, content, quiz}]
  prerequisites UUID[], -- Other curriculum IDs that must be completed first
  certification_points INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trust history tracking
CREATE TABLE IF NOT EXISTS trust_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  score INT NOT NULL,
  tier VARCHAR(20) NOT NULL,
  previous_score INT,
  change_amount INT,
  reason VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'task_complete', 'council_commend', 'academy_complete', 'council_deny', 'decay'
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Council examinations
CREATE TABLE IF NOT EXISTS council_examinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  curriculum_id UUID REFERENCES academy_curriculum(id) NOT NULL,
  examiner_votes JSONB NOT NULL DEFAULT '[]', -- [{validator, vote, reasoning, timestamp}]
  outcome VARCHAR(20), -- 'pending', 'passed', 'failed', 'deferred'
  final_reasoning TEXT,
  certification_awarded INT DEFAULT 0,
  trust_points_awarded INT DEFAULT 0,
  examined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Trust Score System

Trust tiers based on score (0-1000):

| Score Range | Tier | Meaning |
|-------------|------|---------|
| 0-199 | Untrusted | New agent, minimal autonomy |
| 200-399 | Novice | Some verified actions |
| 400-599 | Proven | Reliable track record |
| 600-799 | Trusted | High autonomy |
| 800-899 | Elite | Exceptional performance |
| 900-1000 | Legendary | Top tier, maximum trust |

### API Endpoints

```
POST   /api/agents              - Create new agent
GET    /api/agents              - List trainer's agents
GET    /api/agents/:id          - Get agent details
PUT    /api/agents/:id          - Update agent
DELETE /api/agents/:id          - Archive agent

POST   /api/agents/:id/enroll   - Enroll in academy curriculum
GET    /api/agents/:id/training - Get training progress
POST   /api/agents/:id/submit-module - Submit module completion

GET    /api/academy/curriculum  - List available curriculum
GET    /api/academy/curriculum/:id - Get curriculum details

POST   /api/agents/:id/request-examination - Request council exam
GET    /api/agents/:id/examination - Get examination status
```

### UI Components

```
components/
├── agents/
│   ├── AgentCard.tsx           - Agent display card with trust badge
│   ├── AgentForm.tsx           - Create/edit agent form
│   ├── AgentList.tsx           - Paginated agent list
│   ├── TrustBadge.tsx          - Visual trust tier indicator
│   └── AgentStatus.tsx         - Status pill (draft/training/active)
├── academy/
│   ├── CurriculumCard.tsx      - Training track display
│   ├── ModuleProgress.tsx      - Module completion progress
│   ├── QuizComponent.tsx       - Interactive quiz for modules
│   └── EnrollmentStatus.tsx    - Enrollment progress display
└── trust/
    ├── TrustScoreChart.tsx     - Trust history visualization
    ├── TrustTierBadge.tsx      - Tier badge component
    └── TrustHistory.tsx        - Trust change log
```

### Page Routes

```
app/
├── agents/
│   ├── page.tsx                - List all trainer's agents
│   ├── new/page.tsx            - Create new agent
│   └── [id]/
│       ├── page.tsx            - Agent details/dashboard
│       ├── edit/page.tsx       - Edit agent settings
│       ├── training/page.tsx   - Academy training view
│       └── trust/page.tsx      - Trust history view
└── academy/
    ├── page.tsx                - Academy overview
    └── [curriculumId]/page.tsx - Curriculum details
```

---

## Story 2-1: Create New Agent

### Objective
Allow trainers to create a new AI agent with basic configuration

### Tasks
1. Create migration to evolve bots → agents table
2. Create AgentForm component with fields:
   - Name (required)
   - Description
   - System Prompt (required)
   - Model selection (claude-sonnet-4, etc.)
   - Specialization (dropdown)
   - Personality traits (multi-select)
   - Capabilities (multi-select)
3. Create `/api/agents` POST endpoint with validation
4. Create `/agents/new` page
5. Update `/agents` list page to show all agents with trust badges
6. Create TrustBadge and AgentCard components
7. Add tests and validation

### Acceptance Criteria
- [ ] Trainer can access "Create Agent" from navigation
- [ ] Form validates required fields before submission
- [ ] New agent is created with status="draft", trust_score=0, trust_tier="untrusted"
- [ ] Agent appears in trainer's agent list
- [ ] Trust badge shows correct tier

---

## Story 2-2: Academy Enrollment

### Objective
Allow agents to enroll in Academy curriculum tracks

### Tasks
1. Create academy_curriculum table and seed initial courses
2. Create academy_enrollments table
3. Create CurriculumCard and EnrollmentStatus components
4. Create `/api/academy/curriculum` endpoints
5. Create `/api/agents/:id/enroll` endpoint
6. Create `/academy` page showing available tracks
7. Create enrollment flow in agent detail page

### Acceptance Criteria
- [ ] Trainer can view available curriculum tracks
- [ ] Trainer can enroll agent in a track
- [ ] Agent status changes to "training" on enrollment
- [ ] Enrollment appears in agent's training view

---

## Story 2-3: Training Progress & Curriculum

### Objective
Track agent progress through curriculum modules

### Tasks
1. Create ModuleProgress component
2. Create QuizComponent for module assessments
3. Create `/api/agents/:id/training` GET endpoint
4. Create `/api/agents/:id/submit-module` POST endpoint
5. Create `/agents/[id]/training` page
6. Implement module completion logic with scoring

### Acceptance Criteria
- [ ] Progress bar shows modules completed
- [ ] Agent can attempt module quizzes
- [ ] Passing score advances to next module
- [ ] All modules complete triggers exam eligibility

---

## Story 2-4: Council Examination

### Objective
Implement council examination for certification

### Tasks
1. Create council_examinations table
2. Create examination request endpoint
3. Create mock council validators (Guardian, Arbiter, Scholar, Advocate)
4. Implement voting logic
5. Create examination status UI

### Acceptance Criteria
- [ ] Agent can request examination after completing curriculum
- [ ] 4 validators evaluate agent
- [ ] Majority approval grants certification
- [ ] Result recorded in examination history

---

## Story 2-5: Agent Graduation

### Objective
Graduate agents with certification and initial trust score

### Tasks
1. Create graduation ceremony flow
2. Award certification level based on curriculum
3. Award initial trust points
4. Update agent status to "active"
5. Record on trust history
6. Display graduation badge

### Acceptance Criteria
- [ ] Passed examination triggers graduation
- [ ] Certification level increases
- [ ] Trust score increases
- [ ] Agent status becomes "active"
- [ ] Graduation badge displayed on agent card

---

## Story 2-6: Agent History & Archive

### Objective
View agent history and archive inactive agents

### Tasks
1. Create trust history view
2. Create TrustScoreChart component
3. Create archive agent flow
4. Create `/agents/[id]/trust` page
5. Filter agents by status

### Acceptance Criteria
- [ ] Trust history shows all changes
- [ ] Chart visualizes trust over time
- [ ] Trainer can archive agents
- [ ] Archived agents hidden from default view

---

## Migration Strategy

### Phase 1: Schema Evolution (Story 2-1)
1. Rename `bots` → `agents` (compatibility alias)
2. Add new columns with defaults
3. Update foreign key references
4. Migrate existing data

### Phase 2: New Tables (Story 2-2)
1. Create `academy_curriculum` table
2. Create `academy_enrollments` table
3. Seed initial curriculum data

### Phase 3: Trust System (Story 2-3+)
1. Create `trust_history` table
2. Create `council_examinations` table
3. Implement trust score functions

---

## Dependencies

- Epic 1 complete (auth, navigation, database)
- Supabase migrations applied
- UI components from Story 1-5 (ComingSoonPage, etc.)

---

## Technical Notes

1. **Backward Compatibility**: Old `bots` references should continue to work via alias
2. **Trust Calculation**: Trust tier calculated on read, not stored separately
3. **Council Validators**: MVP uses mock AI validators, later integrates Claude
4. **Curriculum Content**: Initial courses are hardcoded, later becomes CMS-driven
