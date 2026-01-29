/**
 * Cognigate TypeScript SDK - Type Definitions
 *
 * Core types for the Cognigate AI governance API
 */

import { z } from 'zod';

// =============================================================================
// TRUST TIERS (BASIS Framework)
// =============================================================================

export enum TrustTier {
  T0_SANDBOX = 0,
  T1_OBSERVED = 1,
  T2_PROVISIONAL = 2,
  T3_VERIFIED = 3,
  T4_OPERATIONAL = 4,
  T5_TRUSTED = 5,
  T6_CERTIFIED = 6,
  T7_AUTONOMOUS = 7,
}

export const TIER_THRESHOLDS: Record<TrustTier, { min: number; max: number; name: string }> = {
  [TrustTier.T0_SANDBOX]: { min: 0, max: 199, name: 'Sandbox' },
  [TrustTier.T1_OBSERVED]: { min: 200, max: 349, name: 'Observed' },
  [TrustTier.T2_PROVISIONAL]: { min: 350, max: 499, name: 'Provisional' },
  [TrustTier.T3_VERIFIED]: { min: 500, max: 649, name: 'Verified' },
  [TrustTier.T4_OPERATIONAL]: { min: 650, max: 799, name: 'Operational' },
  [TrustTier.T5_TRUSTED]: { min: 800, max: 875, name: 'Trusted' },
  [TrustTier.T6_CERTIFIED]: { min: 876, max: 949, name: 'Certified' },
  [TrustTier.T7_AUTONOMOUS]: { min: 950, max: 1000, name: 'Autonomous' },
};

// =============================================================================
// GOVERNANCE DECISIONS
// =============================================================================

export type GovernanceDecision = 'ALLOW' | 'DENY' | 'ESCALATE' | 'DEGRADE';

export interface GovernanceResult {
  decision: GovernanceDecision;
  trustScore: number;
  trustTier: TrustTier;
  grantedCapabilities: string[];
  deniedCapabilities: string[];
  reasoning: string;
  constraints?: Record<string, unknown>;
  proofId?: string;
  timestamp: Date;
}

// =============================================================================
// INTENT PARSING
// =============================================================================

export interface Intent {
  id: string;
  entityId: string;
  rawInput: string;
  parsedAction: string;
  parameters: Record<string, unknown>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredCapabilities: string[];
  timestamp: Date;
}

export interface IntentParseResult {
  intent: Intent;
  confidence: number;
  alternativeInterpretations?: Intent[];
}

// =============================================================================
// TRUST STATUS
// =============================================================================

export interface TrustStatus {
  entityId: string;
  trustScore: number;
  trustTier: TrustTier;
  tierName: string;
  capabilities: string[];
  factorScores: Record<string, number>;
  lastEvaluated: Date;
  compliant: boolean;
  warnings: string[];
}

// =============================================================================
// PROOF RECORDS (Immutable Audit Trail)
// =============================================================================

export interface ProofRecord {
  id: string;
  entityId: string;
  intentId: string;
  decision: GovernanceDecision;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'PENDING';
  trustScoreBefore: number;
  trustScoreAfter: number;
  timestamp: Date;
  hash: string;
  previousHash: string;
  metadata?: Record<string, unknown>;
}

export interface ProofChainStats {
  totalRecords: number;
  successRate: number;
  averageTrustScore: number;
  chainIntegrity: boolean;
  lastVerified: Date;
}

// =============================================================================
// AGENTS
// =============================================================================

export interface Agent {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  trustScore: number;
  trustTier: TrustTier;
  status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'TERMINATED';
  capabilities: string[];
  executions: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  template?: string;
  initialCapabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'PAUSED';
  metadata?: Record<string, unknown>;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId: string;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// WEBHOOKS
// =============================================================================

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  entityId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  signature: string;
}

export type WebhookEventType =
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'agent.status_changed'
  | 'trust.score_changed'
  | 'trust.tier_changed'
  | 'governance.decision'
  | 'proof.recorded'
  | 'alert.triggered';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface CognigateConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  debug?: boolean;
  webhookSecret?: string;
}

// =============================================================================
// ZOD SCHEMAS (for runtime validation)
// =============================================================================

export const TrustStatusSchema = z.object({
  entityId: z.string(),
  trustScore: z.number().min(0).max(1000),
  trustTier: z.nativeEnum(TrustTier),
  tierName: z.string(),
  capabilities: z.array(z.string()),
  factorScores: z.record(z.string(), z.number()),
  lastEvaluated: z.coerce.date(),
  compliant: z.boolean(),
  warnings: z.array(z.string()),
});

export const GovernanceResultSchema = z.object({
  decision: z.enum(['ALLOW', 'DENY', 'ESCALATE', 'DEGRADE']),
  trustScore: z.number(),
  trustTier: z.nativeEnum(TrustTier),
  grantedCapabilities: z.array(z.string()),
  deniedCapabilities: z.array(z.string()),
  reasoning: z.string(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  proofId: z.string().optional(),
  timestamp: z.coerce.date(),
});

export const ProofRecordSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  intentId: z.string(),
  decision: z.enum(['ALLOW', 'DENY', 'ESCALATE', 'DEGRADE']),
  action: z.string(),
  outcome: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING']),
  trustScoreBefore: z.number(),
  trustScoreAfter: z.number(),
  timestamp: z.coerce.date(),
  hash: z.string(),
  previousHash: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ownerId: z.string(),
  trustScore: z.number(),
  trustTier: z.nativeEnum(TrustTier),
  status: z.enum(['ACTIVE', 'PAUSED', 'SUSPENDED', 'TERMINATED']),
  capabilities: z.array(z.string()),
  executions: z.number(),
  successRate: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
