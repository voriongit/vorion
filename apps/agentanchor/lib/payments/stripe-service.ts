/**
 * Stripe Service - Payment and payout management
 * FR109-115: Commission and payment handling
 */

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
})

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'

export const PLATFORM_FEES: Record<SubscriptionTier, number> = {
  free: 0.15,    // 15%
  pro: 0.10,     // 10%
  enterprise: 0.07, // 7%
}

export const COMPLEXITY_MULTIPLIERS = {
  simple: 1,
  standard: 2,
  complex: 5,
  critical: 10,
}

export interface PayoutAccount {
  id: string
  userId: string
  stripeAccountId: string | null
  stripeAccountStatus: string
  stripeOnboardingComplete: boolean
  payoutMethod: 'bank_transfer' | 'stripe' | 'crypto'
  payoutSchedule: string
  payoutThreshold: number
  subscriptionTier: SubscriptionTier
}

export interface Payout {
  id: string
  trainerId: string
  amount: number
  currency: string
  platformFee: number
  netAmount: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  stripeTransferId?: string
  periodStart?: string
  periodEnd?: string
  breakdown: {
    commissions: number
    cloneRoyalties: number
    enterpriseFees: number
    adjustments: number
  }
  requestedAt: string
  processedAt?: string
  completedAt?: string
}

export interface UsageRecord {
  consumerId: string
  agentId: string
  trainerId: string
  taskCount: number
  complexityMultiplier: number
  grossAmount: number
  platformFee: number
  trainerEarning: number
}

// ============================================================================
// Stripe Connect Onboarding
// ============================================================================

/**
 * Create a Stripe Connect account for a trainer
 */
export async function createConnectAccount(
  userId: string,
  email: string,
  country = 'US'
): Promise<{ accountId: string; onboardingUrl: string }> {
  // Create Express account
  const account = await stripe.accounts.create({
    type: 'express',
    country,
    email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      userId,
      platform: 'agentanchor',
    },
  })

  // Save to database
  const supabase = createClient()
  await supabase
    .from('payout_accounts')
    .upsert({
      user_id: userId,
      stripe_account_id: account.id,
      stripe_account_status: 'pending',
      stripe_onboarding_complete: false,
    }, {
      onConflict: 'user_id'
    })

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payouts?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payouts?success=true`,
    type: 'account_onboarding',
  })

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  }
}

/**
 * Get Stripe Connect onboarding link for incomplete accounts
 */
export async function getOnboardingLink(
  stripeAccountId: string
): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payouts?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payouts?success=true`,
    type: 'account_onboarding',
  })

  return accountLink.url
}

/**
 * Check Stripe account status and update database
 */
export async function syncAccountStatus(
  userId: string,
  stripeAccountId: string
): Promise<{
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}> {
  const account = await stripe.accounts.retrieve(stripeAccountId)

  const status = {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  }

  // Update database
  const supabase = createClient()
  await supabase
    .from('payout_accounts')
    .update({
      stripe_account_status: status.payoutsEnabled ? 'active' : 'pending',
      stripe_onboarding_complete: status.detailsSubmitted && status.payoutsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return status
}

/**
 * Get payout account for a user
 */
export async function getPayoutAccount(userId: string): Promise<PayoutAccount | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('payout_accounts')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    userId: data.user_id,
    stripeAccountId: data.stripe_account_id,
    stripeAccountStatus: data.stripe_account_status,
    stripeOnboardingComplete: data.stripe_onboarding_complete,
    payoutMethod: data.payout_method,
    payoutSchedule: data.payout_schedule,
    payoutThreshold: parseFloat(data.payout_threshold || '100'),
    subscriptionTier: data.subscription_tier,
  }
}

// ============================================================================
// Usage Tracking & Billing
// ============================================================================

/**
 * Record usage for billing
 */
export async function recordUsage(
  consumerId: string,
  agentId: string,
  trainerId: string,
  taskCount: number,
  complexity: keyof typeof COMPLEXITY_MULTIPLIERS,
  baseRate: number, // Price per task
  subscriptionTier: SubscriptionTier = 'free'
): Promise<UsageRecord> {
  const multiplier = COMPLEXITY_MULTIPLIERS[complexity]
  const grossAmount = taskCount * baseRate * multiplier
  const platformFee = grossAmount * PLATFORM_FEES[subscriptionTier]
  const trainerEarning = grossAmount - platformFee

  const supabase = createClient()

  await supabase.from('usage_billing').insert({
    consumer_id: consumerId,
    agent_id: agentId,
    trainer_id: trainerId,
    task_count: taskCount,
    complexity_multiplier: multiplier,
    gross_amount: grossAmount.toFixed(2),
    platform_fee: platformFee.toFixed(2),
    trainer_earning: trainerEarning.toFixed(2),
    task_type: complexity,
  })

  return {
    consumerId,
    agentId,
    trainerId,
    taskCount,
    complexityMultiplier: multiplier,
    grossAmount,
    platformFee,
    trainerEarning,
  }
}

/**
 * Get pending earnings for a trainer
 */
export async function getPendingEarnings(trainerId: string): Promise<number> {
  const supabase = createClient()

  const { data } = await supabase
    .from('usage_billing')
    .select('trainer_earning')
    .eq('trainer_id', trainerId)
    .eq('billed', false)

  if (!data) return 0

  return data.reduce((sum, row) => sum + parseFloat(row.trainer_earning), 0)
}

/**
 * Get earnings breakdown for a trainer
 */
export async function getEarningsBreakdown(
  trainerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  total: number
  byAgent: Record<string, number>
  byDay: Record<string, number>
}> {
  const supabase = createClient()

  const { data } = await supabase
    .from('usage_billing')
    .select('agent_id, trainer_earning, created_at')
    .eq('trainer_id', trainerId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (!data) {
    return { total: 0, byAgent: {}, byDay: {} }
  }

  const byAgent: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  let total = 0

  for (const row of data) {
    const earning = parseFloat(row.trainer_earning)
    total += earning

    // By agent
    byAgent[row.agent_id] = (byAgent[row.agent_id] || 0) + earning

    // By day
    const day = new Date(row.created_at).toISOString().split('T')[0]
    byDay[day] = (byDay[day] || 0) + earning
  }

  return { total, byAgent, byDay }
}

// ============================================================================
// Payouts
// ============================================================================

/**
 * Request a payout
 */
export async function requestPayout(
  trainerId: string
): Promise<{ success: boolean; payout?: Payout; error?: string }> {
  const supabase = createClient()

  // Get payout account
  const account = await getPayoutAccount(trainerId)
  if (!account || !account.stripeOnboardingComplete) {
    return { success: false, error: 'Payout account not set up or incomplete' }
  }

  // Get pending earnings
  const pendingEarnings = await getPendingEarnings(trainerId)
  if (pendingEarnings < account.payoutThreshold) {
    return {
      success: false,
      error: `Minimum payout threshold is $${account.payoutThreshold}. Current balance: $${pendingEarnings.toFixed(2)}`
    }
  }

  // Get unbilled usage records
  const { data: unbilledRecords } = await supabase
    .from('usage_billing')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('billed', false)

  if (!unbilledRecords || unbilledRecords.length === 0) {
    return { success: false, error: 'No earnings to pay out' }
  }

  // Calculate amounts
  const grossAmount = unbilledRecords.reduce((sum, r) => sum + parseFloat(r.gross_amount), 0)
  const platformFee = unbilledRecords.reduce((sum, r) => sum + parseFloat(r.platform_fee), 0)
  const netAmount = unbilledRecords.reduce((sum, r) => sum + parseFloat(r.trainer_earning), 0)

  // Create payout record
  const { data: payout, error: payoutError } = await supabase
    .from('payouts')
    .insert({
      trainer_id: trainerId,
      account_id: account.id,
      amount: grossAmount.toFixed(2),
      platform_fee: platformFee.toFixed(2),
      net_amount: netAmount.toFixed(2),
      status: 'pending',
      period_start: unbilledRecords[unbilledRecords.length - 1].created_at,
      period_end: unbilledRecords[0].created_at,
      breakdown: {
        commissions: netAmount,
        cloneRoyalties: 0,
        enterpriseFees: 0,
        adjustments: 0,
      },
    })
    .select()
    .single()

  if (payoutError) {
    return { success: false, error: payoutError.message }
  }

  // Mark records as billed
  const recordIds = unbilledRecords.map(r => r.id)
  await supabase
    .from('usage_billing')
    .update({
      billed: true,
      billed_at: new Date().toISOString(),
      payout_id: payout.id,
    })
    .in('id', recordIds)

  return {
    success: true,
    payout: {
      id: payout.id,
      trainerId: payout.trainer_id,
      amount: grossAmount,
      currency: 'usd',
      platformFee,
      netAmount,
      status: 'pending',
      breakdown: payout.breakdown,
      requestedAt: payout.requested_at,
    },
  }
}

/**
 * Process a pending payout via Stripe
 */
export async function processPayout(
  payoutId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Get payout
  const { data: payout } = await supabase
    .from('payouts')
    .select('*, account:payout_accounts(*)')
    .eq('id', payoutId)
    .single()

  if (!payout) {
    return { success: false, error: 'Payout not found' }
  }

  if (payout.status !== 'pending') {
    return { success: false, error: 'Payout already processed' }
  }

  const stripeAccountId = payout.account?.stripe_account_id
  if (!stripeAccountId) {
    return { success: false, error: 'No Stripe account linked' }
  }

  try {
    // Update status to processing
    await supabase
      .from('payouts')
      .update({ status: 'processing', processed_at: new Date().toISOString() })
      .eq('id', payoutId)

    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(parseFloat(payout.net_amount) * 100), // Convert to cents
      currency: 'usd',
      destination: stripeAccountId,
      metadata: {
        payoutId: payout.id,
        trainerId: payout.trainer_id,
        platform: 'agentanchor',
      },
    })

    // Update payout with transfer ID
    await supabase
      .from('payouts')
      .update({
        status: 'completed',
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', payoutId)

    return { success: true }
  } catch (error: any) {
    // Update status to failed
    await supabase
      .from('payouts')
      .update({
        status: 'failed',
        failure_reason: error.message,
        retry_count: (payout.retry_count || 0) + 1,
      })
      .eq('id', payoutId)

    return { success: false, error: error.message }
  }
}

/**
 * Get payout history for a trainer
 */
export async function getPayoutHistory(
  trainerId: string,
  limit = 20
): Promise<Payout[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('payouts')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('requested_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map(p => ({
    id: p.id,
    trainerId: p.trainer_id,
    amount: parseFloat(p.amount),
    currency: p.currency,
    platformFee: parseFloat(p.platform_fee),
    netAmount: parseFloat(p.net_amount),
    status: p.status,
    stripeTransferId: p.stripe_transfer_id,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    breakdown: p.breakdown,
    requestedAt: p.requested_at,
    processedAt: p.processed_at,
    completedAt: p.completed_at,
  }))
}
