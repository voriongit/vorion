/**
 * ISO 27001 Compliance Service
 * Information Security Management System (ISMS)
 */

import { complianceAuditLogger } from './audit-logger';
import type {
  ISO27001Control,
  ComplianceRisk,
  RiskCategory,
  RiskTreatment,
  ComplianceEvidence,
} from './types';

// =============================================================================
// ISO 27001 Types
// =============================================================================

export interface RiskAssessmentResult {
  riskId: string;
  title: string;
  category: RiskCategory;
  inherentRisk: { likelihood: number; impact: number; score: number };
  residualRisk: { likelihood: number; impact: number; score: number };
  treatment: RiskTreatment;
  controls: string[];
  owner: string;
  reviewDate: Date;
}

export interface ISMSScope {
  organization: string;
  departments: string[];
  systems: string[];
  locations: string[];
  exclusions: string[];
  justifications: Record<string, string>;
}

export interface StatementOfApplicability {
  controlId: string;
  included: boolean;
  justification: string;
  implementationStatus: 'implemented' | 'planned' | 'not_applicable';
  evidence?: string;
}

// =============================================================================
// ISO 27001 Compliance Service
// =============================================================================

export class ISO27001ComplianceService {
  private static instance: ISO27001ComplianceService;
  private risks: Map<string, ComplianceRisk> = new Map();
  private soa: Map<string, StatementOfApplicability> = new Map();

  private constructor() {
    this.initializeDefaultSoA();
  }

  static getInstance(): ISO27001ComplianceService {
    if (!ISO27001ComplianceService.instance) {
      ISO27001ComplianceService.instance = new ISO27001ComplianceService();
    }
    return ISO27001ComplianceService.instance;
  }

  // =============================================================================
  // Risk Management - Clause 6.1.2 & 8.2
  // =============================================================================

  /**
   * Perform risk assessment
   */
  async performRiskAssessment(params: {
    assessorId: string;
    scope: string;
    assets: string[];
    threats: string[];
    vulnerabilities: string[];
  }): Promise<RiskAssessmentResult[]> {
    const results: RiskAssessmentResult[] = [];
    const assessmentId = `ra_${Date.now()}`;

    // Generate risk scenarios from asset-threat-vulnerability combinations
    for (const asset of params.assets) {
      for (const threat of params.threats) {
        for (const vulnerability of params.vulnerabilities) {
          const riskId = `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Calculate inherent risk (before controls)
          const inherentLikelihood = this.assessLikelihood(threat, vulnerability);
          const inherentImpact = this.assessImpact(asset);
          const inherentScore = inherentLikelihood * inherentImpact;

          // Identify applicable controls
          const applicableControls = this.identifyControls(threat, vulnerability);

          // Calculate residual risk (after controls)
          const controlEffectiveness = this.calculateControlEffectiveness(applicableControls);
          const residualLikelihood = Math.max(1, inherentLikelihood - controlEffectiveness);
          const residualImpact = inherentImpact;
          const residualScore = residualLikelihood * residualImpact;

          // Determine treatment
          const treatment = this.determineTreatment(residualScore);

          const result: RiskAssessmentResult = {
            riskId,
            title: `${threat} exploiting ${vulnerability} affecting ${asset}`,
            category: this.categorizeRisk(threat),
            inherentRisk: {
              likelihood: inherentLikelihood,
              impact: inherentImpact,
              score: inherentScore,
            },
            residualRisk: {
              likelihood: residualLikelihood,
              impact: residualImpact,
              score: residualScore,
            },
            treatment,
            controls: applicableControls,
            owner: params.assessorId,
            reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Annual review
          };

          results.push(result);

          // Store in risk register
          this.risks.set(riskId, {
            id: riskId,
            category: result.category,
            title: result.title,
            description: `Risk scenario: ${threat} targeting ${asset} via ${vulnerability}`,
            likelihood: inherentLikelihood as 1 | 2 | 3 | 4 | 5,
            impact: inherentImpact as 1 | 2 | 3 | 4 | 5,
            inherentRiskScore: inherentScore,
            controls: applicableControls,
            residualLikelihood: residualLikelihood as 1 | 2 | 3 | 4 | 5,
            residualImpact: residualImpact as 1 | 2 | 3 | 4 | 5,
            residualRiskScore: residualScore,
            treatment,
            owner: params.assessorId,
            reviewDate: result.reviewDate,
            frameworks: ['iso27001'],
          });
        }
      }
    }

    // Log compliance activity
    await complianceAuditLogger.logComplianceActivity({
      activityType: 'risk_assessed',
      userId: params.assessorId,
      framework: 'iso27001',
      controlId: 'Clause 6.1.2',
      resourceId: assessmentId,
      details: {
        scope: params.scope,
        risksIdentified: results.length,
        highRisks: results.filter(r => r.residualRisk.score >= 15).length,
      },
    });

    return results;
  }

  /**
   * Get risk register
   */
  getRiskRegister(): ComplianceRisk[] {
    return Array.from(this.risks.values());
  }

  /**
   * Update risk treatment
   */
  async updateRiskTreatment(riskId: string, params: {
    treatment: RiskTreatment;
    controls: string[];
    justification: string;
    updatedBy: string;
  }): Promise<void> {
    const risk = this.risks.get(riskId);
    if (!risk) {
      throw new Error(`Risk not found: ${riskId}`);
    }

    risk.treatment = params.treatment;
    risk.controls = params.controls;

    await complianceAuditLogger.logConfigChange({
      userId: params.updatedBy,
      configType: 'policy',
      resourceId: riskId,
      changeType: 'update',
      previousValue: { treatment: risk.treatment },
      newValue: { treatment: params.treatment, controls: params.controls },
      reason: params.justification,
    });
  }

  // =============================================================================
  // Statement of Applicability - Clause 6.1.3(d)
  // =============================================================================

  /**
   * Get Statement of Applicability
   */
  getStatementOfApplicability(): StatementOfApplicability[] {
    return Array.from(this.soa.values());
  }

  /**
   * Update control applicability
   */
  async updateControlApplicability(controlId: string, params: {
    included: boolean;
    justification: string;
    implementationStatus: 'implemented' | 'planned' | 'not_applicable';
    updatedBy: string;
  }): Promise<void> {
    this.soa.set(controlId, {
      controlId,
      included: params.included,
      justification: params.justification,
      implementationStatus: params.implementationStatus,
    });

    await complianceAuditLogger.logConfigChange({
      userId: params.updatedBy,
      configType: 'policy',
      resourceId: controlId,
      changeType: 'update',
      newValue: params,
      reason: `SoA update: ${params.justification}`,
    });
  }

  // =============================================================================
  // Internal Audit - Clause 9.2
  // =============================================================================

  /**
   * Plan internal audit
   */
  async planInternalAudit(params: {
    auditId: string;
    scope: string[];
    auditor: string;
    scheduledDate: Date;
    criteria: string[];
  }): Promise<{
    auditPlan: {
      areas: string[];
      controlsToTest: string[];
      samplingApproach: string;
      timeline: { area: string; date: Date }[];
    };
  }> {
    const controlsToTest = params.scope.flatMap(area =>
      this.getControlsForArea(area)
    );

    const timeline = params.scope.map((area, index) => ({
      area,
      date: new Date(params.scheduledDate.getTime() + index * 24 * 60 * 60 * 1000),
    }));

    await complianceAuditLogger.logComplianceActivity({
      activityType: 'control_tested',
      userId: params.auditor,
      framework: 'iso27001',
      controlId: 'Clause 9.2',
      resourceId: params.auditId,
      details: {
        type: 'internal_audit_planned',
        scope: params.scope,
        controlCount: controlsToTest.length,
      },
    });

    return {
      auditPlan: {
        areas: params.scope,
        controlsToTest,
        samplingApproach: 'Risk-based sampling with minimum 10% coverage',
        timeline,
      },
    };
  }

  /**
   * Record audit finding
   */
  async recordAuditFinding(params: {
    auditId: string;
    controlId: string;
    findingType: 'nonconformity' | 'observation' | 'opportunity';
    severity: 'major' | 'minor';
    description: string;
    evidence: string;
    auditor: string;
  }): Promise<string> {
    const findingId = `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await complianceAuditLogger.logComplianceActivity({
      activityType: 'finding_created',
      userId: params.auditor,
      framework: 'iso27001',
      controlId: params.controlId,
      resourceId: findingId,
      details: {
        auditId: params.auditId,
        type: params.findingType,
        severity: params.severity,
        description: params.description,
      },
    });

    return findingId;
  }

  // =============================================================================
  // Management Review - Clause 9.3
  // =============================================================================

  /**
   * Generate management review input
   */
  generateManagementReviewInput(): {
    previousActions: string[];
    externalChanges: string[];
    performanceMetrics: Record<string, number>;
    auditResults: string[];
    nonconformities: string[];
    riskStatus: { high: number; medium: number; low: number };
    improvementOpportunities: string[];
  } {
    const risks = Array.from(this.risks.values());

    return {
      previousActions: [
        'Review status of actions from previous management review',
      ],
      externalChanges: [
        'Regulatory changes',
        'Industry developments',
        'Threat landscape evolution',
      ],
      performanceMetrics: {
        controlEffectiveness: 85,
        incidentResponseTime: 2.5,
        auditFindingsClosed: 92,
        trainingCompletion: 98,
      },
      auditResults: [
        'Internal audit completed Q3',
        '2 minor nonconformities identified',
        'All findings addressed within timeline',
      ],
      nonconformities: [
        'Access review documentation incomplete',
        'Backup testing overdue',
      ],
      riskStatus: {
        high: risks.filter(r => r.residualRiskScore >= 15).length,
        medium: risks.filter(r => r.residualRiskScore >= 8 && r.residualRiskScore < 15).length,
        low: risks.filter(r => r.residualRiskScore < 8).length,
      },
      improvementOpportunities: [
        'Automate access review process',
        'Enhance security awareness training',
        'Implement continuous control monitoring',
      ],
    };
  }

  // =============================================================================
  // ISO 27001:2022 Annex A Controls
  // =============================================================================

  /**
   * Get all ISO 27001:2022 Annex A controls
   */
  getISO27001Controls(): ISO27001Control[] {
    return [
      // A.5 Organizational Controls
      {
        controlId: 'A.5.1',
        annexA: 'organizational',
        title: 'Policies for information security',
        description: 'Information security policy and topic-specific policies',
        implementation: 'Documented policies reviewed annually',
        soa: 'included',
      },
      {
        controlId: 'A.5.2',
        annexA: 'organizational',
        title: 'Information security roles and responsibilities',
        description: 'Defined and allocated information security responsibilities',
        implementation: 'RACI matrix for security responsibilities',
        soa: 'included',
      },
      {
        controlId: 'A.5.3',
        annexA: 'organizational',
        title: 'Segregation of duties',
        description: 'Conflicting duties separated to reduce fraud/error',
        implementation: 'Role-based access with separation enforced',
        soa: 'included',
      },
      {
        controlId: 'A.5.7',
        annexA: 'organizational',
        title: 'Threat intelligence',
        description: 'Collect and analyze threat intelligence',
        implementation: 'Threat feeds integrated with SIEM',
        soa: 'included',
      },
      {
        controlId: 'A.5.8',
        annexA: 'organizational',
        title: 'Information security in project management',
        description: 'Security integrated into project methodology',
        implementation: 'Security checkpoints in SDLC',
        soa: 'included',
      },
      {
        controlId: 'A.5.9',
        annexA: 'organizational',
        title: 'Inventory of information and associated assets',
        description: 'Maintain inventory of information assets',
        implementation: 'Asset management system with classification',
        soa: 'included',
      },
      {
        controlId: 'A.5.10',
        annexA: 'organizational',
        title: 'Acceptable use of information and assets',
        description: 'Rules for acceptable use documented',
        implementation: 'Acceptable use policy signed by all users',
        soa: 'included',
      },
      {
        controlId: 'A.5.15',
        annexA: 'organizational',
        title: 'Access control',
        description: 'Rules to control access based on business needs',
        implementation: 'RBAC with least privilege principle',
        soa: 'included',
      },
      {
        controlId: 'A.5.17',
        annexA: 'organizational',
        title: 'Authentication information',
        description: 'Manage authentication credentials securely',
        implementation: 'Password policy, MFA enforcement',
        soa: 'included',
      },
      {
        controlId: 'A.5.18',
        annexA: 'organizational',
        title: 'Access rights',
        description: 'Provision, review, and remove access rights',
        implementation: 'Quarterly access reviews, automated provisioning',
        soa: 'included',
      },
      {
        controlId: 'A.5.23',
        annexA: 'organizational',
        title: 'Information security for cloud services',
        description: 'Manage security of cloud service usage',
        implementation: 'Cloud security assessment, shared responsibility model',
        soa: 'included',
      },
      {
        controlId: 'A.5.24',
        annexA: 'organizational',
        title: 'Information security incident management planning',
        description: 'Plan and prepare for incident management',
        implementation: 'Incident response plan, playbooks',
        soa: 'included',
      },
      {
        controlId: 'A.5.28',
        annexA: 'organizational',
        title: 'Collection of evidence',
        description: 'Procedures for evidence collection and preservation',
        implementation: 'Digital forensics procedures, chain of custody',
        soa: 'included',
      },
      {
        controlId: 'A.5.29',
        annexA: 'organizational',
        title: 'Information security during disruption',
        description: 'Maintain security during business disruption',
        implementation: 'BCP includes security requirements',
        soa: 'included',
      },
      {
        controlId: 'A.5.30',
        annexA: 'organizational',
        title: 'ICT readiness for business continuity',
        description: 'Plan ICT continuity requirements',
        implementation: 'DR testing, RTO/RPO defined',
        soa: 'included',
      },
      {
        controlId: 'A.5.31',
        annexA: 'organizational',
        title: 'Legal, statutory, regulatory requirements',
        description: 'Identify and comply with legal requirements',
        implementation: 'Compliance register maintained',
        soa: 'included',
      },
      {
        controlId: 'A.5.34',
        annexA: 'organizational',
        title: 'Privacy and protection of PII',
        description: 'Ensure privacy and protection of personal data',
        implementation: 'Privacy impact assessments, data minimization',
        soa: 'included',
      },
      {
        controlId: 'A.5.36',
        annexA: 'organizational',
        title: 'Compliance with policies and standards',
        description: 'Regular review of compliance',
        implementation: 'Automated compliance monitoring',
        soa: 'included',
      },

      // A.6 People Controls
      {
        controlId: 'A.6.1',
        annexA: 'people',
        title: 'Screening',
        description: 'Background verification checks',
        implementation: 'Pre-employment screening process',
        soa: 'included',
      },
      {
        controlId: 'A.6.3',
        annexA: 'people',
        title: 'Information security awareness, education and training',
        description: 'Security awareness program',
        implementation: 'Annual training, phishing simulations',
        soa: 'included',
      },
      {
        controlId: 'A.6.5',
        annexA: 'people',
        title: 'Responsibilities after termination or change',
        description: 'Define post-employment security responsibilities',
        implementation: 'Offboarding checklist, NDA enforcement',
        soa: 'included',
      },
      {
        controlId: 'A.6.7',
        annexA: 'people',
        title: 'Remote working',
        description: 'Security measures for remote work',
        implementation: 'VPN, endpoint protection, secure home working policy',
        soa: 'included',
      },
      {
        controlId: 'A.6.8',
        annexA: 'people',
        title: 'Information security event reporting',
        description: 'Mechanism for reporting security events',
        implementation: 'Incident reporting portal, hotline',
        soa: 'included',
      },

      // A.7 Physical Controls
      {
        controlId: 'A.7.1',
        annexA: 'physical',
        title: 'Physical security perimeters',
        description: 'Define and protect physical security perimeters',
        implementation: 'Access-controlled facilities',
        soa: 'included',
      },
      {
        controlId: 'A.7.4',
        annexA: 'physical',
        title: 'Physical security monitoring',
        description: 'Monitor premises for unauthorized access',
        implementation: 'CCTV, intrusion detection',
        soa: 'included',
      },
      {
        controlId: 'A.7.9',
        annexA: 'physical',
        title: 'Security of assets off-premises',
        description: 'Protect assets when off-site',
        implementation: 'Encryption, asset tracking',
        soa: 'included',
      },
      {
        controlId: 'A.7.10',
        annexA: 'physical',
        title: 'Storage media',
        description: 'Manage storage media throughout lifecycle',
        implementation: 'Media sanitization procedures',
        soa: 'included',
      },

      // A.8 Technological Controls
      {
        controlId: 'A.8.1',
        annexA: 'technological',
        title: 'User endpoint devices',
        description: 'Secure user endpoints',
        implementation: 'MDM, endpoint protection, patching',
        soa: 'included',
      },
      {
        controlId: 'A.8.2',
        annexA: 'technological',
        title: 'Privileged access rights',
        description: 'Restrict and manage privileged access',
        implementation: 'PAM solution, just-in-time access',
        soa: 'included',
      },
      {
        controlId: 'A.8.3',
        annexA: 'technological',
        title: 'Information access restriction',
        description: 'Restrict access based on policy',
        implementation: 'Access control lists, RBAC',
        soa: 'included',
      },
      {
        controlId: 'A.8.5',
        annexA: 'technological',
        title: 'Secure authentication',
        description: 'Implement secure authentication',
        implementation: 'MFA, strong password requirements',
        soa: 'included',
      },
      {
        controlId: 'A.8.7',
        annexA: 'technological',
        title: 'Protection against malware',
        description: 'Implement malware protection',
        implementation: 'EDR, anti-malware, sandboxing',
        soa: 'included',
      },
      {
        controlId: 'A.8.8',
        annexA: 'technological',
        title: 'Management of technical vulnerabilities',
        description: 'Identify and remediate vulnerabilities',
        implementation: 'Vulnerability scanning, patch management',
        soa: 'included',
      },
      {
        controlId: 'A.8.9',
        annexA: 'technological',
        title: 'Configuration management',
        description: 'Manage system configurations',
        implementation: 'Configuration baselines, drift detection',
        soa: 'included',
      },
      {
        controlId: 'A.8.12',
        annexA: 'technological',
        title: 'Data leakage prevention',
        description: 'Prevent unauthorized data disclosure',
        implementation: 'DLP tools, data classification',
        soa: 'included',
      },
      {
        controlId: 'A.8.15',
        annexA: 'technological',
        title: 'Logging',
        description: 'Log activities and events',
        implementation: 'Centralized logging, log retention',
        soa: 'included',
      },
      {
        controlId: 'A.8.16',
        annexA: 'technological',
        title: 'Monitoring activities',
        description: 'Monitor for anomalous activities',
        implementation: 'SIEM, behavioral analytics',
        soa: 'included',
      },
      {
        controlId: 'A.8.20',
        annexA: 'technological',
        title: 'Networks security',
        description: 'Protect network and network services',
        implementation: 'Firewalls, network segmentation',
        soa: 'included',
      },
      {
        controlId: 'A.8.21',
        annexA: 'technological',
        title: 'Security of network services',
        description: 'Identify and manage network service security',
        implementation: 'Service level agreements, network monitoring',
        soa: 'included',
      },
      {
        controlId: 'A.8.24',
        annexA: 'technological',
        title: 'Use of cryptography',
        description: 'Define rules for cryptographic use',
        implementation: 'Encryption standards, key management',
        soa: 'included',
      },
      {
        controlId: 'A.8.25',
        annexA: 'technological',
        title: 'Secure development lifecycle',
        description: 'Security throughout development',
        implementation: 'SAST, DAST, code review',
        soa: 'included',
      },
      {
        controlId: 'A.8.26',
        annexA: 'technological',
        title: 'Application security requirements',
        description: 'Define application security requirements',
        implementation: 'Security requirements in specifications',
        soa: 'included',
      },
      {
        controlId: 'A.8.28',
        annexA: 'technological',
        title: 'Secure coding',
        description: 'Apply secure coding principles',
        implementation: 'Secure coding standards, training',
        soa: 'included',
      },
      {
        controlId: 'A.8.32',
        annexA: 'technological',
        title: 'Change management',
        description: 'Manage changes to systems',
        implementation: 'Change advisory board, testing',
        soa: 'included',
      },
      {
        controlId: 'A.8.33',
        annexA: 'technological',
        title: 'Test information',
        description: 'Protect test data',
        implementation: 'Data masking, synthetic data',
        soa: 'included',
      },
      {
        controlId: 'A.8.34',
        annexA: 'technological',
        title: 'Protection of information systems during audit testing',
        description: 'Plan and agree audit tests',
        implementation: 'Audit coordination, testing windows',
        soa: 'included',
      },
    ];
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private initializeDefaultSoA(): void {
    const controls = this.getISO27001Controls();
    controls.forEach(control => {
      this.soa.set(control.controlId, {
        controlId: control.controlId,
        included: control.soa === 'included',
        justification: control.soa === 'included'
          ? 'Control addresses identified risks and regulatory requirements'
          : control.justification || 'Not applicable to scope',
        implementationStatus: 'implemented',
      });
    });
  }

  private assessLikelihood(threat: string, vulnerability: string): number {
    // Simplified likelihood assessment (1-5)
    const threatScores: Record<string, number> = {
      'malware': 4, 'phishing': 5, 'insider': 3, 'dos': 3,
      'data_breach': 3, 'ransomware': 4, 'supply_chain': 2,
    };
    const vulnScores: Record<string, number> = {
      'unpatched': 4, 'misconfigured': 3, 'weak_auth': 4,
      'no_encryption': 4, 'poor_training': 3, 'legacy_system': 3,
    };

    const threatScore = threatScores[threat.toLowerCase()] || 3;
    const vulnScore = vulnScores[vulnerability.toLowerCase()] || 3;

    return Math.min(5, Math.round((threatScore + vulnScore) / 2));
  }

  private assessImpact(asset: string): number {
    // Simplified impact assessment (1-5)
    const assetImpacts: Record<string, number> = {
      'customer_data': 5, 'phi': 5, 'financial_data': 5,
      'intellectual_property': 4, 'employee_data': 4,
      'operational_systems': 4, 'public_website': 3,
    };

    return assetImpacts[asset.toLowerCase()] || 3;
  }

  private identifyControls(threat: string, vulnerability: string): string[] {
    const controlMap: Record<string, string[]> = {
      'malware': ['A.8.7', 'A.8.1', 'A.6.3'],
      'phishing': ['A.6.3', 'A.8.5', 'A.5.7'],
      'unpatched': ['A.8.8', 'A.8.9', 'A.8.32'],
      'weak_auth': ['A.8.5', 'A.5.17', 'A.8.2'],
      'no_encryption': ['A.8.24', 'A.8.12'],
    };

    return [
      ...(controlMap[threat.toLowerCase()] || []),
      ...(controlMap[vulnerability.toLowerCase()] || []),
    ].filter((v, i, a) => a.indexOf(v) === i); // Unique values
  }

  private calculateControlEffectiveness(controls: string[]): number {
    // Each implemented control reduces likelihood by ~0.5
    return Math.min(3, controls.length * 0.5);
  }

  private determineTreatment(residualScore: number): RiskTreatment {
    if (residualScore >= 15) return 'mitigate';
    if (residualScore >= 8) return 'mitigate';
    if (residualScore >= 4) return 'accept';
    return 'accept';
  }

  private categorizeRisk(threat: string): RiskCategory {
    const categoryMap: Record<string, RiskCategory> = {
      'malware': 'security', 'phishing': 'security', 'ransomware': 'security',
      'insider': 'operational', 'dos': 'operational',
      'data_breach': 'compliance', 'privacy': 'compliance',
      'reputation': 'reputational', 'fraud': 'financial',
    };
    return categoryMap[threat.toLowerCase()] || 'security';
  }

  private getControlsForArea(area: string): string[] {
    const areaControls: Record<string, string[]> = {
      'access_control': ['A.5.15', 'A.5.17', 'A.5.18', 'A.8.2', 'A.8.3', 'A.8.5'],
      'cryptography': ['A.8.24'],
      'physical_security': ['A.7.1', 'A.7.4', 'A.7.9', 'A.7.10'],
      'operations': ['A.8.7', 'A.8.8', 'A.8.9', 'A.8.15', 'A.8.16', 'A.8.32'],
      'network': ['A.8.20', 'A.8.21'],
      'development': ['A.8.25', 'A.8.26', 'A.8.28'],
      'incident_management': ['A.5.24', 'A.5.28', 'A.6.8'],
      'business_continuity': ['A.5.29', 'A.5.30'],
      'compliance': ['A.5.31', 'A.5.34', 'A.5.36'],
    };
    return areaControls[area.toLowerCase()] || [];
  }
}

// Export singleton
export const iso27001Service = ISO27001ComplianceService.getInstance();
