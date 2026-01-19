# Story 8.2: First Denial Learning Popup

## Story
**As a** new operator
**I want** educational guidance when I deny my first request
**So that** I understand the impact of denials on agent trust

## Status: Done

## Acceptance Criteria
- [x] Popup appears after first denial action
- [x] Clear title explaining the learning moment
- [x] Detailed content about denial implications
- [x] Actionable tips for effective denials
- [x] "Learn More" link to documentation
- [x] Dismissable with "Got it" button
- [x] Only shows once per user

## Technical Notes

### Components Created
- `LearningPopupCard` - Educational popup display
- `LearningPopupProvider` - Context wrapper for triggering popups

### Types Added
```typescript
type LearningEventType =
    | 'first_denial'
    | 'first_approval'
    | 'tier_up'
    | 'tier_down'
    | 'first_override'
    | 'first_evidence_export';

interface LearningPopup {
    id: string;
    eventType: LearningEventType;
    title: string;
    content: string;
    tips: string[];
    learnMoreUrl?: string;
    dismissable: boolean;
    showOnce: boolean;
}
```

### API Endpoints
- `GET /mission-control/onboarding/popup/:eventType` - Get popup config
- `POST /mission-control/onboarding/popup/:popupId/dismiss` - Mark as seen

### Educational Content
- Explains that denials can decrease agent trust score
- Tips include providing clear reasons and considering alternatives
- Notes that all denials are logged for audit

## Implementation Details
- Popup triggered by event system on first denial
- User learning progress tracked in database
- Overlay prevents interaction until dismissed
- Accessible with alertdialog role

## Definition of Done
- [x] Code complete with tests
- [x] Educational content reviewed
- [x] Accessible modal implementation
- [x] Integrates with event tracking
