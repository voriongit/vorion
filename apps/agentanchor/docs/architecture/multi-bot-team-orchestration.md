# Multi-Bot Team Orchestration Architecture

**Version:** 1.0
**Last Updated:** 2025-11-23
**Architect:** BMAD Master Agent
**Status:** Design

---

## Executive Summary

This document defines the architecture for multi-bot team conversations, enabling multiple specialized AI assistants to collaborate on complex tasks through intelligent orchestration.

**Key Goals:**
- Seamless multi-bot collaboration
- Intelligent turn-taking and routing
- Context sharing between bots
- Scalable orchestration (3-10 bots per team)
- Cost-effective (minimize duplicate AI calls)

---

## Architecture Overview

### Team Conversation Flow

```
┌─────────────┐
│    User     │
│   Message   │
└──────┬──────┘
       │ 1. Send to Team
       ▼
┌──────────────────┐
│  Team Chat API   │
│ /api/team-chat   │
└──────┬───────────┘
       │ 2. Load Team + Bots
       ▼
┌──────────────────┐
│   Orchestrator   │
│     Agent        │
└──────┬───────────┘
       │ 3. Determine Bot(s) to Respond
       ▼
┌────────────────────────────────┐
│     Bot Execution Engine       │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ Bot1 │ │ Bot2 │ │ Bot3 │   │
│  └──────┘ └──────┘ └──────┘   │
└────────┬───────────────────────┘
         │ 4. Execute Selected Bot(s)
         ▼
┌────────────────────┐
│   Claude API       │
│ (parallel calls)   │
└────────┬───────────┘
         │ 5. Collect Responses
         ▼
┌────────────────────┐
│   Response         │
│   Aggregator       │
└────────┬───────────┘
         │ 6. Stream to User
         ▼
┌────────────────────┐
│   User Interface   │
└────────────────────┘
```

---

## Orchestration Strategies

### Strategy 1: Sequential Round-Robin

**Use Case**: General discussion, brainstorming
**Pattern**: Each bot takes turn responding

```typescript
interface SequentialStrategy {
  async execute(
    team: Team,
    bots: Bot[],
    message: string,
    context: ConversationContext
  ): Promise<Response[]> {
    const responses: Response[] = [];

    for (const bot of bots) {
      const response = await this.callBot(bot, message, context);
      responses.push(response);

      // Update context with previous bot's response
      context.addMessage({
        role: 'assistant',
        content: response.content,
        bot_id: bot.id,
      });
    }

    return responses;
  }
}
```

**Pros:**
- Simple to implement
- Each bot sees previous responses
- Clear conversation flow

**Cons:**
- Slow (sequential API calls)
- All bots respond even if not relevant
- High token usage

---

### Strategy 2: Intelligent Router

**Use Case**: Task-specific teams (e.g., dev team: coder + reviewer + tester)
**Pattern**: Orchestrator selects best bot(s) for each message

```typescript
interface RouterStrategy {
  async execute(
    team: Team,
    bots: Bot[],
    message: string,
    context: ConversationContext
  ): Promise<Response[]> {
    // Use fast orchestrator bot to decide routing
    const routingDecision = await this.routeMessage(message, bots, context);

    if (routingDecision.parallel) {
      // Execute selected bots in parallel
      const promises = routingDecision.selectedBots.map(bot =>
        this.callBot(bot, message, context)
      );
      return await Promise.all(promises);
    } else {
      // Execute sequentially with specific order
      return await this.executeSequentially(
        routingDecision.selectedBots,
        message,
        context
      );
    }
  }

  private async routeMessage(
    message: string,
    bots: Bot[],
    context: ConversationContext
  ): Promise<RoutingDecision> {
    const orchestrator = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Fast, cheap model for routing
      max_tokens: 200,
      temperature: 0,
      system: `You are a team orchestrator. Given a user message and team of bots, decide which bot(s) should respond.

Available bots:
${bots.map(b => `- ${b.name}: ${b.description}`).join('\n')}

Return JSON:
{
  "selectedBots": ["bot_id_1", "bot_id_2"],
  "parallel": true/false,
  "reasoning": "Why these bots were selected"
}

Rules:
- Select minimum bots needed
- Use parallel=true only if bots can work independently
- Use parallel=false if bots need to see each other's responses`,
      messages: [
        ...context.messages,
        { role: 'user', content: message },
      ],
    });

    const decision = JSON.parse(orchestrator.content[0].text);

    return {
      selectedBots: bots.filter(b => decision.selectedBots.includes(b.id)),
      parallel: decision.parallel,
      reasoning: decision.reasoning,
    };
  }
}
```

**Pros:**
- Efficient (only relevant bots respond)
- Lower costs
- Faster when parallel
- Smart routing

**Cons:**
- Extra orchestrator API call
- Routing quality depends on orchestrator
- More complex

---

### Strategy 3: Debate/Consensus

**Use Case**: Decision-making, code review, analysis
**Pattern**: Bots discuss among themselves, converge on answer

```typescript
interface DebateStrategy {
  async execute(
    team: Team,
    bots: Bot[],
    message: string,
    context: ConversationContext,
    maxRounds: number = 3
  ): Promise<Response[]> {
    const allResponses: Response[] = [];
    let debateContext = context.clone();

    // Initial round: All bots respond
    for (let round = 0; round < maxRounds; round++) {
      const roundResponses: Response[] = [];

      // Each bot responds considering previous round
      for (const bot of bots) {
        const response = await this.callBot(bot, message, debateContext);
        roundResponses.push(response);
        debateContext.addMessage({
          role: 'assistant',
          content: response.content,
          bot_id: bot.id,
        });
      }

      allResponses.push(...roundResponses);

      // Check for consensus
      const consensus = await this.checkConsensus(roundResponses);
      if (consensus.achieved) {
        break;
      }
    }

    // Final synthesis
    const synthesis = await this.synthesizeDebate(allResponses);
    return [synthesis];
  }

  private async checkConsensus(
    responses: Response[]
  ): Promise<{ achieved: boolean; agreement: string }> {
    // Use orchestrator to determine if bots agree
    const orchestrator = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      temperature: 0,
      system: 'Analyze if these bot responses agree. Return JSON: {achieved: boolean, agreement: string}',
      messages: [
        {
          role: 'user',
          content: responses.map(r => `${r.botName}: ${r.content}`).join('\n\n'),
        },
      ],
    });

    return JSON.parse(orchestrator.content[0].text);
  }

  private async synthesizeDebate(responses: Response[]): Promise<Response> {
    // Synthesize all debate into final answer
    const synthesis = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      temperature: 0.7,
      system: 'Synthesize these bot responses into a coherent final answer',
      messages: [
        {
          role: 'user',
          content: responses.map(r => `${r.botName}: ${r.content}`).join('\n\n'),
        },
      ],
    });

    return {
      botId: 'team-synthesis',
      botName: 'Team Consensus',
      content: synthesis.content[0].text,
    };
  }
}
```

**Pros:**
- High-quality outputs (multiple perspectives)
- Self-correction through iteration
- Good for complex decisions

**Cons:**
- Very expensive (many API calls)
- Slow (sequential rounds)
- May not converge

---

### Strategy 4: Pipeline/Workflow

**Use Case**: Multi-stage processes (design → implement → test → review)
**Pattern**: Bots execute in defined pipeline

```typescript
interface PipelineStrategy {
  async execute(
    team: Team,
    bots: Bot[],
    message: string,
    context: ConversationContext,
    pipeline: PipelineDefinition
  ): Promise<Response[]> {
    const responses: Response[] = [];
    let workingContext = context.clone();

    for (const stage of pipeline.stages) {
      const stageBot = bots.find(b => b.id === stage.botId);
      if (!stageBot) continue;

      // Execute stage
      const response = await this.callBot(
        stageBot,
        this.formatStagePrompt(stage, message, responses),
        workingContext
      );

      responses.push({
        ...response,
        stageName: stage.name,
      });

      // Update working context
      workingContext.addMessage({
        role: 'assistant',
        content: response.content,
        bot_id: stageBot.id,
      });

      // Check stage gate
      if (stage.gate) {
        const passed = await this.checkGate(stage.gate, response);
        if (!passed) {
          responses.push({
            botId: 'pipeline',
            botName: 'Pipeline',
            content: `Pipeline stopped at stage "${stage.name}": Gate check failed`,
          });
          break;
        }
      }
    }

    return responses;
  }

  private formatStagePrompt(
    stage: PipelineStage,
    originalMessage: string,
    previousStages: Response[]
  ): string {
    return `
PIPELINE STAGE: ${stage.name}
STAGE OBJECTIVE: ${stage.objective}

ORIGINAL REQUEST:
${originalMessage}

PREVIOUS STAGES:
${previousStages.map(r => `${r.stageName}: ${r.content}`).join('\n\n')}

YOUR TASK:
${stage.instructions}
`;
  }

  private async checkGate(
    gate: GateDefinition,
    response: Response
  ): Promise<boolean> {
    // Evaluate gate condition (e.g., "code compiles", "tests pass")
    // Could call external service or use LLM to check
    return true; // Simplified
  }
}
```

**Example Pipeline Definition:**

```typescript
const codingPipeline: PipelineDefinition = {
  stages: [
    {
      name: 'Requirements Analysis',
      botId: 'analyst-bot-id',
      objective: 'Clarify requirements and define success criteria',
      instructions: 'Break down the request into specific technical requirements',
    },
    {
      name: 'Design',
      botId: 'architect-bot-id',
      objective: 'Create technical design',
      instructions: 'Design the solution architecture based on requirements',
    },
    {
      name: 'Implementation',
      botId: 'coder-bot-id',
      objective: 'Write the code',
      instructions: 'Implement the design with clean, tested code',
    },
    {
      name: 'Code Review',
      botId: 'reviewer-bot-id',
      objective: 'Review code quality',
      instructions: 'Review the code for bugs, style, and best practices',
      gate: {
        type: 'approval',
        threshold: 0.8, // 80% approval
      },
    },
    {
      name: 'Testing',
      botId: 'tester-bot-id',
      objective: 'Verify functionality',
      instructions: 'Write and run tests for the implementation',
    },
  ],
};
```

**Pros:**
- Structured, predictable flow
- Each bot has clear responsibility
- Quality gates ensure standards
- Great for repeatable processes

**Cons:**
- Rigid (not adaptive)
- Still sequential (slow)
- Requires upfront pipeline definition

---

## Implementation

### Core Team Chat API

**`app/api/team-chat/route.ts`:**

```typescript
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, message, conversationId, strategy = 'router' } = await req.json();

  // Load team and bots
  const { data: team } = await supabase
    .from('teams')
    .select('*, team_bots(*, bots(*))')
    .eq('id', teamId)
    .single();

  if (!team || team.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const bots = team.team_bots.map(tb => tb.bots);

  // Load conversation context
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const context: ConversationContext = {
    conversationId,
    messages: messages || [],
    team,
    bots,
  };

  // Select orchestration strategy
  const orchestrator = getOrchestrator(strategy);

  // Execute team conversation
  const responses = await orchestrator.execute(team, bots, message, context);

  // Stream responses to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const response of responses) {
        // Send bot header
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'bot_start',
            botId: response.botId,
            botName: response.botName
          })}\n\n`)
        );

        // Stream content
        const words = response.content.split(' ');
        for (const word of words) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'content',
              botId: response.botId,
              content: word + ' '
            })}\n\n`)
          );
          await new Promise(resolve => setTimeout(resolve, 20)); // Simulate streaming
        }

        // Send bot end
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'bot_end',
            botId: response.botId
          })}\n\n`)
        );
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function getOrchestrator(strategy: string): OrchestrationStrategy {
  switch (strategy) {
    case 'sequential':
      return new SequentialStrategy();
    case 'router':
      return new RouterStrategy();
    case 'debate':
      return new DebateStrategy();
    case 'pipeline':
      return new PipelineStrategy();
    default:
      return new RouterStrategy(); // Default
  }
}
```

---

## UI Considerations

### Multi-Bot Message Display

```tsx
// components/TeamChatMessage.tsx
interface TeamChatMessageProps {
  responses: BotResponse[];
}

export function TeamChatMessage({ responses }: TeamChatMessageProps) {
  return (
    <div className="team-message">
      {responses.map(response => (
        <div key={response.botId} className="bot-response">
          <div className="bot-header">
            <img src={response.botAvatar} alt={response.botName} />
            <span className="bot-name">{response.botName}</span>
            <span className="bot-role">{response.role}</span>
          </div>
          <div className="bot-content">
            <Markdown>{response.content}</Markdown>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Strategy Selector

```tsx
// components/TeamStrategySelector.tsx
export function TeamStrategySelector({ onSelect }: { onSelect: (strategy: string) => void }) {
  const strategies = [
    { id: 'router', name: 'Smart Router', description: 'AI selects best bots' },
    { id: 'sequential', name: 'Round Robin', description: 'All bots respond in order' },
    { id: 'debate', name: 'Debate', description: 'Bots discuss and reach consensus' },
    { id: 'pipeline', name: 'Workflow', description: 'Structured pipeline execution' },
  ];

  return (
    <div className="strategy-selector">
      <label>Orchestration Strategy:</label>
      <select onChange={e => onSelect(e.target.value)}>
        {strategies.map(s => (
          <option key={s.id} value={s.id}>
            {s.name} - {s.description}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## Performance Optimizations

1. **Parallel Execution**: When strategy allows, execute bots in parallel
2. **Caching**: Cache bot configurations and MCP setups
3. **Streaming**: Stream each bot's response as it arrives
4. **Early Termination**: Stop execution if user disconnects
5. **Rate Limiting**: Prevent abuse of expensive multi-bot calls

---

## Cost Management

**Cost Estimation per Strategy:**

| Strategy | API Calls | Est. Tokens | Relative Cost |
|----------|-----------|-------------|---------------|
| Sequential (3 bots) | 3 | 15K | 3x |
| Router (2 bots) | 3 (routing + 2) | 10K | 2x |
| Debate (3 bots, 2 rounds) | 6 | 30K | 6x |
| Pipeline (4 stages) | 4 | 20K | 4x |

**Recommendations:**
- Default to Router strategy (best cost/quality)
- Limit Debate to premium users
- Set max bots per team based on tier (Free: 3, Pro: 5, Enterprise: 10)

---

## Testing Strategy

1. **Unit Tests**: Each orchestration strategy
2. **Integration Tests**: Full team chat flow
3. **Load Tests**: Multiple concurrent team conversations
4. **Cost Tests**: Track actual API usage per strategy
5. **Quality Tests**: Compare strategy outputs

---

## Future Enhancements

1. **Adaptive Strategies**: Learn which strategy works best for each team
2. **Bot Interrupts**: Allow bots to interject mid-conversation
3. **Sub-Teams**: Create temporary sub-teams for subtasks
4. **Human-in-the-Loop**: User can guide orchestration
5. **Bot Collaboration Tools**: Shared workspace for bots (docs, code)
