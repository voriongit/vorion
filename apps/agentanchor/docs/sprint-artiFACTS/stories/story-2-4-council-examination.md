# Story 2-4: Council Examination

## Story
As a **Trainer**, I want my agent to be examined by the Council, so that it can graduate and be published.

## Status: Done

## Acceptance Criteria

- [x] "Request Examination" button enabled when all curriculum modules complete
- [x] Examination request sent to Council
- [x] Council validators vote on graduation
- [x] Each validator provides vote and reasoning
- [x] Pass with majority (3/4) approval
- [x] View examination results with all votes
- [x] Failed exams can retry after 24 hours

## Technical Notes

- Examination is a Council decision with risk_level = 2
- Uses `evaluateExamination()` from council-service
- Results stored in `council_examinations` table
- Failed exams tracked with retry cooldown

## Implementation Tasks

1. Create POST /api/agents/[id]/examine endpoint
2. Add RequestExaminationButton component
3. Create examination results display
4. Add retry cooldown logic
5. Update agent status on pass

## Dependencies

- Story 2-3: Training Progress (complete)
- Story 3-1: Council Validators (complete)

## FRs Covered

- FR45: Council examination required
- FR65: Decisions include reasoning
