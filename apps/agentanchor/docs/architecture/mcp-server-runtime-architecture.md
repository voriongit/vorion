# MCP Server Runtime Architecture

**Version:** 1.0
**Last Updated:** 2025-11-23
**Architect:** BMAD Master Agent
**Status:** Design

---

## Executive Summary

This document defines the runtime architecture for Model Context Protocol (MCP) servers, enabling AI bots to access external capabilities like filesystems, GitHub, databases, and web search in a secure, scalable manner.

**Key Goals:**
- Secure execution of MCP operations
- Isolated execution per user/bot
- Extensible plugin architecture
- Performance: <100ms overhead per MCP operation
- Cost-effective (minimize infrastructure overhead)

---

## Architecture Overview

### High-Level Flow

```
┌─────────────┐
│  User Chat  │
└──────┬──────┘
       │ 1. Message + Context
       ▼
┌─────────────────┐
│  Chat API       │
│  /api/chat      │
└──────┬──────────┘
       │ 2. Load Bot + MCP Servers
       ▼
┌─────────────────┐
│  MCP Loader     │
│  (lib/mcp)      │
└──────┬──────────┘
       │ 3. Initialize MCP Runtime
       ▼
┌──────────────────────────────────┐
│      MCP Runtime Engine          │
│  ┌────────────┐  ┌─────────────┐ │
│  │ Filesystem │  │   GitHub    │ │
│  │   Plugin   │  │   Plugin    │ │
│  └────────────┘  └─────────────┘ │
│  ┌────────────┐  ┌─────────────┐ │
│  │  Database  │  │ Web Search  │ │
│  │   Plugin   │  │   Plugin    │ │
│  └────────────┘  └─────────────┘ │
└──────┬───────────────────────────┘
       │ 4. Execute MCP Operations
       ▼
┌─────────────────┐
│  Claude API     │
│  (with tools)   │
└──────┬──────────┘
       │ 5. Stream Response
       ▼
┌─────────────┐
│  User Chat  │
└─────────────┘
```

---

## MCP Runtime Architecture

### 1. MCP Plugin Interface

All MCP servers implement a common interface:

```typescript
interface MCPPlugin {
  // Metadata
  name: string;
  type: MCPType;
  version: string;

  // Lifecycle
  initialize(config: MCPConfig, context: MCPContext): Promise<void>;
  validate(config: MCPConfig): ValidationResult;
  shutdown(): Promise<void>;

  // Core capabilities
  getTools(): Tool[];
  executeTool(toolName: string, params: any): Promise<any>;

  // Context enhancement
  getContextPrompt(): string;
  getSystemInstructions(): string;
}

type MCPType = 'filesystem' | 'github' | 'database' | 'websearch' | 'custom';

interface MCPConfig {
  serverId: string;
  type: MCPType;
  config: Record<string, any>; // Plugin-specific config
  permissions: Permission[];
}

interface MCPContext {
  userId: string;
  botId: string;
  conversationId: string;
  securityContext: SecurityContext;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

### 2. Plugin Implementations

#### **Filesystem MCP Plugin**

```typescript
class FilesystemMCPPlugin implements MCPPlugin {
  name = 'filesystem';
  type = 'filesystem' as const;
  version = '1.0.0';

  private allowedDirs: string[] = [];
  private readOnly: boolean = false;
  private context?: MCPContext;

  async initialize(config: MCPConfig, context: MCPContext) {
    this.allowedDirs = config.config.allowed_directories || [];
    this.readOnly = config.config.read_only || false;
    this.context = context;

    // Validate directories exist and user has access
    await this.validateDirectories();
  }

  getTools(): Tool[] {
    const tools: Tool[] = [
      {
        name: 'read_file',
        description: 'Read contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to allowed directories' },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_directory',
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
    ];

    if (!this.readOnly) {
      tools.push({
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      });
    }

    return tools;
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    // Security: Validate path is within allowed directories
    const safePath = this.validatePath(params.path);

    switch (toolName) {
      case 'read_file':
        return await this.readFile(safePath);
      case 'list_directory':
        return await this.listDirectory(safePath);
      case 'write_file':
        if (this.readOnly) throw new Error('Filesystem is read-only');
        return await this.writeFile(safePath, params.content);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private validatePath(requestedPath: string): string {
    // Prevent directory traversal attacks
    if (requestedPath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }

    // Ensure path is within allowed directories
    const fullPath = path.resolve(requestedPath);
    const isAllowed = this.allowedDirs.some(dir =>
      fullPath.startsWith(path.resolve(dir))
    );

    if (!isAllowed) {
      throw new Error('Access denied: Path outside allowed directories');
    }

    return fullPath;
  }

  private async readFile(path: string): Promise<string> {
    // Use user-scoped storage (Supabase Storage or local with user prefix)
    const content = await fs.readFile(path, 'utf-8');
    return content;
  }

  private async listDirectory(path: string): Promise<string[]> {
    const files = await fs.readdir(path);
    return files;
  }

  private async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf-8');
  }

  getContextPrompt(): string {
    return `
You have access to the filesystem via these directories:
${this.allowedDirs.map(d => `- ${d}`).join('\n')}

Available commands:
- read_file(path): Read file contents
- list_directory(path): List directory contents
${!this.readOnly ? '- write_file(path, content): Write to file' : ''}

${this.readOnly ? 'Note: Filesystem is READ-ONLY' : ''}
`;
  }
}
```

#### **GitHub MCP Plugin**

```typescript
class GitHubMCPPlugin implements MCPPlugin {
  name = 'github';
  type = 'github' as const;
  version = '1.0.0';

  private octokit?: Octokit;
  private defaultBranch: string = 'main';

  async initialize(config: MCPConfig, context: MCPContext) {
    const token = config.config.github_token;
    if (!token) throw new Error('GitHub token required');

    this.octokit = new Octokit({ auth: token });
    this.defaultBranch = config.config.default_branch || 'main';
  }

  getTools(): Tool[] {
    return [
      {
        name: 'search_code',
        description: 'Search for code in repositories',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            repo: { type: 'string', description: 'owner/repo' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_file',
        description: 'Get file contents from repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string' },
            path: { type: 'string' },
            ref: { type: 'string', description: 'Branch/tag/commit' },
          },
          required: ['repo', 'path'],
        },
      },
      {
        name: 'create_issue',
        description: 'Create a GitHub issue',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['repo', 'title'],
        },
      },
      {
        name: 'list_pull_requests',
        description: 'List pull requests',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string' },
            state: { type: 'string', enum: ['open', 'closed', 'all'] },
          },
          required: ['repo'],
        },
      },
    ];
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    if (!this.octokit) throw new Error('GitHub client not initialized');

    switch (toolName) {
      case 'search_code':
        return await this.searchCode(params.query, params.repo);
      case 'get_file':
        return await this.getFile(params.repo, params.path, params.ref);
      case 'create_issue':
        return await this.createIssue(params.repo, params.title, params.body);
      case 'list_pull_requests':
        return await this.listPullRequests(params.repo, params.state);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async searchCode(query: string, repo?: string): Promise<any> {
    const q = repo ? `${query} repo:${repo}` : query;
    const { data } = await this.octokit.search.code({ q });
    return data.items.slice(0, 10); // Limit results
  }

  private async getFile(repo: string, path: string, ref?: string): Promise<string> {
    const [owner, name] = repo.split('/');
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo: name,
      path,
      ref: ref || this.defaultBranch,
    });

    if ('content' in data && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    throw new Error('File not found or is a directory');
  }

  private async createIssue(repo: string, title: string, body: string): Promise<any> {
    const [owner, name] = repo.split('/');
    const { data } = await this.octokit.issues.create({
      owner,
      repo: name,
      title,
      body,
    });
    return { number: data.number, url: data.html_url };
  }

  private async listPullRequests(repo: string, state: string = 'open'): Promise<any> {
    const [owner, name] = repo.split('/');
    const { data } = await this.octokit.pulls.list({
      owner,
      repo: name,
      state: state as any,
    });
    return data.slice(0, 20);
  }

  getContextPrompt(): string {
    return `
You have access to GitHub repositories via the GitHub API.

Available commands:
- search_code(query, repo?): Search for code
- get_file(repo, path, ref?): Get file contents
- create_issue(repo, title, body): Create issue
- list_pull_requests(repo, state?): List PRs

Repository format: "owner/repo" (e.g., "anthropics/anthropic-sdk-typescript")
`;
  }
}
```

### 3. MCP Runtime Engine

```typescript
class MCPRuntime {
  private plugins: Map<string, MCPPlugin> = new Map();
  private pluginRegistry: Map<MCPType, typeof MCPPlugin> = new Map();

  constructor() {
    // Register available plugins
    this.registerPlugin('filesystem', FilesystemMCPPlugin);
    this.registerPlugin('github', GitHubMCPPlugin);
    this.registerPlugin('database', DatabaseMCPPlugin);
    this.registerPlugin('websearch', WebSearchMCPPlugin);
  }

  private registerPlugin(type: MCPType, pluginClass: typeof MCPPlugin) {
    this.pluginRegistry.set(type, pluginClass);
  }

  async loadMCPServers(
    mcpConfigs: MCPConfig[],
    context: MCPContext
  ): Promise<void> {
    for (const config of mcpConfigs) {
      const PluginClass = this.pluginRegistry.get(config.type);
      if (!PluginClass) {
        logger.warn(`Unknown MCP type: ${config.type}`);
        continue;
      }

      const plugin = new PluginClass();

      // Validate configuration
      const validation = plugin.validate(config);
      if (!validation.valid) {
        throw new Error(`Invalid MCP config: ${validation.errors.join(', ')}`);
      }

      // Initialize plugin
      await plugin.initialize(config, context);

      this.plugins.set(config.serverId, plugin);
    }
  }

  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const plugin of this.plugins.values()) {
      tools.push(...plugin.getTools());
    }
    return tools;
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    // Find plugin that owns this tool
    for (const plugin of this.plugins.values()) {
      const tools = plugin.getTools();
      if (tools.some(t => t.name === toolName)) {
        return await plugin.executeTool(toolName, params);
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  getEnhancedSystemPrompt(basePrompt: string): string {
    let enhanced = basePrompt;

    for (const plugin of this.plugins.values()) {
      enhanced += '\n\n' + plugin.getContextPrompt();
    }

    return enhanced;
  }

  async shutdown(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.shutdown();
    }
    this.plugins.clear();
  }
}
```

### 4. Integration with Chat API

**Modified `app/api/chat/route.ts`:**

```typescript
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { botId, message, conversationId, messages } = await req.json();

  // Load bot configuration
  const { data: bot } = await supabase
    .from('bots')
    .select('*')
    .eq('id', botId)
    .single();

  // Load MCP servers for this bot
  const { data: mcpServers } = await supabase
    .from('bot_mcp_servers')
    .select('*, mcp_servers(*)')
    .eq('bot_id', botId);

  // Initialize MCP Runtime
  const mcpRuntime = new MCPRuntime();
  const mcpConfigs = mcpServers?.map(bms => ({
    serverId: bms.mcp_servers.id,
    type: bms.mcp_servers.type,
    config: bms.mcp_servers.config,
    permissions: bms.permissions || [],
  })) || [];

  const context: MCPContext = {
    userId: session.user.id,
    botId: bot.id,
    conversationId,
    securityContext: { /* ... */ },
  };

  await mcpRuntime.loadMCPServers(mcpConfigs, context);

  // Enhance system prompt with MCP context
  const enhancedPrompt = mcpRuntime.getEnhancedSystemPrompt(bot.system_prompt);

  // Get all available tools from MCP plugins
  const tools = mcpRuntime.getAllTools();

  // Call Claude with tools
  const messageStream = await anthropic.messages.create({
    model: bot.model,
    max_tokens: bot.max_tokens,
    temperature: bot.temperature,
    system: enhancedPrompt,
    messages: [...messages, { role: 'user', content: message }],
    tools: tools, // MCP tools
    stream: true,
  });

  // Handle tool use in stream
  for await (const event of messageStream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      const toolUse = event.content_block;
      const result = await mcpRuntime.executeTool(toolUse.name, toolUse.input);

      // Send tool result back to Claude
      // (requires message continuation)
    }

    // ... stream response to client ...
  }

  // Cleanup
  await mcpRuntime.shutdown();
}
```

---

## Security Considerations

### 1. Sandboxing
- Each MCP plugin runs with minimal permissions
- Filesystem access limited to specified directories
- Database access limited to specified tables
- API keys scoped to user

### 2. Input Validation
- All tool parameters validated against JSON schema
- Path traversal prevention for filesystem
- SQL injection prevention for database
- Rate limiting on external API calls

### 3. User Isolation
- MCP operations scoped to user context
- No cross-user data access
- Audit logging of all MCP operations

### 4. Secrets Management
- API keys/tokens encrypted in database
- Never exposed to client
- Rotation support

---

## Performance Optimizations

1. **Plugin Caching**: Reuse plugin instances across requests
2. **Connection Pooling**: For database MCPs
3. **Rate Limiting**: Prevent excessive MCP calls
4. **Lazy Loading**: Only load MCPs when needed
5. **Async Execution**: Parallel tool execution where possible

---

## Deployment Considerations

**Option 1: Serverless (Current)**
- Pros: Auto-scaling, no infrastructure management
- Cons: Cold starts, stateless (plugins reload each request)

**Option 2: Persistent Runtime (Future)**
- Long-running MCP runtime process
- Stateful plugin instances
- Requires dedicated infrastructure
- Better performance, higher cost

**Recommendation**: Start with serverless, migrate to persistent runtime if performance requires.

---

## Monitoring & Observability

**Metrics to Track:**
- MCP plugin initialization time
- Tool execution latency per type
- Error rates per plugin
- Resource usage (memory, CPU) per plugin
- API quota consumption (GitHub, etc.)

**Logging:**
- All tool executions logged with user/bot context
- Parameter logging (sanitized)
- Error logging with stack traces

---

## Testing Strategy

1. **Unit Tests**: Each plugin in isolation
2. **Integration Tests**: Plugin + Claude interaction
3. **Security Tests**: Path traversal, injection attacks
4. **Performance Tests**: Latency under load
5. **E2E Tests**: Full chat flow with MCP tools

---

## Future Enhancements

1. **Custom Plugin Marketplace**: Users contribute plugins
2. **Visual Plugin Builder**: No-code MCP creation
3. **Plugin Versioning**: Update plugins without breaking bots
4. **A/B Testing**: Test plugin changes safely
5. **Plugin Analytics**: Which plugins are most useful
