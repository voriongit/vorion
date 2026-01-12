/**
 * Client Protection Service - Consumer protection and opt-out flows
 * FR123-128: Client Bill of Rights implementation
 */

import { createClient } from '@/lib/supabase/server'
import { recordOwnershipChange } from '@/lib/truth-chain'
import { notifyConsumer, notifyTrainer } from '@/lib/notifications'

export type ProtectionRequestType = 'opt_out' | 'platform_maintenance' | 'ownership_dispute'
export type ProtectionRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'

export interface ProtectionRequest {
  id: string
  consumerId: string
  agentId: string
  acquisitionId: string
  type: ProtectionRequestType
  status: ProtectionRequestStatus
  reason: string
  context?: {
    ownershipChange?: boolean
    previousOwnerId?: string
    newOwnerId?: string
    noticeDate?: string
  }
  resolution?: string
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
}

export interface OwnershipChange {
  id: string
  agentId: string
  previousOwnerId: string
  newOwnerId: string
  changeType: 'transfer' | 'delegation' | 'platform_takeover' | 'sale'
  noticeDate: string
  effectiveDate: string
  affectedConsumers: number
  optOutCount: number
}

// ============================================================================
// Ownership Change Notifications (FR123, FR124)
// ============================================================================

/**
 * Notify all consumers of an agent about ownership change
 */
export async function notifyOwnershipChange(
  agentId: string,
  previousOwnerId: string,
  newOwnerId: string,
  changeType: OwnershipChange['changeType'],
  effectiveInDays = 30
): Promise<{ notified: number; changeId: string }> {
  const supabase = createClient()

  const effectiveDate = new Date()
  effectiveDate.setDate(effectiveDate.getDate() + effectiveInDays)

  // Get all consumers who have acquired this agent
  const { data: acquisitions } = await supabase
    .from('acquisitions')
    .select('consumer_id, id')
    .eq('agent_id', agentId)
    .eq('status', 'active')

  const consumerIds = [...new Set(acquisitions?.map(a => a.consumer_id) || [])]

  // Create ownership change record
  const { data: change, error } = await supabase
    .from('ownership_changes')
    .insert({
      agent_id: agentId,
      previous_owner_id: previousOwnerId,
      new_owner_id: newOwnerId,
      change_type: changeType,
      notice_date: new Date().toISOString(),
      effective_date: effectiveDate.toISOString(),
      affected_consumers: consumerIds.length,
      opt_out_count: 0,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create ownership change: ${error.message}`)
  }

  // Get agent details
  const { data: agent } = await supabase
    .from('bots')
    .select('name')
    .eq('id', agentId)
    .single()

  // Notify each consumer
  for (const consumerId of consumerIds) {
    await notifyConsumer({
      userId: consumerId,
      type: 'ownership_change',
      title: 'Agent Ownership Change',
      message: `The agent "${agent?.name}" you're using is changing ownership. You have ${effectiveInDays} days to opt out if desired.`,
      data: {
        agentId,
        changeId: change.id,
        effectiveDate: effectiveDate.toISOString(),
      },
      priority: 'high',
    })
  }

  // Record on Truth Chain
  await recordOwnershipChange({
    agent_id: agentId,
    agent_name: agent?.name || 'Unknown Agent',
    previous_owner_id: previousOwnerId,
    new_owner_id: newOwnerId,
    change_type: changeType,
  })

  return {
    notified: consumerIds.length,
    changeId: change.id,
  }
}

// ============================================================================
// Consumer Opt-Out (FR125, FR126)
// ============================================================================

/**
 * Submit opt-out request for a consumer
 */
export async function submitOptOut(
  consumerId: string,
  agentId: string,
  reason: string,
  ownershipChangeId?: string
): Promise<ProtectionRequest> {
  const supabase = createClient()

  // Get the consumer's acquisition
  const { data: acquisition } = await supabase
    .from('acquisitions')
    .select('id, status')
    .eq('consumer_id', consumerId)
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single()

  if (!acquisition) {
    throw new Error('No active acquisition found')
  }

  // Get ownership change context if applicable
  let context: ProtectionRequest['context'] = undefined
  if (ownershipChangeId) {
    const { data: change } = await supabase
      .from('ownership_changes')
      .select('*')
      .eq('id', ownershipChangeId)
      .single()

    if (change) {
      context = {
        ownershipChange: true,
        previousOwnerId: change.previous_owner_id,
        newOwnerId: change.new_owner_id,
        noticeDate: change.notice_date,
      }
    }
  }

  // Create protection request
  const { data: request, error } = await supabase
    .from('protection_requests')
    .insert({
      consumer_id: consumerId,
      agent_id: agentId,
      acquisition_id: acquisition.id,
      type: 'opt_out',
      status: 'pending',
      reason,
      context,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to submit opt-out: ${error.message}`)
  }

  return mapProtectionRequest(request)
}

/**
 * Process an opt-out request (auto-approve for ownership changes)
 */
export async function processOptOut(
  requestId: string,
  approverId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Get the request
  const { data: request } = await supabase
    .from('protection_requests')
    .select('*, acquisition:acquisitions(*)')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { success: false, error: 'Request not found' }
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'Request already processed' }
  }

  // Auto-approve if it's due to ownership change
  const isAutoApprove = request.context?.ownershipChange === true

  // Update request status
  await supabase
    .from('protection_requests')
    .update({
      status: 'approved',
      resolution: isAutoApprove ? 'Auto-approved per Client Bill of Rights' : 'Manually approved',
      resolved_by: approverId || 'system',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  // Terminate the acquisition
  await supabase
    .from('acquisitions')
    .update({
      status: 'terminated',
      terminated_at: new Date().toISOString(),
      termination_reason: 'consumer_opt_out',
    })
    .eq('id', request.acquisition_id)

  // Update opt-out count if this was due to ownership change
  if (request.context?.ownershipChange) {
    const { data: change } = await supabase
      .from('ownership_changes')
      .select('id, opt_out_count')
      .eq('agent_id', request.agent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (change) {
      await supabase
        .from('ownership_changes')
        .update({ opt_out_count: (change.opt_out_count || 0) + 1 })
        .eq('id', change.id)
    }
  }

  // Notify the consumer
  await notifyConsumer({
    userId: request.consumer_id,
    type: 'opt_out_complete',
    title: 'Opt-Out Complete',
    message: 'Your opt-out request has been processed. You are no longer using this agent.',
    priority: 'normal',
  })

  // Notify the trainer
  const { data: agent } = await supabase
    .from('bots')
    .select('user_id, name')
    .eq('id', request.agent_id)
    .single()

  if (agent) {
    await notifyTrainer({
      userId: agent.user_id,
      type: 'consumer_opt_out',
      title: 'Consumer Opt-Out',
      message: `A consumer has opted out of using "${agent.name}".`,
      priority: 'normal',
    })
  }

  return { success: true }
}

// ============================================================================
// Platform Protection Requests (FR127)
// ============================================================================

/**
 * Request platform to take over maintenance
 */
export async function requestPlatformProtection(
  consumerId: string,
  agentId: string,
  reason: string
): Promise<ProtectionRequest> {
  const supabase = createClient()

  // Get the consumer's acquisition
  const { data: acquisition } = await supabase
    .from('acquisitions')
    .select('id')
    .eq('consumer_id', consumerId)
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single()

  if (!acquisition) {
    throw new Error('No active acquisition found')
  }

  // Create protection request
  const { data: request, error } = await supabase
    .from('protection_requests')
    .insert({
      consumer_id: consumerId,
      agent_id: agentId,
      acquisition_id: acquisition.id,
      type: 'platform_maintenance',
      status: 'pending',
      reason,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to submit request: ${error.message}`)
  }

  // Notify platform admins
  // In production, this would trigger an internal notification

  return mapProtectionRequest(request)
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get protection requests for a consumer
 */
export async function getConsumerProtectionRequests(
  consumerId: string
): Promise<ProtectionRequest[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('protection_requests')
    .select('*')
    .eq('consumer_id', consumerId)
    .order('created_at', { ascending: false })

  return (data || []).map(mapProtectionRequest)
}

/**
 * Get pending ownership changes affecting a consumer
 */
export async function getPendingOwnershipChanges(
  consumerId: string
): Promise<OwnershipChange[]> {
  const supabase = createClient()

  // Get consumer's active acquisitions
  const { data: acquisitions } = await supabase
    .from('acquisitions')
    .select('agent_id')
    .eq('consumer_id', consumerId)
    .eq('status', 'active')

  if (!acquisitions || acquisitions.length === 0) return []

  const agentIds = acquisitions.map(a => a.agent_id)

  // Get pending ownership changes for those agents
  const { data: changes } = await supabase
    .from('ownership_changes')
    .select('*')
    .in('agent_id', agentIds)
    .gt('effective_date', new Date().toISOString())
    .order('effective_date', { ascending: true })

  return (changes || []).map(c => ({
    id: c.id,
    agentId: c.agent_id,
    previousOwnerId: c.previous_owner_id,
    newOwnerId: c.new_owner_id,
    changeType: c.change_type,
    noticeDate: c.notice_date,
    effectiveDate: c.effective_date,
    affectedConsumers: c.affected_consumers,
    optOutCount: c.opt_out_count,
  }))
}

// ============================================================================
// Helpers
// ============================================================================

function mapProtectionRequest(data: any): ProtectionRequest {
  return {
    id: data.id,
    consumerId: data.consumer_id,
    agentId: data.agent_id,
    acquisitionId: data.acquisition_id,
    type: data.type,
    status: data.status,
    reason: data.reason,
    context: data.context,
    resolution: data.resolution,
    resolvedBy: data.resolved_by,
    resolvedAt: data.resolved_at,
    createdAt: data.created_at,
  }
}

// ============================================================================
// Story 11-4: Walk-Away Termination (FR126)
// ============================================================================

/**
 * Execute walk-away termination - no penalty clean exit
 * FR126: Consumer can walk away clean during notice period
 */
export async function walkAwayClean(
  consumerId: string,
  acquisitionId: string,
  reason: string = 'walk_away'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get the acquisition
  const { data: acquisition } = await supabase
    .from('acquisitions')
    .select('*, agents!inner(name)')
    .eq('id', acquisitionId)
    .eq('consumer_id', consumerId)
    .single()

  if (!acquisition) {
    return { success: false, error: 'Acquisition not found' }
  }

  if (acquisition.status !== 'active') {
    return { success: false, error: 'Acquisition is not active' }
  }

  // Check if this is a walk-away eligible case (pending ownership change)
  const { data: pendingChange } = await supabase
    .from('ownership_changes')
    .select('*')
    .eq('agent_id', acquisition.agent_id)
    .gt('effective_date', new Date().toISOString())
    .limit(1)
    .single()

  const isWalkAwayEligible = !!pendingChange || acquisition.can_walk_away

  // Terminate the acquisition with no penalty
  await supabase
    .from('acquisitions')
    .update({
      status: 'terminated',
      terminated_at: new Date().toISOString(),
      termination_reason: isWalkAwayEligible ? 'walk_away_clean' : 'consumer_terminated',
      walk_away_reason: reason,
    })
    .eq('id', acquisitionId)

  // Record on Truth Chain
  await recordOwnershipChange({
    agent_id: acquisition.agent_id,
    agent_name: (acquisition.agents as any)?.name || 'Unknown',
    previous_owner_id: consumerId,
    new_owner_id: 'platform',
    change_type: 'walk_away',
  })

  // Update opt-out count if applicable
  if (pendingChange) {
    await supabase
      .from('ownership_changes')
      .update({ opt_out_count: (pendingChange.opt_out_count || 0) + 1 })
      .eq('id', pendingChange.id)
  }

  return { success: true }
}

// ============================================================================
// Story 11-5: Protection Truth Chain Records (FR128)
// ============================================================================

/**
 * Record a protection decision on Truth Chain
 */
export async function recordProtectionDecision(
  requestId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  reason: string
): Promise<void> {
  const supabase = await createClient()

  // Get the protection request
  const { data: request } = await supabase
    .from('protection_requests')
    .select('*, agents!inner(name)')
    .eq('id', requestId)
    .single()

  if (!request) {
    throw new Error('Protection request not found')
  }

  // Record on Truth Chain
  await recordOwnershipChange({
    agent_id: request.agent_id,
    agent_name: (request.agents as any)?.name || 'Unknown',
    previous_owner_id: request.consumer_id,
    new_owner_id: decision === 'approved' ? 'consumer_protected' : 'request_denied',
    change_type: 'protection_decision',
  })
}

/**
 * Get the Client Bill of Rights summary for display
 */
export function getClientBillOfRights(): {
  rights: Array<{ id: string; title: string; description: string }>
  version: string
} {
  return {
    version: '1.0',
    rights: [
      {
        id: 'notice',
        title: '30-Day Notice',
        description: 'You will receive at least 30 days notice before any ownership change affects your agents.',
      },
      {
        id: 'opt_out',
        title: 'Opt-Out Rights',
        description: 'You can opt out of using any agent at any time, especially during ownership transitions.',
      },
      {
        id: 'walk_away',
        title: 'Walk Away Clean',
        description: 'During ownership change notice periods, you can terminate with no penalty.',
      },
      {
        id: 'continuity',
        title: 'Service Continuity',
        description: 'Platform guarantees agent availability during ownership transitions.',
      },
      {
        id: 'transparency',
        title: 'Full Transparency',
        description: 'All protection decisions are recorded on the immutable Truth Chain.',
      },
    ],
  }
}
