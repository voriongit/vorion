---
sidebar_position: 6
title: Tool Use
description: Extending agent capabilities through external integrations
tags: [architecture, tools, function-calling, apis]
---

# Tool Use

## Extending Agent Capabilities Through External Integrations

Tool use transforms language models from pure text generators into capable agents that can interact with the world. Through function calling, API integration, and code execution, agents extend their capabilities beyond training data.

---

## The Tool Use Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      TOOL USE PATTERN                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User: "What's the weather in Tokyo?"                      │
│                                                              │
│   ┌─────────────────────────────────────────┐               │
│   │              LLM REASONING               │               │
│   │                                          │               │
│   │  "I need current weather data.          │               │
│   │   I'll use the weather tool."           │               │
│   │                                          │               │
│   │  Tool call: get_weather(city="Tokyo")   │               │
│   └────────────────────┬────────────────────┘               │
│                        │                                     │
│                        ▼                                     │
│   ┌─────────────────────────────────────────┐               │
│   │            TOOL EXECUTION                │               │
│   │                                          │               │
│   │  → API call to weather service          │               │
│   │  ← {"temp": 22, "condition": "sunny"}   │               │
│   └────────────────────┬────────────────────┘               │
│                        │                                     │
│                        ▼                                     │
│   ┌─────────────────────────────────────────┐               │
│   │           LLM RESPONSE                   │               │
│   │                                          │               │
│   │  "It's currently 22°C and sunny         │               │
│   │   in Tokyo."                             │               │
│   └─────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tool Definition

### Schema-Based Definition

```python
from typing import Literal
from pydantic import BaseModel, Field

class WeatherTool(BaseModel):
    """Get current weather for a city."""

    city: str = Field(..., description="City name")
    units: Literal["celsius", "fahrenheit"] = Field(
        default="celsius",
        description="Temperature units"
    )

    def execute(self) -> dict:
        # Call weather API
        response = requests.get(
            f"https://api.weather.com/v1/current",
            params={"city": self.city, "units": self.units}
        )
        return response.json()
```

### OpenAPI-Style Definition

```python
TOOLS = [
    {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "City name (e.g., 'Tokyo', 'New York')"
                },
                "units": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "default": "celsius"
                }
            },
            "required": ["city"]
        }
    },
    {
        "name": "search_web",
        "description": "Search the web for information",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                }
            },
            "required": ["query"]
        }
    }
]
```

---

## Tool Execution

### Basic Executor

```python
class ToolExecutor:
    def __init__(self, tools: dict[str, Callable]):
        self.tools = tools

    def execute(self, tool_call: dict) -> str:
        name = tool_call["name"]
        args = tool_call["arguments"]

        if name not in self.tools:
            return f"Error: Unknown tool '{name}'"

        try:
            result = self.tools[name](**args)
            return json.dumps(result)
        except Exception as e:
            return f"Error executing {name}: {str(e)}"
```

### Parallel Execution

```python
class ParallelToolExecutor:
    async def execute_batch(self, tool_calls: list[dict]) -> list[str]:
        """Execute multiple tool calls in parallel."""
        tasks = [
            self._execute_one(call)
            for call in tool_calls
        ]
        return await asyncio.gather(*tasks)

    async def _execute_one(self, tool_call: dict) -> str:
        # Wrap sync tools in async
        return await asyncio.to_thread(
            self.execute, tool_call
        )
```

---

## Function Calling Protocol

### Request Format

```python
# User message with tool availability
request = {
    "model": "claude-3-opus",
    "messages": [
        {"role": "user", "content": "What's the weather in Tokyo?"}
    ],
    "tools": TOOLS,
    "tool_choice": "auto"  # or "required" or {"name": "specific_tool"}
}
```

### Response with Tool Call

```python
response = {
    "role": "assistant",
    "content": None,
    "tool_calls": [
        {
            "id": "call_abc123",
            "type": "function",
            "function": {
                "name": "get_weather",
                "arguments": '{"city": "Tokyo", "units": "celsius"}'
            }
        }
    ]
}
```

### Tool Result

```python
tool_result = {
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": '{"temp": 22, "condition": "sunny", "humidity": 65}'
}
```

---

## Tool Categories

### 1. Information Retrieval

```python
retrieval_tools = {
    "web_search": search_web,
    "read_file": read_file,
    "query_database": query_db,
    "fetch_url": fetch_url
}
```

### 2. Computation

```python
compute_tools = {
    "calculator": evaluate_math,
    "run_code": execute_python,
    "analyze_data": run_analysis
}
```

### 3. External Actions

```python
action_tools = {
    "send_email": send_email,
    "create_calendar_event": create_event,
    "post_to_slack": post_message
}
```

### 4. Multi-Modal

```python
multimodal_tools = {
    "generate_image": text_to_image,
    "transcribe_audio": speech_to_text,
    "analyze_image": image_to_text
}
```

---

## Code Execution

### Sandboxed Execution

```python
class CodeExecutor:
    def __init__(self, allowed_modules: list[str]):
        self.allowed_modules = set(allowed_modules)

    def execute(self, code: str, timeout: int = 30) -> dict:
        # Create restricted globals
        safe_globals = {
            "__builtins__": self._safe_builtins(),
            **self._allowed_imports()
        }

        try:
            # Execute with timeout
            with time_limit(timeout):
                exec(compile(code, "<agent>", "exec"), safe_globals)

            return {
                "status": "success",
                "output": safe_globals.get("result"),
                "stdout": capture_stdout()
            }
        except TimeoutError:
            return {"status": "error", "error": "Execution timed out"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
```

### Docker-Based Isolation

```python
class DockerExecutor:
    def execute(self, code: str, language: str) -> dict:
        container = docker.run(
            image=f"executor-{language}",
            command=["run", "-"],
            stdin=code,
            mem_limit="256m",
            cpu_period=100000,
            cpu_quota=50000,  # 50% CPU
            network_disabled=True
        )

        return {
            "output": container.logs(),
            "exit_code": container.wait()
        }
```

---

## MCP (Model Context Protocol)

Anthropic's standard for tool integration:

```python
# MCP Server Definition
class MCPWeatherServer:
    @mcp.tool()
    async def get_weather(
        self,
        city: str,
        units: str = "celsius"
    ) -> dict:
        """Get current weather for a city."""
        # Implementation
        pass

    @mcp.resource("weather://forecast/{city}")
    async def get_forecast(self, city: str) -> str:
        """Get weather forecast as a resource."""
        pass

# MCP Client Usage
async with mcp.connect("weather-server") as client:
    tools = await client.list_tools()
    result = await client.call_tool("get_weather", {"city": "Tokyo"})
```

---

## Tool Selection

### LLM-Based Selection

```python
def select_tools(task: str, available_tools: list[dict]) -> list[str]:
    prompt = f"""
    Task: {task}

    Available tools:
    {format_tools(available_tools)}

    Which tools are needed for this task?
    List tool names, one per line.
    """

    response = llm.generate(prompt)
    return parse_tool_names(response)
```

### Retrieval-Based Selection

```python
class ToolRetriever:
    def __init__(self, tools: list[dict], embedder):
        self.embedder = embedder
        self.tool_embeddings = {
            t["name"]: embedder.embed(t["description"])
            for t in tools
        }

    def retrieve(self, query: str, k: int = 5) -> list[str]:
        query_embedding = self.embedder.embed(query)

        scores = {
            name: cosine_similarity(query_embedding, emb)
            for name, emb in self.tool_embeddings.items()
        }

        return sorted(scores, key=scores.get, reverse=True)[:k]
```

---

## Error Handling

```python
class RobustToolAgent:
    def execute_with_retry(
        self,
        tool_call: dict,
        max_retries: int = 3
    ) -> str:
        for attempt in range(max_retries):
            result = self.executor.execute(tool_call)

            if not self._is_error(result):
                return result

            # Ask LLM to fix the call
            fixed = self.llm.generate(f"""
                Tool call failed:
                Call: {tool_call}
                Error: {result}

                Suggest a corrected tool call.
            """)

            tool_call = self._parse_tool_call(fixed)

        return f"Failed after {max_retries} attempts"
```

---

## Security Considerations

### Input Validation

```python
def validate_tool_call(tool_call: dict, schema: dict) -> bool:
    # Validate against JSON schema
    try:
        jsonschema.validate(tool_call["arguments"], schema)
    except ValidationError as e:
        raise ToolValidationError(str(e))

    # Check for injection attacks
    for value in tool_call["arguments"].values():
        if contains_injection(value):
            raise SecurityError("Potential injection detected")

    return True
```

### Capability Gating

```python
class GatedToolExecutor:
    def __init__(self, tools, permission_checker):
        self.tools = tools
        self.permissions = permission_checker

    def execute(self, tool_call: dict, agent_context: dict) -> str:
        tool_name = tool_call["name"]

        # Check if agent has permission
        if not self.permissions.can_use(
            agent=agent_context["agent_id"],
            tool=tool_name,
            args=tool_call["arguments"]
        ):
            return f"Permission denied for {tool_name}"

        return self.tools[tool_name](**tool_call["arguments"])
```

---

## Best Practices

1. **Clear Descriptions**: Tools should have unambiguous descriptions
2. **Atomic Operations**: Each tool does one thing well
3. **Graceful Errors**: Return informative error messages
4. **Idempotency**: Where possible, tools should be safe to retry
5. **Rate Limiting**: Protect against excessive tool use
6. **Logging**: Track all tool invocations for debugging

---

## References

- Schick, T., et al. (2023). *Toolformer: Language Models Can Teach Themselves to Use Tools*
- Qin, Y., et al. (2023). *Tool Learning with Foundation Models*
- Anthropic. (2024). *Model Context Protocol Specification*
