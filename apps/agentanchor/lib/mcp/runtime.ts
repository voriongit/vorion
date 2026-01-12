/**
 * MCP Runtime - Manages MCP server connections and tool execution
 *
 * This runtime connects to MCP servers (like a3i-orchestration) and
 * converts their tools to Claude API format for use in chat.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'

// Types
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface MCPServerConnection {
  id: string
  name: string
  type: string
  process: ChildProcess | null
  tools: MCPTool[]
  resources: MCPResource[]
  ready: boolean
  pending: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>
  messageId: number
}

export interface MCPServerConfig {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
}

// Convert MCP tools to Claude API tool format
export function mcpToolToClaudeTool(tool: MCPTool, serverId: string): Anthropic.Tool {
  return {
    name: `mcp_${serverId}_${tool.name}`,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
  }
}

// Parse tool name to extract server ID and tool name
export function parseToolName(fullName: string): { serverId: string; toolName: string } | null {
  const match = fullName.match(/^mcp_([^_]+)_(.+)$/)
  if (!match) return null
  return { serverId: match[1], toolName: match[2] }
}

/**
 * MCP Runtime Class
 * Manages multiple MCP server connections
 */
export class MCPRuntime extends EventEmitter {
  private servers: Map<string, MCPServerConnection> = new Map()
  private initialized = false

  /**
   * Initialize MCP servers from database config
   */
  async initialize(serverConfigs: MCPServerConfig[]): Promise<void> {
    if (this.initialized) {
      logger.warn({ type: 'mcp_runtime', message: 'Runtime already initialized' })
      return
    }

    logger.info({
      type: 'mcp_runtime_init',
      serverCount: serverConfigs.length,
    })

    for (const config of serverConfigs) {
      try {
        await this.connectServer(config)
      } catch (error) {
        logger.error({
          type: 'mcp_server_connect_error',
          serverId: config.id,
          serverName: config.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    this.initialized = true
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    const connection: MCPServerConnection = {
      id: config.id,
      name: config.name,
      type: config.type,
      process: null,
      tools: [],
      resources: [],
      ready: false,
      pending: new Map(),
      messageId: 0,
    }

    // For now, we support the a3i-orchestration server running in-process
    // In production, this would spawn actual MCP server processes
    if (config.type === 'a3i-orchestration' || config.name === 'a3i-orchestration') {
      // Connect to a3i-orchestration via stdio
      await this.connectStdioServer(connection, config)
    } else {
      // For other MCP servers, we'll use the built-in handlers
      connection.ready = true
      connection.tools = this.getBuiltInTools(config.type)
    }

    this.servers.set(config.id, connection)
  }

  /**
   * Connect to an MCP server via stdio
   */
  private async connectStdioServer(
    connection: MCPServerConnection,
    config: MCPServerConfig
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverPath = process.cwd() + '/mcp/a3i-orchestration/dist/index.js'

      const proc = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
          NODE_ENV: process.env.NODE_ENV || 'development',
        },
      })

      connection.process = proc

      let buffer = ''

      proc.stdout?.on('data', (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line)
              this.handleResponse(connection, response)
            } catch {
              // Not JSON, might be log output
            }
          }
        }
      })

      proc.stderr?.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg.includes('running')) {
          logger.info({ type: 'mcp_server_started', serverId: connection.id, message: msg })

          // Request tools list
          this.sendRequest(connection, 'tools/list', {}).then((result: any) => {
            connection.tools = result.tools || []
            connection.ready = true
            resolve()
          }).catch(reject)
        } else if (msg.includes('error')) {
          logger.error({ type: 'mcp_server_error', serverId: connection.id, message: msg })
        }
      })

      proc.on('error', (error) => {
        logger.error({
          type: 'mcp_server_spawn_error',
          serverId: connection.id,
          error: error.message,
        })
        reject(error)
      })

      proc.on('exit', (code) => {
        logger.info({
          type: 'mcp_server_exit',
          serverId: connection.id,
          exitCode: code,
        })
        connection.ready = false
      })

      // Timeout for server startup
      setTimeout(() => {
        if (!connection.ready) {
          reject(new Error(`MCP server ${connection.name} startup timeout`))
        }
      }, 10000)
    })
  }

  /**
   * Send a JSON-RPC request to an MCP server
   */
  private sendRequest(
    connection: MCPServerConnection,
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++connection.messageId
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      }

      connection.pending.set(id, { resolve, reject })
      connection.process?.stdin?.write(JSON.stringify(request) + '\n')

      // Timeout for response
      setTimeout(() => {
        if (connection.pending.has(id)) {
          connection.pending.delete(id)
          reject(new Error(`MCP request timeout: ${method}`))
        }
      }, 30000)
    })
  }

  /**
   * Handle JSON-RPC response from MCP server
   */
  private handleResponse(connection: MCPServerConnection, response: any): void {
    if (response.id && connection.pending.has(response.id)) {
      const { resolve, reject } = connection.pending.get(response.id)!
      connection.pending.delete(response.id)

      if (response.error) {
        reject(new Error(response.error.message || 'MCP error'))
      } else {
        resolve(response.result)
      }
    }
  }

  /**
   * Get built-in tools for standard MCP types
   */
  private getBuiltInTools(type: string): MCPTool[] {
    switch (type) {
      case 'filesystem':
        return [
          {
            name: 'read_file',
            description: 'Read contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to read' },
              },
              required: ['path'],
            },
          },
          {
            name: 'list_directory',
            description: 'List contents of a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path to list' },
              },
              required: ['path'],
            },
          },
        ]
      case 'websearch':
        return [
          {
            name: 'search',
            description: 'Search the web for information',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                max_results: { type: 'number', description: 'Maximum results to return' },
              },
              required: ['query'],
            },
          },
        ]
      default:
        return []
    }
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = []

    for (const [serverId, connection] of this.servers) {
      if (connection.ready) {
        for (const tool of connection.tools) {
          tools.push(mcpToolToClaudeTool(tool, serverId))
        }
      }
    }

    return tools
  }

  /**
   * Execute a tool on the appropriate MCP server
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const parsed = parseToolName(toolName)
    if (!parsed) {
      return { success: false, error: `Invalid tool name format: ${toolName}` }
    }

    const connection = this.servers.get(parsed.serverId)
    if (!connection) {
      return { success: false, error: `MCP server not found: ${parsed.serverId}` }
    }

    if (!connection.ready) {
      return { success: false, error: `MCP server not ready: ${connection.name}` }
    }

    try {
      if (connection.process) {
        // Execute via stdio for real MCP servers
        const result = await this.sendRequest(connection, 'tools/call', {
          name: parsed.toolName,
          arguments: input,
        })
        return { success: true, result }
      } else {
        // Execute built-in handler
        const result = await this.executeBuiltInTool(connection, parsed.toolName, input)
        return { success: true, result }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Execute built-in tool handler
   */
  private async executeBuiltInTool(
    connection: MCPServerConnection,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    // Placeholder for built-in tool execution
    // In production, this would call actual implementations
    return {
      status: 'executed',
      tool: toolName,
      server: connection.name,
      input,
      message: `Built-in tool ${toolName} executed (placeholder)`,
    }
  }

  /**
   * Shutdown all MCP servers
   */
  async shutdown(): Promise<void> {
    for (const connection of this.servers.values()) {
      if (connection.process) {
        connection.process.stdin?.end()
        connection.process.kill('SIGTERM')
      }
    }
    this.servers.clear()
    this.initialized = false
  }
}
