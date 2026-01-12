/**
 * Consent Management System
 * Epic 11: User consent tracking and enforcement
 *
 * Implements the Right to Consent through granular permission controls.
 */

// ============================================================================
// Types
// ============================================================================

export type ConsentCategory =
  | 'data_collection'       // Collect user data
  | 'data_processing'       // Process/analyze data
  | 'data_sharing'          // Share with third parties
  | 'communication'         // Send messages
  | 'financial'             // Financial transactions
  | 'account_changes'       // Modify user account
  | 'external_api'          // Call external services
  | 'ai_training'           // Use data for AI training
  | 'marketing';            // Marketing communications

export type ConsentStatus = 'granted' | 'denied' | 'pending' | 'expired' | 'withdrawn';

export interface ConsentRecord {
  id: string;
  userId: string;
  agentId: string;
  category: ConsentCategory;
  status: ConsentStatus;

  // Context
  scope: string;           // Specific scope (e.g., "email communications")
  purpose: string;         // Why consent was requested
  dataTypes?: string[];    // Types of data involved

  // Timing
  requestedAt: Date;
  grantedAt?: Date;
  expiresAt?: Date;
  withdrawnAt?: Date;

  // Audit
  requestContext: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentRequest {
  userId: string;
  agentId: string;
  category: ConsentCategory;
  scope: string;
  purpose: string;
  dataTypes?: string[];
  expiresIn?: number; // Hours until expiry
}

export interface ConsentPreferences {
  userId: string;
  defaults: Record<ConsentCategory, ConsentStatus>;
  agentOverrides: Record<string, Record<ConsentCategory, ConsentStatus>>;
  updatedAt: Date;
}

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const consentRecords = new Map<string, ConsentRecord>();
const userPreferences = new Map<string, ConsentPreferences>();

// ============================================================================
// Consent Functions
// ============================================================================

/**
 * Request consent from a user
 */
export async function requestConsent(
  request: ConsentRequest
): Promise<{
  consentId: string;
  requiresExplicit: boolean;
  defaulted?: boolean;
  status: ConsentStatus;
}> {
  const prefs = userPreferences.get(request.userId);

  // Check if user has default preference for this category
  let status: ConsentStatus = 'pending';
  let defaulted = false;

  if (prefs) {
    // Check agent-specific override first
    const agentOverride = prefs.agentOverrides[request.agentId]?.[request.category];
    if (agentOverride) {
      status = agentOverride;
      defaulted = true;
    } else if (prefs.defaults[request.category]) {
      status = prefs.defaults[request.category];
      defaulted = true;
    }
  }

  // Create consent record
  const consentId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const record: ConsentRecord = {
    id: consentId,
    userId: request.userId,
    agentId: request.agentId,
    category: request.category,
    status,
    scope: request.scope,
    purpose: request.purpose,
    dataTypes: request.dataTypes,
    requestedAt: new Date(),
    grantedAt: status === 'granted' ? new Date() : undefined,
    expiresAt: request.expiresIn
      ? new Date(Date.now() + request.expiresIn * 60 * 60 * 1000)
      : undefined,
    requestContext: {},
  };

  consentRecords.set(consentId, record);

  // Determine if explicit consent is required
  const sensitiveCategories: ConsentCategory[] = [
    'financial',
    'data_sharing',
    'ai_training',
  ];
  const requiresExplicit = sensitiveCategories.includes(request.category) && !defaulted;

  return {
    consentId,
    requiresExplicit,
    defaulted,
    status,
  };
}

/**
 * Grant consent
 */
export async function grantConsent(
  consentId: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const record = consentRecords.get(consentId);
  if (!record) {
    return { success: false, error: 'Consent record not found' };
  }

  record.status = 'granted';
  record.grantedAt = new Date();
  record.ipAddress = options?.ipAddress;
  record.userAgent = options?.userAgent;

  consentRecords.set(consentId, record);

  return { success: true };
}

/**
 * Deny consent
 */
export async function denyConsent(consentId: string): Promise<{ success: boolean }> {
  const record = consentRecords.get(consentId);
  if (!record) {
    return { success: false };
  }

  record.status = 'denied';
  consentRecords.set(consentId, record);

  return { success: true };
}

/**
 * Withdraw previously granted consent
 */
export async function withdrawConsent(
  consentId: string,
  reason?: string
): Promise<{ success: boolean; affectedActions: string[] }> {
  const record = consentRecords.get(consentId);
  if (!record) {
    return { success: false, affectedActions: [] };
  }

  record.status = 'withdrawn';
  record.withdrawnAt = new Date();
  record.requestContext = {
    ...record.requestContext,
    withdrawalReason: reason,
  };

  consentRecords.set(consentId, record);

  // In production: trigger cleanup of data/actions based on this consent
  const affectedActions: string[] = [];

  return { success: true, affectedActions };
}

/**
 * Check if consent is valid for an action
 */
export async function checkConsent(
  userId: string,
  agentId: string,
  category: ConsentCategory
): Promise<{
  hasConsent: boolean;
  consentId?: string;
  expiresAt?: Date;
  requiresRenewal: boolean;
}> {
  // Find valid consent record
  for (const [id, record] of consentRecords) {
    if (
      record.userId === userId &&
      record.agentId === agentId &&
      record.category === category &&
      record.status === 'granted'
    ) {
      // Check expiry
      if (record.expiresAt && new Date() > record.expiresAt) {
        record.status = 'expired';
        consentRecords.set(id, record);
        continue;
      }

      // Check if nearing expiry (within 24 hours)
      const requiresRenewal = record.expiresAt
        ? new Date(record.expiresAt.getTime() - 24 * 60 * 60 * 1000) < new Date()
        : false;

      return {
        hasConsent: true,
        consentId: id,
        expiresAt: record.expiresAt,
        requiresRenewal,
      };
    }
  }

  return { hasConsent: false, requiresRenewal: false };
}

/**
 * Get all consent records for a user
 */
export function getUserConsents(userId: string): ConsentRecord[] {
  const records: ConsentRecord[] = [];
  for (const record of consentRecords.values()) {
    if (record.userId === userId) {
      records.push(record);
    }
  }
  return records.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
}

/**
 * Get consent records for a specific agent
 */
export function getAgentConsents(agentId: string): ConsentRecord[] {
  const records: ConsentRecord[] = [];
  for (const record of consentRecords.values()) {
    if (record.agentId === agentId) {
      records.push(record);
    }
  }
  return records;
}

// ============================================================================
// Preference Management
// ============================================================================

/**
 * Set user's default consent preferences
 */
export function setUserPreferences(
  userId: string,
  defaults: Partial<Record<ConsentCategory, ConsentStatus>>
): ConsentPreferences {
  const existing = userPreferences.get(userId) || {
    userId,
    defaults: {
      data_collection: 'pending',
      data_processing: 'pending',
      data_sharing: 'pending',
      communication: 'pending',
      financial: 'pending',
      account_changes: 'pending',
      external_api: 'pending',
      ai_training: 'denied',
      marketing: 'denied',
    },
    agentOverrides: {},
    updatedAt: new Date(),
  };

  existing.defaults = { ...existing.defaults, ...defaults };
  existing.updatedAt = new Date();

  userPreferences.set(userId, existing);
  return existing;
}

/**
 * Set agent-specific consent override
 */
export function setAgentConsentOverride(
  userId: string,
  agentId: string,
  category: ConsentCategory,
  status: ConsentStatus
): void {
  let prefs = userPreferences.get(userId);
  if (!prefs) {
    prefs = setUserPreferences(userId, {});
  }

  if (!prefs.agentOverrides[agentId]) {
    prefs.agentOverrides[agentId] = {} as Record<ConsentCategory, ConsentStatus>;
  }

  prefs.agentOverrides[agentId][category] = status;
  prefs.updatedAt = new Date();

  userPreferences.set(userId, prefs);
}

/**
 * Get user preferences
 */
export function getUserPreferences(userId: string): ConsentPreferences | null {
  return userPreferences.get(userId) || null;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Revoke all consents for an agent (used when agent is terminated)
 */
export async function revokeAllAgentConsents(
  agentId: string
): Promise<{ revokedCount: number }> {
  let revokedCount = 0;

  for (const [id, record] of consentRecords) {
    if (record.agentId === agentId && record.status === 'granted') {
      record.status = 'withdrawn';
      record.withdrawnAt = new Date();
      record.requestContext = {
        ...record.requestContext,
        revokedReason: 'Agent terminated',
      };
      consentRecords.set(id, record);
      revokedCount++;
    }
  }

  return { revokedCount };
}

/**
 * Revoke all user consents (used when user exercises right to exit)
 */
export async function revokeAllUserConsents(
  userId: string
): Promise<{ revokedCount: number }> {
  let revokedCount = 0;

  for (const [id, record] of consentRecords) {
    if (record.userId === userId && record.status === 'granted') {
      record.status = 'withdrawn';
      record.withdrawnAt = new Date();
      record.requestContext = {
        ...record.requestContext,
        revokedReason: 'User exit',
      };
      consentRecords.set(id, record);
      revokedCount++;
    }
  }

  // Clear preferences
  userPreferences.delete(userId);

  return { revokedCount };
}

/**
 * Clear all data (for testing)
 */
export function clearConsentData(): void {
  consentRecords.clear();
  userPreferences.clear();
}
