# Compliance Module

Enterprise compliance framework for AgentAnchorAI supporting **SOC 2**, **HIPAA**, and **ISO 27001**.

## Overview

This module provides comprehensive compliance controls, audit logging, access management, and monitoring capabilities for organizations requiring regulatory compliance.

## Architecture

```
lib/compliance/
├── types.ts              # TypeScript type definitions
├── audit-logger.ts       # Immutable audit trail with hash chains
├── access-control.ts     # Policy-based access control
├── hipaa-service.ts      # HIPAA-specific compliance
├── iso27001-service.ts   # ISO 27001 ISMS implementation
└── index.ts              # Unified service & exports
```

## Quick Start

```typescript
import {
  complianceService,
  complianceAuditLogger,
  complianceAccessControl,
  hipaaService,
  iso27001Service
} from '@/lib/compliance';

// Get compliance dashboard
const dashboard = await complianceService.getDashboard();

// Check access permission
const decision = await complianceAccessControl.checkAccess({
  userId: 'user-123',
  resourceType: 'phi',
  resourceId: 'patient-456',
  action: 'read',
  purpose: 'treatment',
});

// Log audit event
await complianceAuditLogger.logDataOperation({
  userId: 'user-123',
  operation: 'read',
  resourceType: 'patient_record',
  resourceId: 'record-789',
  dataClassification: 'restricted',
  success: true,
});
```

## Framework Coverage

### SOC 2 Trust Service Criteria

| Category | Controls | Description |
|----------|----------|-------------|
| Security (CC) | CC1-CC9 | Common criteria for security |
| Availability (A) | A1 | System availability commitments |
| Processing Integrity (PI) | PI1 | Processing accuracy & completeness |
| Confidentiality (C) | C1 | Protection of confidential information |
| Privacy (P) | P1-P8 | Personal information protection |

**Key Controls Implemented:**
- CC6.1-CC6.8: Logical and physical access controls
- CC7.1-CC7.5: System operations and monitoring
- CC8.1: Change management

### HIPAA

| Rule | Safeguards | Description |
|------|------------|-------------|
| Privacy Rule | Administrative | PHI use and disclosure |
| Security Rule | Administrative, Physical, Technical | ePHI protection |
| Breach Notification | Administrative | Incident response |

**Key Sections Implemented:**
- §164.308: Administrative safeguards
- §164.310: Physical safeguards
- §164.312: Technical safeguards
- §164.400-414: Breach notification

### ISO 27001:2022

| Annex A | Controls | Description |
|---------|----------|-------------|
| A.5 | 37 | Organizational controls |
| A.6 | 8 | People controls |
| A.7 | 14 | Physical controls |
| A.8 | 34 | Technological controls |

**Total: 93 Annex A controls**

## Services

### ComplianceAuditLogger

Immutable audit trail with SHA-256 hash chain for tamper detection.

```typescript
// Log PHI access (HIPAA)
await complianceAuditLogger.logPHIAccess({
  userId: 'user-123',
  agentId: 'agent-456',
  action: 'view',
  phiType: 'diagnosis',
  patientIdentifierHash: 'hashed-id',
  purpose: 'treatment',
  authorized: true,
  minimumNecessary: true,
});

// Log security event
await complianceAuditLogger.logSecurityEvent({
  eventType: 'intrusion_attempt',
  severity: 'high',
  title: 'Failed login attempts exceeded threshold',
  description: '10 failed attempts from IP 192.168.1.100',
  source: 'auth-service',
});

// Verify audit log integrity
const { valid, invalidEvents } = await complianceAuditLogger.verifyIntegrity(events);
```

### ComplianceAccessControl

Policy-based access control with HIPAA PHI restrictions.

```typescript
// Check access with purpose (required for PHI)
const decision = await complianceAccessControl.checkAccess({
  userId: 'user-123',
  resourceType: 'phi',
  resourceId: 'patient-456',
  action: 'read',
  purpose: 'treatment', // Required for PHI
});

// Enable healthcare access for an agent
const context = await complianceAccessControl.enableHealthcareAccess('agent-123', {
  enabledBy: 'admin-456',
  purposes: ['treatment', 'operations'],
  trainingCompleted: true,
  baaInPlace: true,
});

// Perform quarterly access review
const review = await complianceAccessControl.performAccessReview({
  reviewerId: 'admin-456',
  scope: 'phi',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-03-31'),
});
```

### HIPAAComplianceService

HIPAA-specific compliance operations.

```typescript
// Validate PHI access (minimum necessary)
const result = await hipaaService.validatePHIAccess({
  userId: 'user-123',
  agentId: 'agent-456',
  phiType: 'medical_record',
  purpose: 'treatment',
  requestedFields: ['diagnosis', 'medications', 'ssn'],
});
// result.deniedFields = ['ssn'] - not minimum necessary for treatment

// De-identify PHI (Safe Harbor method)
const deidentified = hipaaService.deidentifyPHI({
  name: 'John Doe',
  ssn: '123-45-6789',
  diagnosis: 'Hypertension',
  age: 45,
});
// Returns: { diagnosis: 'Hypertension', age: 45 }

// Report potential breach
const breach = await hipaaService.reportPotentialBreach({
  reportedBy: 'security-team',
  description: 'Unauthorized access to patient records',
  discoveredAt: new Date(),
  affectedRecords: 150,
  phiTypes: ['name', 'diagnosis'],
});

// Assess breach risk (4-factor analysis)
const assessment = await hipaaService.assessBreachRisk(breach.id, {
  assessedBy: 'privacy-officer',
  natureAndExtent: 'Names and diagnoses of 150 patients',
  unauthorizedPerson: 'Unknown external actor',
  wasAcquiredOrViewed: true,
  riskMitigated: false,
});

// Validate BAA
const validation = hipaaService.validateBAA(baa);
if (!validation.valid) {
  console.log('BAA Issues:', validation.issues);
}
```

### ISO27001ComplianceService

ISO 27001 ISMS implementation.

```typescript
// Perform risk assessment
const risks = await iso27001Service.performRiskAssessment({
  assessorId: 'risk-manager',
  scope: 'Customer Data Processing',
  assets: ['customer_data', 'financial_data'],
  threats: ['malware', 'phishing', 'insider'],
  vulnerabilities: ['unpatched', 'weak_auth', 'poor_training'],
});

// Update Statement of Applicability
await iso27001Service.updateControlApplicability('A.8.24', {
  included: true,
  justification: 'Cryptography required for data protection',
  implementationStatus: 'implemented',
  updatedBy: 'isms-manager',
});

// Plan internal audit
const auditPlan = await iso27001Service.planInternalAudit({
  auditId: 'audit-2024-q1',
  scope: ['access_control', 'cryptography', 'operations'],
  auditor: 'internal-auditor',
  scheduledDate: new Date('2024-03-15'),
  criteria: ['ISO 27001:2022', 'Internal policies'],
});

// Record audit finding
const findingId = await iso27001Service.recordAuditFinding({
  auditId: 'audit-2024-q1',
  controlId: 'A.5.18',
  findingType: 'nonconformity',
  severity: 'minor',
  description: 'Access reviews not completed within 90-day requirement',
  evidence: 'Review logs show 15 accounts not reviewed since Q2',
  auditor: 'internal-auditor',
});

// Generate management review input
const reviewInput = iso27001Service.generateManagementReviewInput();
```

## API Endpoints

### Dashboard & Reports

```http
GET /api/compliance
GET /api/compliance?frameworks=soc2,hipaa

POST /api/compliance
{
  "action": "generate_report",
  "framework": "hipaa",
  "reportType": "detailed",
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

### Audit Logs

```http
GET /api/compliance/audit?userId=123&frameworks=hipaa&phiOnly=true

POST /api/compliance/audit
{
  "eventType": "data_access",
  "resourceType": "patient_record",
  "resourceId": "record-123",
  "action": "read",
  "outcome": "success",
  "userId": "user-456"
}
```

### Access Control

```http
POST /api/compliance/access
{
  "action": "check",
  "userId": "user-123",
  "resourceType": "phi",
  "resourceId": "patient-456",
  "accessAction": "read",
  "purpose": "treatment"
}
```

### HIPAA Operations

```http
GET /api/compliance/hipaa

POST /api/compliance/hipaa
{
  "action": "validate_phi_access",
  "userId": "user-123",
  "agentId": "agent-456",
  "phiType": "medical_record",
  "purpose": "treatment",
  "requestedFields": ["diagnosis", "medications"]
}

POST /api/compliance/hipaa
{
  "action": "report_breach",
  "reportedBy": "security-team",
  "description": "Unauthorized access detected",
  "discoveredAt": "2024-03-15T10:30:00Z",
  "affectedRecords": 50
}
```

### ISO 27001 Operations

```http
GET /api/compliance/iso27001?type=controls
GET /api/compliance/iso27001?type=soa
GET /api/compliance/iso27001?type=risks

POST /api/compliance/iso27001
{
  "action": "risk_assessment",
  "assessorId": "risk-manager",
  "scope": "Data Processing",
  "assets": ["customer_data"],
  "threats": ["malware", "phishing"],
  "vulnerabilities": ["unpatched"]
}
```

## Database Schema

See `supabase/migrations/20241209_compliance_tables.sql` for complete schema.

### Key Tables

| Table | Purpose |
|-------|---------|
| `compliance_audit_logs` | Immutable audit trail with hash chains |
| `phi_access_logs` | HIPAA PHI access tracking |
| `breach_records` | Security breach management |
| `breach_notifications` | HIPAA notification tracking |
| `compliance_controls` | Unified control status |
| `risk_register` | ISO 27001 risk management |
| `compliance_evidence` | Audit evidence collection |
| `audit_findings` | Finding remediation tracking |
| `business_associate_agreements` | HIPAA BAA management |
| `agent_compliance_context` | Agent compliance settings |

## Dashboard Components

```tsx
import { ComplianceDashboard } from '@/components/compliance';

export default function CompliancePage() {
  return <ComplianceDashboard />;
}
```

Available components:
- `ComplianceDashboard` - Full dashboard with all widgets
- `ComplianceScoreCard` - Individual framework scores
- `FrameworkStatus` - Control status visualization
- `RiskOverview` - Risk statistics
- `ComplianceMetrics` - Key metrics grid
- `RecentAlerts` - Alert management

## Configuration

### Environment Variables

```env
# Enable compliance module
COMPLIANCE_ENABLED=true

# Retention period (days) - default 7 years for HIPAA
COMPLIANCE_RETENTION_DAYS=2555

# Audit log flush interval (ms)
COMPLIANCE_FLUSH_INTERVAL=5000
```

### Agent Compliance Context

Each agent can have specific compliance settings:

```typescript
const context: AgentComplianceContext = {
  agentId: 'agent-123',
  frameworks: ['soc2', 'hipaa', 'iso27001'],
  phiAuthorized: true,
  phiPurposes: ['treatment', 'operations'],
  minimumNecessaryEnforced: true,
  dataClassification: 'restricted',
  encryptionRequired: true,
  auditLoggingEnabled: true,
  retentionPeriod: 2555, // 7 years
  accessLevel: 'read',
  mfaRequired: true,
  activeControls: ['CC6.1', '164.312(a)(1)', 'A.8.5'],
};
```

## Testing

```bash
# Run compliance module tests
npm test -- --grep compliance

# Test specific framework
npm test -- --grep hipaa
npm test -- --grep iso27001
```

## Audit Preparation

### SOC 2 Type II

1. Enable continuous monitoring
2. Collect evidence for control testing periods
3. Generate quarterly compliance reports
4. Review access logs for anomalies

### HIPAA

1. Verify all PHI access has documented purpose
2. Complete annual risk assessment
3. Review BAA status for all vendors
4. Test breach notification procedures

### ISO 27001

1. Complete internal audit cycle
2. Update Statement of Applicability
3. Conduct management review
4. Address all nonconformities

## License

Proprietary - AgentAnchorAI
