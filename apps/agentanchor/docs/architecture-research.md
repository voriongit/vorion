# AI Bot Builder Platform - Architectural Research & Recommendations

**Version:** 1.0
**Last Updated:** 2025-11-17
**Architect:** Winston (BMad System Architect)

---

## Overview

This document contains deep-dive research on critical architectural topics for the AI Bot Builder Platform, with actionable recommendations based on industry best practices, official documentation, and production-tested patterns.

---

## Table of Contents

1. [Claude API Streaming Optimization](#1-claude-api-streaming-optimization)
2. [Model Context Protocol (MCP) Integration](#2-model-context-protocol-mcp-integration)
3. [Multi-Tenant SaaS Security Patterns](#3-multi-tenant-saas-security-patterns)
4. [Serverless Architecture Best Practices](#4-serverless-architecture-best-practices)
5. [Real-Time Collaboration Architecture](#5-real-time-collaboration-architecture)
6. [Cost Optimization Strategies](#6-cost-optimization-strategies)

---

## 1. Claude API Streaming Optimization

### 1.1 Current Implementation Analysis

**Your Current Approach**: `app/api/chat/route.ts:79-99`
```typescript
const messageStream = await anthropic.messages.create({
  model: bot.model,
  max_tokens: bot.max_tokens,
  temperature: bot.temperature,
  system: systemPrompt,
  messages: claudeMessages,
  stream: true,
})

for await (const event of messageStream) {
  if (event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta') {
    const data = JSON.stringify({ content: event.delta.text })
    controller.enqueue(encoder.encode(`data: ${data}\n\n`))
  }
}
```

**Assessment**: ✅ Good foundation, but missing several optimizations

### 1.2 Recommended Optimizations

#### **1.2.1 Handle All Event Types**

Claude streaming emits multiple event types that you should handle:

```typescript
for await (const event of messageStream) {
  switch (event.type) {
    case 'message_start':
      // Track message metadata (id, role, model)
      const messageId = event.message.id
      logger.info('Stream started', { messageId })
      break

    case 'content_block_start':
      // Track content blocks (text, tool_use, etc.)
      if (event.content_block.type === 'text') {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'content_start'
        })}\n\n`))
      }
      break

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'content',
          content: event.delta.text
        })}\n\n`))
      }
      break

    case 'content_block_stop':
      // Content block completed
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'content_end'
      })}\n\n`))
      break

    case 'message_delta':
      // Track stop_reason and usage
      if (event.delta.stop_reason) {
        logger.info('Stream stopped', {
          reason: event.delta.stop_reason,
          usage: event.usage
        })
      }
      break

    case 'message_stop':
      // Stream completed successfully
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      controller.close()
      break

    case 'error':
      // Handle streaming errors
      logger.error('Stream error', { error: event.error })
      throw new Error(event.error.message)
  }
}
```

**Benefits**:
- Better error handling
- Track token usage in real-time
- Support for future features (tool use, multi-modal)

---

#### **1.2.2 Implement Timeout Protection**

Prevent hanging connections:

```typescript
// lib/streaming/timeout.ts
export function createTimeoutStream(
  innerStream: ReadableStream,
  timeoutMs: number = 30000
): ReadableStream {
  let timeoutId: NodeJS.Timeout

  return new ReadableStream({
    async start(controller) {
      const reader = innerStream.getReader()

      const resetTimeout = () => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          controller.error(new Error('Stream timeout'))
          reader.cancel()
        }, timeoutMs)
      }

      resetTimeout()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          resetTimeout()
          controller.enqueue(value)
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        clearTimeout(timeoutId)
      }
    },
    cancel() {
      clearTimeout(timeoutId)
    }
  })
}

// Usage in route:
const stream = createTimeoutStream(
  originalStream,
  60000 // 60 second timeout
)
```

---

#### **1.2.3 Add Backpressure Handling**

Prevent overwhelming slow clients:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    for await (const event of messageStream) {
      // Check if client is ready for more data
      if (controller.desiredSize !== null && controller.desiredSize <= 0) {
        // Wait for client to catch up
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (event.type === 'content_block_delta') {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(...)}\n\n`))
      }
    }
  }
})
```

---

#### **1.2.4 Implement Graceful Degradation**

Handle Claude API failures gracefully:

```typescript
// lib/streaming/fallback.ts
export async function createStreamWithFallback(
  primaryFn: () => Promise<Stream>,
  fallbackFn: () => Promise<Stream>,
  circuitBreaker: CircuitBreaker
) {
  try {
    return await circuitBreaker.execute(primaryFn)
  } catch (error) {
    logger.warn('Primary stream failed, using fallback', { error })

    // Fallback to non-streaming or cached response
    return await fallbackFn()
  }
}

// Usage:
const messageStream = await createStreamWithFallback(
  // Primary: Streaming
  () => anthropic.messages.create({ ...config, stream: true }),

  // Fallback: Non-streaming
  async () => {
    const response = await anthropic.messages.create({ ...config, stream: false })
    return createStreamFromResponse(response)
  },

  claudeCircuitBreaker
)
```

---

### 1.3 Token Usage Tracking

Track costs in real-time:

```typescript
let inputTokens = 0
let outputTokens = 0

for await (const event of messageStream) {
  if (event.type === 'message_start') {
    inputTokens = event.message.usage.input_tokens
  }

  if (event.type === 'message_delta') {
    outputTokens += event.usage.output_tokens
  }
}

// Calculate cost
const cost = calculateClaudeCost(bot.model, inputTokens, outputTokens)

// Store in database
await supabase.from('usage_logs').insert({
  user_id: session.user.id,
  bot_id: botId,
  conversation_id: conversationId,
  input_tokens: inputTokens,
  output_tokens: outputTokens,
  cost_usd: cost,
  model: bot.model
})

// lib/costs.ts
export function calculateClaudeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = {
    'claude-3-5-sonnet-20241022': {
      input: 0.003,  // per 1K tokens
      output: 0.015
    },
    'claude-3-opus-20240229': {
      input: 0.015,
      output: 0.075
    },
    'claude-3-sonnet-20240229': {
      input: 0.003,
      output: 0.015
    },
    'claude-3-haiku-20240307': {
      input: 0.00025,
      output: 0.00125
    }
  }

  const modelPricing = pricing[model] || pricing['claude-3-sonnet-20240229']

  return (
    (inputTokens / 1000) * modelPricing.input +
    (outputTokens / 1000) * modelPricing.output
  )
}
```

**Database Schema Addition**:
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  bot_id UUID REFERENCES bots(id),
  conversation_id UUID REFERENCES conversations(id),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
```

---

## 2. Model Context Protocol (MCP) Integration

### 2.1 MCP Architecture Overview

Model Context Protocol enables bots to access external tools and data sources. Your schema already supports this, but implementation is needed.

**Current State**: Database tables exist, but no actual MCP execution

### 2.2 MCP Server Implementation Pattern

#### **2.2.1 MCP Server Interface**

```typescript
// lib/mcp/types.ts
export interface MCPTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'error'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export interface MCPServer {
  name: string
  description: string
  version: string

  listTools(): Promise<MCPTool[]>
  callTool(name: string, arguments: Record<string, any>): Promise<MCPToolResult>
}
```

---

#### **2.2.2 Filesystem MCP Server Implementation**

```typescript
// lib/mcp/servers/filesystem.ts
import path from 'path'
import fs from 'fs/promises'
import { MCPServer, MCPTool, MCPToolResult } from '../types'

export class FilesystemMCPServer implements MCPServer {
  name = 'filesystem'
  description = 'Access and manipulate files'
  version = '1.0.0'

  constructor(
    private config: {
      allowedPaths: string[]
      readOnly?: boolean
    }
  ) {}

  async listTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory'
            }
          },
          required: ['path']
        }
      }
    ]

    if (!this.config.readOnly) {
      tools.push({
        name: 'write_file',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        }
      })
    }

    return tools
  }

  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    // Validate path is within allowed paths
    const normalizedPath = path.normalize(args.path)
    const isAllowed = this.config.allowedPaths.some(allowedPath =>
      normalizedPath.startsWith(path.normalize(allowedPath))
    )

    if (!isAllowed) {
      return {
        content: [{
          type: 'error',
          text: `Access denied: Path ${args.path} is not in allowed paths`
        }],
        isError: true
      }
    }

    try {
      switch (name) {
        case 'read_file':
          return await this.readFile(normalizedPath)

        case 'list_directory':
          return await this.listDirectory(normalizedPath)

        case 'write_file':
          if (this.config.readOnly) {
            throw new Error('Write operations not allowed in read-only mode')
          }
          return await this.writeFile(normalizedPath, args.content)

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      return {
        content: [{
          type: 'error',
          text: error.message
        }],
        isError: true
      }
    }
  }

  private async readFile(filePath: string): Promise<MCPToolResult> {
    const content = await fs.readFile(filePath, 'utf-8')
    return {
      content: [{ type: 'text', text: content }]
    }
  }

  private async listDirectory(dirPath: string): Promise<MCPToolResult> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const formatted = entries.map(entry =>
      `${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${entry.name}`
    ).join('\n')

    return {
      content: [{ type: 'text', text: formatted }]
    }
  }

  private async writeFile(filePath: string, content: string): Promise<MCPToolResult> {
    await fs.writeFile(filePath, content, 'utf-8')
    return {
      content: [{ type: 'text', text: `Successfully wrote to ${filePath}` }]
    }
  }
}
```

---

#### **2.2.3 GitHub MCP Server Implementation**

```typescript
// lib/mcp/servers/github.ts
import { Octokit } from '@octokit/rest'
import { MCPServer, MCPTool, MCPToolResult } from '../types'

export class GitHubMCPServer implements MCPServer {
  name = 'github'
  description = 'Interact with GitHub repositories'
  version = '1.0.0'

  private octokit: Octokit

  constructor(config: { accessToken: string; owner: string; repo: string }) {
    this.octokit = new Octokit({ auth: config.accessToken })
  }

  async listTools(): Promise<MCPTool[]> {
    return [
      {
        name: 'get_file',
        description: 'Get contents of a file from the repository',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file in repo' }
          },
          required: ['path']
        }
      },
      {
        name: 'create_issue',
        description: 'Create a new GitHub issue',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'body']
        }
      },
      {
        name: 'search_code',
        description: 'Search for code in the repository',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        }
      }
    ]
  }

  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'get_file':
          return await this.getFile(args.path)
        case 'create_issue':
          return await this.createIssue(args.title, args.body, args.labels)
        case 'search_code':
          return await this.searchCode(args.query)
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      return {
        content: [{ type: 'error', text: error.message }],
        isError: true
      }
    }
  }

  private async getFile(path: string): Promise<MCPToolResult> {
    const { data } = await this.octokit.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path
    })

    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return { content: [{ type: 'text', text: content }] }
    }

    throw new Error('Path is not a file')
  }

  private async createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<MCPToolResult> {
    const { data } = await this.octokit.issues.create({
      owner: this.config.owner,
      repo: this.config.repo,
      title,
      body,
      labels
    })

    return {
      content: [{
        type: 'text',
        text: `Created issue #${data.number}: ${data.html_url}`
      }]
    }
  }

  private async searchCode(query: string): Promise<MCPToolResult> {
    const { data } = await this.octokit.search.code({
      q: `${query} repo:${this.config.owner}/${this.config.repo}`
    })

    const results = data.items.map(item =>
      `${item.path} (${item.score})`
    ).join('\n')

    return {
      content: [{ type: 'text', text: results }]
    }
  }
}
```

---

#### **2.2.4 MCP Server Registry**

```typescript
// lib/mcp/registry.ts
import { MCPServer } from './types'
import { FilesystemMCPServer } from './servers/filesystem'
import { GitHubMCPServer } from './servers/github'
import { DatabaseMCPServer } from './servers/database'

export class MCPServerRegistry {
  private servers = new Map<string, MCPServer>()

  register(id: string, server: MCPServer) {
    this.servers.set(id, server)
  }

  get(id: string): MCPServer | undefined {
    return this.servers.get(id)
  }

  static async createFromConfig(
    mcpServerConfig: {
      id: string
      type: string
      config: Record<string, any>
    }
  ): Promise<MCPServer> {
    switch (mcpServerConfig.type) {
      case 'filesystem':
        return new FilesystemMCPServer(mcpServerConfig.config)

      case 'github':
        return new GitHubMCPServer(mcpServerConfig.config)

      case 'database':
        return new DatabaseMCPServer(mcpServerConfig.config)

      default:
        throw new Error(`Unknown MCP server type: ${mcpServerConfig.type}`)
    }
  }
}

// lib/mcp/bot-mcp.ts
export async function getMCPServersForBot(botId: string): Promise<MCPServer[]> {
  const { data: mcpConfigs } = await supabase
    .from('bot_mcp_servers')
    .select(`
      mcp_servers (
        id,
        type,
        config
      )
    `)
    .eq('bot_id', botId)

  const servers: MCPServer[] = []

  for (const config of mcpConfigs) {
    const server = await MCPServerRegistry.createFromConfig({
      id: config.mcp_servers.id,
      type: config.mcp_servers.type,
      config: config.mcp_servers.config
    })
    servers.push(server)
  }

  return servers
}
```

---

#### **2.2.5 Integration with Claude API**

```typescript
// app/api/chat/route.ts (updated)
export async function POST(req: NextRequest) {
  // ... existing code ...

  // Get MCP servers for this bot
  const mcpServers = await getMCPServersForBot(botId)

  // Collect all tools from all MCP servers
  const allTools: ClaudeTool[] = []
  for (const server of mcpServers) {
    const tools = await server.listTools()
    allTools.push(...tools.map(tool => ({
      name: `${server.name}__${tool.name}`, // Prefix with server name
      description: tool.description,
      input_schema: tool.input_schema
    })))
  }

  // Create streaming response with tools
  const stream = new ReadableStream({
    async start(controller) {
      const messageStream = await anthropic.messages.create({
        model: bot.model,
        max_tokens: bot.max_tokens,
        temperature: bot.temperature,
        system: bot.system_prompt,
        tools: allTools, // Add tools to request
        messages: claudeMessages,
        stream: true
      })

      let currentToolUse: any = null
      let toolInput = ''

      for await (const event of messageStream) {
        switch (event.type) {
          case 'content_block_start':
            if (event.content_block.type === 'tool_use') {
              currentToolUse = event.content_block
              toolInput = ''
            }
            break

          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              // Regular text response
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                content: event.delta.text
              })}\n\n`))
            } else if (event.delta.type === 'input_json_delta') {
              // Accumulate tool input
              toolInput += event.delta.partial_json
            }
            break

          case 'content_block_stop':
            if (currentToolUse) {
              // Execute tool
              const [serverName, toolName] = currentToolUse.name.split('__')
              const server = mcpServers.find(s => s.name === serverName)

              if (server) {
                const toolArgs = JSON.parse(toolInput)
                const result = await server.callTool(toolName, toolArgs)

                // Send tool result to Claude
                const continueResponse = await anthropic.messages.create({
                  model: bot.model,
                  max_tokens: bot.max_tokens,
                  messages: [
                    ...claudeMessages,
                    { role: 'assistant', content: [currentToolUse] },
                    {
                      role: 'user',
                      content: [{
                        type: 'tool_result',
                        tool_use_id: currentToolUse.id,
                        content: result.content
                      }]
                    }
                  ],
                  stream: true
                })

                // Continue streaming the response
                for await (const continueEvent of continueResponse) {
                  // Process continuation events...
                }
              }

              currentToolUse = null
              toolInput = ''
            }
            break
        }
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(stream, { headers: { ... } })
}
```

---

## 3. Multi-Tenant SaaS Security Patterns

### 3.1 Current Security Posture

**Strengths**:
- ✅ Row-Level Security (RLS) policies
- ✅ JWT authentication via Supabase
- ✅ Server-side session validation

**Gaps**:
- ⚠️ No API key rotation
- ⚠️ No audit logging
- ⚠️ No input sanitization framework
- ⚠️ No security headers

### 3.2 Enhanced Security Recommendations

#### **3.2.1 Security Headers**

```typescript
// middleware.ts (Next.js middleware)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  )

  return response
}

export const config = {
  matcher: '/:path*',
}
```

---

#### **3.2.2 Input Sanitization**

```typescript
// lib/security/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target']
  })
}

export function sanitizeSystemPrompt(prompt: string): string {
  // Remove potential injection attempts
  const dangerous = [
    /system:|SYSTEM:/gi,
    /ignore previous instructions/gi,
    /disregard all prior/gi
  ]

  let sanitized = prompt
  for (const pattern of dangerous) {
    sanitized = sanitized.replace(pattern, '[REMOVED]')
  }

  return sanitized.slice(0, 5000) // Max length
}

export function validateBotName(name: string): boolean {
  // Only alphanumeric, spaces, hyphens, underscores
  return /^[a-zA-Z0-9\s\-_]{1,100}$/.test(name)
}
```

---

#### **3.2.3 Audit Logging**

```sql
-- Database schema for audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

```typescript
// lib/security/audit.ts
export async function logAuditEvent(params: {
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: any
  newValues?: any
  request: NextRequest
}) {
  const ip = request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip') ||
              'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    old_values: params.oldValues,
    new_values: params.newValues,
    ip_address: ip,
    user_agent: userAgent
  })

  logger.info('Audit event logged', {
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType
  })
}

// Usage in API routes:
await logAuditEvent({
  userId: session.user.id,
  action: 'bot.create',
  resourceType: 'bot',
  resourceId: newBot.id,
  newValues: newBot,
  request: req
})
```

---

#### **3.2.4 API Key Management**

For bots that need to authenticate external requests:

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

```typescript
// lib/security/api-keys.ts
import crypto from 'crypto'
import bcrypt from 'bcrypt'

export async function generateApiKey(userId: string, name: string) {
  // Generate secure random key
  const key = `sk_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = await bcrypt.hash(key, 10)
  const keyPrefix = key.slice(0, 12) // sk_xxxxxxxx

  const { data } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: name,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    })
    .select()
    .single()

  // Return the plain key ONLY once
  return { id: data.id, key, prefix: keyPrefix }
}

export async function validateApiKey(key: string): Promise<string | null> {
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())

  for (const apiKey of apiKeys) {
    const isValid = await bcrypt.compare(key, apiKey.key_hash)
    if (isValid) {
      // Update last used
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKey.id)

      return apiKey.user_id
    }
  }

  return null
}

// Middleware for API key auth
export async function authenticateApiKey(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('Missing API key', ErrorType.AUTH_ERROR, 401)
  }

  const apiKey = authHeader.substring(7)
  const userId = await validateApiKey(apiKey)

  if (!userId) {
    throw new ApiError('Invalid API key', ErrorType.AUTH_ERROR, 401)
  }

  return userId
}
```

---

## 4. Serverless Architecture Best Practices

### 4.1 Cold Start Optimization

**Current Issue**: Next.js API routes can have cold starts (100-500ms)

#### **4.1.1 Minimize Dependencies**

```typescript
// ❌ BAD: Import entire library
import _ from 'lodash'

// ✅ GOOD: Import only what you need
import groupBy from 'lodash/groupBy'

// ❌ BAD: Heavy imports in route
import { Anthropic } from '@anthropic-ai/sdk'

// ✅ GOOD: Lazy load heavy dependencies
const getAnthropic = async () => {
  const { Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
```

---

#### **4.1.2 Connection Pooling**

```typescript
// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js'

// Reuse connection across invocations
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-connection-pooling': 'true'
          }
        }
      }
    )
  }
  return supabaseClient
}
```

---

#### **4.1.3 Prewarming Functions**

```typescript
// lib/warmup.ts
export async function warmupFunction() {
  if (process.env.NODE_ENV === 'production') {
    // Initialize expensive resources
    await Promise.all([
      getAnthropic(),
      getSupabaseClient(),
      // Load other heavy dependencies
    ])
  }
}

// Call in route handler
export async function GET() {
  await warmupFunction()
  // ... actual logic
}
```

---

### 4.2 Function Timeout Management

Vercel has different timeout limits:
- **Hobby**: 10 seconds
- **Pro**: 60 seconds
- **Enterprise**: 900 seconds (15 minutes)

For streaming, ensure you:

```typescript
// Set explicit timeout in vercel.json
{
  "functions": {
    "app/api/chat/route.ts": {
      "maxDuration": 60
    }
  }
}
```

---

### 4.3 Edge Functions vs. Serverless Functions

**Use Edge Functions for**:
- Simple authentication checks
- Redirects and rewrites
- Geolocation-based routing
- A/B testing

**Use Serverless Functions for**:
- Database queries (Supabase)
- Claude API calls
- Complex business logic
- File processing

```typescript
// Edge runtime (fast but limited)
export const runtime = 'edge'

// Node.js runtime (full features)
export const runtime = 'nodejs'
```

---

## 5. Real-Time Collaboration Architecture

### 5.1 WebSocket vs. SSE vs. Polling

**Your Current Approach**: SSE for chat streaming ✅

**For Team Collaboration**, you need bidirectional communication:

| Feature | WebSocket | SSE | Polling |
|---------|-----------|-----|---------|
| Bidirectional | ✅ | ❌ | ❌ |
| Auto-reconnect | ❌ | ✅ | ✅ |
| Browser support | ✅ | ✅ | ✅ |
| Connection limits | Low | Medium | High |
| Serverless-friendly | ❌ | ✅ | ✅ |

**Recommendation**: Use **Supabase Realtime** (built on WebSockets)

---

### 5.2 Team Chat Implementation

```typescript
// lib/realtime/team-chat.ts
import { createClient } from '@supabase/supabase-js'

export class TeamChatChannel {
  private channel: ReturnType<typeof supabase.channel>

  constructor(
    private teamId: string,
    private userId: string
  ) {
    this.channel = supabase.channel(`team:${teamId}`)
  }

  async join() {
    this.channel
      .on('broadcast', { event: 'message' }, (payload) => {
        this.handleMessage(payload)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState()
        this.handlePresenceChange(state)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await this.channel.track({
            user_id: this.userId,
            online_at: new Date().toISOString()
          })
        }
      })
  }

  async sendMessage(message: string, botId?: string) {
    await this.channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        message,
        bot_id: botId,
        user_id: this.userId,
        timestamp: new Date().toISOString()
      }
    })
  }

  private handleMessage(payload: any) {
    // Update UI with new message
    console.log('New message:', payload)
  }

  private handlePresenceChange(state: any) {
    // Update online users list
    console.log('Presence updated:', state)
  }

  async leave() {
    await this.channel.unsubscribe()
  }
}

// Usage in React component:
import { useEffect, useState } from 'react'

export function TeamChatComponent({ teamId }: { teamId: string }) {
  const [channel, setChannel] = useState<TeamChatChannel | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])

  useEffect(() => {
    const session = await supabase.auth.getSession()
    if (!session.data.session) return

    const chatChannel = new TeamChatChannel(
      teamId,
      session.data.session.user.id
    )

    chatChannel.join()
    setChannel(chatChannel)

    return () => {
      chatChannel.leave()
    }
  }, [teamId])

  const handleSendMessage = async (message: string) => {
    await channel?.sendMessage(message)
  }

  return (
    <div>
      <div>Online Users: {onlineUsers.length}</div>
      {/* Chat UI */}
    </div>
  )
}
```

---

### 5.3 Bot Orchestration for Teams

When multiple bots are in a team, implement turn-taking logic:

```typescript
// lib/team/orchestrator.ts
export class TeamOrchestrator {
  constructor(
    private teamId: string,
    private bots: Bot[]
  ) {}

  async routeMessage(message: string): Promise<Bot> {
    // Strategy 1: Explicit mention (@bot-name)
    const mentionedBot = this.detectMention(message)
    if (mentionedBot) return mentionedBot

    // Strategy 2: Use Claude to determine best bot
    const bestBot = await this.selectBotViaAI(message)
    if (bestBot) return bestBot

    // Strategy 3: Round-robin
    return this.roundRobin()
  }

  private detectMention(message: string): Bot | null {
    for (const bot of this.bots) {
      const mention = `@${bot.name.toLowerCase().replace(/\s/g, '-')}`
      if (message.toLowerCase().includes(mention)) {
        return bot
      }
    }
    return null
  }

  private async selectBotViaAI(message: string): Promise<Bot | null> {
    const botDescriptions = this.bots.map(bot =>
      `- ${bot.name}: ${bot.description}`
    ).join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Fast, cheap
      max_tokens: 100,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Given this user message: "${message}"\n\nWhich bot should respond?\n\n${botDescriptions}\n\nRespond with ONLY the bot name.`
      }]
    })

    const selectedName = response.content[0].text.trim()
    return this.bots.find(bot => bot.name === selectedName) || null
  }

  private roundRobin(): Bot {
    // Simple round-robin (store last bot in DB)
    return this.bots[Math.floor(Math.random() * this.bots.length)]
  }
}
```

---

## 6. Cost Optimization Strategies

### 6.1 Claude API Cost Management

**Current Costs** (estimated based on usage patterns):

| Model | Input | Output | Typical Chat Cost |
|-------|-------|--------|-------------------|
| Sonnet 3.5 | $3/MTok | $15/MTok | $0.15-0.50 |
| Opus 3 | $15/MTok | $75/MTok | $0.75-2.50 |
| Haiku 3 | $0.25/MTok | $1.25/MTok | $0.01-0.05 |

**Monthly costs for 10,000 users**:
- Light usage (10 msgs/day): ~$5,000-10,000/month
- Medium usage (50 msgs/day): ~$25,000-50,000/month
- Heavy usage (200 msgs/day): ~$100,000-200,000/month

---

### 6.2 Cost Optimization Strategies

#### **6.2.1 Smart Model Selection**

```typescript
// lib/ai/model-selector.ts
export function selectOptimalModel(params: {
  messageLength: number
  conversationHistory: number
  taskComplexity: 'simple' | 'medium' | 'complex'
  userTier: 'free' | 'pro' | 'enterprise'
}): string {
  // Free users: Always use Haiku
  if (params.userTier === 'free') {
    return 'claude-3-haiku-20240307'
  }

  // Simple tasks: Use Haiku
  if (params.taskComplexity === 'simple' || params.messageLength < 100) {
    return 'claude-3-haiku-20240307'
  }

  // Complex tasks: Use Sonnet
  if (params.taskComplexity === 'complex') {
    return 'claude-3-5-sonnet-20241022'
  }

  // Default: Sonnet
  return 'claude-3-sonnet-20240229'
}
```

---

#### **6.2.2 Prompt Caching**

Claude supports prompt caching to reduce costs:

```typescript
// lib/ai/caching.ts
export async function createMessageWithCaching(params: {
  systemPrompt: string
  messages: any[]
  model: string
}) {
  // Cache the system prompt (it rarely changes)
  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: params.systemPrompt,
        cache_control: { type: 'ephemeral' } // Cache this
      }
    ],
    messages: params.messages
  })

  return response
}
```

**Cost Savings**:
- Cached input: 90% cheaper
- Cache hits for system prompts can save 50-70% on total costs

---

#### **6.2.3 Response Streaming with Early Termination**

```typescript
// lib/ai/streaming.ts
export async function streamWithEarlyTermination(params: {
  maxTokens: number
  earlyStopPhrases: string[]
}) {
  let output = ''

  for await (const event of messageStream) {
    if (event.type === 'content_block_delta') {
      output += event.delta.text

      // Check for early termination
      for (const phrase of params.earlyStopPhrases) {
        if (output.includes(phrase)) {
          // Stop streaming early to save tokens
          messageStream.controller.abort()
          break
        }
      }
    }
  }

  return output
}
```

---

#### **6.2.4 Conversation Summarization**

Reduce context length for long conversations:

```typescript
// lib/ai/summarization.ts
export async function summarizeConversation(messages: Message[]) {
  if (messages.length < 20) {
    return messages // No need to summarize
  }

  // Keep first message and last 10 messages
  const firstMessage = messages[0]
  const recentMessages = messages.slice(-10)

  // Summarize middle messages
  const middleMessages = messages.slice(1, -10)
  const summary = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307', // Cheap model for summarization
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Summarize this conversation:\n\n${
        middleMessages.map(m => `${m.role}: ${m.content}`).join('\n')
      }`
    }]
  })

  return [
    firstMessage,
    {
      role: 'system',
      content: `[Previous conversation summary: ${summary.content[0].text}]`
    },
    ...recentMessages
  ]
}
```

---

### 6.3 Database Optimization

#### **6.3.1 Query Optimization**

```typescript
// ❌ BAD: Multiple queries
const bot = await supabase.from('bots').select('*').eq('id', botId).single()
const mcpServers = await supabase.from('bot_mcp_servers')...

// ✅ GOOD: Single query with joins
const { data } = await supabase
  .from('bots')
  .select(`
    *,
    bot_mcp_servers (
      mcp_servers (*)
    )
  `)
  .eq('id', botId)
  .single()
```

---

#### **6.3.2 Index Optimization**

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_bots_user_created
ON bots(user_id, created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX idx_bots_public
ON bots(is_public)
WHERE is_public = true;
```

---

#### **6.3.3 Materialized Views for Analytics**

```sql
-- Create materialized view for usage stats
CREATE MATERIALIZED VIEW user_usage_stats AS
SELECT
  user_id,
  COUNT(DISTINCT bot_id) as bot_count,
  COUNT(DISTINCT conversation_id) as conversation_count,
  SUM(output_tokens) as total_tokens,
  SUM(cost_usd) as total_cost
FROM usage_logs
GROUP BY user_id;

-- Refresh periodically (cron job)
REFRESH MATERIALIZED VIEW user_usage_stats;

-- Create index on materialized view
CREATE INDEX idx_user_usage_stats_user_id
ON user_usage_stats(user_id);
```

---

## Summary & Action Items

### Immediate Actions (Week 1-2)

1. ✅ Implement error handling framework
2. ✅ Add request validation with Zod
3. ✅ Set up rate limiting
4. ✅ Configure monitoring (Sentry)
5. ✅ Add security headers

### Short-Term Actions (Month 1-2)

1. ✅ Complete MCP server integration
2. ✅ Implement caching layer
3. ✅ Add audit logging
4. ✅ Set up automated testing
5. ✅ Optimize database queries

### Long-Term Actions (Month 3-6)

1. ✅ Multi-region deployment
2. ✅ Advanced bot orchestration
3. ✅ Plugin marketplace
4. ✅ Enterprise features
5. ✅ Document processing

---

**End of Architecture Research Document**

*This research should guide implementation decisions for the next 6-12 months.*
