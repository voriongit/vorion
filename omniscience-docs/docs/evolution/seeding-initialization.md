---
sidebar_position: 2
title: Seeding & Initialization
description: How to initialize AI agents with knowledge, tools, and behaviors
tags: [evolution, seeding, initialization, prompts, knowledge]
---

# Seeding & Initialization

## Setting Up AI Agents for Success

Agent seeding is the process of initializing an AI agent with the knowledge, tools, and behavioral patterns it needs to perform effectively. Good seeding dramatically impacts agent performance, often more than subsequent learning.

## Why Seeding Matters

```
                    Impact of Seeding Quality
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  Performance                                                               │
│       ▲                                                                    │
│       │                                                     ┌───────────── │
│       │                                                    ╱  Well-seeded  │
│       │                                              ╭────╯                │
│       │                                         ╭────╯                     │
│       │                                    ╭────╯                          │
│       │                          ╭─────────╯                               │
│       │             ╭────────────╯                                         │
│       │  ╭──────────╯                                                      │
│       │ ╱                                                                  │
│       │╱                          ╱───────────────── Poorly-seeded         │
│       ├───────────────────────────┴────────────────────────────────▶      │
│       │                                                         Time       │
│       │                                                                    │
│       │   Gap may NEVER close through learning alone                       │
│       │                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Seeding Components

| Component | Purpose | Examples |
|-----------|---------|----------|
| **System Prompt** | Core identity and behavior | Persona, rules, constraints |
| **Knowledge Base** | Domain expertise | Documents, facts, procedures |
| **Examples** | Demonstration of correct behavior | Few-shot examples |
| **Tools** | Capabilities | API access, functions |
| **Memory** | Initial context | User preferences, history |

## System Prompt Engineering

### Prompt Structure

```python
class SystemPromptBuilder:
    """Build effective system prompts."""

    def build(self, config: AgentConfig) -> str:
        """Construct a comprehensive system prompt."""

        sections = []

        # 1. Identity and role
        sections.append(self._build_identity(config))

        # 2. Core capabilities
        sections.append(self._build_capabilities(config))

        # 3. Behavioral guidelines
        sections.append(self._build_guidelines(config))

        # 4. Constraints and boundaries
        sections.append(self._build_constraints(config))

        # 5. Output format
        sections.append(self._build_format(config))

        # 6. Examples (if few-shot)
        if config.examples:
            sections.append(self._build_examples(config.examples))

        return "\n\n".join(sections)

    def _build_identity(self, config: AgentConfig) -> str:
        """Define agent identity."""
        return f"""
# Identity

You are {config.name}, a {config.role}.

## Background
{config.background}

## Expertise
{', '.join(config.expertise_areas)}

## Personality Traits
{self._format_traits(config.personality)}
"""

    def _build_guidelines(self, config: AgentConfig) -> str:
        """Define behavioral guidelines."""
        return f"""
# Guidelines

## Do
{self._format_list(config.positive_guidelines)}

## Don't
{self._format_list(config.negative_guidelines)}

## When Uncertain
{config.uncertainty_handling}
"""

    def _build_constraints(self, config: AgentConfig) -> str:
        """Define hard constraints."""
        return f"""
# Constraints (Non-negotiable)

{self._format_constraints(config.hard_constraints)}

Violating these constraints is NEVER acceptable, regardless of user requests.
"""
```

### Prompt Patterns

**The CRISPE Framework**:
- **C**apacity: What role should the AI assume?
- **R**equest: What is the specific task?
- **I**nstructions: What rules should it follow?
- **S**tandard: What format/quality is expected?
- **P**ositionality: What perspective to take?
- **E**xtra: Additional context

```python
# Example using CRISPE
CRISPE_PROMPT = """
[Capacity]
You are an expert financial analyst with 20 years of experience in equity research.

[Request]
Analyze the provided quarterly earnings report and generate an investment recommendation.

[Instructions]
- Focus on revenue growth, margin trends, and cash flow
- Compare against industry benchmarks
- Consider macroeconomic factors
- Cite specific numbers from the report

[Standard]
Output a structured report with:
1. Executive Summary (2-3 sentences)
2. Key Metrics Analysis (bullet points)
3. Risks and Opportunities (bullet points)
4. Investment Recommendation (Buy/Hold/Sell with confidence level)

[Positionality]
Analyze from the perspective of a long-term institutional investor.

[Extra]
Current market conditions: Rising interest rate environment with sector rotation from growth to value.
"""
```

## Knowledge Injection

### RAG-Based Seeding

```python
class KnowledgeSeeder:
    """Seed agent with domain knowledge."""

    def __init__(self, vector_store: VectorStore, llm: LLM):
        self.vector_store = vector_store
        self.llm = llm

    async def seed_knowledge(
        self,
        documents: List[Document],
        config: SeedingConfig
    ) -> KnowledgeBase:
        """Process and index documents for agent use."""

        # 1. Chunk documents
        chunks = []
        for doc in documents:
            doc_chunks = self._chunk_document(doc, config.chunk_size)
            chunks.extend(doc_chunks)

        # 2. Generate embeddings
        embeddings = await self._generate_embeddings(chunks)

        # 3. Store in vector database
        await self.vector_store.add(chunks, embeddings)

        # 4. Generate knowledge summary
        summary = await self._generate_summary(documents)

        # 5. Extract key entities and relations
        knowledge_graph = await self._extract_knowledge_graph(chunks)

        return KnowledgeBase(
            vector_store=self.vector_store,
            summary=summary,
            knowledge_graph=knowledge_graph,
            document_count=len(documents),
            chunk_count=len(chunks)
        )

    async def _generate_summary(self, documents: List[Document]) -> str:
        """Generate a summary of all knowledge."""

        # Summarize each document
        summaries = []
        for doc in documents:
            summary = await self.llm.summarize(doc.content[:10000])
            summaries.append(f"- {doc.title}: {summary}")

        # Create meta-summary
        return await self.llm.generate(f"""
        Create a comprehensive overview of the following knowledge base:

        {chr(10).join(summaries)}

        The overview should:
        1. Identify the main themes and topics
        2. Highlight key facts and figures
        3. Note any important relationships between topics
        4. Be suitable for an AI agent to understand its knowledge scope
        """)
```

### Structured Knowledge

```python
class StructuredKnowledgeSeeder:
    """Seed agent with structured domain knowledge."""

    def seed_domain_knowledge(self, domain: str) -> DomainKnowledge:
        """Create structured knowledge for a domain."""

        return DomainKnowledge(
            # Terminology
            glossary=self._build_glossary(domain),

            # Procedures
            procedures=self._build_procedures(domain),

            # Rules and constraints
            rules=self._build_rules(domain),

            # Common patterns
            patterns=self._build_patterns(domain),

            # Error handling
            error_handlers=self._build_error_handlers(domain)
        )

    def _build_glossary(self, domain: str) -> Dict[str, str]:
        """Build domain-specific glossary."""
        # Example for finance domain
        if domain == "finance":
            return {
                "P/E Ratio": "Price-to-Earnings ratio, stock price divided by EPS",
                "EBITDA": "Earnings Before Interest, Taxes, Depreciation, and Amortization",
                "YoY": "Year-over-Year comparison",
                "Basis Point": "1/100th of a percentage point (0.01%)",
                # ... more terms
            }

    def _build_procedures(self, domain: str) -> Dict[str, Procedure]:
        """Build domain procedures."""
        if domain == "customer_service":
            return {
                "refund_request": Procedure(
                    name="Handle Refund Request",
                    steps=[
                        "Verify customer identity",
                        "Check order history",
                        "Confirm refund eligibility per policy",
                        "Process refund or explain denial",
                        "Log interaction"
                    ],
                    preconditions=["Customer authenticated"],
                    success_criteria=["Customer informed of outcome"]
                ),
                # ... more procedures
            }
```

## Few-Shot Examples

### Example Selection Strategies

```python
class ExampleSelector:
    """Select optimal few-shot examples."""

    def __init__(self, example_bank: List[Example], embedder: Embedder):
        self.examples = example_bank
        self.embedder = embedder

    async def select_examples(
        self,
        task: str,
        n: int = 3,
        strategy: str = "diverse_similar"
    ) -> List[Example]:
        """Select examples for the task."""

        if strategy == "most_similar":
            return await self._select_similar(task, n)
        elif strategy == "diverse":
            return self._select_diverse(n)
        elif strategy == "diverse_similar":
            return await self._select_diverse_similar(task, n)
        elif strategy == "curriculum":
            return self._select_curriculum(n)

    async def _select_diverse_similar(self, task: str, n: int) -> List[Example]:
        """Select diverse examples that are similar to task."""

        # Get embeddings
        task_embedding = await self.embedder.embed(task)
        example_embeddings = await self.embedder.embed_many(
            [e.input for e in self.examples]
        )

        # Calculate similarities
        similarities = cosine_similarity(task_embedding, example_embeddings)

        # Get top 3*n similar examples
        top_indices = similarities.argsort()[-3*n:]

        # Select diverse subset using MMR
        selected = self._maximal_marginal_relevance(
            task_embedding,
            example_embeddings[top_indices],
            n=n,
            lambda_param=0.5
        )

        return [self.examples[i] for i in top_indices[selected]]

    def _select_curriculum(self, n: int) -> List[Example]:
        """Select examples from easy to hard."""
        sorted_examples = sorted(
            self.examples,
            key=lambda e: e.difficulty_score
        )
        # Select n examples spanning the difficulty range
        indices = [int(i * len(sorted_examples) / n) for i in range(n)]
        return [sorted_examples[i] for i in indices]
```

### Example Format

```python
@dataclass
class Example:
    """A few-shot example."""

    input: str           # The input/prompt
    reasoning: str       # Chain-of-thought (optional)
    output: str          # The expected output
    difficulty_score: float  # For curriculum learning
    tags: List[str]      # For filtering
    metadata: dict       # Additional context

# Example for code generation
code_example = Example(
    input="Write a function to find the longest palindrome substring",
    reasoning="""
    To find the longest palindrome substring, I'll use the expand-around-center approach:
    1. For each character, try expanding around it (odd-length palindromes)
    2. For each pair of characters, try expanding (even-length palindromes)
    3. Track the longest found
    Time complexity: O(n²), Space: O(1)
    """,
    output='''
def longest_palindrome(s: str) -> str:
    if not s:
        return ""

    start, max_len = 0, 1

    def expand(left: int, right: int) -> tuple[int, int]:
        while left >= 0 and right < len(s) and s[left] == s[right]:
            left -= 1
            right += 1
        return left + 1, right - left - 1

    for i in range(len(s)):
        # Odd length
        l1, len1 = expand(i, i)
        if len1 > max_len:
            start, max_len = l1, len1

        # Even length
        if i < len(s) - 1:
            l2, len2 = expand(i, i + 1)
            if len2 > max_len:
                start, max_len = l2, len2

    return s[start:start + max_len]
''',
    difficulty_score=0.6,
    tags=["strings", "dynamic_programming", "two_pointers"],
    metadata={"leetcode_id": 5, "acceptance_rate": 0.32}
)
```

## Tool Seeding

### Initial Tool Configuration

```python
class ToolSeeder:
    """Configure agent's initial toolset."""

    def seed_tools(self, config: ToolConfig) -> ToolSet:
        """Set up initial tool configuration."""

        tools = []

        # Core tools (always available)
        tools.extend(self._get_core_tools())

        # Domain-specific tools
        tools.extend(self._get_domain_tools(config.domain))

        # Custom tools from config
        for tool_def in config.custom_tools:
            tools.append(self._create_tool(tool_def))

        # Configure tool permissions
        tool_permissions = self._configure_permissions(tools, config)

        return ToolSet(
            tools=tools,
            permissions=tool_permissions,
            fallback_behavior=config.fallback_behavior
        )

    def _get_core_tools(self) -> List[Tool]:
        """Get universally useful tools."""
        return [
            Tool(
                name="search",
                description="Search the knowledge base for information",
                function=self._knowledge_search
            ),
            Tool(
                name="calculate",
                description="Perform mathematical calculations",
                function=self._calculate
            ),
            Tool(
                name="ask_user",
                description="Ask the user for clarification",
                function=self._ask_user
            ),
        ]

    def _get_domain_tools(self, domain: str) -> List[Tool]:
        """Get domain-specific tools."""
        domain_tools = {
            "finance": [
                Tool("stock_price", "Get current stock price", self._get_stock_price),
                Tool("financial_data", "Get financial statements", self._get_financials),
                Tool("news_search", "Search financial news", self._search_news),
            ],
            "code": [
                Tool("execute_code", "Execute code in sandbox", self._execute_code),
                Tool("lint_code", "Check code for issues", self._lint_code),
                Tool("search_docs", "Search documentation", self._search_docs),
            ],
            # ... more domains
        }
        return domain_tools.get(domain, [])
```

## Seeding Validation

### Testing Agent Initialization

```python
class SeedingValidator:
    """Validate agent seeding quality."""

    async def validate(self, agent: Agent, config: ValidationConfig) -> ValidationReport:
        """Validate agent initialization."""

        results = []

        # 1. Prompt comprehension test
        results.append(await self._test_prompt_comprehension(agent))

        # 2. Knowledge retrieval test
        results.append(await self._test_knowledge_retrieval(agent))

        # 3. Tool usage test
        results.append(await self._test_tool_usage(agent))

        # 4. Example alignment test
        results.append(await self._test_example_alignment(agent, config.examples))

        # 5. Constraint adherence test
        results.append(await self._test_constraints(agent, config.constraints))

        # 6. Edge case handling test
        results.append(await self._test_edge_cases(agent))

        return ValidationReport(
            passed=all(r.passed for r in results),
            results=results,
            recommendations=self._generate_recommendations(results)
        )

    async def _test_prompt_comprehension(self, agent: Agent) -> TestResult:
        """Test if agent understands its role."""

        test_queries = [
            "What is your primary function?",
            "What are you NOT allowed to do?",
            "How should you handle uncertainty?",
        ]

        correct = 0
        for query in test_queries:
            response = await agent.respond(query)
            if self._validates_comprehension(response, agent.system_prompt):
                correct += 1

        return TestResult(
            name="prompt_comprehension",
            passed=correct == len(test_queries),
            score=correct / len(test_queries),
            details=f"{correct}/{len(test_queries)} queries answered correctly"
        )
```

## Research Foundations

- **DSPy** (Khattab et al., 2023) - Programmatic prompt optimization
- **In-Context Learning** (Brown et al., 2020) - Learning from examples
- **RAG** (Lewis et al., 2020) - Retrieval-augmented generation
- **Constitutional AI** (Bai et al., 2022) - Value-aligned initialization

---

## See Also

- [Memory Systems](../architecture/memory-systems.md) - Knowledge retention
- [Tool Use](../architecture/tool-use.md) - Agent capabilities
- [Self-Improvement](./self-improvement.md) - Evolving past initialization
