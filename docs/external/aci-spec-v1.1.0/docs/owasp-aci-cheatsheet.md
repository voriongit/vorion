# Agent Classification Identifier (ACI) Security Cheat Sheet

## Introduction

This cheat sheet provides guidance on implementing the Agent Classification Identifier (ACI) system to mitigate risks identified in the OWASP Top 10 for Agentic Applications. ACI is a hierarchical identifier and capability encoding system that enables organizations to classify, certify, and constrain AI agent behaviors.

---

## Quick Reference

**ACI Format:** `[Registry].[Org].[AgentClass]:[Domains]-L[Level]-T[Tier]@[Version]`

**Example:** `a3i.acme.support-agent:CD-L2-T3@1.0.0`

This identifies an agent:
- Registered with `a3i` (AgentAnchor)
- Operated by `acme`
- Class: `support-agent`
- Domains: Communications (C), Data (D)
- Level: L2 (Draft/Prepare - requires human approval)
- Trust: T3 (Certified by authorized body)
- Version: 1.0.0

---

## OWASP Risk Mitigation Matrix

### 1. Prompt Injection (LLM01)

**Risk:** Attackers manipulate agent behavior through malicious prompts.

**ACI Mitigation:**
- Enforce domain boundaries - agents can only act within certified domains
- Level constraints prevent unauthorized escalation
- Trust tiers require injection testing for T2+

```typescript
// Before processing any input, verify agent is within bounds
if (!hasCapability(agent.aci, requiredDomain)) {
  throw new UnauthorizedDomainError();
}
```

**Implementation:**
- [ ] Parse and validate ACI on every request
- [ ] Reject requests outside agent's domain scope
- [ ] Log all boundary violations

---

### 2. Insecure Output Handling (LLM02)

**Risk:** Agent outputs used unsafely by downstream systems.

**ACI Mitigation:**
- Level L0-L2 agents cannot execute, only observe/advise/draft
- Require explicit approval for L3+ actions
- Attestations verify output handling was tested

```typescript
// L2 agents can only produce drafts, never execute
if (agent.level <= 2 && action.type === 'execute') {
  return { status: 'pending_approval', draft: action.payload };
}
```

---

### 3. Training Data Poisoning (LLM03)

**Risk:** Compromised training data affects agent behavior.

**ACI Mitigation:**
- Trust tier T3+ requires training data audit
- Attestations record training provenance
- Version tracking enables rollback

**Attestation Example:**
```json
{
  "scope": "training",
  "evidence": {
    "datasetHash": "sha256:...",
    "auditReport": "https://audits.example.com/report/123"
  }
}
```

---

### 4. Model Denial of Service (LLM04)

**Risk:** Resource exhaustion attacks against agents.

**ACI Mitigation:**
- Registry tracks resource quotas per trust tier
- Circuit breakers triggered by ACI-level policies
- Rate limits enforced based on trust tier

| Trust Tier | Request Limit | Token Limit |
|------------|---------------|-------------|
| T0-T1 | 10/min | 1K tokens |
| T2-T3 | 100/min | 10K tokens |
| T4-T5 | 1000/min | 100K tokens |

---

### 5. Supply Chain Vulnerabilities (LLM05)

**Risk:** Compromised dependencies or third-party agents.

**ACI Mitigation:**
- Registry verifies agent provenance
- Attestation chains establish trust
- Version pinning prevents silent updates

```typescript
// Verify attestation chain before invoking external agent
const attestations = await registry.getAttestations(agent.did);
if (!verifyAttestationChain(attestations, trustedIssuers)) {
  throw new UntrustedAgentError();
}
```

---

### 6. Sensitive Information Disclosure (LLM06)

**Risk:** Agents leak sensitive data.

**ACI Mitigation:**
- Domain restrictions prevent data exfiltration
- Trust tier T3+ requires data handling audit
- Capability tokens scope data access

```typescript
// Agent without 'D' domain cannot access data stores
const aci = parseACI('a3i.acme.chat-agent:C-L2-T2@1.0.0');
if (!aci.domains.includes('D')) {
  denyDataAccess();
}
```

---

### 7. Insecure Plugin Design (LLM07)

**Risk:** Malicious or vulnerable plugins extend agent capabilities.

**ACI Mitigation:**
- Plugins require separate ACI certification
- Capability derivation enforces monotonic constraints
- Plugin capabilities ≤ host agent capabilities

```typescript
// Plugin cannot exceed host agent's capabilities
const pluginACI = deriveCapabilities(hostACI, pluginRequest);
if (pluginACI.level > hostACI.level) {
  throw new CapabilityEscalationError();
}
```

---

### 8. Excessive Agency (LLM08)

**Risk:** Agents take actions beyond intended scope.

**ACI Mitigation:**
- Capability levels explicitly define autonomy
- L0-L2: Human approval required
- L3: Approval for sensitive actions
- L4-L5: Bounded autonomy with monitoring

```typescript
// Enforce level-appropriate approval workflows
switch (agent.level) {
  case 0:
  case 1:
  case 2:
    return requireHumanApproval(action);
  case 3:
    return isSensitive(action) ? requireHumanApproval(action) : execute(action);
  case 4:
  case 5:
    return execute(action); // With monitoring
}
```

---

### 9. Overreliance (LLM09)

**Risk:** Users trust agent outputs without verification.

**ACI Mitigation:**
- Trust tiers communicate verification level
- Attestations provide audit evidence
- UI should display trust indicators

```html
<!-- Display trust tier in UI -->
<div class="agent-trust-badge" data-tier="T2">
  <span>Tested</span>
  <a href="/attestations/abc123">View Certification</a>
</div>
```

---

### 10. Model Theft (LLM10)

**Risk:** Proprietary models or agent logic stolen.

**ACI Mitigation:**
- DID-based identity prevents impersonation
- Attestations bound to specific deployments
- Registry tracks authorized instances

---

## Implementation Checklist

### Registration
- [ ] Register agents with ACI registry
- [ ] Define capability domains accurately
- [ ] Set appropriate autonomy level
- [ ] Obtain attestations for production use

### Runtime
- [ ] Validate ACI on every request
- [ ] Enforce domain boundaries
- [ ] Implement level-appropriate approvals
- [ ] Log all capability checks

### Monitoring
- [ ] Track capability boundary violations
- [ ] Monitor trust tier compliance
- [ ] Alert on attestation expiry
- [ ] Audit capability escalation attempts

### Incident Response
- [ ] Revoke attestations for compromised agents
- [ ] Update registry on security incidents
- [ ] Version agents to enable rollback

---

## Code Examples

### Validate ACI Before Action

```typescript
import { parseACI, validateACI, satisfiesRequirements } from '@agentanchor/aci-spec';

async function handleAgentRequest(request: AgentRequest) {
  // 1. Parse and validate ACI
  const validation = validateACI(request.aci);
  if (!validation.valid) {
    throw new InvalidACIError(validation.errors);
  }
  
  // 2. Check capability requirements
  const requirements = getActionRequirements(request.action);
  if (!satisfiesRequirements(validation.parsed!, requirements)) {
    throw new InsufficientCapabilitiesError();
  }
  
  // 3. Verify attestations are current
  const attestations = await registry.getAttestations(request.did);
  if (!hasValidAttestation(attestations)) {
    throw new ExpiredAttestationError();
  }
  
  // 4. Execute with appropriate approval flow
  return executeWithApproval(request, validation.parsed!.level);
}
```

### Derive Scoped Capabilities

```typescript
function deriveCapabilities(
  parent: ParsedACI,
  requested: CapabilityRequest
): ParsedACI {
  return {
    ...parent,
    // Capabilities can only decrease, never increase
    domains: parent.domains.filter(d => requested.domains.includes(d)),
    level: Math.min(parent.level, requested.level),
    trustTier: Math.min(parent.trustTier, requested.trustTier),
  };
}
```

---

## References

- [ACI Specification](https://aci.agentanchor.io)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [OWASP Agentic AI Threats](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/)

---

*Cheat sheet authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
