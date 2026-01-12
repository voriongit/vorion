/**
 * MCP (Model Context Protocol) - Server management and invocation
 */

import {
  MCPServerConfig,
  MCPServerType,
  MCPPermissions,
  MCPInvocation,
  TrustContext,
} from './types';

// =============================================================================
// MCP Server Templates
// =============================================================================

export const MCP_SERVER_TEMPLATES: Record<MCPServerType, {
  defaultConfig: Record<string, unknown>;
  defaultPermissions: MCPPermissions;
  description: string;
}> = {
  filesystem: {
    defaultConfig: {
      allowedDirectories: [],
      watchForChanges: false,
    },
    defaultPermissions: {
      read: true,
      write: false,
      execute: false,
      allowedPaths: [],
      deniedPaths: ['**/node_modules/**', '**/.git/**', '**/.env*'],
    },
    description: 'Access local filesystem within allowed directories',
  },
  github: {
    defaultConfig: {
      repository: '',
      branch: 'main',
      autoSync: false,
    },
    defaultPermissions: {
      read: true,
      write: false,
      execute: false,
    },
    description: 'Access GitHub repositories for code and issues',
  },
  database: {
    defaultConfig: {
      type: 'postgres',
      connectionString: '',
      maxConnections: 5,
    },
    defaultPermissions: {
      read: true,
      write: false,
      execute: false,
    },
    description: 'Query and manage database connections',
  },
  websearch: {
    defaultConfig: {
      provider: 'bing',
      maxResults: 10,
      safeSearch: true,
    },
    defaultPermissions: {
      read: true,
      write: false,
      execute: true,
      rateLimit: 30, // 30 requests per minute
    },
    description: 'Search the web for information',
  },
  custom: {
    defaultConfig: {},
    defaultPermissions: {
      read: true,
      write: false,
      execute: false,
    },
    description: 'Custom MCP server implementation',
  },
};

// =============================================================================
// MCP Permission Checks
// =============================================================================

export function checkMCPPermission(
  server: MCPServerConfig,
  action: 'read' | 'write' | 'execute',
  path?: string
): { allowed: boolean; reason: string } {
  // Check if server is enabled
  if (!server.enabled) {
    return { allowed: false, reason: 'MCP server is disabled' };
  }

  // Check base permission
  if (!server.permissions[action]) {
    return { allowed: false, reason: `${action} permission not granted` };
  }

  // Check path restrictions for filesystem
  if (path && server.type === 'filesystem') {
    const { allowedPaths, deniedPaths } = server.permissions;

    // Check denied paths first
    if (deniedPaths?.some(pattern => matchPath(path, pattern))) {
      return { allowed: false, reason: `Path ${path} is in denied list` };
    }

    // Check allowed paths (if specified)
    if (allowedPaths && allowedPaths.length > 0) {
      if (!allowedPaths.some(pattern => matchPath(path, pattern))) {
        return { allowed: false, reason: `Path ${path} is not in allowed list` };
      }
    }
  }

  return { allowed: true, reason: 'Permission granted' };
}

function matchPath(path: string, pattern: string): boolean {
  // Simple glob matching (** = any, * = single level)
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${regex}$`).test(path);
}

// =============================================================================
// MCP Trust Requirements
// =============================================================================

const MCP_TRUST_REQUIREMENTS: Record<MCPServerType, number> = {
  filesystem: 600,   // Trusted
  github: 400,       // Established
  database: 600,     // Trusted
  websearch: 200,    // Provisional
  custom: 800,       // Verified
};

export function canUseMCPServer(
  server: MCPServerConfig,
  trust: TrustContext
): { allowed: boolean; reason: string } {
  const required = MCP_TRUST_REQUIREMENTS[server.type];

  if (trust.effectiveScore < required) {
    return {
      allowed: false,
      reason: `${server.type} MCP requires trust score ${required} (current: ${trust.effectiveScore})`,
    };
  }

  return { allowed: true, reason: 'Trust requirement met' };
}

// =============================================================================
// MCP Server Configuration
// =============================================================================

export function createMCPServerConfig(
  id: string,
  name: string,
  type: MCPServerType,
  config: Record<string, unknown> = {},
  permissions: Partial<MCPPermissions> = {}
): MCPServerConfig {
  const template = MCP_SERVER_TEMPLATES[type];

  return {
    id,
    name,
    type,
    config: { ...template.defaultConfig, ...config },
    permissions: { ...template.defaultPermissions, ...permissions },
    enabled: true,
  };
}

export function updateMCPPermissions(
  server: MCPServerConfig,
  updates: Partial<MCPPermissions>
): MCPServerConfig {
  return {
    ...server,
    permissions: {
      ...server.permissions,
      ...updates,
    },
  };
}

// =============================================================================
// MCP Invocation
// =============================================================================

export function createMCPInvocation(
  serverId: string,
  method: string,
  params: Record<string, unknown>
): MCPInvocation {
  return {
    serverId,
    method,
    params,
    duration: 0,
  };
}

export async function executeMCPInvocation(
  server: MCPServerConfig,
  invocation: MCPInvocation,
  trust: TrustContext
): Promise<MCPInvocation> {
  const startTime = Date.now();

  // Check trust requirements
  const trustCheck = canUseMCPServer(server, trust);
  if (!trustCheck.allowed) {
    return {
      ...invocation,
      error: trustCheck.reason,
      duration: Date.now() - startTime,
    };
  }

  // Check permissions based on method
  const action = getActionFromMethod(invocation.method);
  const permCheck = checkMCPPermission(server, action, invocation.params.path as string);
  if (!permCheck.allowed) {
    return {
      ...invocation,
      error: permCheck.reason,
      duration: Date.now() - startTime,
    };
  }

  // Execute based on server type
  try {
    const result = await dispatchMCPRequest(server, invocation);
    return {
      ...invocation,
      result,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      ...invocation,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

function getActionFromMethod(method: string): 'read' | 'write' | 'execute' {
  const readMethods = ['get', 'list', 'read', 'search', 'query', 'fetch'];
  const writeMethods = ['create', 'update', 'delete', 'write', 'put', 'post'];

  const lowerMethod = method.toLowerCase();

  if (readMethods.some(m => lowerMethod.includes(m))) return 'read';
  if (writeMethods.some(m => lowerMethod.includes(m))) return 'write';
  return 'execute';
}

async function dispatchMCPRequest(
  server: MCPServerConfig,
  invocation: MCPInvocation
): Promise<unknown> {
  // This is where actual MCP protocol handling would go
  // For now, return a placeholder that indicates the MCP system is ready

  switch (server.type) {
    case 'filesystem':
      return handleFilesystemMCP(server, invocation);
    case 'github':
      return handleGitHubMCP(server, invocation);
    case 'database':
      return handleDatabaseMCP(server, invocation);
    case 'websearch':
      return handleWebSearchMCP(server, invocation);
    default:
      throw new Error(`Unsupported MCP server type: ${server.type}`);
  }
}

// =============================================================================
// MCP Handler Stubs (to be implemented with actual MCP protocol)
// =============================================================================

async function handleFilesystemMCP(
  server: MCPServerConfig,
  invocation: MCPInvocation
): Promise<unknown> {
  const { method, params } = invocation;

  // Placeholder - integrate with actual filesystem MCP
  switch (method) {
    case 'read':
      return { status: 'pending', message: 'Filesystem MCP read operation queued' };
    case 'list':
      return { status: 'pending', message: 'Filesystem MCP list operation queued' };
    case 'write':
      return { status: 'pending', message: 'Filesystem MCP write operation queued' };
    default:
      throw new Error(`Unknown filesystem method: ${method}`);
  }
}

async function handleGitHubMCP(
  server: MCPServerConfig,
  invocation: MCPInvocation
): Promise<unknown> {
  const { method, params } = invocation;

  // Placeholder - integrate with GitHub API
  switch (method) {
    case 'getRepo':
      return { status: 'pending', message: 'GitHub MCP repo fetch queued' };
    case 'listIssues':
      return { status: 'pending', message: 'GitHub MCP issues list queued' };
    case 'createPR':
      return { status: 'pending', message: 'GitHub MCP PR creation queued' };
    default:
      throw new Error(`Unknown GitHub method: ${method}`);
  }
}

async function handleDatabaseMCP(
  server: MCPServerConfig,
  invocation: MCPInvocation
): Promise<unknown> {
  const { method, params } = invocation;

  // Placeholder - integrate with database
  switch (method) {
    case 'query':
      return { status: 'pending', message: 'Database MCP query queued' };
    case 'insert':
      return { status: 'pending', message: 'Database MCP insert queued' };
    default:
      throw new Error(`Unknown database method: ${method}`);
  }
}

async function handleWebSearchMCP(
  server: MCPServerConfig,
  invocation: MCPInvocation
): Promise<unknown> {
  const { method, params } = invocation;

  // Placeholder - integrate with search API
  switch (method) {
    case 'search':
      return { status: 'pending', message: 'Web search MCP query queued', query: params.query };
    default:
      throw new Error(`Unknown websearch method: ${method}`);
  }
}

// =============================================================================
// MCP Context Builder
// =============================================================================

export function buildMCPContextPrompt(servers: MCPServerConfig[], trust: TrustContext): string {
  const enabledServers = servers.filter(s => s.enabled);

  if (enabledServers.length === 0) return '';

  const sections: string[] = ['## Connected MCP Servers\n'];

  for (const server of enabledServers) {
    const trustCheck = canUseMCPServer(server, trust);
    const status = trustCheck.allowed ? 'Available' : `Locked (${trustCheck.reason})`;

    sections.push(`### ${server.name} (${server.type})`);
    sections.push(`Status: ${status}`);
    sections.push(`Permissions: ${formatPermissions(server.permissions)}`);
    sections.push('');
  }

  return sections.join('\n');
}

function formatPermissions(perms: MCPPermissions): string {
  const parts: string[] = [];
  if (perms.read) parts.push('read');
  if (perms.write) parts.push('write');
  if (perms.execute) parts.push('execute');
  return parts.join(', ') || 'none';
}
