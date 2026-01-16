# BASIS Capability Taxonomy

**Version 1.0.0 | January 2026**

---

## Overview

This document defines the canonical capability taxonomy for BASIS-conformant implementations. Capabilities are hierarchical permissions that control what actions an entity may perform.

---

## 1. Capability Syntax

### 1.1 Format

```
capability := namespace ":" category "/" action ["/" scope]
```

**Components:**

| Component | Required | Description |
|-----------|----------|-------------|
| namespace | Yes | Top-level domain (data, comm, execute, financial, admin, sandbox, custom) |
| category | Yes | Action category within namespace |
| action | Yes | Specific action type |
| scope | No | Optional qualifier (e.g., threshold, sensitivity level) |

### 1.2 Examples

```
data:read/public                    # Read public data
data:read/sensitive/pii             # Read PII data
comm:external/email                 # Send external email
financial:transaction/medium        # Transaction $100-$10,000
admin:agent/create                  # Create new agents
custom:acme/special_workflow        # Organization-specific
```

### 1.3 Wildcards

- `data:read/*` — All read capabilities under `data:read/`
- `data:*` — All capabilities under `data:`
- `*` (root wildcard) — NOT PERMITTED for safety

---

## 2. Standard Namespaces

### 2.1 Namespace Registry

| Namespace | Description | Risk Profile |
|-----------|-------------|--------------|
| sandbox | Isolated testing operations | Minimal |
| data | Data access and modification | Variable |
| comm | Communication capabilities | Medium-High |
| execute | Code and process execution | High |
| financial | Monetary operations | Critical |
| admin | Administrative functions | Critical |
| custom | Organization-defined | Variable |

---

## 3. Capability Reference

### 3.1 Sandbox Namespace (`sandbox:`)

Capabilities for isolated testing environments with no external effects.

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `sandbox:test/prompt` | Test prompts in isolation | Minimal | Sandbox |
| `sandbox:test/workflow` | Test multi-step workflows | Minimal | Sandbox |
| `sandbox:mock/api` | Call mocked API endpoints | Minimal | Sandbox |
| `sandbox:mock/data` | Access synthetic test data | Minimal | Sandbox |
| `sandbox:log/read` | Read sandbox logs | Minimal | Sandbox |

**Wildcard:** `sandbox:*` grants all sandbox capabilities.

---

### 3.2 Data Namespace (`data:`)

Capabilities for reading, writing, and managing data.

#### 3.2.1 Read Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `data:read/public` | Read publicly available data | Low | Provisional |
| `data:read/internal` | Read internal non-sensitive data | Low | Standard |
| `data:read/sensitive` | Read sensitive business data | Medium | Trusted |
| `data:read/sensitive/pii` | Read personally identifiable information | High | Certified |
| `data:read/sensitive/phi` | Read protected health information | High | Certified |
| `data:read/sensitive/pci` | Read payment card data | Critical | Certified |
| `data:read/confidential` | Read confidential/classified data | Critical | Autonomous |

#### 3.2.2 Write Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `data:write/draft` | Create draft/temporary records | Low | Standard |
| `data:write/standard` | Create and modify standard records | Medium | Certified |
| `data:write/sensitive` | Modify sensitive data | High | Certified |
| `data:write/bulk` | Bulk data operations (>100 records) | High | Certified |

#### 3.2.3 Delete Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `data:delete/draft` | Delete draft records | Low | Standard |
| `data:delete/standard` | Delete standard records | Medium | Certified |
| `data:delete/permanent` | Permanent deletion (no recovery) | Critical | Autonomous |

#### 3.2.4 Export Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `data:export/report` | Generate reports | Low | Standard |
| `data:export/bulk` | Bulk data export | Medium | Trusted |
| `data:export/sensitive` | Export sensitive data | High | Certified |

**Wildcards:**
- `data:read/*` — All read capabilities
- `data:write/*` — All write capabilities
- `data:*` — All data capabilities

---

### 3.3 Communication Namespace (`comm:`)

Capabilities for sending messages and notifications.

#### 3.3.1 Internal Communication

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `comm:internal/notification` | Send in-app notifications | Low | Provisional |
| `comm:internal/message` | Send internal messages | Low | Provisional |
| `comm:internal/channel` | Post to internal channels | Low | Standard |
| `comm:internal/broadcast` | Broadcast to all users | Medium | Trusted |

#### 3.3.2 External Communication

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `comm:external/email` | Send external email | Medium | Standard |
| `comm:external/email/bulk` | Send bulk email (>10 recipients) | High | Trusted |
| `comm:external/sms` | Send SMS messages | Medium | Trusted |
| `comm:external/voice` | Initiate voice calls | High | Certified |
| `comm:external/social` | Post to social media | High | Certified |

#### 3.3.3 API Communication

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `comm:external/api/read` | Call external APIs (read-only) | Medium | Trusted |
| `comm:external/api/write` | Call external APIs (with mutations) | High | Certified |
| `comm:external/webhook` | Send webhook notifications | Medium | Trusted |

**Wildcards:**
- `comm:internal/*` — All internal communication
- `comm:external/*` — All external communication
- `comm:*` — All communication capabilities

---

### 3.4 Execute Namespace (`execute:`)

Capabilities for running code and processes.

#### 3.4.1 Internal Execution

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `execute:internal/query` | Run database queries | Medium | Standard |
| `execute:internal/script` | Execute approved scripts | Medium | Standard |
| `execute:internal/workflow` | Trigger internal workflows | Medium | Standard |
| `execute:internal/job` | Schedule background jobs | Medium | Trusted |

#### 3.4.2 External Execution

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `execute:external/api` | Execute external API calls | Medium | Trusted |
| `execute:external/integration` | Trigger external integrations | High | Trusted |
| `execute:external/automation` | Run external automation | High | Certified |

#### 3.4.3 Code Execution

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `execute:code/sandbox` | Run code in sandbox | Medium | Standard |
| `execute:code/interpreted` | Run interpreted code | High | Certified |
| `execute:code/compiled` | Run compiled binaries | Critical | Autonomous |
| `execute:code/privileged` | Run with elevated privileges | Critical | Autonomous |

**Wildcards:**
- `execute:internal/*` — All internal execution
- `execute:external/*` — All external execution
- `execute:code/*` — All code execution
- `execute:*` — All execution capabilities

---

### 3.5 Financial Namespace (`financial:`)

Capabilities for monetary operations.

#### 3.5.1 View Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `financial:view/balance` | View account balances | Low | Trusted |
| `financial:view/transaction` | View transaction history | Low | Trusted |
| `financial:view/statement` | View/generate statements | Medium | Trusted |

#### 3.5.2 Transaction Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `financial:transaction/micro` | Transactions < $10 | Medium | Trusted |
| `financial:transaction/low` | Transactions $10-$100 | Medium | Certified |
| `financial:transaction/medium` | Transactions $100-$10,000 | High | Certified |
| `financial:transaction/high` | Transactions $10,000-$100,000 | Critical | Autonomous |
| `financial:transaction/unlimited` | Transactions > $100,000 | Critical | Autonomous + Escalation |

#### 3.5.3 Payment Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `financial:payment/initiate` | Initiate payment | High | Certified |
| `financial:payment/approve` | Approve pending payment | Critical | Autonomous |
| `financial:payment/refund` | Process refunds | High | Certified |
| `financial:payment/recurring` | Set up recurring payments | Critical | Autonomous |

#### 3.5.4 Account Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `financial:account/create` | Create financial accounts | Critical | Autonomous |
| `financial:account/modify` | Modify account settings | Critical | Autonomous |
| `financial:account/close` | Close financial accounts | Critical | Autonomous + Escalation |

**Wildcards:**
- `financial:view/*` — All view capabilities
- `financial:transaction/*` — All transaction capabilities
- `financial:*` — All financial capabilities

---

### 3.6 Admin Namespace (`admin:`)

Capabilities for administrative and configuration operations.

#### 3.6.1 Read Operations

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `admin:read/config` | Read system configuration | Low | Certified |
| `admin:read/users` | Read user information | Medium | Certified |
| `admin:read/audit` | Read audit logs | Medium | Certified |
| `admin:read/metrics` | Read system metrics | Low | Trusted |

#### 3.6.2 User Management

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `admin:user/invite` | Invite new users | Medium | Certified |
| `admin:user/modify` | Modify user accounts | High | Autonomous |
| `admin:user/suspend` | Suspend user accounts | High | Autonomous |
| `admin:user/delete` | Delete user accounts | Critical | Autonomous + Escalation |

#### 3.6.3 Agent Management

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `admin:agent/create` | Create new agents | High | Certified |
| `admin:agent/modify` | Modify agent configuration | High | Certified |
| `admin:agent/suspend` | Suspend agent | High | Certified |
| `admin:agent/delete` | Delete agent | Critical | Autonomous |
| `admin:agent/trust/adjust` | Manually adjust trust scores | Critical | Autonomous + Escalation |

#### 3.6.4 System Configuration

| Capability | Description | Risk | Min Tier |
|------------|-------------|------|----------|
| `admin:config/read` | Read configuration | Low | Certified |
| `admin:config/modify` | Modify configuration | Critical | Autonomous |
| `admin:policy/read` | Read policies | Low | Certified |
| `admin:policy/modify` | Modify policies | Critical | Autonomous + Escalation |

**Wildcards:**
- `admin:read/*` — All admin read capabilities
- `admin:user/*` — All user management
- `admin:agent/*` — All agent management
- `admin:*` — All admin capabilities

---

### 3.7 Custom Namespace (`custom:`)

Organization-defined capabilities.

#### 3.7.1 Format

```
custom:{organization}/{category}/{action}
```

#### 3.7.2 Requirements

- MUST use `custom:` prefix
- MUST NOT conflict with standard namespaces
- SHOULD be documented in organization policy
- SHOULD specify minimum tier requirements

#### 3.7.3 Examples

```
custom:acme/billing/generate_invoice
custom:acme/shipping/create_label
custom:acme/support/escalate_ticket
custom:bigcorp/compliance/run_check
custom:bigcorp/hr/access_personnel_file
```

---

## 4. Tier-Capability Matrix

Default capability unlocks by tier. Organizations MAY customize but MUST NOT grant capabilities below the minimum tier.

### 4.1 Sandbox Tier (0-99)

```
sandbox:*
```

### 4.2 Provisional Tier (100-299)

```
+ data:read/public
+ comm:internal/notification
+ comm:internal/message
```

### 4.3 Standard Tier (300-499)

```
+ data:read/internal
+ data:write/draft
+ data:delete/draft
+ data:export/report
+ comm:internal/channel
+ comm:external/email
+ execute:internal/query
+ execute:internal/script
+ execute:internal/workflow
+ execute:code/sandbox
```

### 4.4 Trusted Tier (500-699)

```
+ data:read/sensitive
+ data:export/bulk
+ comm:internal/broadcast
+ comm:external/email/bulk
+ comm:external/sms
+ comm:external/api/read
+ comm:external/webhook
+ execute:internal/job
+ execute:external/api
+ execute:external/integration
+ financial:view/*
+ financial:transaction/micro
+ admin:read/metrics
```

### 4.5 Certified Tier (700-899)

```
+ data:read/sensitive/pii
+ data:read/sensitive/phi
+ data:read/sensitive/pci
+ data:write/standard
+ data:write/sensitive
+ data:write/bulk
+ data:delete/standard
+ data:export/sensitive
+ comm:external/voice
+ comm:external/social
+ comm:external/api/write
+ execute:external/automation
+ execute:code/interpreted
+ financial:transaction/low
+ financial:transaction/medium
+ financial:payment/initiate
+ financial:payment/refund
+ admin:read/*
+ admin:user/invite
+ admin:agent/create
+ admin:agent/modify
+ admin:agent/suspend
```

### 4.6 Autonomous Tier (900-1000)

```
+ data:read/confidential
+ data:delete/permanent
+ execute:code/compiled
+ execute:code/privileged
+ financial:transaction/high
+ financial:payment/approve
+ financial:payment/recurring
+ financial:account/*
+ admin:user/modify
+ admin:user/suspend
+ admin:agent/delete
+ admin:config/modify
```

### 4.7 Escalation-Required Capabilities

These capabilities always require human approval, regardless of tier:

```
financial:transaction/unlimited
admin:user/delete
admin:agent/trust/adjust
admin:policy/modify
financial:account/close
```

---

## 5. Capability Checking Algorithm

```python
def check_capability(
    entity_id: str,
    requested_capability: str,
    context: dict
) -> CapabilityCheckResult:
    """
    Check if an entity has a specific capability.

    Returns:
        CapabilityCheckResult with:
        - granted: bool
        - reason: str
        - requires_escalation: bool
    """

    # Get entity trust score and tier
    entity = get_entity(entity_id)
    tier = get_trust_tier(entity.trust_score)

    # Parse requested capability
    namespace, category, action, scope = parse_capability(requested_capability)

    # Check if capability requires escalation
    if requested_capability in ESCALATION_REQUIRED_CAPABILITIES:
        return CapabilityCheckResult(
            granted=False,
            reason="capability_requires_escalation",
            requires_escalation=True
        )

    # Get minimum tier for capability
    min_tier = get_minimum_tier(requested_capability)

    # Check tier requirement
    if tier_level(tier) < tier_level(min_tier):
        return CapabilityCheckResult(
            granted=False,
            reason=f"insufficient_trust_tier:{tier}:{min_tier}",
            requires_escalation=False
        )

    # Check organization-specific policy overrides
    policy_result = check_policy_overrides(entity_id, requested_capability, context)
    if policy_result.denied:
        return CapabilityCheckResult(
            granted=False,
            reason=f"policy_denied:{policy_result.policy_id}",
            requires_escalation=policy_result.escalation_available
        )

    # Check wildcard grants
    granted_capabilities = get_granted_capabilities(entity_id)
    if capability_matches_any(requested_capability, granted_capabilities):
        return CapabilityCheckResult(
            granted=True,
            reason="capability_granted",
            requires_escalation=False
        )

    # Default deny
    return CapabilityCheckResult(
        granted=False,
        reason="capability_not_granted",
        requires_escalation=True
    )


def capability_matches_any(requested: str, granted: list[str]) -> bool:
    """Check if requested capability matches any granted capability or wildcard."""
    for cap in granted:
        if cap == requested:
            return True
        if cap.endswith("/*"):
            prefix = cap[:-1]  # Remove *
            if requested.startswith(prefix):
                return True
    return False
```

---

## 6. Extending the Taxonomy

### 6.1 Adding Custom Capabilities

Organizations extend the taxonomy using the `custom:` namespace:

```json
{
  "custom_capabilities": [
    {
      "capability": "custom:acme/billing/generate_invoice",
      "description": "Generate customer invoices",
      "risk_level": "medium",
      "minimum_tier": "trusted",
      "requires_escalation": false
    },
    {
      "capability": "custom:acme/compliance/audit_report",
      "description": "Generate compliance audit reports",
      "risk_level": "high",
      "minimum_tier": "certified",
      "requires_escalation": false
    }
  ]
}
```

### 6.2 Policy Overrides

Organizations may override default tier requirements:

```json
{
  "policy_overrides": [
    {
      "capability": "financial:transaction/medium",
      "condition": "context.department == 'finance'",
      "minimum_tier_override": "trusted",
      "requires_escalation_override": false
    },
    {
      "capability": "data:read/sensitive/pii",
      "condition": "context.purpose == 'customer_support'",
      "minimum_tier_override": "trusted",
      "requires_escalation_override": true
    }
  ]
}
```

### 6.3 Proposing Standard Capabilities

To propose additions to the standard taxonomy:

1. Open an issue at github.com/voriongit/basis-spec
2. Include: capability name, description, risk level, rationale
3. Community review period: 30 days
4. Merge requires maintainer approval

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
