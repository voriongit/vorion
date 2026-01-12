/**
 * Policy Set Schema
 *
 * Defines declarative policies that Agent Anchor enforces.
 * Per spec Section IV.1 (PINL):
 * - Policies are declarative and versioned
 * - Anchor validates structure, not meaning
 * - No legal interpretation is performed
 * - Policies are treated as authoritative facts
 *
 * Policy Sources:
 * - Governments / Regulators
 * - Enterprises / Organizations
 * - Customers
 * - Compliance vendors
 * - Internal governance teams
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  ActorSchema,
  AutonomyLevelSchema,
  RiskLevelSchema,
  ScopeSchema,
} from './common.js';

// ============================================================================
// POLICY TYPES
// ============================================================================

/** Classification of policy type */
export const PolicyTypeSchema = z.enum([
  'REGULATORY',       // Government/regulatory requirement
  'ORGANIZATIONAL',   // Enterprise/org policy
  'JURISDICTIONAL',   // Geographic/legal jurisdiction
  'INDUSTRY',         // Industry standard (e.g., HIPAA, PCI-DSS)
  'CONTRACTUAL',      // Contractual obligation
  'RISK',             // Risk management policy
  'ENTITLEMENT',      // Feature/access entitlement
  'ESCALATION',       // Escalation requirements
  'CUSTOM',           // Custom policy
]);

/** Policy status */
export const PolicyStatusSchema = z.enum([
  'DRAFT',            // Being developed
  'REVIEW',           // Under review
  'ACTIVE',           // Currently enforced
  'DEPRECATED',       // No longer recommended
  'RETIRED',          // No longer enforced
  'SUSPENDED',        // Temporarily disabled
]);

/** Policy enforcement mode */
export const EnforcementModeSchema = z.enum([
  'STRICT',           // Must be enforced, no exceptions
  'STANDARD',         // Enforced with documented exceptions
  'ADVISORY',         // Recommended, not enforced
  'AUDIT_ONLY',       // Log violations, don't block
]);

// ============================================================================
// POLICY APPLICABILITY
// ============================================================================

/** Defines when/where a policy applies */
export const PolicyApplicabilitySchema = z.object({
  /** Jurisdictions where policy applies (e.g., ['US', 'EU']) */
  jurisdictions: z.array(z.string()).optional(),
  /** Organization IDs where policy applies */
  organizations: z.array(z.string()).optional(),
  /** Environments where policy applies */
  environments: z.array(z.string()).optional(),
  /** Intent types this policy applies to */
  intentTypes: z.array(z.string()).optional(),
  /** Target types this policy applies to */
  targetTypes: z.array(z.string()).optional(),
  /** Actor types this policy applies to */
  actorTypes: z.array(z.string()).optional(),
  /** Risk levels that trigger this policy */
  riskLevels: z.array(RiskLevelSchema).optional(),
  /** Time-based applicability */
  effectiveFrom: TimestampSchema.optional(),
  effectiveUntil: TimestampSchema.optional(),
  /** Custom conditions (key-value matchers) */
  conditions: z.record(z.unknown()).optional(),
});

// ============================================================================
// POLICY RULES
// ============================================================================

/** Comparison operators for rules */
export const ComparisonOperatorSchema = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_OR_EQUAL',
  'LESS_OR_EQUAL',
  'CONTAINS',
  'NOT_CONTAINS',
  'MATCHES',          // Regex match
  'IN',               // Value in array
  'NOT_IN',
  'EXISTS',
  'NOT_EXISTS',
]);

/** Logical operators for combining conditions */
export const LogicalOperatorSchema = z.enum([
  'AND',
  'OR',
  'NOT',
]);

/** Single condition in a rule */
export const RuleConditionSchema = z.object({
  /** Field/path to evaluate */
  field: z.string(),
  /** Comparison operator */
  operator: ComparisonOperatorSchema,
  /** Value to compare against */
  value: z.unknown(),
  /** Case-insensitive comparison */
  caseInsensitive: z.boolean().optional(),
});

/** Combined conditions with logic */
export const RuleConditionGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    operator: LogicalOperatorSchema,
    conditions: z.array(
      z.union([RuleConditionSchema, RuleConditionGroupSchema])
    ),
  })
);

/** Action to take when rule matches */
export const RuleActionSchema = z.enum([
  'ALLOW',            // Permit the action
  'DENY',             // Block the action
  'REQUIRE_APPROVAL', // Require human approval
  'MODIFY',           // Modify constraints
  'ESCALATE',         // Trigger escalation
  'LOG',              // Log only (no enforcement)
  'ALERT',            // Send alert
  'RATE_LIMIT',       // Apply rate limiting
  'CONSTRAIN',        // Add execution constraints
]);

/** A single policy rule */
export const PolicyRuleSchema = z.object({
  /** Rule identifier */
  id: z.string().min(1),
  /** Rule name */
  name: z.string().min(1),
  /** Rule description */
  description: z.string().optional(),
  /** Priority (higher = evaluated first) */
  priority: z.number().int().default(100),
  /** Is this rule enabled? */
  enabled: z.boolean().default(true),
  /** Conditions that trigger this rule */
  conditions: z.union([RuleConditionSchema, RuleConditionGroupSchema]),
  /** Action to take when rule matches */
  action: RuleActionSchema,
  /** Constraints to apply (for MODIFY/CONSTRAIN actions) */
  constraints: ScopeSchema.optional(),
  /** Required autonomy level (for REQUIRE_APPROVAL) */
  requiredAutonomyLevel: AutonomyLevelSchema.optional(),
  /** Message to include in decision */
  message: z.string().optional(),
  /** Error code for denials */
  errorCode: z.string().optional(),
});

// ============================================================================
// POLICY SET (Main Schema)
// ============================================================================

/** Metadata about policy origin */
export const PolicyProvenanceSchema = z.object({
  /** Source organization/authority */
  source: z.string(),
  /** Source type */
  sourceType: PolicyTypeSchema,
  /** External reference (e.g., regulation ID) */
  externalReference: z.string().optional(),
  /** URL to authoritative source */
  sourceUrl: z.string().url().optional(),
  /** Last verified date */
  lastVerified: TimestampSchema.optional(),
  /** Verification method */
  verificationMethod: z.string().optional(),
});

/**
 * PolicySet is a collection of related policy rules.
 * Policies are declarative - Agent Anchor enforces them without interpretation.
 */
export const PolicySetSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Unique identifier */
  id: UUIDSchema,
  /** Policy name */
  name: z.string().min(1).max(200),
  /** Policy description */
  description: z.string().max(2000).optional(),
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),
  /** Policy version */
  version: SemVerSchema,

  // ─── Classification ─────────────────────────────────────────────────────────
  /** Policy type */
  type: PolicyTypeSchema,
  /** Current status */
  status: PolicyStatusSchema.default('ACTIVE'),
  /** Enforcement mode */
  enforcementMode: EnforcementModeSchema.default('STANDARD'),

  // ─── Provenance ─────────────────────────────────────────────────────────────
  /** Policy origin information */
  provenance: PolicyProvenanceSchema,
  /** Who created this policy definition */
  createdBy: ActorSchema,
  /** Creation timestamp */
  createdAt: TimestampSchema,
  /** Last update timestamp */
  updatedAt: TimestampSchema,

  // ─── Applicability ──────────────────────────────────────────────────────────
  /** When/where this policy applies */
  applicability: PolicyApplicabilitySchema,

  // ─── Rules ──────────────────────────────────────────────────────────────────
  /** Policy rules (evaluated in priority order) */
  rules: z.array(PolicyRuleSchema).min(1),

  // ─── Default Behavior ───────────────────────────────────────────────────────
  /** Default action if no rules match */
  defaultAction: RuleActionSchema.default('ALLOW'),
  /** Default constraints to apply */
  defaultConstraints: ScopeSchema.optional(),

  // ─── Metadata ───────────────────────────────────────────────────────────────
  /** Tags for categorization */
  tags: z.array(z.string()).optional(),
  /** Custom metadata */
  metadata: z.record(z.unknown()).optional(),

  // ─── Integrity ──────────────────────────────────────────────────────────────
  /** Hash of policy content */
  contentHash: z.string().optional(),
  /** Digital signature */
  signature: z.string().optional(),
});

// ============================================================================
// POLICY EVALUATION RESULT
// ============================================================================

/** Result of evaluating a single rule */
export const RuleEvaluationResultSchema = z.object({
  /** Rule ID */
  ruleId: z.string(),
  /** Rule name */
  ruleName: z.string(),
  /** Did the rule match? */
  matched: z.boolean(),
  /** Action determined by rule */
  action: RuleActionSchema.optional(),
  /** Constraints to apply */
  constraints: ScopeSchema.optional(),
  /** Evaluation details */
  details: z.string().optional(),
});

/** Result of evaluating a policy set against an intent */
export const PolicyEvaluationResultSchema = z.object({
  /** Policy ID */
  policyId: UUIDSchema,
  /** Policy name */
  policyName: z.string(),
  /** Policy version */
  policyVersion: SemVerSchema,
  /** Was the policy applicable? */
  wasApplicable: z.boolean(),
  /** Rule evaluation results */
  ruleResults: z.array(RuleEvaluationResultSchema),
  /** Final action from this policy */
  finalAction: RuleActionSchema,
  /** Aggregated constraints */
  constraints: ScopeSchema.optional(),
  /** Messages from rules */
  messages: z.array(z.string()).optional(),
  /** Evaluation timestamp */
  evaluatedAt: TimestampSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PolicyType = z.infer<typeof PolicyTypeSchema>;
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;
export type EnforcementMode = z.infer<typeof EnforcementModeSchema>;
export type PolicyApplicability = z.infer<typeof PolicyApplicabilitySchema>;
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;
export type LogicalOperator = z.infer<typeof LogicalOperatorSchema>;
export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;
export type PolicyProvenance = z.infer<typeof PolicyProvenanceSchema>;
export type PolicySet = z.infer<typeof PolicySetSchema>;
export type RuleEvaluationResult = z.infer<typeof RuleEvaluationResultSchema>;
export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;
