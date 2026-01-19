# TrustBot Unified System

Complete infrastructure for bot-builds-bot with earned trust, real execution, and live state.

## Three Integration Options

### Option 1: MCP Server (External AI Access)
Let Claude Desktop, Cursor, or other MCP clients interact with your agent swarm.

### Option 2: API + Dashboard (New UI)
Deploy the unified API and use the new real-time dashboard.

### Option 3: Headquarters Adapter (Existing UI)
Drop-in hooks to connect your existing web-626.vercel.app to the unified backend.

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp packages/api/.env.example packages/api/.env.local
# Add your Vercel KV and Anthropic keys

# Run API
npm run dev:api

# Run MCP server
npm run dev:mcp
```

## Package Overview

| Package | Purpose |
|---------|---------|
| `@trustbot/core` | Types, state management, Vercel KV |
| `@trustbot/api` | Next.js API with executor |
| `@trustbot/mcp-server` | MCP protocol for external AI |
| `@trustbot/headquarters-adapter` | React hooks for existing UI |

## Anti-Delegation Rules

**The key innovation**: Low-tier agents CANNOT delegate.

| Tier | Delegate? | Spawn? |
|------|-----------|--------|
| UNTRUSTED (0-199) | ❌ | ❌ |
| PROBATIONARY (200-399) | ❌ | ❌ |
| TRUSTED (400-599) | ❌ | ❌ |
| VERIFIED (600-799) | ✅ | ❌ |
| CERTIFIED (800-949) | ✅ | ✅ |
| ELITE (950-1000) | ✅ | ✅ |

Plus: Max 2 delegations per task. After that, execution is forced.

## MCP Tools

```
trustbot_get_state        - Query world state
trustbot_list_agents      - List with filters
trustbot_get_agent        - Agent details
trustbot_create_task      - Create tasks
trustbot_list_tasks       - List with filters
trustbot_spawn_agent      - Spawn (CERTIFIED+ parent)
trustbot_send_message     - Inter-agent messages
trustbot_get_metrics      - System stats
trustbot_register_tools   - Register external tools
```

## API Endpoints

```
GET  /api/state    - World state
POST /api/tick     - Run scheduler + execution
POST /api/agent    - Create agent
DELETE /api/agent  - Reset system
POST /api/task     - Create task
POST /api/message  - Send message
GET  /api/stream   - SSE real-time updates
```

## Headquarters Integration

```tsx
import { useTrustBotState } from '@trustbot/headquarters-adapter';

function YourExistingDashboard() {
  const { state, runTick, createTask } = useTrustBotState({
    baseUrl: 'https://your-api.vercel.app',
  });

  // Use state.agents, state.tasks, etc.
  // Call runTick() to execute
  // Call createTask(title, desc) to add work
}
```

## License

MIT
