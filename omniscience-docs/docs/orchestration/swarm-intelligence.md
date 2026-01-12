---
sidebar_position: 3
title: Swarm Intelligence
description: Emergent behavior from decentralized agent interactions
tags: [orchestration, swarm, emergence, decentralized]
---

# Swarm Intelligence

## Emergent Behavior from Decentralized Interactions

Swarm intelligence produces complex collective behavior from simple individual rules. Without central control, agents following local interactions create global order—like ants finding food or birds flocking.

---

## Core Principles

```
┌─────────────────────────────────────────────────────────────┐
│                  SWARM PRINCIPLES                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. DECENTRALIZATION                                        │
│      No single point of control                              │
│      Each agent acts autonomously                            │
│                                                              │
│   2. LOCAL INTERACTION                                       │
│      Agents only communicate with neighbors                  │
│      No global knowledge required                            │
│                                                              │
│   3. SIMPLE RULES                                           │
│      Individual behavior is simple                           │
│      Complexity emerges from interaction                     │
│                                                              │
│   4. POSITIVE FEEDBACK                                       │
│      Success amplifies success                               │
│      Good solutions attract more agents                      │
│                                                              │
│   5. NEGATIVE FEEDBACK                                       │
│      Prevents runaway behavior                               │
│      Enables adaptation                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Classic Algorithms

### Ant Colony Optimization (ACO)

Ants find shortest paths using pheromone trails:

```python
class AntColonyOptimizer:
    def __init__(self, n_ants: int, graph: Graph,
                 alpha: float = 1.0, beta: float = 2.0,
                 evaporation: float = 0.5):
        self.n_ants = n_ants
        self.graph = graph
        self.alpha = alpha  # Pheromone importance
        self.beta = beta    # Heuristic importance
        self.evaporation = evaporation
        self.pheromones = defaultdict(lambda: 1.0)

    def solve(self, start, goal, iterations: int = 100) -> Path:
        best_path = None
        best_cost = float('inf')

        for _ in range(iterations):
            # Each ant constructs a solution
            paths = [self.construct_path(start, goal) for _ in range(self.n_ants)]

            # Update best
            for path in paths:
                cost = self.path_cost(path)
                if cost < best_cost:
                    best_cost = cost
                    best_path = path

            # Update pheromones
            self.evaporate_pheromones()
            self.deposit_pheromones(paths)

        return best_path

    def construct_path(self, start, goal) -> Path:
        path = [start]
        current = start

        while current != goal:
            next_node = self.select_next(current, path)
            path.append(next_node)
            current = next_node

        return path

    def select_next(self, current, visited) -> Node:
        neighbors = [n for n in self.graph.neighbors(current)
                    if n not in visited]

        if not neighbors:
            return None

        # Probability based on pheromone and heuristic
        probs = []
        for neighbor in neighbors:
            pheromone = self.pheromones[(current, neighbor)] ** self.alpha
            heuristic = (1 / self.graph.distance(current, neighbor)) ** self.beta
            probs.append(pheromone * heuristic)

        probs = [p / sum(probs) for p in probs]
        return random.choices(neighbors, probs)[0]
```

### Particle Swarm Optimization (PSO)

Particles explore solution space guided by personal and global best:

```python
class ParticleSwarmOptimizer:
    def __init__(self, n_particles: int, dimensions: int,
                 w: float = 0.7, c1: float = 1.5, c2: float = 1.5):
        self.n_particles = n_particles
        self.dimensions = dimensions
        self.w = w    # Inertia
        self.c1 = c1  # Cognitive (personal best)
        self.c2 = c2  # Social (global best)

        self.positions = np.random.uniform(-10, 10, (n_particles, dimensions))
        self.velocities = np.zeros((n_particles, dimensions))
        self.personal_best = self.positions.copy()
        self.global_best = None

    def optimize(self, objective_fn, iterations: int = 100):
        for _ in range(iterations):
            # Evaluate fitness
            fitness = [objective_fn(p) for p in self.positions]

            # Update personal bests
            for i, f in enumerate(fitness):
                if self.global_best is None or f < objective_fn(self.personal_best[i]):
                    self.personal_best[i] = self.positions[i].copy()

            # Update global best
            best_idx = np.argmin(fitness)
            if self.global_best is None or fitness[best_idx] < objective_fn(self.global_best):
                self.global_best = self.positions[best_idx].copy()

            # Update velocities and positions
            for i in range(self.n_particles):
                r1, r2 = random.random(), random.random()

                cognitive = self.c1 * r1 * (self.personal_best[i] - self.positions[i])
                social = self.c2 * r2 * (self.global_best - self.positions[i])

                self.velocities[i] = self.w * self.velocities[i] + cognitive + social
                self.positions[i] += self.velocities[i]

        return self.global_best
```

---

## LLM Agent Swarms

### Parallel Exploration

```python
class LLMSwarm:
    def __init__(self, llm, n_agents: int):
        self.llm = llm
        self.n_agents = n_agents
        self.shared_findings = []

    async def explore(self, topic: str) -> list[str]:
        # Each agent explores independently
        agents = [
            self.create_explorer(topic, i)
            for i in range(self.n_agents)
        ]

        # Parallel exploration
        findings = await asyncio.gather(*[
            agent.explore() for agent in agents
        ])

        # Aggregate and deduplicate
        all_findings = []
        for agent_findings in findings:
            all_findings.extend(agent_findings)

        return self.deduplicate(all_findings)

    def create_explorer(self, topic: str, agent_id: int) -> Explorer:
        # Each agent has slightly different prompt/perspective
        perspectives = [
            "technical", "historical", "practical",
            "theoretical", "comparative", "critical"
        ]
        perspective = perspectives[agent_id % len(perspectives)]

        return Explorer(
            self.llm,
            topic,
            perspective,
            self.shared_findings
        )
```

### Stigmergy (Indirect Communication)

```python
class StigmergicSwarm:
    """Agents communicate through shared environment, not direct messages."""

    def __init__(self, n_agents: int):
        self.n_agents = n_agents
        self.environment = SharedEnvironment()

    def solve(self, problem: Problem):
        agents = [
            StigmergicAgent(i, self.environment)
            for i in range(self.n_agents)
        ]

        while not self.environment.has_solution():
            # Each agent reads environment, acts, modifies environment
            for agent in agents:
                # Read traces left by others
                traces = self.environment.read_traces(agent.position)

                # Decide action based on traces
                action = agent.decide(traces)

                # Execute and leave trace
                result = agent.execute(action)
                self.environment.leave_trace(agent.position, result)

        return self.environment.get_solution()

class SharedEnvironment:
    def __init__(self):
        self.traces: dict[Position, list[Trace]] = defaultdict(list)
        self.solutions: list = []

    def leave_trace(self, position, content):
        trace = Trace(
            content=content,
            strength=1.0,
            timestamp=datetime.now()
        )
        self.traces[position].append(trace)

    def read_traces(self, position) -> list[Trace]:
        # Return traces, decayed by time
        active_traces = []
        for trace in self.traces[position]:
            decayed_strength = trace.strength * self.decay(trace.timestamp)
            if decayed_strength > 0.1:
                active_traces.append(trace)
        return active_traces
```

---

## Flocking Behavior

Agents moving together based on local rules:

```python
class FlockingAgents:
    """Boids-style flocking for agent coordination."""

    def __init__(self, n_agents: int):
        self.agents = [
            FlockingAgent(
                position=random_position(),
                velocity=random_velocity()
            )
            for _ in range(n_agents)
        ]

    def update(self):
        for agent in self.agents:
            neighbors = self.get_neighbors(agent)

            # Three rules of flocking
            separation = self.separation(agent, neighbors)
            alignment = self.alignment(agent, neighbors)
            cohesion = self.cohesion(agent, neighbors)

            # Combine forces
            agent.velocity += separation + alignment + cohesion
            agent.velocity = self.limit_speed(agent.velocity)
            agent.position += agent.velocity

    def separation(self, agent, neighbors) -> Vector:
        """Avoid crowding neighbors."""
        steer = Vector(0, 0)
        for neighbor in neighbors:
            diff = agent.position - neighbor.position
            dist = diff.magnitude()
            if dist > 0:
                steer += diff.normalize() / dist
        return steer

    def alignment(self, agent, neighbors) -> Vector:
        """Steer towards average heading of neighbors."""
        avg_velocity = sum(n.velocity for n in neighbors) / len(neighbors)
        return (avg_velocity - agent.velocity) * 0.05

    def cohesion(self, agent, neighbors) -> Vector:
        """Steer towards center of neighbors."""
        center = sum(n.position for n in neighbors) / len(neighbors)
        return (center - agent.position) * 0.01
```

---

## LLM Swarm Patterns

### Idea Swarm

```python
class IdeaSwarm:
    """Generate diverse ideas through swarm exploration."""

    async def brainstorm(self, challenge: str, n_agents: int = 10) -> list[str]:
        # Phase 1: Divergent generation
        initial_ideas = await asyncio.gather(*[
            self.generate_idea(challenge, seed=i)
            for i in range(n_agents)
        ])

        # Phase 2: Cross-pollination
        enhanced_ideas = await asyncio.gather(*[
            self.enhance_idea(idea, random.sample(initial_ideas, 3))
            for idea in initial_ideas
        ])

        # Phase 3: Selection (fitness-based)
        scored = await asyncio.gather(*[
            self.score_idea(idea, challenge)
            for idea in enhanced_ideas
        ])

        # Return top ideas
        sorted_ideas = sorted(zip(enhanced_ideas, scored),
                             key=lambda x: x[1], reverse=True)
        return [idea for idea, score in sorted_ideas[:5]]
```

### Solution Swarm

```python
class SolutionSwarm:
    """Solve problems through parallel exploration and synthesis."""

    async def solve(self, problem: str) -> str:
        # Multiple agents attempt solution
        attempts = await asyncio.gather(*[
            self.attempt_solution(problem, approach=i)
            for i in range(5)
        ])

        # Agents critique each other's solutions
        critiques = await asyncio.gather(*[
            self.critique(attempt, problem)
            for attempt in attempts
        ])

        # Synthesize best elements
        synthesis = await self.synthesize(
            problem=problem,
            attempts=attempts,
            critiques=critiques
        )

        return synthesis
```

---

## Advantages

1. **Robustness**: No single point of failure
2. **Scalability**: Add agents easily
3. **Adaptability**: Responds to environmental changes
4. **Exploration**: Covers solution space effectively

## Challenges

1. **Convergence**: May be slow or stuck in local optima
2. **Parameter tuning**: Many hyperparameters to tune
3. **Emergent behavior**: Hard to predict or debug
4. **Communication overhead**: In LLM context, expensive

---

## References

- Dorigo, M., & Stützle, T. (2004). *Ant Colony Optimization*
- Kennedy, J., & Eberhart, R. (1995). *Particle Swarm Optimization*
- Reynolds, C. (1987). *Flocks, Herds, and Schools: A Distributed Behavioral Model*
- Zhuge, M., et al. (2024). *Language Agent Tree Search*
