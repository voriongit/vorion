# Story 8.4: Tier Change Learning

## Story
**As an** operator
**I want** educational guidance when an agent's trust tier changes
**So that** I understand what caused the change and what it means

## Status: Done

## Acceptance Criteria
- [x] Popup appears on tier promotion (tier_up)
- [x] Popup appears on tier demotion (tier_down)
- [x] Different content for promotions vs demotions
- [x] Explains what triggered the change
- [x] Shows new capabilities/restrictions
- [x] Tips for managing agents at new tier
- [x] Dismissable and tracks viewing

## Technical Notes

### Event Types
- `tier_up` - Agent promoted to higher trust tier
- `tier_down` - Agent demoted to lower trust tier

### Educational Content

#### Tier Up Popup
- Celebrates the promotion
- Explains new autonomy levels
- Tips for monitoring newly trusted agents
- Reminder about continued oversight

#### Tier Down Popup
- Explains common reasons for demotion
- Shows what capabilities were reduced
- Tips for helping agent rebuild trust
- Information about appeal process

### API Endpoints
- Uses shared learning popup infrastructure
- Both tier_up and tier_down supported

## Implementation Details
- Triggered by trust engine tier change events
- Contextual content based on direction of change
- Can optionally show agent details in popup
- Links to full tier documentation

### Sample Content
```typescript
// Tier up
{
    title: "Agent Promoted!",
    content: "This agent has earned increased autonomy...",
    tips: [
        "Monitor initial actions at new tier",
        "Review expanded capabilities",
        "Adjust oversight accordingly"
    ]
}

// Tier down
{
    title: "Agent Trust Reduced",
    content: "An agent's trust tier has decreased...",
    tips: [
        "Review recent agent actions",
        "Consider retraining if needed",
        "Increased oversight may be required"
    ]
}
```

## Definition of Done
- [x] Code complete with tests
- [x] Separate content for tier up/down
- [x] Integrates with trust engine events
- [x] Accessible and dismissable
