# @aurais/agent-sdk

TypeScript SDK for connecting AI agents to Aurais Mission Control.

## Installation

```bash
npm install @aurais/agent-sdk
# or
yarn add @aurais/agent-sdk
# or
pnpm add @aurais/agent-sdk
```

## Quick Start

```typescript
import { AuraisAgent } from '@aurais/agent-sdk';

const agent = new AuraisAgent({
    apiKey: process.env.TRUSTBOT_API_KEY,
    capabilities: ['execute', 'external'],
    skills: ['web-dev', 'api-integration'],
});

// Handle task assignments
agent.on('task:assigned', async (task) => {
    console.log(`Task received: ${task.title}`);

    // Update status
    await agent.updateStatus('WORKING', 0, 'Starting task');

    // Report progress
    await agent.reportProgress(task.id, 50, 'Processing...');

    // Complete the task
    await agent.completeTask(task.id, { result: 'success' });
});

// Connect to Mission Control
await agent.connect();
```

## Features

- **Auto-reconnection**: Exponential backoff with jitter for reliable connections
- **Type-safe messages**: Full TypeScript support for all message types
- **Event-driven**: EventEmitter pattern for clean, reactive code
- **Heartbeat management**: Automatic heartbeat to maintain connection health
- **Action requests**: Request approval for high-risk actions

## Configuration

```typescript
const agent = new AuraisAgent({
    // Required
    apiKey: 'your-api-key',

    // Optional
    capabilities: ['execute', 'external', 'delegate'],
    skills: ['web-dev', 'data-analysis'],
    serverUrl: 'wss://api.aurais.ai/ws',
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30000,
    heartbeatInterval: 30000,
    connectionTimeout: 10000,
    metadata: { version: '1.0.0' },
});
```

## Events

### Connection Events

```typescript
agent.on('connected', () => {
    console.log('Connected to Mission Control');
});

agent.on('disconnected', (reason) => {
    console.log(`Disconnected: ${reason}`);
});

agent.on('reconnecting', (attempt, maxAttempts) => {
    console.log(`Reconnecting (${attempt}/${maxAttempts})...`);
});

agent.on('reconnected', () => {
    console.log('Reconnected!');
});

agent.on('error', (error) => {
    console.error('Error:', error);
});
```

### Task Events

```typescript
agent.on('task:assigned', async (task) => {
    // Handle new task
});

agent.on('task:completed', (result) => {
    // Task completion confirmed
});
```

### Decision Events

```typescript
agent.on('decision:required', (request) => {
    // Agent needs to make a decision
});

agent.on('decision:result', (decision) => {
    // Decision was made (approved/denied)
});
```

### Status Events

```typescript
agent.on('status:changed', (oldStatus, newStatus) => {
    console.log(`Status: ${oldStatus} → ${newStatus}`);
});
```

## API Reference

### `connect(): Promise<void>`

Connect to Aurais Mission Control.

### `disconnect(): void`

Disconnect from Mission Control.

### `updateStatus(status, progress?, message?): Promise<void>`

Update the agent's status.

```typescript
await agent.updateStatus('WORKING', 50, 'Processing data');
```

### `reportProgress(taskId, progress, message?): Promise<void>`

Report progress on a task (0-100).

```typescript
await agent.reportProgress(task.id, 75, 'Almost done');
```

### `completeTask(taskId, result): Promise<void>`

Mark a task as successfully completed.

```typescript
await agent.completeTask(task.id, { data: processedData });
```

### `failTask(taskId, error): Promise<void>`

Mark a task as failed.

```typescript
await agent.failTask(task.id, 'Validation failed');
```

### `requestAction(request): Promise<string>`

Request approval for an action.

```typescript
const messageId = await agent.requestAction({
    type: 'external_api_call',
    title: 'Call payment API',
    description: 'Process payment for order #123',
    riskLevel: 'high',
    payload: { orderId: '123', amount: 99.99 },
});
```

### `isConnected(): boolean`

Check if connected to Mission Control.

### `getConnectionState(): ConnectionState`

Get current connection state ('disconnected', 'connecting', 'connected', 'reconnecting').

### `getAgentId(): string | null`

Get the agent's ID (available after connection).

### `getStructuredId(): string | null`

Get the agent's structured ID (available after connection).

## Types

### Task

```typescript
interface Task {
    id: string;
    type: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    payload: Record<string, unknown>;
    assignedAt: string;
    deadline?: string;
}
```

### AgentStatus

```typescript
type AgentStatus = 'IDLE' | 'WORKING' | 'PAUSED' | 'ERROR' | 'OFFLINE';
```

### AgentCapability

```typescript
type AgentCapability = 'execute' | 'external' | 'delegate' | 'spawn' | 'admin';
```

## Examples

See the `examples/` directory for complete examples:

- `basic-agent.ts` - Simple task handler
- `action-request-agent.ts` - Agent that requests approval for actions

## License

MIT
