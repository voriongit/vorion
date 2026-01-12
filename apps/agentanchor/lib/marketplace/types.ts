/**
 * Marketplace Types
 * Epic 6: Marketplace & Acquisition
 */

export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'archived'
export type AcquisitionType = 'commission' | 'clone' | 'enterprise'
export type AcquisitionStatus = 'active' | 'paused' | 'terminated' | 'expired'
export type PayoutMethod = 'bank' | 'crypto' | 'paypal'
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type EarningStatus = 'pending' | 'available' | 'paid' | 'refunded'

export interface MarketplaceCategory {
  id: string
  name: string
  description?: string
  icon?: string
  parent_id?: string
  display_order: number
  is_active: boolean
}

export interface MarketplaceListing {
  id: string
  agent_id: string
  trainer_id: string
  title: string
  description: string
  short_description?: string
  category: string
  tags: string[]
  commission_rate: number
  complexity_multiplier: number
  platform_fee_percent: number
  status: ListingStatus
  featured: boolean
  featured_until?: string
  total_acquisitions: number
  total_tasks_completed: number
  total_earnings: number
  average_rating?: number
  rating_count: number
  published_at?: string
  created_at: string
  updated_at: string
}

export interface ListingWithAgent extends MarketplaceListing {
  agent: {
    id: string
    name: string
    description?: string
    trust_score: number
    trust_tier: string
    status: string
    capabilities?: unknown[]
  }
  trainer?: {
    id: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
}

export interface Acquisition {
  id: string
  listing_id: string
  agent_id: string
  consumer_id: string
  trainer_id: string
  acquisition_type: AcquisitionType
  status: AcquisitionStatus
  commission_rate_locked: number
  platform_fee_locked: number
  complexity_multiplier_locked: number
  clone_price_paid?: number
  enterprise_license_terms?: Record<string, unknown>
  total_tasks: number
  total_cost: number
  last_task_at?: string
  acquired_at: string
  terminated_at?: string
  termination_reason?: string
}

export interface AcquisitionWithDetails extends Acquisition {
  listing: MarketplaceListing
  agent: {
    id: string
    name: string
    trust_score: number
    trust_tier: string
  }
}

export interface AgentFeedback {
  id: string
  acquisition_id: string
  listing_id: string
  agent_id: string
  consumer_id: string
  rating: number
  title?: string
  review?: string
  is_verified: boolean
  is_complaint: boolean
  complaint_status?: 'pending' | 'investigating' | 'resolved' | 'dismissed'
  trainer_response?: string
  trainer_responded_at?: string
  tasks_completed_at_review: number
  created_at: string
  updated_at: string
}

export interface FeedbackWithConsumer extends AgentFeedback {
  consumer?: {
    id: string
    full_name?: string
    avatar_url?: string
  }
}

export interface TrainerEarning {
  id: string
  trainer_id: string
  acquisition_id: string
  listing_id: string
  agent_id: string
  task_id?: string
  task_type?: string
  task_complexity: number
  gross_amount: number
  platform_fee: number
  net_amount: number
  status: EarningStatus
  earned_at: string
  available_at?: string
  paid_at?: string
  payout_id?: string
}

export interface TrainerPayout {
  id: string
  trainer_id: string
  amount: number
  currency: string
  payout_method: PayoutMethod
  payout_details: Record<string, unknown>
  status: PayoutStatus
  external_id?: string
  external_status?: string
  requested_at: string
  processed_at?: string
  completed_at?: string
  failed_at?: string
  failure_reason?: string
}

export interface EarningsSummary {
  today: number
  this_week: number
  this_month: number
  all_time: number
  pending: number
  available: number
  total_tasks: number
}

export interface AcquisitionUsage {
  id: string
  acquisition_id: string
  agent_id: string
  consumer_id: string
  task_type: string
  tokens_input: number
  tokens_output: number
  complexity_factor: number
  base_cost: number
  final_cost: number
  created_at: string
}

// API Input Types
export interface CreateListingInput {
  agent_id: string
  title: string
  description: string
  short_description?: string
  category: string
  tags?: string[]
  commission_rate: number
  complexity_multiplier?: number
}

export interface UpdateListingInput {
  title?: string
  description?: string
  short_description?: string
  category?: string
  tags?: string[]
  commission_rate?: number
  complexity_multiplier?: number
  status?: ListingStatus
}

export interface CreateAcquisitionInput {
  listing_id: string
  acquisition_type?: AcquisitionType
}

export interface CreateFeedbackInput {
  acquisition_id: string
  rating: number
  title?: string
  review?: string
  is_complaint?: boolean
}

export interface ListingSearchParams {
  query?: string
  category?: string
  min_trust_score?: number
  max_commission?: number
  min_rating?: number
  tags?: string[]
  sort_by?: 'trust_score' | 'rating' | 'acquisitions' | 'newest' | 'price_low' | 'price_high'
  limit?: number
  offset?: number
}

// Platform fee by subscription tier (FR111)
export const PLATFORM_FEES = {
  free: 15.0,
  pro: 10.0,
  enterprise: 7.0,
} as const

export type SubscriptionTier = keyof typeof PLATFORM_FEES
