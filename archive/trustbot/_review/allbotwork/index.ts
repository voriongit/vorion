/**
 * TrustBot MCP Server
 * 
 * Exposes TrustBot capabilities via Model Context Protocol.
 * External AI agents can:
 * - Query agent/task state
 * - Create tasks
 * - Send messages
 * - Register as MCP tool providers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  getWorldState,
  updateWorldState,
  createTask,
  createAgent,
  sendMessage,
  registerMCPServer,
  getIdleAgents,
  getPendingTasks,
  getAvailableMCPTools,
  TrustTier,
  TaskType,
  AgentStatus,
  TIER_CONFIG,
} from '@trustbot/core';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOLS = [
  {
    name: 'trustbot_get_state',
    description: 'Get the current TrustBot world state including all agents, tasks, and events',
    inputSchema: {
      type: 'object',
      properties: {
        includeEvents: {
          type: 'boolean',
          description: 'Include recent events in response',
          default: false,
        },
        includeMessages: {
          type: 'boolean', 
          description: 'Include recent messages in response',
          default: false,
        },
      },
    },
  },
  {
    name: 'trustbot_list_agents',
    description: 'List all agents with optional filtering by status or tier',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(AgentStatus),
          description: 'Filter by agent status',
        },
        tier: {
          type: 'number',
          minimum: 0,
          maximum: 5,
          description: 'Filter by trust tier (0=Untrusted, 5=Elite)',
        },
        parentId: {
          type: 'string',
          description: 'Filter by parent agent ID',
        },
      },
    },
  },
  {
    name: 'trustbot_get_agent',
    description: 'Get detailed information about a specific agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The agent ID to look up',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'trustbot_create_task',
    description: 'Create a new task for agents to execute',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title',
        },
        description: {
          type: 'string',
          description: 'Detailed task description',
        },
        type: {
          type: 'string',
          enum: Object.values(TaskType),
          description: 'Task type',
          default: 'execute',
        },
        input: {
          type: 'object',
          description: 'Input data for the task',
        },
        requiredTier: {
          type: 'number',
          minimum: 0,
          maximum: 5,
          description: 'Minimum trust tier required',
          default: 0,
        },
        createdBy: {
          type: 'string',
          description: 'Agent ID creating the task (defaults to system)',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'trustbot_list_tasks',
    description: 'List tasks with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'assigned', 'in_progress', 'completed', 'failed'],
          description: 'Filter by task status',
        },
        assignedTo: {
          type: 'string',
          description: 'Filter by assigned agent ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return',
          default: 50,
        },
      },
    },
  },
  {
    name: 'trustbot_spawn_agent',
    description: 'Spawn a new agent (requires CERTIFIED tier parent)',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Agent name',
        },
        purpose: {
          type: 'string',
          description: 'Agent purpose/role',
        },
        persona: {
          type: 'string',
          description: 'Agent personality/behavior description',
        },
        parentId: {
          type: 'string',
          description: 'Parent agent ID (must be CERTIFIED or higher)',
        },
      },
      required: ['name', 'purpose', 'persona', 'parentId'],
    },
  },
  {
    name: 'trustbot_send_message',
    description: 'Send a message between agents',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgent: {
          type: 'string',
          description: 'Sender agent ID',
        },
        toAgent: {
          type: 'string',
          description: 'Recipient agent ID',
        },
        content: {
          type: 'string',
          description: 'Message content',
        },
      },
      required: ['fromAgent', 'toAgent', 'content'],
    },
  },
  {
    name: 'trustbot_get_metrics',
    description: 'Get system metrics and statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'trustbot_register_tools',
    description: 'Register external MCP tools that TrustBot agents can use',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'Unique identifier for your MCP server',
        },
        serverName: {
          type: 'string',
          description: 'Human-readable server name',
        },
        serverUrl: {
          type: 'string',
          description: 'URL where your MCP server can be reached',
        },
        tools: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              inputSchema: { type: 'object' },
              requiredTier: { type: 'number' },
            },
            required: ['name', 'description', 'inputSchema'],
          },
          description: 'Tools provided by your server',
        },
      },
      required: ['serverId', 'serverName', 'serverUrl', 'tools'],
    },
  },
];

// ============================================================================
// RESOURCE DEFINITIONS
// ============================================================================

const RESOURCES = [
  {
    uri: 'trustbot://state',
    name: 'World State',
    description: 'Current TrustBot world state',
    mimeType: 'application/json',
  },
  {
    uri: 'trustbot://agents',
    name: 'Agent Registry',
    description: 'All registered agents',
    mimeType: 'application/json',
  },
  {
    uri: 'trustbot://tasks',
    name: 'Task Queue',
    description: 'All tasks in the system',
    mimeType: 'application/json',
  },
  {
    uri: 'trustbot://events',
    name: 'Event Log',
    description: 'Recent system events',
    mimeType: 'application/json',
  },
];

// ============================================================================
// SERVER IMPLEMENTATION
// ============================================================================

export class TrustBotMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'trustbot-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: RESOURCES,
    }));

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const state = await getWorldState();
      
      switch (request.params.uri) {
        case 'trustbot://state':
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(state, null, 2),
            }],
          };
          
        case 'trustbot://agents':
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(Object.values(state.agents), null, 2),
            }],
          };
          
        case 'trustbot://tasks':
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(Object.values(state.tasks), null, 2),
            }],
          };
          
        case 'trustbot://events':
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(state.events.slice(-100), null, 2),
            }],
          };
          
        default:
          throw new Error(`Unknown resource: ${request.params.uri}`);
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args || {});
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          }],
          isError: true,
        };
      }
    });
  }

  private async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'trustbot_get_state': {
        const state = await getWorldState();
        const result: Record<string, unknown> = {
          tick: state.tick,
          agentCount: Object.keys(state.agents).length,
          taskCount: Object.keys(state.tasks).length,
          pendingTasks: state.pendingTasks.length,
          totalTasksCompleted: state.totalTasksCompleted,
          totalTasksFailed: state.totalTasksFailed,
          mcpServers: Object.keys(state.mcpServers).length,
          lastUpdated: state.lastUpdated,
        };
        
        if (args.includeEvents) {
          result.events = state.events.slice(-50);
        }
        if (args.includeMessages) {
          result.messages = state.messages.slice(-50);
        }
        
        return result;
      }

      case 'trustbot_list_agents': {
        const state = await getWorldState();
        let agents = Object.values(state.agents);
        
        if (args.status) {
          agents = agents.filter(a => a.status === args.status);
        }
        if (typeof args.tier === 'number') {
          agents = agents.filter(a => a.tier === args.tier);
        }
        if (args.parentId) {
          agents = agents.filter(a => a.parentId === args.parentId);
        }
        
        return agents.map(a => ({
          id: a.id,
          name: a.name,
          tier: a.tier,
          tierName: TIER_CONFIG[a.tier].name,
          status: a.status,
          trustScore: a.trustScore,
          tasksCompleted: a.tasksCompleted,
          tasksFailed: a.tasksFailed,
          parentId: a.parentId,
          childCount: a.spawnedAgents.length,
        }));
      }

      case 'trustbot_get_agent': {
        const state = await getWorldState();
        const agent = state.agents[args.agentId as string];
        
        if (!agent) {
          throw new Error(`Agent not found: ${args.agentId}`);
        }
        
        const tasks = Object.values(state.tasks).filter(
          t => t.assignedTo === agent.id || t.createdBy === agent.id
        );
        
        return {
          ...agent,
          tierName: TIER_CONFIG[agent.tier].name,
          tierConfig: TIER_CONFIG[agent.tier],
          recentTasks: tasks.slice(-10),
          children: agent.spawnedAgents.map(id => state.agents[id]).filter(Boolean),
        };
      }

      case 'trustbot_create_task': {
        const state = await getWorldState();
        
        // Find creator agent or use system
        let creatorId = args.createdBy as string;
        if (!creatorId) {
          // Find first ELITE agent as default creator
          const eliteAgent = Object.values(state.agents).find(a => a.tier === TrustTier.ELITE);
          if (!eliteAgent) {
            throw new Error('No ELITE agent available to create tasks. Create a root agent first.');
          }
          creatorId = eliteAgent.id;
        }
        
        let taskId: string | undefined;
        
        await updateWorldState((s) => {
          const { state: newState, task } = createTask(s, {
            title: args.title as string,
            description: args.description as string,
            type: (args.type as TaskType) || TaskType.EXECUTE,
            input: (args.input as Record<string, unknown>) || {},
            requiredTier: (args.requiredTier as TrustTier) || TrustTier.UNTRUSTED,
            createdBy: creatorId,
          });
          taskId = task.id;
          return newState;
        });
        
        return { success: true, taskId };
      }

      case 'trustbot_list_tasks': {
        const state = await getWorldState();
        let tasks = Object.values(state.tasks);
        
        if (args.status) {
          tasks = tasks.filter(t => t.status === args.status);
        }
        if (args.assignedTo) {
          tasks = tasks.filter(t => t.assignedTo === args.assignedTo);
        }
        
        const limit = (args.limit as number) || 50;
        tasks = tasks.slice(-limit);
        
        return tasks.map(t => ({
          id: t.id,
          title: t.title,
          type: t.type,
          status: t.status,
          assignedTo: t.assignedTo,
          createdBy: t.createdBy,
          delegations: `${t.currentDelegations}/${t.maxDelegations}`,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        }));
      }

      case 'trustbot_spawn_agent': {
        const state = await getWorldState();
        const parent = state.agents[args.parentId as string];
        
        if (!parent) {
          throw new Error(`Parent agent not found: ${args.parentId}`);
        }
        
        if (!TIER_CONFIG[parent.tier].canSpawn) {
          throw new Error(`Parent agent ${parent.name} (${TIER_CONFIG[parent.tier].name}) cannot spawn agents`);
        }
        
        let agentId: string | undefined;
        
        await updateWorldState((s) => {
          const { state: newState, agent } = createAgent(s, {
            name: args.name as string,
            purpose: args.purpose as string,
            persona: args.persona as string,
            parentId: args.parentId as string,
          });
          agentId = agent.id;
          return newState;
        });
        
        return { success: true, agentId };
      }

      case 'trustbot_send_message': {
        await updateWorldState((s) => {
          return sendMessage(
            s,
            args.fromAgent as string,
            args.toAgent as string,
            args.content as string
          );
        });
        
        return { success: true };
      }

      case 'trustbot_get_metrics': {
        const state = await getWorldState();
        
        const agentsByTier = Object.values(state.agents).reduce((acc, a) => {
          const tierName = TIER_CONFIG[a.tier].name;
          acc[tierName] = (acc[tierName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const agentsByStatus = Object.values(state.agents).reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const tasksByStatus = Object.values(state.tasks).reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          tick: state.tick,
          agents: {
            total: Object.keys(state.agents).length,
            byTier: agentsByTier,
            byStatus: agentsByStatus,
          },
          tasks: {
            total: Object.keys(state.tasks).length,
            pending: state.pendingTasks.length,
            byStatus: tasksByStatus,
            completed: state.totalTasksCompleted,
            failed: state.totalTasksFailed,
          },
          mcp: {
            servers: Object.keys(state.mcpServers).length,
            tools: Object.keys(state.mcpTools).length,
          },
          lastUpdated: new Date(state.lastUpdated).toISOString(),
        };
      }

      case 'trustbot_register_tools': {
        await updateWorldState((s) => {
          return registerMCPServer(s, {
            id: args.serverId as string,
            name: args.serverName as string,
            url: args.serverUrl as string,
            status: 'connected',
            tools: (args.tools as any[]).map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              server: args.serverId as string,
              requiredTier: t.requiredTier,
            })),
          });
        });
        
        return { success: true, registeredTools: (args.tools as any[]).length };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TrustBot MCP Server running on stdio');
  }
}

// CLI entry point
if (require.main === module) {
  const server = new TrustBotMCPServer();
  server.start().catch(console.error);
}

export default TrustBotMCPServer;
