/**
 * Earnings Service
 * Story 6-6: Earnings Dashboard & Payouts (FR16, FR112-FR115)
 */

import { createClient } from '@/lib/supabase/server'
import {
  TrainerEarning,
  TrainerPayout,
  EarningsSummary,
  PayoutMethod,
} from './types'

// Minimum payout threshold (FR113)
const MIN_PAYOUT_THRESHOLD = 100.0

/**
 * Get earnings summary for trainer (FR112)
 */
export async function getEarningsSummary(trainerId: string): Promise<EarningsSummary> {
  const supabase = createClient()

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Get all earnings
  const { data: earnings, error } = await supabase
    .from('trainer_earnings')
    .select('net_amount, status, earned_at')
    .eq('trainer_id', trainerId)

  if (error) {
    throw new Error(`Failed to fetch earnings: ${error.message}`)
  }

  let today = 0
  let thisWeek = 0
  let thisMonth = 0
  let allTime = 0
  let pending = 0
  let available = 0
  let totalTasks = 0

  for (const earning of earnings || []) {
    const amount = Number(earning.net_amount)
    allTime += amount
    totalTasks++

    if (earning.earned_at >= startOfToday) {
      today += amount
    }
    if (earning.earned_at >= startOfWeek) {
      thisWeek += amount
    }
    if (earning.earned_at >= startOfMonth) {
      thisMonth += amount
    }

    if (earning.status === 'pending') {
      pending += amount
    } else if (earning.status === 'available') {
      available += amount
    }
  }

  return {
    today: Math.round(today * 100) / 100,
    this_week: Math.round(thisWeek * 100) / 100,
    this_month: Math.round(thisMonth * 100) / 100,
    all_time: Math.round(allTime * 100) / 100,
    pending: Math.round(pending * 100) / 100,
    available: Math.round(available * 100) / 100,
    total_tasks: totalTasks,
  }
}

/**
 * Get earnings history
 */
export async function getEarningsHistory(
  trainerId: string,
  limit: number = 50,
  offset: number = 0,
  status?: string
): Promise<{ earnings: TrainerEarning[]; total: number }> {
  const supabase = createClient()

  let query = supabase
    .from('trainer_earnings')
    .select('*', { count: 'exact' })
    .eq('trainer_id', trainerId)

  if (status) {
    query = query.eq('status', status)
  }

  query = query
    .order('earned_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch earnings history: ${error.message}`)
  }

  return {
    earnings: data || [],
    total: count || 0,
  }
}

/**
 * Get earnings by agent
 */
export async function getEarningsByAgent(
  trainerId: string
): Promise<{ agent_id: string; agent_name: string; total: number; tasks: number }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trainer_earnings')
    .select(`
      agent_id,
      net_amount,
      agent:bots(name)
    `)
    .eq('trainer_id', trainerId)

  if (error) {
    throw new Error(`Failed to fetch earnings by agent: ${error.message}`)
  }

  // Aggregate by agent
  const byAgent: { [key: string]: { name: string; total: number; tasks: number } } = {}

  for (const earning of data || []) {
    if (!byAgent[earning.agent_id]) {
      byAgent[earning.agent_id] = {
        name: (earning.agent as any)?.name || 'Unknown',
        total: 0,
        tasks: 0,
      }
    }
    byAgent[earning.agent_id].total += Number(earning.net_amount)
    byAgent[earning.agent_id].tasks++
  }

  return Object.entries(byAgent)
    .map(([agent_id, data]) => ({
      agent_id,
      agent_name: data.name,
      total: Math.round(data.total * 100) / 100,
      tasks: data.tasks,
    }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Get earnings over time (for charts)
 */
export async function getEarningsTimeline(
  trainerId: string,
  days: number = 30
): Promise<{ date: string; amount: number }[]> {
  const supabase = createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('trainer_earnings')
    .select('net_amount, earned_at')
    .eq('trainer_id', trainerId)
    .gte('earned_at', startDate.toISOString())
    .order('earned_at')

  if (error) {
    throw new Error(`Failed to fetch earnings timeline: ${error.message}`)
  }

  // Aggregate by day
  const byDay: { [key: string]: number } = {}

  for (const earning of data || []) {
    const date = earning.earned_at.split('T')[0]
    byDay[date] = (byDay[date] || 0) + Number(earning.net_amount)
  }

  // Fill in missing days
  const result: { date: string; amount: number }[] = []
  const current = new Date(startDate)
  const end = new Date()

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    result.push({
      date: dateStr,
      amount: Math.round((byDay[dateStr] || 0) * 100) / 100,
    })
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * Request a payout (FR113, FR114)
 */
export async function requestPayout(
  trainerId: string,
  amount: number,
  method: PayoutMethod,
  payoutDetails: Record<string, unknown>
): Promise<TrainerPayout> {
  const supabase = createClient()

  // Check available balance
  const { available } = await getEarningsSummary(trainerId)

  if (amount > available) {
    throw new Error(`Insufficient balance. Available: $${available.toFixed(2)}`)
  }

  if (amount < MIN_PAYOUT_THRESHOLD) {
    throw new Error(`Minimum payout amount is $${MIN_PAYOUT_THRESHOLD}`)
  }

  // Create payout request
  const { data: payout, error: createError } = await supabase
    .from('trainer_payouts')
    .insert({
      trainer_id: trainerId,
      amount,
      payout_method: method,
      payout_details: payoutDetails,
      status: 'pending',
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create payout request: ${createError.message}`)
  }

  // Mark earnings as paid (up to requested amount)
  const { data: pendingEarnings, error: fetchError } = await supabase
    .from('trainer_earnings')
    .select('id, net_amount')
    .eq('trainer_id', trainerId)
    .eq('status', 'available')
    .order('earned_at')

  if (!fetchError && pendingEarnings) {
    let remaining = amount
    const earningIds: string[] = []

    for (const earning of pendingEarnings) {
      if (remaining <= 0) break
      earningIds.push(earning.id)
      remaining -= Number(earning.net_amount)
    }

    if (earningIds.length > 0) {
      await supabase
        .from('trainer_earnings')
        .update({
          status: 'paid',
          payout_id: payout.id,
          paid_at: new Date().toISOString(),
        })
        .in('id', earningIds)
    }
  }

  return payout
}

/**
 * Get payout history (FR115)
 */
export async function getPayoutHistory(
  trainerId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ payouts: TrainerPayout[]; total: number }> {
  const supabase = createClient()

  const { data, error, count } = await supabase
    .from('trainer_payouts')
    .select('*', { count: 'exact' })
    .eq('trainer_id', trainerId)
    .order('requested_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch payout history: ${error.message}`)
  }

  return {
    payouts: data || [],
    total: count || 0,
  }
}

/**
 * Cancel a pending payout
 */
export async function cancelPayout(
  payoutId: string,
  trainerId: string
): Promise<TrainerPayout> {
  const supabase = createClient()

  // Verify ownership and status
  const { data: payout, error: fetchError } = await supabase
    .from('trainer_payouts')
    .select('*')
    .eq('id', payoutId)
    .eq('trainer_id', trainerId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !payout) {
    throw new Error('Payout not found or cannot be cancelled')
  }

  // Update payout status
  const { data: updated, error: updateError } = await supabase
    .from('trainer_payouts')
    .update({ status: 'cancelled' })
    .eq('id', payoutId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to cancel payout: ${updateError.message}`)
  }

  // Return earnings to available status
  await supabase
    .from('trainer_earnings')
    .update({
      status: 'available',
      payout_id: null,
      paid_at: null,
    })
    .eq('payout_id', payoutId)

  return updated
}

/**
 * Process pending earnings (make them available after hold period)
 * This should be called by a scheduled job
 */
export async function processEarnings(): Promise<number> {
  const supabase = createClient()

  // Make earnings available after 24 hour hold
  const holdPeriod = new Date()
  holdPeriod.setHours(holdPeriod.getHours() - 24)

  const { data, error } = await supabase
    .from('trainer_earnings')
    .update({
      status: 'available',
      available_at: new Date().toISOString(),
    })
    .eq('status', 'pending')
    .lte('earned_at', holdPeriod.toISOString())
    .select('id')

  if (error) {
    throw new Error(`Failed to process earnings: ${error.message}`)
  }

  return data?.length || 0
}

/**
 * Get top earners (for leaderboard)
 */
export async function getTopEarners(
  limit: number = 10
): Promise<{ trainer_id: string; total: number; agents: number }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trainer_earnings')
    .select('trainer_id, net_amount, agent_id')
    .eq('status', 'available')

  if (error) {
    throw new Error(`Failed to fetch top earners: ${error.message}`)
  }

  // Aggregate by trainer
  const byTrainer: { [key: string]: { total: number; agents: Set<string> } } = {}

  for (const earning of data || []) {
    if (!byTrainer[earning.trainer_id]) {
      byTrainer[earning.trainer_id] = { total: 0, agents: new Set() }
    }
    byTrainer[earning.trainer_id].total += Number(earning.net_amount)
    byTrainer[earning.trainer_id].agents.add(earning.agent_id)
  }

  return Object.entries(byTrainer)
    .map(([trainer_id, data]) => ({
      trainer_id,
      total: Math.round(data.total * 100) / 100,
      agents: data.agents.size,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}
