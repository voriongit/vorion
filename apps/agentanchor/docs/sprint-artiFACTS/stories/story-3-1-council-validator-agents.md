# Story 3-1: Council Validator Agents

## Story
As the **platform**, I want specialized Council validator agents, so that governance decisions have domain expertise.

## Status: In Progress

## Acceptance Criteria

- [x] Platform has 4 core validators: Guardian, Arbiter, Scholar, Advocate
- [ ] Guardian validator assesses safety and security threats
- [ ] Arbiter validator assesses ethics and fairness
- [ ] Scholar validator checks compliance with standards
- [ ] Advocate validator assesses user impact
- [ ] Each validator returns: decision, reasoning, confidence
- [ ] Validators stored as system agents (not user-created)

## Technical Notes

- Each validator is a Claude instance with specific system prompt
- Validator prompts defined per Architecture section 3.4
- Temperature = 0 for deterministic governance
- Return format: { decision: 'approve' | 'deny' | 'abstain', reasoning: string, confidence: number }

## Implementation Tasks

1. Create Council service with validator definitions
2. Create database table for council_decisions (if not exists)
3. Create system validator prompts
4. Create API endpoint: POST /api/council/evaluate
5. Create Council dashboard page placeholder

## Dependencies

- None (first Epic 3 story)

## FRs Covered

- FR58: Council has specialized validators
- FR59: Core validators: Guardian, Arbiter, Scholar, Advocate
- FR65: Decisions include reasoning
