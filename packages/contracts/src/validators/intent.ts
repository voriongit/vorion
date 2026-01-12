/**
 * Zod schemas for intent types
 */

import { z } from 'zod';
import { actionTypeSchema, dataSensitivitySchema, reversibilitySchema } from './enums.js';
import type { Intent, IntentContext, CreateIntentRequest } from '../v2/intent.js';

/** Intent context validator */
export const intentContextSchema = z.object({
  domain: z.string().optional(),
  environment: z.enum(['production', 'staging', 'development']).optional(),
  onBehalfOf: z.string().optional(),
  sessionId: z.string().optional(),
  parentIntentId: z.string().uuid().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  handlesPii: z.boolean().optional(),
  handlesPhi: z.boolean().optional(),
  jurisdictions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<IntentContext>;

/** Intent validator */
export const intentSchema = z.object({
  intentId: z.string().uuid(),
  agentId: z.string().uuid(),
  correlationId: z.string().uuid(),
  action: z.string().min(1).max(1000),
  actionType: actionTypeSchema,
  resourceScope: z.array(z.string()),
  dataSensitivity: dataSensitivitySchema,
  reversibility: reversibilitySchema,
  context: intentContextSchema,
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  source: z.string().optional(),
}) satisfies z.ZodType<Intent>;

/** Create intent request validator */
export const createIntentRequestSchema = z.object({
  agentId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
  action: z.string().min(1).max(1000),
  actionType: actionTypeSchema,
  resourceScope: z.array(z.string()),
  dataSensitivity: dataSensitivitySchema,
  reversibility: reversibilitySchema,
  context: intentContextSchema.partial().optional(),
  expiresIn: z.number().int().positive().optional(),
  source: z.string().optional(),
}) satisfies z.ZodType<CreateIntentRequest>;

// Type inference from schemas
export type ValidatedIntent = z.infer<typeof intentSchema>;
export type ValidatedIntentContext = z.infer<typeof intentContextSchema>;
export type ValidatedCreateIntentRequest = z.infer<typeof createIntentRequestSchema>;
