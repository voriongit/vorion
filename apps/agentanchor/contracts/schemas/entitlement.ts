/**
 * Entitlement Schema
 *
 * Defines commercial and operational boundaries.
 * Per spec Section IV.8 (Entitlement, Metering & Limits Module):
 *
 * Capabilities:
 * - Feature gating by plan/tier
 * - Usage metering (runs, tools, time)
 * - Budget enforcement
 * - Receipt generation
 *
 * Rules:
 * - Enforcement occurs at authorization
 * - UI-only gating is forbidden
 * - All metering is auditable
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  ActorSchema,
} from './common.js';

// ============================================================================
// PLAN TIERS
// ============================================================================

/** Subscription/plan tier */
export const PlanTierSchema = z.enum([
  'FREE',           // Free tier
  'STARTER',        // Entry paid tier
  'PROFESSIONAL',   // Professional tier
  'TEAM',           // Team/business tier
  'ENTERPRISE',     // Enterprise tier
  'CUSTOM',         // Custom/negotiated tier
]);

// ============================================================================
// FEATURE DEFINITIONS
// ============================================================================

/** Feature flag definition */
export const FeatureDefinitionSchema = z.object({
  /** Feature identifier */
  id: z.string().min(1),
  /** Feature name */
  name: z.string(),
  /** Feature description */
  description: z.string().optional(),
  /** Feature category */
  category: z.string().optional(),
  /** Is this a boolean feature or metered? */
  type: z.enum(['BOOLEAN', 'METERED', 'TIERED']),
  /** Default value (for boolean) */
  defaultEnabled: z.boolean().optional(),
  /** Unit of measurement (for metered) */
  unit: z.string().optional(),
});

/** Feature entitlement (what a plan gets) */
export const FeatureEntitlementSchema = z.object({
  /** Feature ID */
  featureId: z.string(),
  /** Is feature enabled? */
  enabled: z.boolean(),
  /** Limit (for metered features) */
  limit: z.number().nonnegative().optional(),
  /** Limit period (for metered features) */
  limitPeriod: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'LIFETIME']).optional(),
  /** Overage allowed? */
  overageAllowed: z.boolean().optional(),
  /** Overage rate (cost per unit over limit) */
  overageRate: z.number().nonnegative().optional(),
  /** Custom configuration */
  config: z.record(z.unknown()).optional(),
});

// ============================================================================
// USAGE RECORDS
// ============================================================================

/** Single usage event */
export const UsageEventSchema = z.object({
  /** Event ID */
  id: UUIDSchema,
  /** Feature ID */
  featureId: z.string(),
  /** Quantity used */
  quantity: z.number().nonnegative(),
  /** Unit */
  unit: z.string(),
  /** Usage timestamp */
  timestamp: TimestampSchema,
  /** Related intent ID */
  intentId: UUIDSchema.optional(),
  /** Related correlation ID */
  correlationId: z.string().optional(),
  /** Actor who incurred usage */
  actor: ActorSchema,
  /** Metadata */
  metadata: z.record(z.unknown()).optional(),
});

/** Aggregated usage summary */
export const UsageSummarySchema = z.object({
  /** Feature ID */
  featureId: z.string(),
  /** Feature name */
  featureName: z.string(),
  /** Period start */
  periodStart: TimestampSchema,
  /** Period end */
  periodEnd: TimestampSchema,
  /** Total usage */
  totalUsage: z.number().nonnegative(),
  /** Unit */
  unit: z.string(),
  /** Limit for period */
  limit: z.number().nonnegative().optional(),
  /** Usage percentage */
  usagePercent: z.number().min(0).optional(),
  /** Remaining allowance */
  remaining: z.number().optional(),
  /** Overage amount */
  overage: z.number().nonnegative().optional(),
  /** Overage cost */
  overageCost: z.number().nonnegative().optional(),
});

// ============================================================================
// BUDGET
// ============================================================================

/** Budget allocation */
export const BudgetAllocationSchema = z.object({
  /** Budget ID */
  id: UUIDSchema,
  /** Budget name */
  name: z.string(),
  /** Budget amount */
  amount: z.number().nonnegative(),
  /** Currency/unit */
  currency: z.string(),
  /** Period */
  period: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'LIFETIME', 'PER_INTENT']),
  /** Period start */
  periodStart: TimestampSchema.optional(),
  /** Period end */
  periodEnd: TimestampSchema.optional(),
  /** Current spend */
  currentSpend: z.number().nonnegative().default(0),
  /** Remaining budget */
  remaining: z.number().nonnegative(),
  /** Alert thresholds (percentages) */
  alertThresholds: z.array(z.number().min(0).max(100)).optional(),
  /** Hard limit? (blocks at 100%) */
  hardLimit: z.boolean().default(true),
  /** Scope (what this budget applies to) */
  scope: z.object({
    type: z.enum(['ORGANIZATION', 'USER', 'AGENT', 'PROJECT', 'INTENT']),
    id: z.string(),
  }),
});

/** Budget check result */
export const BudgetCheckResultSchema = z.object({
  /** Budget ID */
  budgetId: UUIDSchema,
  /** Is within budget? */
  withinBudget: z.boolean(),
  /** Current spend */
  currentSpend: z.number().nonnegative(),
  /** Budget amount */
  budgetAmount: z.number().nonnegative(),
  /** Remaining */
  remaining: z.number(),
  /** Usage percentage */
  usagePercent: z.number(),
  /** Projected cost (for this intent) */
  projectedCost: z.number().nonnegative().optional(),
  /** Would exceed budget? */
  wouldExceed: z.boolean(),
  /** Alert triggered? */
  alertTriggered: z.boolean(),
  /** Alert threshold that was triggered */
  triggeredThreshold: z.number().optional(),
});

// ============================================================================
// RECEIPT
// ============================================================================

/** Line item on a receipt */
export const ReceiptLineItemSchema = z.object({
  /** Item description */
  description: z.string(),
  /** Feature ID */
  featureId: z.string().optional(),
  /** Quantity */
  quantity: z.number().nonnegative(),
  /** Unit */
  unit: z.string(),
  /** Unit price */
  unitPrice: z.number().nonnegative(),
  /** Line total */
  total: z.number().nonnegative(),
  /** Metadata */
  metadata: z.record(z.unknown()).optional(),
});

/** Usage receipt */
export const UsageReceiptSchema = z.object({
  /** Receipt ID */
  id: UUIDSchema,
  /** Receipt number (human-readable) */
  receiptNumber: z.string(),
  /** Organization ID */
  organizationId: z.string(),
  /** Period covered */
  periodStart: TimestampSchema,
  periodEnd: TimestampSchema,
  /** Line items */
  lineItems: z.array(ReceiptLineItemSchema),
  /** Subtotal */
  subtotal: z.number().nonnegative(),
  /** Discounts */
  discounts: z.array(z.object({
    description: z.string(),
    amount: z.number().nonnegative(),
  })).optional(),
  /** Taxes */
  taxes: z.array(z.object({
    description: z.string(),
    rate: z.number().min(0).max(1),
    amount: z.number().nonnegative(),
  })).optional(),
  /** Total */
  total: z.number().nonnegative(),
  /** Currency */
  currency: z.string(),
  /** Status */
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED']),
  /** Generated timestamp */
  generatedAt: TimestampSchema,
  /** Due date */
  dueDate: TimestampSchema.optional(),
  /** Payment date */
  paidAt: TimestampSchema.optional(),
});

// ============================================================================
// ENTITLEMENT SET (Main Schema)
// ============================================================================

/**
 * EntitlementSet defines what an entity is entitled to.
 * Enforced at authorization time, not just UI.
 */
export const EntitlementSetSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Entitlement set ID */
  id: UUIDSchema,
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),

  // ─── Subject ────────────────────────────────────────────────────────────────
  /** Who this entitlement applies to */
  subject: z.object({
    type: z.enum(['ORGANIZATION', 'USER', 'AGENT', 'API_KEY']),
    id: z.string(),
    name: z.string().optional(),
  }),

  // ─── Plan ───────────────────────────────────────────────────────────────────
  /** Plan tier */
  planTier: PlanTierSchema,
  /** Plan name */
  planName: z.string(),
  /** Plan ID */
  planId: z.string().optional(),
  /** Custom plan details */
  customPlanDetails: z.record(z.unknown()).optional(),

  // ─── Features ───────────────────────────────────────────────────────────────
  /** Feature entitlements */
  features: z.array(FeatureEntitlementSchema),

  // ─── Limits ─────────────────────────────────────────────────────────────────
  /** Global rate limits */
  rateLimits: z.object({
    /** Requests per minute */
    requestsPerMinute: z.number().int().positive().optional(),
    /** Requests per hour */
    requestsPerHour: z.number().int().positive().optional(),
    /** Requests per day */
    requestsPerDay: z.number().int().positive().optional(),
    /** Concurrent executions */
    concurrentExecutions: z.number().int().positive().optional(),
  }).optional(),

  // ─── Budgets ────────────────────────────────────────────────────────────────
  /** Budget allocations */
  budgets: z.array(BudgetAllocationSchema).optional(),

  // ─── Validity ───────────────────────────────────────────────────────────────
  /** Effective from */
  effectiveFrom: TimestampSchema,
  /** Effective until */
  effectiveUntil: TimestampSchema.optional(),
  /** Is currently active? */
  isActive: z.boolean().default(true),

  // ─── Metadata ───────────────────────────────────────────────────────────────
  /** Created timestamp */
  createdAt: TimestampSchema,
  /** Updated timestamp */
  updatedAt: TimestampSchema,
  /** Created by */
  createdBy: ActorSchema.optional(),
  /** Notes */
  notes: z.string().optional(),
});

// ============================================================================
// ENTITLEMENT CHECK
// ============================================================================

/** Request to check entitlement */
export const EntitlementCheckRequestSchema = z.object({
  /** Subject to check */
  subject: z.object({
    type: z.enum(['ORGANIZATION', 'USER', 'AGENT', 'API_KEY']),
    id: z.string(),
  }),
  /** Feature to check */
  featureId: z.string(),
  /** Quantity to check (for metered) */
  quantity: z.number().nonnegative().optional(),
  /** Intent ID (for context) */
  intentId: UUIDSchema.optional(),
});

/** Result of entitlement check */
export const EntitlementCheckResultSchema = z.object({
  /** Subject checked */
  subject: z.object({
    type: z.string(),
    id: z.string(),
  }),
  /** Feature checked */
  featureId: z.string(),
  /** Is entitled? */
  isEntitled: z.boolean(),
  /** Reason (if not entitled) */
  reason: z.string().optional(),
  /** Current usage (for metered) */
  currentUsage: z.number().nonnegative().optional(),
  /** Limit (for metered) */
  limit: z.number().nonnegative().optional(),
  /** Remaining (for metered) */
  remaining: z.number().optional(),
  /** Would cause overage? */
  wouldCauseOverage: z.boolean().optional(),
  /** Overage cost (if applicable) */
  overageCost: z.number().nonnegative().optional(),
  /** Budget check result */
  budgetCheck: BudgetCheckResultSchema.optional(),
  /** Check timestamp */
  checkedAt: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PlanTier = z.infer<typeof PlanTierSchema>;
export type FeatureDefinition = z.infer<typeof FeatureDefinitionSchema>;
export type FeatureEntitlement = z.infer<typeof FeatureEntitlementSchema>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;
export type UsageSummary = z.infer<typeof UsageSummarySchema>;
export type BudgetAllocation = z.infer<typeof BudgetAllocationSchema>;
export type BudgetCheckResult = z.infer<typeof BudgetCheckResultSchema>;
export type ReceiptLineItem = z.infer<typeof ReceiptLineItemSchema>;
export type UsageReceipt = z.infer<typeof UsageReceiptSchema>;
export type EntitlementSet = z.infer<typeof EntitlementSetSchema>;
export type EntitlementCheckRequest = z.infer<typeof EntitlementCheckRequestSchema>;
export type EntitlementCheckResult = z.infer<typeof EntitlementCheckResultSchema>;
