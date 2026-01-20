# BASIS Error Codes

**Version 1.0.0 | January 2026**

---

## Overview

This document defines the standard error codes for BASIS-conformant implementations. All errors follow a consistent format and categorization to enable programmatic handling and debugging.

---

## 1. Error Response Format

All BASIS API errors MUST return this structure:

```json
{
  "error_code": "E1001",
  "error_category": "TRUST",
  "error_message": "Insufficient trust score for requested capability",
  "timestamp": "2026-01-15T10:30:00Z",
  "request_id": "req_a1b2c3d4e5f6",
  "details": {
    "entity_id": "ent_1234567890abcdef",
    "current_score": 450,
    "required_tier": "trusted",
    "current_tier": "standard",
    "capability_requested": "financial:transaction/medium"
  },
  "retry_after": null,
  "documentation_url": "https://vorion.org/basis/errors/E1001"
}
```

### 1.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| error_code | string | Unique error identifier (E####) |
| error_category | string | Error category for grouping |
| error_message | string | Human-readable description |
| timestamp | string | ISO 8601 timestamp |
| request_id | string | Unique request identifier for debugging |

### 1.2 Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| details | object | Additional context specific to error type |
| retry_after | integer | Seconds to wait before retry (null if not applicable) |
| documentation_url | string | Link to detailed error documentation |

---

## 2. Error Categories

| Category | Code Range | Description |
|----------|------------|-------------|
| TRUST | E1000-E1099 | Trust score and tier errors |
| CAPABILITY | E1100-E1199 | Capability and permission errors |
| INTENT | E1200-E1299 | Intent parsing and validation errors |
| ENFORCE | E1300-E1399 | Policy enforcement errors |
| PROOF | E1400-E1499 | Audit and proof errors |
| CHAIN | E1500-E1599 | Blockchain/ledger errors |
| ENTITY | E1600-E1699 | Entity management errors |
| POLICY | E1700-E1799 | Policy configuration errors |
| RATE_LIMIT | E1800-E1899 | Rate limiting and quota errors |
| SYSTEM | E1900-E1999 | System and infrastructure errors |
| AUTH | E2000-E2099 | Authentication and authorization errors |
| VALIDATION | E2100-E2199 | Input validation errors |

---

## 3. Error Code Reference

### 3.1 Trust Errors (E1000-E1099)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1001 | TRUST_INSUFFICIENT | Insufficient trust score for requested capability | 403 | No |
| E1002 | TRUST_TIER_REQUIRED | Action requires higher trust tier | 403 | No |
| E1003 | TRUST_SUSPENDED | Entity trust has been suspended | 403 | No |
| E1004 | TRUST_SCORE_ZERO | Entity trust score is zero; all actions blocked | 403 | No |
| E1005 | TRUST_DECAY_CRITICAL | Trust has decayed below usable threshold | 403 | No |
| E1010 | TRUST_CALCULATION_FAILED | Failed to calculate trust score | 500 | Yes |
| E1011 | TRUST_HISTORY_UNAVAILABLE | Trust history could not be retrieved | 500 | Yes |

**Details Schema for E1001:**

```json
{
  "entity_id": "string",
  "current_score": "integer",
  "required_score": "integer",
  "current_tier": "string",
  "required_tier": "string",
  "capability_requested": "string",
  "score_gap": "integer"
}
```

---

### 3.2 Capability Errors (E1100-E1199)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1101 | CAPABILITY_DENIED | Capability not granted to entity | 403 | No |
| E1102 | CAPABILITY_REQUIRES_ESCALATION | Capability requires human approval | 403 | No* |
| E1103 | CAPABILITY_UNKNOWN | Unknown capability requested | 400 | No |
| E1104 | CAPABILITY_DISABLED | Capability has been disabled by policy | 403 | No |
| E1105 | CAPABILITY_EXPIRED | Capability grant has expired | 403 | No |
| E1106 | CAPABILITY_SCOPE_EXCEEDED | Action exceeds capability scope | 403 | No |
| E1110 | CAPABILITY_CONFLICT | Conflicting capabilities requested | 400 | No |
| E1111 | CAPABILITY_WILDCARD_DENIED | Wildcard capability grant not permitted | 403 | No |

*E1102 is retryable after escalation is approved.

**Details Schema for E1101:**

```json
{
  "entity_id": "string",
  "capability_requested": "string",
  "capabilities_held": ["string"],
  "minimum_tier_required": "string",
  "escalation_available": "boolean"
}
```

---

### 3.3 Intent Errors (E1200-E1299)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1201 | INTENT_PARSE_FAILED | Failed to parse action intent | 400 | No |
| E1202 | INTENT_AMBIGUOUS | Intent is ambiguous; clarification required | 400 | No |
| E1203 | INTENT_PROHIBITED | Intent describes prohibited action | 403 | No |
| E1204 | INTENT_RISK_UNASSESSABLE | Unable to assess risk level | 500 | Yes |
| E1205 | INTENT_RESOURCE_UNKNOWN | Referenced resource does not exist | 404 | No |
| E1206 | INTENT_RESOURCE_INACCESSIBLE | Resource exists but is not accessible | 403 | No |
| E1210 | INTENT_INJECTION_DETECTED | Potential prompt injection detected | 403 | No |
| E1211 | INTENT_JAILBREAK_DETECTED | Jailbreak attempt detected | 403 | No |
| E1212 | INTENT_MANIPULATION_DETECTED | Intent manipulation pattern detected | 403 | No |

**Details Schema for E1210:**

```json
{
  "entity_id": "string",
  "intent_id": "string",
  "detection_type": "string",
  "confidence": "float",
  "pattern_matched": "string",
  "raw_input_hash": "string"
}
```

---

### 3.4 Enforce Errors (E1300-E1399)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1301 | ENFORCE_POLICY_VIOLATION | Action violates active policy | 403 | No |
| E1302 | ENFORCE_RULE_BLOCKED | Action blocked by explicit rule | 403 | No |
| E1303 | ENFORCE_CONTEXT_DENIED | Action denied in current context | 403 | No |
| E1304 | ENFORCE_TIME_RESTRICTED | Action not permitted at this time | 403 | Yes* |
| E1305 | ENFORCE_LOCATION_RESTRICTED | Action not permitted from this location | 403 | No |
| E1306 | ENFORCE_RESOURCE_LOCKED | Target resource is locked | 423 | Yes |
| E1310 | ENFORCE_SERVICE_UNAVAILABLE | Enforcement service unavailable | 503 | Yes |
| E1311 | ENFORCE_TIMEOUT | Enforcement check timed out | 504 | Yes |
| E1320 | ESCALATION_REQUIRED | Action requires escalation | 403 | No* |
| E1321 | ESCALATION_PENDING | Escalation is pending approval | 202 | Yes |
| E1322 | ESCALATION_DENIED | Escalation was denied | 403 | No |
| E1323 | ESCALATION_EXPIRED | Escalation approval has expired | 403 | No |
| E1324 | ESCALATION_TARGET_UNAVAILABLE | No escalation target available | 503 | Yes |

*E1304: Retryable after time restriction passes.
*E1320: Retryable after escalation is submitted and approved.

**Details Schema for E1301:**

```json
{
  "entity_id": "string",
  "intent_id": "string",
  "policy_id": "string",
  "policy_name": "string",
  "rule_id": "string",
  "violation_description": "string",
  "remediation_hint": "string"
}
```

---

### 3.5 Proof Errors (E1400-E1499)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1401 | PROOF_GENERATION_FAILED | Failed to generate proof record | 500 | Yes |
| E1402 | PROOF_NOT_FOUND | Proof record not found | 404 | No |
| E1403 | PROOF_CHAIN_BROKEN | Proof chain integrity violation detected | 500 | No |
| E1404 | PROOF_HASH_MISMATCH | Proof hash verification failed | 500 | No |
| E1405 | PROOF_STORAGE_FAILED | Failed to store proof record | 500 | Yes |
| E1410 | PROOF_RETRIEVAL_FAILED | Failed to retrieve proof record | 500 | Yes |
| E1411 | PROOF_VERIFICATION_FAILED | Proof verification failed | 500 | Yes |
| E1412 | PROOF_EXPIRED | Proof record has passed retention period | 410 | No |

**Details Schema for E1403:**

```json
{
  "proof_id": "string",
  "expected_previous": "string",
  "actual_previous": "string",
  "break_detected_at": "string",
  "affected_proofs_count": "integer"
}
```

---

### 3.6 Chain Errors (E1500-E1599)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1501 | CHAIN_ANCHOR_FAILED | Failed to anchor to blockchain | 500 | Yes |
| E1502 | CHAIN_VERIFICATION_FAILED | Blockchain verification failed | 500 | Yes |
| E1503 | CHAIN_NOT_CONFIGURED | Blockchain anchoring not configured | 501 | No |
| E1504 | CHAIN_TRANSACTION_REJECTED | Blockchain transaction rejected | 500 | Yes |
| E1505 | CHAIN_TIMEOUT | Blockchain operation timed out | 504 | Yes |
| E1510 | CHAIN_INSUFFICIENT_FUNDS | Insufficient funds for anchoring | 402 | No |
| E1511 | CHAIN_NETWORK_ERROR | Blockchain network error | 503 | Yes |

**Details Schema for E1501:**

```json
{
  "proof_ids": ["string"],
  "chain_type": "string",
  "error_detail": "string",
  "retry_recommended": "boolean",
  "batch_size": "integer"
}
```

---

### 3.7 Entity Errors (E1600-E1699)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1601 | ENTITY_NOT_FOUND | Entity not found | 404 | No |
| E1602 | ENTITY_SUSPENDED | Entity is suspended | 403 | No |
| E1603 | ENTITY_DELETED | Entity has been deleted | 410 | No |
| E1604 | ENTITY_CREATE_FAILED | Failed to create entity | 500 | Yes |
| E1605 | ENTITY_UPDATE_FAILED | Failed to update entity | 500 | Yes |
| E1606 | ENTITY_DUPLICATE | Entity with identifier already exists | 409 | No |
| E1610 | ENTITY_QUOTA_EXCEEDED | Entity quota exceeded | 429 | Yes |
| E1611 | ENTITY_TYPE_INVALID | Invalid entity type | 400 | No |

**Details Schema for E1601:**

```json
{
  "entity_id": "string",
  "search_criteria": "object"
}
```

---

### 3.8 Policy Errors (E1700-E1799)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1701 | POLICY_NOT_FOUND | Policy not found | 404 | No |
| E1702 | POLICY_INVALID | Policy definition is invalid | 400 | No |
| E1703 | POLICY_CONFLICT | Policy conflicts with existing policy | 409 | No |
| E1704 | POLICY_EVALUATION_FAILED | Failed to evaluate policy | 500 | Yes |
| E1705 | POLICY_CIRCULAR_REFERENCE | Circular policy reference detected | 400 | No |
| E1710 | POLICY_UPDATE_FAILED | Failed to update policy | 500 | Yes |
| E1711 | POLICY_DELETE_BLOCKED | Policy cannot be deleted; in use | 409 | No |

---

### 3.9 Rate Limit Errors (E1800-E1899)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1801 | RATE_LIMIT_EXCEEDED | Rate limit exceeded | 429 | Yes |
| E1802 | QUOTA_EXCEEDED | Usage quota exceeded | 429 | Yes* |
| E1803 | CONCURRENT_LIMIT | Too many concurrent requests | 429 | Yes |
| E1804 | BURST_LIMIT | Burst limit exceeded | 429 | Yes |
| E1810 | DAILY_LIMIT | Daily limit reached | 429 | Yes* |
| E1811 | MONTHLY_LIMIT | Monthly limit reached | 429 | No* |

*Retryable after quota resets.

**Details Schema for E1801:**

```json
{
  "limit_type": "string",
  "limit_value": "integer",
  "current_value": "integer",
  "window_seconds": "integer",
  "reset_at": "string"
}
```

**Required Header:** Implementations MUST include `retry_after` field with seconds until retry is permitted.

---

### 3.10 System Errors (E1900-E1999)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E1901 | INTERNAL_ERROR | Internal system error | 500 | Yes |
| E1902 | SERVICE_UNAVAILABLE | Service temporarily unavailable | 503 | Yes |
| E1903 | MAINTENANCE_MODE | System is in maintenance mode | 503 | Yes |
| E1904 | DEPENDENCY_FAILED | External dependency failed | 502 | Yes |
| E1905 | DATABASE_ERROR | Database operation failed | 500 | Yes |
| E1910 | CONFIGURATION_ERROR | System configuration error | 500 | No |
| E1911 | VERSION_MISMATCH | API version mismatch | 400 | No |

---

### 3.11 Authentication Errors (E2000-E2099)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E2001 | AUTH_REQUIRED | Authentication required | 401 | No |
| E2002 | AUTH_INVALID | Invalid authentication credentials | 401 | No |
| E2003 | AUTH_EXPIRED | Authentication has expired | 401 | No |
| E2004 | AUTH_REVOKED | Authentication has been revoked | 401 | No |
| E2010 | AUTH_MFA_REQUIRED | Multi-factor authentication required | 401 | No |
| E2011 | AUTH_MFA_FAILED | Multi-factor authentication failed | 401 | No |
| E2020 | AUTHZ_INSUFFICIENT | Insufficient authorization | 403 | No |
| E2021 | AUTHZ_SCOPE_INVALID | Authorization scope invalid | 403 | No |

---

### 3.12 Validation Errors (E2100-E2199)

| Code | Name | Message | HTTP | Retryable |
|------|------|---------|------|-----------|
| E2101 | VALIDATION_FAILED | Request validation failed | 400 | No |
| E2102 | FIELD_REQUIRED | Required field missing | 400 | No |
| E2103 | FIELD_INVALID | Field value invalid | 400 | No |
| E2104 | FIELD_TYPE_MISMATCH | Field type does not match schema | 400 | No |
| E2105 | FIELD_OUT_OF_RANGE | Field value out of permitted range | 400 | No |
| E2110 | SCHEMA_VIOLATION | Request violates schema | 400 | No |
| E2111 | JSON_PARSE_ERROR | Invalid JSON in request body | 400 | No |

**Details Schema for E2101:**

```json
{
  "validation_errors": [
    {
      "field": "string",
      "code": "string",
      "message": "string",
      "expected": "string",
      "received": "string"
    }
  ]
}
```

---

## 4. Error Handling Best Practices

### 4.1 For Implementers

1. **Always return structured errors** — Never return plain text error messages
2. **Include request_id** — Essential for debugging and support
3. **Provide actionable details** — Help clients understand how to resolve
4. **Use appropriate HTTP status** — Match error category to status code
5. **Log all errors** — Maintain error logs for diagnostics

### 4.2 For Clients

1. **Check error_category first** — Determines handling strategy
2. **Respect retry_after** — Don't retry before the specified time
3. **Handle escalation errors specially** — E1102/E1320 may require user action
4. **Log error_code and request_id** — Include in support requests
5. **Implement exponential backoff** — For retryable errors

### 4.3 Retry Strategy

```python
RETRYABLE_CATEGORIES = ["RATE_LIMIT", "SYSTEM"]
RETRYABLE_CODES = ["E1010", "E1011", "E1204", "E1306", "E1310", "E1311", ...]

def should_retry(error: BasisError) -> bool:
    if error.category in RETRYABLE_CATEGORIES:
        return True
    if error.code in RETRYABLE_CODES:
        return True
    return False

def get_retry_delay(error: BasisError, attempt: int) -> int:
    if error.retry_after:
        return error.retry_after
    # Exponential backoff: 1s, 2s, 4s, 8s, max 60s
    return min(60, 2 ** attempt)
```

---

## 5. Error Code Registry

### 5.1 Reserved Ranges

| Range | Purpose |
|-------|---------|
| E0000-E0999 | Reserved for future use |
| E1000-E2999 | Standard BASIS errors |
| E3000-E3999 | Reserved for extensions |
| E4000-E4999 | Reserved for extensions |
| E5000-E9999 | Implementation-specific errors |

### 5.2 Custom Error Codes

Implementations MAY define custom error codes in the E5000-E9999 range:

```json
{
  "error_code": "E5001",
  "error_category": "CUSTOM",
  "error_message": "Organization-specific error",
  "vendor": "acme",
  "vendor_code": "ACME_001"
}
```

Custom codes:
- MUST be in range E5000-E9999
- MUST include `vendor` field
- SHOULD include `vendor_code` for vendor-specific reference
- MUST NOT conflict with standard codes

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
