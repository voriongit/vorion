# Vorion Partner Onboarding Guide

**Welcome to the Vorion Partner Ecosystem**

Version 1.0 | 2026-01-08

---

## Table of Contents

1. [Welcome](#1-welcome)
2. [Partner Program Overview](#2-partner-program-overview)
3. [Getting Started Checklist](#3-getting-started-checklist)
4. [Technical Onboarding](#4-technical-onboarding)
5. [SDK Integration Guide](#5-sdk-integration-guide)
6. [API Quick Reference](#6-api-quick-reference)
7. [BASIS Rules Primer](#7-basis-rules-primer)
8. [Certification Path](#8-certification-path)
9. [Go-to-Market Resources](#9-go-to-market-resources)
10. [Support & Escalation](#10-support--escalation)
11. [Commercial Terms](#11-commercial-terms)
12. [Appendices](#appendices)

---

## 1. Welcome

### Welcome to the Vorion Partner Ecosystem

Thank you for joining Vorion as a partner. This guide will help you successfully integrate with our platform, achieve certification, and build solutions for your customers.

### What is Vorion?

Vorion is a **governed AI execution platform** that enables enterprises to deploy AI capabilities with built-in governance, compliance, and auditability.

```
┌─────────────────────────────────────────────────────────────┐
│                    THE VORION PROMISE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   For Your Customers:                                       │
│   • AI they can trust and audit                            │
│   • Compliance out of the box                              │
│   • Human oversight guaranteed                             │
│                                                             │
│   For You as a Partner:                                     │
│   • Differentiated solutions                               │
│   • Recurring revenue opportunities                        │
│   • Technical and sales support                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Your Partner Success Team

| Role | Responsibility | Contact |
|------|----------------|---------|
| Partner Manager | Business relationship | partners@vorion.io |
| Solutions Architect | Technical guidance | solutions@vorion.io |
| Partner Support | Technical issues | partner-support@vorion.io |
| Enablement Lead | Training & certification | enablement@vorion.io |

---

## 2. Partner Program Overview

### Partner Tiers

```
┌─────────────────────────────────────────────────────────────┐
│                    PARTNER TIERS                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STRATEGIC        ████████████████████████  Full benefits   │
│  Joint development, roadmap input, highest margins          │
│                                                             │
│  PREMIER          ████████████████████      Enhanced        │
│  Revenue share, early access, dedicated support             │
│                                                             │
│  CERTIFIED        ████████████████          Standard        │
│  Co-marketing, certified badge, priority support            │
│                                                             │
│  REGISTERED       ████████████              Basic           │
│  SDK access, partner portal, community support              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tier Requirements & Benefits

| Benefit | Registered | Certified | Premier | Strategic |
|---------|------------|-----------|---------|-----------|
| SDK Access | ✓ | ✓ | ✓ | ✓ |
| Partner Portal | ✓ | ✓ | ✓ | ✓ |
| API Documentation | ✓ | ✓ | ✓ | ✓ |
| Community Support | ✓ | ✓ | ✓ | ✓ |
| Partner Badge | — | ✓ | ✓ | ✓ |
| Co-Marketing | — | ✓ | ✓ | ✓ |
| Priority Support | — | ✓ | ✓ | ✓ |
| Early Access | — | — | ✓ | ✓ |
| Revenue Share | — | — | ✓ | ✓ |
| Dedicated SA | — | — | ✓ | ✓ |
| Roadmap Input | — | — | — | ✓ |
| Joint Development | — | — | — | ✓ |

| Requirement | Registered | Certified | Premier | Strategic |
|-------------|------------|-----------|---------|-----------|
| Agreement Signed | ✓ | ✓ | ✓ | ✓ |
| Technical Certification | — | ✓ | ✓ | ✓ |
| Sales Certification | — | ✓ | ✓ | ✓ |
| Reference Customer | — | — | ✓ | ✓ |
| Revenue Commitment | — | — | ✓ | ✓ |
| Joint Business Plan | — | — | — | ✓ |

### Partner Types

| Type | Description | Example Activities |
|------|-------------|-------------------|
| **Technology Partner** | Build integrations & connectors | CRM connector, ERP integration |
| **Solution Partner** | Build vertical solutions | Healthcare compliance suite |
| **Services Partner** | Implementation & consulting | Customer deployments |
| **Reseller** | Sell Vorion licenses | License distribution |

---

## 3. Getting Started Checklist

### Week 1: Foundation

| # | Task | Owner | Resources |
|---|------|-------|-----------|
| ☐ | Sign Partner Agreement | Partner | Legal package |
| ☐ | Complete partner registration | Partner | Registration form |
| ☐ | Access Partner Portal | Partner | Portal invite |
| ☐ | Join Partner Slack channel | Partner | Slack invite |
| ☐ | Schedule kickoff call | Partner Manager | Calendar link |
| ☐ | Review this onboarding guide | Partner | This document |

### Week 2: Technical Setup

| # | Task | Owner | Resources |
|---|------|-------|-----------|
| ☐ | Create sandbox account | Partner | Sandbox signup |
| ☐ | Install SDK (preferred language) | Partner | SDK docs |
| ☐ | Run "Hello World" integration | Partner | Quick start guide |
| ☐ | Review API documentation | Partner | API reference |
| ☐ | Explore BASIS rule examples | Partner | Rule library |
| ☐ | Complete technical orientation | Partner | Video course |

### Week 3: Certification Preparation

| # | Task | Owner | Resources |
|---|------|-------|-----------|
| ☐ | Complete technical training | Partner | Learning path |
| ☐ | Complete sales training | Partner | Sales enablement |
| ☐ | Build sample integration | Partner | Sample projects |
| ☐ | Review certification requirements | Partner | Cert guide |
| ☐ | Schedule certification exam | Partner | Cert portal |

### Week 4: Go Live

| # | Task | Owner | Resources |
|---|------|-------|-----------|
| ☐ | Pass certification exam | Partner | Cert portal |
| ☐ | Receive partner badge | Vorion | Digital assets |
| ☐ | List in Partner Directory | Vorion | Directory submission |
| ☐ | Plan first customer project | Partner + SA | Project template |
| ☐ | Schedule quarterly business review | Partner Manager | QBR template |

---

## 4. Technical Onboarding

### Environment Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VORION ENVIRONMENTS                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  SANDBOX    │  │  STAGING    │  │ PRODUCTION  │         │
│  │             │  │             │  │             │         │
│  │ Development │  │  Testing    │  │    Live     │         │
│  │ Free tier   │  │  Full APIs  │  │  Full SLA   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│        │                │                │                  │
│        ▼                ▼                ▼                  │
│   sandbox.          staging.          api.                  │
│   vorion.io         vorion.io        vorion.io             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Sandbox Account Setup

**Step 1: Create Account**
```
1. Navigate to: https://partners.vorion.io/sandbox
2. Enter your partner email
3. Verify email address
4. Set password (min 12 chars, complexity required)
5. Enable MFA (required for all partner accounts)
```

**Step 2: Generate API Credentials**
```
1. Login to Partner Portal
2. Navigate to: Settings → API Keys
3. Click "Generate New Key"
4. Select scopes: [sandbox:full]
5. Copy and securely store:
   - Client ID
   - Client Secret
   - API Key
```

**Step 3: Verify Connectivity**
```bash
# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://sandbox.vorion.io/v1/health

# Expected response:
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "sandbox"
}
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                YOUR APPLICATION                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  VORION SDK                          │   │
│  │  • Authentication    • Request building              │   │
│  │  • Constraint cache  • Error handling                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ HTTPS / TLS 1.3
┌─────────────────────────────────────────────────────────────┐
│                    VORION PLATFORM                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   INTENT ──▶ ENFORCE ──▶ COGNIGATE ──▶ PROOF               │
│                                                             │
│   Parse      Validate    Execute       Record               │
│   goal       against     within        immutable            │
│              BASIS       constraints   evidence             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. SDK Integration Guide

### Supported Languages

| Language | Package | Min Version | Status |
|----------|---------|-------------|--------|
| Python | `vorion` | 3.9+ | GA |
| JavaScript/TypeScript | `@vorion/sdk` | Node 18+ | GA |
| Java | `io.vorion:sdk` | Java 11+ | GA |
| Go | `github.com/vorion/go-sdk` | 1.20+ | GA |
| C#/.NET | `Vorion.SDK` | .NET 6+ | GA |
| Rust | `vorion` | 1.70+ | Beta |

### Installation

**Python**
```bash
pip install vorion
```

**JavaScript/TypeScript**
```bash
npm install @vorion/sdk
# or
yarn add @vorion/sdk
```

**Java (Maven)**
```xml
<dependency>
    <groupId>io.vorion</groupId>
    <artifactId>sdk</artifactId>
    <version>2.0.0</version>
</dependency>
```

**Go**
```bash
go get github.com/vorion/go-sdk
```

**C#/.NET**
```bash
dotnet add package Vorion.SDK
```

### Quick Start Examples

**Python**
```python
from vorion import VorionClient, Intent

# Initialize client
client = VorionClient(
    api_key="your-api-key",
    environment="sandbox"  # or "production"
)

# Create and submit an intent
intent = Intent(
    goal="Process customer refund",
    context={
        "customer_id": "cust_123",
        "order_id": "ord_456",
        "amount": 99.99,
        "reason": "Product defective"
    }
)

# Submit intent (automatically enforces constraints)
try:
    result = client.intents.submit(intent)
    print(f"Intent ID: {result.intent_id}")
    print(f"Status: {result.status}")
    print(f"Proof ID: {result.proof_id}")
except ConstraintViolationError as e:
    print(f"Blocked by constraint: {e.constraint_name}")
    print(f"Reason: {e.message}")
```

**JavaScript/TypeScript**
```typescript
import { VorionClient, Intent } from '@vorion/sdk';

// Initialize client
const client = new VorionClient({
  apiKey: 'your-api-key',
  environment: 'sandbox'
});

// Create and submit an intent
const intent: Intent = {
  goal: 'Process customer refund',
  context: {
    customerId: 'cust_123',
    orderId: 'ord_456',
    amount: 99.99,
    reason: 'Product defective'
  }
};

try {
  const result = await client.intents.submit(intent);
  console.log(`Intent ID: ${result.intentId}`);
  console.log(`Status: ${result.status}`);
  console.log(`Proof ID: ${result.proofId}`);
} catch (error) {
  if (error instanceof ConstraintViolationError) {
    console.log(`Blocked: ${error.constraintName}`);
  }
}
```

**Java**
```java
import io.vorion.sdk.VorionClient;
import io.vorion.sdk.Intent;
import io.vorion.sdk.IntentResult;

// Initialize client
VorionClient client = VorionClient.builder()
    .apiKey("your-api-key")
    .environment("sandbox")
    .build();

// Create intent
Intent intent = Intent.builder()
    .goal("Process customer refund")
    .context(Map.of(
        "customer_id", "cust_123",
        "order_id", "ord_456",
        "amount", 99.99
    ))
    .build();

// Submit intent
try {
    IntentResult result = client.intents().submit(intent);
    System.out.println("Intent ID: " + result.getIntentId());
    System.out.println("Proof ID: " + result.getProofId());
} catch (ConstraintViolationException e) {
    System.out.println("Blocked: " + e.getConstraintName());
}
```

### SDK Configuration Options

```yaml
# Full SDK configuration reference
vorion_config:
  # Required
  api_key: "your-api-key"

  # Environment (default: production)
  environment: sandbox | staging | production

  # Connection settings
  connection:
    base_url: "https://api.vorion.io"  # Override for on-prem
    timeout_ms: 30000                   # Request timeout
    max_retries: 3                      # Retry attempts
    retry_backoff_ms: 1000              # Initial backoff

  # Governance settings
  governance:
    validate_locally: true      # Pre-validate before sending
    cache_constraints: true     # Cache BASIS rules locally
    cache_ttl_seconds: 300      # Constraint cache TTL
    fail_closed: true           # Fail if constraints unavailable

  # Observability
  logging:
    level: INFO | DEBUG | WARN | ERROR
    format: JSON | TEXT

  metrics:
    enabled: true
    exporter: prometheus | otlp | datadog

  tracing:
    enabled: true
    sample_rate: 0.1  # 10% sampling
```

---

## 6. API Quick Reference

### Base URLs

| Environment | URL |
|-------------|-----|
| Sandbox | `https://sandbox.vorion.io/v1` |
| Staging | `https://staging.vorion.io/v1` |
| Production | `https://api.vorion.io/v1` |

### Authentication

**API Key (Header)**
```
Authorization: Bearer {api_key}
```

**OAuth 2.0 (Client Credentials)**
```bash
# Get access token
curl -X POST https://auth.vorion.io/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id={client_id}" \
  -d "client_secret={client_secret}" \
  -d "scope=vorion:read vorion:write"
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/intents` | Submit new intent |
| `GET` | `/intents/{id}` | Get intent status |
| `GET` | `/intents/{id}/proof` | Get execution proof |
| `POST` | `/constraints/validate` | Validate without executing |
| `GET` | `/trust/{entity_id}` | Get trust score |
| `GET` | `/health` | Health check |

### Intent Submission

**Request**
```http
POST /v1/intents
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "goal": "Process customer refund",
  "context": {
    "customer_id": "cust_123",
    "order_id": "ord_456",
    "amount": 99.99
  },
  "options": {
    "async": false,
    "timeout_ms": 30000
  }
}
```

**Response (Success)**
```json
{
  "intent_id": "int_abc123",
  "status": "COMPLETED",
  "proof_id": "prf_def456",
  "result": {
    "success": true,
    "refund_id": "ref_789",
    "processed_at": "2026-01-08T14:30:00Z"
  },
  "trust_score_used": 542,
  "constraints_evaluated": 12,
  "execution_time_ms": 234
}
```

**Response (Constraint Violation)**
```json
{
  "error": {
    "code": "CONSTRAINT_VIOLATION",
    "message": "Intent violates constraint: max_refund_amount",
    "details": {
      "constraint_id": "c_max_refund",
      "constraint_name": "Maximum Refund Amount",
      "violated_field": "amount",
      "provided_value": 99.99,
      "max_allowed": 50.00,
      "suggestion": "Request manager approval for amounts over $50"
    },
    "request_id": "req_xyz789",
    "documentation_url": "https://docs.vorion.io/errors/CONSTRAINT_VIOLATION"
  }
}
```

### Common Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| `200` | Success | Process response |
| `202` | Accepted (async) | Poll for result |
| `400` | Bad request | Fix request format |
| `401` | Unauthorized | Check API key |
| `403` | Forbidden / Constraint violation | Check constraints |
| `404` | Not found | Check resource ID |
| `429` | Rate limited | Back off and retry |
| `500` | Server error | Retry with backoff |
| `503` | Unavailable | Retry later |

---

## 7. BASIS Rules Primer

### What is BASIS?

BASIS (Business And Security Intent Specification) is Vorion's open-standard rule language that defines what actions are allowed or denied.

```
┌─────────────────────────────────────────────────────────────┐
│                    BASIS RULE STRUCTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   RULE = WHEN (conditions) THEN (action)                    │
│                                                             │
│   Example:                                                  │
│   WHEN amount > 10000 AND user.trust_level < 3              │
│   THEN DENY with "High-value transactions require L3 trust" │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Rule Examples

**Example 1: Amount Limit**
```yaml
rule:
  name: "max_transaction_amount"
  description: "Limit transaction amounts based on trust level"

  when:
    - field: "context.amount"
      operator: "gt"
      value: 10000
    - field: "trust.level"
      operator: "lt"
      value: 3

  then:
    action: "DENY"
    message: "Transactions over $10,000 require trust level 3+"
    suggestion: "Request approval from a manager"
```

**Example 2: Time-based Restriction**
```yaml
rule:
  name: "business_hours_only"
  description: "Restrict certain operations to business hours"

  when:
    - field: "context.operation_type"
      operator: "in"
      value: ["delete", "bulk_update", "export"]
    - field: "time.hour"
      operator: "not_between"
      value: [9, 17]

  then:
    action: "DENY"
    message: "This operation is only allowed during business hours (9 AM - 5 PM)"
```

**Example 3: Data Sensitivity**
```yaml
rule:
  name: "pii_access_control"
  description: "Control access to PII data"

  when:
    - field: "data.classification"
      operator: "eq"
      value: "PII"
    - field: "user.role"
      operator: "not_in"
      value: ["admin", "compliance", "support_l3"]

  then:
    action: "DENY"
    message: "PII access requires appropriate role"
    audit: true
```

### Pre-Validating Against Rules

```python
from vorion import VorionClient, Intent

client = VorionClient(api_key="your-key")

# Create intent
intent = Intent(
    goal="Export customer data",
    context={"customer_id": "cust_123", "format": "csv"}
)

# Validate without executing
validation = client.constraints.validate(intent)

if validation.is_valid:
    print("Intent would be allowed")
    result = client.intents.submit(intent)
else:
    print("Intent would be blocked:")
    for violation in validation.violations:
        print(f"  - {violation.rule_name}: {violation.message}")
```

---

## 8. Certification Path

### Certification Tracks

```
┌─────────────────────────────────────────────────────────────┐
│                  CERTIFICATION TRACKS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TECHNICAL TRACK              SALES TRACK                   │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Vorion Developer│         │ Vorion Sales    │           │
│  │ Fundamentals    │         │ Fundamentals    │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Vorion Solution │         │ Vorion Solution │           │
│  │ Architect       │         │ Consultant      │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Vorion Expert   │         │ Vorion Expert   │           │
│  │ (Technical)     │         │ (Business)      │           │
│  └─────────────────┘         └─────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Certification Requirements

#### Vorion Developer Fundamentals

| Requirement | Details |
|-------------|---------|
| **Training** | 4-hour online course |
| **Hands-on** | 3 lab exercises |
| **Exam** | 50 questions, 70% to pass |
| **Validity** | 2 years |

**Topics Covered:**
- Platform architecture
- SDK installation and configuration
- Intent creation and submission
- Error handling
- Basic BASIS rules
- PROOF artifact reading

#### Vorion Solution Architect

| Requirement | Details |
|-------------|---------|
| **Prerequisite** | Developer Fundamentals |
| **Training** | 8-hour online course |
| **Hands-on** | Design project |
| **Exam** | 75 questions, 75% to pass |
| **Validity** | 2 years |

**Topics Covered:**
- Advanced architecture patterns
- Custom BASIS rule authoring
- Trust model configuration
- Security best practices
- Performance optimization
- Integration patterns

#### Vorion Sales Fundamentals

| Requirement | Details |
|-------------|---------|
| **Training** | 2-hour online course |
| **Exam** | 30 questions, 80% to pass |
| **Validity** | 1 year |

**Topics Covered:**
- Value proposition
- Competitive positioning
- Customer use cases
- Pricing and packaging
- Objection handling
- Demo delivery

### Certification Process

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Enroll  │───▶│  Study  │───▶│  Exam   │───▶│ Certify │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
  Partner       Complete       Schedule      Receive
  Portal        training       & pass        badge
                + labs         exam          + listing
```

### Certification Exam Details

| Aspect | Details |
|--------|---------|
| Format | Online, proctored |
| Duration | 90 minutes |
| Questions | Multiple choice + scenario-based |
| Retake Policy | 14-day wait, 3 attempts per year |
| Cost | Included with partner tier |

---

## 9. Go-to-Market Resources

### Marketing Assets

| Asset | Location | Usage |
|-------|----------|-------|
| Partner Logo Kit | Partner Portal → Assets | Co-branded materials |
| Product Screenshots | Partner Portal → Assets | Presentations |
| Solution Brief Templates | Partner Portal → Assets | Customer handouts |
| Case Study Templates | Partner Portal → Assets | Customer stories |
| Demo Environment | sandbox.vorion.io | Customer demos |

### Partner Badge Usage

```
┌─────────────────────────────────────────────────────────────┐
│                    BADGE GUIDELINES                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CERTIFIED PARTNER                PREMIER PARTNER           │
│  ┌─────────────────┐             ┌─────────────────┐       │
│  │    [VORION]     │             │    [VORION]     │       │
│  │   CERTIFIED     │             │    PREMIER      │       │
│  │    PARTNER      │             │    PARTNER      │       │
│  └─────────────────┘             └─────────────────┘       │
│                                                             │
│  Usage:                                                     │
│  ✓ Website partner page          ✓ All Certified uses      │
│  ✓ Email signatures              ✓ Joint press releases    │
│  ✓ Proposals/RFPs                ✓ Event materials         │
│  ✗ Primary logo (use your own)   ✓ Customer references     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Co-Marketing Opportunities

| Opportunity | Tier Required | Process |
|-------------|---------------|---------|
| Blog Guest Post | Certified+ | Submit draft → Review → Publish |
| Joint Webinar | Certified+ | Proposal → Planning → Execution |
| Case Study | Premier+ | Customer approval → Interview → Publish |
| Event Sponsorship | Premier+ | Request → Approval → Logistics |
| Press Release | Strategic | Draft → Legal review → Distribution |

### Sales Tools

| Tool | Description | Access |
|------|-------------|--------|
| ROI Calculator | Customer value modeling | Partner Portal |
| Competitive Battle Cards | Positioning vs competitors | Partner Portal |
| Discovery Questions | Customer qualification | Partner Portal |
| Demo Script | Guided demo walkthrough | Partner Portal |
| Proposal Template | Standard proposal format | Partner Portal |

---

## 10. Support & Escalation

### Support Channels

| Channel | Use Case | Response Time |
|---------|----------|---------------|
| Partner Portal | Tickets, documentation | 4 business hours |
| partner-support@vorion.io | Technical issues | 4 business hours |
| Partner Slack | Quick questions | Best effort |
| Emergency Hotline | Production down | 30 minutes |

### Support Tiers by Partner Level

| Support Aspect | Registered | Certified | Premier | Strategic |
|----------------|------------|-----------|---------|-----------|
| Portal Access | ✓ | ✓ | ✓ | ✓ |
| Email Support | Business hours | Business hours | 24/5 | 24/7 |
| Response SLA | 8 hours | 4 hours | 2 hours | 1 hour |
| Phone Support | — | Business hours | 24/5 | 24/7 |
| Dedicated SA | — | — | Named SA | Dedicated team |
| Escalation Path | Standard | Priority | Direct | Executive |

### Escalation Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                  ESCALATION PATH                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 1: Partner Support                                   │
│  └── Response: 4 hours                                      │
│      └── Escalate if: Not resolved in 8 hours               │
│                                                             │
│  Level 2: Solutions Architect                               │
│  └── Response: 2 hours                                      │
│      └── Escalate if: Not resolved in 4 hours               │
│                                                             │
│  Level 3: Engineering Team                                  │
│  └── Response: 1 hour                                       │
│      └── Escalate if: Customer impact                       │
│                                                             │
│  Level 4: Partner Director                                  │
│  └── Response: 30 minutes                                   │
│      └── For: Business-critical issues                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Filing a Support Ticket

**Required Information:**
```yaml
ticket:
  partner_name: "Your Company"
  partner_tier: "Certified | Premier | Strategic"
  contact_email: "you@company.com"

  issue:
    severity: "Critical | High | Medium | Low"
    category: "Technical | Integration | Billing | Other"
    subject: "Brief description"
    description: "Detailed explanation"

  technical_details:
    environment: "sandbox | staging | production"
    sdk_version: "2.0.0"
    language: "Python 3.11"
    request_id: "req_abc123"  # If applicable
    error_message: "Full error text"

  reproduction:
    steps: "1. Do this 2. Then that 3. Error occurs"
    frequency: "Always | Sometimes | Once"

  attachments:
    - logs
    - screenshots
    - code_samples
```

---

## 11. Commercial Terms

### Pricing Models

| Model | Description | Best For |
|-------|-------------|----------|
| **Resale** | Buy at discount, sell at list | Volume resellers |
| **Referral** | Commission on referred deals | Services partners |
| **Embed** | OEM licensing for your product | Technology partners |
| **Marketplace** | List your solution | Solution partners |

### Partner Discounts (Resale Model)

| Tier | Discount off List | Volume Bonus |
|------|-------------------|--------------|
| Registered | 10% | — |
| Certified | 20% | +5% at $100K |
| Premier | 30% | +5% at $250K |
| Strategic | 35%+ | Custom |

### Referral Commissions

| Tier | First Year | Renewal Years |
|------|------------|---------------|
| Registered | 10% | 5% |
| Certified | 15% | 7.5% |
| Premier | 20% | 10% |
| Strategic | Custom | Custom |

### Deal Registration

```
┌─────────────────────────────────────────────────────────────┐
│                  DEAL REGISTRATION                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Benefits of Registration:                                  │
│  • Price protection for 90 days                            │
│  • Higher discount tier                                    │
│  • Sales support from Vorion                               │
│  • Protection from channel conflict                        │
│                                                             │
│  Process:                                                   │
│  1. Submit via Partner Portal                              │
│  2. Vorion reviews (48 hours)                              │
│  3. Approved → Registration confirmed                      │
│  4. Work deal with Vorion support                          │
│  5. Close and claim commission                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Payment Terms

| Aspect | Terms |
|--------|-------|
| Commission Payment | Net 30 after customer payment |
| Resale Payment | Net 30 from invoice |
| Minimum Payout | $100 |
| Payment Methods | ACH, Wire, PayPal |

---

## Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **BASIS** | Open-standard rule language for defining constraints |
| **Cognigate** | Proprietary constrained execution runtime |
| **PROOF** | Immutable evidence recording system |
| **INTENT** | Natural language goal interpretation component |
| **ENFORCE** | Real-time constraint evaluation and gating |
| **Trust Score** | Numeric value (0-1000) representing entity trustworthiness |
| **Autonomy Level** | Trust tier (L0-L4) determining execution permissions |

### Appendix B: Quick Links

| Resource | URL |
|----------|-----|
| Partner Portal | https://partners.vorion.io |
| Documentation | https://docs.vorion.io |
| API Reference | https://api.vorion.io/docs |
| SDK Downloads | https://docs.vorion.io/sdks |
| Sandbox | https://sandbox.vorion.io |
| Status Page | https://status.vorion.io |
| Support | https://support.vorion.io |

### Appendix C: Sample Project Ideas

| Project | Complexity | Description |
|---------|------------|-------------|
| Webhook Receiver | Beginner | Receive and log Vorion events |
| Approval Workflow | Intermediate | Human approval for high-risk intents |
| Custom Dashboard | Intermediate | Visualize trust scores and activity |
| Slack Integration | Intermediate | Notify on constraint violations |
| Audit Reporter | Advanced | Generate compliance reports from PROOF |
| Custom Connector | Advanced | Integrate with third-party system |

### Appendix D: Frequently Asked Questions

**Q: How long does certification take?**
A: Most partners complete Developer Fundamentals in 1-2 days and Solution Architect in 3-5 days.

**Q: Can I use the sandbox for customer demos?**
A: Yes, sandbox is designed for demos and development. For production-like demos, request staging access.

**Q: What if my customer needs on-premise deployment?**
A: On-premise is available in Enterprise tier. Contact your Partner Manager to discuss requirements.

**Q: How do I get early access to new features?**
A: Premier and Strategic partners receive early access. Features are announced in the partner newsletter.

**Q: Can I white-label Vorion?**
A: White-labeling requires a Strategic partnership with custom terms. Contact partner-sales@vorion.io.

---

## Contact Directory

| Need | Contact |
|------|---------|
| General Partner Inquiries | partners@vorion.io |
| Technical Support | partner-support@vorion.io |
| Solutions Architecture | solutions@vorion.io |
| Training & Certification | enablement@vorion.io |
| Marketing & Co-sell | partner-marketing@vorion.io |
| Commercial / Contracts | partner-sales@vorion.io |
| Emergency (Production) | +1-XXX-XXX-XXXX |

---

**Welcome aboard! We're excited to have you as a Vorion partner.**

*Questions? Reach out to your Partner Manager or partners@vorion.io*

---

*Document Version: 1.0.0*
*Last Updated: 2026-01-08*
*Classification: Partner Confidential*
