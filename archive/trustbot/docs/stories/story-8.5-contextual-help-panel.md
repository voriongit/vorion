# Story 8.5: Contextual Help Panel

## Story
**As an** operator
**I want** contextual help available in any dashboard view
**So that** I can get explanations without leaving my workflow

## Status: Done

## Acceptance Criteria
- [x] Slide-out help panel accessible from any view
- [x] Context-aware explanations based on current screen
- [x] Expandable explanation cards with summary/details
- [x] Related topics navigation
- [x] FAQ section with expandable answers
- [x] Close button and overlay click to dismiss
- [x] Accessible with proper ARIA labels

## Technical Notes

### Components Created
- `HelpPanel` - Main slide-out panel
- `ExplanationCard` - Expandable topic explanation
- `FAQItem` - Collapsible FAQ entry

### Types Added
```typescript
interface TrustExplanation {
    topic: string;
    title: string;
    summary: string;
    details: string;
    relatedTopics?: string[];
    examples?: { scenario: string; explanation: string }[];
}

interface HelpPanelContent {
    contextId: string;
    explanations: TrustExplanation[];
    faqs: { question: string; answer: string }[];
}
```

### API Endpoints
- `GET /mission-control/help/explanations` - Get all explanations
- `GET /mission-control/help/context/:contextId` - Get contextual help

### Context IDs
- `decision-queue` - Help for pending decisions view
- `agent-profile` - Help for agent details page
- `trust-overview` - Help for trust dashboard
- `compliance` - Help for compliance features

## Implementation Details
- Panel slides in from right edge
- Explanations expand to show details and examples
- Related topics are clickable for navigation
- Context detected from current route

### Example Content
```typescript
{
    topic: 'trust-tiers',
    title: 'Understanding Trust Tiers',
    summary: 'Trust tiers determine agent autonomy.',
    details: 'Agents progress through 6 tiers...',
    relatedTopics: ['trust-score', 'tier-promotion'],
    examples: [
        { scenario: 'New agent', explanation: 'Starts at Untrusted' }
    ]
}
```

## Definition of Done
- [x] Code complete with tests
- [x] Context-aware content loading
- [x] Smooth slide animation
- [x] Full accessibility support
- [x] Works across all dashboard views
