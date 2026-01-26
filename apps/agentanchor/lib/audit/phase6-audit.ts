/**
 * Phase 6 Audit Logging Service
 *
 * Comprehensive audit trail for compliance and security monitoring
 */

// =============================================================================
// Types
// =============================================================================

export type AuditAction =
  // Role Gates
  | 'role_gate.create'
  | 'role_gate.update'
  | 'role_gate.delete'
  | 'role_gate.evaluate'
  // Ceiling
  | 'ceiling.create'
  | 'ceiling.update'
  | 'ceiling.delete'
  | 'ceiling.check'
  // Provenance
  | 'provenance.create'
  | 'provenance.verify'
  | 'provenance.export'
  // Alerts
  | 'alert.create'
  | 'alert.acknowledge'
  | 'alert.resolve'
  | 'alert.dismiss'
  // Presets
  | 'preset.create'
  | 'preset.update'
  | 'preset.delete'
  | 'preset.apply'
  // Webhooks
  | 'webhook.create'
  | 'webhook.update'
  | 'webhook.delete'
  | 'webhook.test'
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.token_refresh'
  | 'auth.api_key_create'
  | 'auth.api_key_revoke'
  // Admin
  | 'admin.settings_update'
  | 'admin.user_create'
  | 'admin.user_update'
  | 'admin.user_delete'
  | 'admin.organization_create'
  | 'admin.organization_update';

export type AuditResourceType =
  | 'role_gate'
  | 'ceiling'
  | 'provenance'
  | 'alert'
  | 'preset'
  | 'webhook'
  | 'user'
  | 'organization'
  | 'api_key'
  | 'settings';

export type AuditActorType = 'user' | 'agent' | 'system' | 'api_key';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  actorId?: string;
  actorType: AuditActorType;
  actorName?: string;
  changes?: AuditChanges;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
  timestamp: Date;
  // Computed fields
  severity: AuditSeverity;
  category: AuditCategory;
}

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: AuditDiff[];
}

export interface AuditDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AuditCategory = 'security' | 'data' | 'config' | 'access' | 'admin';

export interface AuditQueryOptions {
  action?: AuditAction | AuditAction[];
  resourceType?: AuditResourceType | AuditResourceType[];
  resourceId?: string;
  actorId?: string;
  actorType?: AuditActorType;
  organizationId?: string;
  severity?: AuditSeverity | AuditSeverity[];
  category?: AuditCategory | AuditCategory[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditContext {
  actorId?: string;
  actorType: AuditActorType;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
  requestId?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const ACTION_SEVERITY: Record<AuditAction, AuditSeverity> = {
  // Critical - security-sensitive operations
  'admin.settings_update': 'critical',
  'admin.user_delete': 'critical',
  'auth.api_key_create': 'critical',
  'auth.api_key_revoke': 'critical',
  'preset.apply': 'critical',

  // High - important configuration changes
  'role_gate.create': 'high',
  'role_gate.update': 'high',
  'role_gate.delete': 'high',
  'ceiling.create': 'high',
  'ceiling.update': 'high',
  'ceiling.delete': 'high',
  'webhook.create': 'high',
  'webhook.delete': 'high',
  'admin.user_create': 'high',
  'admin.user_update': 'high',
  'admin.organization_create': 'high',
  'admin.organization_update': 'high',

  // Medium - operational actions
  'role_gate.evaluate': 'medium',
  'ceiling.check': 'medium',
  'alert.acknowledge': 'medium',
  'alert.resolve': 'medium',
  'alert.dismiss': 'medium',
  'preset.create': 'medium',
  'preset.update': 'medium',
  'preset.delete': 'medium',
  'webhook.update': 'medium',
  'webhook.test': 'medium',
  'auth.login': 'medium',
  'auth.logout': 'medium',
  'auth.token_refresh': 'medium',

  // Low - routine operations
  'provenance.create': 'low',
  'provenance.verify': 'low',
  'provenance.export': 'low',
  'alert.create': 'low',

  // Info - informational only
};

const ACTION_CATEGORY: Record<AuditAction, AuditCategory> = {
  'role_gate.create': 'config',
  'role_gate.update': 'config',
  'role_gate.delete': 'config',
  'role_gate.evaluate': 'access',
  'ceiling.create': 'config',
  'ceiling.update': 'config',
  'ceiling.delete': 'config',
  'ceiling.check': 'access',
  'provenance.create': 'data',
  'provenance.verify': 'data',
  'provenance.export': 'data',
  'alert.create': 'security',
  'alert.acknowledge': 'security',
  'alert.resolve': 'security',
  'alert.dismiss': 'security',
  'preset.create': 'config',
  'preset.update': 'config',
  'preset.delete': 'config',
  'preset.apply': 'config',
  'webhook.create': 'config',
  'webhook.update': 'config',
  'webhook.delete': 'config',
  'webhook.test': 'config',
  'auth.login': 'security',
  'auth.logout': 'security',
  'auth.token_refresh': 'security',
  'auth.api_key_create': 'security',
  'auth.api_key_revoke': 'security',
  'admin.settings_update': 'admin',
  'admin.user_create': 'admin',
  'admin.user_update': 'admin',
  'admin.user_delete': 'admin',
  'admin.organization_create': 'admin',
  'admin.organization_update': 'admin',
};

// =============================================================================
// In-Memory Store (replace with database in production)
// =============================================================================

const auditStore: AuditEntry[] = [];
const MAX_STORE_SIZE = 10000;

// =============================================================================
// Audit Service
// =============================================================================

/**
 * Create an audit entry
 */
export function audit(
  action: AuditAction,
  resourceType: AuditResourceType,
  context: AuditContext,
  options: {
    resourceId?: string;
    changes?: AuditChanges;
    metadata?: Record<string, unknown>;
  } = {}
): AuditEntry {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    action,
    resourceType,
    resourceId: options.resourceId,
    actorId: context.actorId,
    actorType: context.actorType,
    actorName: context.actorName,
    changes: options.changes,
    metadata: {
      ...options.metadata,
      requestId: context.requestId,
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    organizationId: context.organizationId,
    timestamp: new Date(),
    severity: ACTION_SEVERITY[action] || 'info',
    category: ACTION_CATEGORY[action] || 'data',
  };

  // Store entry
  auditStore.push(entry);

  // Prune old entries if needed
  if (auditStore.length > MAX_STORE_SIZE) {
    auditStore.splice(0, auditStore.length - MAX_STORE_SIZE);
  }

  // Log critical and high severity events
  if (entry.severity === 'critical' || entry.severity === 'high') {
    console.log(
      `[AUDIT:${entry.severity.toUpperCase()}] ${entry.action} on ${entry.resourceType}${entry.resourceId ? `:${entry.resourceId}` : ''} by ${entry.actorType}:${entry.actorId || 'unknown'}`
    );
  }

  return entry;
}

/**
 * Query audit entries
 */
export function queryAudit(options: AuditQueryOptions = {}): {
  entries: AuditEntry[];
  total: number;
} {
  let results = [...auditStore];

  // Apply filters
  if (options.action) {
    const actions = Array.isArray(options.action)
      ? options.action
      : [options.action];
    results = results.filter((e) => actions.includes(e.action));
  }

  if (options.resourceType) {
    const types = Array.isArray(options.resourceType)
      ? options.resourceType
      : [options.resourceType];
    results = results.filter((e) => types.includes(e.resourceType));
  }

  if (options.resourceId) {
    results = results.filter((e) => e.resourceId === options.resourceId);
  }

  if (options.actorId) {
    results = results.filter((e) => e.actorId === options.actorId);
  }

  if (options.actorType) {
    results = results.filter((e) => e.actorType === options.actorType);
  }

  if (options.organizationId) {
    results = results.filter((e) => e.organizationId === options.organizationId);
  }

  if (options.severity) {
    const severities = Array.isArray(options.severity)
      ? options.severity
      : [options.severity];
    results = results.filter((e) => severities.includes(e.severity));
  }

  if (options.category) {
    const categories = Array.isArray(options.category)
      ? options.category
      : [options.category];
    results = results.filter((e) => categories.includes(e.category));
  }

  if (options.startTime) {
    results = results.filter((e) => e.timestamp >= options.startTime!);
  }

  if (options.endTime) {
    results = results.filter((e) => e.timestamp <= options.endTime!);
  }

  // Sort by timestamp descending
  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = results.length;

  // Apply pagination
  if (options.offset) {
    results = results.slice(options.offset);
  }

  if (options.limit) {
    results = results.slice(0, options.limit);
  }

  return { entries: results, total };
}

/**
 * Get audit entry by ID
 */
export function getAuditEntry(id: string): AuditEntry | undefined {
  return auditStore.find((e) => e.id === id);
}

/**
 * Get audit statistics
 */
export function getAuditStats(
  organizationId?: string,
  timeRange?: { start: Date; end: Date }
): {
  total: number;
  bySeverity: Record<AuditSeverity, number>;
  byCategory: Record<AuditCategory, number>;
  byAction: Record<string, number>;
  recentCritical: AuditEntry[];
} {
  let entries = [...auditStore];

  if (organizationId) {
    entries = entries.filter((e) => e.organizationId === organizationId);
  }

  if (timeRange) {
    entries = entries.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );
  }

  const bySeverity: Record<AuditSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byCategory: Record<AuditCategory, number> = {
    security: 0,
    data: 0,
    config: 0,
    access: 0,
    admin: 0,
  };

  const byAction: Record<string, number> = {};

  for (const entry of entries) {
    bySeverity[entry.severity]++;
    byCategory[entry.category]++;
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
  }

  const recentCritical = entries
    .filter((e) => e.severity === 'critical')
    .slice(0, 10);

  return {
    total: entries.length,
    bySeverity,
    byCategory,
    byAction,
    recentCritical,
  };
}

// =============================================================================
// Change Tracking Helpers
// =============================================================================

/**
 * Calculate diff between two objects
 */
export function calculateChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): AuditChanges {
  const diff: AuditDiff[] = [];

  if (!before && !after) {
    return {};
  }

  if (!before) {
    return { after };
  }

  if (!after) {
    return { before };
  }

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldValue = before[key];
    const newValue = after[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diff.push({ field: key, oldValue, newValue });
    }
  }

  return { before, after, diff };
}

/**
 * Redact sensitive fields from audit data
 */
export function redactSensitive<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['password', 'secret', 'token', 'apiKey', 'key']
): T {
  const redacted = { ...data };

  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]' as T[keyof T];
    }
  }

  // Handle nested objects
  for (const [key, value] of Object.entries(redacted)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactSensitive(
        value as Record<string, unknown>,
        sensitiveFields
      ) as T[keyof T];
    }
  }

  return redacted;
}

// =============================================================================
// Compliance Export
// =============================================================================

/**
 * Export audit log for compliance
 */
export function exportAuditLog(
  options: AuditQueryOptions & { format?: 'json' | 'csv' }
): string {
  const { entries } = queryAudit({ ...options, limit: undefined });
  const format = options.format || 'json';

  if (format === 'json') {
    return JSON.stringify(entries, null, 2);
  }

  // CSV format
  const headers = [
    'id',
    'timestamp',
    'action',
    'resourceType',
    'resourceId',
    'actorId',
    'actorType',
    'severity',
    'category',
    'ipAddress',
    'organizationId',
  ];

  const rows = entries.map((e) => [
    e.id,
    e.timestamp.toISOString(),
    e.action,
    e.resourceType,
    e.resourceId || '',
    e.actorId || '',
    e.actorType,
    e.severity,
    e.category,
    e.ipAddress || '',
    e.organizationId || '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Create audit context from request
 */
export function createAuditContext(request: Request): AuditContext {
  const headers = request.headers;

  return {
    actorId: headers.get('x-user-id') || undefined,
    actorType: (headers.get('x-actor-type') as AuditActorType) || 'user',
    actorName: headers.get('x-user-name') || undefined,
    ipAddress:
      headers.get('x-forwarded-for')?.split(',')[0] ||
      headers.get('x-real-ip') ||
      undefined,
    userAgent: headers.get('user-agent') || undefined,
    organizationId: headers.get('x-organization-id') || undefined,
    requestId: headers.get('x-request-id') || crypto.randomUUID(),
  };
}

// =============================================================================
// Exports
// =============================================================================

export const auditService = {
  log: audit,
  query: queryAudit,
  get: getAuditEntry,
  stats: getAuditStats,
  export: exportAuditLog,
  calculateChanges,
  redactSensitive,
  createContext: createAuditContext,
};
