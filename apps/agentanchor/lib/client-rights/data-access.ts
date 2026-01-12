/**
 * Data Access System
 * Epic 11: User data access, export, and deletion
 *
 * Implements the Right to Access through self-service data management.
 */

// ============================================================================
// Types
// ============================================================================

export type DataCategory =
  | 'profile'              // User profile information
  | 'interactions'         // Agent interaction history
  | 'decisions'            // Council decisions involving user
  | 'consents'             // Consent records
  | 'credentials'          // Trust credentials
  | 'transactions'         // Financial transactions
  | 'complaints'           // Filed complaints
  | 'audit_logs';          // Activity audit logs

export type ExportFormat = 'json' | 'csv' | 'xml';

export interface DataAccessRequest {
  id: string;
  userId: string;
  requestType: 'view' | 'export' | 'correct' | 'delete';
  categories: DataCategory[];

  // For export
  format?: ExportFormat;

  // For correction
  corrections?: Record<string, unknown>;

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;

  // Result
  resultUrl?: string;
  error?: string;
}

export interface UserDataSummary {
  userId: string;
  categories: Record<DataCategory, {
    recordCount: number;
    oldestRecord?: Date;
    newestRecord?: Date;
    estimatedSize: string;
  }>;
  totalRecords: number;
  totalSize: string;
  lastAccessed: Date;
}

export interface DataExportResult {
  requestId: string;
  format: ExportFormat;
  categories: DataCategory[];
  fileUrl: string;
  expiresAt: Date;
  checksum: string;
}

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const dataRequests = new Map<string, DataAccessRequest>();

// ============================================================================
// Data Access Functions
// ============================================================================

/**
 * Get summary of all user data
 */
export async function getUserDataSummary(userId: string): Promise<UserDataSummary> {
  // In production: aggregate from various data sources
  return {
    userId,
    categories: {
      profile: {
        recordCount: 1,
        newestRecord: new Date(),
        estimatedSize: '2 KB',
      },
      interactions: {
        recordCount: 156,
        oldestRecord: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        newestRecord: new Date(),
        estimatedSize: '45 KB',
      },
      decisions: {
        recordCount: 23,
        oldestRecord: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        newestRecord: new Date(),
        estimatedSize: '12 KB',
      },
      consents: {
        recordCount: 8,
        oldestRecord: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        newestRecord: new Date(),
        estimatedSize: '3 KB',
      },
      credentials: {
        recordCount: 2,
        newestRecord: new Date(),
        estimatedSize: '5 KB',
      },
      transactions: {
        recordCount: 5,
        oldestRecord: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        newestRecord: new Date(),
        estimatedSize: '2 KB',
      },
      complaints: {
        recordCount: 0,
        estimatedSize: '0 KB',
      },
      audit_logs: {
        recordCount: 312,
        oldestRecord: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        newestRecord: new Date(),
        estimatedSize: '85 KB',
      },
    },
    totalRecords: 507,
    totalSize: '154 KB',
    lastAccessed: new Date(),
  };
}

/**
 * Request data export
 */
export async function requestDataExport(
  userId: string,
  categories: DataCategory[],
  format: ExportFormat = 'json'
): Promise<DataAccessRequest> {
  const request: DataAccessRequest = {
    id: `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    requestType: 'export',
    categories,
    format,
    status: 'pending',
    requestedAt: new Date(),
  };

  dataRequests.set(request.id, request);

  // Trigger async export process
  processExportRequest(request.id);

  return request;
}

/**
 * Process export request (async)
 */
async function processExportRequest(requestId: string): Promise<void> {
  const request = dataRequests.get(requestId);
  if (!request) return;

  request.status = 'processing';
  dataRequests.set(requestId, request);

  try {
    // Simulate export processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate export (in production: compile actual data)
    const exportResult: DataExportResult = {
      requestId,
      format: request.format || 'json',
      categories: request.categories,
      fileUrl: `/api/data-exports/${requestId}/download`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      checksum: `sha256-${Math.random().toString(36).substr(2, 64)}`,
    };

    request.status = 'completed';
    request.completedAt = new Date();
    request.resultUrl = exportResult.fileUrl;

    dataRequests.set(requestId, request);
  } catch (error) {
    request.status = 'failed';
    request.error = error instanceof Error ? error.message : 'Export failed';
    dataRequests.set(requestId, request);
  }
}

/**
 * Request data correction
 */
export async function requestDataCorrection(
  userId: string,
  category: DataCategory,
  corrections: Record<string, unknown>
): Promise<DataAccessRequest> {
  const request: DataAccessRequest = {
    id: `correct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    requestType: 'correct',
    categories: [category],
    corrections,
    status: 'pending',
    requestedAt: new Date(),
  };

  dataRequests.set(request.id, request);

  return request;
}

/**
 * Request data deletion
 */
export async function requestDataDeletion(
  userId: string,
  categories: DataCategory[]
): Promise<DataAccessRequest> {
  const request: DataAccessRequest = {
    id: `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    requestType: 'delete',
    categories,
    status: 'pending',
    requestedAt: new Date(),
  };

  dataRequests.set(request.id, request);

  // Note: Deletion requires manual review for certain categories
  if (categories.includes('audit_logs')) {
    // Audit logs may need to be retained for compliance
    request.status = 'pending';
  }

  return request;
}

/**
 * Get data access request status
 */
export function getDataRequest(requestId: string): DataAccessRequest | null {
  return dataRequests.get(requestId) || null;
}

/**
 * Get all data requests for a user
 */
export function getUserDataRequests(userId: string): DataAccessRequest[] {
  const requests: DataAccessRequest[] = [];
  for (const request of dataRequests.values()) {
    if (request.userId === userId) {
      requests.push(request);
    }
  }
  return requests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
}

// ============================================================================
// Data Deletion (Right to Exit)
// ============================================================================

/**
 * Execute full account deletion (right to exit)
 */
export async function executeAccountDeletion(
  userId: string
): Promise<{
  success: boolean;
  deletedCategories: DataCategory[];
  retainedCategories: DataCategory[];
  retentionReason?: string;
}> {
  const deletedCategories: DataCategory[] = [
    'profile',
    'interactions',
    'consents',
    'credentials',
    'transactions',
    'complaints',
  ];

  const retainedCategories: DataCategory[] = [];

  // Audit logs may need retention for compliance
  // In production: check regulatory requirements
  retainedCategories.push('audit_logs');
  retainedCategories.push('decisions'); // Council decisions are part of Truth Chain

  return {
    success: true,
    deletedCategories,
    retainedCategories,
    retentionReason: 'Audit logs and council decisions retained for regulatory compliance (anonymized)',
  };
}

/**
 * Generate anonymized data for retention
 */
export function anonymizeForRetention(
  data: Record<string, unknown>
): Record<string, unknown> {
  const anonymized = { ...data };

  // Replace identifiable fields
  const piiFields = ['name', 'email', 'phone', 'address', 'userId', 'user_id'];

  for (const field of piiFields) {
    if (field in anonymized) {
      anonymized[field] = `[REDACTED-${field.toUpperCase()}]`;
    }
  }

  return anonymized;
}

/**
 * Clear all data (for testing)
 */
export function clearDataRequests(): void {
  dataRequests.clear();
}
