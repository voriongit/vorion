---
sidebar_position: 3
title: Evolutionary Optimization
description: Population-based methods for optimizing agent configurations
tags: [evolution, optimization, genetic-algorithms, nes, dspy]
---

# Evolutionary Optimization

## Population-Based Agent Improvement

Evolutionary optimization applies principles from biological evolution—selection, mutation, and crossover—to improve agent configurations. These gradient-free methods excel when the optimization landscape is complex, non-differentiable, or poorly understood.

## Why Evolutionary Methods?

```
                Gradient vs Evolutionary Optimization
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   Gradient-Based                         Evolutionary                      │
│                                                                            │
│   ┌─────────────────────────┐           ┌─────────────────────────┐       │
│   │ • Requires differentiable│           │ • Works with any objective│      │
│   │   objective              │           │   (even human preference) │      │
│   │ • Single solution path   │           │ • Explores many solutions │      │
│   │ • Fast for smooth loss   │           │ • Handles discrete choices│      │
│   │ • Can get stuck in local │           │ • Naturally parallel     │      │
│   │   minima                 │           │ • Good for exploration   │      │
│   └─────────────────────────┘           └─────────────────────────┘       │
│                                                                            │
│   Best for:                              Best for:                         │
│   • Neural network weights               • Prompt optimization             │
│   • Continuous parameters                • Architecture search             │
│   • Well-understood losses               • Tool selection                  │
│                                          • Hyperparameters                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### The Evolution Loop

```python
class EvolutionaryOptimizer:
    """Base evolutionary optimization framework."""

    def __init__(self, config: EvolutionConfig):
        self.population_size = config.population_size
        self.generations = config.generations
        self.mutation_rate = config.mutation_rate
        self.crossover_rate = config.crossover_rate
        self.selection_pressure = config.selection_pressure

    def optimize(
        self,
        initial_population: List[Agent],
        fitness_function: Callable[[Agent], float],
        constraints: Constraints
    ) -> Agent:
        """Main evolution loop."""

        population = initial_population

        for generation in range(self.generations):
            # 1. Evaluate fitness
            fitness_scores = [fitness_function(agent) for agent in population]

            # 2. Selection
            parents = self._select_parents(population, fitness_scores)

            # 3. Crossover
            offspring = self._crossover(parents)

            # 4. Mutation
            mutated = self._mutate(offspring)

            # 5. Constraint enforcement
            valid = [a for a in mutated if constraints.satisfied(a)]

            # 6. Survival selection
            population = self._select_survivors(
                population + valid,
                [fitness_function(a) for a in population + valid]
            )

            # Log progress
            best_fitness = max(fitness_scores)
            self._log_generation(generation, best_fitness, population)

        # Return best agent
        final_scores = [fitness_function(a) for a in population]
        return population[final_scores.index(max(final_scores))]
```

### Selection Methods

```python
class SelectionMethods:
    """Methods for selecting parents."""

    @staticmethod
    def tournament_selection(
        population: List[Agent],
        fitness: List[float],
        tournament_size: int = 3
    ) -> List[Agent]:
        """Tournament selection."""
        selected = []
        for _ in range(len(population)):
            tournament_idx = random.sample(range(len(population)), tournament_size)
            tournament_fitness = [fitness[i] for i in tournament_idx]
            winner_idx = tournament_idx[tournament_fitness.index(max(tournament_fitness))]
            selected.append(population[winner_idx])
        return selected

    @staticmethod
    def roulette_selection(
        population: List[Agent],
        fitness: List[float]
    ) -> List[Agent]:
        """Fitness-proportionate selection."""
        total_fitness = sum(fitness)
        probabilities = [f / total_fitness for f in fitness]

        selected = []
        for _ in range(len(population)):
            r = random.random()
            cumulative = 0
            for i, prob in enumerate(probabilities):
                cumulative += prob
                if r <= cumulative:
                    selected.append(population[i])
                    break
        return selected

    @staticmethod
    def rank_selection(
        population: List[Agent],
        fitness: List[float],
        selection_pressure: float = 2.0
    ) -> List[Agent]:
        """Rank-based selection (less sensitive to fitness scaling)."""
        n = len(population)
        ranked_indices = sorted(range(n), key=lambda i: fitness[i])

        # Linear ranking
        probabilities = []
        for rank in range(n):
            prob = (2 - selection_pressure + 2 * (selection_pressure - 1) * rank / (n - 1)) / n
            probabilities.append(prob)

        # Reorder to match original population
        final_probs = [0] * n
        for rank, idx in enumerate(ranked_indices):
            final_probs[idx] = probabilities[rank]

        return random.choices(population, weights=final_probs, k=n)
```

## Prompt Evolution

### DSPy-Style Optimization

```python
class PromptEvolver:
    """Evolve prompts using evolutionary strategies."""

    def __init__(self, base_prompt: str, evaluator: PromptEvaluator):
        self.base_prompt = base_prompt
        self.evaluator = evaluator

    async def evolve(
        self,
        train_data: List[Example],
        generations: int = 10,
        population_size: int = 20
    ) -> str:
        """Evolve prompt to maximize performance."""

        # Initialize population with variations
        population = [self.base_prompt]
        population.extend([
            self._mutate_prompt(self.base_prompt)
            for _ in range(population_size - 1)
        ])

        for gen in range(generations):
            # Evaluate each prompt
            scores = []
            for prompt in population:
                score = await self._evaluate_prompt(prompt, train_data)
                scores.append(score)

            # Select top performers
            sorted_pairs = sorted(zip(scores, population), reverse=True)
            elite = [p for _, p in sorted_pairs[:population_size // 4]]

            # Generate new population
            new_population = elite.copy()

            while len(new_population) < population_size:
                if random.random() < 0.7:  # Crossover
                    p1, p2 = random.sample(elite, 2)
                    child = self._crossover_prompts(p1, p2)
                else:  # Mutation
                    parent = random.choice(elite)
                    child = self._mutate_prompt(parent)

                new_population.append(child)

            population = new_population

        # Return best prompt
        final_scores = [await self._evaluate_prompt(p, train_data) for p in population]
        return population[final_scores.index(max(final_scores))]

    def _mutate_prompt(self, prompt: str) -> str:
        """Apply mutation to prompt."""
        mutations = [
            self._paraphrase_section,
            self._add_constraint,
            self._remove_sentence,
            self._reorder_instructions,
            self._add_example,
            self._change_tone,
        ]

        mutation = random.choice(mutations)
        return mutation(prompt)

    def _crossover_prompts(self, p1: str, p2: str) -> str:
        """Combine two prompts."""
        # Section-based crossover
        sections1 = self._parse_sections(p1)
        sections2 = self._parse_sections(p2)

        combined = {}
        for key in set(sections1.keys()) | set(sections2.keys()):
            if key in sections1 and key in sections2:
                combined[key] = random.choice([sections1[key], sections2[key]])
            else:
                combined[key] = sections1.get(key, sections2.get(key))

        return self._reconstruct_prompt(combined)
```

### LLM-Assisted Mutation

```python
class LLMMutator:
    """Use LLM to generate intelligent mutations."""

    def __init__(self, llm: LLM):
        self.llm = llm

    async def mutate_prompt(
        self,
        prompt: str,
        performance_feedback: str,
        mutation_type: str = "improve"
    ) -> str:
        """Use LLM to generate improved prompt."""

        mutation_instruction = {
            "improve": "Make this prompt more effective based on the feedback",
            "simplify": "Simplify this prompt while maintaining effectiveness",
            "add_examples": "Add helpful examples to this prompt",
            "clarify": "Make the instructions clearer and more specific",
            "constrain": "Add constraints to prevent common errors",
        }[mutation_type]

        response = await self.llm.generate(f"""
        Current prompt:
        {prompt}

        Performance feedback:
        {performance_feedback}

        Task: {mutation_instruction}

        Generate an improved version of the prompt. Only output the new prompt,
        no explanation.
        """)

        return response.strip()
```

## Agent Architecture Evolution

### Neural Architecture Search for Agents

```python
class AgentArchitectureEvolver:
    """Evolve agent architecture configurations."""

    def __init__(self):
        self.search_space = {
            "memory_type": ["buffer", "summary", "vector", "graph"],
            "planning_depth": [1, 2, 3, 5, 10],
            "reasoning_method": ["direct", "chain_of_thought", "tree_of_thoughts", "react"],
            "tool_selection": ["all", "relevant_subset", "learned"],
            "context_window": [4096, 8192, 16384, 32768],
            "temperature": [0.0, 0.3, 0.5, 0.7, 1.0],
            "retry_strategy": ["none", "simple", "exponential", "adaptive"],
        }

    def evolve_architecture(
        self,
        task_benchmark: Benchmark,
        generations: int = 20,
        population_size: int = 50
    ) -> AgentArchitecture:
        """Evolve optimal architecture for benchmark."""

        # Initialize random population
        population = [self._random_architecture() for _ in range(population_size)]

        for gen in range(generations):
            # Evaluate architectures
            scores = []
            for arch in population:
                agent = self._build_agent(arch)
                score = task_benchmark.evaluate(agent)
                scores.append(score)

            # Evolution step
            population = self._evolution_step(population, scores)

            # Log best architecture
            best_idx = scores.index(max(scores))
            print(f"Gen {gen}: Best score {scores[best_idx]}")
            print(f"  Architecture: {population[best_idx]}")

        return population[scores.index(max(scores))]

    def _random_architecture(self) -> AgentArchitecture:
        """Generate random architecture from search space."""
        return AgentArchitecture(
            **{k: random.choice(v) for k, v in self.search_space.items()}
        )

    def _mutate_architecture(self, arch: AgentArchitecture) -> AgentArchitecture:
        """Mutate one aspect of architecture."""
        params = arch.to_dict()
        key_to_mutate = random.choice(list(self.search_space.keys()))
        params[key_to_mutate] = random.choice(self.search_space[key_to_mutate])
        return AgentArchitecture(**params)
```

## Evolution Strategies

### CMA-ES for Continuous Parameters

```python
import cma

class CMAESOptimizer:
    """Covariance Matrix Adaptation Evolution Strategy."""

    def __init__(self, initial_params: np.ndarray, sigma: float = 0.5):
        self.es = cma.CMAEvolutionStrategy(
            initial_params,
            sigma,
            {'popsize': 20}
        )

    def optimize(
        self,
        fitness_function: Callable[[np.ndarray], float],
        max_iterations: int = 100
    ) -> np.ndarray:
        """Optimize parameters using CMA-ES."""

        while not self.es.stop() and self.es.countiter < max_iterations:
            # Get candidate solutions
            solutions = self.es.ask()

            # Evaluate fitness (negative because CMA-ES minimizes)
            fitness_values = [-fitness_function(s) for s in solutions]

            # Update distribution
            self.es.tell(solutions, fitness_values)

            # Log progress
            self.es.disp()

        return self.es.result.xbest


# Usage for agent hyperparameters
def optimize_agent_params(benchmark: Benchmark) -> dict:
    """Optimize continuous agent parameters."""

    param_names = ["temperature", "top_p", "max_tokens_ratio", "context_ratio"]
    initial = np.array([0.5, 0.9, 0.5, 0.5])  # Normalized parameters

    def fitness(params: np.ndarray) -> float:
        # Denormalize
        config = {
            "temperature": params[0] * 2,
            "top_p": params[1],
            "max_tokens": int(params[2] * 2000),
            "context_size": int(params[3] * 16000)
        }
        agent = build_agent(config)
        return benchmark.evaluate(agent)

    optimizer = CMAESOptimizer(initial)
    best_params = optimizer.optimize(fitness)

    return {name: val for name, val in zip(param_names, best_params)}
```

### Natural Evolution Strategies (NES)

```python
class NESOptimizer:
    """Natural Evolution Strategies optimizer."""

    def __init__(
        self,
        num_params: int,
        learning_rate: float = 0.01,
        noise_std: float = 0.1,
        population_size: int = 50
    ):
        self.num_params = num_params
        self.lr = learning_rate
        self.sigma = noise_std
        self.pop_size = population_size
        self.params = np.zeros(num_params)

    def optimize_step(
        self,
        fitness_function: Callable[[np.ndarray], float]
    ) -> float:
        """One step of NES optimization."""

        # Sample noise
        noise = np.random.randn(self.pop_size, self.num_params)

        # Evaluate fitness with positive and negative perturbations
        fitness_plus = np.array([
            fitness_function(self.params + self.sigma * n)
            for n in noise
        ])
        fitness_minus = np.array([
            fitness_function(self.params - self.sigma * n)
            for n in noise
        ])

        # Compute gradient estimate
        gradient = np.zeros(self.num_params)
        for i in range(self.pop_size):
            gradient += (fitness_plus[i] - fitness_minus[i]) * noise[i]
        gradient /= (2 * self.pop_size * self.sigma)

        # Update parameters
        self.params += self.lr * gradient

        return np.mean(fitness_plus)
```

## Multi-Objective Optimization

### Pareto Evolution

```python
class MultiObjectiveEvolver:
    """Evolve agents with multiple objectives."""

    def __init__(self, objectives: List[str]):
        self.objectives = objectives

    def evolve(
        self,
        initial_population: List[Agent],
        fitness_functions: Dict[str, Callable],
        generations: int
    ) -> List[Agent]:
        """NSGA-II style multi-objective evolution."""

        population = initial_population

        for gen in range(generations):
            # Evaluate all objectives
            objective_scores = {}
            for obj_name in self.objectives:
                objective_scores[obj_name] = [
                    fitness_functions[obj_name](agent)
                    for agent in population
                ]

            # Non-dominated sorting
            fronts = self._fast_non_dominated_sort(population, objective_scores)

            # Crowding distance
            for front in fronts:
                self._assign_crowding_distance(front, objective_scores)

            # Selection
            parents = self._select_parents_nsga(population, fronts)

            # Generate offspring
            offspring = []
            for i in range(0, len(parents), 2):
                if i + 1 < len(parents):
                    child1, child2 = self._crossover(parents[i], parents[i+1])
                    offspring.extend([self._mutate(child1), self._mutate(child2)])

            # Combine and select next generation
            combined = population + offspring
            population = self._select_next_generation(combined, fronts)

        # Return Pareto front
        return fronts[0]

    def _fast_non_dominated_sort(
        self,
        population: List[Agent],
        scores: Dict[str, List[float]]
    ) -> List[List[Agent]]:
        """Sort population into non-dominated fronts."""
        # Implementation of NSGA-II fast non-dominated sort
        # Returns list of fronts, where fronts[0] is Pareto-optimal
        pass

    def _assign_crowding_distance(
        self,
        front: List[Agent],
        scores: Dict[str, List[float]]
    ):
        """Assign crowding distance for diversity preservation."""
        pass
```

## Fitness Functions

### Composite Fitness

```python
class FitnessEvaluator:
    """Evaluate agent fitness across multiple criteria."""

    def __init__(self, weights: Dict[str, float]):
        self.weights = weights

    async def evaluate(
        self,
        agent: Agent,
        benchmark: Benchmark
    ) -> float:
        """Compute weighted fitness score."""

        scores = {}

        # Task performance
        if "task_success" in self.weights:
            scores["task_success"] = await benchmark.evaluate_success(agent)

        # Efficiency
        if "efficiency" in self.weights:
            scores["efficiency"] = await self._evaluate_efficiency(agent, benchmark)

        # Consistency
        if "consistency" in self.weights:
            scores["consistency"] = await self._evaluate_consistency(agent, benchmark)

        # Safety
        if "safety" in self.weights:
            scores["safety"] = await self._evaluate_safety(agent)

        # Compute weighted sum
        total = sum(scores[k] * self.weights[k] for k in scores)
        return total

    async def _evaluate_efficiency(self, agent: Agent, benchmark: Benchmark) -> float:
        """Measure token/time efficiency."""
        results = await benchmark.run(agent)
        avg_tokens = np.mean([r.tokens_used for r in results])
        avg_time = np.mean([r.time_taken for r in results])

        # Normalize (lower is better, convert to higher is better)
        token_score = 1 / (1 + avg_tokens / 1000)
        time_score = 1 / (1 + avg_time / 10)

        return (token_score + time_score) / 2
```

## Research Foundations

- **EvoPrompt** (Guo et al., 2023) - Evolutionary prompt optimization
- **DSPy** (Khattab et al., 2023) - Programmatic LLM optimization
- **AutoML** (Hutter et al., 2019) - Automated machine learning
- **NSGA-II** (Deb et al., 2002) - Multi-objective genetic algorithm
- **CMA-ES** (Hansen, 2016) - Covariance matrix adaptation

---

## See Also

- [Seeding & Initialization](./seeding-initialization.md) - Starting population
- [Self-Improvement](./self-improvement.md) - Agents improving themselves
- [Learning Agents](../taxonomy/learning-agents.md) - Agent learning fundamentals
