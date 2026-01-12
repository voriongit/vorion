/**
 * HIPAA Compliance Service
 * Privacy Rule, Security Rule, Breach Notification
 */

import { complianceAuditLogger } from './audit-logger';
import type {
  PHIAccessLog,
  BreachRecord,
  BreachNotification,
  BreachSeverity,
  BusinessAssociateAgreement,
  HIPAAControl,
} from './types';

// =============================================================================
// HIPAA Service
// =============================================================================

export class HIPAAComplianceService {
  private static instance: HIPAAComplianceService;

  private constructor() {}

  static getInstance(): HIPAAComplianceService {
    if (!HIPAAComplianceService.instance) {
      HIPAAComplianceService.instance = new HIPAAComplianceService();
    }
    return HIPAAComplianceService.instance;
  }

  // =============================================================================
  // PHI Handling
  // =============================================================================

  /**
   * Validate PHI access request (minimum necessary standard)
   */
  async validatePHIAccess(params: {
    userId: string;
    agentId: string;
    phiType: string;
    purpose: 'treatment' | 'payment' | 'operations' | 'research' | 'other';
    requestedFields: string[];
  }): Promise<{
    approved: boolean;
    allowedFields: string[];
    deniedFields: string[];
    reason: string;
  }> {
    // Minimum necessary field restrictions by purpose
    const minimumNecessaryFields: Record<string, string[]> = {
      treatment: ['diagnosis', 'medications', 'allergies', 'vitals', 'history'],
      payment: ['procedure_codes', 'diagnosis_codes', 'service_dates', 'provider'],
      operations: ['aggregate_data', 'quality_metrics', 'utilization'],
      research: ['de_identified_data'],
      other: [], // Requires explicit authorization
    };

    const allowedFieldsForPurpose = minimumNecessaryFields[params.purpose] || [];

    const allowedFields = params.requestedFields.filter(f =>
      allowedFieldsForPurpose.includes(f) || f === 'patient_id_hash'
    );
    const deniedFields = params.requestedFields.filter(f =>
      !allowedFields.includes(f)
    );

    const approved = deniedFields.length === 0;

    // Log the access attempt
    await complianceAuditLogger.logPHIAccess({
      userId: params.userId,
      agentId: params.agentId,
      action: 'view',
      phiType: params.phiType,
      patientIdentifierHash: 'validation_check',
      purpose: params.purpose,
      authorized: approved,
      minimumNecessary: approved,
    });

    return {
      approved,
      allowedFields,
      deniedFields,
      reason: approved
        ? 'Access approved under minimum necessary standard'
        : `Requested fields exceed minimum necessary for ${params.purpose}: ${deniedFields.join(', ')}`,
    };
  }

  /**
   * De-identify PHI for research/analytics (Safe Harbor method)
   */
  deidentifyPHI(data: Record<string, unknown>): Record<string, unknown> {
    // HIPAA Safe Harbor: Remove 18 identifiers
    const identifiersToRemove = [
      'name', 'first_name', 'last_name', 'full_name',
      'address', 'street', 'city', 'zip', 'zip_code', 'postal_code',
      'date_of_birth', 'dob', 'birth_date', 'admission_date', 'discharge_date',
      'phone', 'phone_number', 'telephone', 'fax',
      'email', 'email_address',
      'ssn', 'social_security', 'social_security_number',
      'mrn', 'medical_record_number', 'patient_id',
      'health_plan_id', 'insurance_id', 'member_id',
      'account_number', 'certificate_number', 'license_number',
      'vin', 'vehicle_identifier', 'device_serial',
      'url', 'ip_address', 'ip',
      'biometric', 'fingerprint', 'face_image', 'photo',
    ];

    const deidentified: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Skip identifiers
      if (identifiersToRemove.some(id => lowerKey.includes(id))) {
        continue;
      }

      // Generalize ages over 89
      if (lowerKey.includes('age') && typeof value === 'number' && value > 89) {
        deidentified[key] = '90+';
        continue;
      }

      // Generalize dates to year only
      if (lowerKey.includes('date') && value instanceof Date) {
        deidentified[key] = (value as Date).getFullYear();
        continue;
      }

      // Generalize geographic to state level
      if (lowerKey === 'state') {
        deidentified[key] = value;
        continue;
      }

      deidentified[key] = value;
    }

    return deidentified;
  }

  /**
   * Check if data qualifies as de-identified under HIPAA
   */
  isDeidentified(data: Record<string, unknown>): {
    isDeidentified: boolean;
    identifiersFound: string[];
  } {
    const identifiers = [
      'name', 'address', 'date', 'phone', 'fax', 'email',
      'ssn', 'mrn', 'health_plan', 'account', 'certificate',
      'license', 'vehicle', 'device', 'url', 'ip', 'biometric',
    ];

    const identifiersFound: string[] = [];

    const checkValue = (key: string, value: unknown) => {
      const lowerKey = key.toLowerCase();

      for (const id of identifiers) {
        if (lowerKey.includes(id)) {
          identifiersFound.push(key);
          return;
        }
      }

      // Check for nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          checkValue(k, v);
        }
      }
    };

    for (const [key, value] of Object.entries(data)) {
      checkValue(key, value);
    }

    return {
      isDeidentified: identifiersFound.length === 0,
      identifiersFound,
    };
  }

  // =============================================================================
  // Breach Management
  // =============================================================================

  /**
   * Report a potential breach
   */
  async reportPotentialBreach(params: {
    reportedBy: string;
    description: string;
    discoveredAt: Date;
    affectedRecords?: number;
    phiTypes?: string[];
    systemsInvolved?: string[];
  }): Promise<BreachRecord> {
    const breachId = `breach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const breach: BreachRecord = {
      id: breachId,
      discoveredAt: params.discoveredAt,
      discoveredBy: params.reportedBy,
      severity: 'potential_breach',
      description: params.description,
      affectedRecords: params.affectedRecords || 0,
      phiInvolved: (params.phiTypes?.length || 0) > 0,
      notifications: [],
      containmentActions: [],
      eradicationActions: [],
      recoveryActions: [],
      status: 'investigating',
    };

    // Log security event
    await complianceAuditLogger.logSecurityEvent({
      eventType: 'breach_suspected',
      severity: 'critical',
      title: 'Potential PHI Breach Reported',
      description: params.description,
      affectedResources: params.systemsInvolved,
      indicators: {
        affectedRecords: params.affectedRecords,
        phiTypes: params.phiTypes,
      },
    });

    return breach;
  }

  /**
   * Perform HIPAA breach risk assessment
   */
  async assessBreachRisk(breachId: string, params: {
    assessedBy: string;
    natureAndExtent: string;
    unauthorizedPerson: string;
    wasAcquiredOrViewed: boolean;
    riskMitigated: boolean;
    mitigationDetails?: string;
  }): Promise<{
    breachId: string;
    isBreach: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    notificationRequired: boolean;
    reasoning: string;
  }> {
    // HIPAA breach presumption: breach occurred unless low probability
    // Factors: (1) nature/extent, (2) who received, (3) acquired/viewed, (4) risk mitigated

    let riskScore = 0;
    const factors: string[] = [];

    // Factor 1: Nature and extent
    if (params.natureAndExtent.toLowerCase().includes('ssn') ||
        params.natureAndExtent.toLowerCase().includes('diagnosis') ||
        params.natureAndExtent.toLowerCase().includes('treatment')) {
      riskScore += 3;
      factors.push('Sensitive PHI involved');
    } else {
      riskScore += 1;
      factors.push('Limited PHI sensitivity');
    }

    // Factor 2: Unauthorized person
    if (params.unauthorizedPerson.toLowerCase().includes('unknown') ||
        params.unauthorizedPerson.toLowerCase().includes('criminal')) {
      riskScore += 3;
      factors.push('Unknown or malicious actor');
    } else if (params.unauthorizedPerson.toLowerCase().includes('employee')) {
      riskScore += 2;
      factors.push('Unauthorized employee access');
    } else {
      riskScore += 1;
      factors.push('Identifiable recipient');
    }

    // Factor 3: Actually acquired or viewed
    if (params.wasAcquiredOrViewed) {
      riskScore += 3;
      factors.push('PHI confirmed accessed');
    } else {
      riskScore += 1;
      factors.push('No evidence of actual access');
    }

    // Factor 4: Risk mitigation
    if (params.riskMitigated) {
      riskScore -= 2;
      factors.push('Risk mitigation applied');
    }

    const riskLevel = riskScore <= 4 ? 'low' : riskScore <= 8 ? 'medium' : 'high';
    const isBreach = riskLevel !== 'low';
    const notificationRequired = isBreach;

    return {
      breachId,
      isBreach,
      riskLevel,
      notificationRequired,
      reasoning: `Risk score: ${riskScore}/12. Factors: ${factors.join('; ')}`,
    };
  }

  /**
   * Create breach notification
   */
  async createBreachNotification(params: {
    breachId: string;
    notificationType: 'individual' | 'hhs' | 'media' | 'business_associate';
    recipientCount: number;
    notifyBy: string;
  }): Promise<{
    notificationId: string;
    deadline: Date;
    template: string;
    requiredContent: string[];
  }> {
    const notificationId = `notif_${Date.now()}`;

    // HIPAA: 60 days from discovery for individuals
    // If >500 individuals in a state, media notification required
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 60);

    const requiredContent = [
      'Description of the breach',
      'Types of PHI involved',
      'Steps individuals should take to protect themselves',
      'What the entity is doing to investigate and mitigate',
      'Contact information for questions',
    ];

    if (params.notificationType === 'hhs') {
      requiredContent.push(
        'Number of individuals affected',
        'Actions taken in response',
      );
    }

    return {
      notificationId,
      deadline,
      template: this.getNotificationTemplate(params.notificationType),
      requiredContent,
    };
  }

  // =============================================================================
  // BAA Management
  // =============================================================================

  /**
   * Validate BAA requirements
   */
  validateBAA(baa: BusinessAssociateAgreement): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check required elements
    if (!baa.permittedUses.length) {
      issues.push('BAA must specify permitted uses and disclosures');
    }

    if (!baa.safeguardRequirements.length) {
      issues.push('BAA must require appropriate safeguards');
    }

    if (!baa.breachNotificationTerms) {
      issues.push('BAA must include breach notification requirements');
    }

    if (!baa.subcontractorTerms) {
      issues.push('BAA must address subcontractor requirements');
    }

    if (!baa.terminationTerms) {
      issues.push('BAA must specify termination provisions');
    }

    // Check expiration
    if (baa.expirationDate < new Date()) {
      issues.push('BAA has expired');
    } else if (baa.expirationDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
      recommendations.push('BAA expires within 90 days - initiate renewal');
    }

    // Check review date
    if (baa.nextReviewDate < new Date()) {
      recommendations.push('BAA review is overdue');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  // =============================================================================
  // HIPAA Controls
  // =============================================================================

  /**
   * Get HIPAA control requirements
   */
  getHIPAAControls(): HIPAAControl[] {
    return [
      // Administrative Safeguards
      {
        section: '164.308(a)(1)',
        rule: 'security',
        safeguard: 'administrative',
        standard: 'Security Management Process',
        implementation: 'Risk analysis, risk management, sanction policy, information system activity review',
        addressable: false,
        phiHandling: true,
      },
      {
        section: '164.308(a)(3)',
        rule: 'security',
        safeguard: 'administrative',
        standard: 'Workforce Security',
        implementation: 'Authorization and supervision, workforce clearance, termination procedures',
        addressable: true,
        phiHandling: true,
      },
      {
        section: '164.308(a)(4)',
        rule: 'security',
        safeguard: 'administrative',
        standard: 'Information Access Management',
        implementation: 'Access authorization, access establishment and modification',
        addressable: true,
        phiHandling: true,
      },
      {
        section: '164.308(a)(5)',
        rule: 'security',
        safeguard: 'administrative',
        standard: 'Security Awareness and Training',
        implementation: 'Security reminders, malicious software protection, log-in monitoring, password management',
        addressable: true,
        phiHandling: false,
      },
      {
        section: '164.308(a)(6)',
        rule: 'security',
        safeguard: 'administrative',
        standard: 'Security Incident Procedures',
        implementation: 'Response and reporting',
        addressable: false,
        phiHandling: true,
      },
      {
        section: '164.308(a)(7)',
        rule: 'security',
        safeguard: 'administrative',
        standard: 'Contingency Plan',
        implementation: 'Data backup, disaster recovery, emergency mode operation, testing and revision',
        addressable: true,
        phiHandling: true,
      },

      // Technical Safeguards
      {
        section: '164.312(a)(1)',
        rule: 'security',
        safeguard: 'technical',
        standard: 'Access Control',
        implementation: 'Unique user identification, emergency access, automatic logoff, encryption',
        addressable: true,
        phiHandling: true,
      },
      {
        section: '164.312(b)',
        rule: 'security',
        safeguard: 'technical',
        standard: 'Audit Controls',
        implementation: 'Hardware, software, procedural mechanisms to record and examine activity',
        addressable: false,
        phiHandling: true,
      },
      {
        section: '164.312(c)(1)',
        rule: 'security',
        safeguard: 'technical',
        standard: 'Integrity',
        implementation: 'Mechanism to authenticate ePHI',
        addressable: true,
        phiHandling: true,
      },
      {
        section: '164.312(d)',
        rule: 'security',
        safeguard: 'technical',
        standard: 'Person or Entity Authentication',
        implementation: 'Procedures to verify identity of persons seeking access',
        addressable: false,
        phiHandling: true,
      },
      {
        section: '164.312(e)(1)',
        rule: 'security',
        safeguard: 'technical',
        standard: 'Transmission Security',
        implementation: 'Integrity controls, encryption',
        addressable: true,
        phiHandling: true,
      },

      // Privacy Rule
      {
        section: '164.502(b)',
        rule: 'privacy',
        safeguard: 'administrative',
        standard: 'Minimum Necessary',
        implementation: 'Limit PHI to minimum necessary for intended purpose',
        addressable: false,
        phiHandling: true,
      },
      {
        section: '164.520',
        rule: 'privacy',
        safeguard: 'administrative',
        standard: 'Notice of Privacy Practices',
        implementation: 'Provide notice describing uses and disclosures',
        addressable: false,
        phiHandling: true,
      },
      {
        section: '164.524',
        rule: 'privacy',
        safeguard: 'administrative',
        standard: 'Access of Individuals',
        implementation: 'Right to access and obtain copy of PHI',
        addressable: false,
        phiHandling: true,
      },

      // Breach Notification
      {
        section: '164.400-414',
        rule: 'breach_notification',
        safeguard: 'administrative',
        standard: 'Breach Notification',
        implementation: 'Notify individuals, HHS, and media of breaches',
        addressable: false,
        phiHandling: true,
      },
    ];
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private getNotificationTemplate(type: 'individual' | 'hhs' | 'media' | 'business_associate'): string {
    const templates = {
      individual: `
NOTICE OF DATA BREACH

Dear [INDIVIDUAL_NAME],

We are writing to inform you of a security incident that may have affected your protected health information.

WHAT HAPPENED:
[DESCRIPTION_OF_BREACH]

WHAT INFORMATION WAS INVOLVED:
[TYPES_OF_PHI]

WHAT WE ARE DOING:
[MITIGATION_STEPS]

WHAT YOU CAN DO:
[RECOMMENDED_ACTIONS]

FOR MORE INFORMATION:
[CONTACT_INFORMATION]

Sincerely,
[ORGANIZATION_NAME]
      `,
      hhs: 'HHS Breach Report Form - Submit via HHS Portal',
      media: 'Press Release Template - For breaches affecting 500+ individuals in a state',
      business_associate: 'BA Notification - Per BAA terms',
    };

    return templates[type];
  }
}

// Export singleton
export const hipaaService = HIPAAComplianceService.getInstance();
