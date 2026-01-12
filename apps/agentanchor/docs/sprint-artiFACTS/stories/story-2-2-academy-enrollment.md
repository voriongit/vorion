# Story 2-2: Academy Enrollment

**Epic:** 2 - Agent Creation & Academy
**Status:** drafted
**Priority:** High
**Estimate:** 4-6 hours

---

## User Story

As a **Trainer**, I want to **enroll my agent in Academy curriculum tracks** so that **my agent can learn skills and earn certification**.

---

## Description

After creating an agent (Story 2-1), trainers need to enroll them in the Academy to begin the certification process. The Academy offers structured curriculum tracks based on specialization (Core Fundamentals, Customer Service, Technical Support, Creative Writing, etc.).

This story implements:
1. Academy curriculum database tables
2. Enrollment tracking
3. UI for browsing and enrolling in curriculum
4. Agent status transition (draft → training)

---

## Acceptance Criteria

- [ ] Trainer can view available curriculum tracks on `/academy` page
- [ ] Each curriculum shows name, description, difficulty, modules count
- [ ] Trainer can select an agent and enroll in a curriculum
- [ ] Enrollment validates prerequisites are met
- [ ] Agent status changes from "draft" to "training" on first enrollment
- [ ] Enrollment appears on agent detail page
- [ ] Cannot enroll same agent in same curriculum twice

---

## Technical Tasks

### 1. Database Migration
Create `academy_curriculum` and `academy_enrollments` tables:

```sql
-- Academy curriculum tracks
CREATE TABLE IF NOT EXISTS academy_curriculum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  specialization VARCHAR(50) NOT NULL,
  difficulty_level INT DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  modules JSONB NOT NULL DEFAULT '[]',
  prerequisites UUID[],
  certification_points INT DEFAULT 10,
  estimated_hours INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollment tracking
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  curriculum_id UUID REFERENCES academy_curriculum(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'enrolled',
  progress JSONB DEFAULT '{"modules_completed": [], "current_module": null, "scores": {}}',
  UNIQUE(agent_id, curriculum_id)
);
```

### 2. Seed Initial Curriculum
Create seed data for core curriculum tracks:
- Core Fundamentals (difficulty 1)
- Customer Service Specialist (difficulty 2)
- Technical Support Expert (difficulty 3)
- Creative Writing Master (difficulty 3)
- Data Analysis Professional (difficulty 4)

### 3. API Endpoints

**GET /api/academy/curriculum**
- List all available curriculum tracks
- Optional filter by specialization

**GET /api/academy/curriculum/[id]**
- Get single curriculum with full module details

**POST /api/agents/[id]/enroll**
- Body: `{ curriculumId: string }`
- Validates agent belongs to user
- Validates prerequisites met
- Creates enrollment record
- Updates agent status to "training" if first enrollment

**GET /api/agents/[id]/enrollments**
- List all enrollments for an agent

### 4. UI Components

**CurriculumCard.tsx**
- Display curriculum info (name, description, difficulty stars, modules count)
- Enroll button
- Prerequisites warning if not met

**EnrollmentStatus.tsx**
- Show enrollment progress
- Status badge (enrolled, in_progress, completed)

**AcademyPage** (`/academy`)
- Grid of CurriculumCards
- Filter by specialization
- Search curriculum

**AgentEnrollSection** (on agent detail page)
- Show current enrollments
- Quick enroll button

### 5. Agent Status Update
- Add status field handling in agent update logic
- Transition: draft → training on first enrollment

---

## Definition of Done

- [ ] Database migrations applied successfully
- [ ] Seed data creates 5 curriculum tracks
- [ ] API endpoints return correct data
- [ ] Academy page displays curriculum grid
- [ ] Enrollment creates record and updates agent status
- [ ] Error handling for duplicate enrollment
- [ ] Error handling for missing prerequisites
- [ ] TypeScript types for curriculum and enrollment

---

## Dependencies

- Story 2-1 (Create New Agent) - DONE
- Agents table with status column - DONE

---

## Notes

- Modules content is stored as JSONB for flexibility
- Prerequisites are optional for Core Fundamentals
- Difficulty shown as star rating (1-5)
- Enrollment status: enrolled → in_progress → completed

---

## Test Cases

1. View academy page shows all curriculum
2. Filter by specialization works
3. Enroll agent in curriculum succeeds
4. Duplicate enrollment returns error
5. Agent status changes to "training"
6. Prerequisites check blocks enrollment if not met
