---
sidebar_position: 2
title: Memory Systems
description: Information storage and retrieval for agents
tags: [architecture, memory, rag, context]
---

# Memory Systems

## Information Storage and Retrieval for Agents

Effective agents need memory—the ability to store, organize, and retrieve information across different timescales. Memory transforms stateless functions into intelligent systems that learn and adapt.

---

## Memory Types

```
┌─────────────────────────────────────────────────────────────┐
│                     MEMORY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ WORKING MEMORY  │  │ EPISODIC MEMORY │                   │
│  │                 │  │                 │                   │
│  │ Current context │  │ Past experiences│                   │
│  │ Active thoughts │  │ Specific events │                   │
│  │ ~seconds        │  │ ~days to years  │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           └──────────┬─────────┘                             │
│                      │                                       │
│  ┌─────────────────┐ │ ┌─────────────────┐                  │
│  │ SEMANTIC MEMORY │ │ │PROCEDURAL MEMORY│                  │
│  │                 │◀┴▶│                 │                  │
│  │ Facts, concepts │   │ Skills, habits  │                  │
│  │ General knowledge│   │ How-to knowledge│                  │
│  │ ~permanent      │   │ ~permanent      │                  │
│  └─────────────────┘   └─────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Working Memory

The active context for current reasoning. In LLM agents, this maps to the **context window**.

### Implementation

```python
class WorkingMemory:
    def __init__(self, max_tokens: int = 8000):
        self.max_tokens = max_tokens
        self.messages: list[Message] = []
        self.scratchpad: dict = {}

    def add_message(self, role: str, content: str):
        self.messages.append(Message(role=role, content=content))
        self._enforce_limit()

    def _enforce_limit(self):
        """Summarize or truncate when exceeding limit."""
        while self._count_tokens() > self.max_tokens:
            # Strategy 1: Remove oldest
            self.messages.pop(0)
            # Strategy 2: Summarize oldest
            # Strategy 3: Move to long-term memory
```

### Context Management Strategies

| Strategy | Description | Trade-off |
|----------|-------------|-----------|
| **Sliding Window** | Keep last N tokens | Loses old context |
| **Summarization** | Compress old messages | Lossy |
| **Hierarchical** | Summary + recent detail | Complex |
| **Retrieval-Augmented** | Fetch relevant history | Latency |

---

## Episodic Memory

Stores specific past experiences with temporal context.

### Implementation

```python
from datetime import datetime
from dataclasses import dataclass

@dataclass
class Episode:
    timestamp: datetime
    context: str
    action: str
    outcome: str
    embedding: list[float]
    importance: float

class EpisodicMemory:
    def __init__(self, vector_store):
        self.store = vector_store

    def remember(self, episode: Episode):
        """Store a new experience."""
        self.store.add(
            id=str(episode.timestamp),
            vector=episode.embedding,
            metadata={
                "context": episode.context,
                "action": episode.action,
                "outcome": episode.outcome,
                "importance": episode.importance
            }
        )

    def recall(self, query: str, k: int = 5) -> list[Episode]:
        """Retrieve similar past experiences."""
        query_embedding = embed(query)
        results = self.store.search(query_embedding, k=k)
        return [self._to_episode(r) for r in results]
```

### Importance Scoring

Not all memories are equal:

```python
def compute_importance(episode: Episode) -> float:
    """Score memory importance for retention."""
    factors = {
        "recency": recency_score(episode.timestamp),
        "frequency": access_count(episode) / total_accesses,
        "emotional": sentiment_intensity(episode.outcome),
        "novelty": 1.0 - max_similarity_to_existing(episode),
        "relevance": task_relevance_score(episode)
    }
    return weighted_average(factors)
```

---

## Semantic Memory

General knowledge and facts about the world.

### Implementation with Knowledge Graphs

```python
class SemanticMemory:
    def __init__(self):
        self.knowledge_graph = nx.DiGraph()

    def add_fact(self, subject: str, predicate: str, object: str):
        """Store a fact as a graph triple."""
        self.knowledge_graph.add_edge(
            subject, object,
            relation=predicate
        )

    def query(self, question: str) -> list[str]:
        """Retrieve relevant facts."""
        # Parse question to graph query
        entities = extract_entities(question)
        relations = extract_relations(question)

        # Traverse graph
        results = []
        for entity in entities:
            neighbors = self.knowledge_graph.neighbors(entity)
            for neighbor in neighbors:
                edge = self.knowledge_graph[entity][neighbor]
                results.append(f"{entity} {edge['relation']} {neighbor}")

        return results
```

### Vector-Based Semantic Memory

```python
class VectorSemanticMemory:
    def __init__(self, embedding_model, vector_store):
        self.embedder = embedding_model
        self.store = vector_store

    def store_knowledge(self, text: str, source: str):
        # Chunk text for better retrieval
        chunks = chunk_text(text, max_size=512)

        for chunk in chunks:
            embedding = self.embedder.embed(chunk)
            self.store.add(
                vector=embedding,
                metadata={"text": chunk, "source": source}
            )

    def retrieve(self, query: str, k: int = 5) -> list[str]:
        query_embedding = self.embedder.embed(query)
        results = self.store.search(query_embedding, k=k)
        return [r.metadata["text"] for r in results]
```

---

## Procedural Memory

Skills and procedures—"how-to" knowledge.

### Tool Libraries

```python
class ProceduralMemory:
    def __init__(self):
        self.procedures: dict[str, Procedure] = {}

    def register_procedure(self, name: str, procedure: Callable,
                           description: str, examples: list[str]):
        self.procedures[name] = Procedure(
            name=name,
            execute=procedure,
            description=description,
            examples=examples
        )

    def find_procedure(self, task_description: str) -> Procedure | None:
        """Find applicable procedure for a task."""
        # Embed task and match against procedure descriptions
        task_embedding = embed(task_description)
        best_match = None
        best_score = 0

        for proc in self.procedures.values():
            score = cosine_similarity(
                task_embedding,
                embed(proc.description)
            )
            if score > best_score:
                best_score = score
                best_match = proc

        return best_match if best_score > 0.7 else None
```

### Learned Procedures

```python
class LearnedProcedureMemory:
    def __init__(self, llm):
        self.llm = llm
        self.successful_traces: list[Trace] = []

    def learn_from_success(self, trace: Trace):
        """Extract procedure from successful execution."""
        self.successful_traces.append(trace)

    def synthesize_procedure(self, task_type: str) -> str:
        """Generate reusable procedure from examples."""
        relevant_traces = [t for t in self.successful_traces
                         if t.task_type == task_type]

        prompt = f"""
        Analyze these successful task executions and extract
        a general procedure:

        {format_traces(relevant_traces)}

        Generate a step-by-step procedure that can be reused.
        """

        return self.llm.generate(prompt)
```

---

## RAG (Retrieval-Augmented Generation)

The dominant pattern for LLM memory:

```python
class RAGMemory:
    def __init__(self, embedder, vector_store, llm):
        self.embedder = embedder
        self.store = vector_store
        self.llm = llm

    def query(self, user_question: str) -> str:
        # 1. Retrieve relevant context
        query_embedding = self.embedder.embed(user_question)
        relevant_docs = self.store.search(query_embedding, k=5)

        # 2. Construct augmented prompt
        context = "\n\n".join([doc.text for doc in relevant_docs])

        prompt = f"""
        Use the following context to answer the question.

        Context:
        {context}

        Question: {user_question}

        Answer:
        """

        # 3. Generate with context
        return self.llm.generate(prompt)
```

### Advanced RAG Patterns

```
┌─────────────────────────────────────────────────────┐
│                    RAG PATTERNS                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Naive RAG          Advanced RAG       Modular RAG  │
│  ┌─────────┐       ┌─────────────┐    ┌──────────┐  │
│  │ Embed   │       │Query Rewrite│    │ Router   │  │
│  │ Retrieve│       │Multi-Query  │    │ ↓        │  │
│  │ Generate│       │Re-Ranking   │    │ Module 1 │  │
│  └─────────┘       │Self-Query   │    │ Module 2 │  │
│                    └─────────────┘    │ Module N │  │
│                                       └──────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Memory Consolidation

Moving information between memory types:

```python
class MemoryConsolidator:
    def __init__(self, working, episodic, semantic):
        self.working = working
        self.episodic = episodic
        self.semantic = semantic

    def consolidate(self):
        """Periodic memory consolidation (like sleep)."""
        # 1. Important working memory → episodic
        for item in self.working.get_important_items():
            self.episodic.remember(item)

        # 2. Repeated episodic patterns → semantic
        patterns = self.episodic.find_recurring_patterns()
        for pattern in patterns:
            fact = self.abstract_to_fact(pattern)
            self.semantic.add_fact(fact)

        # 3. Clear working memory
        self.working.clear()
```

---

## Challenges

### 1. Retrieval Quality
Finding the right information at the right time.

### 2. Staleness
Knowledge can become outdated.

### 3. Consistency
Preventing contradictory memories.

### 4. Privacy
Handling sensitive information appropriately.

### 5. Scalability
Managing growing memory stores efficiently.

---

## References

- Lewis, P., et al. (2020). *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*
- Park, J. S., et al. (2023). *Generative Agents: Interactive Simulacra of Human Behavior*
- Gao, Y., et al. (2024). *Retrieval-Augmented Generation for Large Language Models: A Survey*
