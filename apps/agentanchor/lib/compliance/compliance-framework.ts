/**
 * Phase 6 Compliance Framework
 *
 * SOC2, HIPAA, and GDPR compliance controls and documentation
 */

// =============================================================================
// Types
// =============================================================================

export interface ComplianceControl {
  id: string;
  framework: 'SOC2' | 'HIPAA' | 'GDPR' | 'ISO27001' | 'PCI-DSS';
  category: string;
  name: string;
  description: string;
  requirement: string;
  implementation: string;
  evidence: string[];
  status: 'implemented' | 'partial' | 'planned' | 'not_applicable';
  owner: string;
  lastReviewed?: Date;
  nextReview?: Date;
}

export interface ComplianceAudit {
  id: string;
  framework: string;
  startDate: Date;
  endDate?: Date;
  auditor: string;
  status: 'planned' | 'in_progress' | 'completed' | 'remediation';
  findings: AuditFinding[];
  report?: string;
}

export interface AuditFinding {
  id: string;
  controlId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  title: string;
  description: string;
  recommendation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  dueDate?: Date;
  resolvedDate?: Date;
}

export interface DataProcessingRecord {
  id: string;
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  dataSources: string[];
  recipients: string[];
  retentionPeriod: string;
  securityMeasures: string[];
  crossBorderTransfers?: {
    country: string;
    mechanism: string;
  }[];
}

export interface PrivacyImpactAssessment {
  id: string;
  name: string;
  description: string;
  dateCompleted: Date;
  risks: PIARisk[];
  mitigations: string[];
  decision: 'proceed' | 'proceed_with_mitigations' | 'do_not_proceed';
  approver: string;
}

export interface PIARisk {
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

// =============================================================================
// SOC2 Controls
// =============================================================================

export const SOC2_CONTROLS: ComplianceControl[] = [
  // CC1 - Control Environment
  {
    id: 'CC1.1',
    framework: 'SOC2',
    category: 'Control Environment',
    name: 'Commitment to Integrity and Ethical Values',
    description: 'Management demonstrates commitment to integrity and ethical values',
    requirement: 'Establish and enforce ethical standards for all personnel',
    implementation: 'Code of conduct documented in employee handbook. Annual ethics training required. Violation reporting through secure channel.',
    evidence: ['Employee handbook', 'Training records', 'Ethics hotline logs'],
    status: 'implemented',
    owner: 'HR',
  },
  {
    id: 'CC1.2',
    framework: 'SOC2',
    category: 'Control Environment',
    name: 'Board Independence and Oversight',
    description: 'Board exercises oversight of internal controls',
    requirement: 'Independent board oversight of control environment',
    implementation: 'Quarterly security reviews by board. Independent audit committee. Regular reporting on security metrics.',
    evidence: ['Board meeting minutes', 'Security reports', 'Audit committee charter'],
    status: 'implemented',
    owner: 'Executive',
  },

  // CC2 - Communication and Information
  {
    id: 'CC2.1',
    framework: 'SOC2',
    category: 'Communication',
    name: 'Internal Communication',
    description: 'Internal communication of security policies',
    requirement: 'Communicate security policies to all personnel',
    implementation: 'Security policies published in internal wiki. New hire onboarding includes security training. Monthly security newsletters.',
    evidence: ['Policy documents', 'Training materials', 'Communication logs'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'CC2.2',
    framework: 'SOC2',
    category: 'Communication',
    name: 'External Communication',
    description: 'External communication about security',
    requirement: 'Communicate security commitments to external parties',
    implementation: 'Public security page. Customer security questionnaire responses. Incident notification procedures.',
    evidence: ['Security page', 'Customer communications', 'Incident reports'],
    status: 'implemented',
    owner: 'Security',
  },

  // CC3 - Risk Assessment
  {
    id: 'CC3.1',
    framework: 'SOC2',
    category: 'Risk Assessment',
    name: 'Risk Identification',
    description: 'Identify and assess risks to objectives',
    requirement: 'Formal risk assessment process',
    implementation: 'Annual risk assessment. Threat modeling for new features. Continuous vulnerability scanning.',
    evidence: ['Risk register', 'Threat models', 'Vulnerability reports'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'CC3.2',
    framework: 'SOC2',
    category: 'Risk Assessment',
    name: 'Fraud Risk Assessment',
    description: 'Assess potential for fraud',
    requirement: 'Evaluate fraud risk in operations',
    implementation: 'Fraud risk assessment during annual review. Anti-fraud controls in financial systems. Segregation of duties enforced.',
    evidence: ['Fraud risk assessment', 'Control documentation', 'Access reviews'],
    status: 'implemented',
    owner: 'Finance',
  },

  // CC4 - Monitoring
  {
    id: 'CC4.1',
    framework: 'SOC2',
    category: 'Monitoring',
    name: 'Ongoing Monitoring',
    description: 'Monitor and evaluate internal controls',
    requirement: 'Continuous monitoring of control effectiveness',
    implementation: 'Automated control monitoring dashboards. Weekly security metrics review. Quarterly control testing.',
    evidence: ['Monitoring dashboards', 'Review records', 'Test results'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'CC4.2',
    framework: 'SOC2',
    category: 'Monitoring',
    name: 'Deficiency Evaluation',
    description: 'Evaluate and communicate deficiencies',
    requirement: 'Timely remediation of control deficiencies',
    implementation: 'Deficiency tracking in ticketing system. SLA-based remediation timelines. Escalation procedures for critical issues.',
    evidence: ['Deficiency tickets', 'Remediation records', 'Escalation logs'],
    status: 'implemented',
    owner: 'Security',
  },

  // CC5 - Control Activities
  {
    id: 'CC5.1',
    framework: 'SOC2',
    category: 'Control Activities',
    name: 'Logical Access Controls',
    description: 'Logical access security controls',
    requirement: 'Restrict access to authorized personnel',
    implementation: 'Role-based access control (RBAC). MFA required for all systems. Quarterly access reviews. Automated deprovisioning.',
    evidence: ['Access policies', 'MFA logs', 'Access review records'],
    status: 'implemented',
    owner: 'IT',
  },
  {
    id: 'CC5.2',
    framework: 'SOC2',
    category: 'Control Activities',
    name: 'Change Management',
    description: 'Change management controls',
    requirement: 'Controlled changes to systems',
    implementation: 'All changes through PR review. Automated CI/CD pipelines. Change advisory board for significant changes.',
    evidence: ['PR history', 'Deployment logs', 'CAB meeting records'],
    status: 'implemented',
    owner: 'Engineering',
  },
  {
    id: 'CC5.3',
    framework: 'SOC2',
    category: 'Control Activities',
    name: 'Data Protection',
    description: 'Data protection controls',
    requirement: 'Protect data at rest and in transit',
    implementation: 'AES-256 encryption at rest. TLS 1.3 in transit. Key rotation every 90 days. HSM for key storage.',
    evidence: ['Encryption configs', 'TLS certificates', 'Key rotation logs'],
    status: 'implemented',
    owner: 'Security',
  },

  // CC6 - Logical and Physical Access
  {
    id: 'CC6.1',
    framework: 'SOC2',
    category: 'Access Control',
    name: 'Infrastructure Security',
    description: 'Protect infrastructure from unauthorized access',
    requirement: 'Secure network and infrastructure',
    implementation: 'VPC isolation. Network segmentation. WAF protection. DDoS mitigation.',
    evidence: ['Network diagrams', 'Firewall rules', 'WAF configs'],
    status: 'implemented',
    owner: 'Infrastructure',
  },
  {
    id: 'CC6.2',
    framework: 'SOC2',
    category: 'Access Control',
    name: 'Authentication',
    description: 'Authenticate users before access',
    requirement: 'Strong authentication mechanisms',
    implementation: 'SSO with SAML/OIDC. MFA enforced. Password policy (min 12 chars, complexity). Session management.',
    evidence: ['Auth configs', 'MFA enrollment', 'Session policies'],
    status: 'implemented',
    owner: 'Security',
  },

  // CC7 - System Operations
  {
    id: 'CC7.1',
    framework: 'SOC2',
    category: 'Operations',
    name: 'Detection and Response',
    description: 'Detect and respond to security events',
    requirement: 'Security monitoring and incident response',
    implementation: 'SIEM with 24/7 monitoring. Automated alerting. Incident response playbooks. Regular drills.',
    evidence: ['SIEM logs', 'Alert records', 'Incident reports', 'Drill records'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'CC7.2',
    framework: 'SOC2',
    category: 'Operations',
    name: 'Recovery',
    description: 'Recover from incidents and disasters',
    requirement: 'Business continuity and disaster recovery',
    implementation: 'Daily backups with 30-day retention. DR site in separate region. Annual DR testing. RTO: 1hr, RPO: 15min.',
    evidence: ['Backup logs', 'DR plan', 'DR test results'],
    status: 'implemented',
    owner: 'Operations',
  },

  // CC8 - Change Management
  {
    id: 'CC8.1',
    framework: 'SOC2',
    category: 'Change Management',
    name: 'System Changes',
    description: 'Authorize and manage system changes',
    requirement: 'Controlled deployment of changes',
    implementation: 'CI/CD pipelines with automated testing. Mandatory code review. Staging environment validation. Rollback procedures.',
    evidence: ['CI/CD configs', 'Review records', 'Deployment logs'],
    status: 'implemented',
    owner: 'Engineering',
  },

  // CC9 - Risk Mitigation
  {
    id: 'CC9.1',
    framework: 'SOC2',
    category: 'Risk Mitigation',
    name: 'Vendor Management',
    description: 'Manage vendor and third-party risks',
    requirement: 'Assess and monitor vendor security',
    implementation: 'Vendor security assessment process. Annual vendor reviews. Security requirements in contracts.',
    evidence: ['Vendor assessments', 'Contract terms', 'Review records'],
    status: 'implemented',
    owner: 'Security',
  },
];

// =============================================================================
// HIPAA Controls
// =============================================================================

export const HIPAA_CONTROLS: ComplianceControl[] = [
  // Administrative Safeguards
  {
    id: 'HIPAA-AS-1',
    framework: 'HIPAA',
    category: 'Administrative Safeguards',
    name: 'Security Management Process',
    description: 'Implement policies to prevent, detect, and correct security violations',
    requirement: '164.308(a)(1)(i)',
    implementation: 'Risk analysis performed annually. Policies reviewed quarterly. Security officer designated.',
    evidence: ['Risk analysis', 'Policy documents', 'Security officer appointment'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'HIPAA-AS-2',
    framework: 'HIPAA',
    category: 'Administrative Safeguards',
    name: 'Workforce Security',
    description: 'Ensure workforce members have appropriate access',
    requirement: '164.308(a)(3)',
    implementation: 'Background checks for all employees. Role-based access. Termination procedures.',
    evidence: ['Background check records', 'Access policies', 'Termination checklists'],
    status: 'implemented',
    owner: 'HR',
  },
  {
    id: 'HIPAA-AS-3',
    framework: 'HIPAA',
    category: 'Administrative Safeguards',
    name: 'Security Awareness Training',
    description: 'Implement security awareness and training program',
    requirement: '164.308(a)(5)',
    implementation: 'Annual HIPAA training. Phishing simulations. Security reminders.',
    evidence: ['Training records', 'Phishing results', 'Communication logs'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'HIPAA-AS-4',
    framework: 'HIPAA',
    category: 'Administrative Safeguards',
    name: 'Contingency Plan',
    description: 'Establish policies for emergency response',
    requirement: '164.308(a)(7)',
    implementation: 'Data backup plan. Disaster recovery plan. Emergency mode operations.',
    evidence: ['Backup procedures', 'DR plan', 'Emergency procedures'],
    status: 'implemented',
    owner: 'Operations',
  },

  // Physical Safeguards
  {
    id: 'HIPAA-PS-1',
    framework: 'HIPAA',
    category: 'Physical Safeguards',
    name: 'Facility Access Controls',
    description: 'Limit physical access to facilities',
    requirement: '164.310(a)(1)',
    implementation: 'Cloud-hosted infrastructure with SOC2 certified providers. No physical PHI storage.',
    evidence: ['Cloud provider certifications', 'Architecture docs'],
    status: 'implemented',
    owner: 'Infrastructure',
  },
  {
    id: 'HIPAA-PS-2',
    framework: 'HIPAA',
    category: 'Physical Safeguards',
    name: 'Workstation Security',
    description: 'Implement policies for workstation use and security',
    requirement: '164.310(b-c)',
    implementation: 'Endpoint protection required. Full disk encryption. Screen lock policies.',
    evidence: ['Endpoint policies', 'Encryption status', 'Device inventory'],
    status: 'implemented',
    owner: 'IT',
  },

  // Technical Safeguards
  {
    id: 'HIPAA-TS-1',
    framework: 'HIPAA',
    category: 'Technical Safeguards',
    name: 'Access Control',
    description: 'Implement technical policies for access control',
    requirement: '164.312(a)(1)',
    implementation: 'Unique user identification. Emergency access procedure. Automatic logoff. Encryption.',
    evidence: ['Access logs', 'Emergency procedures', 'Session configs'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'HIPAA-TS-2',
    framework: 'HIPAA',
    category: 'Technical Safeguards',
    name: 'Audit Controls',
    description: 'Implement mechanisms to record and examine activity',
    requirement: '164.312(b)',
    implementation: 'Comprehensive audit logging. Log retention for 6 years. Regular log reviews.',
    evidence: ['Audit logs', 'Retention policies', 'Review records'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'HIPAA-TS-3',
    framework: 'HIPAA',
    category: 'Technical Safeguards',
    name: 'Integrity Controls',
    description: 'Implement policies to protect ePHI from alteration',
    requirement: '164.312(c)(1)',
    implementation: 'Data integrity checks. Cryptographic signatures for provenance. Tamper detection.',
    evidence: ['Integrity check logs', 'Signature verification', 'Alert configs'],
    status: 'implemented',
    owner: 'Engineering',
  },
  {
    id: 'HIPAA-TS-4',
    framework: 'HIPAA',
    category: 'Technical Safeguards',
    name: 'Transmission Security',
    description: 'Implement measures to guard against unauthorized access during transmission',
    requirement: '164.312(e)(1)',
    implementation: 'TLS 1.3 for all transmissions. End-to-end encryption for sensitive data. VPN for internal access.',
    evidence: ['TLS configs', 'Encryption policies', 'VPN logs'],
    status: 'implemented',
    owner: 'Infrastructure',
  },
];

// =============================================================================
// GDPR Controls
// =============================================================================

export const GDPR_CONTROLS: ComplianceControl[] = [
  // Lawfulness and Transparency
  {
    id: 'GDPR-LT-1',
    framework: 'GDPR',
    category: 'Lawfulness',
    name: 'Lawful Basis for Processing',
    description: 'Establish lawful basis for all data processing',
    requirement: 'Article 6',
    implementation: 'Legal basis documented for each processing activity. Consent management system. Legitimate interest assessments.',
    evidence: ['Processing records', 'Consent records', 'LIA documents'],
    status: 'implemented',
    owner: 'Legal',
  },
  {
    id: 'GDPR-LT-2',
    framework: 'GDPR',
    category: 'Transparency',
    name: 'Privacy Notice',
    description: 'Provide clear information about data processing',
    requirement: 'Articles 13-14',
    implementation: 'Comprehensive privacy policy. Just-in-time notices. Clear and plain language.',
    evidence: ['Privacy policy', 'Notice implementations', 'User communications'],
    status: 'implemented',
    owner: 'Legal',
  },

  // Data Subject Rights
  {
    id: 'GDPR-DSR-1',
    framework: 'GDPR',
    category: 'Data Subject Rights',
    name: 'Right of Access',
    description: 'Allow data subjects to access their data',
    requirement: 'Article 15',
    implementation: 'Self-service data export. API for automated access. Response within 30 days.',
    evidence: ['Export functionality', 'Access request logs', 'Response records'],
    status: 'implemented',
    owner: 'Engineering',
  },
  {
    id: 'GDPR-DSR-2',
    framework: 'GDPR',
    category: 'Data Subject Rights',
    name: 'Right to Rectification',
    description: 'Allow data subjects to correct inaccurate data',
    requirement: 'Article 16',
    implementation: 'Self-service profile editing. Support process for complex corrections.',
    evidence: ['Edit functionality', 'Support tickets', 'Correction logs'],
    status: 'implemented',
    owner: 'Engineering',
  },
  {
    id: 'GDPR-DSR-3',
    framework: 'GDPR',
    category: 'Data Subject Rights',
    name: 'Right to Erasure',
    description: 'Allow data subjects to request deletion',
    requirement: 'Article 17',
    implementation: 'Account deletion workflow. Data purge procedures. Retention exceptions documented.',
    evidence: ['Deletion functionality', 'Purge logs', 'Retention policy'],
    status: 'implemented',
    owner: 'Engineering',
  },
  {
    id: 'GDPR-DSR-4',
    framework: 'GDPR',
    category: 'Data Subject Rights',
    name: 'Right to Data Portability',
    description: 'Provide data in portable format',
    requirement: 'Article 20',
    implementation: 'JSON/CSV export. Machine-readable format. Direct transfer capability.',
    evidence: ['Export formats', 'Transfer functionality', 'Export logs'],
    status: 'implemented',
    owner: 'Engineering',
  },

  // Security
  {
    id: 'GDPR-SEC-1',
    framework: 'GDPR',
    category: 'Security',
    name: 'Security of Processing',
    description: 'Implement appropriate security measures',
    requirement: 'Article 32',
    implementation: 'Encryption. Pseudonymization. Regular security testing. Access controls.',
    evidence: ['Security configs', 'Test reports', 'Access logs'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'GDPR-SEC-2',
    framework: 'GDPR',
    category: 'Security',
    name: 'Data Breach Notification',
    description: 'Notify authorities and data subjects of breaches',
    requirement: 'Articles 33-34',
    implementation: 'Breach detection procedures. 72-hour notification process. Data subject notification criteria.',
    evidence: ['Breach procedures', 'Notification templates', 'Incident records'],
    status: 'implemented',
    owner: 'Security',
  },

  // Accountability
  {
    id: 'GDPR-ACC-1',
    framework: 'GDPR',
    category: 'Accountability',
    name: 'Records of Processing',
    description: 'Maintain records of processing activities',
    requirement: 'Article 30',
    implementation: 'Processing activity register. Regular updates. Available for supervisory authority.',
    evidence: ['Processing register', 'Update logs'],
    status: 'implemented',
    owner: 'Legal',
  },
  {
    id: 'GDPR-ACC-2',
    framework: 'GDPR',
    category: 'Accountability',
    name: 'Data Protection Impact Assessment',
    description: 'Conduct DPIAs for high-risk processing',
    requirement: 'Article 35',
    implementation: 'DPIA process for new features. Risk assessment methodology. Consultation with DPO.',
    evidence: ['DPIA documents', 'Risk assessments', 'DPO consultations'],
    status: 'implemented',
    owner: 'Security',
  },
  {
    id: 'GDPR-ACC-3',
    framework: 'GDPR',
    category: 'Accountability',
    name: 'Data Protection Officer',
    description: 'Designate a Data Protection Officer if required',
    requirement: 'Articles 37-39',
    implementation: 'DPO designated. Contact details published. Independent reporting line.',
    evidence: ['DPO appointment', 'Contact page', 'Org chart'],
    status: 'implemented',
    owner: 'Executive',
  },

  // International Transfers
  {
    id: 'GDPR-IT-1',
    framework: 'GDPR',
    category: 'International Transfers',
    name: 'Transfer Mechanisms',
    description: 'Ensure lawful international data transfers',
    requirement: 'Chapter V',
    implementation: 'Standard Contractual Clauses. Data processing agreements. Transfer impact assessments.',
    evidence: ['SCCs', 'DPAs', 'TIAs'],
    status: 'implemented',
    owner: 'Legal',
  },
];

// =============================================================================
// Compliance Manager
// =============================================================================

export class ComplianceManager {
  private controls: ComplianceControl[] = [
    ...SOC2_CONTROLS,
    ...HIPAA_CONTROLS,
    ...GDPR_CONTROLS,
  ];
  private audits: ComplianceAudit[] = [];
  private processingRecords: DataProcessingRecord[] = [];
  private pias: PrivacyImpactAssessment[] = [];

  /**
   * Get controls by framework
   */
  getControlsByFramework(framework: ComplianceControl['framework']): ComplianceControl[] {
    return this.controls.filter((c) => c.framework === framework);
  }

  /**
   * Get controls by status
   */
  getControlsByStatus(status: ComplianceControl['status']): ComplianceControl[] {
    return this.controls.filter((c) => c.status === status);
  }

  /**
   * Get compliance score
   */
  getComplianceScore(framework?: ComplianceControl['framework']): {
    total: number;
    implemented: number;
    partial: number;
    planned: number;
    score: number;
  } {
    const controls = framework
      ? this.getControlsByFramework(framework)
      : this.controls;

    const implemented = controls.filter((c) => c.status === 'implemented').length;
    const partial = controls.filter((c) => c.status === 'partial').length;
    const planned = controls.filter((c) => c.status === 'planned').length;
    const notApplicable = controls.filter((c) => c.status === 'not_applicable').length;

    const applicable = controls.length - notApplicable;
    const score = applicable > 0
      ? ((implemented + partial * 0.5) / applicable) * 100
      : 100;

    return {
      total: controls.length,
      implemented,
      partial,
      planned,
      score: Math.round(score * 10) / 10,
    };
  }

  /**
   * Get controls due for review
   */
  getControlsDueForReview(daysAhead: number = 30): ComplianceControl[] {
    const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return this.controls.filter((c) => c.nextReview && c.nextReview <= cutoff);
  }

  /**
   * Update control status
   */
  updateControlStatus(
    controlId: string,
    status: ComplianceControl['status'],
    evidence?: string[]
  ): void {
    const control = this.controls.find((c) => c.id === controlId);
    if (control) {
      control.status = status;
      control.lastReviewed = new Date();
      if (evidence) {
        control.evidence = evidence;
      }
    }
  }

  /**
   * Add audit
   */
  addAudit(audit: Omit<ComplianceAudit, 'id'>): ComplianceAudit {
    const newAudit: ComplianceAudit = {
      ...audit,
      id: `audit-${Date.now()}`,
    };
    this.audits.push(newAudit);
    return newAudit;
  }

  /**
   * Get audits
   */
  getAudits(framework?: string): ComplianceAudit[] {
    return framework
      ? this.audits.filter((a) => a.framework === framework)
      : this.audits;
  }

  /**
   * Add data processing record
   */
  addProcessingRecord(record: Omit<DataProcessingRecord, 'id'>): DataProcessingRecord {
    const newRecord: DataProcessingRecord = {
      ...record,
      id: `dpr-${Date.now()}`,
    };
    this.processingRecords.push(newRecord);
    return newRecord;
  }

  /**
   * Get processing records
   */
  getProcessingRecords(): DataProcessingRecord[] {
    return this.processingRecords;
  }

  /**
   * Add PIA
   */
  addPIA(pia: Omit<PrivacyImpactAssessment, 'id'>): PrivacyImpactAssessment {
    const newPia: PrivacyImpactAssessment = {
      ...pia,
      id: `pia-${Date.now()}`,
    };
    this.pias.push(newPia);
    return newPia;
  }

  /**
   * Get PIAs
   */
  getPIAs(): PrivacyImpactAssessment[] {
    return this.pias;
  }

  /**
   * Generate compliance report
   */
  generateReport(framework: ComplianceControl['framework']): string {
    const controls = this.getControlsByFramework(framework);
    const score = this.getComplianceScore(framework);

    const lines: string[] = [
      `# ${framework} Compliance Report`,
      '',
      `**Generated:** ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Compliance Score | ${score.score}% |`,
      `| Total Controls | ${score.total} |`,
      `| Implemented | ${score.implemented} |`,
      `| Partial | ${score.partial} |`,
      `| Planned | ${score.planned} |`,
      '',
      '## Controls',
      '',
    ];

    // Group by category
    const byCategory = controls.reduce((acc, control) => {
      if (!acc[control.category]) {
        acc[control.category] = [];
      }
      acc[control.category].push(control);
      return acc;
    }, {} as Record<string, ComplianceControl[]>);

    for (const [category, categoryControls] of Object.entries(byCategory)) {
      lines.push(`### ${category}`, '');

      for (const control of categoryControls) {
        const statusEmoji = {
          implemented: '✅',
          partial: '🟡',
          planned: '📋',
          not_applicable: '➖',
        }[control.status];

        lines.push(
          `#### ${control.id}: ${control.name}`,
          '',
          `**Status:** ${statusEmoji} ${control.status}`,
          '',
          `**Requirement:** ${control.requirement}`,
          '',
          `**Description:** ${control.description}`,
          '',
          `**Implementation:** ${control.implementation}`,
          '',
          `**Evidence:**`,
          ...control.evidence.map((e) => `- ${e}`),
          ''
        );
      }
    }

    return lines.join('\n');
  }
}

// =============================================================================
// Phase 6 Processing Records
// =============================================================================

export const PHASE6_PROCESSING_RECORDS: Omit<DataProcessingRecord, 'id'>[] = [
  {
    purpose: 'Role Gate Evaluation',
    legalBasis: 'Legitimate Interest (Security)',
    dataCategories: ['Agent identifiers', 'Trust scores', 'Capability requests'],
    dataSources: ['API requests', 'Agent SDK'],
    recipients: ['Internal systems'],
    retentionPeriod: '90 days',
    securityMeasures: ['Encryption at rest', 'TLS in transit', 'Access controls'],
  },
  {
    purpose: 'Capability Ceiling Enforcement',
    legalBasis: 'Legitimate Interest (Security)',
    dataCategories: ['Agent identifiers', 'Capability usage', 'Timestamps'],
    dataSources: ['API requests'],
    recipients: ['Internal systems'],
    retentionPeriod: '30 days',
    securityMeasures: ['Encryption at rest', 'TLS in transit', 'Access controls'],
  },
  {
    purpose: 'Provenance Tracking',
    legalBasis: 'Legitimate Interest (Audit)',
    dataCategories: ['Action records', 'Actor identifiers', 'Signatures'],
    dataSources: ['API requests', 'Internal events'],
    recipients: ['Internal systems', 'Auditors'],
    retentionPeriod: '7 years',
    securityMeasures: ['Cryptographic signatures', 'Immutable storage', 'Access controls'],
  },
  {
    purpose: 'Trust Score Calculation',
    legalBasis: 'Legitimate Interest (Security)',
    dataCategories: ['Agent identifiers', 'Behavior metrics', 'Historical data'],
    dataSources: ['Internal systems'],
    recipients: ['Internal systems'],
    retentionPeriod: '1 year',
    securityMeasures: ['Encryption at rest', 'Access controls', 'Anonymization'],
  },
  {
    purpose: 'Audit Logging',
    legalBasis: 'Legal Obligation / Legitimate Interest',
    dataCategories: ['User identifiers', 'IP addresses', 'Actions', 'Timestamps'],
    dataSources: ['All systems'],
    recipients: ['Internal systems', 'Auditors', 'Legal'],
    retentionPeriod: '7 years',
    securityMeasures: ['Immutable storage', 'Encryption', 'Access controls'],
  },
];

// =============================================================================
// Exports
// =============================================================================

export const complianceFramework = {
  manager: new ComplianceManager(),
  controls: {
    soc2: SOC2_CONTROLS,
    hipaa: HIPAA_CONTROLS,
    gdpr: GDPR_CONTROLS,
  },
  processingRecords: PHASE6_PROCESSING_RECORDS,
};
