# Agent Classification Identifier (ACI) Standards - Consolidated v1.1.0
**With Vorion Implementation as First Working Example**

**Status**: Foundation Ready for Industry Publication  
**Date**: January 2026  
**Authors**: AgentAnchor (A3I), Vorion Team  
**License**: Apache 2.0

---

## Executive Summary

The **Agent Classification Identifier (ACI)** is an industry-grade standard for identifying, certifying, and routing autonomous AI agents based on their capabilities, autonomy levels, and trust assurance. It provides a human and machine-readable format for expressing agent identity and trustworthiness:

```
a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0
```

This breaks down as:
- **Registry**: `a3i` (AgentAnchor)
- **Organization**: `vorion` (Vorion platform)
- **Agent Class**: `banquet-advisor` (specific agent)
- **Domains**: `FHC` (Finance, Helpdesk, Communications)
- **Autonomy Level**: `L3` (Execute with approval)
- **Trust Tier**: `T2` (Tested)
- **Version**: `1.2.0`

**Vorion**, as the first production implementation, demonstrates how ACI integrates with real governance, trust scoring, and constrained execution architectures.

---

## 1. Problem Statement

Current AI agent ecosystems lack standardized identity and capability certification. This creates:

- **Discovery Gap**: No standard way to query agent capabilities
- **Trust Gap**: No objective means to verify agent certification
- **Routing Gap**: No standard basis for access control decisions
- **Governance Gap**: No framework for graduated autonomy based on behavior

Vorion solved these internally (SPEC-002). **ACI standardizes and extends Vorion's approach for industry use.**

---

## 2. Core ACI Architecture

### 2.1 Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Semantic Governance & Runtime Assurance           │
│           (Behavioral monitoring, drift detection, etc.)    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Capability Certification & Extension Hooks        │
│           (What the agent can do, how it's verified)        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Identity & Trust Primitives (Core Spec)           │
│           (WHO: DIDs, OIDC; WHAT: Domains/Levels/Tiers)    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Core Format Specification

```
[Registry].[Organization].[AgentClass]:[Domains]-L[Level]-T[Tier]@[Version]
```

#### Registry
- Namespace authority (e.g., `a3i`, `ibm`, `openai`)
- Decentralized via DID resolution
- Maps to certification authority

#### Organization
- Org running the agent (e.g., `vorion`, `acme-corp`)
- Can be different from registry

#### Agent Class
- Human-readable identifier
- Examples: `banquet-advisor`, `code-reviewer`, `financial-analyst`

#### Domains (Bitmask)
Each agent declares which functional areas it operates in:

| Domain | Code | Description |
|--------|------|-------------|
| Finance | F | Handles payments, budgets, financial analysis |
| Helpdesk | H | Customer support, troubleshooting |
| Communications | C | Email, messaging, notifications |
| External | E | Third-party API integration |
| Infrastructure | I | System configuration, deployments |
| Security | S | Authentication, authorization, audits |

Combined as bitmask: `FHC` = Finance + Helpdesk + Communications

#### Autonomy Levels (L0-L5)

| Level | Name | Definition | Human Approval | Vorion Equivalent |
|-------|------|-----------|-----------------|-------------------|
| L0 | **Observe** | Read-only, analysis only | Every action | T0: Sandbox |
| L1 | **Advise** | Recommends actions | Every action | T1: Supervised |
| L2 | **Draft** | Prepares/stages actions | Before commit | T2: Constrained |
| L3 | **Execute** | Executes with oversight | Periodic review | T3: Trusted |
| L4 | **Autonomous** | Self-directed action | Exception-based | T4: Autonomous |
| L5 | **Sovereign** | Mission-critical, no limits | Audit-only | T5: Sovereign |

**Key Insight**: L0-L2 are advisory (human decides), L3+ require escalating trust.

#### Trust Tiers (T0-T5)

| Tier | Name | Certification Basis | Verification | Industry Example |
|------|------|-------------------|--------------|------------------|
| T0 | **Unverified** | No audit | None | Raw agent code, not tested |
| T1 | **Registered** | Identity only | DID proof | Agent registered in catalog |
| T2 | **Tested** | Capability tests pass | Automated tests | Passes unit/integration tests |
| T3 | **Certified** | Third-party audit | Manual review | Audit firm signed off |
| T4 | **Verified** | Continuous monitoring | Runtime checks | Ongoing behavior validation |
| T5 | **Sovereign** | Maximum assurance | Formal verification | Cryptographic proof chain |

**Trust vs. Autonomy**: An agent can be `T5-Certified` but run at `L2-Draft` in a sensitive context.

#### Version (Semantic)
- `major.minor.patch` (e.g., `1.2.0`)
- Matches agent code version
- Used for compatibility checks

---

## 3. Vorion Integration: The Working Example

### 3.1 Vorion Architecture Overview

**Vorion** is an enterprise governance platform with five core components:

```
┌──────────┐    ┌────────┐    ┌────────┐    ┌──────────┐
│  INTENT  │───>│ BASIS  │───>│ENFORCE │───>│COGNIGATE │
│ (Goals)  │    │(Rules) │    │(Decide)│    │(Execute) │
└──────────┘    └────────┘    └────────┘    └──────────┘
      │                              │             │
      │                              └────────┬────┘
      │                                       │
      └───────────────────────┬───────────────┘
                              ▼
                    ┌──────────────────┐
                    │   PROOF CHAIN    │
                    │ (Evidence Store) │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  TRUST ENGINE    │
                    │(Behavioral Score)│
                    └──────────────────┘
```

**Components**:
- **INTENT**: Goal + context processing (What do we want?)
- **BASIS**: Rule evaluation engine (What are the rules?)
- **ENFORCE**: Policy decision point (Can we do this?)
- **COGNIGATE**: Constrained execution (How do we do it safely?)
- **PROOF**: Immutable evidence chain (What happened?)
- **TRUST ENGINE**: Behavioral trust scoring with decay (How much do we trust it?)

### 3.2 How Vorion Implements ACI

#### Example: Banquet Advisor Agent

**ACI String**: `a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0`

**What this means**:
- Certified by AgentAnchor's registry
- Built by Vorion
- Can handle Finance (budgets), Helpdesk (questions), Communications (notifications)
- Can Execute with approval (L3)
- Has passed testing (T2)

#### Vorion SPEC-002: Trust Scoring Integration

Vorion extends ACI by adding behavioral trust scoring. The core formula:

```
Trust Score = (Certification Weight × 300) 
            + (Behavior History × 400) 
            + (Context Factors × 300)
            ÷ 1000

Certification Weight:
  T0: 0.0 (no cert)
  T1: 0.2 (identity only)
  T2: 0.4 (testing passed)
  T3: 0.6 (audit passed)
  T4: 0.8 (continuous monitoring)
  T5: 1.0 (sovereign assurance)

Behavior History:
  Days without incident × incident rate → score 0-1.0

Context Factors:
  - User's previous approvals
  - Task complexity
  - Resource costs
  - Risk classification
```

**Outcome**: Real-time trust decision for autonomy granting.

---

## 4. Security Hardening: Enterprise-Grade Protections

### 4.1 DPoP (Demonstrating Proof-of-Possession)

**Problem**: Stolen tokens can be replayed by attackers.

**Solution**: Sender-constrained tokens that prove the agent holds the private key.

```typescript
interface DPoPProof {
  jti: string;        // Unique token ID
  htm: string;        // HTTP method (GET, POST)
  htu: string;        // HTTP URI
  iat: number;        // Issued at timestamp
  exp: number;        // Expiry (5-15 minutes)
  jwk: JsonWebKey;    // Agent's public key
  aud: string;        // Audience (API endpoint)
}

// Validation chain:
1. Verify DPoP signature matches jwk
2. Verify token thumbprint matches DPoP public key
3. Verify htm/htu match incoming request
4. Verify iat within acceptable window
5. Check jti against revocation list
```

**Vorion Integration**: 
- All T3+ agents must use DPoP
- Embedded in COGNIGATE's execution gateway
- Prevents confused deputy attacks

### 4.2 TEE (Trusted Execution Environment) Binding

**For T4+ Agents**: Cryptographic proof that code runs in a secure enclave.

```typescript
interface TEEAttestation {
  platform: 'sgx' | 'sev' | 'trustzone';
  nonce: string;
  measurements: {
    code_hash: string;      // SHA-256 of executable
    data_hash: string;      // Memory state hash
    config_hash: string;    // Configuration hash
  };
  timestamp: number;
  signature: string;        // Signed by enclave key
}
```

**Vorion Use Case**:
- High-value financial transactions (L4 agents)
- Healthcare data access
- Critical infrastructure control

### 4.3 Semantic Governance (Layer 5)

**Problem**: Prompt injection attacks circumvent rules by modifying agent instructions.

**Solution**: Cryptographic binding of intents to execution constraints.

```typescript
interface SemanticGovernance {
  // 1. Instruction Integrity
  instruction_hash: string;  // SHA-256(user's stated goal)
  instruction_binding: string; // Prevents modification
  
  // 2. Output Binding
  expected_schema: JsonSchema;  // Required output format
  output_validator: (output) => boolean;
  
  // 3. Inference Scope
  allowable_contexts: string[];  // Data agent can reason about
  denied_contexts: string[];     // Explicitly forbidden
  
  // 4. Dual-Channel Auth
  control_channel: SecureChannel;  // Signed instructions
  data_channel: EncryptedChannel;  // Agent's working data
}
```

**Vorion Implementation**:
- Embedded in BASIS rule engine
- Validated at ENFORCE checkpoint
- Audit trail in PROOF chain

---

## 5. Registry & Discovery API

### 5.1 Agent Registration

```typescript
interface AgentRegistration {
  aci: string;                      // ACI identifier
  did: string;                       // Decentralized ID
  name: string;
  description: string;
  domains: string[];                 // F, H, C, E, I, S
  supported_levels: number[];        // L0-L5
  supported_tiers: number[];         // T0-T5
  entry_point: string;              // URL or function
  documentation_url: string;
  
  // Trust metadata
  certified_by: string;              // Registry authority
  certification_date: Date;
  audit_report_url?: string;
  security_scans: ScanResult[];
  
  // Behavior tracking
  error_rate: number;                // Incidents per 1000 invocations
  latency_p99: number;              // Milliseconds
  cost_per_invocation: number;
  
  // Vorion-specific
  trust_tier_current: number;        // Runtime trust score
  behavior_history: BehaviorRecord[];
  autonomy_milestones: Milestone[];
}
```

### 5.2 Query API Examples

```bash
# Find all Finance agents at L3+
GET /agents?domains=F&min_level=3

# Find certified (T3+) agents
GET /agents?min_tier=3

# Find agents for a specific use case
GET /agents?domains=HC&supported_levels=2,3,4

# Get full certification details
GET /agents/a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0

# Check real-time trust score
GET /agents/{aci}/trust-score
```

### 5.3 Revocation & Lifecycle

```typescript
interface RevocationStatus {
  is_revoked: boolean;
  revocation_date?: Date;
  revocation_reason?: string;  // "security", "unprofessional", "violation"
  revocation_sla?: number;     // Milliseconds to propagate (1s for T4+)
  
  is_deprecated: boolean;
  deprecation_date?: Date;
  migration_path?: string;     // Recommended replacement agent
  
  is_suspended: boolean;
  suspension_reason?: string;
  suspension_duration?: number; // Minutes
}
```

---

## 6. Extension Protocol: Plugging in Cognigate

ACI's Layer 2 defines hooks for custom execution engines like Cognigate.

### 6.1 Hook Structure

```typescript
interface ExecutionExtension {
  // Pre-execution hook
  preCheck(
    agent: AgentSpec,
    intent: Intent,
    context: ExecutionContext
  ): Promise<ExecutionResult>;
  
  // Post-execution hook
  postAction(
    agent: AgentSpec,
    result: ExecutionResult,
    proof: ProofChain
  ): Promise<void>;
  
  // Behavioral verification
  verifyBehavior(
    agent: AgentSpec,
    actionLog: ActionLog[],
    trustScore: TrustScore
  ): Promise<BehaviorVerification>;
  
  // Constraint enforcement
  enforceConstraints(
    agent: AgentSpec,
    proposedAction: Action
  ): Promise<boolean>;
}
```

### 6.2 Vorion as Extension Example

**Cognigate in ACI Context**:

```
REQUEST with ACI identifier
         ↓
    REGISTRY LOOKUP
    (Resolve ACI string)
         ↓
   TRUST SCORE CHECK
   (Vorion: score ≥ min for tier?)
         ↓
   SEMANTIC GOVERNANCE
   (Verify intent binding)
         ↓
   COGNIGATE EXECUTION
   (Run with constraints)
         ↓
   PROOF GENERATION
   (Create immutable evidence)
         ↓
   TRUST UPDATES
   (Update behavior history)
```

---

## 7. The Ralph Wiggum Standard: Human-Centric Safety

**Problem**: Complex security interfaces fail when used by non-technical humans.

**Solution**: Apply "Poka-Yoke" (mistake-proofing) principles from industrial safety.

### 7.1 Traffic Light Protocol (TLS)

Agent status conveyed through universal signals:

```
🟢 GREEN: Safe execution (read-only, sandboxed)
🟡 AMBER: Draft mode (staged for approval)
🔴 RED: Danger zone (destructive action, requires confirmation)
```

### 7.2 Petname System for Identifiers

**Problem**: DIDs look like garbage to humans.  
**Solution**: Users assign local, memorable names.

```
Global Identity: did:key:z6Mkha7gVavdGV...
Local Petname: "My Finance Bot"

If another agent claims to be "Finance Bot" but has a different key?
System displays: "Unknown Stranger" → User knows it's not their bot.
```

### 7.3 Permission Model: "Can I...?" 

Not: "Allow INTERNET permission?"  
But: "Can I search the web for flight prices?"

```typescript
interface HumanReadablePermission {
  action: string;              // "search_web", "send_email"
  consequence: string;         // "This might cost $0.50"
  risk_icon: "📋" | "💰" | "🛡️" | "🗑️";  // Context, Cost, Security, Destructive
  approval_required: boolean;  // Just-in-Time
}
```

### 7.4 AI Nutrition Label

Before using an agent, display simple, standardized info:

```
🤖 BANQUET ADVISOR v1.2.0

📍 PURPOSE: Helps plan meals and events

⚙️ CAPABILITIES:
  ✓ Access your calendar
  ✓ Search the web for recipes
  ✗ Send emails without approval
  ✗ Spend money

⚠️ LIMITATIONS:
  • May suggest outdated recipes (training cutoff: Jan 2024)
  • Not a certified nutritionist
  • Requires internet connection

🔒 TRUST LEVEL: T2 (Tested)
   ✓ Passed automated tests
   ✗ No independent audit yet
   
📅 UPDATED: 2025.04 (4 months old)
```

---

## 8. ACI vs. Vorion: The Mapping

**These are orthogonal systems that compose together:**

| Aspect | ACI (External Standard) | Vorion (Internal Runtime) |
|--------|------------------------|-------------------------|
| **Purpose** | Identify & certify agents for discovery | Govern agent execution in real-time |
| **Who sets it?** | Registry authority (AgentAnchor, OpenAI, etc.) | Your organization |
| **When used?** | At registration & lookup | At invocation time |
| **Semantic** | Certification status (external verification) | Autonomy permission (internal governance) |
| **Example Tier** | T2 (Testing passed) | T2 (Constrained operations) |
| **Meaning** | "Has this agent been audited?" | "How much autonomy can it have NOW?" |
| **Decision Formula** | Static certification (point-in-time) | Dynamic trust score (real-time) |

**Critical Distinction: Trust Tier Names Are Different**

Both use T0-T5, but they measure different dimensions:

**ACI Trust Tiers** (Certification Status - External):
- T0: Unverified (no audit)
- T1: Registered (identity confirmed)
- T2: Tested (passed capability tests)
- T3: Certified (third-party audit)
- T4: Verified (continuous monitoring)
- T5: Sovereign (maximum assurance)

**Vorion Runtime Tiers** (Autonomy Permission - Internal):
- T0: Sandbox (no autonomy allowed)
- T1: Supervised (human approval required)
- T2: Constrained (guardrails enforced)
- T3: Trusted (standard operations)
- T4: Autonomous (independent action)
- T5: Sovereign (mission-critical)

**Effective Autonomy**:
```
effective_tier = min(aci_certification_tier, vorion_runtime_tier)

Example:
  ACI Cert = T5 (Sovereign, thoroughly verified)
  Vorion Runtime = T2 (Constrained, sensitive context)
  → Effective = T2 (runs as Constrained)

Why this works: A well-verified agent can still be restricted
in sensitive contexts. Certification ≠ Permission.
```

### Why This Matters

This two-tier model solves a critical governance problem:
- **Without separation**: You must choose between "never trust" or "fully trust"
- **With separation**: You can say "I trust this agent academically (T5 cert) but restrict it operationally (T2 runtime) because context requires it"

Example scenario:
```
Agent: Code reviewer (ACI: T4-Verified, continuously monitored)
Context: Code review during onboarding (constrained)
Decision: Run at Vorion T2 (Constrained) despite ACI T4 cert
Reason: New relationship, limited scope, want guardrails active
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Q1 2026)
- [x] Core ACI spec finalized
- [x] TypeScript reference implementation
- [x] DID method specification
- [x] Security hardening spec
- [ ] Publish to GitHub (public)
- [ ] npm registry (@aci/spec)

### Phase 2: Community & Standards (Q2-Q3 2026)
- [ ] OpenID Foundation submission
- [ ] W3C collaboration (AI Agent Protocol group)
- [ ] OWASP integration
- [ ] Reference implementations (Python, Go, Rust)

### Phase 3: Enterprise Adoption (Q3-Q4 2026)
- [ ] Enterprise registries (AWS, Azure, Google Cloud)
- [ ] Compliance mappings (EU AI Act, NIST AI RMF)
- [ ] Formal audits & certifications
- [ ] Multi-agent orchestration standards

### Phase 4: Governance & Evolution (2027+)
- [ ] ACI federation across registries
- [ ] Runtime assurance frameworks
- [ ] ZK privacy-preserving audits
- [ ] Quantum-resistant cryptography

---

## 10. Compliance & Regulatory Alignment

### 10.1 EU AI Act Integration

ACI tiers map to AI Risk Categories:

| ACI Tier | EU AI Act Risk | Requirements |
|----------|----------------|--------------|
| T0-T1 | Minimal Risk | No specific regulation |
| T2-T3 | Limited Risk | Transparency, documentation |
| T4 | High Risk | Conformity assessment, audit |
| T5 | Prohibited/Critical | Formal verification, human oversight |

**Vorion Mapping**: Trust scores can be configured per jurisdiction.

### 10.2 ISO 42001 (AI Management Systems)

ACI supports ISO 42001 compliance by providing:
- Clear capability declaration (required for Section 8.2.1)
- Audit trail via proof chains (required for Section 8.3.2)
- Behavioral monitoring (required for Section 9.2)

---

## 11. Security Considerations

### 11.1 Attack Vectors Addressed

| Attack | Mitigation | Component |
|--------|-----------|-----------|
| Token Theft | DPoP (proof-of-possession) | Layer 1 |
| Privilege Escalation | Monotonic capability derivation | ENFORCE |
| Prompt Injection | Semantic governance, instruction binding | Layer 5 |
| Supply Chain | Signed skills, provenance in DIDs | DID Method |
| Quantum (Future) | Post-quantum cryptography ready | Crypto layer |

### 11.2 Quantum-Safe Migration Path

ES256 → Post-Quantum (ML-DSA/Dilithium):
- Hybrid mode combines ES256 + PQC
- No breaking changes during transition
- Target: 2026 migration complete

---

## 12. Usage Examples

### 12.1 Agent Registration

```bash
# Register a new agent
curl -X POST https://registry.aci-spec.org/agents \
  -H "Content-Type: application/json" \
  -d '{
    "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
    "did": "did:key:z6Mkha7gVavdGV...",
    "domains": ["F", "H", "C"],
    "autonomy_level": 3,
    "security_context": {
      "dpop": true,
      "tee_binding": false,
      "semantic_governance": true
    }
  }'
```

### 12.2 Agent Discovery

```python
from aci_spec import Registry, Intent

registry = Registry()

# Find all tested agents for helpdesk
agents = registry.search(
    domains=["H"],
    min_tier=2,
    available_levels=[2, 3]
)

# Check trust score for specific agent
agent_aci = "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0"
trust_score = registry.get_trust_score(agent_aci)

if trust_score >= 0.7:
    # Invoke with L3 autonomy
    result = agent.execute(intent, autonomy_level=3)
else:
    # Fall back to L2 (draft mode)
    result = agent.execute(intent, autonomy_level=2)
```

### 12.3 Vorion Governance

```python
from vorion import VorionClient, Intent

client = VorionClient()

# Submit intent with ACI reference
intent = Intent(
    goal="Process refund",
    aci="a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
    context={
        "customer_id": "cust_123",
        "amount": 150.00
    }
)

# Vorion evaluates:
# 1. ACI lookup → T2 certified
# 2. Trust score calc → 0.65
# 3. Approve at L2 autonomy (draft mode)
result = client.intents.submit(intent)

# Access immutable proof
proof = result.proof_chain
```

---

## 13. FAQ & Troubleshooting

### Q: Does ACI replace Vorion?
**A**: No. ACI is the external standard; Vorion is the implementation engine. Think ACI = "passport," Vorion = "border control system."

### Q: Can I use ACI without Vorion?
**A**: Yes. ACI is independent. Vorion is one example of governance. Other platforms can implement ACI differently.

### Q: What if my agent doesn't fit the domain codes?
**A**: ACI Layers 2+ allow custom domain extensions via semantic versioning. Contact the ACI working group for standardization.

### Q: How do I handle agents that change over time?
**A**: Use semver versioning + deprecation paths. When behavior changes materially, bump the ACI version.

### Q: Is ACI quantum-safe?
**A**: Not yet (uses ES256). Post-quantum migration planned for 2026. Hybrid modes available now.

---

## 14. References & Further Reading

### Core Standards
- [ACI Core Specification](aci-core-spec.md)
- [ACI Security Hardening](aci-security-hardening.md)
- [ACI Semantic Governance (Layer 5)](aci-layer5-governance.md)
- [W3C DID Specification](https://www.w3.org/TR/did-core/)
- [OpenID Connect Specification](https://openid.net/connect/)

### Vorion Documentation
- [Vorion SPEC-002: Trust Scoring](../vorion/SPEC-002-trust-engine.md)
- [Vorion Security Whitepaper](../vorion/SECURITY_WHITEPAPER_ENTERPRISE.md)
- [STPA Implementation Guide](../vorion/STPA_IMPLEMENTATION_GUIDE.md)

### Industry Alignment
- [EU AI Act Compliance](../compliance/EU_AI_ACT_MAPPING.md)
- [ISO 42001 Mapping](../compliance/ISO_42001_GAP_ANALYSIS.md)
- [OWASP Top 10 for LLMs](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [NIST AI RMF](https://airc.nist.gov/AI_RMF_1.0_Framework)

### Human-Centric Design
- [Ralph Wiggum Standard: Human-Centric Agent Interfaces](aci-ralph-wiggum-standard.md)
- [Permission Psychology & Just-in-Time Auth](aci-permissions-jit.md)

---

## 15. Governance & Contributing

### How to Propose Changes

1. Fork the ACI specification repository
2. Document your change in an RFC (Request for Comments)
3. Submit to the ACI Working Group
4. Community review (30 days)
5. Integration vote

### Working Group Structure

```
ACI Steering Committee (AgentAnchor, 3 rotating orgs)
    ├── Security & Cryptography WG
    ├── Registry & Discovery WG
    ├── Compliance & Governance WG
    └── Community & Ecosystem WG
```

### License
Apache 2.0. See [LICENSE](LICENSE).

---

## Appendix A: ACI String Generator

```typescript
function generateACI(config: {
  registry: string;
  org: string;
  agentClass: string;
  domains: string[];
  level: number;
  tier: number;
  version: string;
}): string {
  const domainStr = config.domains.join("");
  return `${config.registry}.${config.org}.${config.agentClass}:${domainStr}-L${config.level}-T${config.tier}@${config.version}`;
}

// Usage
const aci = generateACI({
  registry: "a3i",
  org: "vorion",
  agentClass: "banquet-advisor",
  domains: ["F", "H", "C"],
  level: 3,
  tier: 2,
  version: "1.2.0"
});
// → "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0"
```

## Appendix B: Trust Score Calculation (Vorion)

```python
def calculate_trust_score(agent_aci: str, context: Dict) -> float:
    """
    Calculate effective trust score for agent invocation.
    
    Score = (cert_weight × 300) + (behavior × 400) + (context × 300) / 1000
    Range: 0.0 (untrustworthy) to 1.0 (maximum trust)
    """
    
    # Parse ACI to get certification tier
    tier = parse_aci(agent_aci).tier  # T0-T5
    cert_weight = {
        0: 0.0, 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1.0
    }[tier]
    
    # Calculate behavior score from history
    behavior_score = calculate_behavior_history(agent_aci)  # 0.0-1.0
    
    # Context factors (user approval history, task risk, etc.)
    context_score = calculate_context_factors(context)  # 0.0-1.0
    
    # Composite score
    score = (
        (cert_weight * 0.300) +
        (behavior_score * 0.400) +
        (context_score * 0.300)
    )
    
    return min(1.0, max(0.0, score))  # Clamp to [0, 1]
```

---

**Document Version**: 1.1.0  
**Last Updated**: January 24, 2026  
**Status**: Ready for Publication  
**Approval**: AgentAnchor Technical Committee ✓
