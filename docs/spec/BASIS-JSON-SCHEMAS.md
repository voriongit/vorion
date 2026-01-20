# BASIS JSON Schemas

**Version 1.0.0 | January 2026**

---

## Overview

This document provides the complete JSON Schema definitions for BASIS wire protocol. All schemas follow JSON Schema Draft 2020-12.

---

## 1. Common Definitions

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/common.json",
  "title": "BASIS Common Definitions",

  "$defs": {
    "entity_id": {
      "type": "string",
      "pattern": "^ent_[a-f0-9]{32}$",
      "description": "Unique entity identifier"
    },

    "intent_id": {
      "type": "string",
      "pattern": "^int_[a-f0-9]{32}$",
      "description": "Unique intent identifier"
    },

    "proof_id": {
      "type": "string",
      "pattern": "^prf_[a-f0-9]{32}$",
      "description": "Unique proof identifier"
    },

    "policy_id": {
      "type": "string",
      "pattern": "^pol_[a-f0-9]{32}$",
      "description": "Unique policy identifier"
    },

    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp with timezone"
    },

    "sha256_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA-256 hash in lowercase hex"
    },

    "trust_score": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1000,
      "description": "Entity trust score"
    },

    "trust_tier": {
      "type": "string",
      "enum": ["sandbox", "provisional", "standard", "trusted", "certified", "autonomous"],
      "description": "Trust tier derived from score"
    },

    "risk_level": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "Assessed risk level"
    },

    "decision": {
      "type": "string",
      "enum": ["ALLOW", "DENY", "ESCALATE", "DEGRADE"],
      "description": "Governance decision"
    },

    "capability": {
      "type": "string",
      "pattern": "^(sandbox|data|comm|execute|financial|admin|custom):[a-z_]+(/[a-z_]+)*$",
      "description": "Capability identifier in namespace:category/action format"
    }
  }
}
```

---

## 2. Intent Record Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/intent-record.json",
  "title": "BASIS Intent Record",
  "description": "Output of the INTENT layer after parsing an action request",

  "type": "object",
  "required": [
    "intent_id",
    "entity_id",
    "timestamp",
    "action",
    "capabilities_required",
    "risk_level"
  ],

  "properties": {
    "intent_id": {
      "$ref": "common.json#/$defs/intent_id"
    },

    "entity_id": {
      "$ref": "common.json#/$defs/entity_id"
    },

    "timestamp": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "action": {
      "type": "object",
      "required": ["type", "description"],
      "properties": {
        "type": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255,
          "description": "Action type identifier"
        },
        "description": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000,
          "description": "Human-readable action description"
        },
        "parameters": {
          "type": "object",
          "additionalProperties": true,
          "description": "Action-specific parameters"
        },
        "target_resources": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 500
          },
          "maxItems": 100,
          "description": "Resources affected by this action"
        },
        "raw_input_hash": {
          "$ref": "common.json#/$defs/sha256_hash",
          "description": "Hash of original input for audit"
        }
      },
      "additionalProperties": false
    },

    "capabilities_required": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/capability"
      },
      "minItems": 1,
      "maxItems": 50,
      "uniqueItems": true,
      "description": "Capabilities needed to perform this action"
    },

    "risk_level": {
      "$ref": "common.json#/$defs/risk_level"
    },

    "risk_factors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["factor", "weight"],
        "properties": {
          "factor": {
            "type": "string",
            "description": "Risk factor name"
          },
          "weight": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Contribution to overall risk"
          },
          "details": {
            "type": "string",
            "description": "Additional context"
          }
        }
      },
      "description": "Factors contributing to risk assessment"
    },

    "context": {
      "type": "object",
      "properties": {
        "session_id": {
          "type": "string"
        },
        "parent_intent_id": {
          "$ref": "common.json#/$defs/intent_id"
        },
        "correlation_id": {
          "type": "string"
        },
        "source_ip": {
          "type": "string",
          "format": "ipv4"
        },
        "user_agent": {
          "type": "string"
        },
        "metadata": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false,
      "description": "Additional context for policy evaluation"
    },

    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "message"],
        "properties": {
          "code": {
            "type": "string"
          },
          "message": {
            "type": "string"
          }
        }
      },
      "description": "Warnings generated during intent parsing"
    }
  },

  "additionalProperties": false
}
```

---

## 3. Enforce Request Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/enforce-request.json",
  "title": "BASIS Enforce Request",
  "description": "Request to the ENFORCE layer for policy evaluation",

  "type": "object",
  "required": ["intent"],

  "properties": {
    "intent": {
      "$ref": "intent-record.json",
      "description": "Intent record to evaluate"
    },

    "options": {
      "type": "object",
      "properties": {
        "dry_run": {
          "type": "boolean",
          "default": false,
          "description": "If true, evaluate but don't record decision"
        },
        "skip_proof": {
          "type": "boolean",
          "default": false,
          "description": "If true, don't generate proof record"
        },
        "timeout_ms": {
          "type": "integer",
          "minimum": 100,
          "maximum": 30000,
          "default": 5000,
          "description": "Maximum evaluation time in milliseconds"
        },
        "context_overrides": {
          "type": "object",
          "additionalProperties": true,
          "description": "Override context values for evaluation"
        }
      },
      "additionalProperties": false
    }
  },

  "additionalProperties": false
}
```

---

## 4. Enforce Response Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/enforce-response.json",
  "title": "BASIS Enforce Response",
  "description": "Response from the ENFORCE layer with governance decision",

  "type": "object",
  "required": [
    "decision",
    "intent_id",
    "entity_id",
    "trust_score",
    "trust_tier",
    "timestamp",
    "proof_id"
  ],

  "properties": {
    "decision": {
      "$ref": "common.json#/$defs/decision"
    },

    "intent_id": {
      "$ref": "common.json#/$defs/intent_id"
    },

    "entity_id": {
      "$ref": "common.json#/$defs/entity_id"
    },

    "trust_score": {
      "$ref": "common.json#/$defs/trust_score"
    },

    "trust_tier": {
      "$ref": "common.json#/$defs/trust_tier"
    },

    "timestamp": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "proof_id": {
      "$ref": "common.json#/$defs/proof_id"
    },

    "capabilities_granted": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/capability"
      },
      "description": "Capabilities authorized for this action (may differ from requested)"
    },

    "denial_code": {
      "type": "string",
      "pattern": "^E[0-9]{4}$",
      "description": "Machine-readable denial code (required if decision is DENY)"
    },

    "denial_reason": {
      "type": "string",
      "maxLength": 1000,
      "description": "Human-readable denial reason (required if decision is DENY)"
    },

    "escalation_id": {
      "type": "string",
      "pattern": "^esc_[a-f0-9]{32}$",
      "description": "Escalation tracking ID (required if decision is ESCALATE)"
    },

    "escalation_target": {
      "type": "string",
      "description": "Escalation target identifier (required if decision is ESCALATE)"
    },

    "escalation_reason": {
      "type": "string",
      "maxLength": 1000,
      "description": "Why escalation is required"
    },

    "escalation_priority": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "Escalation urgency"
    },

    "degraded_capability": {
      "$ref": "common.json#/$defs/capability",
      "description": "Reduced capability granted (required if decision is DEGRADE)"
    },

    "degradation_reason": {
      "type": "string",
      "maxLength": 1000,
      "description": "Why capability was degraded"
    },

    "policy_references": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["policy_id", "rule_id"],
        "properties": {
          "policy_id": {
            "$ref": "common.json#/$defs/policy_id"
          },
          "rule_id": {
            "type": "string"
          },
          "contribution": {
            "type": "string",
            "enum": ["allow", "deny", "escalate", "neutral"]
          }
        }
      },
      "description": "Policies that influenced this decision"
    },

    "expires_at": {
      "$ref": "common.json#/$defs/timestamp",
      "description": "When this authorization expires (if ALLOW)"
    },

    "evaluation_ms": {
      "type": "integer",
      "minimum": 0,
      "description": "Time taken to evaluate in milliseconds"
    },

    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "message"],
        "properties": {
          "code": {
            "type": "string"
          },
          "message": {
            "type": "string"
          }
        }
      }
    }
  },

  "allOf": [
    {
      "if": {
        "properties": { "decision": { "const": "DENY" } }
      },
      "then": {
        "required": ["denial_code", "denial_reason"]
      }
    },
    {
      "if": {
        "properties": { "decision": { "const": "ESCALATE" } }
      },
      "then": {
        "required": ["escalation_id", "escalation_target", "escalation_reason"]
      }
    },
    {
      "if": {
        "properties": { "decision": { "const": "DEGRADE" } }
      },
      "then": {
        "required": ["degraded_capability", "degradation_reason"]
      }
    }
  ],

  "additionalProperties": false
}
```

---

## 5. Proof Record Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/proof-record.json",
  "title": "BASIS Proof Record",
  "description": "Immutable audit record created by the PROOF layer",

  "type": "object",
  "required": [
    "proof_id",
    "timestamp",
    "payload_hash",
    "previous_proof_id",
    "payload"
  ],

  "properties": {
    "proof_id": {
      "$ref": "common.json#/$defs/proof_id"
    },

    "timestamp": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "payload_hash": {
      "$ref": "common.json#/$defs/sha256_hash",
      "description": "SHA-256 hash of canonical payload JSON"
    },

    "previous_proof_id": {
      "oneOf": [
        { "$ref": "common.json#/$defs/proof_id" },
        { "const": "genesis" }
      ],
      "description": "Previous proof in chain (or 'genesis' for first)"
    },

    "previous_hash": {
      "$ref": "common.json#/$defs/sha256_hash",
      "description": "Hash of previous proof record"
    },

    "sequence_number": {
      "type": "integer",
      "minimum": 0,
      "description": "Sequential proof number for gap detection"
    },

    "payload": {
      "type": "object",
      "required": [
        "intent_id",
        "entity_id",
        "decision",
        "trust_score"
      ],
      "properties": {
        "intent_id": {
          "$ref": "common.json#/$defs/intent_id"
        },
        "entity_id": {
          "$ref": "common.json#/$defs/entity_id"
        },
        "decision": {
          "$ref": "common.json#/$defs/decision"
        },
        "trust_score": {
          "$ref": "common.json#/$defs/trust_score"
        },
        "trust_tier": {
          "$ref": "common.json#/$defs/trust_tier"
        },
        "action_type": {
          "type": "string"
        },
        "capabilities_required": {
          "type": "array",
          "items": {
            "$ref": "common.json#/$defs/capability"
          }
        },
        "capabilities_granted": {
          "type": "array",
          "items": {
            "$ref": "common.json#/$defs/capability"
          }
        },
        "risk_level": {
          "$ref": "common.json#/$defs/risk_level"
        },
        "denial_code": {
          "type": "string"
        },
        "denial_reason": {
          "type": "string"
        },
        "escalation_id": {
          "type": "string"
        },
        "policy_references": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },

    "signature": {
      "type": "object",
      "properties": {
        "algorithm": {
          "type": "string",
          "enum": ["RSA-SHA256", "ECDSA-SHA256"]
        },
        "key_id": {
          "type": "string"
        },
        "value": {
          "type": "string",
          "contentEncoding": "base64"
        }
      },
      "description": "Cryptographic signature of the proof"
    },

    "chain_anchor": {
      "type": "object",
      "properties": {
        "chain_type": {
          "type": "string",
          "enum": ["ethereum", "polygon", "solana", "private"]
        },
        "transaction_id": {
          "type": "string"
        },
        "block_number": {
          "type": "integer"
        },
        "anchored_at": {
          "$ref": "common.json#/$defs/timestamp"
        },
        "merkle_root": {
          "$ref": "common.json#/$defs/sha256_hash"
        },
        "merkle_proof": {
          "type": "array",
          "items": {
            "$ref": "common.json#/$defs/sha256_hash"
          }
        }
      },
      "description": "Blockchain anchor details (if CHAIN layer used)"
    }
  },

  "additionalProperties": false
}
```

---

## 6. Entity Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/entity.json",
  "title": "BASIS Entity",
  "description": "An agent, user, or system with a trust score",

  "type": "object",
  "required": [
    "entity_id",
    "entity_type",
    "trust_score",
    "trust_tier",
    "created_at",
    "status"
  ],

  "properties": {
    "entity_id": {
      "$ref": "common.json#/$defs/entity_id"
    },

    "entity_type": {
      "type": "string",
      "enum": ["agent", "user", "service", "system"],
      "description": "Type of entity"
    },

    "name": {
      "type": "string",
      "maxLength": 255,
      "description": "Human-readable entity name"
    },

    "description": {
      "type": "string",
      "maxLength": 2000,
      "description": "Entity description"
    },

    "trust_score": {
      "$ref": "common.json#/$defs/trust_score"
    },

    "trust_tier": {
      "$ref": "common.json#/$defs/trust_tier"
    },

    "capabilities": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/capability"
      },
      "description": "Explicitly granted capabilities (beyond tier defaults)"
    },

    "capability_restrictions": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/capability"
      },
      "description": "Capabilities explicitly denied"
    },

    "owner_id": {
      "$ref": "common.json#/$defs/entity_id",
      "description": "Entity that owns/manages this entity"
    },

    "parent_id": {
      "$ref": "common.json#/$defs/entity_id",
      "description": "Parent entity in hierarchy"
    },

    "status": {
      "type": "string",
      "enum": ["active", "suspended", "pending", "deleted"],
      "description": "Current entity status"
    },

    "created_at": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "updated_at": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "last_action_at": {
      "$ref": "common.json#/$defs/timestamp",
      "description": "Timestamp of last action for decay calculation"
    },

    "metadata": {
      "type": "object",
      "additionalProperties": true,
      "description": "Custom entity metadata"
    },

    "statistics": {
      "type": "object",
      "properties": {
        "total_actions": {
          "type": "integer"
        },
        "successful_actions": {
          "type": "integer"
        },
        "failed_actions": {
          "type": "integer"
        },
        "denied_actions": {
          "type": "integer"
        },
        "escalated_actions": {
          "type": "integer"
        }
      },
      "description": "Entity action statistics"
    }
  },

  "additionalProperties": false
}
```

---

## 7. Error Response Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/error-response.json",
  "title": "BASIS Error Response",
  "description": "Standard error response format",

  "type": "object",
  "required": [
    "error_code",
    "error_category",
    "error_message",
    "timestamp",
    "request_id"
  ],

  "properties": {
    "error_code": {
      "type": "string",
      "pattern": "^E[0-9]{4}$",
      "description": "Unique error identifier"
    },

    "error_category": {
      "type": "string",
      "enum": [
        "TRUST",
        "CAPABILITY",
        "INTENT",
        "ENFORCE",
        "PROOF",
        "CHAIN",
        "ENTITY",
        "POLICY",
        "RATE_LIMIT",
        "SYSTEM",
        "AUTH",
        "VALIDATION"
      ],
      "description": "Error category for grouping"
    },

    "error_message": {
      "type": "string",
      "maxLength": 1000,
      "description": "Human-readable error description"
    },

    "timestamp": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "request_id": {
      "type": "string",
      "pattern": "^req_[a-f0-9]{32}$",
      "description": "Unique request identifier for debugging"
    },

    "details": {
      "type": "object",
      "additionalProperties": true,
      "description": "Additional context specific to error type"
    },

    "retry_after": {
      "type": "integer",
      "minimum": 0,
      "description": "Seconds to wait before retry (null if not applicable)"
    },

    "documentation_url": {
      "type": "string",
      "format": "uri",
      "description": "Link to detailed error documentation"
    }
  },

  "additionalProperties": false
}
```

---

## 8. Trust Score Update Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/trust-score-update.json",
  "title": "BASIS Trust Score Update",
  "description": "Record of a trust score change",

  "type": "object",
  "required": [
    "entity_id",
    "previous_score",
    "new_score",
    "change_reason",
    "timestamp",
    "proof_id"
  ],

  "properties": {
    "entity_id": {
      "$ref": "common.json#/$defs/entity_id"
    },

    "previous_score": {
      "$ref": "common.json#/$defs/trust_score"
    },

    "new_score": {
      "$ref": "common.json#/$defs/trust_score"
    },

    "previous_tier": {
      "$ref": "common.json#/$defs/trust_tier"
    },

    "new_tier": {
      "$ref": "common.json#/$defs/trust_tier"
    },

    "delta": {
      "type": "integer",
      "description": "Score change (can be negative)"
    },

    "change_reason": {
      "type": "string",
      "enum": [
        "success_low_risk",
        "success_medium_risk",
        "success_high_risk",
        "success_critical_risk",
        "failure_low_risk",
        "failure_medium_risk",
        "failure_high_risk",
        "failure_critical_risk",
        "escalation_appropriate",
        "escalation_unnecessary",
        "violation_minor",
        "violation_major",
        "violation_critical",
        "decay",
        "admin_adjustment",
        "initial_assignment"
      ],
      "description": "Reason for score change"
    },

    "decay_applied": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Decay factor applied (1.0 = no decay)"
    },

    "days_since_last_action": {
      "type": "number",
      "minimum": 0,
      "description": "Days elapsed since previous action"
    },

    "timestamp": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "proof_id": {
      "$ref": "common.json#/$defs/proof_id",
      "description": "Proof record associated with this change"
    },

    "admin_id": {
      "$ref": "common.json#/$defs/entity_id",
      "description": "Admin who made manual adjustment (if applicable)"
    },

    "admin_justification": {
      "type": "string",
      "maxLength": 1000,
      "description": "Justification for manual adjustment"
    }
  },

  "additionalProperties": false
}
```

---

## 9. Escalation Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/escalation.json",
  "title": "BASIS Escalation",
  "description": "Escalation record for human review",

  "type": "object",
  "required": [
    "escalation_id",
    "intent_id",
    "entity_id",
    "reason",
    "priority",
    "status",
    "created_at"
  ],

  "properties": {
    "escalation_id": {
      "type": "string",
      "pattern": "^esc_[a-f0-9]{32}$"
    },

    "intent_id": {
      "$ref": "common.json#/$defs/intent_id"
    },

    "entity_id": {
      "$ref": "common.json#/$defs/entity_id"
    },

    "reason": {
      "type": "string",
      "maxLength": 1000,
      "description": "Why escalation is required"
    },

    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },

    "status": {
      "type": "string",
      "enum": ["pending", "assigned", "approved", "denied", "expired", "cancelled"]
    },

    "target_type": {
      "type": "string",
      "enum": ["user", "role", "queue"],
      "description": "Type of escalation target"
    },

    "target_id": {
      "type": "string",
      "description": "Specific target identifier"
    },

    "assigned_to": {
      "$ref": "common.json#/$defs/entity_id",
      "description": "Entity currently assigned to review"
    },

    "created_at": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "assigned_at": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "resolved_at": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "expires_at": {
      "$ref": "common.json#/$defs/timestamp",
      "description": "When escalation auto-expires if unresolved"
    },

    "resolution": {
      "type": "object",
      "properties": {
        "decision": {
          "type": "string",
          "enum": ["approved", "denied"]
        },
        "resolver_id": {
          "$ref": "common.json#/$defs/entity_id"
        },
        "justification": {
          "type": "string",
          "maxLength": 2000
        },
        "conditions": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Conditions attached to approval"
        }
      }
    },

    "context": {
      "type": "object",
      "properties": {
        "action_description": {
          "type": "string"
        },
        "entity_trust_score": {
          "$ref": "common.json#/$defs/trust_score"
        },
        "capabilities_requested": {
          "type": "array",
          "items": {
            "$ref": "common.json#/$defs/capability"
          }
        },
        "risk_level": {
          "$ref": "common.json#/$defs/risk_level"
        },
        "policy_triggers": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "description": "Context for reviewer"
    }
  },

  "additionalProperties": false
}
```

---

## 10. API Health Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/health.json",
  "title": "BASIS Health Response",
  "description": "API health check response",

  "type": "object",
  "required": ["status", "timestamp", "version"],

  "properties": {
    "status": {
      "type": "string",
      "enum": ["healthy", "degraded", "unhealthy"]
    },

    "timestamp": {
      "$ref": "common.json#/$defs/timestamp"
    },

    "version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
      "description": "BASIS implementation version"
    },

    "conformance_level": {
      "type": "string",
      "enum": ["core", "complete", "extended"]
    },

    "components": {
      "type": "object",
      "properties": {
        "intent": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["up", "down", "degraded"] },
            "latency_ms": { "type": "integer" }
          }
        },
        "enforce": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["up", "down", "degraded"] },
            "latency_ms": { "type": "integer" }
          }
        },
        "proof": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["up", "down", "degraded"] },
            "latency_ms": { "type": "integer" },
            "chain_verified": { "type": "boolean" }
          }
        },
        "chain": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["up", "down", "degraded", "not_configured"] },
            "pending_anchors": { "type": "integer" }
          }
        },
        "database": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["up", "down", "degraded"] },
            "latency_ms": { "type": "integer" }
          }
        }
      }
    },

    "uptime_seconds": {
      "type": "integer",
      "minimum": 0
    }
  },

  "additionalProperties": false
}
```

---

## 11. Schema Validation

### 11.1 Canonical JSON

For hash computation, JSON MUST be serialized in canonical form:
- Keys sorted alphabetically
- No whitespace
- UTF-8 encoding
- Numbers without exponent notation

### 11.2 Validation Requirements

Implementations MUST:
- Validate all incoming requests against schemas
- Return E2110 (SCHEMA_VIOLATION) for invalid requests
- Include validation errors in response details

### 11.3 Schema Evolution

Schemas are versioned via the URL path (`/v1/`, `/v2/`, etc.):
- Minor changes (new optional fields) do not require new version
- Breaking changes require new version
- Deprecated versions supported for minimum 12 months

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
