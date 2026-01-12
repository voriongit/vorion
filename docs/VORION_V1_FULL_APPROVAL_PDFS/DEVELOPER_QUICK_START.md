# Vorion Developer Quick Start

**Get up and running in 15 minutes**

---

## TL;DR

```bash
# Install
pip install vorion

# Configure
export VORION_API_KEY="your-api-key"

# Run
python -c "
from vorion import VorionClient
client = VorionClient()
result = client.intents.submit(goal='Hello Vorion', context={})
print(result.status)
"
```

---

## Table of Contents

1. [Get Your API Key](#1-get-your-api-key) (2 min)
2. [Install the SDK](#2-install-the-sdk) (1 min)
3. [Hello World](#3-hello-world) (2 min)
4. [Submit Your First Intent](#4-submit-your-first-intent) (3 min)
5. [Handle Constraints](#5-handle-constraints) (3 min)
6. [Read Proof Artifacts](#6-read-proof-artifacts) (2 min)
7. [Check Trust Scores](#7-check-trust-scores) (2 min)
8. [Next Steps](#8-next-steps)

---

## 1. Get Your API Key

### Option A: Sandbox (Recommended for Testing)

```
1. Go to https://sandbox.vorion.io/signup
2. Create account with email
3. Verify email
4. Navigate to Settings → API Keys
5. Click "Create Key"
6. Copy your key (starts with "vsk_sandbox_")
```

### Option B: Production

```
1. Go to https://app.vorion.io
2. Login or create account
3. Navigate to Settings → API Keys
4. Click "Create Key"
5. Select scopes (start with "intents:write")
6. Copy your key (starts with "vsk_")
```

### Set Environment Variable

```bash
# Linux/Mac
export VORION_API_KEY="vsk_sandbox_your_key_here"

# Windows (PowerShell)
$env:VORION_API_KEY="vsk_sandbox_your_key_here"

# Windows (CMD)
set VORION_API_KEY=vsk_sandbox_your_key_here
```

---

## 2. Install the SDK

### Python (Recommended)

```bash
pip install vorion
```

### JavaScript/TypeScript

```bash
npm install @vorion/sdk
# or
yarn add @vorion/sdk
```

### Java

```xml
<!-- Maven -->
<dependency>
    <groupId>io.vorion</groupId>
    <artifactId>sdk</artifactId>
    <version>2.0.0</version>
</dependency>
```

```groovy
// Gradle
implementation 'io.vorion:sdk:2.0.0'
```

### Go

```bash
go get github.com/vorion/go-sdk
```

### C#/.NET

```bash
dotnet add package Vorion.SDK
```

### Verify Installation

```bash
# Python
python -c "import vorion; print(vorion.__version__)"

# Node
node -e "console.log(require('@vorion/sdk').version)"
```

---

## 3. Hello World

### Python

```python
from vorion import VorionClient

# Client auto-reads VORION_API_KEY from environment
client = VorionClient()

# Check connection
health = client.health()
print(f"Connected to Vorion {health.version}")
print(f"Environment: {health.environment}")
```

### JavaScript/TypeScript

```typescript
import { VorionClient } from '@vorion/sdk';

const client = new VorionClient();

const health = await client.health();
console.log(`Connected to Vorion ${health.version}`);
console.log(`Environment: ${health.environment}`);
```

### Expected Output

```
Connected to Vorion 1.0.0
Environment: sandbox
```

---

## 4. Submit Your First Intent

An **Intent** is what you want the AI to do. Vorion validates it against constraints before execution.

### Python

```python
from vorion import VorionClient, Intent

client = VorionClient()

# Create an intent
intent = Intent(
    goal="Send welcome email to new user",
    context={
        "user_id": "user_123",
        "user_email": "alice@example.com",
        "user_name": "Alice"
    }
)

# Submit it
result = client.intents.submit(intent)

# Check result
print(f"Intent ID: {result.intent_id}")
print(f"Status: {result.status}")
print(f"Proof ID: {result.proof_id}")
```

### JavaScript/TypeScript

```typescript
import { VorionClient } from '@vorion/sdk';

const client = new VorionClient();

const result = await client.intents.submit({
  goal: 'Send welcome email to new user',
  context: {
    userId: 'user_123',
    userEmail: 'alice@example.com',
    userName: 'Alice'
  }
});

console.log(`Intent ID: ${result.intentId}`);
console.log(`Status: ${result.status}`);
console.log(`Proof ID: ${result.proofId}`);
```

### Java

```java
import io.vorion.sdk.*;

VorionClient client = VorionClient.create();

IntentResult result = client.intents().submit(
    Intent.builder()
        .goal("Send welcome email to new user")
        .context(Map.of(
            "user_id", "user_123",
            "user_email", "alice@example.com",
            "user_name", "Alice"
        ))
        .build()
);

System.out.println("Intent ID: " + result.getIntentId());
System.out.println("Status: " + result.getStatus());
```

### Go

```go
package main

import (
    "fmt"
    "github.com/vorion/go-sdk/vorion"
)

func main() {
    client := vorion.NewClient()

    result, err := client.Intents.Submit(&vorion.Intent{
        Goal: "Send welcome email to new user",
        Context: map[string]interface{}{
            "user_id":    "user_123",
            "user_email": "alice@example.com",
            "user_name":  "Alice",
        },
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Intent ID: %s\n", result.IntentID)
    fmt.Printf("Status: %s\n", result.Status)
}
```

### Expected Output

```
Intent ID: int_abc123def456
Status: COMPLETED
Proof ID: prf_789xyz
```

---

## 5. Handle Constraints

Constraints are rules that control what actions are allowed. When violated, you get a `ConstraintViolationError`.

### Python

```python
from vorion import VorionClient, Intent, ConstraintViolationError

client = VorionClient()

intent = Intent(
    goal="Process refund",
    context={
        "order_id": "ord_456",
        "amount": 50000,  # Large amount - may trigger constraint
        "reason": "Customer request"
    }
)

try:
    result = client.intents.submit(intent)
    print(f"Success! Refund processed: {result.intent_id}")

except ConstraintViolationError as e:
    print(f"Blocked by constraint: {e.constraint_name}")
    print(f"Reason: {e.message}")
    print(f"Suggestion: {e.suggestion}")

    # Access violation details
    print(f"Field: {e.details.get('violated_field')}")
    print(f"Value: {e.details.get('provided_value')}")
    print(f"Limit: {e.details.get('max_allowed')}")
```

### JavaScript/TypeScript

```typescript
import { VorionClient, ConstraintViolationError } from '@vorion/sdk';

const client = new VorionClient();

try {
  const result = await client.intents.submit({
    goal: 'Process refund',
    context: {
      orderId: 'ord_456',
      amount: 50000,
      reason: 'Customer request'
    }
  });
  console.log(`Success! Refund processed: ${result.intentId}`);

} catch (error) {
  if (error instanceof ConstraintViolationError) {
    console.log(`Blocked by: ${error.constraintName}`);
    console.log(`Reason: ${error.message}`);
    console.log(`Suggestion: ${error.suggestion}`);
  } else {
    throw error;
  }
}
```

### Pre-Validate Before Submitting

Check if an intent would be allowed without actually executing it:

```python
from vorion import VorionClient, Intent

client = VorionClient()

intent = Intent(
    goal="Delete all user data",
    context={"user_id": "user_123"}
)

# Validate without executing
validation = client.constraints.validate(intent)

if validation.is_valid:
    print("Intent is allowed, submitting...")
    result = client.intents.submit(intent)
else:
    print("Intent would be blocked:")
    for v in validation.violations:
        print(f"  - {v.constraint_name}: {v.message}")
```

### Common Constraint Types

| Constraint | Triggers When |
|------------|---------------|
| `max_amount` | Transaction exceeds limit |
| `trust_required` | User trust level too low |
| `time_restriction` | Outside allowed hours |
| `data_classification` | Accessing sensitive data |
| `rate_limit` | Too many requests |
| `approval_required` | Action needs human approval |

---

## 6. Read Proof Artifacts

Every execution creates an immutable **Proof** record. Use it for auditing and debugging.

### Python

```python
from vorion import VorionClient

client = VorionClient()

# Get proof by ID (from intent result)
proof = client.proofs.get("prf_789xyz")

print(f"Proof ID: {proof.proof_id}")
print(f"Intent ID: {proof.intent_id}")
print(f"Created: {proof.created_at}")
print(f"Status: {proof.status}")

# Execution details
print(f"Duration: {proof.execution.duration_ms}ms")
print(f"Constraints checked: {proof.execution.constraints_evaluated}")

# What was recorded
print(f"Inputs: {proof.inputs}")
print(f"Outputs: {proof.outputs}")

# Verify integrity
verification = client.proofs.verify(proof.proof_id)
print(f"Integrity valid: {verification.is_valid}")
print(f"Chain position: {verification.chain_position}")
```

### JavaScript/TypeScript

```typescript
import { VorionClient } from '@vorion/sdk';

const client = new VorionClient();

const proof = await client.proofs.get('prf_789xyz');

console.log(`Proof ID: ${proof.proofId}`);
console.log(`Created: ${proof.createdAt}`);
console.log(`Duration: ${proof.execution.durationMs}ms`);

// Verify integrity
const verification = await client.proofs.verify(proof.proofId);
console.log(`Valid: ${verification.isValid}`);
```

### List Proofs for an Entity

```python
# Get recent proofs for a user
proofs = client.proofs.list(
    entity_id="user_123",
    limit=10,
    start_date="2026-01-01"
)

for proof in proofs:
    print(f"{proof.created_at}: {proof.intent_goal} - {proof.status}")
```

---

## 7. Check Trust Scores

Trust scores determine what actions an entity can perform autonomously.

### Python

```python
from vorion import VorionClient

client = VorionClient()

# Get trust score for an entity
trust = client.trust.get("user_123")

print(f"Entity: {trust.entity_id}")
print(f"Score: {trust.score}/1000")
print(f"Level: L{trust.level} ({trust.level_name})")

# Score breakdown
print(f"Behavioral: {trust.components.behavioral}")
print(f"Compliance: {trust.components.compliance}")
print(f"Identity: {trust.components.identity}")
print(f"Context: {trust.components.context}")

# What can they do?
print(f"Capabilities: {trust.capabilities}")
```

### JavaScript/TypeScript

```typescript
import { VorionClient } from '@vorion/sdk';

const client = new VorionClient();

const trust = await client.trust.get('user_123');

console.log(`Score: ${trust.score}/1000`);
console.log(`Level: L${trust.level} (${trust.levelName})`);
console.log(`Capabilities: ${trust.capabilities.join(', ')}`);
```

### Trust Levels Reference

| Level | Score | Name | Typical Capabilities |
|-------|-------|------|---------------------|
| L0 | 0-199 | Untrusted | Read-only |
| L1 | 200-399 | Provisional | Limited write |
| L2 | 400-599 | Trusted | Standard operations |
| L3 | 600-799 | Verified | Extended operations |
| L4 | 800-1000 | Privileged | Full access |

---

## 8. Next Steps

### Learn More

| Resource | URL | Description |
|----------|-----|-------------|
| Full API Docs | https://docs.vorion.io/api | Complete API reference |
| SDK Reference | https://docs.vorion.io/sdks | Language-specific guides |
| BASIS Rules | https://docs.vorion.io/basis | Rule authoring guide |
| Examples | https://github.com/vorion/examples | Sample projects |
| Tutorials | https://docs.vorion.io/tutorials | Step-by-step guides |

### Common Patterns

#### Async Execution

```python
# For long-running intents
result = client.intents.submit(intent, async_mode=True)

# Poll for completion
while result.status == "PROCESSING":
    time.sleep(1)
    result = client.intents.get(result.intent_id)

print(f"Final status: {result.status}")
```

#### Webhooks

```python
# Register webhook for intent completion
client.webhooks.create(
    url="https://your-app.com/webhook",
    events=["intent.completed", "intent.failed", "constraint.violated"]
)
```

#### Custom Context

```python
# Add metadata that flows through to PROOF
intent = Intent(
    goal="Process order",
    context={
        "order_id": "ord_123",
        "items": [{"sku": "ABC", "qty": 2}]
    },
    metadata={
        "correlation_id": "req_xyz",
        "source": "web_checkout",
        "session_id": "sess_456"
    }
)
```

#### Batch Operations

```python
# Submit multiple intents
intents = [
    Intent(goal="Task 1", context={"id": 1}),
    Intent(goal="Task 2", context={"id": 2}),
    Intent(goal="Task 3", context={"id": 3}),
]

results = client.intents.submit_batch(intents)

for result in results:
    print(f"{result.intent_id}: {result.status}")
```

### Get Help

| Channel | Use For |
|---------|---------|
| https://docs.vorion.io | Documentation |
| https://github.com/vorion/sdk-python/issues | Bug reports |
| https://community.vorion.io | Community Q&A |
| support@vorion.io | Technical support |
| https://status.vorion.io | Service status |

---

## Quick Reference Card

### Installation

```bash
pip install vorion              # Python
npm install @vorion/sdk         # JavaScript
go get github.com/vorion/go-sdk # Go
```

### Environment Variables

```bash
VORION_API_KEY=vsk_...         # Required
VORION_ENVIRONMENT=sandbox     # sandbox|staging|production
VORION_TIMEOUT=30000           # Request timeout (ms)
VORION_LOG_LEVEL=INFO          # DEBUG|INFO|WARN|ERROR
```

### Core Operations

```python
from vorion import VorionClient, Intent

client = VorionClient()

# Health check
client.health()

# Submit intent
result = client.intents.submit(Intent(goal="...", context={}))

# Get intent status
client.intents.get("int_...")

# Validate without executing
client.constraints.validate(intent)

# Get proof
client.proofs.get("prf_...")

# Verify proof integrity
client.proofs.verify("prf_...")

# Get trust score
client.trust.get("entity_id")
```

### Response Statuses

| Status | Meaning |
|--------|---------|
| `ACCEPTED` | Intent received, processing |
| `PROCESSING` | Execution in progress |
| `COMPLETED` | Successfully finished |
| `FAILED` | Execution failed |
| `DENIED` | Blocked by constraint |
| `TIMEOUT` | Execution timed out |

### Error Types

| Error | Meaning |
|-------|---------|
| `ConstraintViolationError` | Blocked by BASIS rule |
| `AuthenticationError` | Invalid API key |
| `AuthorizationError` | Insufficient permissions |
| `RateLimitError` | Too many requests |
| `ValidationError` | Invalid request format |
| `NotFoundError` | Resource doesn't exist |
| `VorionError` | General platform error |

---

## Troubleshooting

### "Authentication failed"

```python
# Check your API key is set
import os
print(os.environ.get('VORION_API_KEY', 'NOT SET'))

# Or pass explicitly
client = VorionClient(api_key="vsk_...")
```

### "Constraint violation" on simple requests

```python
# Check your trust level
trust = client.trust.get_self()
print(f"Your trust level: L{trust.level}")

# New accounts start at L0 with limited capabilities
```

### "Connection timeout"

```python
# Increase timeout
client = VorionClient(timeout=60000)  # 60 seconds

# Or check status page
# https://status.vorion.io
```

### "Rate limit exceeded"

```python
from vorion import RateLimitError
import time

try:
    result = client.intents.submit(intent)
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after}s")
    time.sleep(e.retry_after)
    result = client.intents.submit(intent)
```

### Enable Debug Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Or via environment
# VORION_LOG_LEVEL=DEBUG
```

---

**You're ready to build with Vorion!**

Questions? support@vorion.io | Docs: https://docs.vorion.io

---

*Version 1.0.0 | Last Updated: 2026-01-08*
