# Compliance API

REST API endpoints for the AgentAnchorAI compliance module.

## Base URL

```
/api/compliance
```

## Authentication

All endpoints require authentication via Supabase Auth.

```http
Authorization: Bearer <access_token>
```

## Endpoints

### Dashboard

#### Get Compliance Dashboard

```http
GET /api/compliance
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `frameworks` | string | Comma-separated frameworks (soc2,hipaa,iso27001) |

**Response:**
```json
{
  "success": true,
  "data": {
    "dashboard": {
      "overallScore": 85,
      "frameworkScores": {
        "soc2": 85,
        "hipaa": 82,
        "iso27001": 88
      },
      "controlStats": {
        "total": 150,
        "compliant": 120,
        "nonCompliant": 5,
        "partial": 20,
        "notApplicable": 5
      },
      "findingStats": {
        "open": 3,
        "inProgress": 2,
        "overdue": 0,
        "bySeverity": {
          "critical": 0,
          "high": 1,
          "medium": 2,
          "low": 2,
          "informational": 0
        }
      },
      "riskStats": {
        "total": 25,
        "byCategory": {
          "security": 10,
          "operational": 5,
          "compliance": 4,
          "reputational": 3,
          "financial": 3
        },
        "highRisk": 3,
        "criticalRisk": 1
      },
      "upcomingAudits": [],
      "recentAlerts": [],
      "lastUpdated": "2024-03-15T10:30:00Z"
    },
    "status": [...],
    "metrics": [...]
  }
}
```

#### Generate Compliance Report

```http
POST /api/compliance
Content-Type: application/json

{
  "action": "generate_report",
  "framework": "hipaa",
  "reportType": "detailed",
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report_1710500000000",
    "generatedAt": "2024-03-15T10:30:00Z",
    "framework": "hipaa",
    "type": "detailed",
    "content": {
      "summary": {...},
      "dateRange": {...}
    }
  }
}
```

---

### Audit Logs

#### Query Audit Logs

```http
GET /api/compliance/audit
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO 8601 | Start date filter |
| `endDate` | ISO 8601 | End date filter |
| `userId` | string | Filter by user |
| `agentId` | string | Filter by agent |
| `resourceType` | string | Filter by resource type |
| `frameworks` | string | Comma-separated frameworks |
| `phiOnly` | boolean | Only PHI-related events |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "audit_1710500000000_abc123",
        "timestamp": "2024-03-15T10:30:00Z",
        "eventType": "phi_access",
        "userId": "user-123",
        "resourceType": "phi",
        "resourceId": "patient-456",
        "action": "view",
        "outcome": "success",
        "details": {...},
        "frameworks": ["hipaa"],
        "controlIds": ["164.312(b)"],
        "sensitivity": "high",
        "phiInvolved": true,
        "hash": "sha256..."
      }
    ],
    "count": 1
  }
}
```

#### Log Audit Event

```http
POST /api/compliance/audit
Content-Type: application/json

{
  "eventType": "data_access",
  "resourceType": "patient_record",
  "resourceId": "record-123",
  "action": "read",
  "outcome": "success",
  "userId": "user-456",
  "details": {
    "reason": "Treatment consultation"
  },
  "frameworks": ["hipaa"],
  "sensitivity": "high",
  "phiInvolved": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eventId": "audit_1710500000000_xyz789"
  }
}
```

---

### Access Control

#### Check Access Permission

```http
POST /api/compliance/access
Content-Type: application/json

{
  "action": "check",
  "userId": "user-123",
  "resourceType": "phi",
  "resourceId": "patient-456",
  "accessAction": "read",
  "purpose": "treatment"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "reason": "PHI access granted",
    "requiredMFA": false,
    "auditRequired": true,
    "restrictions": ["minimum_necessary", "no_export_without_approval"]
  }
}
```

#### Grant Access

```http
POST /api/compliance/access
Content-Type: application/json

{
  "action": "grant",
  "userId": "user-123",
  "resourceType": "configuration",
  "resourceId": "config-456",
  "level": "write",
  "grantedBy": "admin-789",
  "reason": "Project requirement",
  "expiresAt": "2024-06-30T23:59:59Z"
}
```

#### Revoke Access

```http
POST /api/compliance/access
Content-Type: application/json

{
  "action": "revoke",
  "userId": "user-123",
  "resourceType": "phi",
  "resourceId": "patient-456",
  "revokedBy": "admin-789",
  "reason": "Role change - no longer requires access"
}
```

#### Perform Access Review

```http
POST /api/compliance/access
Content-Type: application/json

{
  "action": "review",
  "reviewerId": "admin-123",
  "scope": "phi",
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

#### Get Agent Compliance Context

```http
POST /api/compliance/access
Content-Type: application/json

{
  "action": "get_context",
  "agentId": "agent-123"
}
```

#### Enable Healthcare Access

```http
POST /api/compliance/access
Content-Type: application/json

{
  "action": "enable_healthcare",
  "agentId": "agent-123",
  "enabledBy": "admin-456",
  "purposes": ["treatment", "operations"],
  "trainingCompleted": true,
  "baaInPlace": true
}
```

---

### HIPAA

#### Get HIPAA Controls

```http
GET /api/compliance/hipaa
```

**Response:**
```json
{
  "success": true,
  "data": {
    "controls": [...],
    "count": 25,
    "categories": {
      "administrative": 12,
      "technical": 10,
      "physical": 3
    }
  }
}
```

#### Validate PHI Access

```http
POST /api/compliance/hipaa
Content-Type: application/json

{
  "action": "validate_phi_access",
  "userId": "user-123",
  "agentId": "agent-456",
  "phiType": "medical_record",
  "purpose": "treatment",
  "requestedFields": ["diagnosis", "medications", "ssn"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "approved": false,
    "allowedFields": ["diagnosis", "medications"],
    "deniedFields": ["ssn"],
    "reason": "Requested fields exceed minimum necessary for treatment: ssn"
  }
}
```

#### De-identify PHI

```http
POST /api/compliance/hipaa
Content-Type: application/json

{
  "action": "deidentify",
  "data": {
    "name": "John Doe",
    "ssn": "123-45-6789",
    "diagnosis": "Hypertension",
    "age": 45
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deidentified": {
      "diagnosis": "Hypertension",
      "age": 45
    },
    "verification": {
      "isDeidentified": true,
      "identifiersFound": []
    }
  }
}
```

#### Report Potential Breach

```http
POST /api/compliance/hipaa
Content-Type: application/json

{
  "action": "report_breach",
  "reportedBy": "security-team",
  "description": "Unauthorized access to patient portal detected",
  "discoveredAt": "2024-03-15T10:30:00Z",
  "affectedRecords": 150,
  "phiTypes": ["name", "diagnosis", "medications"],
  "systemsInvolved": ["patient-portal", "ehr-system"]
}
```

#### Assess Breach Risk

```http
POST /api/compliance/hipaa
Content-Type: application/json

{
  "action": "assess_breach",
  "breachId": "breach_1710500000000_abc123",
  "assessedBy": "privacy-officer",
  "natureAndExtent": "Names, diagnoses, and SSNs of 150 patients",
  "unauthorizedPerson": "Unknown external actor via compromised credentials",
  "wasAcquiredOrViewed": true,
  "riskMitigated": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "breachId": "breach_1710500000000_abc123",
    "isBreach": true,
    "riskLevel": "high",
    "notificationRequired": true,
    "reasoning": "Risk score: 9/12. Factors: Sensitive PHI involved; Unknown or malicious actor; PHI confirmed accessed"
  }
}
```

#### Create Breach Notification

```http
POST /api/compliance/hipaa
Content-Type: application/json

{
  "action": "create_notification",
  "breachId": "breach_1710500000000_abc123",
  "notificationType": "individual",
  "recipientCount": 150,
  "notifyBy": "privacy-officer"
}
```

#### Validate BAA

```http
POST /api/compliance/hipaa
Content-Type: application/json

{
  "action": "validate_baa",
  "baa": {
    "id": "baa-123",
    "vendorName": "Cloud Provider Inc",
    "vendorId": "vendor-456",
    "effectiveDate": "2024-01-01",
    "expirationDate": "2025-12-31",
    "status": "active",
    "permittedUses": ["data_storage", "data_processing"],
    "permittedDisclosures": ["subcontractors"],
    "safeguardRequirements": ["encryption", "access_controls"],
    "breachNotificationTerms": "Within 24 hours of discovery",
    "subcontractorTerms": "Must execute BAA with subcontractors",
    "terminationTerms": "Return or destroy all PHI within 30 days",
    "lastReviewDate": "2024-01-15",
    "nextReviewDate": "2024-07-15"
  }
}
```

---

### ISO 27001

#### Get ISO 27001 Data

```http
GET /api/compliance/iso27001?type=controls
GET /api/compliance/iso27001?type=soa
GET /api/compliance/iso27001?type=risks
GET /api/compliance/iso27001?type=management_review
```

#### Perform Risk Assessment

```http
POST /api/compliance/iso27001
Content-Type: application/json

{
  "action": "risk_assessment",
  "assessorId": "risk-manager",
  "scope": "Customer Data Processing",
  "assets": ["customer_data", "financial_data", "employee_data"],
  "threats": ["malware", "phishing", "insider", "ransomware"],
  "vulnerabilities": ["unpatched", "weak_auth", "poor_training", "no_encryption"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "riskId": "risk_1710500000000_abc123",
        "title": "malware exploiting unpatched affecting customer_data",
        "category": "security",
        "inherentRisk": { "likelihood": 4, "impact": 5, "score": 20 },
        "residualRisk": { "likelihood": 2, "impact": 5, "score": 10 },
        "treatment": "mitigate",
        "controls": ["A.8.7", "A.8.8", "A.8.9"],
        "owner": "risk-manager",
        "reviewDate": "2025-03-15T00:00:00Z"
      }
    ],
    "summary": {
      "total": 48,
      "highRisk": 5,
      "mediumRisk": 15,
      "lowRisk": 28
    }
  }
}
```

#### Update Risk Treatment

```http
POST /api/compliance/iso27001
Content-Type: application/json

{
  "action": "update_risk_treatment",
  "riskId": "risk_1710500000000_abc123",
  "treatment": "mitigate",
  "controls": ["A.8.7", "A.8.8", "A.8.9", "A.8.32"],
  "justification": "Additional change management control added",
  "updatedBy": "risk-manager"
}
```

#### Update Statement of Applicability

```http
POST /api/compliance/iso27001
Content-Type: application/json

{
  "action": "update_soa",
  "controlId": "A.8.24",
  "included": true,
  "justification": "Cryptography required for data protection regulations",
  "implementationStatus": "implemented",
  "updatedBy": "isms-manager"
}
```

#### Plan Internal Audit

```http
POST /api/compliance/iso27001
Content-Type: application/json

{
  "action": "plan_audit",
  "auditId": "audit-2024-q1",
  "scope": ["access_control", "cryptography", "operations", "incident_management"],
  "auditor": "internal-auditor",
  "scheduledDate": "2024-03-15",
  "criteria": ["ISO 27001:2022", "Internal security policies"]
}
```

#### Record Audit Finding

```http
POST /api/compliance/iso27001
Content-Type: application/json

{
  "action": "record_finding",
  "auditId": "audit-2024-q1",
  "controlId": "A.5.18",
  "findingType": "nonconformity",
  "severity": "minor",
  "description": "Access reviews not completed within 90-day requirement for 15 accounts",
  "evidence": "Access review logs dated 2024-03-10 show accounts last reviewed in Q2 2023",
  "auditor": "internal-auditor"
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 500 | Internal Server Error |

## Rate Limiting

- 100 requests per minute per user
- 1000 requests per minute per organization

## Webhooks

Configure webhooks for real-time compliance events:

```json
{
  "url": "https://your-app.com/webhooks/compliance",
  "events": [
    "breach.reported",
    "breach.assessed",
    "alert.created",
    "finding.created",
    "phi.access.denied"
  ]
}
```
