# BASIS Failure Modes

**Version 1.0.0 | January 2026**

---

## Overview

This document defines how BASIS-conformant implementations MUST handle failure conditions. Proper failure handling is critical for maintaining security and auditability when components fail.

---

## 1. Failure Handling Principles

### 1.1 Core Principles

1. **Fail Secure** — On failure, default to DENY, not ALLOW
2. **Fail Auditable** — All failures MUST be logged
3. **Fail Gracefully** — Provide meaningful errors to clients
4. **Fail Recoverable** — Design for eventual recovery

### 1.2 Default Behavior

When any governance component fails, the default behavior is:

```
Decision: DENY
Reason: "governance_unavailable"
Code: E1310
Retryable: true
```

Implementations MUST NOT allow actions to proceed when governance cannot be evaluated.

---

## 2. Layer Failure Modes

### 2.1 INTENT Layer Failures

#### F-INTENT-001: Parse Failure

**Trigger:** INTENT layer cannot parse the action request.

**Symptoms:**
- Natural language parsing fails
- Required fields cannot be extracted
- Input exceeds complexity limits

**Required Behavior:**

```json
{
  "decision": "DENY",
  "error_code": "E1201",
  "error_message": "Failed to parse action intent",
  "retryable": false,
  "details": {
    "parse_stage": "extraction|classification|risk_assessment",
    "failure_reason": "string"
  }
}
```

**Recovery:**
- Client SHOULD reformulate request
- System SHOULD log parse failure for analysis
- Pattern of failures MAY indicate attack

---

#### F-INTENT-002: Risk Assessment Failure

**Trigger:** Risk level cannot be determined.

**Symptoms:**
- Unable to classify action type
- Resource references unresolvable
- Context insufficient for assessment

**Required Behavior:**

```json
{
  "decision": "ESCALATE",
  "error_code": "E1204",
  "error_message": "Unable to assess risk level",
  "retryable": true,
  "escalation_target": "human_reviewer",
  "details": {
    "partial_assessment": {},
    "missing_context": ["string"]
  }
}
```

**Recovery:**
- Escalate to human for manual risk assessment
- OR deny if escalation not available
- Log for model improvement

---

#### F-INTENT-003: Service Timeout

**Trigger:** INTENT processing exceeds time limit.

**Symptoms:**
- LLM inference timeout
- Dependency service timeout
- Resource exhaustion

**Required Behavior:**

```json
{
  "decision": "DENY",
  "error_code": "E1311",
  "error_message": "Intent processing timed out",
  "retryable": true,
  "retry_after": 5,
  "details": {
    "timeout_ms": 5000,
    "stage_reached": "string"
  }
}
```

**Recovery:**
- Client MAY retry after delay
- System SHOULD scale resources if persistent
- Alert if timeout rate exceeds threshold

---

### 2.2 ENFORCE Layer Failures

#### F-ENFORCE-001: Trust Score Unavailable

**Trigger:** Cannot retrieve entity trust score.

**Symptoms:**
- Database connection failure
- Entity record not found
- Cache miss and origin failure

**Required Behavior:**

```json
{
  "decision": "DENY",
  "error_code": "E1010",
  "error_message": "Trust score unavailable",
  "retryable": true,
  "retry_after": 2,
  "details": {
    "entity_id": "string",
    "failure_reason": "database|cache|not_found"
  }
}
```

**Recovery:**
- Retry with exponential backoff
- Fallback to cached score if recent (< 5 minutes)
- Alert if database persistently unavailable

---

#### F-ENFORCE-002: Policy Evaluation Failure

**Trigger:** Policy engine cannot evaluate rules.

**Symptoms:**
- Policy syntax error
- Circular policy reference
- Policy service unavailable

**Required Behavior:**

```json
{
  "decision": "DENY",
  "error_code": "E1704",
  "error_message": "Policy evaluation failed",
  "retryable": true,
  "retry_after": 5,
  "details": {
    "policy_id": "string",
    "failure_type": "syntax|circular|service"
  }
}
```

**Recovery:**
- Alert policy administrators immediately
- Disable failing policy if specific policy identified
- Fallback to default deny policy

---

#### F-ENFORCE-003: Escalation Target Unavailable

**Trigger:** No escalation target available for required escalation.

**Symptoms:**
- All escalation targets offline
- No targets configured
- Targets at capacity

**Required Behavior:**

```json
{
  "decision": "DENY",
  "error_code": "E1324",
  "error_message": "Escalation target unavailable",
  "retryable": true,
  "retry_after": 60,
  "details": {
    "escalation_required_for": "string",
    "targets_checked": ["string"],
    "queue_depth": 0
  }
}
```

**Recovery:**
- Queue escalation for later processing
- Notify administrators of unavailability
- Consider automatic approval for low-risk escalations (configurable)

---

#### F-ENFORCE-004: Capability Resolution Failure

**Trigger:** Cannot determine if capability is granted.

**Symptoms:**
- Unknown capability requested
- Capability hierarchy unresolvable
- Grant database unavailable

**Required Behavior:**

```json
{
  "decision": "DENY",
  "error_code": "E1103",
  "error_message": "Capability resolution failed",
  "retryable": true,
  "details": {
    "capability_requested": "string",
    "resolution_stage": "parse|lookup|inheritance"
  }
}
```

**Recovery:**
- For unknown capabilities: deny permanently
- For resolution failures: retry after delay

---

### 2.3 PROOF Layer Failures

#### F-PROOF-001: Proof Generation Failure

**Trigger:** Cannot create proof record.

**Symptoms:**
- Hash computation failure
- Chain linkage failure
- Serialization error

**Required Behavior:**

The action SHOULD still proceed if ENFORCE approved, but:

```json
{
  "warning": {
    "code": "W1401",
    "message": "Proof generation failed; action logged without proof",
    "details": {
      "proof_attempt_id": "string",
      "failure_reason": "string"
    }
  }
}
```

**Required Actions:**
- Log failure to separate error log
- Store action details for later proof generation
- Alert operations team
- Retry proof generation asynchronously

---

#### F-PROOF-002: Proof Storage Failure

**Trigger:** Cannot persist proof record.

**Symptoms:**
- Database write failure
- Storage quota exceeded
- Replication failure

**Required Behavior:**

If ENFORCE approved:
1. Buffer proof to local disk
2. Return action result with warning
3. Retry storage asynchronously

```json
{
  "warning": {
    "code": "W1405",
    "message": "Proof storage delayed; buffered locally",
    "details": {
      "proof_id": "string",
      "buffer_location": "local|memory",
      "retry_scheduled": "timestamp"
    }
  }
}
```

**Recovery:**
- Automated retry with exponential backoff
- Alert if buffer grows beyond threshold
- Manual intervention if storage persistently failing

---

#### F-PROOF-003: Chain Integrity Failure

**Trigger:** Proof chain integrity check fails.

**Symptoms:**
- Hash mismatch detected
- Gap in proof sequence
- Timestamp anomaly

**Required Behavior:**

**CRITICAL: This is a security incident.**

```json
{
  "decision": "DENY",
  "error_code": "E1403",
  "error_message": "Proof chain integrity violation",
  "retryable": false,
  "security_alert": true,
  "details": {
    "violation_type": "hash_mismatch|gap|timestamp",
    "first_affected_proof": "string",
    "affected_count": 0
  }
}
```

**Required Actions:**
1. Halt all proof operations immediately
2. Alert security team
3. Begin incident response
4. Do NOT attempt automatic repair

---

### 2.4 CHAIN Layer Failures (Optional Component)

#### F-CHAIN-001: Blockchain Unavailable

**Trigger:** Cannot connect to blockchain network.

**Symptoms:**
- Network connectivity failure
- Node unavailable
- Chain congestion

**Required Behavior:**

This is non-critical; proofs remain valid in PROOF layer.

```json
{
  "warning": {
    "code": "W1511",
    "message": "Blockchain anchoring delayed",
    "details": {
      "chain_type": "string",
      "proofs_pending_anchor": 0,
      "retry_scheduled": "timestamp"
    }
  }
}
```

**Recovery:**
- Queue proofs for later anchoring
- Retry on schedule
- Alert if backlog exceeds threshold

---

#### F-CHAIN-002: Anchor Transaction Failed

**Trigger:** Blockchain transaction rejected or failed.

**Symptoms:**
- Insufficient gas/fees
- Transaction reverted
- Nonce collision

**Required Behavior:**

```json
{
  "warning": {
    "code": "W1504",
    "message": "Anchor transaction failed",
    "details": {
      "chain_type": "string",
      "error": "string",
      "proof_ids": ["string"],
      "retry_count": 0
    }
  }
}
```

**Recovery:**
- Retry with adjusted parameters
- Alert if repeated failures
- Consider alternate chain if available

---

## 3. System-Level Failures

### 3.1 Database Failures

#### F-SYS-DB-001: Primary Database Unavailable

**Required Behavior:**
1. All ENFORCE decisions: DENY
2. Alert operations immediately
3. Attempt failover to replica if configured
4. Log all denied requests for replay after recovery

**Fallback Options (in priority order):**
1. Automatic failover to replica
2. Read from cache (deny all writes)
3. Complete system halt

---

#### F-SYS-DB-002: Database Corruption Detected

**Required Behavior:**
1. Halt affected operations immediately
2. Do NOT attempt automatic repair
3. Alert security and operations
4. Begin incident response

---

### 3.2 Service Failures

#### F-SYS-SVC-001: Complete Service Failure

**Required Behavior:**
1. Return 503 Service Unavailable
2. Include Retry-After header
3. Log failure with timestamp
4. Trigger automatic restart/scaling

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 30
Content-Type: application/json

{
  "error_code": "E1902",
  "error_message": "Service temporarily unavailable",
  "retry_after": 30
}
```

---

#### F-SYS-SVC-002: Partial Service Degradation

**Required Behavior:**
1. Disable non-critical features
2. Continue core governance functions
3. Return degraded status in responses
4. Alert operations

```json
{
  "decision": "ALLOW",
  "service_status": "degraded",
  "degraded_features": ["chain_anchoring", "analytics"],
  "core_governance": "operational"
}
```

---

### 3.3 Network Failures

#### F-SYS-NET-001: External API Failure

**Symptoms:** Cannot reach external services (LLM, blockchain, etc.)

**Required Behavior:**
1. Use cached responses where safe
2. Degrade to local-only processing
3. Queue operations for retry
4. Continue core governance

---

### 3.4 Resource Exhaustion

#### F-SYS-RES-001: Memory Exhaustion

**Required Behavior:**
1. Reject new requests with 503
2. Allow in-flight requests to complete
3. Trigger garbage collection
4. Alert operations
5. Auto-scale if configured

---

#### F-SYS-RES-002: Disk Exhaustion

**Required Behavior:**
1. Stop proof generation (non-critical)
2. Continue ENFORCE operations
3. Alert operations CRITICAL
4. Reject new entity creation

---

## 4. Recovery Procedures

### 4.1 Standard Recovery Flow

```
┌─────────────────┐
│ Failure Detected │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Transient?      │──No─▶│ Alert Operations │
└────────┬────────┘      └─────────────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Retry with      │
│ backoff         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Retry succeeded?│──No─▶│ Escalate        │
└────────┬────────┘      └─────────────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Resume normal   │
│ operation       │
└─────────────────┘
```

### 4.2 Retry Configuration

```yaml
retry_config:
  default:
    max_attempts: 3
    initial_delay_ms: 100
    max_delay_ms: 5000
    backoff_multiplier: 2.0
    jitter: 0.1

  database:
    max_attempts: 5
    initial_delay_ms: 50
    max_delay_ms: 2000

  blockchain:
    max_attempts: 10
    initial_delay_ms: 1000
    max_delay_ms: 60000
```

### 4.3 Circuit Breaker Pattern

Implementations SHOULD implement circuit breakers for external dependencies:

```python
class CircuitBreaker:
    states = ["CLOSED", "OPEN", "HALF_OPEN"]

    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.state = "CLOSED"
        self.last_failure_time = None

    def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
            else:
                raise CircuitOpenError()

        try:
            result = func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise

    def on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
```

---

## 5. Monitoring and Alerting

### 5.1 Required Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `intent_parse_failure_rate` | % of intents failing to parse | > 5% |
| `enforce_decision_latency_p99` | 99th percentile decision time | > 500ms |
| `proof_generation_failure_rate` | % of proofs failing to generate | > 1% |
| `chain_anchor_backlog` | Proofs pending blockchain anchor | > 1000 |
| `trust_score_unavailable_rate` | % of requests with score unavailable | > 0.1% |
| `database_connection_errors` | DB connection failures per minute | > 5 |
| `circuit_breaker_open_count` | Number of open circuit breakers | > 0 |

### 5.2 Required Alerts

| Alert | Severity | Condition |
|-------|----------|-----------|
| ProofChainIntegrityFailure | CRITICAL | Any integrity failure detected |
| DatabaseUnavailable | CRITICAL | Primary DB unreachable > 30s |
| EnforceServiceDown | CRITICAL | ENFORCE returning 5xx > 1% |
| TrustScoreUnavailableSpike | HIGH | Score unavailable > 1% |
| ChainAnchorBacklogGrowing | MEDIUM | Backlog increasing for > 1 hour |
| HighDenyRate | MEDIUM | DENY decisions > 50% of requests |
| EscalationQueueBacklog | MEDIUM | Pending escalations > 100 |

---

## 6. Failure Testing

### 6.1 Required Chaos Tests

Implementations SHOULD regularly test:

| Test | Description | Frequency |
|------|-------------|-----------|
| Database failover | Kill primary, verify failover | Monthly |
| Intent layer timeout | Inject latency, verify timeout | Weekly |
| Proof storage failure | Disable storage, verify buffering | Weekly |
| Full service restart | Restart under load, verify recovery | Monthly |
| Network partition | Simulate network split | Monthly |

### 6.2 Game Day Scenarios

Run quarterly game days testing:
1. Complete INTENT layer failure
2. Database corruption detection
3. Proof chain integrity failure
4. Mass escalation (approval target failure)
5. Multi-component cascading failure

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
