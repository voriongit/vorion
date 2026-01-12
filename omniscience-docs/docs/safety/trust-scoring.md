---
sidebar_position: 2
title: Trust Scoring
description: Evaluating and quantifying AI agent trustworthiness
tags: [safety, trust, scoring, atsf, verification]
---

# Trust Scoring

## Quantifying Agent Trustworthiness

Trust scoring provides a systematic way to evaluate and quantify how trustworthy an AI agent is. Rather than binary trust decisions, multi-dimensional scoring enables nuanced access control and risk management.

## Why Trust Scoring?

```
              Binary Trust vs Trust Scoring
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Binary Trust                    Trust Scoring                         │
│                                                                         │
│   ┌──────────────────┐           ┌──────────────────┐                  │
│   │                  │           │                  │                  │
│   │   TRUSTED  ───── │           │  0.92 ■■■■■■■■■░ │ Performance      │
│   │      or          │     vs    │  0.85 ■■■■■■■■░░ │ Security         │
│   │   UNTRUSTED ──── │           │  0.78 ■■■■■■■░░░ │ Compliance       │
│   │                  │           │  0.95 ■■■■■■■■■░ │ Consistency      │
│   │                  │           │                  │                  │
│   └──────────────────┘           │  Overall: 0.87   │                  │
│                                  └──────────────────┘                  │
│                                                                         │
│   • All-or-nothing decisions     • Graduated access control            │
│   • No nuance                    • Risk-proportionate responses        │
│   • Gaming is easy               • Multi-dimensional verification      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Agent Trust Scoring Framework (ATSF)

### Score Components

```python
@dataclass
class ATSFScore:
    """Complete ATSF trust score structure."""

    # Overall score (0.0 - 1.0)
    overall: float

    # Component scores
    performance: PerformanceScore
    security: SecurityScore
    compliance: ComplianceScore
    behavioral: BehavioralScore

    # Metadata
    timestamp: datetime
    evaluator_did: str
    confidence: float
    evidence_count: int

    def meets_threshold(self, threshold: float) -> bool:
        """Check if score meets minimum threshold."""
        return self.overall >= threshold

    def get_weakest_component(self) -> Tuple[str, float]:
        """Identify the weakest trust component."""
        components = {
            "performance": self.performance.overall,
            "security": self.security.overall,
            "compliance": self.compliance.overall,
            "behavioral": self.behavioral.overall
        }
        return min(components.items(), key=lambda x: x[1])


@dataclass
class PerformanceScore:
    """Performance-related trust metrics."""

    task_success_rate: float      # Successful task completions
    response_quality: float        # Quality of outputs
    uptime_reliability: float      # Availability track record
    efficiency: float              # Resource usage efficiency

    @property
    def overall(self) -> float:
        """Weighted overall performance score."""
        return (
            0.4 * self.task_success_rate +
            0.3 * self.response_quality +
            0.2 * self.uptime_reliability +
            0.1 * self.efficiency
        )


@dataclass
class SecurityScore:
    """Security-related trust metrics."""

    vulnerability_count: float     # Inverse of known vulnerabilities
    incident_history: float        # Clean security history
    key_management: float          # Cryptographic hygiene
    access_patterns: float         # Normal vs suspicious access

    @property
    def overall(self) -> float:
        return (
            0.3 * self.vulnerability_count +
            0.3 * self.incident_history +
            0.2 * self.key_management +
            0.2 * self.access_patterns
        )


@dataclass
class ComplianceScore:
    """Compliance-related trust metrics."""

    policy_adherence: float        # Following stated policies
    constraint_respect: float      # Staying within bounds
    audit_cooperation: float       # Transparency in audits
    regulatory_compliance: float   # Meeting legal requirements

    @property
    def overall(self) -> float:
        return (
            0.3 * self.policy_adherence +
            0.3 * self.constraint_respect +
            0.2 * self.audit_cooperation +
            0.2 * self.regulatory_compliance
        )


@dataclass
class BehavioralScore:
    """Behavioral trust metrics."""

    consistency: float             # Predictable behavior
    boundary_respect: float        # Staying within role
    escalation_quality: float      # Appropriate escalations
    honesty: float                 # Truthful reporting

    @property
    def overall(self) -> float:
        return (
            0.3 * self.consistency +
            0.3 * self.boundary_respect +
            0.2 * self.escalation_quality +
            0.2 * self.honesty
        )
```

### Calculating Trust Scores

```python
class TrustScoreCalculator:
    """Calculate comprehensive trust scores."""

    def __init__(self, config: ScoringConfig):
        self.component_weights = config.weights
        self.data_sources = config.data_sources
        self.minimum_evidence = config.minimum_evidence

    async def calculate(self, agent_did: str) -> ATSFScore:
        """Calculate complete trust score for an agent."""

        # Gather evidence from all sources
        evidence = await self._gather_evidence(agent_did)

        if len(evidence) < self.minimum_evidence:
            return self._default_score(agent_did, evidence_count=len(evidence))

        # Calculate component scores
        performance = await self._calculate_performance(evidence)
        security = await self._calculate_security(evidence)
        compliance = await self._calculate_compliance(evidence)
        behavioral = await self._calculate_behavioral(evidence)

        # Calculate overall score
        overall = (
            self.component_weights["performance"] * performance.overall +
            self.component_weights["security"] * security.overall +
            self.component_weights["compliance"] * compliance.overall +
            self.component_weights["behavioral"] * behavioral.overall
        )

        # Calculate confidence based on evidence quality
        confidence = self._calculate_confidence(evidence)

        return ATSFScore(
            overall=overall,
            performance=performance,
            security=security,
            compliance=compliance,
            behavioral=behavioral,
            timestamp=datetime.utcnow(),
            evaluator_did=self.evaluator_did,
            confidence=confidence,
            evidence_count=len(evidence)
        )

    async def _gather_evidence(self, agent_did: str) -> List[Evidence]:
        """Gather evidence from all configured sources."""

        evidence = []

        for source in self.data_sources:
            try:
                source_evidence = await source.get_evidence(agent_did)
                evidence.extend(source_evidence)
            except Exception as e:
                logging.warning(f"Failed to get evidence from {source}: {e}")

        return evidence

    async def _calculate_performance(self, evidence: List[Evidence]) -> PerformanceScore:
        """Calculate performance component."""

        # Filter relevant evidence
        perf_evidence = [e for e in evidence if e.category == "performance"]

        # Task success rate
        task_results = [e for e in perf_evidence if e.type == "task_result"]
        success_rate = sum(1 for t in task_results if t.success) / len(task_results) if task_results else 0.5

        # Response quality (from feedback)
        quality_scores = [e.score for e in perf_evidence if e.type == "quality_rating"]
        avg_quality = np.mean(quality_scores) if quality_scores else 0.5

        # Uptime
        uptime_records = [e for e in perf_evidence if e.type == "uptime"]
        uptime = np.mean([u.availability for u in uptime_records]) if uptime_records else 0.5

        # Efficiency
        efficiency_records = [e for e in perf_evidence if e.type == "efficiency"]
        efficiency = np.mean([e.score for e in efficiency_records]) if efficiency_records else 0.5

        return PerformanceScore(
            task_success_rate=success_rate,
            response_quality=avg_quality,
            uptime_reliability=uptime,
            efficiency=efficiency
        )
```

## Trust Score Sources

### Data Collection

```python
class TrustDataSource(ABC):
    """Abstract base for trust data sources."""

    @abstractmethod
    async def get_evidence(self, agent_did: str) -> List[Evidence]:
        """Retrieve evidence for an agent."""
        pass


class TaskHistorySource(TrustDataSource):
    """Evidence from task execution history."""

    async def get_evidence(self, agent_did: str) -> List[Evidence]:
        tasks = await self.task_store.get_agent_tasks(agent_did, limit=1000)

        evidence = []
        for task in tasks:
            evidence.append(Evidence(
                category="performance",
                type="task_result",
                success=task.success,
                timestamp=task.completed_at,
                metadata={"task_type": task.type}
            ))

        return evidence


class SecurityAuditSource(TrustDataSource):
    """Evidence from security audits."""

    async def get_evidence(self, agent_did: str) -> List[Evidence]:
        audits = await self.audit_store.get_agent_audits(agent_did)

        evidence = []
        for audit in audits:
            evidence.append(Evidence(
                category="security",
                type="audit_result",
                score=audit.score,
                issues=audit.issues,
                timestamp=audit.completed_at
            ))

        return evidence


class OnChainSource(TrustDataSource):
    """Evidence from blockchain records."""

    async def get_evidence(self, agent_did: str) -> List[Evidence]:
        # Get on-chain attestations
        attestations = await self.blockchain.get_attestations(agent_did)

        evidence = []
        for attestation in attestations:
            evidence.append(Evidence(
                category=attestation.category,
                type="attestation",
                score=attestation.score,
                issuer=attestation.issuer,
                timestamp=attestation.timestamp,
                verifiable=True  # Can be cryptographically verified
            ))

        return evidence
```

## Trust Score Decay

### Temporal Dynamics

```python
class TrustDecayManager:
    """Handle trust score decay over time."""

    def __init__(self, config: DecayConfig):
        self.base_decay_rate = config.base_decay_rate  # e.g., 0.001 per day
        self.max_decay = config.max_decay              # e.g., 0.2 (20%)
        self.inactivity_threshold = config.inactivity_threshold

    def apply_decay(
        self,
        score: ATSFScore,
        last_activity: datetime
    ) -> ATSFScore:
        """Apply time-based decay to trust score."""

        days_inactive = (datetime.utcnow() - last_activity).days

        if days_inactive <= self.inactivity_threshold:
            return score  # No decay for active agents

        # Calculate decay
        decay_days = days_inactive - self.inactivity_threshold
        decay_factor = min(
            self.base_decay_rate * decay_days,
            self.max_decay
        )

        # Apply decay to overall score
        decayed_overall = score.overall * (1 - decay_factor)

        return ATSFScore(
            overall=decayed_overall,
            performance=score.performance,
            security=score.security,
            compliance=score.compliance,
            behavioral=score.behavioral,
            timestamp=datetime.utcnow(),
            evaluator_did=score.evaluator_did,
            confidence=score.confidence * (1 - decay_factor / 2),
            evidence_count=score.evidence_count
        )

    def apply_incident_decay(
        self,
        score: ATSFScore,
        incident: SecurityIncident
    ) -> ATSFScore:
        """Apply immediate decay for security incidents."""

        severity_impact = {
            "critical": 0.5,
            "high": 0.3,
            "medium": 0.15,
            "low": 0.05
        }

        impact = severity_impact.get(incident.severity, 0.1)

        # Primarily affects security score
        new_security = SecurityScore(
            vulnerability_count=score.security.vulnerability_count * (1 - impact),
            incident_history=score.security.incident_history * (1 - impact * 2),
            key_management=score.security.key_management,
            access_patterns=score.security.access_patterns * (1 - impact)
        )

        # Recalculate overall
        new_overall = (
            0.25 * score.performance.overall +
            0.35 * new_security.overall +  # Higher weight after incident
            0.2 * score.compliance.overall +
            0.2 * score.behavioral.overall
        )

        return ATSFScore(
            overall=new_overall,
            performance=score.performance,
            security=new_security,
            compliance=score.compliance,
            behavioral=score.behavioral,
            timestamp=datetime.utcnow(),
            evaluator_did=score.evaluator_did,
            confidence=score.confidence,
            evidence_count=score.evidence_count
        )
```

## Trust-Based Access Control

### Threshold Policies

```python
class TrustBasedAccessControl:
    """Control access based on trust scores."""

    def __init__(self, policies: List[TrustPolicy]):
        self.policies = policies

    async def authorize(
        self,
        agent_did: str,
        action: Action,
        context: Context
    ) -> AuthorizationResult:
        """Authorize action based on trust score."""

        # Get current trust score
        score = await self.trust_oracle.get_score(agent_did)

        # Find applicable policy
        policy = self._find_policy(action)

        if not policy:
            return AuthorizationResult(
                authorized=False,
                reason="No policy found for action"
            )

        # Check overall threshold
        if score.overall < policy.min_overall_score:
            return AuthorizationResult(
                authorized=False,
                reason=f"Trust score {score.overall:.2f} below threshold {policy.min_overall_score}"
            )

        # Check component thresholds
        for component, threshold in policy.component_thresholds.items():
            component_score = getattr(score, component).overall
            if component_score < threshold:
                return AuthorizationResult(
                    authorized=False,
                    reason=f"{component} score {component_score:.2f} below threshold {threshold}"
                )

        # Check context-specific requirements
        if policy.context_requirements:
            context_check = self._check_context_requirements(
                score, policy.context_requirements, context
            )
            if not context_check.passed:
                return AuthorizationResult(
                    authorized=False,
                    reason=context_check.reason
                )

        return AuthorizationResult(
            authorized=True,
            trust_score=score,
            policy_applied=policy.id
        )


# Example policies
TRUST_POLICIES = [
    TrustPolicy(
        id="read_public_data",
        action_pattern="read:public:*",
        min_overall_score=0.3,
        component_thresholds={}
    ),
    TrustPolicy(
        id="write_user_data",
        action_pattern="write:user:*",
        min_overall_score=0.7,
        component_thresholds={
            "security": 0.8,
            "compliance": 0.75
        }
    ),
    TrustPolicy(
        id="execute_financial",
        action_pattern="execute:financial:*",
        min_overall_score=0.85,
        component_thresholds={
            "security": 0.9,
            "compliance": 0.9,
            "behavioral": 0.85
        },
        context_requirements={
            "max_amount": lambda ctx, score: ctx.amount < 10000 * score.overall
        }
    )
]
```

## Trust Score Credentials

### Verifiable Trust

```python
class TrustCredentialIssuer:
    """Issue verifiable credentials for trust scores."""

    async def issue_trust_credential(
        self,
        agent_did: str,
        score: ATSFScore,
        validity_hours: int = 24
    ) -> VerifiableCredential:
        """Issue a verifiable credential for the trust score."""

        credential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://basis.vorion.org/credentials/v1"
            ],
            "type": ["VerifiableCredential", "ATSFScoreCredential"],
            "issuer": self.issuer_did,
            "issuanceDate": datetime.utcnow().isoformat() + "Z",
            "expirationDate": (
                datetime.utcnow() + timedelta(hours=validity_hours)
            ).isoformat() + "Z",
            "credentialSubject": {
                "id": agent_did,
                "atsfScore": {
                    "overall": score.overall,
                    "performance": score.performance.overall,
                    "security": score.security.overall,
                    "compliance": score.compliance.overall,
                    "behavioral": score.behavioral.overall,
                    "confidence": score.confidence,
                    "evidenceCount": score.evidence_count
                }
            }
        }

        # Sign credential
        credential["proof"] = await self._create_proof(credential)

        return VerifiableCredential(**credential)

    async def verify_trust_credential(
        self,
        credential: VerifiableCredential
    ) -> VerificationResult:
        """Verify a trust credential."""

        # Check expiration
        if datetime.fromisoformat(credential.expirationDate.rstrip("Z")) < datetime.utcnow():
            return VerificationResult(valid=False, reason="Credential expired")

        # Verify signature
        signature_valid = await self._verify_proof(credential)
        if not signature_valid:
            return VerificationResult(valid=False, reason="Invalid signature")

        # Check issuer is trusted
        if credential.issuer not in self.trusted_issuers:
            return VerificationResult(valid=False, reason="Untrusted issuer")

        return VerificationResult(
            valid=True,
            score=ATSFScore.from_credential(credential),
            issuer=credential.issuer
        )
```

## Research Foundations

- **ATSF** (Vorion, 2025) - Agent Trust Scoring Framework
- **Trust in Multi-Agent Systems** (Ramchurn et al., 2004)
- **Reputation Systems** (Resnick et al., 2000)
- **Verifiable Credentials** (W3C, 2022)

---

## See Also

- [BASIS Standard](../protocols/basis-standard.md) - Trust framework protocol
- [Capability Gating](./capability-gating.md) - Using trust for access control
- [Agent Identity](../protocols/agent-identity.md) - Identity verification
