# Story 2-6: Agent History & Archive

## Story
As a **Trainer**, I want to see my agent's history and archive inactive agents, so that I can manage my portfolio.

## Status: Done

## Acceptance Criteria

- [x] View agent timeline (creation, enrollment, training, graduation)
- [x] Trust score change history visible
- [x] Archive inactive agents (soft delete)
- [x] Restore archived agents
- [ ] Filter agents by status (deferred to dashboard epic)

## Technical Notes

- Uses existing trust_history table
- Archive = status change to 'archived'
- Timeline built from multiple sources (enrollments, examinations, trust_history)

## Implementation Tasks

1. Create GET /api/agents/[id]/history endpoint
2. Add timeline component to agent detail page
3. Add archive/restore functionality
4. Update agents list with filters

## Dependencies

- Story 2-5: Agent Graduation (complete)

## FRs Covered

- FR52: Agent history visible
- FR53: Archive inactive agents
