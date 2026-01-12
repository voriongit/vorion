# Story 3-4: Precedent Library

## Story
As a **Council Validator**, I want to reference past decisions, so that rulings are consistent.

## Status: Done

## Acceptance Criteria

- [x] Significant decisions (L3+) create precedents
- [x] Precedents have summary, tags, and outcome
- [x] Search precedents by action type or tags
- [x] View precedent details with full context
- [x] Precedent feed on Council dashboard
- [x] Validators can cite precedents in reasoning

## Technical Notes

- Create council_precedents table
- Link precedents to original decisions
- Tags for categorization (safety, ethics, compliance, etc.)
- Full-text search on summary/context

## Implementation Tasks

1. Create council_precedents database table
2. Create precedent service
3. Create precedent API endpoints
4. Add precedent section to Council dashboard
5. Integrate precedent lookup in evaluations

## Dependencies

- Story 3-3: Upchain Decision Protocol (complete)

## FRs Covered

- FR67: Precedent library for consistency
- FR68: Searchable precedent database
