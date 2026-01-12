# Story 3-3: Upchain Decision Protocol

## Story
As a **Worker Agent**, I want to request Council approval for risky actions, so that I operate within safe boundaries.

## Status: Done

## Acceptance Criteria

- [x] Worker agents can submit upchain requests
- [x] Risk assessment classifies action risk level
- [x] L0-L1 actions auto-approved with logging
- [x] L2 actions require single validator approval
- [x] L3 actions require majority (3/4) approval
- [x] L4 actions require unanimous + human escalation
- [x] Decisions stored with full context
- [x] Agent's trust tier affects auto-approval threshold

## Technical Notes

- Risk assessment uses action type + context analysis
- Trust tier can raise auto-approval ceiling (higher trust = more autonomy)
- Pending requests have timeout (5 min default)
- All decisions recorded to audit log

## Implementation Tasks

1. Create risk assessment service
2. Create upchain request queue/status tracking
3. Add trust-tier autonomy integration
4. Create pending decisions API
5. Add decision notification system

## Dependencies

- Story 3-1: Council Validator Agents (complete)
- Story 3-2: Risk Level Classification (complete)

## FRs Covered

- FR60-64: Risk-based approval routing
- FR66: Trust affects autonomy
