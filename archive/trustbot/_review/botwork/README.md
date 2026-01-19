# TrustBot Live

Live dashboard for bot-builds-bot earned trust system. Agents **actually execute tasks** instead of just delegating.

## Key Features

- **Real execution**: Agents call Claude to do actual work, not just pass tasks around
- **Anti-delegation rules**: Low-tier agents MUST execute; max delegation limits prevent infinite chains
- **Live state**: Vercel KV as single source of truth, SSE streaming to dashboard
- **Trust progression**: Agents earn trust by completing tasks, lose it by failing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD (React)                           │
│   Real-time state via SSE │ Control panel │ Event log              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                         SSE Stream
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Next.js)                           │
│   /api/state │ /api/tick │ /api/task │ /api/agent │ /api/stream    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌─────────────┐         ┌─────────────┐
            │ Vercel KV   │         │  Anthropic  │
            │             │         │             │
            │ WorldState  │         │ Claude API  │
            │ (truth)     │         │ (execution) │
            └─────────────┘         └─────────────┘
```

## Anti-Delegation Logic

The critical innovation: agents that MUST execute.

```typescript
// Tiers that CANNOT delegate - they must do the work
MUST_EXECUTE_TIERS: [UNTRUSTED, PROBATIONARY, TRUSTED]

// Tiers that CAN delegate (but max 2 times per task)
CAN_DELEGATE_TIERS: [VERIFIED, CERTIFIED, ELITE]

// What happens at max delegations:
// Task MUST be executed by whoever holds it
```

This means:
1. High-tier agents can coordinate/delegate
2. But eventually work flows to low-tier agents who MUST execute
3. No infinite delegation chains possible

## Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Set up Vercel KV**
   - Create a KV store in Vercel dashboard
   - Copy connection strings to `.env.local`

3. **Add Anthropic key**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```

5. **Or deploy to Vercel**
   ```bash
   vercel
   ```

## Usage

1. Click **"+ Root Agent"** to create an ELITE-tier overseer
2. Click **"+ Worker"** to spawn low-tier workers (they start UNTRUSTED)
3. Create a task using the form
4. Click **"▶ Run Tick"** to trigger:
   - Task assignment (pending → assigned)
   - Agent execution (Claude API calls)
   - Trust score updates

Watch agents progress from UNTRUSTED → PROBATIONARY → TRUSTED as they complete tasks!

## State Structure

```typescript
interface WorldState {
  tick: number;
  agents: Record<AgentId, Agent>;
  tasks: Record<TaskId, Task>;
  messages: Message[];
  events: SystemEvent[];
  pendingTasks: TaskId[];
  lastUpdated: number;
}
```

All state lives in Vercel KV. Dashboard subscribes via SSE for real-time updates.

## Trust Mechanics

| Action | Score Change |
|--------|--------------|
| Task completed | +10 |
| Task failed | -15 |
| Task timeout | -10 |
| Excessive delegation attempt | -25 |

Tier thresholds:
- UNTRUSTED: 0-199
- PROBATIONARY: 200-399
- TRUSTED: 400-599
- VERIFIED: 600-799
- CERTIFIED: 800-949
- ELITE: 950-1000

## Integration with AgentAnchor

This is a live demo of the trust-gated capability system:
- Spawned agents have trust ceiling from parent
- No agent can spawn an ELITE
- All events are logged for audit trail

Ready to connect to your Merkle/blockchain anchoring system.

## License

MIT
