# A3I Agent Orchestration MCP Server

MCP (Model Context Protocol) server providing inter-agent communication, governance verification, and collaboration tools for the AgentAnchor ecosystem.

## Features

- **10 Tools** for agent orchestration and governance
- **4 Resources** for ecosystem knowledge access
- **PostgreSQL** backend with connection pooling
- **Zod** schema validation for all inputs
- **Trust-gated** operations via guard rails

## Requirements

- Node.js 18+
- PostgreSQL database (Supabase compatible)
- npm or pnpm

## Installation

```bash
cd mcp/a3i-orchestration
npm install
```

## Configuration

Create `.env.local` in the project root or set environment variables:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
NODE_ENV=development  # or 'production' for secure SSL
```

### SSL Behavior
- **Development**: `rejectUnauthorized: false` (self-signed certs OK)
- **Production**: `rejectUnauthorized: true` (strict cert validation)

## Build

```bash
npm run build
```

Output: `dist/index.js`

## Run

### Development (with hot reload)
```bash
npm run dev
```

### Production
```bash
npm start
```

## Database Schema

Required tables (should exist in Supabase):

```sql
-- Core tables
agents (id, name, description, system_prompt, status, trust_score, metadata)
teams (id, name, purpose)
team_memberships (team_id, agent_id)

-- Governance tables
guard_rails (id, name, description, type, scope, on_violation, rationale, is_active)
decision_log (id, agent_id, decision_type, decision, reasoning, alternatives, decided_at)

-- Communication tables
agent_messages (id, from_agent_id, to_agent_id, type, priority, subject, content, context)
agent_memories (id, agent_id, memory_type, content, confidence, importance, tags)

-- Escalation tables
escalation_chains (id, name, chain, triggers, sla_by_level)
escalation_events (id, chain_id, triggered_by, trigger_reason, context, current_level)
```

## Tools Reference

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `invoke_agent` | Request help from another agent | `agent_name`, `request` |
| `check_guard_rails` | Verify action against safety constraints | `agent_name`, `proposed_action` |
| `four_pillars_check` | Validate against ethical pillars | `agent_name`, `action`, all 4 checks |
| `log_decision` | Record decision for audit trail | `agent_name`, `decision_type`, `decision`, `reasoning` |
| `share_knowledge` | Distribute learnings | `agent_name`, `knowledge_type`, `content` |
| `query_team` | Send query to team | `team_name`, `query` |
| `escalate` | Route issues through chain | `from_agent`, `issue`, `chain_name` |
| `verify_alignment` | Check goal alignment cascade | `agent_name`, `proposed_action` |
| `get_agent_info` | Get agent details | `agent_name` |
| `find_experts` | Search by expertise | `expertise` |

## Resources Reference

| URI | Type | Description |
|-----|------|-------------|
| `a3i://soul-doc` | Markdown | Living constitution of A3I |
| `a3i://four-pillars` | JSON | Truth, Honesty, Service, Humanity |
| `a3i://guard-rails` | JSON | Active safety constraints from DB |
| `a3i://agent-catalog` | JSON | Directory of all agents |

## Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "a3i-orchestration": {
      "command": "node",
      "args": ["C:/S_A/agentanchorai/mcp/a3i-orchestration/dist/index.js"],
      "env": {
        "DATABASE_URL": "your-connection-string",
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Claude Code Integration

Add to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "a3i-orchestration": {
      "command": "node",
      "args": ["./mcp/a3i-orchestration/dist/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Testing

### Manual Test
```bash
# Start the server
npm run dev

# In another terminal, send a test request via stdio
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

### Verify Database Connection
```bash
# Check if server starts without errors
npm run dev 2>&1 | head -5
# Should output: "A3I Agent Orchestration MCP Server running"
```

## Troubleshooting

### Connection Errors
- Verify `DATABASE_URL` is correct
- Check if Supabase/PostgreSQL is accessible
- Ensure SSL settings match your environment

### Tool Errors
- Check that required database tables exist
- Verify agent/team names in database
- Review guard_rails table has `is_active = true` records

### Performance
- Pool is configured for 10 max connections
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds
- Adjust in `getPool()` if needed

## Architecture

```
┌─────────────────────────────────────────────┐
│           Claude / AI Client                │
└─────────────────┬───────────────────────────┘
                  │ MCP Protocol (stdio)
┌─────────────────▼───────────────────────────┐
│        A3I Orchestration MCP Server         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Tools   │  │Resources │  │ Schemas  │  │
│  │ (10)     │  │ (4)      │  │ (Zod)    │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  │
│       │             │                       │
│  ┌────▼─────────────▼────┐                 │
│  │   PostgreSQL Pool     │                 │
│  │   (max: 10 conns)     │                 │
│  └───────────┬───────────┘                 │
└──────────────┼──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│           Supabase PostgreSQL               │
│  agents | teams | guard_rails | decisions   │
└─────────────────────────────────────────────┘
```

## License

Proprietary - AgentAnchor / A3I
