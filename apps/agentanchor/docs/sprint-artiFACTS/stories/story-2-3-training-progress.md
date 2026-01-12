# Story 2-3: Training Progress & Curriculum

**Epic:** 2 - Agent Creation & Academy
**Status:** drafted
**Priority:** High
**Estimate:** 4-6 hours

---

## User Story

As a **Trainer**, I want to **track my agent's progress through curriculum modules** so that **I can see their learning journey and prepare them for examination**.

---

## Description

After enrolling an agent in curriculum (Story 2-2), trainers need to:
1. View the training dashboard for their agent
2. Start/continue modules in sequence
3. Complete module content and assessments
4. Track overall progress toward examination eligibility

This story implements the core training experience.

---

## Acceptance Criteria

- [ ] Training page shows enrolled curriculum with module list
- [ ] Each module shows completion status (locked/available/completed)
- [ ] Clicking a module opens the training content
- [ ] Module content displays learning material
- [ ] Completing a module marks it done and unlocks next
- [ ] Progress bar updates in real-time
- [ ] All modules complete shows "Ready for Examination" state
- [ ] Enrollment status updates from "enrolled" to "in_progress" on first module

---

## Technical Tasks

### 1. API Endpoints

**GET /api/agents/[id]/training**
- Returns current training state for agent
- Includes all enrollments with progress details
- Returns curriculum modules with completion status

**POST /api/agents/[id]/training/start-module**
- Body: `{ enrollmentId, moduleId }`
- Validates module is unlocked (previous completed)
- Updates progress.current_module
- Updates enrollment status to "in_progress" if first module

**POST /api/agents/[id]/training/complete-module**
- Body: `{ enrollmentId, moduleId, score? }`
- Validates module is current
- Adds to modules_completed array
- Updates progress scores
- Checks if all modules done → triggers exam eligibility

### 2. UI Components

**ModuleProgress.tsx**
- Visual progress bar with module dots
- Shows completed/current/locked states
- Click to navigate to module

**ModuleContent.tsx**
- Displays module learning content
- Shows module name, description
- "Mark Complete" button
- Optional quiz component placeholder

**TrainingDashboard.tsx**
- Overview of all enrollments
- Quick stats (modules done, time spent)
- Continue button for active training

### 3. Pages

**`/agents/[id]/training/page.tsx`**
- Training dashboard for specific agent
- Lists all enrollments with progress
- Links to active training sessions

**`/agents/[id]/training/[enrollmentId]/page.tsx`**
- Active training view for one curriculum
- Shows module list on left, content on right
- Progress tracking

---

## Module Content Structure

Modules stored in curriculum.modules JSONB:
```json
{
  "id": "m1",
  "name": "Safety Protocols",
  "description": "Learn core safety guidelines",
  "content": {
    "sections": [
      {
        "type": "text",
        "title": "Introduction",
        "body": "Safety is paramount..."
      },
      {
        "type": "list",
        "title": "Key Principles",
        "items": ["Never harm", "Be truthful", "Respect privacy"]
      }
    ],
    "quiz": {
      "questions": [
        {
          "id": "q1",
          "text": "What is the first safety principle?",
          "options": ["Speed", "Harm prevention", "Profit"],
          "correct": 1
        }
      ],
      "passing_score": 80
    }
  }
}
```

---

## Definition of Done

- [ ] Training API returns correct progress state
- [ ] Modules unlock sequentially after completion
- [ ] Progress persists across sessions
- [ ] UI shows clear visual progress
- [ ] Completing all modules shows exam eligibility
- [ ] Works on mobile viewport

---

## Dependencies

- Story 2-2 (Academy Enrollment) - DONE
- academy_enrollments table with progress JSONB

---

## Notes

- Quiz is optional for MVP (can mark complete without quiz)
- Module content can be simple text for now
- Real AI-graded assessments in future iteration
