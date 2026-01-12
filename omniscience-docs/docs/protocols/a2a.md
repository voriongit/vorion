---
sidebar_position: 3
title: Agent-to-Agent Protocol (A2A)
description: Google's open protocol for direct agent-to-agent communication
tags: [protocols, a2a, google, communication, interoperability]
---

# Agent-to-Agent Protocol (A2A)

## Enabling Direct Agent Communication

The Agent-to-Agent Protocol (A2A) is Google's open protocol designed to enable autonomous AI agents to discover, communicate, and collaborate with each other directly. While MCP focuses on AI-to-tool integration, A2A addresses the agent-to-agent communication layer.

## Overview

### The A2A Vision

```
                    A2A Communication Layer
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   ┌─────────────┐                           ┌─────────────┐         │
│   │   Agent A   │                           │   Agent B   │         │
│   │ (Calendar)  │                           │  (Travel)   │         │
│   │             │      A2A Protocol         │             │         │
│   │  ┌───────┐  │◀────────────────────────▶│  ┌───────┐  │         │
│   │  │Skills │  │  • Discover capabilities  │  │Skills │  │         │
│   │  │Card   │  │  • Negotiate tasks        │  │Card   │  │         │
│   │  └───────┘  │  • Exchange results       │  └───────┘  │         │
│   └─────────────┘                           └─────────────┘         │
│          │                                         │                │
│          │        ┌─────────────┐                  │                │
│          └───────▶│   Agent C   │◀─────────────────┘                │
│                   │  (Finance)  │                                   │
│                   └─────────────┘                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Differences: A2A vs MCP

| Aspect | MCP | A2A |
|--------|-----|-----|
| **Focus** | AI ↔ Tools/Data | Agent ↔ Agent |
| **Relationship** | Client-Server | Peer-to-Peer |
| **Discovery** | Configured | Dynamic |
| **Intelligence** | Server is passive | Both sides intelligent |
| **Use Case** | Tool invocation | Task delegation |

## Core Concepts

### Agent Card

Every A2A agent publishes an **Agent Card** describing its capabilities:

```json
{
  "name": "TravelPlanner",
  "description": "Plans and books travel arrangements",
  "url": "https://travel.example.com/.well-known/agent.json",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true
  },
  "authentication": {
    "schemes": ["bearer", "oauth2"]
  },
  "defaultInputModes": ["text", "file"],
  "defaultOutputModes": ["text", "file"],
  "skills": [
    {
      "id": "flight-booking",
      "name": "Flight Booking",
      "description": "Search and book flights",
      "tags": ["travel", "flights", "booking"],
      "examples": [
        "Book a flight from NYC to LA next Tuesday",
        "Find the cheapest flight to Paris in December"
      ],
      "inputModes": ["text"],
      "outputModes": ["text", "file"]
    },
    {
      "id": "hotel-reservation",
      "name": "Hotel Reservation",
      "description": "Search and reserve hotels",
      "tags": ["travel", "hotels", "accommodation"],
      "examples": [
        "Find a hotel near Times Square for 3 nights",
        "Book a 5-star hotel in Tokyo"
      ]
    },
    {
      "id": "itinerary-planning",
      "name": "Itinerary Planning",
      "description": "Create comprehensive travel itineraries",
      "tags": ["travel", "planning", "itinerary"]
    }
  ]
}
```

### Tasks

Communication happens through **Tasks**:

```json
{
  "id": "task-12345",
  "sessionId": "session-67890",
  "status": {
    "state": "working",
    "message": {
      "role": "agent",
      "parts": [
        {
          "type": "text",
          "text": "Searching for flights from NYC to LA..."
        }
      ]
    }
  },
  "history": [
    {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Book me a flight from NYC to LA next Tuesday"
        }
      ]
    }
  ],
  "artifacts": []
}
```

### Task States

```
                        Task State Machine
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                          ┌─────────┐                             │
│              ┌──────────▶│submitted│──────────────┐              │
│              │           └─────────┘              │              │
│              │                │                   │              │
│              │                ▼                   ▼              │
│         ┌────┴────┐      ┌─────────┐        ┌─────────┐         │
│         │ failed  │◀─────│ working │───────▶│completed│         │
│         └─────────┘      └────┬────┘        └─────────┘         │
│                               │                                  │
│                               ▼                                  │
│                        ┌───────────┐                             │
│                        │input_needed│                            │
│                        └───────────┘                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

States:
• submitted    - Task received, not yet started
• working      - Agent is processing
• input_needed - Agent needs more information from user
• completed    - Task finished successfully
• failed       - Task could not be completed
```

## Protocol Operations

### Discovery

Agents discover each other through well-known endpoints:

```python
import httpx

async def discover_agent(base_url: str) -> AgentCard:
    """Discover an agent's capabilities."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/.well-known/agent.json"
        )
        return AgentCard(**response.json())

# Example
travel_agent = await discover_agent("https://travel.example.com")
print(f"Found agent: {travel_agent.name}")
print(f"Skills: {[s.name for s in travel_agent.skills]}")
```

### Task Submission

```python
async def submit_task(
    agent_url: str,
    message: str,
    session_id: str = None
) -> Task:
    """Submit a task to an agent."""

    payload = {
        "id": str(uuid.uuid4()),
        "message": {
            "role": "user",
            "parts": [{"type": "text", "text": message}]
        }
    }

    if session_id:
        payload["sessionId"] = session_id

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{agent_url}/tasks/send",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        return Task(**response.json())

# Example
task = await submit_task(
    "https://travel.example.com",
    "Book a flight from NYC to LA next Tuesday"
)
print(f"Task status: {task.status.state}")
```

### Streaming Updates

```python
async def stream_task_updates(agent_url: str, task_id: str):
    """Stream real-time task updates via SSE."""

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "GET",
            f"{agent_url}/tasks/{task_id}/sendSubscribe",
            headers={"Accept": "text/event-stream"}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    event = json.loads(line[5:])
                    yield TaskUpdate(**event)

# Example usage
async for update in stream_task_updates(agent_url, task.id):
    print(f"Status: {update.status.state}")
    if update.status.message:
        print(f"Message: {update.status.message.parts[0].text}")
```

## Multi-Agent Collaboration

### Agent as Client

An agent can invoke other agents:

```python
class CollaborativeAgent:
    """Agent that delegates to specialized agents."""

    def __init__(self, agent_registry: Dict[str, str]):
        self.registry = agent_registry  # skill -> agent_url

    async def handle_task(self, task: Task) -> TaskResult:
        """Process task, potentially delegating to other agents."""

        # Analyze what skills are needed
        required_skills = await self._analyze_requirements(task)

        results = []
        for skill in required_skills:
            if skill in self.local_skills:
                # Handle locally
                result = await self._execute_locally(skill, task)
            else:
                # Delegate to specialized agent
                agent_url = self.registry.get(skill)
                if agent_url:
                    result = await self._delegate_to_agent(agent_url, skill, task)
                else:
                    raise ValueError(f"No agent found for skill: {skill}")

            results.append(result)

        # Synthesize results
        return await self._synthesize_results(results)

    async def _delegate_to_agent(
        self,
        agent_url: str,
        skill: str,
        task: Task
    ) -> TaskResult:
        """Delegate subtask to another agent."""

        # Discover agent capabilities
        agent_card = await discover_agent(agent_url)

        # Verify skill is supported
        if not any(s.id == skill for s in agent_card.skills):
            raise ValueError(f"Agent doesn't support skill: {skill}")

        # Submit task
        subtask = await submit_task(
            agent_url,
            self._format_subtask(task, skill)
        )

        # Wait for completion
        return await self._wait_for_completion(agent_url, subtask.id)
```

### Orchestration Pattern

```python
class TravelOrchestratorAgent:
    """Orchestrates multiple travel-related agents."""

    async def plan_trip(self, request: TripRequest) -> TripPlan:
        """Coordinate multiple agents to plan a trip."""

        # 1. Get flight options from flight agent
        flight_task = await submit_task(
            self.flight_agent_url,
            f"Find flights from {request.origin} to {request.destination} "
            f"departing {request.departure_date}"
        )

        # 2. Get hotel options from hotel agent
        hotel_task = await submit_task(
            self.hotel_agent_url,
            f"Find hotels in {request.destination} "
            f"from {request.check_in} to {request.check_out}"
        )

        # 3. Get activity recommendations from activities agent
        activities_task = await submit_task(
            self.activities_agent_url,
            f"Suggest activities in {request.destination} "
            f"for {request.trip_duration} days"
        )

        # Wait for all agents to complete (parallel execution)
        flight_result, hotel_result, activities_result = await asyncio.gather(
            self._wait_for_completion(self.flight_agent_url, flight_task.id),
            self._wait_for_completion(self.hotel_agent_url, hotel_task.id),
            self._wait_for_completion(self.activities_agent_url, activities_task.id)
        )

        # 4. Synthesize into comprehensive plan
        return await self._create_trip_plan(
            flight_result,
            hotel_result,
            activities_result
        )
```

## Building A2A Agents

### Python Server Implementation

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid

app = FastAPI()

# In-memory task storage
tasks: Dict[str, Task] = {}

# Agent Card
AGENT_CARD = {
    "name": "WeatherAgent",
    "description": "Provides weather information and forecasts",
    "url": "https://weather.example.com",
    "version": "1.0.0",
    "skills": [
        {
            "id": "current-weather",
            "name": "Current Weather",
            "description": "Get current weather conditions",
            "examples": ["What's the weather in Tokyo?"]
        },
        {
            "id": "forecast",
            "name": "Weather Forecast",
            "description": "Get weather forecast for upcoming days",
            "examples": ["What's the forecast for NYC this week?"]
        }
    ]
}

@app.get("/.well-known/agent.json")
async def get_agent_card():
    """Return agent capabilities."""
    return AGENT_CARD

@app.post("/tasks/send")
async def send_task(request: TaskRequest) -> Task:
    """Receive and process a task."""

    task_id = request.id or str(uuid.uuid4())

    task = Task(
        id=task_id,
        sessionId=request.sessionId or str(uuid.uuid4()),
        status=TaskStatus(state="submitted"),
        history=[request.message]
    )

    tasks[task_id] = task

    # Process asynchronously
    asyncio.create_task(process_task(task_id))

    return task

async def process_task(task_id: str):
    """Process the task in background."""
    task = tasks[task_id]

    # Update to working
    task.status = TaskStatus(
        state="working",
        message=Message(
            role="agent",
            parts=[TextPart(text="Looking up weather information...")]
        )
    )

    # Simulate processing
    await asyncio.sleep(2)

    # Extract location from user message
    user_message = task.history[0].parts[0].text
    location = extract_location(user_message)

    # Get weather data
    weather = await fetch_weather(location)

    # Complete task
    task.status = TaskStatus(
        state="completed",
        message=Message(
            role="agent",
            parts=[TextPart(text=format_weather_response(weather))]
        )
    )

@app.get("/tasks/{task_id}")
async def get_task(task_id: str) -> Task:
    """Get task status."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.get("/tasks/{task_id}/sendSubscribe")
async def subscribe_to_task(task_id: str):
    """Stream task updates via SSE."""
    async def event_generator():
        while True:
            task = tasks.get(task_id)
            if not task:
                break

            yield f"data: {task.json()}\n\n"

            if task.status.state in ["completed", "failed"]:
                break

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
```

## Security and Authentication

### Authentication Schemes

```python
class A2AAuthenticator:
    """Handle A2A authentication."""

    async def authenticate_request(
        self,
        request: Request,
        agent_card: AgentCard
    ) -> AuthResult:
        """Validate incoming A2A request."""

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(401, "Missing authorization")

        scheme, credentials = auth_header.split(" ", 1)

        if scheme.lower() == "bearer":
            return await self._verify_bearer_token(credentials)

        elif scheme.lower() == "dpop":
            # DPoP (Demonstrating Proof of Possession)
            dpop_header = request.headers.get("DPoP")
            return await self._verify_dpop(credentials, dpop_header)

        raise HTTPException(401, f"Unsupported auth scheme: {scheme}")

    async def _verify_dpop(self, token: str, dpop_proof: str) -> AuthResult:
        """Verify DPoP token binding."""
        # Verify the access token
        claims = jwt.decode(token, options={"verify_signature": True})

        # Verify DPoP proof
        dpop_claims = jwt.decode(dpop_proof, options={"verify_signature": False})

        # Check token binding
        if claims.get("cnf", {}).get("jkt") != dpop_claims.get("jkt"):
            raise HTTPException(401, "Token binding mismatch")

        return AuthResult(
            authenticated=True,
            agent_id=claims.get("sub"),
            permissions=claims.get("scope", "").split()
        )
```

### Trust Verification

```python
async def verify_agent_trust(
    agent_url: str,
    trust_registry: TrustRegistry
) -> TrustLevel:
    """Verify agent's trust status before delegation."""

    # Fetch agent card
    agent_card = await discover_agent(agent_url)

    # Check if agent is in trusted registry
    trust_record = await trust_registry.lookup(agent_card.url)

    if not trust_record:
        return TrustLevel.UNKNOWN

    # Verify cryptographic identity
    if not await verify_agent_identity(agent_card, trust_record):
        return TrustLevel.COMPROMISED

    # Check trust score
    if trust_record.score >= 0.8:
        return TrustLevel.HIGH
    elif trust_record.score >= 0.5:
        return TrustLevel.MEDIUM
    else:
        return TrustLevel.LOW
```

## A2A and MCP Integration

Agents often use both protocols:

```python
class HybridAgent:
    """Agent using A2A for agent communication and MCP for tools."""

    def __init__(self):
        # MCP for tools
        self.mcp_client = MCPClient()
        self.mcp_client.connect_server("database", db_server_config)
        self.mcp_client.connect_server("search", search_server_config)

        # A2A for agent collaboration
        self.a2a_client = A2AClient()

    async def process_request(self, request: str) -> str:
        """Process request using both MCP tools and A2A agents."""

        # Use MCP to search local database
        search_results = await self.mcp_client.call_tool(
            "database",
            "query",
            {"sql": f"SELECT * FROM data WHERE ..."}
        )

        # If we need specialized analysis, delegate to another agent via A2A
        if self._needs_expert_analysis(search_results):
            expert_agent = await self.a2a_client.discover("analysis-expert")
            analysis = await self.a2a_client.submit_task(
                expert_agent.url,
                f"Analyze this data: {search_results}"
            )
            return await analysis.get_result()

        return self._format_response(search_results)
```

## Research and Future

A2A represents a step toward truly interoperable AI agents:

- **Federation**: Cross-organization agent networks
- **Marketplace**: Agent discovery and reputation
- **Composition**: Complex multi-agent workflows
- **Standards**: Potential W3C/IETF standardization

---

## See Also

- [MCP Protocol](./mcp.md) - AI-to-tool integration
- [Agent Identity](./agent-identity.md) - Decentralized identifiers for agents
- [Orchestration Patterns](../orchestration/index.md) - Multi-agent coordination
- [A2A Documentation](https://github.com/google/A2A) - Official specification
