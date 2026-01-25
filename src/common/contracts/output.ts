/**
 * Universal Response Contracts for Vorion API
 * All API responses MUST conform to these shapes.
 */

import type { ID, Timestamp } from '../types.js';

// --- Response Envelope ---

export interface VorionResponse<T = unknown> {
  success: true;
  data: T;
  meta: ResponseMeta;
  trace?: Trace;
  evidence?: EvidenceItem[];
}

export interface VorionErrorResponse {
  success: false;
  error: ApiError;
  meta: ResponseMeta;
  trace?: Trace;
}

export type ApiResponse<T = unknown> = VorionResponse<T> | VorionErrorResponse;

// --- Metadata ---

export interface ResponseMeta {
  requestId: string;
  timestamp: Timestamp;
  version?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  count?: number;
  total?: number;
}

// --- Error Shape ---

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
}

// --- Trace ---

export interface Trace {
  traceId: string;
  spanId?: string;
  intent?: string;
  rigor?: 'light' | 'standard' | 'deep';
  evaluator?: string;
  ruleHits?: RuleHit[];
  timings?: StepTiming[];
}

export interface RuleHit {
  ruleId: string;
  ruleName: string;
  action: 'allow' | 'deny' | 'escalate' | 'limit' | 'monitor';
  reason?: string;
}

export interface StepTiming {
  step: string;
  durationMs: number;
  status: 'success' | 'failure' | 'skipped';
}

// --- Evidence ---

export interface EvidenceItem {
  type: 'input' | 'computed' | 'codepath' | 'external';
  pointer: string;
  summary: string;
  hash?: string;
}

// --- Confidence ---

export interface Confidence {
  score: number; // 0-1
  descriptor: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  assumptions: string[];
  invalidityConditions: string[];
}

// --- Helper Functions ---

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  options?: {
    trace?: Trace;
    evidence?: EvidenceItem[];
    pagination?: PaginationMeta;
  }
): VorionResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      pagination: options?.pagination,
    },
    trace: options?.trace,
    evidence: options?.evidence,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  options?: {
    details?: Record<string, unknown>;
    retryAfter?: number;
    trace?: Trace;
  }
): VorionErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details: options?.details,
      retryAfter: options?.retryAfter,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
    trace: options?.trace,
  };
}

export function isErrorResponse(response: ApiResponse): response is VorionErrorResponse {
  return response.success === false;
}
