---
sidebar_position: 5
title: Neuro-Symbolic Systems
description: Combining neural networks with symbolic reasoning
tags: [architecture, hybrid, knowledge-graphs, reasoning]
---

# Neuro-Symbolic Systems

## Combining Neural Networks with Symbolic Reasoning

Neuro-symbolic AI bridges two paradigms: the pattern recognition of neural networks and the logical precision of symbolic systems. This hybrid approach aims to capture the best of both worlds.

---

## The Two Paradigms

```
┌─────────────────────────────────────────────────────────────┐
│                    NEURAL vs SYMBOLIC                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   NEURAL (System 1)              SYMBOLIC (System 2)        │
│   ┌─────────────────┐            ┌─────────────────┐        │
│   │ Pattern matching│            │ Logical inference│        │
│   │ Learned weights │            │ Explicit rules   │        │
│   │ Fuzzy, robust   │            │ Precise, brittle │        │
│   │ Fast intuition  │            │ Slow reasoning   │        │
│   │ Data-hungry     │            │ Data-efficient   │        │
│   │ Opaque          │            │ Transparent      │        │
│   └─────────────────┘            └─────────────────┘        │
│                                                              │
│                    NEURO-SYMBOLIC                            │
│                   ┌─────────────┐                            │
│                   │   HYBRID    │                            │
│                   │  Best of    │                            │
│                   │   both      │                            │
│                   └─────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Patterns

### Pattern 1: Neural → Symbolic

Neural perception feeds symbolic reasoning:

```python
class NeuralToSymbolic:
    def __init__(self, perception_model, knowledge_base, reasoner):
        self.perceiver = perception_model  # Neural
        self.kb = knowledge_base           # Symbolic
        self.reasoner = reasoner           # Symbolic

    def process(self, raw_input):
        # 1. Neural: Extract symbols from raw input
        entities = self.perceiver.extract_entities(raw_input)
        relations = self.perceiver.extract_relations(raw_input)

        # 2. Ground to knowledge base
        grounded = self.kb.ground(entities, relations)

        # 3. Symbolic: Reason over grounded symbols
        conclusions = self.reasoner.infer(grounded)

        return conclusions
```

**Example**: Image → object detection → scene graph → spatial reasoning

### Pattern 2: Symbolic → Neural

Symbolic knowledge guides neural processing:

```python
class SymbolicToNeural:
    def __init__(self, rules, neural_model):
        self.rules = rules          # Symbolic constraints
        self.model = neural_model

    def generate(self, prompt: str) -> str:
        # 1. Neural generates candidates
        candidates = self.model.generate(prompt, num_samples=10)

        # 2. Symbolic filters by rules
        valid = [c for c in candidates
                 if self.rules.satisfies_all(c)]

        # 3. Return best valid candidate
        return self.model.rank(valid)[0]
```

**Example**: Grammar rules → constrained text generation

### Pattern 3: Tight Integration

Neural and symbolic operate in unified framework:

```python
class IntegratedNeuroSymbolic:
    def __init__(self, neural_modules, symbolic_modules):
        self.neural = neural_modules
        self.symbolic = symbolic_modules
        self.interface = SymbolGrounder()

    def forward(self, input_data):
        # Interleaved processing
        x = input_data

        for layer in self.layers:
            if layer.type == "neural":
                x = layer.forward(x)
            elif layer.type == "symbolic":
                # Convert to symbols
                symbols = self.interface.to_symbols(x)
                # Apply symbolic operations
                result = layer.process(symbols)
                # Convert back
                x = self.interface.to_vectors(result)

        return x
```

---

## Knowledge Graph Integration

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                KNOWLEDGE-GROUNDED LLM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Query                                                 │
│       │                                                      │
│       ▼                                                      │
│   ┌───────────────┐    ┌───────────────┐                    │
│   │  LLM: Entity  │───▶│ Knowledge     │                    │
│   │  Extraction   │    │ Graph Query   │                    │
│   └───────────────┘    └───────┬───────┘                    │
│                                │                             │
│                                ▼                             │
│                        ┌───────────────┐                    │
│                        │   Subgraph    │                    │
│                        │   Retrieval   │                    │
│                        └───────┬───────┘                    │
│                                │                             │
│                                ▼                             │
│   ┌───────────────────────────────────────────┐             │
│   │  LLM: Generate answer grounded in KG      │             │
│   └───────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
class KnowledgeGraphLLM:
    def __init__(self, llm, kg):
        self.llm = llm
        self.kg = kg

    def answer(self, question: str) -> str:
        # 1. Extract entities from question
        entities = self.llm.generate(f"""
            Extract entities from this question:
            {question}

            Output as JSON list: ["entity1", "entity2", ...]
        """)

        # 2. Query knowledge graph
        subgraph = self.kg.get_neighborhood(
            entities=json.loads(entities),
            hops=2
        )

        # 3. Format graph as context
        context = self._format_triples(subgraph)

        # 4. Generate grounded answer
        response = self.llm.generate(f"""
            Use this knowledge to answer the question.

            Knowledge:
            {context}

            Question: {question}

            Answer (cite facts from knowledge):
        """)

        return response

    def _format_triples(self, subgraph) -> str:
        return "\n".join(
            f"- {s} → {p} → {o}"
            for s, p, o in subgraph.triples()
        )
```

---

## Constrained Decoding

Force neural outputs to satisfy symbolic constraints:

```python
class ConstrainedDecoder:
    def __init__(self, llm, grammar):
        self.llm = llm
        self.grammar = grammar  # e.g., CFG for valid outputs

    def generate(self, prompt: str) -> str:
        tokens = []
        state = self.grammar.initial_state()

        while not self.grammar.is_terminal(state):
            # Get LLM's next token distribution
            logits = self.llm.get_logits(prompt + "".join(tokens))

            # Mask invalid tokens per grammar
            valid_tokens = self.grammar.valid_next(state)
            masked_logits = self._mask(logits, valid_tokens)

            # Sample from constrained distribution
            next_token = sample(masked_logits)
            tokens.append(next_token)

            # Update grammar state
            state = self.grammar.transition(state, next_token)

        return "".join(tokens)
```

### Use Cases

- **SQL generation**: Syntactically valid queries
- **Code generation**: Parseable, type-correct code
- **API calls**: Valid JSON with required fields
- **Structured data**: Schema-compliant outputs

---

## Differentiable Reasoning

Make symbolic operations differentiable for end-to-end training:

```python
class DifferentiableLogic:
    """Fuzzy logic operations that support gradients."""

    @staticmethod
    def AND(a: Tensor, b: Tensor) -> Tensor:
        return a * b  # Product t-norm

    @staticmethod
    def OR(a: Tensor, b: Tensor) -> Tensor:
        return a + b - a * b  # Probabilistic sum

    @staticmethod
    def NOT(a: Tensor) -> Tensor:
        return 1 - a

    @staticmethod
    def IMPLIES(a: Tensor, b: Tensor) -> Tensor:
        return DifferentiableLogic.OR(
            DifferentiableLogic.NOT(a), b
        )

class NeuralLogicNetwork(nn.Module):
    def __init__(self, rules: list[Rule]):
        super().__init__()
        self.rules = rules
        self.encoder = nn.TransformerEncoder(...)

    def forward(self, facts: Tensor) -> Tensor:
        # Encode facts to embeddings
        encoded = self.encoder(facts)

        # Apply rules differentiably
        for rule in self.rules:
            # rule: head :- body1, body2, ...
            body_vals = [self.evaluate(b, encoded) for b in rule.body]
            head_val = reduce(DifferentiableLogic.AND, body_vals)
            encoded = self.update(rule.head, head_val, encoded)

        return encoded
```

---

## Verification and Consistency

### Output Verification

```python
class VerifiedLLM:
    def __init__(self, llm, verifier):
        self.llm = llm
        self.verifier = verifier

    def generate_verified(self, prompt: str, max_attempts: int = 5) -> str:
        for attempt in range(max_attempts):
            output = self.llm.generate(prompt)

            # Verify against rules/facts
            is_valid, violations = self.verifier.check(output)

            if is_valid:
                return output

            # Add violations as feedback
            prompt = f"""
            Previous output had errors:
            {violations}

            Original prompt: {prompt}

            Generate a corrected output:
            """

        raise VerificationError("Could not generate valid output")
```

### Consistency Checking

```python
class ConsistencyChecker:
    def __init__(self, knowledge_base):
        self.kb = knowledge_base

    def check(self, statements: list[str]) -> tuple[bool, list[str]]:
        violations = []

        for stmt in statements:
            # Parse to logical form
            logical = self.parse(stmt)

            # Check against KB
            if self.kb.contradicts(logical):
                contradiction = self.kb.find_contradiction(logical)
                violations.append(f"{stmt} contradicts: {contradiction}")

        return len(violations) == 0, violations
```

---

## Benefits and Trade-offs

| Aspect | Pure Neural | Pure Symbolic | Neuro-Symbolic |
|--------|-------------|---------------|----------------|
| **Learning** | From data | From rules | Both |
| **Generalization** | Interpolation | Extrapolation | Both |
| **Interpretability** | Low | High | Medium-High |
| **Robustness** | To noise | To edge cases | Both |
| **Data efficiency** | Low | High | Medium |
| **Flexibility** | High | Low | Medium |

---

## Challenges

### 1. Symbol Grounding
Connecting neural representations to symbolic concepts.

### 2. Differentiability Gap
Many symbolic operations are discrete.

### 3. Scalability
Symbolic reasoning can be computationally expensive.

### 4. Integration Complexity
Designing effective interfaces between paradigms.

---

## References

- Garcez, A. d'A., & Lamb, L. C. (2020). *Neurosymbolic AI: The 3rd Wave*
- Mao, J., et al. (2019). *The Neuro-Symbolic Concept Learner*
- Pan, S., et al. (2024). *Unifying Large Language Models and Knowledge Graphs: A Roadmap*
