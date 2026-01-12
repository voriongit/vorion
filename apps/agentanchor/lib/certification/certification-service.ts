/**
 * Certification Service
 * Core certification workflow and management
 *
 * Handles the end-to-end certification process from application to issuance.
 */

import type { CertificationTier, TierDefinition } from './certification-tiers';
import { CERTIFICATION_TIERS, checkTierRequirements, calculateCertificationPrice } from './certification-tiers';
import type { TestSuite, TestExecution, TestSummary } from './test-suites';
import { getSuitesForTier, createTestExecution, calculateSummary, getTestSuite } from './test-suites';
import { urls } from '@/lib/config';

// ============================================================================
// Types
// ============================================================================

export type CertificationStatus =
  | 'draft'           // Application started
  | 'submitted'       // Awaiting review
  | 'testing'         // Tests in progress
  | 'council_review'  // Awaiting Council
  | 'human_review'    // Awaiting human (Platinum)
  | 'approved'        // Certification approved
  | 'issued'          // Certificate issued
  | 'rejected'        // Certification denied
  | 'expired'         // Certification expired
  | 'revoked';        // Certification revoked

export interface CertificationApplication {
  id: string;
  agentId: string;
  agentName: string;
  trainerId: string;
  tier: CertificationTier;

  // Status tracking
  status: CertificationStatus;
  submittedAt?: Date;
  approvedAt?: Date;
  issuedAt?: Date;
  expiresAt?: Date;

  // Testing
  testExecutions: string[]; // Execution IDs
  testingSummary?: {
    totalSuites: number;
    completedSuites: number;
    passedSuites: number;
    failedSuites: number;
    overallPassRate: number;
  };

  // Review
  councilReviewId?: string;
  councilDecision?: 'approved' | 'denied';
  councilNotes?: string;
  humanReviewerId?: string;
  humanDecision?: 'approved' | 'denied';
  humanNotes?: string;

  // Pricing
  pricing: {
    basePrice: number;
    expeditedFee: number;
    additionalFees: number;
    totalPrice: number;
    paid: boolean;
    paymentId?: string;
  };

  // Certificate
  certificateId?: string;
  certificateUrl?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export interface Certificate {
  id: string;
  applicationId: string;
  agentId: string;
  agentName: string;
  trainerId: string;
  tier: CertificationTier;

  // Validity
  issuedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked';

  // Verification
  verificationCode: string;
  verificationUrl: string;
  truthChainHash?: string;

  // Details
  testingSummary: {
    totalTests: number;
    passedTests: number;
    passRate: number;
  };
  councilApproval?: boolean;
  humanApproval?: boolean;

  // Badge
  badgeUrl: string;
  badgeEmbedCode: string;
}

export interface RecertificationRequest {
  id: string;
  certificateId: string;
  agentId: string;
  requestedAt: Date;
  reason: 'expiration' | 'upgrade' | 'mandatory';
  newTier?: CertificationTier;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const applications = new Map<string, CertificationApplication>();
const certificates = new Map<string, Certificate>();
const recertRequests = new Map<string, RecertificationRequest>();
const testExecutions = new Map<string, TestExecution>();

// ============================================================================
// Application Management
// ============================================================================

/**
 * Create a new certification application
 */
export async function createApplication(
  agentId: string,
  agentName: string,
  trainerId: string,
  tier: CertificationTier,
  options?: {
    expedited?: boolean;
    notes?: string;
  }
): Promise<CertificationApplication> {
  // Calculate pricing
  const pricing = calculateCertificationPrice(tier, {
    expedited: options?.expedited,
  });

  const application: CertificationApplication = {
    id: `cert-app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    agentName,
    trainerId,
    tier,
    status: 'draft',
    testExecutions: [],
    pricing: {
      basePrice: pricing.basePrice,
      expeditedFee: pricing.expeditedFee,
      additionalFees: pricing.additionalTestsFee + pricing.customTestsFee,
      totalPrice: pricing.totalPrice,
      paid: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: options?.notes,
  };

  applications.set(application.id, application);
  return application;
}

/**
 * Submit application for processing
 */
export async function submitApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, error: 'Application not found' };
  }

  if (app.status !== 'draft') {
    return { success: false, error: 'Application already submitted' };
  }

  if (!app.pricing.paid) {
    return { success: false, error: 'Payment required before submission' };
  }

  app.status = 'submitted';
  app.submittedAt = new Date();
  app.updatedAt = new Date();
  applications.set(applicationId, app);

  // Trigger testing phase
  await startTesting(applicationId);

  return { success: true };
}

/**
 * Mark application as paid
 */
export function markApplicationPaid(
  applicationId: string,
  paymentId: string
): { success: boolean; error?: string } {
  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, error: 'Application not found' };
  }

  app.pricing.paid = true;
  app.pricing.paymentId = paymentId;
  app.updatedAt = new Date();
  applications.set(applicationId, app);

  return { success: true };
}

// ============================================================================
// Testing Phase
// ============================================================================

/**
 * Start automated testing for an application
 */
export async function startTesting(
  applicationId: string
): Promise<{ success: boolean; executionIds: string[] }> {
  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, executionIds: [] };
  }

  app.status = 'testing';
  app.updatedAt = new Date();

  // Get required test suites for this tier
  const suites = getSuitesForTier(app.tier);
  const executionIds: string[] = [];

  for (const suite of suites) {
    const execution = createTestExecution(suite.id, app.agentId);
    execution.status = 'pending';
    testExecutions.set(execution.id, execution);
    executionIds.push(execution.id);
  }

  app.testExecutions = executionIds;
  app.testingSummary = {
    totalSuites: suites.length,
    completedSuites: 0,
    passedSuites: 0,
    failedSuites: 0,
    overallPassRate: 0,
  };

  applications.set(applicationId, app);

  return { success: true, executionIds };
}

/**
 * Record test execution results
 */
export function recordTestResults(
  executionId: string,
  results: TestExecution['results']
): { success: boolean; summary?: TestSummary } {
  const execution = testExecutions.get(executionId);
  if (!execution) {
    return { success: false };
  }

  const suite = getTestSuite(execution.suiteId);
  if (!suite) {
    return { success: false };
  }

  execution.results = results;
  execution.status = 'completed';
  execution.completedAt = new Date();
  execution.summary = calculateSummary(results, suite);

  testExecutions.set(executionId, execution);

  // Update application testing summary
  updateApplicationTestingSummary(execution);

  return { success: true, summary: execution.summary };
}

/**
 * Update application testing summary after test completion
 */
function updateApplicationTestingSummary(execution: TestExecution): void {
  // Find the application containing this execution
  for (const [appId, app] of applications) {
    if (app.testExecutions.includes(execution.id)) {
      // Recalculate summary
      let completedSuites = 0;
      let passedSuites = 0;
      let failedSuites = 0;
      let totalPassRate = 0;

      for (const execId of app.testExecutions) {
        const exec = testExecutions.get(execId);
        if (exec && exec.status === 'completed') {
          completedSuites++;
          if (exec.summary.passed_threshold) {
            passedSuites++;
          } else {
            failedSuites++;
          }
          totalPassRate += exec.summary.passRate;
        }
      }

      app.testingSummary = {
        totalSuites: app.testExecutions.length,
        completedSuites,
        passedSuites,
        failedSuites,
        overallPassRate: completedSuites > 0 ? totalPassRate / completedSuites : 0,
      };

      // Check if all testing complete
      if (completedSuites === app.testExecutions.length) {
        if (failedSuites === 0) {
          // All passed, move to council review
          advanceToReview(appId);
        } else {
          // Failed testing
          app.status = 'rejected';
          app.notes = `Failed ${failedSuites} test suite(s)`;
        }
      }

      app.updatedAt = new Date();
      applications.set(appId, app);
      break;
    }
  }
}

/**
 * Advance application to review phase
 */
async function advanceToReview(applicationId: string): Promise<void> {
  const app = applications.get(applicationId);
  if (!app) return;

  const tierDef = CERTIFICATION_TIERS[app.tier];

  if (tierDef.requirements.councilReview === 'none') {
    // No review needed, approve directly
    app.status = 'approved';
    app.approvedAt = new Date();
  } else if (tierDef.requirements.councilReview === 'council-plus-human') {
    // Needs both council and human review
    app.status = 'council_review';
  } else {
    // Council review only
    app.status = 'council_review';
  }

  app.updatedAt = new Date();
  applications.set(applicationId, app);
}

// ============================================================================
// Review Phase
// ============================================================================

/**
 * Record council review decision
 */
export async function recordCouncilReview(
  applicationId: string,
  decision: 'approved' | 'denied',
  reviewId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, error: 'Application not found' };
  }

  if (app.status !== 'council_review') {
    return { success: false, error: 'Application not in council review' };
  }

  app.councilReviewId = reviewId;
  app.councilDecision = decision;
  app.councilNotes = notes;
  app.updatedAt = new Date();

  if (decision === 'denied') {
    app.status = 'rejected';
    app.notes = notes || 'Council review denied';
  } else {
    const tierDef = CERTIFICATION_TIERS[app.tier];
    if (tierDef.requirements.councilReview === 'council-plus-human') {
      app.status = 'human_review';
    } else {
      app.status = 'approved';
      app.approvedAt = new Date();
    }
  }

  applications.set(applicationId, app);
  return { success: true };
}

/**
 * Record human review decision (Platinum tier)
 */
export async function recordHumanReview(
  applicationId: string,
  decision: 'approved' | 'denied',
  reviewerId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, error: 'Application not found' };
  }

  if (app.status !== 'human_review') {
    return { success: false, error: 'Application not in human review' };
  }

  app.humanReviewerId = reviewerId;
  app.humanDecision = decision;
  app.humanNotes = notes;
  app.updatedAt = new Date();

  if (decision === 'denied') {
    app.status = 'rejected';
    app.notes = notes || 'Human review denied';
  } else {
    app.status = 'approved';
    app.approvedAt = new Date();
  }

  applications.set(applicationId, app);
  return { success: true };
}

// ============================================================================
// Certificate Issuance
// ============================================================================

/**
 * Issue certificate for approved application
 */
export async function issueCertificate(
  applicationId: string
): Promise<{ success: boolean; certificate?: Certificate; error?: string }> {
  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, error: 'Application not found' };
  }

  if (app.status !== 'approved') {
    return { success: false, error: 'Application not approved' };
  }

  const tierDef = CERTIFICATION_TIERS[app.tier];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + tierDef.validity.durationDays * 24 * 60 * 60 * 1000);

  // Generate verification code
  const verificationCode = generateVerificationCode(app.agentId, app.tier);

  // Calculate test summary from executions
  let totalTests = 0;
  let passedTests = 0;
  for (const execId of app.testExecutions) {
    const exec = testExecutions.get(execId);
    if (exec) {
      totalTests += exec.summary.total;
      passedTests += exec.summary.passed;
    }
  }

  const certificate: Certificate = {
    id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    applicationId,
    agentId: app.agentId,
    agentName: app.agentName,
    trainerId: app.trainerId,
    tier: app.tier,
    issuedAt: now,
    expiresAt,
    status: 'active',
    verificationCode,
    verificationUrl: `${urls.verify}/${verificationCode}`,
    testingSummary: {
      totalTests,
      passedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
    },
    councilApproval: app.councilDecision === 'approved',
    humanApproval: app.humanDecision === 'approved',
    badgeUrl: `${urls.badges}/${app.tier}/${verificationCode}.svg`,
    badgeEmbedCode: generateBadgeEmbed(app.tier, verificationCode),
  };

  certificates.set(certificate.id, certificate);

  // Update application
  app.status = 'issued';
  app.issuedAt = now;
  app.expiresAt = expiresAt;
  app.certificateId = certificate.id;
  app.certificateUrl = certificate.verificationUrl;
  app.updatedAt = new Date();
  applications.set(applicationId, app);

  return { success: true, certificate };
}

/**
 * Generate verification code
 */
function generateVerificationCode(agentId: string, tier: CertificationTier): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `A3I-${tier.toUpperCase()}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate badge embed code
 */
function generateBadgeEmbed(tier: CertificationTier, verificationCode: string): string {
  return `<a href="${urls.verify}/${verificationCode}" target="_blank">
  <img src="${urls.badges}/${tier}/${verificationCode}.svg"
       alt="A3I ${tier.charAt(0).toUpperCase() + tier.slice(1)} Certified"
       width="120" height="120" />
</a>`;
}

// ============================================================================
// Certificate Management
// ============================================================================

/**
 * Verify a certificate by code
 */
export function verifyCertificate(verificationCode: string): {
  valid: boolean;
  certificate?: Certificate;
  tierInfo?: TierDefinition;
  error?: string;
} {
  // Find certificate by verification code
  for (const cert of certificates.values()) {
    if (cert.verificationCode === verificationCode) {
      if (cert.status === 'revoked') {
        return { valid: false, error: 'Certificate has been revoked' };
      }
      if (cert.status === 'expired' || new Date() > cert.expiresAt) {
        cert.status = 'expired';
        return { valid: false, error: 'Certificate has expired', certificate: cert };
      }
      return {
        valid: true,
        certificate: cert,
        tierInfo: CERTIFICATION_TIERS[cert.tier],
      };
    }
  }
  return { valid: false, error: 'Certificate not found' };
}

/**
 * Revoke a certificate
 */
export function revokeCertificate(
  certificateId: string,
  reason: string
): { success: boolean; error?: string } {
  const cert = certificates.get(certificateId);
  if (!cert) {
    return { success: false, error: 'Certificate not found' };
  }

  cert.status = 'revoked';
  certificates.set(certificateId, cert);

  return { success: true };
}

/**
 * Get certificate by ID
 */
export function getCertificate(certificateId: string): Certificate | null {
  return certificates.get(certificateId) || null;
}

/**
 * Get certificates for an agent
 */
export function getAgentCertificates(agentId: string): Certificate[] {
  const result: Certificate[] = [];
  for (const cert of certificates.values()) {
    if (cert.agentId === agentId) {
      result.push(cert);
    }
  }
  return result.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}

/**
 * Get active certificate for an agent
 */
export function getActiveCertificate(agentId: string): Certificate | null {
  for (const cert of certificates.values()) {
    if (cert.agentId === agentId && cert.status === 'active') {
      // Check expiration
      if (new Date() > cert.expiresAt) {
        cert.status = 'expired';
        certificates.set(cert.id, cert);
        continue;
      }
      return cert;
    }
  }
  return null;
}

// ============================================================================
// Recertification (Story 18-5)
// ============================================================================

/**
 * Request recertification
 */
export function requestRecertification(
  certificateId: string,
  reason: RecertificationRequest['reason'],
  newTier?: CertificationTier
): { success: boolean; requestId?: string; error?: string } {
  const cert = certificates.get(certificateId);
  if (!cert) {
    return { success: false, error: 'Certificate not found' };
  }

  const request: RecertificationRequest = {
    id: `recert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    certificateId,
    agentId: cert.agentId,
    requestedAt: new Date(),
    reason,
    newTier,
    status: 'pending',
  };

  recertRequests.set(request.id, request);
  return { success: true, requestId: request.id };
}

/**
 * Get pending recertification requests
 */
export function getPendingRecertifications(): RecertificationRequest[] {
  const pending: RecertificationRequest[] = [];
  for (const req of recertRequests.values()) {
    if (req.status === 'pending') {
      pending.push(req);
    }
  }
  return pending;
}

/**
 * Check certificates approaching expiration
 */
export function getExpiringCertificates(withinDays: number = 30): Certificate[] {
  const expiring: Certificate[] = [];
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

  for (const cert of certificates.values()) {
    if (cert.status === 'active' && cert.expiresAt < cutoff) {
      expiring.push(cert);
    }
  }

  return expiring.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get application by ID
 */
export function getApplication(applicationId: string): CertificationApplication | null {
  return applications.get(applicationId) || null;
}

/**
 * Get applications for a trainer
 */
export function getTrainerApplications(trainerId: string): CertificationApplication[] {
  const result: CertificationApplication[] = [];
  for (const app of applications.values()) {
    if (app.trainerId === trainerId) {
      result.push(app);
    }
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get applications by status
 */
export function getApplicationsByStatus(
  status: CertificationStatus
): CertificationApplication[] {
  const result: CertificationApplication[] = [];
  for (const app of applications.values()) {
    if (app.status === status) {
      result.push(app);
    }
  }
  return result;
}

/**
 * Get certification statistics
 */
export function getCertificationStats(): {
  totalApplications: number;
  byStatus: Record<CertificationStatus, number>;
  byTier: Record<CertificationTier, number>;
  activeCertificates: number;
  averagePassRate: number;
} {
  const stats = {
    totalApplications: applications.size,
    byStatus: {} as Record<CertificationStatus, number>,
    byTier: {} as Record<CertificationTier, number>,
    activeCertificates: 0,
    averagePassRate: 0,
  };

  // Initialize counters
  const statuses: CertificationStatus[] = [
    'draft', 'submitted', 'testing', 'council_review',
    'human_review', 'approved', 'issued', 'rejected', 'expired', 'revoked'
  ];
  for (const s of statuses) stats.byStatus[s] = 0;

  const tiers: CertificationTier[] = ['bronze', 'silver', 'gold', 'platinum'];
  for (const t of tiers) stats.byTier[t] = 0;

  let totalPassRate = 0;
  let passRateCount = 0;

  for (const app of applications.values()) {
    stats.byStatus[app.status]++;
    stats.byTier[app.tier]++;
    if (app.testingSummary?.overallPassRate) {
      totalPassRate += app.testingSummary.overallPassRate;
      passRateCount++;
    }
  }

  for (const cert of certificates.values()) {
    if (cert.status === 'active') {
      stats.activeCertificates++;
    }
  }

  stats.averagePassRate = passRateCount > 0 ? totalPassRate / passRateCount : 0;

  return stats;
}

// ============================================================================
// Clear Data (Testing)
// ============================================================================

export function clearCertificationData(): void {
  applications.clear();
  certificates.clear();
  recertRequests.clear();
  testExecutions.clear();
}
