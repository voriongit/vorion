/**
 * Compliance Module Index
 * Unified exports for SOC 2, HIPAA, ISO 27001 compliance
 */

// Types
export * from './types';

// Audit Logger
export {
  ComplianceAuditLogger,
  complianceAuditLogger,
  type ComplianceAuditEvent,
  type ComplianceAuditEventType,
} from './audit-logger';

// Access Control
export {
  ComplianceAccessControl,
  complianceAccessControl,
  type AccessLevel,
  type ResourceType,
  type AccessRequest,
  type AccessDecision,
  type AccessPolicy,
  type AccessCondition,
} from './access-control';

// HIPAA Service
export {
  HIPAAComplianceService,
  hipaaService,
} from './hipaa-service';

// ISO 27001 Service
export {
  ISO27001ComplianceService,
  iso27001Service,
  type RiskAssessmentResult,
  type ISMSScope,
  type StatementOfApplicability,
} from './iso27001-service';

// =============================================================================
// Unified Compliance Service
// =============================================================================

import { complianceAuditLogger } from './audit-logger';
import { complianceAccessControl } from './access-control';
import { hipaaService } from './hipaa-service';
import { iso27001Service } from './iso27001-service';
import type {
  ComplianceFramework,
  ComplianceDashboard,
  ComplianceMetric,
  ComplianceAlert,
  FindingSeverity,
} from './types';

export class UnifiedComplianceService {
  private static instance: UnifiedComplianceService;

  private constructor() {}

  static getInstance(): UnifiedComplianceService {
    if (!UnifiedComplianceService.instance) {
      UnifiedComplianceService.instance = new UnifiedComplianceService();
    }
    return UnifiedComplianceService.instance;
  }

  // Accessors for individual services
  get audit() {
    return complianceAuditLogger;
  }

  get access() {
    return complianceAccessControl;
  }

  get hipaa() {
    return hipaaService;
  }

  get iso27001() {
    return iso27001Service;
  }

  /**
   * Get compliance dashboard data
   */
  async getDashboard(): Promise<ComplianceDashboard> {
    const risks = iso27001Service.getRiskRegister();
    const soa = iso27001Service.getStatementOfApplicability();

    // Calculate overall compliance score
    const implementedControls = soa.filter(s => s.implementationStatus === 'implemented').length;
    const totalControls = soa.length;
    const overallScore = Math.round((implementedControls / totalControls) * 100);

    // Framework-specific scores
    const soc2Controls = 50; // Simplified - would query actual control status
    const hipaaControls = hipaaService.getHIPAAControls();
    const isoControls = iso27001Service.getISO27001Controls();

    return {
      overallScore,
      frameworkScores: {
        soc2: 85,
        hipaa: 82,
        iso27001: Math.round((implementedControls / totalControls) * 100),
      },
      controlStats: {
        total: soa.length,
        compliant: soa.filter(s => s.implementationStatus === 'implemented').length,
        nonCompliant: soa.filter(s => s.implementationStatus === 'not_applicable' && s.included).length,
        partial: soa.filter(s => s.implementationStatus === 'planned').length,
        notApplicable: soa.filter(s => !s.included).length,
      },
      findingStats: {
        open: 2,
        inProgress: 1,
        overdue: 0,
        bySeverity: {
          critical: 0,
          high: 1,
          medium: 1,
          low: 1,
          informational: 0,
        },
      },
      riskStats: {
        total: risks.length,
        byCategory: {
          security: risks.filter(r => r.category === 'security').length,
          operational: risks.filter(r => r.category === 'operational').length,
          compliance: risks.filter(r => r.category === 'compliance').length,
          reputational: risks.filter(r => r.category === 'reputational').length,
          financial: risks.filter(r => r.category === 'financial').length,
        },
        highRisk: risks.filter(r => r.residualRiskScore >= 15).length,
        criticalRisk: risks.filter(r => r.residualRiskScore >= 20).length,
      },
      upcomingAudits: [],
      recentAlerts: [],
      lastUpdated: new Date(),
    };
  }

  /**
   * Get compliance metrics for monitoring
   */
  getMetrics(): ComplianceMetric[] {
    return [
      {
        id: 'metric_access_review',
        name: 'Access Review Completion',
        description: 'Percentage of user access reviews completed on time',
        framework: 'soc2',
        controlId: 'CC6.4',
        currentValue: 95,
        target: 100,
        threshold: 90,
        unit: '%',
        frequency: 'monthly',
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        id: 'metric_phi_access',
        name: 'PHI Access with Purpose',
        description: 'Percentage of PHI access requests with documented purpose',
        framework: 'hipaa',
        controlId: '164.502(b)',
        currentValue: 100,
        target: 100,
        threshold: 95,
        unit: '%',
        frequency: 'daily',
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        id: 'metric_mfa_adoption',
        name: 'MFA Adoption Rate',
        description: 'Percentage of users with MFA enabled',
        framework: 'iso27001',
        controlId: 'A.8.5',
        currentValue: 98,
        target: 100,
        threshold: 95,
        unit: '%',
        frequency: 'weekly',
        lastUpdated: new Date(),
        trend: 'improving',
      },
      {
        id: 'metric_vulnerability_remediation',
        name: 'Critical Vulnerability Remediation',
        description: 'Percentage of critical vulnerabilities remediated within SLA',
        framework: 'iso27001',
        controlId: 'A.8.8',
        currentValue: 92,
        target: 100,
        threshold: 85,
        unit: '%',
        frequency: 'weekly',
        lastUpdated: new Date(),
        trend: 'improving',
      },
      {
        id: 'metric_audit_log_integrity',
        name: 'Audit Log Integrity',
        description: 'Percentage of audit logs passing integrity verification',
        framework: 'soc2',
        controlId: 'CC7.2',
        currentValue: 100,
        target: 100,
        threshold: 99,
        unit: '%',
        frequency: 'daily',
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        id: 'metric_security_training',
        name: 'Security Training Completion',
        description: 'Percentage of employees who completed annual security training',
        framework: 'hipaa',
        controlId: '164.308(a)(5)',
        currentValue: 97,
        target: 100,
        threshold: 95,
        unit: '%',
        frequency: 'monthly',
        lastUpdated: new Date(),
        trend: 'stable',
      },
    ];
  }

  /**
   * Check compliance status across frameworks
   */
  async checkComplianceStatus(frameworks?: ComplianceFramework[]): Promise<{
    framework: ComplianceFramework;
    status: 'compliant' | 'non_compliant' | 'partial';
    score: number;
    findings: number;
    criticalIssues: string[];
  }[]> {
    const targetFrameworks = frameworks || ['soc2', 'hipaa', 'iso27001'];
    const results: {
      framework: ComplianceFramework;
      status: 'compliant' | 'non_compliant' | 'partial';
      score: number;
      findings: number;
      criticalIssues: string[];
    }[] = [];

    for (const framework of targetFrameworks) {
      // Simplified status check - in production, would aggregate from control testing
      const score = framework === 'soc2' ? 85 :
                    framework === 'hipaa' ? 82 :
                    framework === 'iso27001' ? 88 : 0;

      results.push({
        framework: framework as ComplianceFramework,
        status: score >= 80 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
        score,
        findings: Math.floor(Math.random() * 5),
        criticalIssues: [],
      });
    }

    return results;
  }

  /**
   * Generate compliance report
   */
  async generateReport(params: {
    framework: ComplianceFramework;
    reportType: 'summary' | 'detailed' | 'executive';
    startDate: Date;
    endDate: Date;
  }): Promise<{
    reportId: string;
    generatedAt: Date;
    framework: ComplianceFramework;
    type: string;
    content: Record<string, unknown>;
  }> {
    const reportId = `report_${Date.now()}`;

    // Log report generation
    await complianceAuditLogger.logComplianceActivity({
      activityType: 'evidence_collected',
      userId: 'system',
      framework: params.framework,
      resourceId: reportId,
      details: {
        reportType: params.reportType,
        dateRange: { start: params.startDate, end: params.endDate },
      },
    });

    const dashboard = await this.getDashboard();

    return {
      reportId,
      generatedAt: new Date(),
      framework: params.framework,
      type: params.reportType,
      content: {
        summary: {
          overallScore: dashboard.overallScore,
          frameworkScore: dashboard.frameworkScores[params.framework],
          controlStats: dashboard.controlStats,
          findingStats: dashboard.findingStats,
        },
        dateRange: {
          start: params.startDate,
          end: params.endDate,
        },
        generatedBy: 'AgentAnchorAI Compliance Module',
      },
    };
  }
}

// Export singleton
export const complianceService = UnifiedComplianceService.getInstance();
