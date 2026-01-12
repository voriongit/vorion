/**
 * Compliance Framework Types
 * SOC 2, HIPAA, ISO 27001 Compliance for AgentAnchorAI
 */

// =============================================================================
// Compliance Frameworks
// =============================================================================

export type ComplianceFramework = 'soc2' | 'hipaa' | 'iso27001';

export type ComplianceStatus =
  | 'compliant'
  | 'non_compliant'
  | 'partial'
  | 'not_applicable'
  | 'under_review';

export interface ComplianceRequirement {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  owner: string;
  dueDate?: Date;
  lastAssessed?: Date;
}

// =============================================================================
// SOC 2 Trust Service Criteria
// =============================================================================

export type SOC2Category =
  | 'security'       // CC - Common Criteria
  | 'availability'   // A
  | 'processing_integrity' // PI
  | 'confidentiality' // C
  | 'privacy';       // P

export interface SOC2Control {
  criteriaId: string;  // e.g., 'CC6.1', 'A1.2', 'P3.1'
  category: SOC2Category;
  title: string;
  description: string;
  implementation: string;
  testingProcedure: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  automatedTesting: boolean;
  monitoringAgentId?: string;
}

// =============================================================================
// HIPAA Rules
// =============================================================================

export type HIPAARule =
  | 'privacy'
  | 'security'
  | 'breach_notification'
  | 'enforcement';

export type HIPAASafeguard =
  | 'administrative'
  | 'physical'
  | 'technical';

export interface HIPAAControl {
  section: string;  // e.g., '164.308(a)(1)'
  rule: HIPAARule;
  safeguard: HIPAASafeguard;
  standard: string;
  implementation: string;
  addressable: boolean;  // Required vs Addressable
  phiHandling: boolean;
}

export interface PHIAccessLog {
  id: string;
  timestamp: Date;
  userId: string;
  agentId: string;
  action: 'view' | 'create' | 'modify' | 'delete' | 'export' | 'transmit';
  phiType: string;
  patientIdentifierHash: string;  // Hashed for logging
  purpose: 'treatment' | 'payment' | 'operations' | 'research' | 'other';
  authorized: boolean;
  minimumNecessary: boolean;
}

// =============================================================================
// ISO 27001 ISMS
// =============================================================================

export type ISO27001Clause =
  | 'context'          // 4
  | 'leadership'       // 5
  | 'planning'         // 6
  | 'support'          // 7
  | 'operation'        // 8
  | 'performance'      // 9
  | 'improvement';     // 10

export type ISO27001AnnexA =
  | 'organizational'   // A.5
  | 'people'           // A.6
  | 'physical'         // A.7
  | 'technological';   // A.8

export interface ISO27001Control {
  controlId: string;  // e.g., 'A.5.1', 'A.8.24'
  clause?: ISO27001Clause;
  annexA?: ISO27001AnnexA;
  title: string;
  description: string;
  implementation: string;
  soa: 'included' | 'excluded';  // Statement of Applicability
  justification?: string;
}

// =============================================================================
// Compliance Evidence
// =============================================================================

export type EvidenceType =
  | 'policy'
  | 'procedure'
  | 'log'
  | 'screenshot'
  | 'report'
  | 'configuration'
  | 'attestation'
  | 'audit_trail';

export interface ComplianceEvidence {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  collectedAt: Date;
  collectedBy: string;  // Agent ID or User ID
  filePath?: string;
  dataHash: string;  // For integrity verification
  retentionDate: Date;
  frameworks: ComplianceFramework[];
  controlIds: string[];  // Which controls this evidence supports
}

// =============================================================================
// Audit & Assessment
// =============================================================================

export type AuditType =
  | 'internal'
  | 'external'
  | 'self_assessment'
  | 'penetration_test'
  | 'vulnerability_scan';

export type FindingSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'informational';

export interface ComplianceAudit {
  id: string;
  type: AuditType;
  framework: ComplianceFramework;
  scope: string;
  startDate: Date;
  endDate?: Date;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  auditor: string;
  findings: AuditFinding[];
}

export interface AuditFinding {
  id: string;
  auditId: string;
  controlId: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
  status: 'open' | 'in_progress' | 'remediated' | 'accepted' | 'false_positive';
  dueDate?: Date;
  remediatedDate?: Date;
  owner: string;
}

// =============================================================================
// Risk Management
// =============================================================================

export type RiskCategory =
  | 'security'
  | 'operational'
  | 'compliance'
  | 'reputational'
  | 'financial';

export type RiskTreatment =
  | 'mitigate'
  | 'accept'
  | 'transfer'
  | 'avoid';

export interface ComplianceRisk {
  id: string;
  category: RiskCategory;
  title: string;
  description: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  inherentRiskScore: number;
  controls: string[];  // Control IDs
  residualLikelihood: 1 | 2 | 3 | 4 | 5;
  residualImpact: 1 | 2 | 3 | 4 | 5;
  residualRiskScore: number;
  treatment: RiskTreatment;
  owner: string;
  reviewDate: Date;
  frameworks: ComplianceFramework[];
}

// =============================================================================
// Breach & Incident Management
// =============================================================================

export type BreachSeverity =
  | 'confirmed_breach'
  | 'potential_breach'
  | 'security_incident'
  | 'near_miss';

export interface BreachRecord {
  id: string;
  discoveredAt: Date;
  discoveredBy: string;
  severity: BreachSeverity;
  description: string;
  affectedRecords: number;
  phiInvolved: boolean;

  // HIPAA Breach Notification
  hipaaBreachDetermination?: {
    determinedAt: Date;
    determinedBy: string;
    isBreach: boolean;
    riskAssessment: {
      natureAndExtent: string;
      unauthorizedPerson: string;
      actuallyAcquiredOrViewed: boolean;
      riskMitigated: boolean;
    };
  };

  // Notification tracking
  notifications: BreachNotification[];

  // Response
  containmentActions: string[];
  eradicationActions: string[];
  recoveryActions: string[];
  lessonsLearned?: string;

  status: 'investigating' | 'contained' | 'resolved' | 'closed';
}

export interface BreachNotification {
  id: string;
  breachId: string;
  notificationType: 'individual' | 'hhs' | 'media' | 'business_associate';
  notifiedAt: Date;
  notifiedBy: string;
  recipient: string;
  method: 'email' | 'mail' | 'portal' | 'press_release';
  content: string;
  acknowledgment?: Date;
}

// =============================================================================
// Compliance Monitoring
// =============================================================================

export interface ComplianceMetric {
  id: string;
  name: string;
  description: string;
  framework: ComplianceFramework;
  controlId?: string;
  currentValue: number;
  target: number;
  threshold: number;  // Alert threshold
  unit: string;
  frequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastUpdated: Date;
  trend: 'improving' | 'stable' | 'declining';
}

export interface ComplianceAlert {
  id: string;
  timestamp: Date;
  framework: ComplianceFramework;
  controlId?: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  metric?: ComplianceMetric;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

// =============================================================================
// Compliance Dashboard
// =============================================================================

export interface ComplianceDashboard {
  overallScore: number;  // 0-100
  frameworkScores: Record<ComplianceFramework, number>;

  controlStats: {
    total: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notApplicable: number;
  };

  findingStats: {
    open: number;
    inProgress: number;
    overdue: number;
    bySeverity: Record<FindingSeverity, number>;
  };

  riskStats: {
    total: number;
    byCategory: Record<RiskCategory, number>;
    highRisk: number;
    criticalRisk: number;
  };

  upcomingAudits: ComplianceAudit[];
  recentAlerts: ComplianceAlert[];

  lastUpdated: Date;
}

// =============================================================================
// Agent Compliance Context
// =============================================================================

export interface AgentComplianceContext {
  agentId: string;
  frameworks: ComplianceFramework[];

  // PHI Handling (HIPAA)
  phiAuthorized: boolean;
  phiPurposes: ('treatment' | 'payment' | 'operations' | 'research')[];
  minimumNecessaryEnforced: boolean;

  // Data Classification
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  encryptionRequired: boolean;

  // Audit Requirements
  auditLoggingEnabled: boolean;
  retentionPeriod: number;  // Days

  // Access Control
  accessLevel: 'none' | 'read' | 'write' | 'admin';
  mfaRequired: boolean;

  // Compliance Controls
  activeControls: string[];  // Control IDs enforced for this agent
}

// =============================================================================
// Vendor/BAA Management
// =============================================================================

export interface BusinessAssociateAgreement {
  id: string;
  vendorName: string;
  vendorId: string;
  effectiveDate: Date;
  expirationDate: Date;
  status: 'draft' | 'active' | 'expired' | 'terminated';

  permittedUses: string[];
  permittedDisclosures: string[];
  safeguardRequirements: string[];
  breachNotificationTerms: string;
  subcontractorTerms: string;
  terminationTerms: string;

  lastReviewDate: Date;
  nextReviewDate: Date;
  documentPath: string;
}

export interface VendorRiskAssessment {
  id: string;
  vendorId: string;
  vendorName: string;
  assessmentDate: Date;
  assessor: string;

  riskTier: 'critical' | 'high' | 'medium' | 'low';
  dataAccess: boolean;
  phiAccess: boolean;

  securityControls: {
    control: string;
    status: 'met' | 'partial' | 'not_met' | 'not_assessed';
    notes?: string;
  }[];

  overallScore: number;
  recommendation: 'approve' | 'conditional' | 'reject';
  conditions?: string[];
  nextAssessmentDate: Date;
}
