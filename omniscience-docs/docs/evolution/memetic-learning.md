---
sidebar_position: 4
title: Memetic Learning
description: Cultural knowledge transfer and collective learning between agents
tags: [evolution, memetic, culture, transfer, collective]
---

# Memetic Learning

## Cultural Evolution and Knowledge Transfer Between Agents

Memetic learning applies concepts from cultural evolution to AI agents—ideas, practices, and knowledge spread between agents like memes spread through human populations. This enables collective intelligence that exceeds individual agent capabilities.

## What is Memetic Learning?

```
              Biological vs Memetic Evolution
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Biological (Genetic)              Memetic (Cultural)                   │
│                                                                          │
│   ┌─────────────────────┐          ┌─────────────────────┐              │
│   │ Unit: Gene          │          │ Unit: Meme (idea)   │              │
│   │ Transfer: Vertical  │          │ Transfer: Horizontal│              │
│   │ (parent→child)      │          │ (any agent→any agent)│             │
│   │ Rate: Slow (gen)    │          │ Rate: Fast (instant)│              │
│   │ Fidelity: High      │          │ Fidelity: Variable  │              │
│   └─────────────────────┘          └─────────────────────┘              │
│                                                                          │
│   DNA → Proteins → Traits          Prompts → Behaviors → Performance    │
│   Parent → Child                    Agent → Agent (any direction)        │
│   Generations to spread             Seconds to spread                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Memes in AI Agents

| Meme Type | Description | Example |
|-----------|-------------|---------|
| **Prompt Templates** | Effective prompting patterns | Chain-of-thought instruction |
| **Tool Usage Patterns** | How to use tools effectively | API call sequences |
| **Problem Solving Strategies** | Approaches to tasks | Divide-and-conquer |
| **Error Recovery Patterns** | How to handle failures | Retry with backoff |
| **Communication Styles** | Interaction patterns | Structured output formats |

## Knowledge Transfer Mechanisms

### Direct Transfer

```python
class DirectKnowledgeTransfer:
    """Transfer knowledge directly between agents."""

    async def transfer(
        self,
        source_agent: Agent,
        target_agent: Agent,
        knowledge_type: str
    ) -> TransferResult:
        """Transfer specific knowledge between agents."""

        if knowledge_type == "prompts":
            return await self._transfer_prompts(source_agent, target_agent)
        elif knowledge_type == "examples":
            return await self._transfer_examples(source_agent, target_agent)
        elif knowledge_type == "tool_skills":
            return await self._transfer_tool_skills(source_agent, target_agent)
        elif knowledge_type == "memory":
            return await self._transfer_memory(source_agent, target_agent)

    async def _transfer_prompts(
        self,
        source: Agent,
        target: Agent
    ) -> TransferResult:
        """Transfer effective prompt patterns."""

        # Extract source's successful prompts
        successful_prompts = await source.get_successful_prompts(
            min_success_rate=0.8,
            min_uses=10
        )

        # Adapt prompts for target's context
        adapted_prompts = []
        for prompt in successful_prompts:
            adapted = await self._adapt_prompt(prompt, target.context)
            adapted_prompts.append(adapted)

        # Integrate into target
        await target.integrate_prompts(adapted_prompts)

        return TransferResult(
            transferred_count=len(adapted_prompts),
            types=["prompts"]
        )

    async def _adapt_prompt(self, prompt: str, target_context: Context) -> str:
        """Adapt prompt to new context."""
        return await self.llm.generate(f"""
        Original prompt (from a different agent):
        {prompt}

        Target agent context:
        - Role: {target_context.role}
        - Domain: {target_context.domain}
        - Capabilities: {target_context.capabilities}

        Adapt this prompt for the target agent while preserving its effectiveness.
        """)
```

### Imitation Learning

```python
class ImitationLearner:
    """Learn by observing expert agent behavior."""

    def __init__(self, expert: Agent, learner: Agent):
        self.expert = expert
        self.learner = learner

    async def learn_from_demonstrations(
        self,
        tasks: List[Task],
        learning_rate: float = 0.1
    ) -> LearningResult:
        """Learn from expert demonstrations."""

        demonstrations = []

        # Collect demonstrations
        for task in tasks:
            # Expert performs task
            expert_trace = await self.expert.perform_with_trace(task)
            demonstrations.append(expert_trace)

        # Analyze patterns in expert behavior
        patterns = self._extract_patterns(demonstrations)

        # Update learner based on patterns
        improvements = []
        for pattern in patterns:
            # Test if learner already has this pattern
            learner_has = await self._test_pattern(self.learner, pattern)

            if not learner_has:
                # Integrate pattern into learner
                await self._integrate_pattern(self.learner, pattern)
                improvements.append(pattern)

        return LearningResult(
            demonstrations_observed=len(demonstrations),
            patterns_extracted=len(patterns),
            patterns_integrated=len(improvements)
        )

    def _extract_patterns(self, demonstrations: List[Trace]) -> List[Pattern]:
        """Extract reusable patterns from demonstrations."""

        patterns = []

        # Tool usage patterns
        tool_sequences = self._extract_tool_sequences(demonstrations)
        for seq, frequency in tool_sequences.items():
            if frequency > len(demonstrations) * 0.5:  # Common pattern
                patterns.append(ToolSequencePattern(seq))

        # Reasoning patterns
        reasoning_templates = self._extract_reasoning(demonstrations)
        patterns.extend(reasoning_templates)

        # Error handling patterns
        recovery_patterns = self._extract_recovery(demonstrations)
        patterns.extend(recovery_patterns)

        return patterns

    async def _integrate_pattern(self, learner: Agent, pattern: Pattern):
        """Integrate pattern into learner."""

        if isinstance(pattern, ToolSequencePattern):
            # Add as preferred tool sequence
            learner.tool_preferences.add_sequence(pattern.sequence)

        elif isinstance(pattern, ReasoningPattern):
            # Add to system prompt or examples
            learner.reasoning_examples.append(pattern.template)

        elif isinstance(pattern, RecoveryPattern):
            # Add to error handling
            learner.error_handlers.add(pattern.trigger, pattern.recovery)
```

### Knowledge Distillation

```python
class AgentDistillation:
    """Distill knowledge from expert to student agent."""

    async def distill(
        self,
        teacher: Agent,
        student: Agent,
        training_tasks: List[Task]
    ) -> DistillationResult:
        """Distill teacher knowledge into student."""

        distilled_data = []

        for task in training_tasks:
            # Teacher generates output with explanation
            teacher_output = await teacher.perform_with_explanation(task)

            # Create training example for student
            distilled_data.append({
                "input": task,
                "output": teacher_output.result,
                "reasoning": teacher_output.explanation,
                "confidence": teacher_output.confidence
            })

        # Train student on distilled data
        # Option 1: In-context learning
        student.few_shot_examples.extend(
            self._select_best_examples(distilled_data, k=10)
        )

        # Option 2: Fine-tuning (if supported)
        if student.supports_fine_tuning:
            await student.fine_tune(distilled_data)

        # Option 3: Prompt optimization
        optimized_prompt = await self._optimize_prompt_for_behavior(
            student,
            distilled_data
        )
        student.system_prompt = optimized_prompt

        return DistillationResult(
            examples_created=len(distilled_data),
            student_improvement=await self._measure_improvement(student, training_tasks)
        )
```

## Collective Intelligence

### Shared Memory Systems

```python
class CollectiveMemory:
    """Shared memory system for agent collectives."""

    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.contribution_log = []

    async def contribute(
        self,
        agent_id: str,
        knowledge: Knowledge,
        context: Context
    ) -> ContributionResult:
        """Agent contributes knowledge to collective."""

        # Validate knowledge
        validation = await self._validate_knowledge(knowledge)
        if not validation.valid:
            return ContributionResult(accepted=False, reason=validation.reason)

        # Check for duplicates/conflicts
        existing = await self._find_similar(knowledge)
        if existing:
            # Merge or update
            merged = await self._merge_knowledge(existing, knowledge)
            await self.vector_store.update(existing.id, merged)
        else:
            # Add new
            await self.vector_store.add(knowledge)

        # Log contribution
        self.contribution_log.append({
            "agent_id": agent_id,
            "knowledge_id": knowledge.id,
            "timestamp": datetime.utcnow(),
            "context": context
        })

        return ContributionResult(accepted=True, knowledge_id=knowledge.id)

    async def retrieve(
        self,
        agent_id: str,
        query: str,
        filters: dict = None
    ) -> List[Knowledge]:
        """Agent retrieves knowledge from collective."""

        # Basic retrieval
        results = await self.vector_store.search(query, filters=filters)

        # Filter based on trust/relevance
        filtered = []
        for result in results:
            # Check if this knowledge is appropriate for this agent
            if await self._can_access(agent_id, result):
                filtered.append(result)

        # Log access
        for item in filtered:
            await self._log_access(agent_id, item.id)

        return filtered

    async def _validate_knowledge(self, knowledge: Knowledge) -> ValidationResult:
        """Validate contributed knowledge."""

        checks = []

        # Factual accuracy (if verifiable)
        if knowledge.is_factual:
            accuracy = await self._verify_facts(knowledge)
            checks.append(("accuracy", accuracy))

        # Consistency with existing knowledge
        consistency = await self._check_consistency(knowledge)
        checks.append(("consistency", consistency))

        # Quality score
        quality = await self._assess_quality(knowledge)
        checks.append(("quality", quality))

        return ValidationResult(
            valid=all(score > 0.7 for _, score in checks),
            checks=checks
        )
```

### Agent Networks

```python
class MemeticNetwork:
    """Network for meme propagation between agents."""

    def __init__(self, agents: List[Agent]):
        self.agents = {a.id: a for a in agents}
        self.connections = {}  # agent_id -> list of connected agent_ids
        self.meme_registry = {}  # meme_id -> Meme

    async def propagate_meme(
        self,
        meme: Meme,
        origin: str,
        propagation_strategy: str = "fitness_weighted"
    ) -> PropagationResult:
        """Propagate a meme through the network."""

        # Register meme
        self.meme_registry[meme.id] = meme

        # Track adoption
        adopters = [origin]
        attempted = {origin}

        # Propagation queue
        queue = [origin]

        while queue:
            current = queue.pop(0)
            neighbors = self.connections.get(current, [])

            for neighbor in neighbors:
                if neighbor in attempted:
                    continue
                attempted.add(neighbor)

                # Decide if neighbor adopts
                should_adopt = await self._decide_adoption(
                    meme,
                    self.agents[neighbor],
                    strategy=propagation_strategy
                )

                if should_adopt:
                    # Agent adopts meme
                    await self._adopt_meme(self.agents[neighbor], meme)
                    adopters.append(neighbor)
                    queue.append(neighbor)

        return PropagationResult(
            meme_id=meme.id,
            origin=origin,
            adopters=adopters,
            reach=len(adopters) / len(self.agents)
        )

    async def _decide_adoption(
        self,
        meme: Meme,
        agent: Agent,
        strategy: str
    ) -> bool:
        """Decide if agent should adopt meme."""

        if strategy == "fitness_weighted":
            # Adopt based on meme fitness and agent compatibility
            fitness = meme.fitness_score
            compatibility = await self._calculate_compatibility(agent, meme)
            return random.random() < (fitness * compatibility)

        elif strategy == "trust_based":
            # Adopt based on trust in meme source
            trust = await self._get_trust_score(agent, meme.source)
            return random.random() < trust

        elif strategy == "evidence_based":
            # Adopt based on demonstrated effectiveness
            evidence = await self._test_meme_effectiveness(agent, meme)
            return evidence.improvement > 0.1

        return False
```

## Cultural Dynamics

### Meme Competition and Selection

```python
class MemeEcosystem:
    """Ecosystem where memes compete for adoption."""

    def __init__(self):
        self.active_memes: Dict[str, Meme] = {}
        self.adoption_history: List[AdoptionEvent] = []

    async def introduce_meme(self, meme: Meme) -> Meme:
        """Introduce new meme to ecosystem."""

        # Check for competing memes
        competitors = self._find_competitors(meme)

        if competitors:
            # Meme must compete
            for competitor in competitors:
                result = await self._compete(meme, competitor)
                if result.winner == competitor:
                    # Meme loses, may be modified
                    meme = result.loser_modified
                elif result.merged:
                    # Memes merge
                    meme = result.merged_meme

        self.active_memes[meme.id] = meme
        return meme

    async def _compete(self, meme1: Meme, meme2: Meme) -> CompetitionResult:
        """Two memes compete for adoption."""

        # Test both on sample agents
        test_agents = random.sample(list(self.agents.values()), 10)

        meme1_performance = []
        meme2_performance = []

        for agent in test_agents:
            # Test each meme
            p1 = await self._test_meme(agent, meme1)
            p2 = await self._test_meme(agent, meme2)

            meme1_performance.append(p1)
            meme2_performance.append(p2)

        # Determine winner
        avg1 = np.mean(meme1_performance)
        avg2 = np.mean(meme2_performance)

        if abs(avg1 - avg2) < 0.1:
            # Similar performance - merge
            merged = await self._merge_memes(meme1, meme2)
            return CompetitionResult(merged=True, merged_meme=merged)
        elif avg1 > avg2:
            return CompetitionResult(winner=meme1, loser=meme2)
        else:
            return CompetitionResult(winner=meme2, loser=meme1)

    def _find_competitors(self, meme: Meme) -> List[Meme]:
        """Find memes that compete with the given meme."""
        competitors = []
        for existing in self.active_memes.values():
            if self._are_competitors(meme, existing):
                competitors.append(existing)
        return competitors

    def _are_competitors(self, m1: Meme, m2: Meme) -> bool:
        """Check if two memes compete (solve same problem differently)."""
        return (
            m1.problem_domain == m2.problem_domain and
            m1.approach != m2.approach
        )
```

### Cultural Drift and Specialization

```python
class CulturalDynamics:
    """Track cultural evolution in agent populations."""

    def __init__(self, population: List[Agent]):
        self.population = population
        self.cultural_snapshots = []

    async def measure_cultural_state(self) -> CulturalSnapshot:
        """Capture current cultural state of population."""

        # Extract memes from each agent
        agent_memes = {}
        for agent in self.population:
            memes = await self._extract_agent_memes(agent)
            agent_memes[agent.id] = memes

        # Calculate cultural metrics
        snapshot = CulturalSnapshot(
            timestamp=datetime.utcnow(),
            diversity=self._calculate_diversity(agent_memes),
            clusters=self._identify_cultural_clusters(agent_memes),
            dominant_memes=self._find_dominant_memes(agent_memes),
            extinction_risk=self._identify_endangered_memes(agent_memes)
        )

        self.cultural_snapshots.append(snapshot)
        return snapshot

    def _calculate_diversity(self, agent_memes: Dict[str, List[Meme]]) -> float:
        """Calculate cultural diversity (0-1)."""
        # Shannon diversity index
        all_memes = []
        for memes in agent_memes.values():
            all_memes.extend([m.id for m in memes])

        meme_counts = Counter(all_memes)
        total = len(all_memes)

        diversity = 0
        for count in meme_counts.values():
            p = count / total
            diversity -= p * np.log(p)

        # Normalize
        max_diversity = np.log(len(meme_counts))
        return diversity / max_diversity if max_diversity > 0 else 0

    def _identify_cultural_clusters(
        self,
        agent_memes: Dict[str, List[Meme]]
    ) -> List[CulturalCluster]:
        """Identify subcultures in the population."""

        # Build agent similarity matrix
        agent_ids = list(agent_memes.keys())
        n = len(agent_ids)
        similarity = np.zeros((n, n))

        for i in range(n):
            for j in range(i+1, n):
                sim = self._meme_similarity(
                    agent_memes[agent_ids[i]],
                    agent_memes[agent_ids[j]]
                )
                similarity[i,j] = similarity[j,i] = sim

        # Cluster
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=0.5
        )
        labels = clustering.fit_predict(1 - similarity)

        # Create cluster objects
        clusters = []
        for label in set(labels):
            members = [agent_ids[i] for i in range(n) if labels[i] == label]
            clusters.append(CulturalCluster(
                id=label,
                members=members,
                characteristic_memes=self._find_characteristic_memes(
                    [agent_memes[m] for m in members]
                )
            ))

        return clusters
```

## Research Foundations

- **Memetic Algorithms** (Moscato, 1989) - Combining genetic and local search
- **Cultural Evolution** (Boyd & Richerson, 1985) - Human cultural transmission
- **Knowledge Distillation** (Hinton et al., 2015) - Transferring neural network knowledge
- **Multi-Agent Learning** (Stone & Veloso, 2000) - Learning in multi-agent systems

---

## See Also

- [Swarm Intelligence](../orchestration/swarm-intelligence.md) - Collective behavior
- [Memory Systems](../architecture/memory-systems.md) - Knowledge storage
- [Consensus Protocols](../orchestration/consensus-protocols.md) - Agreement mechanisms
