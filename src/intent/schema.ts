import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  bigint,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  inet,
} from 'drizzle-orm/pg-core';
import { INTENT_STATUSES } from '../common/types.js';

// =============================================================================
// ENUMS
// =============================================================================

export const intentStatusEnum = pgEnum('intent_status', [...INTENT_STATUSES]);

export const intents = pgTable('intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  goal: text('goal').notNull(),
  intentType: text('intent_type'),
  priority: integer('priority').default(0),
  status: intentStatusEnum('status').notNull().default('pending'),
  trustSnapshot: jsonb('trust_snapshot'),
  context: jsonb('context').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  dedupeHash: text('dedupe_hash').notNull(),
  trustLevel: integer('trust_level'),
  trustScore: integer('trust_score'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  // GDPR soft delete
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Cancellation support
  cancellationReason: text('cancellation_reason'),
}, (table) => ({
  tenantCreatedIdx: index('intents_tenant_created_idx').on(
    table.tenantId,
    table.createdAt
  ),
  dedupeIdx: uniqueIndex('intents_tenant_dedupe_idx').on(
    table.tenantId,
    table.dedupeHash
  ),
  // Soft delete index for cleanup job
  deletedAtIdx: index('intents_deleted_at_idx').on(table.deletedAt),
  // Performance index for countActiveIntents() queries
  tenantStatusIdx: index('intents_tenant_status_idx').on(table.tenantId, table.status),
}));

export const intentEvents = pgTable('intent_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id')
    .notNull()
    .references(() => intents.id),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Cryptographic hash for tamper detection (SHA-256)
  hash: text('hash'),
  // Previous event hash for chain integrity
  previousHash: text('previous_hash'),
}, (table) => ({
  intentEventIdx: index('intent_events_intent_idx').on(
    table.intentId,
    table.occurredAt
  ),
}));

export const intentEvaluations = pgTable('intent_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id')
    .notNull()
    .references(() => intents.id),
  tenantId: text('tenant_id').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const intentRelations = relations(intents, ({ many }) => ({
  events: many(intentEvents),
  evaluations: many(intentEvaluations),
}));

// =============================================================================
// ESCALATIONS
// =============================================================================

export const escalationStatusEnum = pgEnum('escalation_status', [
  'pending',
  'acknowledged',
  'approved',
  'rejected',
  'timeout',
  'cancelled',
]);

export const escalationReasonCategoryEnum = pgEnum('escalation_reason_category', [
  'trust_insufficient',
  'high_risk',
  'policy_violation',
  'manual_review',
  'constraint_escalate',
]);

export const escalations = pgTable('escalations', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id')
    .notNull()
    .references(() => intents.id),
  tenantId: text('tenant_id').notNull(),

  // Escalation details
  reason: text('reason').notNull(),
  reasonCategory: escalationReasonCategoryEnum('reason_category').notNull(),

  // Routing
  escalatedTo: text('escalated_to').notNull(),
  escalatedBy: text('escalated_by'),

  // Status
  status: escalationStatusEnum('status').notNull().default('pending'),

  // Resolution
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),

  // SLA tracking
  timeout: text('timeout').notNull(), // ISO 8601 duration
  timeoutAt: timestamp('timeout_at', { withTimezone: true }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  slaBreached: boolean('sla_breached').default(false),

  // Metadata
  context: jsonb('context'),
  metadata: jsonb('metadata'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantStatusIdx: index('escalations_tenant_status_idx').on(
    table.tenantId,
    table.status,
    table.createdAt
  ),
  intentIdx: index('escalations_intent_idx').on(table.intentId),
  timeoutIdx: index('escalations_timeout_idx').on(table.timeoutAt),
  // Performance index for processTimeouts() queries
  timeoutStatusIdx: index('escalations_timeout_status_idx').on(table.status, table.timeoutAt),
}));

export const escalationRelations = relations(escalations, ({ one }) => ({
  intent: one(intents, {
    fields: [escalations.intentId],
    references: [intents.id],
  }),
}));

// =============================================================================
// AUDIT RECORDS
// =============================================================================

export const auditSeverityEnum = pgEnum('audit_severity', ['info', 'warning', 'error', 'critical']);
export const auditOutcomeEnum = pgEnum('audit_outcome', ['success', 'failure', 'partial']);

export const auditRecords = pgTable('audit_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),

  // Event identification
  eventType: text('event_type').notNull(),
  eventCategory: text('event_category').notNull(),
  severity: auditSeverityEnum('severity').notNull().default('info'),

  // Actor
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name'),
  actorIp: inet('actor_ip'),

  // Target
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  targetName: text('target_name'),

  // Context
  requestId: text('request_id').notNull(),
  traceId: text('trace_id'),
  spanId: text('span_id'),

  // Event details
  action: text('action').notNull(),
  outcome: auditOutcomeEnum('outcome').notNull(),
  reason: text('reason'),

  // Change tracking
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  diffState: jsonb('diff_state'),

  // Metadata
  metadata: jsonb('metadata'),
  tags: text('tags').array(),

  // Chain integrity
  sequenceNumber: bigint('sequence_number', { mode: 'number' }).notNull(),
  previousHash: text('previous_hash'),
  recordHash: text('record_hash').notNull(),

  // Timestamps
  eventTime: timestamp('event_time', { withTimezone: true }).defaultNow().notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),

  // Archive support for enterprise retention compliance
  archived: boolean('archived').default(false).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => ({
  tenantTimeIdx: index('audit_tenant_time_idx').on(table.tenantId, table.eventTime),
  actorIdx: index('audit_actor_idx').on(table.actorId, table.eventTime),
  targetIdx: index('audit_target_idx').on(table.targetType, table.targetId, table.eventTime),
  eventTypeIdx: index('audit_event_type_idx').on(table.eventType, table.eventTime),
  requestIdx: index('audit_request_idx').on(table.requestId),
  // Index for efficient archive/cleanup queries
  archivedIdx: index('audit_archived_idx').on(table.archived, table.eventTime),
  // Performance index for distributed tracing queries
  traceIdx: index('audit_records_trace_idx').on(table.traceId),
}));

// =============================================================================
// POLICIES
// =============================================================================

export const policyStatusEnum = pgEnum('policy_status', ['draft', 'published', 'deprecated', 'archived']);

export const policies = pgTable('policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  namespace: text('namespace').notNull().default('default'),
  description: text('description'),
  version: integer('version').notNull().default(1),
  status: policyStatusEnum('status').notNull().default('draft'),

  // Policy definition
  definition: jsonb('definition').notNull(),
  checksum: text('checksum').notNull(),

  // Audit
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => ({
  tenantStatusIdx: index('policies_tenant_status_idx').on(table.tenantId, table.status),
  namespaceIdx: index('policies_namespace_idx').on(table.namespace),
  uniqueNameVersion: uniqueIndex('policies_tenant_name_version_unique').on(
    table.tenantId,
    table.namespace,
    table.name,
    table.version
  ),
}));

export const policyVersions = pgTable('policy_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id')
    .notNull()
    .references(() => policies.id),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  checksum: text('checksum').notNull(),
  changeSummary: text('change_summary'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policyIdx: index('policy_versions_policy_idx').on(table.policyId),
  uniqueVersion: uniqueIndex('policy_versions_unique').on(table.policyId, table.version),
}));

export const policyRelations = relations(policies, ({ many }) => ({
  versions: many(policyVersions),
}));

export const policyVersionRelations = relations(policyVersions, ({ one }) => ({
  policy: one(policies, {
    fields: [policyVersions.policyId],
    references: [policies.id],
  }),
}));

// =============================================================================
// TENANT MEMBERSHIPS (Security: Multi-tenant isolation)
// =============================================================================

export const tenantMembershipRoleEnum = pgEnum('tenant_membership_role', [
  'owner',
  'admin',
  'member',
  'readonly',
]);

export const tenantMemberships = pgTable('tenant_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  role: tenantMembershipRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: user can only have one membership per tenant
  uniqueUserTenant: uniqueIndex('tenant_memberships_user_tenant_unique').on(
    table.userId,
    table.tenantId
  ),
  // Index for efficient user lookup (primary access pattern)
  userIdx: index('tenant_memberships_user_idx').on(table.userId),
  // Index for listing all members of a tenant
  tenantIdx: index('tenant_memberships_tenant_idx').on(table.tenantId),
}));

// =============================================================================
// GROUP MEMBERSHIPS - Authoritative source for user group membership
// SECURITY: This table is the source of truth for group membership verification.
//           JWT group claims MUST NOT be trusted - verify against this table.
// =============================================================================

export const groupMemberships = pgTable('group_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  groupName: text('group_name').notNull(),
  active: boolean('active').notNull().default(true),

  // Audit fields
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  tenantUserIdx: index('group_memberships_tenant_user_idx').on(table.tenantId, table.userId),
  tenantGroupIdx: index('group_memberships_tenant_group_idx').on(table.tenantId, table.groupName),
  uniqueMembership: uniqueIndex('group_memberships_unique').on(
    table.tenantId,
    table.userId,
    table.groupName
  ),
}));

// =============================================================================
// ESCALATION APPROVERS - Explicit approver assignments for escalations
// SECURITY: Provides fine-grained authorization for who can approve escalations.
//           This supplements group-based authorization with explicit assignments.
// =============================================================================

export const escalationApprovers = pgTable('escalation_approvers', {
  id: uuid('id').defaultRandom().primaryKey(),
  escalationId: uuid('escalation_id')
    .notNull()
    .references(() => escalations.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  assignedBy: text('assigned_by').notNull(),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  escalationIdx: index('escalation_approvers_escalation_idx').on(table.escalationId),
  tenantUserIdx: index('escalation_approvers_tenant_user_idx').on(table.tenantId, table.userId),
  uniqueApprover: uniqueIndex('escalation_approvers_unique').on(
    table.escalationId,
    table.userId
  ),
}));

export const escalationApproverRelations = relations(escalationApprovers, ({ one }) => ({
  escalation: one(escalations, {
    fields: [escalationApprovers.escalationId],
    references: [escalations.id],
  }),
}));

// =============================================================================
// CONSENT MANAGEMENT (GDPR/SOC2 Compliance)
// =============================================================================

/**
 * Consent types for data processing under GDPR/SOC2
 */
export const consentTypeEnum = pgEnum('consent_type', [
  'data_processing',
  'analytics',
  'marketing',
]);

/**
 * User consent records - tracks user consent for data processing
 * Required for GDPR Article 7 compliance (Conditions for consent)
 */
export const userConsents = pgTable('user_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  consentType: text('consent_type').notNull(), // 'data_processing', 'analytics', 'marketing'
  granted: boolean('granted').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  version: text('version').notNull(), // consent policy version
  ipAddress: text('ip_address'), // IPv4 or IPv6 (max 45 chars)
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Efficient lookup by user and tenant
  userTenantIdx: index('user_consents_user_tenant_idx').on(table.userId, table.tenantId),
  // Efficient lookup for consent validation
  userTenantTypeIdx: index('user_consents_user_tenant_type_idx').on(
    table.userId,
    table.tenantId,
    table.consentType
  ),
  // Audit trail queries by tenant
  tenantCreatedIdx: index('user_consents_tenant_created_idx').on(table.tenantId, table.createdAt),
  // Find active consents
  grantedIdx: index('user_consents_granted_idx').on(table.granted, table.revokedAt),
}));

/**
 * Consent policy versions - tracks policy documents and their versions
 * Required for demonstrating what users agreed to at time of consent
 */
export const consentPolicies = pgTable('consent_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  consentType: text('consent_type').notNull(),
  version: text('version').notNull(),
  content: text('content').notNull(), // policy text
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Lookup current policy for a tenant and consent type
  tenantTypeVersionIdx: uniqueIndex('consent_policies_tenant_type_version_idx').on(
    table.tenantId,
    table.consentType,
    table.version
  ),
  // Find effective policies
  effectiveIdx: index('consent_policies_effective_idx').on(
    table.tenantId,
    table.consentType,
    table.effectiveFrom,
    table.effectiveTo
  ),
}));

// =============================================================================
// AUDIT READS (SOC2 Compliance - Read Access Logging)
// =============================================================================

/**
 * Tracks read access to resources for SOC2 compliance.
 * Logs who accessed/viewed data, when, and from where.
 */
export const auditReads = pgTable('audit_reads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(), // 'intent.read', 'intent.read_list', etc.
  resourceType: text('resource_type').notNull(), // 'intent', 'escalation', 'webhook', 'user_data'
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata'), // Additional context (query params, filters, etc.)
  ipAddress: text('ip_address'), // IPv4 or IPv6 (max 45 chars)
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Primary compliance query: find all access by a user
  userIdx: index('audit_reads_user_idx').on(table.userId, table.timestamp),
  // Tenant-scoped queries
  tenantIdx: index('audit_reads_tenant_idx').on(table.tenantId, table.timestamp),
  // Resource access history
  resourceIdx: index('audit_reads_resource_idx').on(table.resourceType, table.resourceId, table.timestamp),
  // Action filtering for compliance reports
  actionIdx: index('audit_reads_action_idx').on(table.action, table.timestamp),
  // Combined tenant + user for efficient filtered queries
  tenantUserIdx: index('audit_reads_tenant_user_idx').on(table.tenantId, table.userId, table.timestamp),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type AuditReadRow = typeof auditReads.$inferSelect;
export type NewAuditReadRow = typeof auditReads.$inferInsert;
export type UserConsentRow = typeof userConsents.$inferSelect;
export type NewUserConsentRow = typeof userConsents.$inferInsert;
export type ConsentPolicyRow = typeof consentPolicies.$inferSelect;
export type NewConsentPolicyRow = typeof consentPolicies.$inferInsert;
export type TenantMembershipRow = typeof tenantMemberships.$inferSelect;
export type NewTenantMembershipRow = typeof tenantMemberships.$inferInsert;
export type GroupMembershipRow = typeof groupMemberships.$inferSelect;
export type NewGroupMembershipRow = typeof groupMemberships.$inferInsert;
export type EscalationApproverRow = typeof escalationApprovers.$inferSelect;
export type NewEscalationApproverRow = typeof escalationApprovers.$inferInsert;
export type IntentRow = typeof intents.$inferSelect;
export type NewIntentRow = typeof intents.$inferInsert;
export type IntentEventRow = typeof intentEvents.$inferSelect;
export type NewIntentEventRow = typeof intentEvents.$inferInsert;
export type IntentEvaluationRow = typeof intentEvaluations.$inferSelect;
export type NewIntentEvaluationRow = typeof intentEvaluations.$inferInsert;
export type EscalationRow = typeof escalations.$inferSelect;
export type NewEscalationRow = typeof escalations.$inferInsert;
export type AuditRecordRow = typeof auditRecords.$inferSelect;
export type NewAuditRecordRow = typeof auditRecords.$inferInsert;
export type PolicyRow = typeof policies.$inferSelect;
export type NewPolicyRow = typeof policies.$inferInsert;
export type PolicyVersionRow = typeof policyVersions.$inferSelect;
export type NewPolicyVersionRow = typeof policyVersions.$inferInsert;
