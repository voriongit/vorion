# @vorion/agent-sdk

TypeScript SDK for connecting AI agents to Aurais Mission Control.

> Part of the Vorion AI Governance Platform

## Features

- **WebSocket Connection** - Real-time bidirectional communication
- **Auto-Reconnection** - Exponential backoff with configurable attempts
- **Heartbeat Management** - Keep-alive with automatic ping/pong
- **Type-Safe Messages** - Full TypeScript support for all message types
- **Event Emitter Pattern** - Easy subscription to connection and task events
- **Human-in-the-Loop** - Request approval for high-risk actions

## Installation

```bash
npm install @vorion/agent-sdk
```

## Quick Start

```typescript
import { AuraisAgent } from '@vorion/agent-sdk';

const agent = new AuraisAgent({
  apiKey: process.env.AURAIS_API_KEY,
  capabilities: ['execute', 'external'],
  skills: ['web-dev', 'data-analysis'],
});

// Handle connection
agent.on('connected', () => {
  console.log('Connected to Mission Control');
});

// Handle assigned tasks
agent.on('task:assigned', async (task) => {
  console.log(`Task assigned: ${task.title}`);

  await agent.updateStatus('WORKING');
  await agent.reportProgress(task.id, 50, 'Processing...');

  // Do work...

  await agent.completeTask(task.id, { result: 'Done!' });
  await agent.updateStatus('IDLE');
});

// Connect
await agent.connect();
```

## Configuration

```typescript
interface AuraisAgentConfig {
  // Required
  apiKey: string;

  // Optional
  capabilities?: AgentCapability[];      // Default: ['execute']
  skills?: string[];                     // Default: []
  serverUrl?: string;                    // Default: 'wss://api.aurais.ai/ws'
  autoReconnect?: boolean;               // Default: true
  maxReconnectAttempts?: number;         // Default: 10
  reconnectBaseDelay?: number;           // Default: 1000ms
  reconnectMaxDelay?: number;            // Default: 30000ms
  heartbeatInterval?: number;            // Default: 30000ms
  connectionTimeout?: number;            // Default: 10000ms
  metadata?: Record<string, unknown>;    // Default: {}
}
```

## Agent Capabilities

| Capability | Description |
|------------|-------------|
| `execute` | Can execute tasks locally |
| `external` | Can make external API calls |
| `delegate` | Can delegate to other agents |
| `spawn` | Can spawn sub-agents |
| `admin` | Administrative privileges |

## Events

### Connection Events

```typescript
agent.on('connected', () => void);
agent.on('disconnected', (reason: string) => void);
agent.on('reconnecting', (attempt: number, maxAttempts: number) => void);
agent.on('reconnected', () => void);
agent.on('error', (error: Error) => void);
```

### Task Events

```typescript
agent.on('task:assigned', (task: Task) => void);
agent.on('task:completed', (result: TaskResult) => void);
```

### Decision Events

```typescript
agent.on('decision:required', (request: ActionRequest) => void);
agent.on('decision:result', (decision: ActionDecision) => void);
```

## Requesting Approval

For high-risk actions, request human approval:

```typescript
const messageId = await agent.requestAction({
  type: 'file_deletion',
  title: 'Delete user data',
  description: 'Agent needs to delete files in /data/users',
  riskLevel: 'high',
  payload: {
    directory: '/data/users',
    pattern: '*.tmp',
  },
});

agent.on('decision:result', (decision) => {
  if (decision.requestId === messageId) {
    if (decision.decision === 'approved') {
      // Proceed with action
    } else {
      // Action was denied
      console.log(`Denied: ${decision.reason}`);
    }
  }
});
```

## Task Lifecycle

```typescript
// 1. Receive task
agent.on('task:assigned', async (task) => {
  // 2. Update status
  await agent.updateStatus('WORKING');

  // 3. Report progress
  await agent.reportProgress(task.id, 25, 'Step 1 complete');
  await agent.reportProgress(task.id, 50, 'Step 2 complete');
  await agent.reportProgress(task.id, 75, 'Step 3 complete');

  // 4. Complete or fail
  if (success) {
    await agent.completeTask(task.id, result);
  } else {
    await agent.failTask(task.id, 'Error message');
  }

  // 5. Return to idle
  await agent.updateStatus('IDLE');
});
```

## Agent Status

| Status | Description |
|--------|-------------|
| `IDLE` | Ready for tasks |
| `WORKING` | Processing a task |
| `PAUSED` | Temporarily paused |
| `ERROR` | Error state |
| `OFFLINE` | Not connected |

## Examples

See the [examples](./examples) directory:

- `basic-agent.ts` - Simple task execution
- `action-request-agent.ts` - Human approval workflow

## License

MIT - Vorion AI Governance Platform
