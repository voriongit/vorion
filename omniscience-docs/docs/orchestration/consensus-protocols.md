---
sidebar_position: 6
title: Consensus Protocols
description: Formal agreement mechanisms for multi-agent decision making
tags: [orchestration, consensus, voting, agreement, distributed]
---

# Consensus Protocols

## Formal Agreement Mechanisms for Multi-Agent Systems

When multiple autonomous agents must agree on shared state or decisions, consensus protocols provide the mathematical and algorithmic foundations for reliable agreement—even in the presence of failures or adversarial behavior.

## The Consensus Problem

### Definition

**Consensus** requires that distributed agents:

1. **Agreement**: All correct agents decide on the same value
2. **Validity**: The decided value was proposed by some agent
3. **Termination**: All correct agents eventually decide

### Why Consensus is Hard

The **FLP Impossibility Theorem** (Fischer, Lynch, Paterson, 1985) proves that deterministic consensus is impossible in asynchronous systems with even one faulty process. Practical protocols work around this through:

- Synchrony assumptions
- Randomization
- Failure detectors

## Classical Consensus Protocols

### Paxos

The foundational consensus algorithm for distributed systems:

```
                         Paxos Protocol
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Phase 1a: Prepare                                                  │
│  ┌──────────┐         prepare(n)         ┌──────────┐               │
│  │ Proposer │ ─────────────────────────▶ │ Acceptor │               │
│  └──────────┘                            └──────────┘               │
│                                                                     │
│  Phase 1b: Promise                                                  │
│  ┌──────────┐         promise(n)         ┌──────────┐               │
│  │ Proposer │ ◀───────────────────────── │ Acceptor │               │
│  └──────────┘                            └──────────┘               │
│                                                                     │
│  Phase 2a: Accept                                                   │
│  ┌──────────┐       accept(n, v)         ┌──────────┐               │
│  │ Proposer │ ─────────────────────────▶ │ Acceptor │               │
│  └──────────┘                            └──────────┘               │
│                                                                     │
│  Phase 2b: Accepted                                                 │
│  ┌──────────┐       accepted(n, v)       ┌──────────┐               │
│  │ Learner  │ ◀───────────────────────── │ Acceptor │               │
│  └──────────┘                            └──────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Raft

A more understandable consensus algorithm:

```python
class RaftNode:
    """Simplified Raft consensus implementation."""

    def __init__(self, node_id: str, peers: List[str]):
        self.node_id = node_id
        self.peers = peers
        self.state = "follower"
        self.current_term = 0
        self.voted_for = None
        self.log: List[LogEntry] = []
        self.commit_index = 0

    async def request_vote(self, term: int, candidate_id: str,
                          last_log_index: int, last_log_term: int) -> VoteResponse:
        """Handle vote request from candidate."""
        if term < self.current_term:
            return VoteResponse(term=self.current_term, vote_granted=False)

        if term > self.current_term:
            self.current_term = term
            self.state = "follower"
            self.voted_for = None

        # Grant vote if we haven't voted and candidate's log is up-to-date
        log_ok = (last_log_term > self._last_log_term() or
                  (last_log_term == self._last_log_term() and
                   last_log_index >= len(self.log) - 1))

        if self.voted_for in (None, candidate_id) and log_ok:
            self.voted_for = candidate_id
            return VoteResponse(term=self.current_term, vote_granted=True)

        return VoteResponse(term=self.current_term, vote_granted=False)

    async def append_entries(self, term: int, leader_id: str,
                            prev_log_index: int, prev_log_term: int,
                            entries: List[LogEntry], leader_commit: int) -> AppendResponse:
        """Handle log replication from leader."""
        if term < self.current_term:
            return AppendResponse(term=self.current_term, success=False)

        self.current_term = term
        self.state = "follower"

        # Check log consistency
        if prev_log_index >= 0:
            if len(self.log) <= prev_log_index:
                return AppendResponse(term=self.current_term, success=False)
            if self.log[prev_log_index].term != prev_log_term:
                return AppendResponse(term=self.current_term, success=False)

        # Append new entries
        self.log = self.log[:prev_log_index + 1] + entries

        # Update commit index
        if leader_commit > self.commit_index:
            self.commit_index = min(leader_commit, len(self.log) - 1)

        return AppendResponse(term=self.current_term, success=True)
```

## Byzantine Fault Tolerance

### The Byzantine Generals Problem

When agents might be actively malicious (Byzantine), stronger protocols are needed:

```
           Byzantine Consensus Requirements
┌────────────────────────────────────────────────────────┐
│                                                        │
│  Total Agents: n                                       │
│  Byzantine (faulty) Agents: f                          │
│                                                        │
│  Requirement: n ≥ 3f + 1                               │
│                                                        │
│  Example: To tolerate 1 Byzantine agent, need 4 total  │
│                                                        │
│     ┌───┐   ┌───┐   ┌───┐   ┌───┐                     │
│     │ A │   │ B │   │ C │   │ D │                     │
│     │ ✓ │   │ ✓ │   │ ✓ │   │ ✗ │ ← Byzantine         │
│     └───┘   └───┘   └───┘   └───┘                     │
│                                                        │
│  Correct agents can still reach consensus              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### PBFT (Practical Byzantine Fault Tolerance)

```python
class PBFTNode:
    """Practical Byzantine Fault Tolerance consensus."""

    def __init__(self, node_id: int, total_nodes: int):
        self.node_id = node_id
        self.n = total_nodes
        self.f = (total_nodes - 1) // 3  # Max Byzantine faults
        self.view = 0
        self.sequence_number = 0
        self.log: Dict[int, PBFTLogEntry] = {}

    async def handle_request(self, request: ClientRequest) -> Optional[Reply]:
        """Handle client request (primary only)."""
        if not self._is_primary():
            return None

        self.sequence_number += 1
        pre_prepare = PrePrepare(
            view=self.view,
            sequence=self.sequence_number,
            digest=self._digest(request),
            request=request
        )

        # Broadcast PRE-PREPARE to all replicas
        await self._broadcast(pre_prepare)
        return await self._wait_for_commit(self.sequence_number)

    async def handle_pre_prepare(self, msg: PrePrepare):
        """Handle PRE-PREPARE message."""
        if not self._valid_pre_prepare(msg):
            return

        # Send PREPARE to all replicas
        prepare = Prepare(
            view=msg.view,
            sequence=msg.sequence,
            digest=msg.digest,
            replica_id=self.node_id
        )
        await self._broadcast(prepare)

    async def handle_prepare(self, msg: Prepare):
        """Handle PREPARE message."""
        self._record_prepare(msg)

        # Check if we have 2f + 1 matching PREPAREs
        if self._prepare_count(msg.sequence, msg.digest) >= 2 * self.f + 1:
            # Enter PREPARED state, send COMMIT
            commit = Commit(
                view=msg.view,
                sequence=msg.sequence,
                digest=msg.digest,
                replica_id=self.node_id
            )
            await self._broadcast(commit)

    async def handle_commit(self, msg: Commit):
        """Handle COMMIT message."""
        self._record_commit(msg)

        # Check if we have 2f + 1 matching COMMITs
        if self._commit_count(msg.sequence, msg.digest) >= 2 * self.f + 1:
            # Execute the request
            await self._execute(msg.sequence)
```

## Consensus for AI Agents

### Weighted Agent Consensus

Unlike traditional distributed systems, AI agents may have different:
- Expertise levels
- Trust scores
- Specializations

```python
class WeightedAgentConsensus:
    """Consensus weighted by agent capabilities."""

    def __init__(self, agents: List[Agent], trust_oracle: TrustOracle):
        self.agents = agents
        self.trust_oracle = trust_oracle

    async def reach_consensus(self, question: str) -> ConsensusResult:
        """Reach weighted consensus on a question."""

        # Gather opinions with weights
        opinions = []
        for agent in self.agents:
            # Get agent's response
            response = await agent.generate(question)

            # Weight by trust score and domain expertise
            trust_score = await self.trust_oracle.get_score(agent.did)
            expertise = self._calculate_expertise(agent, question)

            weight = trust_score.overall_score * expertise
            opinions.append(WeightedOpinion(
                agent_id=agent.did,
                response=response,
                weight=weight,
                trust_score=trust_score,
                expertise=expertise
            ))

        # Aggregate weighted opinions
        return self._aggregate(opinions)

    def _aggregate(self, opinions: List[WeightedOpinion]) -> ConsensusResult:
        """Aggregate opinions using weighted voting."""
        # Cluster similar responses
        clusters = self._cluster_responses([o.response for o in opinions])

        # Calculate weighted support for each cluster
        cluster_weights = defaultdict(float)
        for opinion in opinions:
            cluster_id = self._assign_cluster(opinion.response, clusters)
            cluster_weights[cluster_id] += opinion.weight

        # Select cluster with highest weighted support
        winning_cluster = max(cluster_weights, key=cluster_weights.get)

        # Generate representative response from winning cluster
        winning_opinions = [o for o in opinions
                          if self._assign_cluster(o.response, clusters) == winning_cluster]

        return ConsensusResult(
            consensus=self._synthesize(winning_opinions),
            agreement_level=cluster_weights[winning_cluster] / sum(cluster_weights.values()),
            dissenting_views=[o for o in opinions
                            if self._assign_cluster(o.response, clusters) != winning_cluster]
        )
```

### Hierarchical Consensus

For systems with supervisor/worker structure:

```python
class HierarchicalConsensus:
    """Consensus with hierarchical authority."""

    async def reach_consensus(self, decision: Decision) -> ConsensusResult:
        """Multi-level consensus decision."""

        # Level 1: Worker agents propose
        proposals = await asyncio.gather(*[
            worker.propose(decision) for worker in self.workers
        ])

        # Level 2: Specialist supervisors evaluate proposals
        evaluations = await asyncio.gather(*[
            supervisor.evaluate(proposals) for supervisor in self.supervisors
        ])

        # Level 3: Executive agent makes final decision
        final_decision = await self.executive.decide(
            proposals=proposals,
            evaluations=evaluations,
            decision_context=decision
        )

        # Verification: Workers can object (with threshold)
        objections = await self._collect_objections(final_decision)

        if len(objections) > len(self.workers) * 0.5:
            # Significant objection - escalate to human
            return ConsensusResult(
                decision=final_decision,
                status="escalated",
                objections=objections
            )

        return ConsensusResult(
            decision=final_decision,
            status="approved",
            objections=objections
        )
```

## Probabilistic Consensus

### Nakamoto Consensus

The consensus mechanism behind Bitcoin, applicable to agent systems:

```python
class ProofOfWorkConsensus:
    """Probabilistic consensus through computational work."""

    async def propose_block(self, agent_id: str, proposals: List[Proposal]) -> Block:
        """Agent creates block by finding valid proof of work."""

        nonce = 0
        while True:
            block = Block(
                proposer=agent_id,
                proposals=proposals,
                previous_hash=self.chain[-1].hash,
                nonce=nonce,
                timestamp=time.time()
            )

            if block.hash.startswith('0' * self.difficulty):
                return block

            nonce += 1

    def is_valid_chain(self, chain: List[Block]) -> bool:
        """Validate chain - longest valid chain wins."""
        for i in range(1, len(chain)):
            if chain[i].previous_hash != chain[i-1].hash:
                return False
            if not chain[i].hash.startswith('0' * self.difficulty):
                return False
        return True
```

### Proof of Stake for Agents

Agent "stake" could be reputation or trust score:

```python
class ProofOfStakeConsensus:
    """Consensus weighted by agent trust scores."""

    async def select_proposer(self) -> Agent:
        """Select proposer weighted by trust score."""
        total_stake = sum(a.trust_score for a in self.agents)

        threshold = random.random() * total_stake
        cumulative = 0

        for agent in self.agents:
            cumulative += agent.trust_score
            if cumulative >= threshold:
                return agent

        return self.agents[-1]  # Fallback

    async def validate_proposal(self, proposal: Proposal, proposer: Agent) -> bool:
        """Validators vote on proposal."""
        votes = await asyncio.gather(*[
            validator.vote(proposal) for validator in self.validators
        ])

        # Weight votes by validator trust scores
        weighted_approval = sum(
            v.trust_score for v, vote in zip(self.validators, votes) if vote
        )
        total_stake = sum(v.trust_score for v in self.validators)

        return weighted_approval / total_stake > 0.67  # 2/3 threshold
```

## Consensus Under Uncertainty

### Belief-Based Consensus

When agents have uncertain beliefs:

```python
class BeliefConsensus:
    """Consensus over probability distributions."""

    async def aggregate_beliefs(self, question: str) -> BeliefDistribution:
        """Aggregate agent belief distributions."""

        beliefs = []
        for agent in self.agents:
            # Agent provides probability distribution over answers
            belief = await agent.get_belief_distribution(question)
            beliefs.append(belief)

        # Aggregate using logarithmic opinion pool
        aggregated = self._log_opinion_pool(beliefs)

        return aggregated

    def _log_opinion_pool(self, beliefs: List[BeliefDistribution]) -> BeliefDistribution:
        """Combine beliefs using geometric mean of probabilities."""
        outcomes = beliefs[0].outcomes

        aggregated_probs = {}
        for outcome in outcomes:
            # Geometric mean of probabilities
            log_prob = sum(math.log(b.probability(outcome) + 1e-10) for b in beliefs)
            aggregated_probs[outcome] = math.exp(log_prob / len(beliefs))

        # Normalize
        total = sum(aggregated_probs.values())
        return BeliefDistribution({
            outcome: prob / total for outcome, prob in aggregated_probs.items()
        })
```

## Consensus Performance

### Comparison of Protocols

| Protocol | Fault Tolerance | Messages | Latency | Throughput |
|----------|-----------------|----------|---------|------------|
| **Paxos** | f < n/2 crash | O(n) | 2 RTT | Moderate |
| **Raft** | f < n/2 crash | O(n) | 2 RTT | Moderate |
| **PBFT** | f < n/3 Byzantine | O(n²) | 3 RTT | Lower |
| **HotStuff** | f < n/3 Byzantine | O(n) | 3 RTT | Higher |
| **Nakamoto** | 50% honest hash | O(n) | Minutes | Low |

### Optimizations for Agent Systems

1. **Speculative execution**: Process before consensus completes
2. **Batching**: Group multiple decisions
3. **Pipelining**: Overlap consensus rounds
4. **Hierarchical**: Reduce participation for low-risk decisions

## Research Foundations

- **Paxos Made Simple** (Lamport, 2001) - Foundational consensus
- **In Search of an Understandable Consensus Algorithm** (Ongaro & Ousterhout, 2014) - Raft
- **Practical Byzantine Fault Tolerance** (Castro & Liskov, 1999) - PBFT
- **Bitcoin Whitepaper** (Nakamoto, 2008) - Probabilistic consensus
- **HotStuff** (Yin et al., 2019) - Linear BFT consensus

---

## See Also

- [Multi-Agent Debate](./multi-agent-debate.md) - Consensus through argumentation
- [Trust Scoring](../safety/trust-scoring.md) - Weighting agent opinions
- [Agent Identity](../protocols/agent-identity.md) - Authenticating participants
