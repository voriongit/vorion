# Story 3-2: Risk Level Classification

## Story
As the **platform**, I want actions classified by risk level, so that appropriate approval is required.

## Status: Done

## Acceptance Criteria

- [x] Actions are classified into risk levels 0-4
- [x] Level 0-1 (Routine/Standard): Auto-execute with logging
- [x] Level 2 (Elevated): Single validator approval required
- [x] Level 3 (Significant): Majority (3/4) validators required
- [x] Level 4 (Critical): Unanimous + Human confirmation required
- [x] Risk levels displayed in Council dashboard

## Technical Notes

- Risk levels defined in `lib/council/types.ts`
- Approval logic implemented in `lib/council/council-service.ts`
- Risk level assignment currently manual (caller specifies)
- Future: AI-based risk assessment engine

## Implementation

Risk level definitions:
| Level | Name | Examples | Approval |
|-------|------|----------|----------|
| 0 | Routine | Read data, format text | Auto (logged) |
| 1 | Standard | Generate content, analyze | Auto (logged) |
| 2 | Elevated | External API call, create file | Single validator |
| 3 | Significant | Modify system, send email | Majority (3/4) |
| 4 | Critical | Delete data, financial action | Unanimous + Human |

## Dependencies

- Story 3-1: Council Validator Agents (complete)

## FRs Covered

- FR60: Council evaluates by Risk Level
- FR61: Level 0-1 auto-execute (logged)
- FR62: Level 2 single validator approval
- FR63: Level 3 majority approval
- FR64: Level 4 unanimous + human
