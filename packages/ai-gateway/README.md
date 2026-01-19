# @vorion/ai-gateway

Multi-provider AI Gateway with intelligent routing for the Vorion AI Governance Platform.

> Extracted from BAI Command Center - provides privacy-first routing, task optimization, sustainability tracking, and cost optimization.

## Features

- **Privacy-First Routing**: Automatically detects PII and sensitive data, routing to self-hosted Ollama
- **Task-Type Optimization**: Routes coding, reasoning, and advisor tasks to specialized models
- **Green Route**: Sustainability-aware model selection with carbon tracking (20% reduction)
- **Cost Optimization**: Cascading cost-performance optimization for general tasks
- **Multi-Provider**: Supports Anthropic Claude, Google Gemini, and self-hosted Ollama
- **Automatic Fallbacks**: Graceful degradation if models fail
- **Self-Learning**: Semantic router learns from outcomes and adjusts routing

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│             AI Gateway (@vorion/ai-gateway)             │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  1. Privacy Router                              │    │
│  │     • PII Detection (email, phone, SSN, etc.)   │    │
│  │     • Sensitive Keywords                        │    │
│  │     • Sensitive Data → Ollama Only              │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                │
│  ┌────────────────────────────────────────────────┐    │
│  │  2. Task-Type Router                            │    │
│  │     • Coding → DeepSeek-R1 / Claude Sonnet      │    │
│  │     • Reasoning → Claude Opus / Gemini          │    │
│  │     • Advisor → Claude Sonnet/Opus              │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                │
│  ┌────────────────────────────────────────────────┐    │
│  │  3. Green Route (Sustainability)                │    │
│  │     • Carbon tracking per request               │    │
│  │     • Energy-efficient model selection          │    │
│  │     • Off-peak scheduling support               │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                │
│  ┌────────────────────────────────────────────────┐    │
│  │  4. Cost Optimizer                              │    │
│  │     • Cheap First (Gemini Flash/Ollama)         │    │
│  │     • Escalate if Needed (Claude)               │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   LiteLLM Proxy                         │
│        Routes to: Claude, Gemini, Ollama                │
└─────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install @vorion/ai-gateway
```

## Usage

### Basic Example

```typescript
import { createGateway } from '@vorion/ai-gateway'

const gateway = createGateway({
  baseURL: 'http://localhost:4000',
  apiKey: process.env.LITELLM_MASTER_KEY
})

const response = await gateway.chat({
  messages: [
    { role: 'user', content: 'Write a function to reverse a string' }
  ]
})

console.log(response.content)
console.log(`Model used: ${response.model}`)
console.log(`Cost: $${response.usage.totalCost}`)
console.log(`Route: ${response.metadata.route}`)
console.log(`Carbon: ${response.metadata.sustainability?.carbonEmitted} kg CO2e`)
```

### Privacy-Sensitive Request

```typescript
const response = await gateway.chat({
  messages: [
    {
      role: 'user',
      content: 'Analyze this customer data: email john@example.com, phone 555-1234'
    }
  ],
  metadata: {
    policy: 'high-security' // Force privacy route
  }
})

// Automatically routes to Ollama (self-hosted)
// NEVER sends PII to external APIs
```

### Task-Specific Routing

```typescript
// Coding task → DeepSeek-R1 or Claude
const codingResponse = await gateway.chat({
  messages: [
    { role: 'user', content: 'Refactor this TypeScript class...' }
  ],
  metadata: {
    taskType: 'coding',
    priority: 'high' // Uses Claude Sonnet for higher quality
  }
})

// Complex reasoning → Claude Opus
const reasoningResponse = await gateway.chat({
  messages: [
    { role: 'user', content: 'Analyze the strategic implications of...' }
  ],
  metadata: {
    taskType: 'reasoning',
    priority: 'high'
  }
})
```

### Cost-Optimized

```typescript
const response = await gateway.chat({
  messages: [
    { role: 'user', content: 'Summarize this text...' }
  ],
  metadata: {
    maxCost: 0.001 // Try to stay under 0.1 cents
  }
})

// Routes to Gemini Flash or Ollama (cheapest)
```

### Sustainability Tracking

```typescript
import { carbonTracker, greenRouter } from '@vorion/ai-gateway'

// Get carbon metrics
const metrics = await carbonTracker.getAggregateMetrics(
  new Date('2026-01-01'),
  new Date()
)
console.log(`Total carbon: ${metrics.totalCarbon} kg CO2e`)

// Configure green routing policy
greenRouter.setPolicy({
  enabled: true,
  minPriority: 'HIGH', // Route more tasks through green models
  offPeakOnly: false,
  trackSavings: true
})

// Get sustainability recommendations
const recommendations = await greenRouter.getRecommendations()
```

## Routing Logic

### Route 1: Privacy (Highest Priority)

**Triggers:**
- `metadata.policy === 'high-security'`
- PII detected (email, phone, SSN, credit card, IP)
- Sensitive keywords (password, api key, proprietary, salary)

**Action:** → Ollama (self-hosted, never leaves VPC)

### Route 2: Task-Type

**Coding:**
- High priority → `coding/expert` (Claude Sonnet)
- Standard → `coding/fast` (DeepSeek-R1 on Ollama)

**Reasoning:**
- High priority → `reasoning/complex` (Claude Opus)
- Standard → `reasoning/fast` (Gemini Flash)

**Advisor:**
- Always → `advisor/consultation` (Claude Sonnet)

### Route 3: Green (Sustainability)

**Triggers:**
- Task priority is LOW, MEDIUM, or HIGH (not CRITICAL)
- Green routing policy is enabled

**Action:** → Energy-efficient models (Gemini Flash, GPT-4o-mini)

### Route 4: Cost-Optimized (Default)

1. **Ultra-low cost** (`maxCost < 0.001`) → Ollama (free)
2. **Balanced** (default) → Gemini Flash ($0.15-0.60/M tokens)
3. **High priority** → Claude Sonnet ($3-15/M tokens)

## Environment Variables

```env
LITELLM_BASE_URL=http://localhost:4000
LITELLM_MASTER_KEY=sk-1234
```

## Model Costs (per 1M tokens)

| Model | Input | Output | Use Case |
|-------|-------|--------|----------|
| Claude Opus | $15 | $75 | Premium reasoning |
| Claude Sonnet | $3 | $15 | Advisors, coding |
| Gemini Flash | $0.15 | $0.60 | Cost-balanced |
| Ollama (any) | $0 | $0 | Privacy, free tier |

## Development

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Build
npm run build
```

## API Reference

### createGateway(config?)

Factory function to create an AIGateway instance.

```typescript
const gateway = createGateway({
  baseURL?: string,  // LiteLLM proxy URL (default: http://localhost:4000)
  apiKey?: string    // LiteLLM master key
})
```

### gateway.chat(request)

Send a request through the gateway.

```typescript
const response = await gateway.chat({
  messages: GatewayMessage[],
  systemPrompt?: string,
  metadata?: {
    policy?: 'high-security' | 'standard',
    taskType?: 'coding' | 'reasoning' | 'general' | 'advisor',
    priority?: 'high' | 'medium' | 'low' | 'CRITICAL',
    maxCost?: number,
    estimatedTokens?: number
  },
  options?: {
    maxTokens?: number,
    temperature?: number,
    stream?: boolean
  }
})
```

### gateway.route(request)

Get routing decision without executing request.

```typescript
const decision = await gateway.route(request)
console.log(decision.model)     // 'coding/expert'
console.log(decision.route)     // 'specialized'
console.log(decision.provider)  // 'anthropic'
console.log(decision.reason)    // 'Coding task detected'
```

## License

MIT - Vorion AI Governance Platform
