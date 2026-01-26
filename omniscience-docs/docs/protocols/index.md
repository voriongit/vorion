---
sidebar_position: 1
title: Protocols & Standards
description: Communication protocols and standards enabling agent interoperability
---

# Protocols & Standards

## The Foundation of Agent Interoperability

As autonomous AI agents proliferate, the need for standardized communication protocols becomes critical. Without shared protocols, agents become isolated silos unable to collaborate, verify each other's capabilities, or participate in larger systems.

:::info In Simple Terms
**Protocols** are like languages that AI agents use to talk to each other and to tools. Just like how HTTP lets your browser talk to websites, these protocols let AI agents:
- **MCP** — Tell tools what to do (like "search for X" or "send this email")
- **A2A** — Communicate with other AI agents ("I need help with this task")
- **ACI** — Prove they're trustworthy ("I have a trust score of 750")
- **DID** — Identify themselves ("I am agent-abc123")

Think of it like this: if AI agents are employees, protocols are the company email system and ID badges that let them work together safely.
:::

## Why Protocols Matter

### The Interoperability Challenge

```
              Without Standards                    With Standards
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│                                 │    │                                 │
│  ┌───┐    ?      ┌───┐          │    │  ┌───┐   MCP    ┌───┐          │
│  │ A │──────────▶│ B │          │    │  │ A │─────────▶│ B │          │
│  └───┘           └───┘          │    │  └───┘          └───┘          │
│    │               │            │    │    │              │            │
│    │ ?           ? │            │    │    │ A2A       A2A│            │
│    ▼               ▼            │    │    ▼              ▼            │
│  ┌───┐    ?      ┌───┐          │    │  ┌───┐   ACI   ┌───┐          │
│  │ C │──────────▶│ D │          │    │  │ C │─────────▶│ D │          │
│  └───┘           └───┘          │    │  └───┘          └───┘          │
│                                 │    │                                 │
│  Custom integrations needed     │    │  Universal interoperability    │
│  for every pair of agents       │    │  through shared protocols      │
│                                 │    │                                 │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

### Protocol Stack for Agentic AI

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                                  │
│  Domain-specific protocols (Finance, Healthcare, Legal, etc.)            │
├──────────────────────────────────────────────────────────────────────────┤
│                       ORCHESTRATION LAYER                                │
│  Multi-agent coordination, task routing, capability discovery            │
├──────────────────────────────────────────────────────────────────────────┤
│                       TRUST & SAFETY LAYER                               │
│  ACI Spec, trust scores (0-1000), capability gating, audit trails        │
├──────────────────────────────────────────────────────────────────────────┤
│                       IDENTITY LAYER                                     │
│  DIDs, Verifiable Credentials, agent authentication                      │
├──────────────────────────────────────────────────────────────────────────┤
│                       COMMUNICATION LAYER                                │
│  A2A (Agent-to-Agent), MCP (Model Context Protocol)                      │
├──────────────────────────────────────────────────────────────────────────┤
│                       TRANSPORT LAYER                                    │
│  HTTP/2, WebSocket, gRPC, Message Queues                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## Key Protocols

### Model Context Protocol (MCP)

Anthropic's open protocol for connecting AI assistants to external data sources and tools.

**Purpose**: Standardize how LLMs interact with tools, APIs, and data sources

**Key Features**:
- Tool/function calling standardization
- Context window management
- Streaming support
- Server-client architecture

[Learn more about MCP →](./mcp.md)

### Agent-to-Agent Protocol (A2A)

Google's protocol for direct agent-to-agent communication.

**Purpose**: Enable agents to discover and communicate with each other

**Key Features**:
- Agent discovery
- Capability advertisement
- Task delegation
- Result exchange

[Learn more about A2A →](./a2a.md)

### Agent Identity (DID/VC)

Decentralized identity standards adapted for AI agents.

**Purpose**: Provide verifiable, persistent identity for autonomous agents

**Key Features**:
- Decentralized Identifiers (DIDs)
- Verifiable Credentials (VCs)
- Capability delegation
- Cryptographic authentication

[Learn more about Agent Identity →](./agent-identity.md)

### ACI Specification (Agent Capability Interface)

The open standard for AI agent governance, published as `@vorionsys/aci-spec`.

**Purpose**: Comprehensive framework for agent trust, identity, and governance

**Key Features**:
- 6-tier trust levels (0-1000 scale)
- Agent capability gating
- Behavioral trust scoring
- Policy enforcement protocols

```bash
npm install @vorionsys/aci-spec
```

[Learn more about ACI →](./basis-standard.md)

## Protocol Comparison

| Protocol | Scope | Primary Use | Standardization |
|----------|-------|-------------|-----------------|
| **MCP** | LLM ↔ Tools | Tool invocation | Anthropic open-source |
| **A2A** | Agent ↔ Agent | Task delegation | Google open-source |
| **DID/VC** | Identity | Authentication | W3C Standard |
| **ACI** | Trust & Gov | Safety framework | Apache 2.0 (npm: @vorionsys/aci-spec) |

## Integration Patterns

### Full-Stack Agent

A production agent typically implements multiple protocols:

```typescript
import { TrustBand, TRUST_THRESHOLDS } from '@vorionsys/aci-spec';

class ProductionAgent {
  /** Agent implementing full protocol stack. */

  constructor() {
    // Identity layer
    this.did = DID.create("did:aci:agent123");
    this.credentials = new VerifiableCredentialStore();

    // Communication layer
    this.mcpClient = new MCPClient();
    this.a2aEndpoint = new A2AEndpoint();

    // Trust layer (ACI spec 0-1000 scale)
    this.trustEngine = new TrustEngine(TRUST_THRESHOLDS);
  }

  async handleRequest(request: AgentRequest) {
    /** Process incoming request with full protocol support. */

    // 1. Verify requestor identity (DID/VC)
    const verified = await this.verifyIdentity(request.senderDid);
    if (!verified) {
      return { error: "Identity verification failed" };
    }

    // 2. Check trust score (ACI spec - 0-1000 scale)
    const trustScore = await this.trustEngine.getScore(request.senderDid);
    const trustBand = TrustBand.fromScore(trustScore);
    if (trustBand.tier < TRUST_THRESHOLDS.T2.min) {
      return { error: "Insufficient trust score" };
    }

    // 3. Execute task using tools (MCP)
    const result = await this.executeWithMcp(request.task);

    // 4. Return result via A2A
    return {
      result,
      attestation: this.signResult(result)
    };
  }
}
```

## Protocol Evolution

The agentic AI protocol landscape is rapidly evolving:

```
2023        2024        2025        2026        Future
──┼──────────┼──────────┼──────────┼──────────┼──▶

  │          │          │          │          │
  │  OpenAI  │  MCP 1.0 │  A2A 1.0 │ACI 1.1.0 │  Unified
  │ Function │ Released │ Released │ Published│  Agent
  │ Calling  │          │          │  (npm)   │  Protocol?
  │          │          │          │          │
```

### Emerging Standards

- **OpenAI Assistants API**: Platform-specific agent framework
- **LangChain/LangGraph**: Open-source orchestration
- **AutoGPT Protocols**: Community-driven standards
- **W3C Agent Working Group**: Standards body exploration

## Security Considerations

All protocol implementations must address:

1. **Authentication**: Verify agent identity
2. **Authorization**: Validate capabilities
3. **Encryption**: Protect data in transit
4. **Non-repudiation**: Prove actions were taken
5. **Rate limiting**: Prevent abuse
6. **Audit logging**: Track all interactions

## Getting Started

Recommended learning path:

1. **[MCP](./mcp.md)** - Start here for tool integration
2. **[Agent Identity](./agent-identity.md)** - Understand identity foundations
3. **[A2A](./a2a.md)** - Learn agent-to-agent communication
4. **[ACI Specification](./basis-standard.md)** - Master trust and governance

### Quick Install

```bash
npm install @vorionsys/aci-spec
```

---

## See Also

- [Tool Use](../architecture/tool-use.md) - How agents use tools
- [Trust Scoring](../safety/trust-scoring.md) - Evaluating agent trustworthiness
- [Orchestration](../orchestration/index.md) - Multi-agent coordination
