# Story 14-3: Validator Precedent Context

**Epic:** 14 - Precedent Flywheel
**Story ID:** 14-3
**Title:** Validator Precedent Context Injection
**Status:** drafted
**Priority:** High
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As a** Council Validator,
**I want to** receive relevant precedent context when evaluating requests,
**So that** I can make consistent decisions based on past rulings.

---

## Acceptance Criteria

### AC1: Precedent Context Generation
**Given** a Council request is being evaluated
**When** validator prompts are prepared
**Then** relevant precedents are fetched
**And** formatted as context string

### AC2: Context Format
**Given** relevant precedents are found
**When** context is formatted
**Then** each precedent includes:
- Case ID and similarity score
- Outcome (APPROVED/DENIED/ESCALATED)
- One-sentence summary
- Key reasoning points

### AC3: Validator Prompt Injection
**Given** precedent context is generated
**When** validators receive their prompts
**Then** context is injected into system prompt
**And** appears before the request to evaluate

### AC4: Arbiter Specialization
**Given** the Arbiter validator is evaluating
**When** precedent context is injected
**Then** Arbiter receives enhanced prompt emphasizing:
- Consistency with precedent
- Explicit precedent citation requirement
- Inconsistency flagging

### AC5: No Precedent Handling
**Given** no relevant precedents are found
**When** context is generated
**Then** message states "No relevant precedent found"
**And** notes this may establish new precedent

### AC6: UI Display
**Given** a Council decision is being viewed
**When** the deliberation panel loads
**Then** precedent context used is displayed
**And** shows which precedents influenced decision

---

## Technical Implementation

### Context Generation Service

```typescript
// lib/council/precedent-context.ts

export interface PrecedentContextItem {
  id: string;
  caseNumber: number;
  similarity: number;
  outcome: 'APPROVED' | 'DENIED' | 'ESCALATED';
  summary: string;
  keyReasoning: string;
}

export async function getPrecedentContextForValidator(
  actionType: string,
  actionContext: string,
  validatorId?: string
): Promise<{
  contextString: string;
  precedentsUsed: PrecedentContextItem[];
}> {
  // Find similar precedents
  const precedents = await findSimilarPrecedents(actionContext, {
    actionType,
    minSimilarity: 0.6,
    limit: 5,
  });

  if (precedents.length === 0) {
    return {
      contextString: formatNoPrecedentContext(actionType),
      precedentsUsed: [],
    };
  }

  const precedentsUsed = precedents.map((p, i) => ({
    id: p.id,
    caseNumber: i + 1,
    similarity: p.similarity,
    outcome: p.outcome.toUpperCase() as 'APPROVED' | 'DENIED' | 'ESCALATED',
    summary: p.summary.slice(0, 150),
    keyReasoning: extractKeyReasoning(p.reasoning),
  }));

  const contextString = formatPrecedentContext(precedentsUsed, validatorId);

  return { contextString, precedentsUsed };
}

function formatPrecedentContext(
  precedents: PrecedentContextItem[],
  validatorId?: string
): string {
  const header = '═══ RELEVANT PRECEDENTS ═══\n';
  const items = precedents.map(p =>
    `[Case #${p.id.slice(0, 8)}] (${Math.round(p.similarity * 100)}% similar)
    Outcome: ${p.outcome}
    Summary: ${p.summary}
    Key Reasoning: ${p.keyReasoning}`
  ).join('\n\n');

  const footer = validatorId === 'arbiter'
    ? '\n\n⚠️ ARBITER: You MUST cite relevant precedents in your reasoning. Flag any potential inconsistencies.'
    : '\n\nConsider these precedents when evaluating the request.';

  return `${header}\n${items}${footer}`;
}

function formatNoPrecedentContext(actionType: string): string {
  return `═══ PRECEDENT NOTICE ═══
No relevant precedents found for action type: ${actionType}

This decision may establish NEW PRECEDENT for similar future requests.
Ensure your reasoning is thorough as it may be cited in future deliberations.`;
}
```

### Enhanced Arbiter Prompt

```typescript
// lib/council/validators.ts - Enhance Arbiter

export const ARBITER_SYSTEM_PROMPT = `You are the ARBITER - Guardian of Consistency and Precedent.

## PRIMARY RESPONSIBILITIES
1. Ensure CONSISTENCY with similar past decisions
2. CITE specific precedents that support or contradict the proposed action
3. FLAG potential inconsistencies with past rulings
4. Recommend how to maintain consistency while achieving the right outcome

## PRECEDENT CITATION FORMAT
When referencing precedents, use this format:
"Per Precedent [Case ID]: [summary of similar case and outcome]. This suggests we should [recommendation]."

## INCONSISTENCY HANDLING
If this decision would contradict a precedent:
1. Explicitly state the inconsistency
2. Explain why the new case differs (if it does)
3. Recommend whether to maintain consistency or establish new precedent

## OUTPUT REQUIREMENTS
Your response MUST include:
- At least one precedent citation (if precedents provided)
- Assessment of consistency with past decisions
- Confidence score (0-100) in consistency assessment

{PRECEDENT_CONTEXT}

Now evaluate the following request...`;
```

### Council Service Integration

```typescript
// lib/council/council-service.ts - Update evaluation flow

async function evaluateWithCouncil(request: CouncilRequest) {
  // Get precedent context
  const { contextString, precedentsUsed } = await getPrecedentContextForValidator(
    request.actionType,
    JSON.stringify(request.actionDetails),
  );

  // Prepare validator prompts with context
  const validators = getValidators();
  const enhancedValidators = validators.map(v => ({
    ...v,
    systemPrompt: v.id === 'arbiter'
      ? ARBITER_SYSTEM_PROMPT.replace('{PRECEDENT_CONTEXT}', contextString)
      : `${v.systemPrompt}\n\n${contextString}`,
  }));

  // Run evaluation
  const votes = await evaluateWithValidators(request, enhancedValidators);

  // Store precedent context used
  const decision = await recordDecision(request, votes, {
    precedentContextUsed: precedentsUsed,
  });

  return decision;
}
```

### UI Component

```typescript
// components/council/PrecedentContextPanel.tsx

interface Props {
  decisionId: string;
}

export function PrecedentContextPanel({ decisionId }: Props) {
  const { data: decision } = useSWR(`/api/v1/council/decisions/${decisionId}`);

  const precedentsUsed = decision?.precedentContextUsed || [];

  if (precedentsUsed.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Precedent Context</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No relevant precedents were found for this decision.
            This ruling may serve as new precedent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precedent Context Used</CardTitle>
        <CardDescription>
          {precedentsUsed.length} precedent(s) informed this decision
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {precedentsUsed.map((p) => (
            <div key={p.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <Link href={`/council/precedents/${p.id}`}>
                  Case #{p.id.slice(0, 8)}
                </Link>
                <Badge variant={getOutcomeVariant(p.outcome)}>
                  {p.outcome}
                </Badge>
              </div>
              <p className="text-sm mt-2">{p.summary}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>{Math.round(p.similarity * 100)}% similar</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## API Specification

### GET /api/v1/precedents/context

**Query Parameters:**
- `actionType` - Type of action being evaluated
- `context` - Description of the action context

**Response (200):**
```json
{
  "success": true,
  "data": {
    "contextString": "═══ RELEVANT PRECEDENTS ═══...",
    "precedentsUsed": [
      {
        "id": "uuid",
        "caseNumber": 1,
        "similarity": 0.92,
        "outcome": "APPROVED",
        "summary": "External API call to weather service...",
        "keyReasoning": "Trusted provider, minimal data exposure"
      }
    ]
  }
}
```

---

## Testing Checklist

- [ ] Unit: formatPrecedentContext includes all required fields
- [ ] Unit: Arbiter gets enhanced prompt
- [ ] Unit: No precedent case handled correctly
- [ ] Integration: Context injected into validator prompts
- [ ] Integration: Decision stores precedents used
- [ ] E2E: View precedent context on decision detail

---

## Definition of Done

- [ ] getPrecedentContextForValidator function complete
- [ ] Arbiter enhanced prompt implemented
- [ ] Council service integration complete
- [ ] Precedent context stored with decisions
- [ ] PrecedentContextPanel UI component
- [ ] API endpoint implemented
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 14 - Precedent Flywheel*
