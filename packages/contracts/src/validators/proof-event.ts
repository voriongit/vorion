/**
 * Zod schemas for proof event types
 */

import { z } from 'zod';
import { proofEventTypeSchema } from './enums.js';
import type { ProofEvent, ProofEventFilter, LogProofEventRequest } from '../v2/proof-event.js';

/** SHA-256 hash pattern */
const sha256Pattern = /^[a-f0-9]{64}$/i;

/** Payload type discriminators */
const intentReceivedPayloadSchema = z.object({
  type: z.literal('intent_received'),
  intentId: z.string().uuid(),
  action: z.string(),
  actionType: z.string(),
  resourceScope: z.array(z.string()),
});

const decisionMadePayloadSchema = z.object({
  type: z.literal('decision_made'),
  decisionId: z.string().uuid(),
  intentId: z.string().uuid(),
  permitted: z.boolean(),
  trustBand: z.string(),
  trustScore: z.number(),
  reasoning: z.array(z.string()),
});

const trustDeltaPayloadSchema = z.object({
  type: z.literal('trust_delta'),
  deltaId: z.string().uuid(),
  previousScore: z.number(),
  newScore: z.number(),
  previousBand: z.string(),
  newBand: z.string(),
  reason: z.string(),
});

const executionStartedPayloadSchema = z.object({
  type: z.literal('execution_started'),
  executionId: z.string().uuid(),
  actionId: z.string().uuid(),
  decisionId: z.string().uuid(),
  adapterId: z.string(),
});

const executionCompletedPayloadSchema = z.object({
  type: z.literal('execution_completed'),
  executionId: z.string().uuid(),
  actionId: z.string().uuid(),
  status: z.enum(['success', 'partial']),
  durationMs: z.number(),
  outputHash: z.string(),
});

const executionFailedPayloadSchema = z.object({
  type: z.literal('execution_failed'),
  executionId: z.string().uuid(),
  actionId: z.string().uuid(),
  error: z.string(),
  durationMs: z.number(),
  retryable: z.boolean(),
});

const incidentDetectedPayloadSchema = z.object({
  type: z.literal('incident_detected'),
  incidentId: z.string().uuid(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  affectedResources: z.array(z.string()),
});

const rollbackInitiatedPayloadSchema = z.object({
  type: z.literal('rollback_initiated'),
  rollbackId: z.string().uuid(),
  executionId: z.string().uuid(),
  reason: z.string(),
  initiatedBy: z.string(),
});

const componentRegisteredPayloadSchema = z.object({
  type: z.literal('component_registered'),
  componentId: z.string().uuid(),
  componentType: z.string(),
  name: z.string(),
  version: z.string(),
});

const componentUpdatedPayloadSchema = z.object({
  type: z.literal('component_updated'),
  componentId: z.string().uuid(),
  changes: z.array(z.string()),
  previousVersion: z.string().optional(),
  newVersion: z.string().optional(),
});

const genericPayloadSchema = z.object({
  type: z.string(),
}).passthrough();

/** Union of all payload types */
export const proofEventPayloadSchema = z.discriminatedUnion('type', [
  intentReceivedPayloadSchema,
  decisionMadePayloadSchema,
  trustDeltaPayloadSchema,
  executionStartedPayloadSchema,
  executionCompletedPayloadSchema,
  executionFailedPayloadSchema,
  incidentDetectedPayloadSchema,
  rollbackInitiatedPayloadSchema,
  componentRegisteredPayloadSchema,
  componentUpdatedPayloadSchema,
]).or(genericPayloadSchema);

/** Proof event validator */
export const proofEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: proofEventTypeSchema,
  correlationId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  payload: proofEventPayloadSchema,
  previousHash: z.string().regex(sha256Pattern).nullable(),
  eventHash: z.string().regex(sha256Pattern),
  occurredAt: z.coerce.date(),
  recordedAt: z.coerce.date(),
  signedBy: z.string().optional(),
  signature: z.string().optional(),
}) satisfies z.ZodType<ProofEvent>;

/** Proof event filter validator */
export const proofEventFilterSchema = z.object({
  correlationId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  eventTypes: z.array(proofEventTypeSchema).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().min(0).optional(),
}) satisfies z.ZodType<ProofEventFilter>;

/** Log proof event request validator */
export const logProofEventRequestSchema = z.object({
  eventType: proofEventTypeSchema,
  correlationId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  payload: proofEventPayloadSchema,
  occurredAt: z.coerce.date().optional(),
  signedBy: z.string().optional(),
}) satisfies z.ZodType<LogProofEventRequest>;

// Type inference from schemas
export type ValidatedProofEvent = z.infer<typeof proofEventSchema>;
export type ValidatedProofEventFilter = z.infer<typeof proofEventFilterSchema>;
export type ValidatedLogProofEventRequest = z.infer<typeof logProofEventRequestSchema>;
