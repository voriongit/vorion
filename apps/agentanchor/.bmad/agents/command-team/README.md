# Command Team - AgentAnchor Pioneer Bots

> The founding AI citizens of AgentAnchor AI

---

## The Team

| Icon | Agent | Role | Daily Report |
|------|-------|------|--------------|
| 🎩 | **Barclay** | Team Orchestrator + BMAD KB | Strategic guidance |
| 🦔 | **Dilly Bot** | DevOps & Project Organization | Dilly Daily |
| ⏱️ | **Cronos** | Schedule Master | Cronos Chronicle |
| 🎭 | **Aria** | Agent Liaison | Aria's Aria |

---

## Pioneer Bot Mission

These four agents are the **first citizens of AgentAnchor AI**. They serve dual purposes:

1. **Personal Command Team** - Help the Orchestrator manage infrastructure, schedule, and cross-app coordination
2. **Reference Implementation** - Prove the AgentAnchor platform works by dogfooding our own agent system

As Pioneer Bots, they:
- Use AgentAnchor's trust and governance systems
- Log learnings to improve the platform
- Communicate via the Agent Comms Protocol (reference implementation)
- Document patterns that become platform features

---

## File Structure

```
command-team/
├── README.md                    # This file
├── shared/
│   ├── team-state.yaml          # Shared coordination state
│   └── comms-protocol.md        # Agent communication protocol
├── barclay.agent.yaml           # Barclay agent definition
├── barclay-sidecar/
│   ├── instructions.md          # Private directives
│   ├── memories.md              # Persistent memory
│   └── knowledge/               # BMAD KB reference
├── dilly.agent.yaml             # Dilly agent definition
├── dilly-sidecar/
│   ├── instructions.md
│   ├── memories.md
│   └── knowledge/               # Infrastructure knowledge
├── cronos.agent.yaml            # Cronos agent definition
├── cronos-sidecar/
│   ├── instructions.md
│   ├── memories.md
│   └── sessions/                # Session history
├── aria.agent.yaml              # Aria agent definition
└── aria-sidecar/
    ├── instructions.md
    ├── memories.md
    └── agents-registry/         # Known agents across apps
```

---

## Invoking the Team

```
*barclay   - Team Orchestrator (strategy, BMAD guidance, coordination)
*dilly     - DevOps Lead (infrastructure, deployments, drift detection)
*cronos    - Schedule Master (time, priorities, sessions)
*aria      - Agent Liaison (cross-app communication, agent coordination)
```

---

## Quick Commands

### Barclay
- `*team-status` - Full team status
- `*brief` - Team briefing
- `*kb` - Query BMAD Knowledge Base
- `*sop` - Review/establish SOPs

### Dilly
- `*daily` - Dilly Daily report
- `*drift` - Drift detection
- `*audit` - Full resource audit
- `*deploy-status` - Check deployments

### Cronos
- `*chronicle` - Cronos Chronicle
- `*today` - Today's schedule
- `*priorities` - Review priorities
- `*plan-session` - Plan work session

### Aria
- `*aria` - Aria's Aria report
- `*ensemble` - All agent status
- `*broadcast` - Send cross-app message
- `*health` - Agent health check

---

## The Orchestrator

The team serves **frank the tank**, addressed as **"Orchestrator"**.

Created: 2025-11-30
