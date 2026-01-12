---
sidebar_position: 2
title: Model Context Protocol (MCP)
description: Anthropic's open protocol for connecting AI to external tools and data
tags: [protocols, mcp, tools, anthropic, integration]
---

# Model Context Protocol (MCP)

## Standardizing AI-Tool Integration

The Model Context Protocol (MCP) is an open protocol developed by Anthropic that standardizes how AI assistants connect to external data sources, tools, and services. It provides a universal interface for AI systems to interact with the outside world.

## Overview

### The Problem MCP Solves

Before MCP, every AI-tool integration required custom code:

```
Without MCP:
┌─────────────┐     custom     ┌─────────────┐
│   Claude    │ ──────────────▶│  Database   │
└─────────────┘                └─────────────┘
       │          custom
       └──────────────────────▶┌─────────────┐
                               │   GitHub    │
                               └─────────────┘
       │          custom
       └──────────────────────▶┌─────────────┐
                               │   Slack     │
                               └─────────────┘

With MCP:
┌─────────────┐                ┌─────────────┐
│   Claude    │                │  Database   │
│             │     MCP        ├─────────────┤
│  MCP Host   │ ◀─────────────▶│   GitHub    │
│             │  (standard)    ├─────────────┤
│             │                │   Slack     │
└─────────────┘                └─────────────┘
                               (MCP Servers)
```

### Architecture

```
                    MCP Architecture
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                    MCP Host                       │   │
│  │  (Claude, ChatGPT, or any LLM application)       │   │
│  │                                                   │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │              MCP Client                      │ │   │
│  │  │  - Maintains server connections              │ │   │
│  │  │  - Routes requests/responses                 │ │   │
│  │  │  - Manages tool execution                    │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│                           │                              │
│                           │ JSON-RPC                     │
│                           ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │                   MCP Servers                     │   │
│  │                                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ Database │  │ Browser  │  │   API    │       │   │
│  │  │  Server  │  │  Server  │  │  Server  │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘       │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Core Concepts

### Resources

Resources represent data sources that can be read by the AI:

```typescript
interface Resource {
  uri: string;           // Unique identifier (e.g., "file:///path/to/doc.md")
  name: string;          // Human-readable name
  description?: string;  // What this resource contains
  mimeType?: string;     // Content type
}

// Example: Reading a file resource
const resource = await server.readResource("file:///project/README.md");
// Returns: { uri: "...", content: "# My Project\n..." }
```

### Tools

Tools are functions the AI can invoke:

```typescript
interface Tool {
  name: string;           // Function name (e.g., "search_files")
  description: string;    // What the tool does
  inputSchema: JSONSchema; // Parameters the tool accepts
}

// Example tool definition
const searchTool: Tool = {
  name: "search_files",
  description: "Search for files matching a pattern",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern to match (e.g., '**/*.ts')"
      },
      directory: {
        type: "string",
        description: "Directory to search in"
      }
    },
    required: ["pattern"]
  }
};

// Tool invocation
const result = await server.callTool("search_files", {
  pattern: "**/*.md",
  directory: "/docs"
});
```

### Prompts

Pre-defined prompt templates for common operations:

```typescript
interface Prompt {
  name: string;            // Template name
  description?: string;    // What this prompt helps with
  arguments?: PromptArg[]; // Parameters for customization
}

// Example prompt
const codeReviewPrompt: Prompt = {
  name: "code_review",
  description: "Review code for issues and improvements",
  arguments: [
    {
      name: "file_path",
      description: "Path to the file to review",
      required: true
    },
    {
      name: "focus_areas",
      description: "Specific areas to focus on (security, performance, etc.)",
      required: false
    }
  ]
};
```

## Building an MCP Server

### Python Implementation

```python
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.server.stdio
import mcp.types as types

# Create server instance
server = Server("example-server")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available tools."""
    return [
        types.Tool(
            name="calculate",
            description="Perform mathematical calculations",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression to evaluate"
                    }
                },
                "required": ["expression"]
            }
        ),
        types.Tool(
            name="fetch_weather",
            description="Get current weather for a location",
            inputSchema={
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                    "country": {"type": "string", "description": "Country code"}
                },
                "required": ["city"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(
    name: str,
    arguments: dict
) -> list[types.TextContent]:
    """Execute a tool."""
    if name == "calculate":
        try:
            result = eval(arguments["expression"])  # Note: Use safer eval in production
            return [types.TextContent(type="text", text=str(result))]
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error: {e}")]

    elif name == "fetch_weather":
        # In production, call actual weather API
        city = arguments["city"]
        return [types.TextContent(
            type="text",
            text=f"Weather in {city}: 72°F, Sunny"
        )]

    raise ValueError(f"Unknown tool: {name}")

@server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    """List available resources."""
    return [
        types.Resource(
            uri="config://settings",
            name="Application Settings",
            description="Current application configuration",
            mimeType="application/json"
        )
    ]

@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read a resource."""
    if uri == "config://settings":
        return json.dumps({"theme": "dark", "language": "en"})
    raise ValueError(f"Unknown resource: {uri}")

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="example-server",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### TypeScript Implementation

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "example-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_database",
        description: "Search the database for records",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL-like query string",
            },
            limit: {
              type: "number",
              description: "Maximum results to return",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_database") {
    // Execute database query
    const results = await executeQuery(args.query, args.limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## MCP in Practice

### Common Server Types

| Server Type | Purpose | Example Tools |
|-------------|---------|---------------|
| **Filesystem** | File operations | read_file, write_file, search |
| **Database** | Data queries | query, insert, update |
| **API Gateway** | External services | http_get, http_post |
| **Browser** | Web interaction | navigate, click, screenshot |
| **Git** | Version control | commit, diff, log |
| **Code Execution** | Run code | execute_python, execute_js |

### Security Considerations

```python
class SecureMCPServer(Server):
    """MCP server with security controls."""

    def __init__(self, allowed_directories: List[str], max_file_size: int):
        super().__init__("secure-server")
        self.allowed_directories = allowed_directories
        self.max_file_size = max_file_size

    async def validate_file_access(self, path: str) -> bool:
        """Ensure file access is within allowed directories."""
        resolved = os.path.realpath(path)
        return any(
            resolved.startswith(os.path.realpath(d))
            for d in self.allowed_directories
        )

    async def read_file_safely(self, path: str) -> str:
        """Read file with security checks."""
        if not await self.validate_file_access(path):
            raise PermissionError(f"Access denied: {path}")

        size = os.path.getsize(path)
        if size > self.max_file_size:
            raise ValueError(f"File too large: {size} bytes")

        with open(path, 'r') as f:
            return f.read()
```

### Error Handling

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await executeTool(request.params);
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    // Return error in MCP format
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});
```

## Advanced Features

### Streaming Responses

For long-running operations:

```python
@server.call_tool()
async def handle_streaming_tool(name: str, arguments: dict):
    """Tool that streams progress updates."""
    if name == "long_analysis":
        async def generate():
            yield types.TextContent(type="text", text="Starting analysis...")

            for i in range(10):
                await asyncio.sleep(1)
                yield types.TextContent(
                    type="text",
                    text=f"Progress: {(i+1)*10}%"
                )

            yield types.TextContent(type="text", text="Analysis complete!")

        return generate()
```

### Sampling (AI Calling AI)

MCP supports recursive AI invocation:

```typescript
// Server requests AI help from the host
server.setRequestHandler(CreateMessageRequestSchema, async (request) => {
  // This allows the MCP server to ask the host AI for help
  const response = await server.request(
    {
      method: "sampling/createMessage",
      params: {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Help me summarize this document...",
            },
          },
        ],
        maxTokens: 1000,
      },
    },
    CreateMessageResultSchema
  );

  return response;
});
```

## MCP Ecosystem

### Popular MCP Servers

- **@modelcontextprotocol/server-filesystem** - File system operations
- **@modelcontextprotocol/server-brave-search** - Web search
- **@modelcontextprotocol/server-github** - GitHub integration
- **@modelcontextprotocol/server-postgres** - PostgreSQL queries
- **@modelcontextprotocol/server-puppeteer** - Browser automation

### Configuration Example

Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/me/projects"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    },
    "database": {
      "command": "python",
      "args": ["-m", "my_db_server"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

## Research and Evolution

MCP continues to evolve with the agentic AI ecosystem:

- **OAuth Integration**: Secure authentication flows
- **Remote Servers**: Network-hosted MCP servers
- **Discovery**: Automatic server discovery
- **Composition**: Combining multiple servers

---

## See Also

- [Tool Use Architecture](../architecture/tool-use.md) - How agents use tools
- [A2A Protocol](./a2a.md) - Agent-to-agent communication
- [MCP Documentation](https://modelcontextprotocol.io) - Official docs
