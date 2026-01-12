/**
 * Trust Bridge - Submission Module
 *
 * Handles external agent submission for certification
 * Uses Drizzle ORM with Neon PostgreSQL
 */

import { eq, lt, count, sql } from 'drizzle-orm'
import { db, isDatabaseConfigured } from '@/lib/db'
import { trustBridgeSubmissions } from '@/lib/db/schema'
import type {
  AgentSubmission,
  CertificationRequest,
  SubmissionStatus,
  RiskCategory,
} from './types'
import { urls } from '@/lib/config'

// In-memory fallback for when database is not available
const memoryQueue: Map<string, CertificationRequest> = new Map()

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateSubmission(
  submission: Partial<AgentSubmission>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!submission.name || submission.name.length < 2) {
    errors.push('Agent name is required (min 2 characters)')
  }
  if (!submission.description || submission.description.length < 10) {
    errors.push('Description is required (min 10 characters)')
  }
  if (!submission.version) {
    errors.push('Version is required')
  }
  if (!submission.origin_platform) {
    errors.push('Origin platform is required')
  }
  if (!submission.capabilities || submission.capabilities.length === 0) {
    errors.push('At least one capability is required')
  }
  if (!submission.risk_category) {
    errors.push('Risk category is required')
  }
  if (!submission.submitter_id) {
    errors.push('Submitter ID is required')
  }
  if (!submission.contact_email || !isValidEmail(submission.contact_email)) {
    errors.push('Valid contact email is required')
  }

  // Validate risk category
  const validRiskCategories: RiskCategory[] = ['low', 'medium', 'high', 'critical']
  if (
    submission.risk_category &&
    !validRiskCategories.includes(submission.risk_category)
  ) {
    errors.push(
      `Invalid risk category. Must be one of: ${validRiskCategories.join(', ')}`
    )
  }

  // Warnings
  if (!submission.test_endpoint) {
    warnings.push(
      'No test endpoint provided - only static analysis will be possible'
    )
  }
  if (submission.risk_category === 'critical' && !submission.organization) {
    warnings.push('Critical risk agents should have an organization specified')
  }
  if (
    submission.test_credentials?.type !== 'none' &&
    !submission.test_credentials?.value
  ) {
    warnings.push('Test credentials type specified but no value provided')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ============================================================================
// Submission
// ============================================================================

export interface SubmitResult {
  success: boolean
  tracking_id?: string
  queue_position?: number
  estimated_wait_minutes?: number
  errors?: string[]
  warnings?: string[]
}

export async function submitAgent(
  submission: AgentSubmission
): Promise<SubmitResult> {
  // Validate
  const validation = validateSubmission(submission)
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    }
  }

  // Generate tracking ID
  const trackingId = generateTrackingId(submission.origin_platform)

  // Create certification request
  const request: CertificationRequest = {
    id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tracking_id: trackingId,
    submission,
    status: 'pending',
    submitted_at: new Date(),
    council_reviewed: false,
  }

  // Store in database or memory
  let queuePosition = 1

  if (isDatabaseConfigured()) {
    try {
      // Insert into database
      await db.insert(trustBridgeSubmissions).values({
        trackingId: request.tracking_id,
        submission: {
          name: submission.name,
          description: submission.description,
          version: submission.version,
          origin_platform: submission.origin_platform,
          capabilities: submission.capabilities,
          risk_category: submission.risk_category,
          contact_email: submission.contact_email,
          model_provider: submission.model_provider,
          model_identifier: submission.model_identifier,
          system_prompt_hash: submission.system_prompt_hash,
          organization: submission.organization,
          repository_url: submission.repository_url,
          documentation_url: submission.documentation_url,
          safety_documentation: submission.safety_documentation,
          previous_certifications: submission.previous_certifications,
        },
        status: 'pending',
        submittedAt: request.submitted_at,
        councilReviewed: false,
        submitterId: submission.submitter_id,
        submitterTier: 'free',
      })

      // Get queue position
      const [{ value: pendingCount }] = await db
        .select({ value: count() })
        .from(trustBridgeSubmissions)
        .where(eq(trustBridgeSubmissions.status, 'pending'))

      queuePosition = pendingCount || 1
    } catch (err) {
      console.warn(
        '[Trust Bridge] Database insert failed, using memory:',
        err instanceof Error ? err.message : err
      )
      memoryQueue.set(trackingId, request)
      queuePosition = memoryQueue.size
    }
  } else {
    memoryQueue.set(trackingId, request)
    queuePosition = memoryQueue.size
  }

  // Calculate estimated wait (5 min per low-risk, 15 min per high-risk ahead)
  const estimatedWait = calculateEstimatedWait(
    queuePosition,
    submission.risk_category
  )

  return {
    success: true,
    tracking_id: trackingId,
    queue_position: queuePosition,
    estimated_wait_minutes: estimatedWait,
    warnings: validation.warnings,
  }
}

// ============================================================================
// Status Tracking
// ============================================================================

export interface StatusResult {
  found: boolean
  request?: CertificationRequest
  queue_position?: number
  estimated_wait_minutes?: number
}

export async function getSubmissionStatus(
  trackingId: string
): Promise<StatusResult> {
  // Try database first
  if (isDatabaseConfigured()) {
    try {
      const [data] = await db
        .select()
        .from(trustBridgeSubmissions)
        .where(eq(trustBridgeSubmissions.trackingId, trackingId))
        .limit(1)

      if (data) {
        const request = mapDbToRequest(data)

        // Get queue position if pending
        let queuePosition: number | undefined
        if (request.status === 'pending') {
          const [{ value: aheadCount }] = await db
            .select({ value: count() })
            .from(trustBridgeSubmissions)
            .where(eq(trustBridgeSubmissions.status, 'pending'))

          queuePosition = (aheadCount || 0)
        }

        return {
          found: true,
          request,
          queue_position: queuePosition,
          estimated_wait_minutes: queuePosition
            ? calculateEstimatedWait(
                queuePosition,
                request.submission.risk_category
              )
            : undefined,
        }
      }
    } catch (err) {
      console.warn('[Trust Bridge] Database query failed:', err)
      // Fall through to memory
    }
  }

  // Check memory fallback
  const request = memoryQueue.get(trackingId)
  if (request) {
    const queuePosition =
      Array.from(memoryQueue.keys()).indexOf(trackingId) + 1
    return {
      found: true,
      request,
      queue_position: request.status === 'pending' ? queuePosition : undefined,
      estimated_wait_minutes:
        request.status === 'pending'
          ? calculateEstimatedWait(
              queuePosition,
              request.submission.risk_category
            )
          : undefined,
    }
  }

  return { found: false }
}

// ============================================================================
// Cancellation
// ============================================================================

export interface CancelResult {
  success: boolean
  error?: string
}

export async function cancelSubmission(
  trackingId: string,
  submitterId: string
): Promise<CancelResult> {
  // Get current status
  const status = await getSubmissionStatus(trackingId)

  if (!status.found) {
    return { success: false, error: 'Submission not found' }
  }

  if (status.request!.submission.submitter_id !== submitterId) {
    return { success: false, error: 'Unauthorized - not the submitter' }
  }

  if (status.request!.status !== 'pending') {
    return {
      success: false,
      error: `Cannot cancel submission in '${status.request!.status}' status`,
    }
  }

  // Update status
  if (isDatabaseConfigured()) {
    try {
      await db
        .update(trustBridgeSubmissions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(trustBridgeSubmissions.trackingId, trackingId))
    } catch (err) {
      console.warn('[Trust Bridge] Database update failed')
    }
  }

  // Update memory
  const memRequest = memoryQueue.get(trackingId)
  if (memRequest) {
    memRequest.status = 'expired'
  }

  return { success: true }
}

// ============================================================================
// Queue Access (for certification runner)
// ============================================================================

export async function getPendingSubmissions(
  limit: number = 10
): Promise<CertificationRequest[]> {
  if (isDatabaseConfigured()) {
    try {
      const rows = await db
        .select()
        .from(trustBridgeSubmissions)
        .where(eq(trustBridgeSubmissions.status, 'pending'))
        .orderBy(trustBridgeSubmissions.submittedAt)
        .limit(limit)

      return rows.map(mapDbToRequest)
    } catch (err) {
      console.warn('[Trust Bridge] Failed to fetch pending submissions:', err)
    }
  }

  // Fallback to memory
  return Array.from(memoryQueue.values())
    .filter((r) => r.status === 'pending')
    .slice(0, limit)
}

// Type for database-friendly test results
interface DbTestResults {
  session_id: string
  total_score: number
  tests_passed: number
  tests_total: number
  category_scores: Record<string, number>
  flags: string[]
  recommendations: string[]
  duration_ms: number
}

// Type for database-friendly certification
interface DbCertification {
  tier: string
  trust_score: number
  credential_token: string
  valid_until: string
  council_reviewed: boolean
}

export async function updateSubmissionStatus(
  trackingId: string,
  status: SubmissionStatus,
  updates: Partial<{
    testResults: CertificationRequest['test_results']
    certification: DbCertification
    councilReviewed: boolean
    startedAt: Date
    completedAt: Date
  }>
): Promise<boolean> {
  if (isDatabaseConfigured()) {
    try {
      // Transform test results to DB format
      const dbTestResults: DbTestResults | undefined = updates.testResults
        ? {
            session_id: updates.testResults.session_id,
            total_score: updates.testResults.total_score,
            tests_passed: updates.testResults.tests_passed,
            tests_total: updates.testResults.tests_total,
            category_scores: updates.testResults.category_scores.reduce(
              (acc, cs) => ({ ...acc, [cs.category]: cs.weighted_score }),
              {} as Record<string, number>
            ),
            flags: updates.testResults.test_details
              .filter((td) => td.flags && td.flags.length > 0)
              .flatMap((td) => td.flags || []),
            recommendations: [],
            duration_ms: updates.testResults.duration_ms,
          }
        : undefined

      await db
        .update(trustBridgeSubmissions)
        .set({
          status,
          testResults: dbTestResults,
          certification: updates.certification,
          councilReviewed: updates.councilReviewed,
          startedAt: updates.startedAt,
          completedAt: updates.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(trustBridgeSubmissions.trackingId, trackingId))
      return true
    } catch (err) {
      console.warn('[Trust Bridge] Failed to update submission:', err)
    }
  }

  // Update memory fallback
  const request = memoryQueue.get(trackingId)
  if (request) {
    request.status = status
    if (updates.testResults) request.test_results = updates.testResults
    if (updates.certification) {
      // Convert DbCertification to TrustBridgeCredential for memory storage
      request.certification = {
        token: updates.certification.credential_token,
        payload: {} as any, // Simplified for memory storage
        issued_at: new Date(),
        expires_at: new Date(updates.certification.valid_until),
      }
    }
    if (updates.councilReviewed !== undefined)
      request.council_reviewed = updates.councilReviewed
    if (updates.startedAt) request.started_at = updates.startedAt
    if (updates.completedAt) request.completed_at = updates.completedAt
    return true
  }

  return false
}

// ============================================================================
// Helpers
// ============================================================================

function generateTrackingId(platform: string): string {
  const platformCode = platform.substring(0, 3).toUpperCase()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TB-${platformCode}-${timestamp}-${random}`
}

function calculateEstimatedWait(
  position: number,
  riskCategory: RiskCategory
): number {
  // Base wait per position based on risk
  const baseMinutes: Record<RiskCategory, number> = {
    low: 5,
    medium: 10,
    high: 15,
    critical: 20,
  }

  return position * baseMinutes[riskCategory]
}

function mapDbToRequest(
  data: typeof trustBridgeSubmissions.$inferSelect
): CertificationRequest {
  const submission = data.submission as AgentSubmission & {
    submitter_id?: string
  }

  // Convert DB test results to application format
  const dbTestResults = data.testResults as DbTestResults | null
  let testResults: CertificationRequest['test_results'] | undefined
  if (dbTestResults) {
    testResults = {
      session_id: dbTestResults.session_id,
      total_score: dbTestResults.total_score,
      tests_passed: dbTestResults.tests_passed,
      tests_failed:
        dbTestResults.tests_total - dbTestResults.tests_passed,
      tests_total: dbTestResults.tests_total,
      category_scores: Object.entries(dbTestResults.category_scores).map(
        ([category, score]) => ({
          category,
          weight: 20, // Default weight
          score: score,
          weighted_score: score,
          tests_passed: 0,
          tests_total: 0,
        })
      ),
      test_details: [],
      started_at: data.startedAt || new Date(),
      completed_at: data.completedAt || new Date(),
      duration_ms: dbTestResults.duration_ms,
    }
  }

  // Convert DB certification to application format
  const dbCert = data.certification as DbCertification | null
  let certification: CertificationRequest['certification'] | undefined
  if (dbCert) {
    certification = {
      token: dbCert.credential_token,
      payload: {
        iss: urls.apiIssuer,
        sub: '',
        aud: ['*'],
        iat: 0,
        exp: 0,
        a3i: {
          type: 'trust_bridge',
          trust_score: dbCert.trust_score,
          tier: dbCert.tier as any,
          origin_platform: submission.origin_platform,
          capabilities: submission.capabilities,
          risk_level: submission.risk_category,
          certification_date: '',
          tests_passed: testResults?.tests_passed || 0,
          tests_total: testResults?.tests_total || 0,
          council_reviewed: dbCert.council_reviewed,
          restrictions: [],
          valid_until: dbCert.valid_until,
        },
      },
      issued_at: data.createdAt,
      expires_at: new Date(dbCert.valid_until),
    }
  }

  return {
    id: data.id,
    tracking_id: data.trackingId,
    submission: {
      ...submission,
      submitter_id: data.submitterId,
    } as AgentSubmission,
    status: data.status as SubmissionStatus,
    queue_position: data.queuePosition ?? undefined,
    estimated_start: data.estimatedStart ?? undefined,
    test_results: testResults,
    certification,
    submitted_at: data.submittedAt,
    started_at: data.startedAt ?? undefined,
    completed_at: data.completedAt ?? undefined,
    council_reviewed: data.councilReviewed ?? false,
    council_decision_id: data.councilDecisionId ?? undefined,
    review_notes: data.reviewNotes ?? undefined,
  }
}
