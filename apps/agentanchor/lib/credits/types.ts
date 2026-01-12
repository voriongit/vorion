/**
 * Anchor Credits (AC) Type Definitions
 * Currency system for agent acquisition
 */

export interface UserWallet {
  user_id: string
  balance: number
  lifetime_earned: number
  lifetime_spent: number
  created_at: string
  updated_at: string
}

export type TransactionType =
  | 'signup_bonus'
  | 'admin_grant'
  | 'purchase'
  | 'commission_earned'
  | 'commission_paid'
  | 'clone_purchase'
  | 'clone_sale'
  | 'enterprise_purchase'
  | 'enterprise_sale'
  | 'subscription_charge'
  | 'refund'
  | 'platform_fee'

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number // positive = credit, negative = debit
  balance_after: number
  type: TransactionType
  reference_type?: 'acquisition' | 'listing' | 'subscription' | null
  reference_id?: string | null
  description?: string
  created_at: string
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired'
export type BillingType = 'per_task' | 'monthly' | 'annual'

export interface AgentSubscription {
  id: string
  user_id: string
  agent_id: string
  listing_id?: string | null
  status: SubscriptionStatus
  billing_type: BillingType
  rate: number // AC per task or per period
  tasks_used: number
  tasks_limit?: number | null
  started_at: string
  current_period_start: string
  current_period_end?: string | null
  cancelled_at?: string | null
}

export interface AgentClone {
  id: string
  original_agent_id: string
  cloned_agent_id: string
  cloned_by: string
  clone_price: number
  acquisition_id?: string | null
  created_at: string
}

// Acquisition models
export type AcquisitionModel = 'commission' | 'clone' | 'enterprise'

export interface AcquisitionOption {
  model: AcquisitionModel
  enabled: boolean
  price: number // AC
  description: string
}

export interface AgentPricing {
  agent_id: string
  listing_id?: string
  commission: AcquisitionOption
  clone: AcquisitionOption
  enterprise: AcquisitionOption
}

// Revenue split percentages
export const REVENUE_SPLIT = {
  trainer: 0.70,    // 70% to agent trainer/owner
  platform: 0.20,   // 20% to AgentAnchor platform
  validators: 0.10, // 10% to council validators
} as const

// Default pricing
export const DEFAULT_PRICING = {
  commission_rate: 5,      // 5 AC per task
  clone_price: 150,        // 150 AC one-time
  enterprise_price: 2000,  // 2000 AC full transfer
  signup_bonus: 500,       // New users get 500 AC
} as const
