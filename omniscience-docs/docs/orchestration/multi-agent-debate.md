---
sidebar_position: 5
title: Multi-Agent Debate
description: Adversarial reasoning and argumentation for improved AI decision-making
tags: [orchestration, debate, reasoning, consensus, adversarial]
---

# Multi-Agent Debate

## Adversarial Reasoning for Improved AI Decision-Making

Multi-agent debate leverages disagreement between agents to surface better reasoning, catch errors, and reach more robust conclusions. This technique has emerged as a powerful method for improving AI system reliability.

## Theoretical Foundation

### Why Debate Improves Outcomes

Research has demonstrated that adversarial debate between AI systems:

1. **Exposes reasoning flaws**: Critics identify logical gaps
2. **Reduces hallucination**: Claims are challenged and verified
3. **Surfaces edge cases**: Adversarial thinking finds weaknesses
4. **Improves calibration**: Confidence becomes more accurate
5. **Enables oversight**: Debates are more interpretable than single outputs

### The Debate Framework

```
                         Multi-Agent Debate
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌──────────┐    argue     ┌──────────┐    argue    ┌──────────┐  │
│   │ Agent A  │ ──────────▶  │          │ ◀────────── │ Agent B  │  │
│   │(Proposer)│              │  Judge   │             │ (Critic) │  │
│   └────┬─────┘              │          │             └─────┬────┘  │
│        │                    └─────┬────┘                   │       │
│        │                          │                        │       │
│        │ rebut                    │ decide                 │ rebut │
│        ▼                          ▼                        ▼       │
│   ┌──────────┐              ┌──────────┐             ┌──────────┐  │
│   │ Counter  │              │  Final   │             │ Counter  │  │
│   │ Argument │              │ Decision │             │ Argument │  │
│   └──────────┘              └──────────┘             └──────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Debate Protocols

### Two-Agent Adversarial Debate

The simplest form: one agent proposes, another critiques.

```python
class AdversarialDebate:
    """Two-agent debate for decision validation."""

    def __init__(self, proposer: Agent, critic: Agent, judge: Agent):
        self.proposer = proposer
        self.critic = critic
        self.judge = judge

    async def debate(self, question: str, max_rounds: int = 3) -> DebateResult:
        """Run adversarial debate on a question."""

        # Initial proposal
        proposal = await self.proposer.generate(
            f"Propose a well-reasoned answer to: {question}"
        )

        transcript = [{"role": "proposer", "content": proposal}]

        for round in range(max_rounds):
            # Critic challenges
            critique = await self.critic.generate(
                f"Question: {question}\n"
                f"Current proposal: {proposal}\n"
                f"Identify flaws, missing considerations, and counter-arguments."
            )
            transcript.append({"role": "critic", "content": critique})

            # Proposer responds
            proposal = await self.proposer.generate(
                f"Question: {question}\n"
                f"Your previous answer: {proposal}\n"
                f"Critique received: {critique}\n"
                f"Strengthen your answer, addressing valid criticisms."
            )
            transcript.append({"role": "proposer", "content": proposal})

        # Judge evaluates
        decision = await self.judge.generate(
            f"Question: {question}\n"
            f"Debate transcript:\n{self._format_transcript(transcript)}\n"
            f"Provide final answer considering all arguments."
        )

        return DebateResult(
            question=question,
            final_answer=decision,
            transcript=transcript,
            rounds=max_rounds
        )
```

### Multi-Party Debate

Multiple agents with different perspectives:

```python
class MultiPartyDebate:
    """Debate with multiple specialized agents."""

    def __init__(self, agents: Dict[str, Agent], moderator: Agent):
        self.agents = agents  # role -> agent mapping
        self.moderator = moderator

    async def debate(self, topic: str) -> DebateResult:
        """Run moderated multi-party debate."""

        # Opening statements
        statements = {}
        for role, agent in self.agents.items():
            statements[role] = await agent.generate(
                f"As a {role}, provide your perspective on: {topic}"
            )

        transcript = [{"phase": "opening", "statements": statements}]

        # Cross-examination rounds
        for round in range(3):
            round_exchanges = []

            for role, agent in self.agents.items():
                other_views = {r: s for r, s in statements.items() if r != role}

                response = await agent.generate(
                    f"Topic: {topic}\n"
                    f"Other perspectives:\n{self._format_views(other_views)}\n"
                    f"As {role}, respond to these views and refine your position."
                )
                round_exchanges.append({"role": role, "response": response})
                statements[role] = response

            transcript.append({"phase": f"round_{round + 1}", "exchanges": round_exchanges})

        # Moderator synthesis
        synthesis = await self.moderator.generate(
            f"Topic: {topic}\n"
            f"Full debate:\n{self._format_transcript(transcript)}\n"
            f"Synthesize the key insights and provide a balanced conclusion."
        )

        return DebateResult(topic=topic, synthesis=synthesis, transcript=transcript)
```

## Debate Strategies

### Role-Based Perspectives

Assign agents distinct viewpoints:

| Role | Perspective | Focus |
|------|-------------|-------|
| **Advocate** | Supports the proposal | Benefits, opportunities |
| **Critic** | Challenges the proposal | Risks, weaknesses |
| **Pragmatist** | Focuses on feasibility | Implementation, cost |
| **Ethicist** | Examines moral implications | Values, harms |
| **Devil's Advocate** | Argues opposite position | Edge cases, failures |

### Socratic Questioning

Agents probe each other's reasoning:

```python
SOCRATIC_PROMPTS = [
    "What evidence supports this claim?",
    "What assumptions are you making?",
    "Can you give a concrete example?",
    "What would change your mind?",
    "What are the strongest counter-arguments?",
    "How confident are you, and why?",
]

async def socratic_probe(critic: Agent, claim: str) -> List[str]:
    """Generate Socratic questions for a claim."""
    return await critic.generate(
        f"Claim: {claim}\n"
        f"Generate probing questions using these patterns:\n"
        f"{SOCRATIC_PROMPTS}\n"
        f"Focus on exposing hidden assumptions and logical gaps."
    )
```

### Red Team / Blue Team

Adversarial security-focused debate:

```python
class RedBlueDebate:
    """Security-focused adversarial analysis."""

    async def analyze_decision(self, decision: str, context: str) -> SecurityAnalysis:
        # Blue team: defend the decision
        blue_defense = await self.blue_team.generate(
            f"Decision: {decision}\n"
            f"Context: {context}\n"
            f"Explain why this decision is safe and appropriate."
        )

        # Red team: attack the decision
        red_attack = await self.red_team.generate(
            f"Decision: {decision}\n"
            f"Context: {context}\n"
            f"Blue team defense: {blue_defense}\n"
            f"Find ways this could go wrong. Identify attack vectors, "
            f"unintended consequences, and failure modes."
        )

        # Blue team responds
        blue_response = await self.blue_team.generate(
            f"Original decision: {decision}\n"
            f"Red team attacks: {red_attack}\n"
            f"Propose mitigations for each identified risk."
        )

        return SecurityAnalysis(
            decision=decision,
            risks=red_attack,
            mitigations=blue_response,
            recommendation=await self._judge_safety(decision, red_attack, blue_response)
        )
```

## Consensus Mechanisms

### Voting Systems

```python
class DebateVoting:
    """Aggregate opinions across multiple agents."""

    async def majority_vote(self, question: str, options: List[str]) -> VoteResult:
        """Simple majority voting."""
        votes = {}
        for agent in self.agents:
            vote = await agent.generate(
                f"Question: {question}\n"
                f"Options: {options}\n"
                f"Select exactly one option and explain briefly."
            )
            votes[agent.id] = self._parse_vote(vote, options)

        return VoteResult(
            winner=max(set(votes.values()), key=list(votes.values()).count),
            vote_distribution=Counter(votes.values()),
            individual_votes=votes
        )

    async def weighted_vote(self, question: str, options: List[str]) -> VoteResult:
        """Voting weighted by agent confidence and expertise."""
        weighted_votes = {}
        for agent in self.agents:
            response = await agent.generate(
                f"Question: {question}\n"
                f"Options: {options}\n"
                f"Select one option and rate your confidence (0-1)."
            )
            vote, confidence = self._parse_weighted_vote(response, options)
            expertise_weight = self._get_expertise_weight(agent, question)
            weighted_votes[agent.id] = {
                "vote": vote,
                "weight": confidence * expertise_weight
            }

        # Aggregate weighted votes
        option_scores = defaultdict(float)
        for vote_info in weighted_votes.values():
            option_scores[vote_info["vote"]] += vote_info["weight"]

        return VoteResult(
            winner=max(option_scores, key=option_scores.get),
            scores=dict(option_scores),
            individual_votes=weighted_votes
        )
```

### Delphi Method

Iterative anonymous consensus:

```python
class DelphiConsensus:
    """Iterative consensus through anonymous feedback."""

    async def reach_consensus(self, question: str, max_rounds: int = 4) -> ConsensusResult:
        """Run Delphi process until consensus or max rounds."""

        estimates = []
        for round in range(max_rounds):
            round_estimates = []

            for agent in self.agents:
                if round == 0:
                    # Initial estimate
                    estimate = await agent.generate(
                        f"Question: {question}\n"
                        f"Provide your best estimate with reasoning."
                    )
                else:
                    # Estimate with anonymous group feedback
                    estimate = await agent.generate(
                        f"Question: {question}\n"
                        f"Previous round statistics:\n"
                        f"  Median: {self._median(estimates[-1])}\n"
                        f"  Range: {self._range(estimates[-1])}\n"
                        f"  Quartiles: {self._quartiles(estimates[-1])}\n"
                        f"Revise your estimate considering group feedback."
                    )

                round_estimates.append(self._parse_estimate(estimate))

            estimates.append(round_estimates)

            # Check for convergence
            if self._has_converged(round_estimates):
                break

        return ConsensusResult(
            final_estimate=self._median(estimates[-1]),
            convergence_round=len(estimates),
            estimate_history=estimates
        )
```

## Debate for Verification

### Fact-Checking Debate

```python
class FactCheckDebate:
    """Use debate to verify factual claims."""

    async def verify_claim(self, claim: str) -> VerificationResult:
        """Multi-agent fact verification."""

        # Claimant presents evidence
        evidence = await self.claimant.generate(
            f"Claim: {claim}\n"
            f"Provide specific evidence supporting this claim. "
            f"Include sources where possible."
        )

        # Verifier challenges evidence
        challenge = await self.verifier.generate(
            f"Claim: {claim}\n"
            f"Presented evidence: {evidence}\n"
            f"Challenge the evidence. Look for:\n"
            f"- Missing citations\n"
            f"- Logical gaps\n"
            f"- Potential misinformation\n"
            f"- Alternative explanations"
        )

        # Researcher finds independent verification
        research = await self.researcher.generate(
            f"Claim: {claim}\n"
            f"Evidence presented: {evidence}\n"
            f"Challenges raised: {challenge}\n"
            f"Find independent sources to verify or refute this claim."
        )

        # Judge makes determination
        verdict = await self.judge.generate(
            f"Claim: {claim}\n"
            f"Evidence: {evidence}\n"
            f"Challenges: {challenge}\n"
            f"Independent research: {research}\n"
            f"Determine: VERIFIED, REFUTED, or UNVERIFIABLE. Explain."
        )

        return VerificationResult(
            claim=claim,
            verdict=self._parse_verdict(verdict),
            evidence_summary=evidence,
            challenges=challenge,
            supporting_research=research
        )
```

### Code Review Debate

```python
class CodeReviewDebate:
    """Multi-agent code review through debate."""

    async def review_code(self, code: str, context: str) -> ReviewResult:
        """Adversarial code review."""

        issues = []

        # Security reviewer
        security_review = await self.security_agent.generate(
            f"Code:\n```\n{code}\n```\n"
            f"Context: {context}\n"
            f"Identify security vulnerabilities, injection risks, and unsafe patterns."
        )

        # Performance reviewer
        perf_review = await self.performance_agent.generate(
            f"Code:\n```\n{code}\n```\n"
            f"Context: {context}\n"
            f"Identify performance issues, inefficiencies, and scalability concerns."
        )

        # Maintainability reviewer
        maint_review = await self.maintainability_agent.generate(
            f"Code:\n```\n{code}\n```\n"
            f"Context: {context}\n"
            f"Identify readability issues, code smells, and maintainability concerns."
        )

        # Author defends
        defense = await self.author_agent.generate(
            f"Code:\n```\n{code}\n```\n"
            f"Reviews received:\n"
            f"Security: {security_review}\n"
            f"Performance: {perf_review}\n"
            f"Maintainability: {maint_review}\n"
            f"Acknowledge valid concerns and defend intentional choices."
        )

        # Synthesize actionable feedback
        synthesis = await self.moderator.generate(
            f"Code reviews and author response:\n"
            f"Security: {security_review}\n"
            f"Performance: {perf_review}\n"
            f"Maintainability: {maint_review}\n"
            f"Author defense: {defense}\n"
            f"Create prioritized list of changes needed."
        )

        return ReviewResult(
            code=code,
            reviews={
                "security": security_review,
                "performance": perf_review,
                "maintainability": maint_review
            },
            author_response=defense,
            action_items=self._parse_action_items(synthesis)
        )
```

## Measuring Debate Quality

### Debate Metrics

```python
@dataclass
class DebateMetrics:
    """Metrics for evaluating debate quality."""

    argument_diversity: float      # How different are the perspectives?
    evidence_citation: float       # Are claims supported by evidence?
    logical_coherence: float       # Do arguments follow logically?
    steel_manning: float           # Are opponents' arguments fairly represented?
    resolution_clarity: float      # Is the final conclusion clear?
    convergence_rate: float        # How quickly did agents converge?

def evaluate_debate(transcript: List[Dict]) -> DebateMetrics:
    """Automatically evaluate debate quality."""
    # Implementation uses another LLM to assess debate
    pass
```

## Research Foundations

The multi-agent debate approach builds on:

- **AI Safety via Debate** (Irving et al., 2018) - Using debate for AI alignment
- **Debate Improves Reasoning** (Du et al., 2023) - Empirical benefits of multi-agent debate
- **Self-Consistency** (Wang et al., 2022) - Multiple samples improve reliability
- **Constitutional AI** (Bai et al., 2022) - AI systems critiquing themselves
- **Deliberative Alignment** (Anthropic, 2024) - Reasoning about values

---

## See Also

- [Consensus Protocols](./consensus-protocols.md) - Formal agreement mechanisms
- [Hierarchical Orchestration](./hierarchical.md) - Central coordination
- [Human Oversight](../safety/human-oversight.md) - Integrating human judgment
