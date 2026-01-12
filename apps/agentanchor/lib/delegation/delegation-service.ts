/**
 * Maintenance Delegation Service
 * Epic 12: Maintenance Delegation
 *
 * Story 12-1: Delegate Designation (FR18)
 * Story 12-2: Delegate Permissions (FR19, FR20)
 * Story 12-3: Delegation Revocation (FR21)
 * Story 12-4: Delegation Truth Chain (FR22)
 */

import { createClient } from '@/lib/supabase/server'
import { recordOwnershipChange } from '@/lib/truth-chain'

// ============================================================================
// Types
// ============================================================================

export type DelegationStatus = 'pending' | 'active' | 'revoked' | 'expired'

export interface DelegatePermissions {
  canUpdateSystemPrompt: boolean
  canUpdatePersonality: boolean
  canRespondToFeedback: boolean
  canViewAnalytics: boolean
  canManageListingDescription: boolean
  // Explicitly NOT allowed (FR20):
  // canChangePricing: false
  // canTransferOwnership: false
  // canAccessEarnings: false
}

export const DEFAULT_PERMISSIONS: DelegatePermissions = {
  canUpdateSystemPrompt: true,
  canUpdatePersonality: true,
  canRespondToFeedback: true,
  canViewAnalytics: true,
  canManageListingDescription: true,
}

export interface Delegation {
  id: string
  agentId: string
  trainerId: string // Owner
  delegateId: string // Maintainer
  permissions: DelegatePermissions
  status: DelegationStatus
  reason?: string
  startedAt: string
  expiresAt?: string
  revokedAt?: string
  revocationReason?: string
  createdAt: string
}

export interface CreateDelegationInput {
  agentId: string
  delegateId: string
  permissions?: Partial<DelegatePermissions>
  expiresInDays?: number
  reason?: string
}

// ============================================================================
// Story 12-1: Delegate Designation (FR18)
// ============================================================================

/**
 * Create a delegation for an agent
 */
export async function createDelegation(
  trainerId: string,
  input: CreateDelegationInput
): Promise<Delegation> {
  const supabase = await createClient()

  // Verify trainer owns the agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, owner_id')
    .eq('id', input.agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Agent not found')
  }

  if (agent.owner_id !== trainerId) {
    throw new Error('You do not own this agent')
  }

  // Verify delegate exists
  const { data: delegate, error: delegateError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', input.delegateId)
    .single()

  if (delegateError || !delegate) {
    throw new Error('Delegate user not found')
  }

  // Cannot delegate to self
  if (input.delegateId === trainerId) {
    throw new Error('Cannot delegate to yourself')
  }

  // Check for existing active delegation
  const { data: existingDelegation } = await supabase
    .from('delegations')
    .select('id')
    .eq('agent_id', input.agentId)
    .eq('delegate_id', input.delegateId)
    .eq('status', 'active')
    .single()

  if (existingDelegation) {
    throw new Error('Active delegation already exists for this delegate')
  }

  // Build permissions
  const permissions: DelegatePermissions = {
    ...DEFAULT_PERMISSIONS,
    ...input.permissions,
  }

  // Calculate expiry
  let expiresAt: string | undefined
  if (input.expiresInDays) {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + input.expiresInDays)
    expiresAt = expiry.toISOString()
  }

  const now = new Date().toISOString()

  // Create delegation
  const { data: delegation, error: createError } = await supabase
    .from('delegations')
    .insert({
      agent_id: input.agentId,
      trainer_id: trainerId,
      delegate_id: input.delegateId,
      permissions,
      status: 'active',
      reason: input.reason,
      started_at: now,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create delegation: ${createError.message}`)
  }

  // Update agent with delegate info
  await supabase
    .from('agents')
    .update({
      has_delegate: true,
      delegate_id: input.delegateId,
    })
    .eq('id', input.agentId)

  // Record on Truth Chain (FR22)
  await recordDelegationChange(
    input.agentId,
    agent.name,
    trainerId,
    input.delegateId,
    'created'
  )

  // Notify delegate
  await supabase
    .from('notifications')
    .insert({
      user_id: input.delegateId,
      type: 'delegation_assigned',
      title: 'Agent Maintenance Delegation',
      message: `You have been assigned as a maintenance delegate for "${agent.name}".`,
      metadata: {
        agent_id: input.agentId,
        delegation_id: delegation.id,
      },
    })

  return mapDelegation(delegation)
}

/**
 * Accept a pending delegation (if using acceptance flow)
 */
export async function acceptDelegation(
  delegationId: string,
  delegateId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('delegations')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .eq('id', delegationId)
    .eq('delegate_id', delegateId)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to accept delegation: ${error.message}`)
  }
}

// ============================================================================
// Story 12-2: Delegate Permissions (FR19, FR20)
// ============================================================================

/**
 * Check if user has permission to perform action on agent
 */
export async function checkDelegatePermission(
  userId: string,
  agentId: string,
  permission: keyof DelegatePermissions
): Promise<boolean> {
  const supabase = await createClient()

  // First check if user is owner
  const { data: agent } = await supabase
    .from('agents')
    .select('owner_id')
    .eq('id', agentId)
    .single()

  if (agent?.owner_id === userId) {
    return true // Owner has all permissions
  }

  // Check delegation
  const { data: delegation } = await supabase
    .from('delegations')
    .select('permissions, status, expires_at')
    .eq('agent_id', agentId)
    .eq('delegate_id', userId)
    .eq('status', 'active')
    .single()

  if (!delegation) {
    return false
  }

  // Check expiry
  if (delegation.expires_at && new Date(delegation.expires_at) < new Date()) {
    return false
  }

  // Check specific permission
  const permissions = delegation.permissions as DelegatePermissions
  return permissions[permission] === true
}

/**
 * Get delegate's permissions for an agent
 */
export async function getDelegatePermissions(
  delegateId: string,
  agentId: string
): Promise<DelegatePermissions | null> {
  const supabase = await createClient()

  const { data: delegation } = await supabase
    .from('delegations')
    .select('permissions, status, expires_at')
    .eq('agent_id', agentId)
    .eq('delegate_id', delegateId)
    .eq('status', 'active')
    .single()

  if (!delegation) {
    return null
  }

  // Check expiry
  if (delegation.expires_at && new Date(delegation.expires_at) < new Date()) {
    return null
  }

  return delegation.permissions as DelegatePermissions
}

/**
 * Update delegate permissions
 */
export async function updateDelegatePermissions(
  trainerId: string,
  delegationId: string,
  permissions: Partial<DelegatePermissions>
): Promise<void> {
  const supabase = await createClient()

  // Verify ownership
  const { data: delegation } = await supabase
    .from('delegations')
    .select('trainer_id, permissions')
    .eq('id', delegationId)
    .single()

  if (!delegation || delegation.trainer_id !== trainerId) {
    throw new Error('Delegation not found or not authorized')
  }

  const newPermissions: DelegatePermissions = {
    ...(delegation.permissions as DelegatePermissions),
    ...permissions,
  }

  await supabase
    .from('delegations')
    .update({ permissions: newPermissions })
    .eq('id', delegationId)
}

// ============================================================================
// Story 12-3: Delegation Revocation (FR21)
// ============================================================================

/**
 * Revoke a delegation
 */
export async function revokeDelegation(
  trainerId: string,
  delegationId: string,
  reason?: string
): Promise<void> {
  const supabase = await createClient()

  // Get delegation details
  const { data: delegation, error: fetchError } = await supabase
    .from('delegations')
    .select('*, agents!inner(name)')
    .eq('id', delegationId)
    .single()

  if (fetchError || !delegation) {
    throw new Error('Delegation not found')
  }

  if (delegation.trainer_id !== trainerId) {
    throw new Error('Not authorized to revoke this delegation')
  }

  if (delegation.status !== 'active') {
    throw new Error('Delegation is not active')
  }

  const now = new Date().toISOString()

  // Update delegation status
  await supabase
    .from('delegations')
    .update({
      status: 'revoked',
      revoked_at: now,
      revocation_reason: reason,
    })
    .eq('id', delegationId)

  // Check if there are other active delegations for this agent
  const { data: otherDelegations } = await supabase
    .from('delegations')
    .select('id')
    .eq('agent_id', delegation.agent_id)
    .eq('status', 'active')
    .neq('id', delegationId)

  // Update agent if no other active delegations
  if (!otherDelegations || otherDelegations.length === 0) {
    await supabase
      .from('agents')
      .update({
        has_delegate: false,
        delegate_id: null,
      })
      .eq('id', delegation.agent_id)
  }

  // Record on Truth Chain (FR22)
  await recordDelegationChange(
    delegation.agent_id,
    (delegation.agents as any)?.name || 'Unknown',
    trainerId,
    delegation.delegate_id,
    'revoked'
  )

  // Notify delegate
  await supabase
    .from('notifications')
    .insert({
      user_id: delegation.delegate_id,
      type: 'delegation_revoked',
      title: 'Delegation Revoked',
      message: `Your maintenance delegation for "${(delegation.agents as any)?.name}" has been revoked.${reason ? ` Reason: ${reason}` : ''}`,
      metadata: {
        agent_id: delegation.agent_id,
        delegation_id: delegationId,
      },
    })
}

/**
 * Delegate can voluntarily resign
 */
export async function resignDelegation(
  delegateId: string,
  delegationId: string,
  reason?: string
): Promise<void> {
  const supabase = await createClient()

  const { data: delegation, error: fetchError } = await supabase
    .from('delegations')
    .select('*, agents!inner(name)')
    .eq('id', delegationId)
    .eq('delegate_id', delegateId)
    .single()

  if (fetchError || !delegation) {
    throw new Error('Delegation not found')
  }

  if (delegation.status !== 'active') {
    throw new Error('Delegation is not active')
  }

  await supabase
    .from('delegations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason || 'delegate_resigned',
    })
    .eq('id', delegationId)

  // Update agent
  await supabase
    .from('agents')
    .update({
      has_delegate: false,
      delegate_id: null,
    })
    .eq('id', delegation.agent_id)

  // Record on Truth Chain
  await recordDelegationChange(
    delegation.agent_id,
    (delegation.agents as any)?.name || 'Unknown',
    delegation.trainer_id,
    delegateId,
    'resigned'
  )

  // Notify trainer
  await supabase
    .from('notifications')
    .insert({
      user_id: delegation.trainer_id,
      type: 'delegate_resigned',
      title: 'Delegate Resigned',
      message: `Your delegate has resigned from maintaining "${(delegation.agents as any)?.name}".`,
      metadata: {
        agent_id: delegation.agent_id,
        delegation_id: delegationId,
      },
    })
}

// ============================================================================
// Story 12-4: Delegation Truth Chain (FR22)
// ============================================================================

/**
 * Record delegation change on Truth Chain
 */
async function recordDelegationChange(
  agentId: string,
  agentName: string,
  trainerId: string,
  delegateId: string,
  action: 'created' | 'revoked' | 'resigned' | 'expired'
): Promise<void> {
  await recordOwnershipChange({
    agent_id: agentId,
    agent_name: agentName,
    previous_owner_id: trainerId,
    new_owner_id: delegateId,
    change_type: 'delegation',
  })
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get delegations where user is the trainer (owner)
 */
export async function getTrainerDelegations(trainerId: string): Promise<Delegation[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('delegations')
    .select('*, agents!inner(name), delegate:profiles!delegations_delegate_id_fkey(full_name)')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch delegations: ${error.message}`)
  }

  return (data || []).map(mapDelegation)
}

/**
 * Get delegations where user is the delegate
 */
export async function getDelegateDelegations(delegateId: string): Promise<Delegation[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('delegations')
    .select('*, agents!inner(name), trainer:profiles!delegations_trainer_id_fkey(full_name)')
    .eq('delegate_id', delegateId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch delegations: ${error.message}`)
  }

  return (data || []).map(mapDelegation)
}

/**
 * Get delegation for a specific agent
 */
export async function getAgentDelegation(agentId: string): Promise<Delegation | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('delegations')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single()

  return data ? mapDelegation(data) : null
}

// ============================================================================
// Helpers
// ============================================================================

function mapDelegation(data: any): Delegation {
  return {
    id: data.id,
    agentId: data.agent_id,
    trainerId: data.trainer_id,
    delegateId: data.delegate_id,
    permissions: data.permissions,
    status: data.status,
    reason: data.reason,
    startedAt: data.started_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    revocationReason: data.revocation_reason,
    createdAt: data.created_at,
  }
}

/**
 * Expire delegations that have passed their expiry date (cron job)
 */
export async function expireDelegations(): Promise<number> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: expired } = await supabase
    .from('delegations')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', now)
    .select('id')

  return expired?.length || 0
}
