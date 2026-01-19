# Story 8.3: First Approval Request Learning

## Story
**As a** new operator
**I want** educational guidance when I see my first approval request
**So that** I understand how to evaluate agent requests effectively

## Status: Done

## Acceptance Criteria
- [x] Popup appears on first approval request view
- [x] Explains what approval requests are
- [x] Tips for evaluating requests
- [x] Information about trust implications
- [x] Optional "Learn More" link
- [x] Dismissable interface
- [x] Tracks that user has seen this popup

## Technical Notes

### Components Reused
- `LearningPopupCard` - Same component as Story 8.2
- `LearningPopupProvider` - Same context wrapper

### Educational Content
- Explains approval request lifecycle
- Tips for checking scope and impact
- Notes about trust score implications of approvals
- Encourages reviewing evidence before deciding

### API Endpoints
- Uses same endpoints as Story 8.2
- Event type: `first_approval`

## Implementation Details
- Triggered when user views first pending request
- Shares popup infrastructure with denial learning
- Progress tracked in UserLearningProgress

### Sample Tips
- "Review the scope of what the agent is requesting"
- "Check the agent's current trust tier"
- "Consider the potential impact of the action"
- "Look for supporting evidence in the request"

## Definition of Done
- [x] Code complete with tests
- [x] Educational content appropriate for approvals
- [x] Consistent UI with other learning popups
- [x] Event tracking integration
