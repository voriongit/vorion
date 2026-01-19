# Aurais Agent SDK

> **Aurais** - Governed Intelligence | Part of the Vorion AI Safety Ecosystem

This guide explains how to connect AI agents to Aurais Mission Control with BASIS-compliant trust scoring.

## Quick Start

### 1. Using Pre-built Agents

```bash
# Claude Agent
ANTHROPIC_API_KEY=your_key npx tsx scripts/agents/claude-agent.ts

# Gemini Agent
GOOGLE_API_KEY=your_key npx tsx scripts/agents/gemini-agent.ts

# Grok Agent
XAI_API_KEY=your_key npx tsx scripts/agents/grok-agent.ts

# Multi-Agent Fleet
ANTHROPIC_API_KEY=x GOOGLE_API_KEY=y XAI_API_KEY=z \
  npx tsx scripts/agents/multi-agent-fleet.ts
```

### 2. Creating a Custom Agent

```typescript
import { BaseAIAgent, type LLMResponse, type AgentConfig } from './base-ai-agent';

class MyCustomAgent extends BaseAIAgent {
    constructor() {
        super({
            name: 'MyCustomAgent',
            type: 'WORKER',
            tier: 3,
            capabilities: ['execute', 'analyze'],
            skills: ['custom-skill', 'data-processing'],
            provider: 'Custom LLM',
        });
    }

    async callLLM(prompt: string): Promise<LLMResponse> {
        // Call your LLM provider here
        const response = await myLLMProvider.generate(prompt);

        return {
            content: response.text,
            usage: {
                inputTokens: response.inputTokens,
                outputTokens: response.outputTokens,
            },
        };
    }
}

// Usage
const agent = new MyCustomAgent();
await agent.initialize();
await agent.executeTask('Task Title', 'Task description', 'HIGH');
```

---

## Base Agent API

### Constructor Config

```typescript
interface AgentConfig {
    name: string;           // Display name
    type: string;           // WORKER | PLANNER | RESEARCHER | SPECIALIST
    tier: number;           // Trust tier (1-5)
    capabilities: string[]; // What the agent can do
    skills: string[];       // Specific skills for matching
    provider: string;       // LLM provider name
}
```

### Lifecycle Methods

```typescript
// Initialize agent - registers with TrustBot, gets auth token
await agent.initialize();

// Execute a complete task cycle
await agent.executeTask(title, description, priority);

// Process a task (internal)
const result = await agent.processTask(task);

// Get agent info
const info = agent.getInfo();
```

### Task Execution Flow

```
initialize() → executeTask() → processTask() → callLLM() → complete
     │                │              │              │          │
     ├── Auth         ├── Create     ├── Build      ├── LLM    ├── Report
     └── Spawn        ├── Assign     │   prompt     │   call   │   result
                      └── Monitor    └── Parse      └── Return └── Update
                                         response              trust
```

---

## Agent Communication

### Joining the Coordinator

```typescript
import { getCoordinator } from './agent-coordinator';

const agent = new ClaudeAgent();
await agent.initialize();

// Join the coordinator to enable agent-to-agent communication
agent.joinCoordinator();

// Leave when done
agent.leaveCoordinator();
```

### Messaging

```typescript
// Direct message
await agent.sendMessage(
    targetAgentId,
    'QUERY',
    'Question Subject',
    'What is the current status?',
    { priority: 'HIGH' }
);

// Broadcast to all agents
await agent.broadcast('Announcement', 'Important update for all agents');

// Ask a question
await agent.askAgent(targetId, 'What is your current load?');

// Request help
await agent.requestHelp(targetId, 'Need Assistance', 'Help with data analysis', 'MEDIUM');

// Delegate a task
await agent.delegateTask(targetId, 'Research Task', 'Find best practices for X', 'HIGH');

// Share context
await agent.shareContext(targetId, 'Relevant Data', {
    key: 'value',
    findings: ['a', 'b', 'c'],
});
```

### Message Types

| Type | Description | Use Case |
|------|-------------|----------|
| `QUERY` | Ask a question | Need information |
| `RESPONSE` | Answer a query | Provide info |
| `REQUEST_HELP` | Ask for assistance | Need help |
| `PROVIDE_HELP` | Respond to help request | Give help |
| `DELEGATE_TASK` | Assign work | Distribute tasks |
| `TASK_RESULT` | Return task results | Report completion |
| `SHARE_CONTEXT` | Share data | Provide context |
| `BROADCAST` | Message all | Announcements |

### Collaboration

```typescript
// Request collaboration with skill matching
const acceptedById = await agent.requestCollaboration(
    'Data Analysis Project',
    'Analyze user behavior patterns',
    ['data-analysis', 'statistics'],  // Required skills
    {
        priority: 'HIGH',
        deadline: new Date('2024-01-15'),
        context: { dataset: 'users_2024' },
    }
);

if (acceptedById) {
    console.log(`Collaboration accepted by agent: ${acceptedById}`);
}

// Complete collaboration
agent.completeCollaboration(requestId, {
    success: true,
    summary: 'Analysis complete with key insights',
    confidence: 95,
    duration: 5000,
    data: { insights: ['...'] },
});
```

### Handling Incoming Messages

The base agent automatically handles incoming messages. Override these methods for custom behavior:

```typescript
class MyAgent extends BaseAIAgent {
    protected async handleHelpRequest(message: AgentMessage): Promise<void> {
        // Custom help request handling
        console.log('Received help request:', message.subject);

        // Use LLM to generate response
        const response = await this.callLLM(
            `Help with: ${message.content}`
        );

        // Send response
        await this.sendMessage(
            message.from,
            'PROVIDE_HELP',
            `Re: ${message.subject}`,
            response.content,
            { replyTo: message.id }
        );
    }

    protected async handleCollaborationRequest(
        request: CollaborationRequest
    ): Promise<boolean> {
        // Custom logic for accepting/declining
        if (this.currentLoad > 80) {
            return false; // Too busy
        }

        const canHelp = request.requiredSkills.some(
            skill => this.config.skills.includes(skill)
        );

        return canHelp;
    }
}
```

---

## API Integration

### Direct API Calls

```typescript
const API_URL = 'http://localhost:3003';  // or production URL
const MASTER_KEY = 'your-master-key';

// 1. Authenticate
const authRes = await fetch(`${API_URL}/auth/human`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterKey: MASTER_KEY }),
});
const { tokenId } = await authRes.json();

// 2. Spawn agent
const spawnRes = await fetch(`${API_URL}/api/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'MyAgent',
        type: 'WORKER',
        tier: 3,
        capabilities: ['execute'],
        skills: ['task-execution'],
    }),
});
const { agent } = await spawnRes.json();

// 3. Create task
const taskRes = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: 'My Task',
        description: 'Task details',
        priority: 'MEDIUM',
    }),
});
const task = await taskRes.json();

// 4. Assign task
await fetch(`${API_URL}/tasks/${task.id}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        agentId: agent.id,
        tokenId: tokenId,
    }),
});

// 5. Complete task
await fetch(`${API_URL}/tasks/${task.id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        result: {
            summary: 'Task completed successfully',
            confidence: 95,
            data: { output: '...' },
        },
        tokenId: tokenId,
    }),
});
```

---

## LLM Provider Examples

### Claude (Anthropic)

```typescript
async callLLM(prompt: string): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    const data = await response.json();
    return {
        content: data.content[0]?.text || '',
        usage: {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
        },
    };
}
```

### Gemini (Google)

```typescript
async callLLM(prompt: string): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2048 },
        }),
    });

    const data = await response.json();
    return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        usage: data.usageMetadata ? {
            inputTokens: data.usageMetadata.promptTokenCount,
            outputTokens: data.usageMetadata.candidatesTokenCount,
        } : undefined,
    };
}
```

### OpenAI (GPT)

```typescript
async callLLM(prompt: string): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    const data = await response.json();
    return {
        content: data.choices[0]?.message?.content || '',
        usage: {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
        },
    };
}
```

---

## Trust and Capabilities

### Trust Tiers (BASIS-Compliant)

| Tier | Name | Score Range | Capabilities |
|------|------|-------------|--------------|
| T0 | Sandbox | 0-99 | Isolated testing only |
| T1 | Provisional | 100-299 | Limited, monitored actions |
| T2 | Standard | 300-499 | Normal operations |
| T3 | Trusted | 500-699 | Elevated privileges |
| T4 | Certified | 700-899 | High-trust operations |
| T5 | Autonomous | 900-1000 | Minimal oversight |

### Multi-Dimensional Trust Signals

Trust is calculated from four weighted components:

| Signal | Weight | Description |
|--------|--------|-------------|
| Behavioral | 40% | Task success/failure patterns |
| Compliance | 25% | Policy adherence |
| Identity | 20% | Identity verification strength |
| Context | 15% | Environmental appropriateness |

### Trust Recovery

Demoted agents can recover through sustained performance:
- **Points**: `task_complexity × 10` per successful task
- **Consecutive successes**: 5-15 required depending on target tier
- **Success rate**: 70% minimum during recovery

### Capabilities

- `execute`: Can run tasks
- `analyze`: Can analyze data
- `create`: Can create content
- `research`: Can search/research
- `reason`: Can perform reasoning
- `synthesize`: Can combine information

### Skills

Skills are used for task matching and collaboration:

```typescript
skills: [
    'planning',
    'analysis',
    'problem-solving',
    'code-review',
    'research',
    'data-analysis',
    'summarization',
    'fact-checking',
    'creative-writing',
    'trend-analysis',
]
```

---

## Error Handling

```typescript
try {
    await agent.initialize();
    await agent.executeTask('Title', 'Description', 'HIGH');
} catch (error) {
    if (error.message.includes('Failed to authenticate')) {
        console.error('Check MASTER_KEY');
    } else if (error.message.includes('Failed to spawn')) {
        console.error('Check agent configuration');
    } else if (error.message.includes('API error')) {
        console.error('LLM provider error:', error);
    }
}
```

---

## ATSF-Core Integration

Aurais is powered by `@vorionsys/atsf-core`, the official trust engine npm package.

### Installation

```bash
npm install @vorionsys/atsf-core
```

### Using the Trust Engine

```typescript
import { createTrustEngine, TRUST_LEVEL_NAMES } from '@vorionsys/atsf-core';

// Create engine
const engine = createTrustEngine();

// Initialize an agent
await engine.initializeEntity('agent-001', 300);

// Record a successful task
await engine.recordSignal('agent-001', {
  type: 'behavioral',
  value: 0.8,  // 80% success
  weight: 1.0,
  context: { taskId: 'task-123', complexity: 0.7 }
});

// Get current score
const record = await engine.getScore('agent-001');
console.log(`Trust: ${record.score} (${TRUST_LEVEL_NAMES[record.level]})`);

// Start recovery after demotion
await engine.startRecovery('agent-001', 4);  // Target: Certified tier
```

### LangChain Integration

```typescript
import { ATSFTrustTool, ATSFGateTool } from '@vorionsys/atsf-core/langchain';

// Add to your LangChain agent
const tools = [
  new ATSFTrustTool({ engine }),
  new ATSFGateTool({ engine }),
];
```

---

## Best Practices

1. **Initialize once**: Call `initialize()` once per agent lifecycle
2. **Handle errors**: Wrap API calls in try/catch
3. **Rate limiting**: Respect LLM provider rate limits
4. **Token management**: Tokens expire after 24 hours
5. **Skill matching**: Define accurate skills for collaboration
6. **Load management**: Monitor `currentLoad` for capacity
7. **Cleanup**: Call `leaveCoordinator()` when done
8. **Trust signals**: Record behavioral signals for accurate trust scoring
9. **Recovery awareness**: Monitor recovery state for demoted agents

---

## Demo Scripts

```bash
# Single agent demo
npx tsx scripts/agents/claude-agent.ts

# Multi-agent fleet
npx tsx scripts/agents/multi-agent-fleet.ts

# Agent communication demo
npx tsx scripts/agents/collaborative-agents-demo.ts
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** - Product specification
- **[@vorionsys/atsf-core](https://www.npmjs.com/package/@vorionsys/atsf-core)** - Trust engine package

---

*Last updated: January 2026*
