---
sidebar_position: 5
title: BASIS Standard
description: Blockchain Agent Standard for Identity and Security
tags: [protocols, basis, trust, governance, blockchain, identity]
---

# BASIS Standard

## Blockchain Agent Standard for Identity and Security

BASIS is a comprehensive framework for establishing trust, identity, and governance for autonomous AI agents. It combines decentralized identity, verifiable credentials, trust scoring, and on-chain verification into a cohesive standard.

## Overview

### The BASIS Vision

```
                         BASIS Ecosystem
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        Agent Layer                                 │  │
│  │  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   │  │
│  │  │ Trading   │   │ Research  │   │ Customer  │   │ Automation│   │  │
│  │  │ Agent     │   │ Agent     │   │ Service   │   │ Agent     │   │  │
│  │  │           │   │           │   │ Agent     │   │           │   │  │
│  │  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   │  │
│  └────────┼───────────────┼───────────────┼───────────────┼────────┘  │
│           │               │               │               │            │
│  ┌────────▼───────────────▼───────────────▼───────────────▼────────┐  │
│  │                      BASIS Protocol                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │  │
│  │  │   Identity   │  │    Trust     │  │  Governance  │           │  │
│  │  │   (DIDs)     │  │   (ATSF)     │  │   (Rules)    │           │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │  │
│  └─────────────────────────────┬────────────────────────────────────┘  │
│                                │                                       │
│  ┌─────────────────────────────▼────────────────────────────────────┐  │
│  │                    Verification Layer                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │  │
│  │  │  On-Chain    │  │   Off-Chain  │  │   Hybrid     │           │  │
│  │  │  Registry    │  │   Proofs     │  │   Anchors    │           │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **BASIS Identity** | Agent identification | DIDs, key management, recovery |
| **ATSF** | Trust scoring | Multi-dimensional scoring framework |
| **Capability Registry** | Permission management | Verifiable capabilities, delegation |
| **Governance Layer** | Rule enforcement | Compliance, constraints, audit |
| **Verification Network** | Cryptographic proofs | On-chain anchoring, attestations |

## BASIS Identity

### Agent DID Method

BASIS defines its own DID method optimized for AI agents:

```
did:basis:network:agent_identifier
         │       │
         │       └── Unique agent ID
         └────────── Network (mainnet, testnet, etc.)

Examples:
• did:basis:mainnet:agent_trader_001
• did:basis:testnet:experimental_bot
• did:basis:enterprise:corp_assistant
```

### DID Document Extensions

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://basis.vorion.org/v1"
  ],
  "id": "did:basis:mainnet:agent_financial_advisor_001",
  "controller": "did:basis:mainnet:enterprise_wealth_mgmt",

  "verificationMethod": [
    {
      "id": "did:basis:mainnet:agent_financial_advisor_001#key-1",
      "type": "JsonWebKey2020",
      "controller": "did:basis:mainnet:agent_financial_advisor_001",
      "publicKeyJwk": { "..." }
    }
  ],

  "authentication": ["#key-1"],
  "assertionMethod": ["#key-1"],
  "capabilityDelegation": ["#key-1"],

  "service": [
    {
      "id": "#a2a-endpoint",
      "type": "A2AEndpoint",
      "serviceEndpoint": "https://advisor.wealth.example.com/a2a"
    },
    {
      "id": "#mcp-server",
      "type": "MCPServer",
      "serviceEndpoint": "https://advisor.wealth.example.com/mcp"
    }
  ],

  "basisExtensions": {
    "agentType": "financial_advisor",
    "version": "2.1.0",
    "modelInfo": {
      "provider": "anthropic",
      "model": "claude-3-opus",
      "version": "20240229"
    },
    "trustRegistration": {
      "registeredAt": "2025-01-01T00:00:00Z",
      "initialScore": 0.75,
      "currentScore": 0.89
    },
    "certifications": [
      "urn:basis:cert:financial-services:level-2",
      "urn:basis:cert:pii-handling:compliant"
    ],
    "constraints": {
      "operatingHours": "09:00-17:00 EST",
      "geographicScope": ["US", "CA"],
      "maxTransactionValue": 100000
    }
  }
}
```

## Agent Trust Scoring Framework (ATSF)

### Trust Score Structure

ATSF provides multi-dimensional trust evaluation:

```python
@dataclass
class ATSFScore:
    """Complete ATSF trust score."""

    # Overall composite score (0-1)
    overall_score: float

    # Component scores
    components: ATSFComponents

    # Metadata
    timestamp: datetime
    evaluator: str  # DID of scoring entity
    confidence: float  # Confidence in this score
    evidence_count: int  # Number of data points

@dataclass
class ATSFComponents:
    """Individual trust components."""

    # Performance metrics
    task_success_rate: float      # Historical success rate
    response_quality: float        # Quality of outputs
    uptime_reliability: float      # Availability

    # Security metrics
    security_posture: float        # Known vulnerabilities
    incident_history: float        # Past security issues
    key_management: float          # Cryptographic hygiene

    # Compliance metrics
    policy_adherence: float        # Rule compliance
    constraint_violations: float   # Boundary respect
    audit_cooperation: float       # Transparency

    # Behavioral metrics
    consistency: float             # Predictable behavior
    boundary_respect: float        # Staying within scope
    escalation_appropriateness: float  # Correct escalation
```

### Calculating Trust Scores

```python
class ATSFCalculator:
    """Calculate ATSF trust scores."""

    # Component weights (configurable per use case)
    DEFAULT_WEIGHTS = {
        "task_success_rate": 0.15,
        "response_quality": 0.10,
        "uptime_reliability": 0.10,
        "security_posture": 0.15,
        "incident_history": 0.10,
        "key_management": 0.05,
        "policy_adherence": 0.10,
        "constraint_violations": 0.10,
        "audit_cooperation": 0.05,
        "consistency": 0.05,
        "boundary_respect": 0.03,
        "escalation_appropriateness": 0.02
    }

    def calculate_overall_score(
        self,
        components: ATSFComponents,
        weights: Dict[str, float] = None
    ) -> float:
        """Calculate weighted overall score."""
        weights = weights or self.DEFAULT_WEIGHTS

        score = 0.0
        for component, weight in weights.items():
            component_value = getattr(components, component)
            score += component_value * weight

        return min(1.0, max(0.0, score))

    async def evaluate_agent(self, agent_did: str) -> ATSFScore:
        """Perform complete trust evaluation."""

        # Gather evidence from multiple sources
        performance_data = await self._get_performance_history(agent_did)
        security_data = await self._get_security_audits(agent_did)
        compliance_data = await self._get_compliance_records(agent_did)
        behavioral_data = await self._get_behavioral_analysis(agent_did)

        components = ATSFComponents(
            # Performance
            task_success_rate=self._calc_success_rate(performance_data),
            response_quality=self._calc_quality_score(performance_data),
            uptime_reliability=self._calc_uptime(performance_data),

            # Security
            security_posture=self._calc_security_score(security_data),
            incident_history=self._calc_incident_score(security_data),
            key_management=self._calc_key_hygiene(security_data),

            # Compliance
            policy_adherence=self._calc_policy_compliance(compliance_data),
            constraint_violations=self._calc_violation_score(compliance_data),
            audit_cooperation=self._calc_audit_score(compliance_data),

            # Behavioral
            consistency=self._calc_consistency(behavioral_data),
            boundary_respect=self._calc_boundary_score(behavioral_data),
            escalation_appropriateness=self._calc_escalation_score(behavioral_data)
        )

        return ATSFScore(
            overall_score=self.calculate_overall_score(components),
            components=components,
            timestamp=datetime.utcnow(),
            evaluator=self.evaluator_did,
            confidence=self._calculate_confidence(performance_data),
            evidence_count=len(performance_data) + len(security_data) + len(compliance_data)
        )
```

### Trust Score Credentials

Trust scores are issued as verifiable credentials:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://basis.vorion.org/v1"
  ],
  "type": ["VerifiableCredential", "ATSFScoreCredential"],
  "issuer": "did:basis:mainnet:trust_oracle_001",
  "issuanceDate": "2025-01-15T12:00:00Z",
  "expirationDate": "2025-01-16T12:00:00Z",
  "credentialSubject": {
    "id": "did:basis:mainnet:agent_financial_advisor_001",
    "atsfScore": {
      "overall": 0.89,
      "components": {
        "taskSuccessRate": 0.94,
        "responseQuality": 0.91,
        "uptimeReliability": 0.99,
        "securityPosture": 0.85,
        "incidentHistory": 0.90,
        "keyManagement": 0.88,
        "policyAdherence": 0.87,
        "constraintViolations": 0.92,
        "auditCooperation": 0.95,
        "consistency": 0.86,
        "boundaryRespect": 0.93,
        "escalationAppropriateness": 0.88
      },
      "confidence": 0.95,
      "evidenceCount": 1247
    }
  },
  "proof": { "..." }
}
```

## Capability Registry

### Capability Definition

```json
{
  "capability": {
    "id": "urn:basis:cap:financial:trading",
    "name": "Automated Trading",
    "version": "1.0.0",
    "description": "Execute trades on financial markets",
    "category": "financial",
    "riskLevel": "high",

    "prerequisites": [
      "urn:basis:cert:financial-services:level-2",
      "urn:basis:cert:aml-kyc:compliant"
    ],

    "constraints": {
      "requiresHumanApproval": {
        "above": 10000,
        "currency": "USD"
      },
      "rateLimits": {
        "tradesPerMinute": 10,
        "tradesPerHour": 100
      },
      "allowedInstruments": ["stocks", "etfs"],
      "prohibitedInstruments": ["derivatives", "crypto"]
    },

    "auditRequirements": {
      "logAllTransactions": true,
      "retentionDays": 2555,
      "realTimeReporting": true
    }
  }
}
```

### Capability Delegation

```python
class CapabilityManager:
    """Manage agent capabilities."""

    async def grant_capability(
        self,
        agent_did: str,
        capability_id: str,
        constraints: dict = None,
        duration_days: int = 365
    ) -> VerifiableCredential:
        """Grant a capability to an agent."""

        # Verify agent meets prerequisites
        prereqs = await self._get_capability_prerequisites(capability_id)
        for prereq in prereqs:
            if not await self._agent_has_certification(agent_did, prereq):
                raise CapabilityError(f"Missing prerequisite: {prereq}")

        # Verify trust score meets threshold
        trust_score = await self.trust_oracle.get_score(agent_did)
        min_trust = await self._get_capability_trust_threshold(capability_id)
        if trust_score.overall_score < min_trust:
            raise CapabilityError(
                f"Trust score {trust_score.overall_score} below threshold {min_trust}"
            )

        # Issue capability credential
        credential = await self.issuer.issue_capability_credential(
            subject_did=agent_did,
            capability_id=capability_id,
            constraints=constraints,
            validity_days=duration_days
        )

        # Register on-chain
        await self.registry.register_capability(
            agent_did=agent_did,
            capability_id=capability_id,
            credential_hash=self._hash_credential(credential)
        )

        return credential

    async def delegate_capability(
        self,
        from_agent: str,
        to_agent: str,
        capability_id: str,
        constraints: dict = None
    ) -> VerifiableCredential:
        """Delegate capability from one agent to another."""

        # Verify source agent has capability with delegation rights
        source_cap = await self._get_agent_capability(from_agent, capability_id)
        if not source_cap or not source_cap.allows_delegation:
            raise CapabilityError("Source agent cannot delegate this capability")

        # Constraints can only be tightened, not loosened
        merged_constraints = self._merge_constraints(
            source_cap.constraints,
            constraints
        )

        # Issue delegation credential
        return await self.issuer.issue_delegation_credential(
            delegator=from_agent,
            delegatee=to_agent,
            capability_id=capability_id,
            constraints=merged_constraints,
            parent_credential=source_cap.credential_id
        )
```

## On-Chain Verification

### Registry Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract BASISRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    struct AgentRecord {
        bytes32 didHash;
        uint256 registeredAt;
        uint256 trustScore;        // Scaled by 1e18
        uint256 trustUpdatedAt;
        bool active;
        bytes32[] capabilities;
    }

    mapping(bytes32 => AgentRecord) public agents;
    mapping(bytes32 => mapping(bytes32 => bool)) public agentCapabilities;

    event AgentRegistered(bytes32 indexed didHash, uint256 timestamp);
    event TrustScoreUpdated(bytes32 indexed didHash, uint256 newScore, uint256 timestamp);
    event CapabilityGranted(bytes32 indexed didHash, bytes32 capabilityHash);
    event CapabilityRevoked(bytes32 indexed didHash, bytes32 capabilityHash);

    function registerAgent(
        bytes32 didHash,
        uint256 initialTrustScore
    ) external onlyRole(REGISTRAR_ROLE) {
        require(agents[didHash].registeredAt == 0, "Agent already registered");

        agents[didHash] = AgentRecord({
            didHash: didHash,
            registeredAt: block.timestamp,
            trustScore: initialTrustScore,
            trustUpdatedAt: block.timestamp,
            active: true,
            capabilities: new bytes32[](0)
        });

        emit AgentRegistered(didHash, block.timestamp);
    }

    function updateTrustScore(
        bytes32 didHash,
        uint256 newScore
    ) external onlyRole(ORACLE_ROLE) {
        require(agents[didHash].registeredAt > 0, "Agent not registered");
        require(agents[didHash].active, "Agent not active");

        agents[didHash].trustScore = newScore;
        agents[didHash].trustUpdatedAt = block.timestamp;

        emit TrustScoreUpdated(didHash, newScore, block.timestamp);
    }

    function grantCapability(
        bytes32 didHash,
        bytes32 capabilityHash
    ) external onlyRole(REGISTRAR_ROLE) {
        require(agents[didHash].active, "Agent not active");
        require(!agentCapabilities[didHash][capabilityHash], "Already has capability");

        agentCapabilities[didHash][capabilityHash] = true;
        agents[didHash].capabilities.push(capabilityHash);

        emit CapabilityGranted(didHash, capabilityHash);
    }

    function verifyCapability(
        bytes32 didHash,
        bytes32 capabilityHash,
        uint256 minTrustScore
    ) external view returns (bool) {
        AgentRecord memory agent = agents[didHash];

        if (!agent.active) return false;
        if (!agentCapabilities[didHash][capabilityHash]) return false;
        if (agent.trustScore < minTrustScore) return false;

        return true;
    }
}
```

### Verification Flow

```python
class BASISVerifier:
    """Verify agent status on-chain."""

    def __init__(self, registry_contract, web3_provider):
        self.registry = registry_contract
        self.w3 = web3_provider

    async def verify_agent_capability(
        self,
        agent_did: str,
        capability_id: str,
        min_trust_score: float = 0.5
    ) -> VerificationResult:
        """Verify agent has capability on-chain."""

        did_hash = self._hash_did(agent_did)
        cap_hash = self._hash_capability(capability_id)
        scaled_trust = int(min_trust_score * 1e18)

        # Check on-chain
        is_valid = await self.registry.functions.verifyCapability(
            did_hash,
            cap_hash,
            scaled_trust
        ).call()

        if not is_valid:
            return VerificationResult(
                valid=False,
                error="On-chain verification failed"
            )

        # Get current trust score
        agent_record = await self.registry.functions.agents(did_hash).call()

        return VerificationResult(
            valid=True,
            agent_did=agent_did,
            capability=capability_id,
            trust_score=agent_record.trustScore / 1e18,
            verified_at=datetime.utcnow()
        )
```

## Governance Framework

### Rule Engine

```python
class BASISGovernanceEngine:
    """Enforce governance rules on agent actions."""

    def __init__(self, rules_config: dict):
        self.rules = self._parse_rules(rules_config)

    async def evaluate_action(
        self,
        agent_did: str,
        action: AgentAction,
        context: dict
    ) -> GovernanceDecision:
        """Evaluate if action is permitted."""

        decisions = []
        for rule in self.rules:
            if rule.applies_to(action):
                decision = await rule.evaluate(agent_did, action, context)
                decisions.append(decision)

                if decision.action == "DENY":
                    return GovernanceDecision(
                        permitted=False,
                        reason=decision.reason,
                        rule_id=rule.id
                    )

        return GovernanceDecision(
            permitted=True,
            applied_rules=[d.rule_id for d in decisions]
        )

# Example rules configuration
GOVERNANCE_RULES = {
    "rules": [
        {
            "id": "trust-threshold",
            "description": "Require minimum trust for high-value actions",
            "condition": {
                "action_type": "financial_transaction",
                "amount_usd": {"$gt": 1000}
            },
            "requirement": {
                "trust_score": {"$gte": 0.8}
            }
        },
        {
            "id": "human-approval",
            "description": "Require human approval for certain actions",
            "condition": {
                "action_type": {"$in": ["delete_data", "modify_permissions"]}
            },
            "requirement": {
                "human_approval": true
            }
        },
        {
            "id": "rate-limit",
            "description": "Rate limit API calls",
            "condition": {
                "action_type": "external_api_call"
            },
            "requirement": {
                "rate_limit": {
                    "max": 100,
                    "window_seconds": 60
                }
            }
        }
    ]
}
```

## Integration Example

### Complete BASIS Agent

```python
class BASISAgent:
    """Agent fully integrated with BASIS protocol."""

    def __init__(self, config: BASISConfig):
        # Identity
        self.did_manager = AgentDIDManager()
        self.did, self.did_document, self.private_key = self.did_manager.create_did_basis(
            config.agent_id
        )

        # Trust
        self.trust_oracle = ATSFTrustOracle(config.trust_oracle_url)

        # Capabilities
        self.capability_manager = CapabilityManager(config.registry_url)

        # Governance
        self.governance = BASISGovernanceEngine(config.governance_rules)

        # Verification
        self.verifier = BASISVerifier(config.registry_contract, config.web3)

    async def execute_action(self, action: AgentAction) -> ActionResult:
        """Execute action with full BASIS compliance."""

        # 1. Check governance rules
        governance_check = await self.governance.evaluate_action(
            self.did, action, self._get_context()
        )
        if not governance_check.permitted:
            return ActionResult(
                success=False,
                error=f"Governance denied: {governance_check.reason}"
            )

        # 2. Verify we have required capability
        required_cap = self._get_required_capability(action)
        if required_cap:
            cap_check = await self.verifier.verify_agent_capability(
                self.did, required_cap
            )
            if not cap_check.valid:
                return ActionResult(
                    success=False,
                    error=f"Missing capability: {required_cap}"
                )

        # 3. Execute action
        result = await self._execute(action)

        # 4. Log for trust scoring
        await self._log_action_for_trust(action, result)

        return result
```

## Research and Roadmap

BASIS continues to evolve:

- **Cross-chain support**: Multi-blockchain verification
- **Zero-knowledge proofs**: Privacy-preserving trust verification
- **Federated governance**: Cross-organization rule enforcement
- **Agent insurance**: Risk pooling for autonomous agents

---

## See Also

- [Agent Identity](./agent-identity.md) - DID/VC foundations
- [Trust Scoring](../safety/trust-scoring.md) - ATSF deep dive
- [BASIS Documentation](https://vorion.org/basis) - Official specification
