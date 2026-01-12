---
sidebar_position: 3
title: Scientific Research Agents
description: AI agents for hypothesis generation, experimentation, and discovery
tags: [domains, science, research, chemistry, biology, discovery]
---

# Scientific Research Agents

## AI Systems Accelerating Scientific Discovery

Scientific research agents apply autonomous AI capabilities to the scientific method—generating hypotheses, designing experiments, analyzing data, and synthesizing findings. These agents are beginning to transform how science is conducted.

## Landscape

### Notable Systems

| Agent | Domain | Capabilities | Creator |
|-------|--------|--------------|---------|
| **ChemCrow** | Chemistry | Synthesis planning, property prediction | Andres M. Bran et al. |
| **Coscientist** | Chemistry | Autonomous experiment design and execution | CMU/Emerald Cloud Lab |
| **AlphaFold** | Biology | Protein structure prediction | DeepMind |
| **STORM** | Research | Literature synthesis, report generation | Stanford |
| **Paperqa** | Literature | Question answering over papers | Future House |
| **Galactica** | Multi-domain | Scientific text generation | Meta |

### The Scientific Agent Spectrum

```
                    Scientific Agent Capabilities
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  Literature        Analysis         Experiment        Autonomous       │
│  Assistant         Agent            Agent             Scientist        │
│  ────────────────────────────────────────────────────────────────▶    │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Paperqa     │  │  ChemCrow    │  │  Coscientist │  │  Future  │  │
│  │  Elicit      │  │  STORM       │  │              │  │  (?)     │  │
│  │              │  │              │  │              │  │          │  │
│  │ Search and   │  │ Analyze and  │  │ Design and   │  │ Full     │  │
│  │ summarize    │  │ predict      │  │ execute      │  │ research │  │
│  │ papers       │  │ properties   │  │ experiments  │  │ cycle    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘  │
│                                                                        │
│  Human drives     Human validates   Human supervises  Human reviews   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## ChemCrow: A Deep Dive

### Architecture

ChemCrow demonstrates how to build domain-specialized agents:

```
                      ChemCrow Architecture
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        LLM Reasoning Core                         │ │
│  │                    (Claude / GPT-4 / Llama)                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      Chemistry Tool Suite                         │ │
│  │                                                                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ Molecule Tools                                              │  │ │
│  │  │ • SMILES parser/validator                                   │  │ │
│  │  │ • Molecular property calculator                             │  │ │
│  │  │ • Similarity search                                         │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ Reaction Tools                                              │  │ │
│  │  │ • Reaction predictor (RXN4Chemistry)                       │  │ │
│  │  │ • Retrosynthesis planner                                    │  │ │
│  │  │ • Reaction feasibility checker                              │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ Data Tools                                                  │  │ │
│  │  │ • PubChem lookup                                            │  │ │
│  │  │ • Safety data (GHS)                                         │  │ │
│  │  │ • Patent search                                             │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ Web Tools                                                   │  │ │
│  │  │ • Literature search                                         │  │ │
│  │  │ • Human feedback                                            │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tool Implementation Example

```python
from langchain.tools import BaseTool
from rdkit import Chem
from rdkit.Chem import Descriptors, AllChem

class MolecularPropertyTool(BaseTool):
    """Calculate molecular properties from SMILES."""

    name = "MolecularProperties"
    description = """
    Calculate molecular properties from a SMILES string.
    Input: SMILES string (e.g., "CCO" for ethanol)
    Output: Dictionary of molecular properties
    """

    def _run(self, smiles: str) -> dict:
        """Calculate properties."""
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return {"error": f"Invalid SMILES: {smiles}"}

        return {
            "molecular_weight": Descriptors.MolWt(mol),
            "logP": Descriptors.MolLogP(mol),
            "hbd": Descriptors.NumHDonors(mol),
            "hba": Descriptors.NumHAcceptors(mol),
            "tpsa": Descriptors.TPSA(mol),
            "rotatable_bonds": Descriptors.NumRotatableBonds(mol),
            "rings": Descriptors.RingCount(mol),
            "lipinski_violations": self._check_lipinski(mol)
        }

    def _check_lipinski(self, mol) -> int:
        """Check Lipinski's Rule of Five violations."""
        violations = 0
        if Descriptors.MolWt(mol) > 500: violations += 1
        if Descriptors.MolLogP(mol) > 5: violations += 1
        if Descriptors.NumHDonors(mol) > 5: violations += 1
        if Descriptors.NumHAcceptors(mol) > 10: violations += 1
        return violations


class RetrosynthesisTool(BaseTool):
    """Plan synthetic routes for target molecules."""

    name = "Retrosynthesis"
    description = """
    Given a target molecule (SMILES), plan a synthetic route
    using commercially available starting materials.
    """

    def __init__(self, api_key: str):
        self.client = RXN4ChemistryClient(api_key)

    def _run(self, target_smiles: str) -> dict:
        """Plan retrosynthesis."""
        # Validate target
        mol = Chem.MolFromSmiles(target_smiles)
        if mol is None:
            return {"error": "Invalid target SMILES"}

        # Call retrosynthesis API
        result = self.client.predict_retrosynthesis(
            target_smiles,
            max_steps=6,
            availability_pricing_threshold=1000
        )

        routes = []
        for route in result.routes[:5]:  # Top 5 routes
            routes.append({
                "steps": len(route.reactions),
                "starting_materials": route.starting_materials,
                "reactions": [r.name for r in route.reactions],
                "confidence": route.confidence_score
            })

        return {
            "target": target_smiles,
            "routes_found": len(routes),
            "routes": routes
        }
```

### Example Interaction

```
User: I want to synthesize aspirin. What are the starting materials
      and what safety precautions should I take?

ChemCrow Reasoning:
1. First, I'll look up aspirin's SMILES structure
2. Then plan the retrosynthesis
3. Finally check safety data for all chemicals involved

Tool Calls:
1. PubChemLookup("aspirin")
   → SMILES: CC(=O)OC1=CC=CC=C1C(=O)O

2. Retrosynthesis("CC(=O)OC1=CC=CC=C1C(=O)O")
   → Route: Salicylic acid + Acetic anhydride → Aspirin
   → Alternative: Salicylic acid + Acetyl chloride → Aspirin

3. SafetyData("salicylic acid")
   → GHS: Warning, skin/eye irritant

4. SafetyData("acetic anhydride")
   → GHS: Danger, flammable, corrosive, toxic if inhaled

Response:
Aspirin (acetylsalicylic acid) synthesis:

**Recommended Route:**
Salicylic acid + Acetic anhydride → Aspirin + Acetic acid

**Starting Materials:**
1. Salicylic acid (2-hydroxybenzoic acid)
2. Acetic anhydride (preferred) or Acetyl chloride

**Safety Precautions:**
⚠️ Acetic anhydride:
- Use fume hood (toxic vapors)
- Wear chemical-resistant gloves
- Fire hazard - keep away from ignition sources
- Reacts violently with water

⚠️ General:
- Wear safety goggles
- Have neutralizing agents available
- Work in well-ventilated area
```

## Literature Research Agents

### STORM Architecture

Stanford's STORM system for writing Wikipedia-like articles:

```python
class STORMResearchAgent:
    """Generate comprehensive research reports from queries."""

    async def research_topic(self, topic: str) -> ResearchReport:
        """Multi-stage research process."""

        # Stage 1: Perspective Discovery
        perspectives = await self._discover_perspectives(topic)

        # Stage 2: Simulated Conversations
        # Different "experts" discuss the topic
        conversations = []
        for perspective in perspectives:
            conv = await self._simulate_expert_conversation(
                topic=topic,
                expert_perspective=perspective,
                knowledge_base=self.knowledge_base
            )
            conversations.append(conv)

        # Stage 3: Outline Generation
        outline = await self._generate_outline(topic, conversations)

        # Stage 4: Article Writing
        article = await self._write_article(outline, conversations)

        # Stage 5: Citation and Verification
        cited_article = await self._add_citations(article)

        return ResearchReport(
            topic=topic,
            article=cited_article,
            sources=self._extract_sources(cited_article),
            perspectives_explored=perspectives
        )

    async def _simulate_expert_conversation(
        self,
        topic: str,
        expert_perspective: str,
        knowledge_base: KnowledgeBase
    ) -> Conversation:
        """Simulate conversation between interviewer and expert."""

        messages = []
        interviewer = InterviewerAgent(topic)
        expert = ExpertAgent(perspective=expert_perspective)

        for _ in range(5):  # 5 rounds of Q&A
            # Interviewer asks question
            question = await interviewer.generate_question(messages)
            messages.append({"role": "interviewer", "content": question})

            # Expert retrieves relevant information
            context = await knowledge_base.search(question)

            # Expert answers with citations
            answer = await expert.answer(question, context)
            messages.append({"role": "expert", "content": answer})

        return Conversation(perspective=expert_perspective, messages=messages)
```

### Paperqa for Q&A Over Literature

```python
class PaperQAAgent:
    """Answer questions using scientific literature."""

    async def answer(self, question: str, papers: List[Paper]) -> Answer:
        """Answer question with citations from papers."""

        # 1. Index papers
        chunks = []
        for paper in papers:
            paper_chunks = self._chunk_paper(paper)
            for chunk in paper_chunks:
                chunks.append({
                    "text": chunk.text,
                    "paper": paper.title,
                    "doi": paper.doi,
                    "section": chunk.section
                })

        # 2. Retrieve relevant chunks
        relevant = await self._retrieve(question, chunks, k=10)

        # 3. Gather evidence
        evidence = []
        for chunk in relevant:
            assessment = await self._assess_relevance(question, chunk)
            if assessment.relevant:
                evidence.append({
                    "text": chunk["text"],
                    "citation": self._format_citation(chunk),
                    "relevance_score": assessment.score
                })

        # 4. Generate answer with citations
        answer = await self._generate_answer(question, evidence)

        return Answer(
            question=question,
            answer=answer.text,
            citations=answer.citations,
            confidence=answer.confidence
        )
```

## Autonomous Experiment Agents

### Coscientist: Physical-World Integration

The Coscientist system connects AI reasoning to physical lab equipment:

```
               Coscientist Closed-Loop System
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    LLM Planning Module                            │ │
│  │  "I need to optimize the palladium-catalyzed coupling reaction"   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Experiment Design                              │ │
│  │  • Select reagents and concentrations                             │ │
│  │  • Design parameter sweep                                         │ │
│  │  • Plan analysis methods                                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Cloud Lab Integration                          │ │
│  │                   (Emerald Cloud Lab API)                         │ │
│  │                                                                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │ │
│  │  │ Liquid   │  │ Thermal  │  │ Spectro- │  │ Chroma-  │          │ │
│  │  │ Handler  │  │ Cycler   │  │ scopy    │  │ tography │          │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Results Analysis                               │ │
│  │  • Parse instrument data                                          │ │
│  │  • Compare to predictions                                         │ │
│  │  • Update optimization strategy                                   │ │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│                    [Loop back to Planning]                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Challenges in Scientific Agents

### Reproducibility

```python
class ReproducibilityManager:
    """Ensure scientific reproducibility."""

    def record_experiment(self, experiment: Experiment) -> ExperimentRecord:
        """Create comprehensive experiment record."""

        return ExperimentRecord(
            # Inputs
            hypothesis=experiment.hypothesis,
            parameters=experiment.parameters,
            data_sources=experiment.data_sources,

            # Environment
            model_version=experiment.model_info,
            tool_versions={t.name: t.version for t in experiment.tools},
            random_seeds=experiment.random_seeds,
            timestamp=datetime.utcnow(),

            # Execution
            reasoning_trace=experiment.reasoning_trace,
            tool_calls=experiment.tool_call_log,

            # Results
            outputs=experiment.outputs,
            analysis=experiment.analysis,

            # Verification
            checksum=self._compute_checksum(experiment)
        )
```

### Hallucination Prevention

```python
class ScientificGroundingChecker:
    """Verify scientific claims are grounded."""

    async def verify_claim(self, claim: str, context: List[Paper]) -> Verification:
        """Check if claim is supported by literature."""

        # 1. Extract specific assertions
        assertions = await self._extract_assertions(claim)

        # 2. Find supporting evidence
        verified = []
        unverified = []

        for assertion in assertions:
            evidence = await self._find_evidence(assertion, context)

            if evidence.support_score > 0.8:
                verified.append({
                    "assertion": assertion,
                    "evidence": evidence.citations,
                    "confidence": evidence.support_score
                })
            else:
                unverified.append({
                    "assertion": assertion,
                    "closest_evidence": evidence.closest_match,
                    "gap": evidence.gap_description
                })

        return Verification(
            original_claim=claim,
            verified_assertions=verified,
            unverified_assertions=unverified,
            overall_confidence=len(verified) / len(assertions)
        )
```

## Future Directions

- **Multi-modal reasoning**: Combining text, images, molecular structures
- **Automated hypothesis generation**: Novel scientific questions
- **Cross-domain transfer**: Applying insights across fields
- **Peer review agents**: Automated scientific review
- **Meta-science**: Agents studying scientific trends and gaps

## Research Foundations

- **ChemCrow** (Bran et al., 2023) - Chemistry agent with tool use
- **Coscientist** (Boiko et al., 2023) - Autonomous chemical experiments
- **STORM** (Shao et al., 2024) - Multi-perspective research synthesis
- **Galactica** (Taylor et al., 2022) - Scientific language model
- **Paperqa** (Lála et al., 2023) - Literature QA system

---

## See Also

- [Tool Use](../architecture/tool-use.md) - Agent tool integration
- [Memory Systems](../architecture/memory-systems.md) - Knowledge retention
- [Human Oversight](../safety/human-oversight.md) - Scientific validation
