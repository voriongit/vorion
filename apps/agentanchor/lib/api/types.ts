/**
 * API Types
 * Epic 8: API & Integration
 */

export type ApiKeyScope = 'read' | 'read_write' | 'admin'

export interface ApiKey {
  id: string
  user_id: string
  name: string
  key_prefix: string
  scope: ApiKeyScope
  is_test: boolean
  last_used_at?: string
  last_used_ip?: string
  expires_at?: string
  revoked: boolean
  revoked_at?: string
  created_at: string
}

export interface ApiUsage {
  id: string
  api_key_id?: string
  user_id?: string
  endpoint: string
  method: string
  status_code?: number
  response_time_ms?: number
  created_at: string
}

export interface RateLimitInfo {
  allowed: boolean
  remaining: number
  reset_at: string
  limit: number
}

export interface WebhookEvent {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, any>
  signature: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  attempts: number
  last_attempt_at?: string
  next_retry_at?: string
  response_status?: number
  response_body?: string
  error?: string
  created_at: string
  delivered_at?: string
}

// API Response format
export interface ApiResponse<T = any> {
  data?: T
  error?: {
    message: string
    code: string
    details?: Record<string, any>
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    cursor?: string
  }
}

// API Error codes
export const API_ERROR_CODES = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  RATE_LIMITED: 'rate_limited',
  INTERNAL_ERROR: 'internal_error',
  KEY_REVOKED: 'key_revoked',
  KEY_EXPIRED: 'key_expired',
  INSUFFICIENT_SCOPE: 'insufficient_scope',
} as const

// Rate limits by tier
export const RATE_LIMITS = {
  free: 100,
  pro: 1000,
  enterprise: 10000,
} as const

// Webhook event types
export const WEBHOOK_EVENT_TYPES = [
  'agent.created',
  'agent.updated',
  'agent.graduated',
  'agent.published',
  'council.decision',
  'council.escalation',
  'acquisition.created',
  'acquisition.terminated',
  'trust.changed',
  'trust.tier_change',
  'trust.violation',
  'trust.score_threshold',
  'observer.anomaly',
  'feedback.received',
  'payout.completed',
  'certification.applied',
  'certification.approved',
  'certification.denied',
  'certification.expired',
] as const

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number]

// OpenAPI spec metadata
export interface OpenApiEndpoint {
  path: string
  method: string
  summary: string
  description: string
  tags: string[]
  requestBody?: {
    required: boolean
    content: Record<string, any>
  }
  responses: Record<string, any>
  security?: Array<{ bearerAuth: string[] } | { apiKey: string[] }>
}
