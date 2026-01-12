/**
 * Zod schemas for trust profile types
 */

import { z } from 'zod';
import { observationTierSchema, trustBandSchema } from './enums.js';
import type { TrustDimensions, TrustWeights, TrustProfile, TrustEvidence } from '../v2/trust-profile.js';

/** Score range validator (0-100) */
const scoreSchema = z.number().min(0).max(100);

/** Trust dimensions validator */
export const trustDimensionsSchema = z.object({
  CT: scoreSchema,
  BT: scoreSchema,
  GT: scoreSchema,
  XT: scoreSchema,
  AC: scoreSchema,
}) satisfies z.ZodType<TrustDimensions>;

/** Base trust weights object schema (without sum validation) */
const trustWeightsBaseSchema = z.object({
  CT: z.number().min(0).max(1),
  BT: z.number().min(0).max(1),
  GT: z.number().min(0).max(1),
  XT: z.number().min(0).max(1),
  AC: z.number().min(0).max(1),
});

/** Trust weights validator (must sum to 1.0) */
export const trustWeightsSchema = trustWeightsBaseSchema.refine(
  (weights) => {
    const sum = weights.CT + weights.BT + weights.GT + weights.XT + weights.AC;
    return Math.abs(sum - 1.0) < 0.001; // Allow small floating point variance
  },
  { message: 'Trust weights must sum to 1.0' }
) satisfies z.ZodType<TrustWeights>;

/** Partial trust weights for optional overrides */
export const partialTrustWeightsSchema = trustWeightsBaseSchema.partial();

/** Dimension key validator */
export const dimensionKeySchema = z.enum(['CT', 'BT', 'GT', 'XT', 'AC']);

/** Trust evidence validator */
export const trustEvidenceSchema = z.object({
  evidenceId: z.string().uuid(),
  dimension: dimensionKeySchema,
  impact: z.number().min(-100).max(100),
  source: z.string().min(1),
  collectedAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<TrustEvidence>;

/** Trust profile validator */
export const trustProfileSchema = z.object({
  profileId: z.string().uuid(),
  agentId: z.string().uuid(),
  dimensions: trustDimensionsSchema,
  weights: trustWeightsSchema,
  compositeScore: scoreSchema,
  observationTier: observationTierSchema,
  adjustedScore: scoreSchema,
  band: trustBandSchema,
  calculatedAt: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  evidence: z.array(trustEvidenceSchema),
  version: z.number().int().min(0),
}) satisfies z.ZodType<TrustProfile>;

/** Trust calculation request validator */
export const trustCalculationRequestSchema = z.object({
  agentId: z.string().uuid(),
  observationTier: observationTierSchema,
  evidence: z.array(trustEvidenceSchema),
  weights: partialTrustWeightsSchema.optional(),
});

// Type inference from schemas
export type ValidatedTrustDimensions = z.infer<typeof trustDimensionsSchema>;
export type ValidatedTrustWeights = z.infer<typeof trustWeightsSchema>;
export type ValidatedTrustEvidence = z.infer<typeof trustEvidenceSchema>;
export type ValidatedTrustProfile = z.infer<typeof trustProfileSchema>;
export type ValidatedTrustCalculationRequest = z.infer<typeof trustCalculationRequestSchema>;
