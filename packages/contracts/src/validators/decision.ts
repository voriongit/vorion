/**
 * Zod schemas for decision types
 */

import { z } from 'zod';
import { approvalTypeSchema, trustBandSchema } from './enums.js';
import type { Decision, DecisionConstraints, RateLimit, ApprovalRequirement } from '../v2/decision.js';

/** Rate limit validator */
export const rateLimitSchema = z.object({
  resource: z.string().min(1),
  limit: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
}) satisfies z.ZodType<RateLimit>;

/** Approval requirement validator */
export const approvalRequirementSchema = z.object({
  type: approvalTypeSchema,
  approver: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  reason: z.string().min(1),
}) satisfies z.ZodType<ApprovalRequirement>;

/** Decision constraints validator */
export const decisionConstraintsSchema = z.object({
  requiredApprovals: z.array(approvalRequirementSchema),
  allowedTools: z.array(z.string()),
  dataScopes: z.array(z.string()),
  rateLimits: z.array(rateLimitSchema),
  reversibilityRequired: z.boolean(),
  maxExecutionTimeMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  resourceQuotas: z.record(z.number()).optional(),
}) satisfies z.ZodType<DecisionConstraints>;

/** Decision validator */
export const decisionSchema = z.object({
  decisionId: z.string().uuid(),
  intentId: z.string().uuid(),
  agentId: z.string().uuid(),
  correlationId: z.string().uuid(),
  permitted: z.boolean(),
  constraints: decisionConstraintsSchema.optional(),
  trustBand: trustBandSchema,
  trustScore: z.number().min(0).max(100),
  policySetId: z.string().uuid().optional(),
  reasoning: z.array(z.string()),
  decidedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  latencyMs: z.number().min(0),
  version: z.number().int().min(0),
}) satisfies z.ZodType<Decision>;

/** Authorization request validator */
export const authorizationRequestSchema = z.object({
  intent: z.object({
    agentId: z.string().uuid(),
    action: z.string().min(1),
    actionType: z.string(),
    resourceScope: z.array(z.string()),
    dataSensitivity: z.string(),
    reversibility: z.string(),
    context: z.record(z.unknown()).optional(),
  }),
  policySetId: z.string().uuid().optional(),
  requestedConstraints: decisionConstraintsSchema.partial().optional(),
});

// Type inference from schemas
export type ValidatedDecision = z.infer<typeof decisionSchema>;
export type ValidatedDecisionConstraints = z.infer<typeof decisionConstraintsSchema>;
export type ValidatedAuthorizationRequest = z.infer<typeof authorizationRequestSchema>;
