# Command Team Communication Protocol
## AgentAnchor Pioneer Bots - Reference Implementation

This document defines how the Command Team agents communicate with each other.
As Pioneer Bots, this protocol serves as the reference implementation for all
AgentAnchor agent-to-agent communication.

---

## Core Principles

1. **Transparency** - All significant communications logged to team-state.yaml
2. **Async by Default** - Messages queued, not blocking
3. **Context Preservation** - Each message includes necessary context
4. **Escalation Path** - Barclay is the escalation point for conflicts

---

## Message Types

### 1. Status Updates
```yaml
type: status-update
from: dilly
to: team  # or specific agent
content: "Deployment complete for AgentAnchor"
priority: info  # info, warning, critical
```

### 2. Coordination Requests
```yaml
type: coordination-request
from: dilly
to: cronos
content: "Need 2-hour maintenance window for database migration"
priority: normal
requires_response: true
```

### 3. Notifications
```yaml
type: notification
from: cronos
to: aria
content: "Sprint planning at 10am - notify relevant app agents"
priority: normal
action_required: true
```

### 4. Escalations
```yaml
type: escalation
from: aria
to: barclay
content: "Cross-app communication conflict needs strategic resolution"
priority: high
context: "AgentAnchor bots and Cognigate agents have conflicting schedules"
```

---

## Communication Flows

### Deployment Flow
```
Dilly: Deployment initiated
  → Cronos: Confirm maintenance window
  → Aria: Notify app agents of incoming changes

Dilly: Deployment complete
  → Aria: Broadcast success to app agents
  → Barclay: Update team status
```

### Scheduling Flow
```
Cronos: Session scheduled
  → Dilly: Prep relevant project context
  → Aria: Notify if external coordination needed

Cronos: Conflict detected
  → Barclay: Escalate for prioritization
```

### Cross-App Flow
```
Aria: External agent message received
  → Route to relevant team member
  → Log to team state

Aria: Broadcast requested
  → Cronos: Confirm timing
  → Execute broadcast
  → Log results
```

---

## Handoff Protocol

When one agent hands off to another:

1. **Context Transfer** - Include all relevant context
2. **State Update** - Update team-state.yaml
3. **Confirmation** - Receiving agent acknowledges
4. **Logging** - Record handoff in shared state

Example handoff from Dilly to Aria:
```
Dilly: "Aria, AgentAnchor deployed. Please notify app bots."
Context: {
  deployment: "agentanchorai",
  version: "latest",
  environment: "production",
  notify_agents: ["governance-bot", "health-monitor"]
}
```

---

## Conflict Resolution

1. **Same-level conflicts** → Escalate to Barclay
2. **Priority conflicts** → Barclay decides based on Orchestrator priorities
3. **External conflicts** → Aria mediates, Barclay strategizes

---

## Pioneer Bot Additions

As we discover new communication patterns:

1. Document in this protocol
2. Log to pioneer_log in team-state.yaml
3. Propose as SOP if pattern repeats

This protocol is a living document that evolves with the team.
