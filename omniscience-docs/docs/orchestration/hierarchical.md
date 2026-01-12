---
sidebar_position: 2
title: Hierarchical Orchestration
description: Tree-structured command and control for agent systems
tags: [orchestration, hierarchy, delegation, management]
---

# Hierarchical Orchestration

## Tree-Structured Command and Control

Hierarchical orchestration models traditional management structures: high-level agents decompose tasks and delegate to specialists. It's intuitive, controllable, and well-suited for complex, decomposable problems.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  HIERARCHICAL STRUCTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌───────────────┐                        │
│                    │   EXECUTIVE   │                        │
│                    │    AGENT      │                        │
│                    │               │                        │
│                    │  High-level   │                        │
│                    │  planning     │                        │
│                    └───────┬───────┘                        │
│                            │                                 │
│              ┌─────────────┼─────────────┐                  │
│              │             │             │                  │
│              ▼             ▼             ▼                  │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│        │ MANAGER  │  │ MANAGER  │  │ MANAGER  │            │
│        │ (Code)   │  │ (Design) │  │ (Test)   │            │
│        └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│             │             │             │                   │
│        ┌────┴────┐   ┌────┴────┐   ┌────┴────┐             │
│        ▼         ▼   ▼         ▼   ▼         ▼             │
│     ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│     │Work │ │Work │ │Work │ │Work │ │Work │ │Work │       │
│     │ er  │ │ er  │ │ er  │ │ er  │ │ er  │ │ er  │       │
│     └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### Executive Agent

The top-level planner that understands the full problem:

```python
class ExecutiveAgent:
    def __init__(self, llm, managers: dict[str, ManagerAgent]):
        self.llm = llm
        self.managers = managers

    def handle_request(self, user_request: str) -> str:
        # 1. Analyze and decompose
        plan = self.create_plan(user_request)

        # 2. Delegate to managers
        results = {}
        for task in plan.tasks:
            manager = self.managers[task.domain]
            results[task.id] = manager.execute(task)

        # 3. Synthesize results
        return self.synthesize(user_request, results)

    def create_plan(self, request: str) -> Plan:
        prompt = f"""
        You are a project executive. Analyze this request and create a plan.

        Request: {request}

        Available teams: {list(self.managers.keys())}

        Output a plan with:
        1. Overall goal
        2. Tasks (each assigned to a team)
        3. Dependencies between tasks
        """
        return self._parse_plan(self.llm.generate(prompt))
```

### Manager Agent

Middle-layer coordinators for specific domains:

```python
class ManagerAgent:
    def __init__(self, domain: str, llm, workers: list[WorkerAgent]):
        self.domain = domain
        self.llm = llm
        self.workers = workers

    def execute(self, task: Task) -> TaskResult:
        # Decompose into subtasks
        subtasks = self.decompose(task)

        # Assign to workers
        assignments = self.assign_workers(subtasks)

        # Execute and monitor
        results = []
        for worker, subtask in assignments:
            result = worker.execute(subtask)

            # Quality check
            if not self.quality_check(result):
                result = self.request_revision(worker, subtask, result)

            results.append(result)

        # Aggregate results
        return self.aggregate(results)
```

### Worker Agent

Specialized executors for specific tasks:

```python
class WorkerAgent:
    def __init__(self, specialty: str, llm, tools: list):
        self.specialty = specialty
        self.llm = llm
        self.tools = tools

    def execute(self, subtask: Subtask) -> SubtaskResult:
        prompt = f"""
        You are a {self.specialty} specialist.

        Task: {subtask.description}
        Requirements: {subtask.requirements}

        Complete this task using your expertise.
        """

        # Execute with tools
        result = self.execute_with_tools(prompt)

        return SubtaskResult(
            subtask_id=subtask.id,
            output=result,
            status="complete"
        )
```

---

## Task Decomposition

### Recursive Decomposition

```python
def decompose_task(task: Task, depth: int = 0, max_depth: int = 3) -> TaskTree:
    if depth >= max_depth or is_atomic(task):
        return TaskTree(task=task, children=[])

    subtasks = llm.generate(f"""
        Break down this task into 2-5 subtasks:
        Task: {task.description}

        Output as JSON list of subtask descriptions.
    """)

    children = [
        decompose_task(Subtask(s), depth + 1, max_depth)
        for s in json.loads(subtasks)
    ]

    return TaskTree(task=task, children=children)
```

### Dependency Tracking

```python
class DependencyGraph:
    def __init__(self):
        self.graph = nx.DiGraph()

    def add_task(self, task_id: str, dependencies: list[str]):
        self.graph.add_node(task_id)
        for dep in dependencies:
            self.graph.add_edge(dep, task_id)

    def get_ready_tasks(self, completed: set[str]) -> list[str]:
        """Return tasks whose dependencies are all complete."""
        ready = []
        for node in self.graph.nodes():
            if node not in completed:
                deps = set(self.graph.predecessors(node))
                if deps.issubset(completed):
                    ready.append(node)
        return ready

    def topological_order(self) -> list[str]:
        return list(nx.topological_sort(self.graph))
```

---

## Communication Patterns

### Top-Down Delegation

```python
class DelegationMessage:
    task_id: str
    description: str
    requirements: list[str]
    deadline: datetime | None
    priority: int

def delegate(manager: ManagerAgent, task: Task) -> DelegationMessage:
    return DelegationMessage(
        task_id=task.id,
        description=task.description,
        requirements=task.requirements,
        deadline=task.deadline,
        priority=task.priority
    )
```

### Bottom-Up Reporting

```python
class StatusReport:
    task_id: str
    status: Literal["pending", "in_progress", "blocked", "complete", "failed"]
    progress_percent: int
    output: Any | None
    blockers: list[str]

def report_status(worker: WorkerAgent, task: Task) -> StatusReport:
    return StatusReport(
        task_id=task.id,
        status=worker.current_status,
        progress_percent=worker.estimate_progress(),
        output=worker.partial_output,
        blockers=worker.current_blockers
    )
```

---

## Implementation Example: MetaGPT Style

```python
class SoftwareCompanyAgents:
    def __init__(self):
        self.ceo = Agent("CEO", role="Executive decision maker")
        self.cto = Agent("CTO", role="Technical strategy")
        self.pm = Agent("PM", role="Requirements and planning")
        self.architect = Agent("Architect", role="System design")
        self.engineers = [
            Agent(f"Engineer_{i}", role="Implementation")
            for i in range(3)
        ]
        self.qa = Agent("QA", role="Testing")

    async def develop_product(self, requirements: str) -> Product:
        # CEO reviews requirements
        vision = await self.ceo.review(requirements)

        # PM creates detailed specs
        specs = await self.pm.create_specs(vision)

        # Architect designs system
        design = await self.architect.design(specs)

        # Engineers implement in parallel
        implementations = await asyncio.gather(*[
            engineer.implement(component)
            for engineer, component in self.assign(design)
        ])

        # QA tests
        test_results = await self.qa.test(implementations)

        # Iterate if needed
        if not test_results.passed:
            return await self.fix_and_retest(test_results)

        return Product(implementations)
```

---

## Span of Control

How many subordinates should each manager have?

```
┌─────────────────────────────────────────────────────────────┐
│                    SPAN OF CONTROL                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Narrow (2-3)              Wide (7-10)                     │
│                                                              │
│       M                          M                           │
│      ╱ ╲                    ╱╱╱│╲╲╲                          │
│     W   W                  W W W W W W                       │
│                                                              │
│   ✓ Close oversight        ✓ Less overhead                  │
│   ✓ More layers           ✓ Faster communication            │
│   ✗ Slow                   ✗ Less oversight                 │
│   ✗ Expensive              ✗ Manager overload               │
│                                                              │
│   Best for:                Best for:                        │
│   Complex, novel tasks     Routine, well-defined tasks      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Escalation

```python
class EscalationPolicy:
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries

    def handle_failure(
        self,
        task: Task,
        error: Exception,
        worker: WorkerAgent,
        manager: ManagerAgent
    ) -> Action:
        if task.retry_count < self.max_retries:
            # Retry with same worker
            return RetryAction(worker, task)

        if self.can_reassign(task, manager):
            # Try different worker
            new_worker = manager.find_alternative_worker(task)
            return ReassignAction(new_worker, task)

        # Escalate to manager's supervisor
        return EscalateAction(manager.supervisor, task, error)
```

### Rollback

```python
class TransactionalExecution:
    def __init__(self):
        self.completed_tasks: list[Task] = []
        self.rollback_actions: list[Callable] = []

    async def execute_with_rollback(self, tasks: list[Task]):
        try:
            for task in tasks:
                result = await self.execute_task(task)
                self.completed_tasks.append(task)
                self.rollback_actions.append(result.rollback)
        except Exception as e:
            # Rollback in reverse order
            for rollback in reversed(self.rollback_actions):
                await rollback()
            raise
```

---

## Advantages

1. **Clear responsibility**: Each agent has defined scope
2. **Scalable**: Add more workers without changing structure
3. **Controllable**: Managers can monitor and intervene
4. **Natural decomposition**: Maps to how humans organize

## Disadvantages

1. **Communication overhead**: Messages traverse hierarchy
2. **Single points of failure**: Manager failure blocks workers
3. **Rigidity**: Hard to adapt to unexpected situations
4. **Latency**: Multiple hops add delay

---

## References

- Hong, S., et al. (2023). *MetaGPT: Meta Programming for Multi-Agent Collaboration*
- Li, G., et al. (2023). *CAMEL: Communicative Agents for "Mind" Exploration*
- Qian, C., et al. (2023). *ChatDev: Communicative Agents for Software Development*
