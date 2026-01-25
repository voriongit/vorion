# ACI Extension Protocol Specification

**Extensible Layer 4 Architecture for Runtime Assurance**  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** January 24, 2026

---

## Abstract

The ACI Extension Protocol defines a standardized mechanism for adding optional Layer 4 functionality to ACI-compliant systems. This enables runtime governance, monitoring, and assurance capabilities while maintaining backward compatibility with systems implementing only the core 3-layer architecture.

---

## 1. Introduction

### 1.1 Motivation

The core ACI specification (Layers 1-3) provides static certification—a point-in-time verification of agent capabilities. However, production deployments reveal gaps:

- **Behavioral Drift:** Agents may deviate from certified behavior over time
- **Runtime Governance:** Policies must be enforced during execution, not just at certification
- **Continuous Monitoring:** Trust should be verified continuously, not just initially
- **Industry Compliance:** Specific verticals require additional controls (HIPAA, SOX, FedRAMP)

### 1.2 Design Principles

1. **Optional by Default:** Extensions are enhancements, not requirements
2. **Backward Compatible:** 3-layer systems interoperate with 4-layer systems
3. **Industry Agnostic Core:** Vertical-specific logic lives in extensions
4. **Community Driven:** Third parties can create and publish extensions

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: RUNTIME ASSURANCE (OPTIONAL EXTENSIONS)               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Extension Registry                                       │   │
│  │  ├── aci-ext-governance-v1   (Cognigate)                 │   │
│  │  ├── aci-ext-healthcare-v1   (HIPAA)                     │   │
│  │  ├── aci-ext-finance-v1      (SOX)                       │   │
│  │  ├── aci-ext-fedramp-v1      (Government)                │   │
│  │  └── [community extensions]                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕ Extension Protocol               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: APPLICATION                                           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: CAPABILITY & CERTIFICATION (ACI CORE)                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: IDENTITY & AUTH                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Extension Identification

### 2.1 Extension ID Format

```
aci-ext-{domain}-v{major}
```

**Examples:**
- `aci-ext-governance-v1`
- `aci-ext-healthcare-v2`
- `aci-ext-finance-v1`

### 2.2 Extension Shortcodes

For ACI string embedding, extensions use shortcodes:

| Extension ID | Shortcode |
|--------------|-----------|
| aci-ext-governance-v1 | `gov` |
| aci-ext-healthcare-v1 | `hipaa` |
| aci-ext-finance-v1 | `sox` |
| aci-ext-audit-v1 | `audit` |
| aci-ext-fedramp-v1 | `fed` |

### 2.3 ACI String Extension Suffix

Extensions MAY be declared in the ACI string using the `#` suffix:

```
a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0#gov
a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0#gov,audit
a3i.acme.health-agent:CHD-L3-T4@1.0.0#hipaa,audit
```

**Grammar:**
```abnf
aci-extended  = aci-core ["#" extension-list]
extension-list = shortcode *("," shortcode)
shortcode     = 1*ALPHA
```

**Regex:**
```regex
^[a-z0-9]+\.[a-z0-9-]+\.[a-z0-9-]+:[A-Z]+-L[0-5]-T[0-5]@\d+\.\d+\.\d+(#[a-z]+(,[a-z]+)*)?$
```

---

## 3. Extension Protocol Interface

### 3.1 TypeScript Interface

```typescript
/**
 * ACI Extension Protocol
 * Implement this interface to create a Layer 4 extension
 */
interface ACIExtension {
  // =========================================================================
  // METADATA
  // =========================================================================
  
  /** Unique extension identifier */
  extensionId: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** Extension shortcode for ACI strings */
  shortcode: string;
  
  /** Publisher DID */
  publisher: string;
  
  /** Extension description */
  description: string;
  
  /** Required ACI core version */
  requiredACIVersion: string;
  
  // =========================================================================
  // LIFECYCLE HOOKS
  // =========================================================================
  
  hooks: {
    /**
     * Called when extension is loaded
     * Use for initialization
     */
    onLoad?: () => Promise<void>;
    
    /**
     * Called when extension is unloaded
     * Use for cleanup
     */
    onUnload?: () => Promise<void>;
  };
  
  // =========================================================================
  // CAPABILITY HOOKS
  // =========================================================================
  
  capability: {
    /**
     * Called BEFORE capability evaluation
     * Can modify or reject capability requests
     */
    preCheck?: (
      agent: AgentIdentity,
      request: CapabilityRequest
    ) => Promise<PreCheckResult>;
    
    /**
     * Called AFTER capability is granted
     * Can add additional constraints
     */
    postGrant?: (
      agent: AgentIdentity,
      grant: CapabilityGrant
    ) => Promise<CapabilityGrant>;
    
    /**
     * Called when capability token is about to expire
     * Can extend or revoke
     */
    onExpiry?: (
      agent: AgentIdentity,
      grant: CapabilityGrant
    ) => Promise<ExpiryDecision>;
  };
  
  // =========================================================================
  // ACTION HOOKS
  // =========================================================================
  
  action: {
    /**
     * Called BEFORE action execution
     * Can block, modify, or add constraints
     */
    preAction?: (
      agent: AgentIdentity,
      action: ActionRequest
    ) => Promise<PreActionResult>;
    
    /**
     * Called AFTER action execution
     * Use for audit logging
     */
    postAction?: (
      agent: AgentIdentity,
      action: ActionRecord
    ) => Promise<void>;
    
    /**
     * Called on action failure
     * Use for error handling, circuit breaking
     */
    onFailure?: (
      agent: AgentIdentity,
      action: ActionRecord,
      error: Error
    ) => Promise<FailureResponse>;
  };
  
  // =========================================================================
  // MONITORING HOOKS
  // =========================================================================
  
  monitoring: {
    /**
     * Called periodically for behavior verification
     * Detects drift from certified behavior
     */
    verifyBehavior?: (
      agent: AgentIdentity,
      metrics: BehaviorMetrics
    ) => Promise<BehaviorVerificationResult>;
    
    /**
     * Called to collect metrics
     * Interval configured per extension
     */
    collectMetrics?: (
      agent: AgentIdentity
    ) => Promise<MetricsReport>;
    
    /**
     * Called when anomaly is detected
     */
    onAnomaly?: (
      agent: AgentIdentity,
      anomaly: AnomalyReport
    ) => Promise<AnomalyResponse>;
  };
  
  // =========================================================================
  // TRUST HOOKS
  // =========================================================================
  
  trust: {
    /**
     * Called on revocation events
     * Handle trust revocation
     */
    onRevocation?: (
      revocation: RevocationEvent
    ) => Promise<void>;
    
    /**
     * Called to adjust trust score
     * Based on runtime behavior
     */
    adjustTrust?: (
      agent: AgentIdentity,
      adjustment: TrustAdjustment
    ) => Promise<TrustAdjustmentResult>;
    
    /**
     * Called for attestation verification
     * Additional validation beyond core
     */
    verifyAttestation?: (
      attestation: Attestation
    ) => Promise<AttestationVerificationResult>;
  };
  
  // =========================================================================
  // POLICY ENGINE (OPTIONAL)
  // =========================================================================
  
  policy?: {
    /**
     * Evaluate policy for a given context
     * Returns allow/deny with reasoning
     */
    evaluate: (
      context: PolicyContext
    ) => Promise<PolicyDecision>;
    
    /**
     * Load policy from source
     */
    loadPolicy?: (
      source: PolicySource
    ) => Promise<void>;
  };
}
```

### 3.2 Hook Result Types

```typescript
// Pre-check results
interface PreCheckResult {
  allow: boolean;
  reason?: string;
  constraints?: Constraint[];
}

// Pre-action results
interface PreActionResult {
  proceed: boolean;
  reason?: string;
  modifications?: ActionModification[];
  requiredApprovals?: ApprovalRequirement[];
}

// Behavior verification
interface BehaviorVerificationResult {
  inBounds: boolean;
  driftScore: number;        // 0-100, higher = more drift
  driftCategories: string[]; // e.g., ["response_time", "error_rate"]
  recommendation: 'continue' | 'warn' | 'suspend' | 'revoke';
}

// Policy decision
interface PolicyDecision {
  decision: 'allow' | 'deny' | 'require_approval';
  reasons: string[];
  evidence?: PolicyEvidence[];
  obligations?: PolicyObligation[];
}
```

---

## 4. Extension Registration

### 4.1 Registry Endpoint

Extensions register with the ACI Extension Registry:

```http
POST /v1/extensions HTTP/1.1
Host: extensions.agentanchor.io
Authorization: Bearer <publisher-token>
Content-Type: application/json

{
  "extensionId": "aci-ext-governance-v1",
  "name": "Cognigate Governance Runtime",
  "version": "1.0.0",
  "shortcode": "gov",
  "publisher": "did:web:agentanchor.io",
  "description": "Runtime governance and policy enforcement for AI agents",
  "requiredACIVersion": ">=1.0.0",
  "documentation": "https://docs.cognigate.dev/aci-extension",
  "schema": "https://extensions.agentanchor.io/schemas/governance-v1.json",
  "hooks": [
    "capability.preCheck",
    "capability.postGrant",
    "action.preAction",
    "action.postAction",
    "monitoring.verifyBehavior",
    "trust.onRevocation"
  ]
}
```

### 4.2 Extension Discovery

```http
GET /v1/extensions HTTP/1.1
Host: extensions.agentanchor.io

// Response
{
  "extensions": [
    {
      "extensionId": "aci-ext-governance-v1",
      "shortcode": "gov",
      "publisher": "did:web:agentanchor.io",
      "verified": true,
      "downloads": 1250,
      "rating": 4.8
    },
    {
      "extensionId": "aci-ext-healthcare-v1",
      "shortcode": "hipaa",
      "publisher": "did:web:healthtech.io",
      "verified": true,
      "downloads": 890,
      "rating": 4.6
    }
  ]
}
```

---

## 5. Extension Invocation

### 5.1 Invocation Order

When multiple extensions are active, hooks are called in declaration order:

```
Agent ACI: a3i.vorion.agent:FHC-L3-T2@1.2.0#gov,audit,hipaa

Capability preCheck:
  1. gov.capability.preCheck()
  2. audit.capability.preCheck()
  3. hipaa.capability.preCheck()

All must return allow=true for capability to be granted.
```

### 5.2 Error Handling

```typescript
// If any extension hook fails, the operation is denied
try {
  for (const ext of activeExtensions) {
    const result = await ext.capability.preCheck(agent, request);
    if (!result.allow) {
      return { denied: true, extension: ext.extensionId, reason: result.reason };
    }
  }
} catch (error) {
  // Extension errors are treated as deny
  return { denied: true, extension: ext.extensionId, reason: 'Extension error' };
}
```

### 5.3 Timeout Handling

Extensions MUST respond within timeout:

| Hook Type | Default Timeout | Max Timeout |
|-----------|-----------------|-------------|
| preCheck | 100ms | 500ms |
| preAction | 200ms | 1000ms |
| postAction | 500ms | 2000ms |
| verifyBehavior | 5000ms | 30000ms |

---

## 6. DID Document Extension Declaration

Agents declare supported extensions in their DID Document:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://aci.agentanchor.io/ns/aci/v1",
    "https://aci.agentanchor.io/ns/extensions/v1"
  ],
  "id": "did:aci:a3i:vorion:banquet-advisor",
  
  "aciCapabilities": {
    "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0#gov,audit"
  },
  
  "aciExtensions": {
    "active": [
      {
        "extensionId": "aci-ext-governance-v1",
        "shortcode": "gov",
        "configEndpoint": "https://agents.vorion.org/banquet-advisor/gov-config"
      },
      {
        "extensionId": "aci-ext-audit-v1",
        "shortcode": "audit",
        "auditEndpoint": "https://audit.vorion.org/agents/banquet-advisor"
      }
    ],
    "compatible": [
      "aci-ext-healthcare-v1",
      "aci-ext-finance-v1"
    ]
  }
}
```

---

## 7. Reference Extensions

### 7.1 Governance Extension (Cognigate)

```typescript
const governanceExtension: ACIExtension = {
  extensionId: 'aci-ext-governance-v1',
  name: 'Cognigate Governance Runtime',
  version: '1.0.0',
  shortcode: 'gov',
  publisher: 'did:web:agentanchor.io',
  description: 'Runtime governance and policy enforcement',
  requiredACIVersion: '>=1.0.0',
  
  hooks: {
    onLoad: async () => {
      console.log('Governance extension loaded');
    }
  },
  
  capability: {
    preCheck: async (agent, request) => {
      // Check if action violates any constraints
      const constraints = await loadConstraints(agent);
      const violation = checkViolation(constraints, request);
      
      return {
        allow: !violation,
        reason: violation?.message,
        constraints: constraints
      };
    }
  },
  
  action: {
    preAction: async (agent, action) => {
      // Evaluate policy before action
      const decision = await policy.evaluate({
        agent,
        action,
        context: getCurrentContext()
      });
      
      return {
        proceed: decision.decision === 'allow',
        reason: decision.reasons.join('; '),
        requiredApprovals: decision.decision === 'require_approval' 
          ? decision.approvers 
          : undefined
      };
    },
    
    postAction: async (agent, action) => {
      // Audit log
      await auditLog.write({
        timestamp: new Date(),
        agent: agent.aci,
        action: action,
        result: action.result
      });
    }
  },
  
  monitoring: {
    verifyBehavior: async (agent, metrics) => {
      const baseline = await getBaseline(agent);
      const drift = calculateDrift(baseline, metrics);
      
      return {
        inBounds: drift.score < 50,
        driftScore: drift.score,
        driftCategories: drift.categories,
        recommendation: drift.score < 30 ? 'continue' :
                        drift.score < 50 ? 'warn' :
                        drift.score < 70 ? 'suspend' : 'revoke'
      };
    }
  },
  
  trust: {
    onRevocation: async (revocation) => {
      // Propagate revocation to all running instances
      await notifyInstances(revocation.agentDid);
      await terminateSessions(revocation.agentDid);
    },
    
    adjustTrust: async (agent, adjustment) => {
      // Adjust trust based on behavior
      const currentScore = await getTrustScore(agent);
      const newScore = applyAdjustment(currentScore, adjustment);
      
      return {
        previousScore: currentScore,
        newScore: newScore,
        tier: scoreToTier(newScore)
      };
    }
  },
  
  policy: {
    evaluate: async (context) => {
      return cognigate.evaluatePolicy(context);
    }
  }
};
```

### 7.2 Healthcare Extension (HIPAA)

```typescript
const healthcareExtension: ACIExtension = {
  extensionId: 'aci-ext-healthcare-v1',
  name: 'HIPAA Compliance Extension',
  version: '1.0.0',
  shortcode: 'hipaa',
  publisher: 'did:web:healthtech.io',
  description: 'HIPAA compliance for healthcare AI agents',
  requiredACIVersion: '>=1.0.0',
  
  capability: {
    preCheck: async (agent, request) => {
      // Check PHI access authorization
      if (request.involvesPHI) {
        const authorized = await verifyPHIAuthorization(agent, request.patient);
        if (!authorized) {
          return { 
            allow: false, 
            reason: 'PHI access not authorized for this agent' 
          };
        }
      }
      return { allow: true };
    }
  },
  
  action: {
    preAction: async (agent, action) => {
      // Minimum necessary check
      if (action.type === 'data_access' && action.target.type === 'PHI') {
        const necessary = await checkMinimumNecessary(action);
        if (!necessary.passed) {
          return {
            proceed: false,
            reason: `Minimum necessary violation: ${necessary.reason}`
          };
        }
      }
      return { proceed: true };
    },
    
    postAction: async (agent, action) => {
      // HIPAA audit log
      if (action.involvesPHI) {
        await hipaaAuditLog.write({
          timestamp: new Date(),
          agent: agent.aci,
          patient: action.patient,
          accessType: action.type,
          dataElements: action.accessedElements,
          purpose: action.purpose,
          outcome: action.result
        });
      }
    }
  }
};
```

---

## 8. Backward Compatibility

### 8.1 3-Layer System Receiving 4-Layer Agent

A system implementing only core ACI (no extensions) MUST:

1. Parse the ACI string, ignoring the `#extension` suffix
2. Validate core ACI components normally
3. Log that extensions were declared but not evaluated

```typescript
function parseACIWithCompatibility(aciString: string): ParsedACI {
  // Split off extension suffix if present
  const [coreACI, extensionSuffix] = aciString.split('#');
  
  // Parse core ACI normally
  const parsed = parseACI(coreACI);
  
  // Note extensions for logging (optional)
  if (extensionSuffix) {
    parsed.declaredExtensions = extensionSuffix.split(',');
    console.log(`Agent declares extensions: ${parsed.declaredExtensions}`);
  }
  
  return parsed;
}
```

### 8.2 4-Layer System Receiving 3-Layer Agent

A system with extensions MUST accept agents without extension declarations:

1. Apply extension hooks with default behavior
2. Do not reject agents lacking extension support
3. May log that agent lacks certain compliance capabilities

---

## 9. Security Considerations

### 9.1 Extension Verification

- Extensions SHOULD be cryptographically signed by their publisher
- Systems SHOULD verify extension signatures before loading
- Malicious extensions can compromise agent security

### 9.2 Hook Isolation

- Extension hooks SHOULD run in sandboxed environments
- Hooks MUST NOT have direct access to agent internals
- Resource limits SHOULD be enforced

### 9.3 Sensitive Data

- Extensions handling sensitive data MUST implement appropriate controls
- Healthcare extensions MUST follow HIPAA requirements
- Financial extensions MUST follow SOX requirements

---

## 10. Governance

### 10.1 Extension Standards

AgentAnchor (A3I) maintains a "Verified" program for extensions:

1. Security audit
2. Compliance review
3. Performance testing
4. Documentation review

### 10.2 Community Extensions

Third parties MAY publish extensions without verification:

1. Clearly marked as "Community" (not "Verified")
2. User assumes risk
3. Still registered in extension registry

---

## Appendix A: Extension Categories

| Category | Description | Examples |
|----------|-------------|----------|
| Governance | Policy enforcement, constraints | Cognigate, OPA integration |
| Compliance | Regulatory requirements | HIPAA, SOX, FedRAMP, GDPR |
| Audit | Logging, trails, forensics | Blockchain anchoring, SIEM |
| Monitoring | Behavior verification, drift | APM, anomaly detection |
| Security | Additional security controls | Zero-trust, MFA |

---

## Appendix B: JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://aci.agentanchor.io/schema/extension.json",
  "type": "object",
  "required": ["extensionId", "name", "version", "shortcode", "publisher"],
  "properties": {
    "extensionId": {
      "type": "string",
      "pattern": "^aci-ext-[a-z]+-v\\d+$"
    },
    "name": { "type": "string" },
    "version": { "type": "string" },
    "shortcode": { 
      "type": "string",
      "pattern": "^[a-z]+$",
      "maxLength": 10
    },
    "publisher": { "type": "string" },
    "hooks": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

---

*Specification authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
