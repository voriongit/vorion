# Story 2-5: Agent Graduation

## Story
As a **Trainer**, I want my agent to graduate from the Academy, so that it receives Trust Score and can be published.

## Status: Done

## Acceptance Criteria

- [x] Agent receives initial Trust Score 200-399 upon graduation
- [x] Trust Tier shows "Novice" with badge
- [x] Graduation recorded on Truth Chain (audit log)
- [x] Status changes from "Training" to "Active"
- [x] "Publish to Marketplace" button shown (disabled - coming soon)
- [x] Success message shown to Trainer
- [ ] Graduation ceremony UI with animation (deferred)

## Technical Notes

- Initial Trust Score: 200 + (exam_score / 100 * 199)
- Trust tier calculated automatically by DB trigger
- Truth Chain record created for graduation
- Agent status transitions: draft → training → active

## Implementation Tasks

1. Create POST /api/agents/[id]/graduate endpoint
2. Add graduation UI to agent profile page
3. Create trust history record
4. Create truth chain record
5. Update agent status

## Dependencies

- Story 2-4: Council Examination (complete)

## FRs Covered

- FR46: Graduated agents receive Trust Score 200-399
- FR49: Graduation recorded on Truth Chain
