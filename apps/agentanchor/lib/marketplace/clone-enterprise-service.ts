/**
 * Clone & Enterprise Acquisition Service
 * Epic 9: Clone & Enterprise Acquisition
 *
 * Story 9-1: Clone Pricing Settings (FR14)
 * Story 9-2: Enterprise Lock Configuration (FR15)
 * Story 9-3: Clone Package Generation
 * Story 9-4: Clone Acquisition Flow (FR28)
 * Story 9-5: Enterprise Lock Acquisition (FR29)
 */

import { createClient } from '@/lib/supabase/server'
import { recordAcquisition } from '@/lib/truth-chain'

// ============================================================================
// Types
// ============================================================================

export interface ClonePricingConfig {
  enabled: boolean
  price: number
  maxClones?: number // undefined = unlimited
  includesUpdates: boolean // false for clones (one-time snapshot)
  currency: 'USD'
}

export interface EnterpriseLockConfig {
  enabled: boolean
  price: number
  lockDuration: 'perpetual' | '1_year' | '2_year' | '3_year'
  removeFromMarketplace: boolean
  includesSupport: boolean
  includesUpdates: boolean
  customTerms?: string
  currency: 'USD'
}

export interface ClonePackage {
  id: string
  agentId: string
  agentName: string
  version: string
  createdAt: string
  // Agent definition for self-hosting
  definition: {
    name: string
    description: string
    systemPrompt: string
    personality: Record<string, unknown>
    capabilities: string[]
    guardrails: string[]
    tools?: string[]
  }
  // Metadata
  metadata: {
    originalTrainerId: string
    originalListingId: string
    trustScoreAtClone: number
    trustTierAtClone: string
    clonedAt: string
    cloneNumber: number
  }
  // Signature for authenticity verification
  signature: string
}

export interface EnterpriseLicense {
  id: string
  acquisitionId: string
  agentId: string
  consumerId: string
  trainerId: string
  // License terms
  terms: {
    lockDuration: string
    expiresAt?: string
    perpetual: boolean
    exclusive: boolean
    includesSupport: boolean
    includesUpdates: boolean
    customTerms?: string
  }
  // License state
  status: 'active' | 'expired' | 'cancelled'
  createdAt: string
  activatedAt: string
}

// ============================================================================
// Story 9-1: Clone Pricing Settings
// ============================================================================

/**
 * Update clone pricing configuration for a listing
 */
export async function updateClonePricing(
  listingId: string,
  trainerId: string,
  config: ClonePricingConfig
): Promise<void> {
  const supabase = await createClient()

  // Verify ownership
  const { data: listing, error: fetchError } = await supabase
    .from('marketplace_listings')
    .select('id, trainer_id, agent_id')
    .eq('id', listingId)
    .single()

  if (fetchError || !listing) {
    throw new Error('Listing not found')
  }

  if (listing.trainer_id !== trainerId) {
    throw new Error('Not authorized to modify this listing')
  }

  // Validate pricing
  if (config.enabled && config.price <= 0) {
    throw new Error('Clone price must be greater than 0')
  }

  if (config.maxClones !== undefined && config.maxClones < 1) {
    throw new Error('Max clones must be at least 1')
  }

  // Update listing
  const { error: updateError } = await supabase
    .from('marketplace_listings')
    .update({
      available_for_clone: config.enabled,
      clone_price: config.enabled ? config.price : null,
      max_clones: config.maxClones,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updateError) {
    throw new Error(`Failed to update clone pricing: ${updateError.message}`)
  }
}

/**
 * Get clone pricing for a listing
 */
export async function getClonePricing(listingId: string): Promise<ClonePricingConfig | null> {
  const supabase = await createClient()

  const { data: listing, error } = await supabase
    .from('marketplace_listings')
    .select('available_for_clone, clone_price, max_clones, current_clones')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    return null
  }

  return {
    enabled: listing.available_for_clone,
    price: Number(listing.clone_price) || 0,
    maxClones: listing.max_clones,
    includesUpdates: false, // Clones don't get updates
    currency: 'USD',
  }
}

// ============================================================================
// Story 9-2: Enterprise Lock Configuration
// ============================================================================

/**
 * Update enterprise lock configuration for a listing
 */
export async function updateEnterpriseLockConfig(
  listingId: string,
  trainerId: string,
  config: EnterpriseLockConfig
): Promise<void> {
  const supabase = await createClient()

  // Verify ownership
  const { data: listing, error: fetchError } = await supabase
    .from('marketplace_listings')
    .select('id, trainer_id, agent_id, status')
    .eq('id', listingId)
    .single()

  if (fetchError || !listing) {
    throw new Error('Listing not found')
  }

  if (listing.trainer_id !== trainerId) {
    throw new Error('Not authorized to modify this listing')
  }

  // Validate pricing
  if (config.enabled && config.price <= 0) {
    throw new Error('Enterprise price must be greater than 0')
  }

  // Store enterprise config in metadata
  const enterpriseConfig = {
    lockDuration: config.lockDuration,
    removeFromMarketplace: config.removeFromMarketplace,
    includesSupport: config.includesSupport,
    includesUpdates: config.includesUpdates,
    customTerms: config.customTerms,
  }

  // Update listing
  const { error: updateError } = await supabase
    .from('marketplace_listings')
    .update({
      available_for_enterprise: config.enabled,
      enterprise_price: config.enabled ? config.price : null,
      enterprise_config: enterpriseConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updateError) {
    throw new Error(`Failed to update enterprise config: ${updateError.message}`)
  }
}

/**
 * Get enterprise lock config for a listing
 */
export async function getEnterpriseLockConfig(listingId: string): Promise<EnterpriseLockConfig | null> {
  const supabase = await createClient()

  const { data: listing, error } = await supabase
    .from('marketplace_listings')
    .select('available_for_enterprise, enterprise_price, enterprise_config')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    return null
  }

  const config = (listing.enterprise_config as Record<string, unknown>) || {}

  return {
    enabled: listing.available_for_enterprise,
    price: Number(listing.enterprise_price) || 0,
    lockDuration: (config.lockDuration as EnterpriseLockConfig['lockDuration']) || 'perpetual',
    removeFromMarketplace: (config.removeFromMarketplace as boolean) ?? true,
    includesSupport: (config.includesSupport as boolean) ?? false,
    includesUpdates: (config.includesUpdates as boolean) ?? true,
    customTerms: config.customTerms as string | undefined,
    currency: 'USD',
  }
}

// ============================================================================
// Story 9-3: Clone Package Generation
// ============================================================================

/**
 * Generate a clone package for an agent
 * This creates a self-contained definition that can be used for self-hosting
 */
export async function generateClonePackage(
  agentId: string,
  listingId: string,
  acquisitionId: string,
  cloneNumber: number
): Promise<ClonePackage> {
  const supabase = await createClient()

  // Fetch full agent data
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) {
    throw new Error('Agent not found')
  }

  // Fetch listing data
  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (listingError || !listing) {
    throw new Error('Listing not found')
  }

  const now = new Date()
  const packageId = `clone_${agentId.slice(0, 8)}_${now.getTime()}`

  // Generate version string
  const version = `1.0.${cloneNumber}`

  // Build clone package
  const clonePackage: ClonePackage = {
    id: packageId,
    agentId: agentId,
    agentName: agent.name,
    version,
    createdAt: now.toISOString(),
    definition: {
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.system_prompt || '',
      personality: (agent.personality_traits as Record<string, unknown>) || {},
      capabilities: (agent.capabilities as string[]) || [],
      guardrails: (agent.guardrails as string[]) || [],
      tools: (agent.tools as string[]) || [],
    },
    metadata: {
      originalTrainerId: listing.trainer_id,
      originalListingId: listingId,
      trustScoreAtClone: agent.trust_score,
      trustTierAtClone: agent.trust_tier,
      clonedAt: now.toISOString(),
      cloneNumber,
    },
    // Simple signature (in production, use proper cryptographic signing)
    signature: generatePackageSignature(packageId, agentId, now.toISOString()),
  }

  return clonePackage
}

/**
 * Generate a signature for authenticity verification
 */
function generatePackageSignature(packageId: string, agentId: string, timestamp: string): string {
  // In production, this should use proper cryptographic signing
  const data = `${packageId}:${agentId}:${timestamp}:agentanchor`
  // Simple hash for demo purposes
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `aa_sig_${Math.abs(hash).toString(16).padStart(16, '0')}`
}

// ============================================================================
// Story 9-4: Clone Acquisition Flow
// ============================================================================

/**
 * Acquire an agent via Clone model (one-time purchase)
 */
export async function acquireClone(
  consumerId: string,
  listingId: string,
  paymentIntentId?: string // Stripe payment intent for verification
): Promise<{
  acquisition: {
    id: string
    type: 'clone'
    price: number
  }
  clonePackage: ClonePackage
}> {
  const supabase = await createClient()

  // Get listing details
  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*, agents(*)')
    .eq('id', listingId)
    .eq('status', 'active')
    .single()

  if (listingError || !listing) {
    throw new Error('Listing not found or not available')
  }

  // Verify clone is available
  if (!listing.available_for_clone) {
    throw new Error('Clone acquisition not available for this agent')
  }

  // Check clone limits
  if (listing.max_clones && listing.current_clones >= listing.max_clones) {
    throw new Error('Maximum clone limit reached for this agent')
  }

  // Cannot acquire own agent
  if (listing.trainer_id === consumerId) {
    throw new Error('You cannot clone your own agent')
  }

  const price = Number(listing.clone_price)
  const cloneNumber = (listing.current_clones || 0) + 1

  // Create acquisition record
  const { data: acquisition, error: acquisitionError } = await supabase
    .from('acquisitions')
    .insert({
      listing_id: listingId,
      agent_id: listing.agent_id,
      consumer_id: consumerId,
      trainer_id: listing.trainer_id,
      acquisition_type: 'clone',
      status: 'active',
      price_at_acquisition: price,
      payment_intent_id: paymentIntentId,
    })
    .select()
    .single()

  if (acquisitionError) {
    throw new Error(`Failed to create acquisition: ${acquisitionError.message}`)
  }

  // Generate clone package
  const clonePackage = await generateClonePackage(
    listing.agent_id,
    listingId,
    acquisition.id,
    cloneNumber
  )

  // Update listing clone count
  await supabase
    .from('marketplace_listings')
    .update({
      current_clones: cloneNumber,
      acquisition_count: (listing.acquisition_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  // Record trainer earning (clone is one-time)
  const platformFee = price * 0.15 // 15% platform fee
  const netAmount = price - platformFee

  await supabase
    .from('trainer_earnings')
    .insert({
      trainer_id: listing.trainer_id,
      acquisition_id: acquisition.id,
      listing_id: listingId,
      agent_id: listing.agent_id,
      task_type: 'clone_sale',
      task_complexity: 1,
      gross_amount: price,
      platform_fee: platformFee,
      net_amount: netAmount,
      status: 'available', // Immediately available for clone sales
      earned_at: new Date().toISOString(),
    })

  // Record on Truth Chain
  try {
    await recordAcquisition({
      acquisition_id: acquisition.id,
      listing_id: listingId,
      agent_id: listing.agent_id,
      consumer_id: consumerId,
      trainer_id: listing.trainer_id,
      acquisition_type: 'clone',
      commission_rate: price, // Use price as commission_rate for clone
    })
  } catch (error) {
    console.error('Truth Chain recording error:', error)
  }

  return {
    acquisition: {
      id: acquisition.id,
      type: 'clone',
      price,
    },
    clonePackage,
  }
}

// ============================================================================
// Story 9-5: Enterprise Lock Acquisition
// ============================================================================

/**
 * Acquire an agent via Enterprise Lock (exclusive rights)
 */
export async function acquireEnterpriseLock(
  consumerId: string,
  listingId: string,
  paymentIntentId?: string
): Promise<{
  acquisition: {
    id: string
    type: 'enterprise_lock'
    price: number
  }
  license: EnterpriseLicense
}> {
  const supabase = await createClient()

  // Get listing details
  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*, agents(*)')
    .eq('id', listingId)
    .eq('status', 'active')
    .single()

  if (listingError || !listing) {
    throw new Error('Listing not found or not available')
  }

  // Verify enterprise is available
  if (!listing.available_for_enterprise) {
    throw new Error('Enterprise lock not available for this agent')
  }

  // Check if already enterprise locked
  const { data: existingLock } = await supabase
    .from('acquisitions')
    .select('id')
    .eq('listing_id', listingId)
    .eq('acquisition_type', 'enterprise_lock')
    .eq('status', 'active')
    .single()

  if (existingLock) {
    throw new Error('This agent is already under an enterprise lock')
  }

  // Cannot acquire own agent
  if (listing.trainer_id === consumerId) {
    throw new Error('You cannot enterprise lock your own agent')
  }

  const price = Number(listing.enterprise_price)
  const config = (listing.enterprise_config as Record<string, unknown>) || {}

  // Calculate expiration
  let expiresAt: string | undefined
  const perpetual = config.lockDuration === 'perpetual'

  if (!perpetual) {
    const years = parseInt((config.lockDuration as string)?.split('_')[0] || '1')
    const expDate = new Date()
    expDate.setFullYear(expDate.getFullYear() + years)
    expiresAt = expDate.toISOString()
  }

  // Create acquisition record
  const { data: acquisition, error: acquisitionError } = await supabase
    .from('acquisitions')
    .insert({
      listing_id: listingId,
      agent_id: listing.agent_id,
      consumer_id: consumerId,
      trainer_id: listing.trainer_id,
      acquisition_type: 'enterprise_lock',
      status: 'active',
      price_at_acquisition: price,
      payment_intent_id: paymentIntentId,
      expires_at: expiresAt,
      enterprise_license_terms: {
        lockDuration: config.lockDuration,
        perpetual,
        exclusive: true,
        includesSupport: config.includesSupport,
        includesUpdates: config.includesUpdates,
        customTerms: config.customTerms,
      },
    })
    .select()
    .single()

  if (acquisitionError) {
    throw new Error(`Failed to create acquisition: ${acquisitionError.message}`)
  }

  // If configured, remove from public marketplace
  if (config.removeFromMarketplace) {
    await supabase
      .from('marketplace_listings')
      .update({
        status: 'sold_out', // Mark as sold out (enterprise locked)
        available_for_commission: false,
        available_for_clone: false,
        available_for_enterprise: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)
  }

  // Update listing stats
  await supabase
    .from('marketplace_listings')
    .update({
      acquisition_count: (listing.acquisition_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  // Record trainer earning
  const platformFee = price * 0.10 // 10% platform fee for enterprise
  const netAmount = price - platformFee

  await supabase
    .from('trainer_earnings')
    .insert({
      trainer_id: listing.trainer_id,
      acquisition_id: acquisition.id,
      listing_id: listingId,
      agent_id: listing.agent_id,
      task_type: 'enterprise_sale',
      task_complexity: 1,
      gross_amount: price,
      platform_fee: platformFee,
      net_amount: netAmount,
      status: 'available',
      earned_at: new Date().toISOString(),
    })

  // Build license object
  const license: EnterpriseLicense = {
    id: `ent_${acquisition.id.slice(0, 16)}`,
    acquisitionId: acquisition.id,
    agentId: listing.agent_id,
    consumerId,
    trainerId: listing.trainer_id,
    terms: {
      lockDuration: (config.lockDuration as string) || 'perpetual',
      expiresAt,
      perpetual,
      exclusive: true,
      includesSupport: (config.includesSupport as boolean) ?? false,
      includesUpdates: (config.includesUpdates as boolean) ?? true,
      customTerms: config.customTerms as string | undefined,
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    activatedAt: new Date().toISOString(),
  }

  // Record on Truth Chain
  try {
    await recordAcquisition({
      acquisition_id: acquisition.id,
      listing_id: listingId,
      agent_id: listing.agent_id,
      consumer_id: consumerId,
      trainer_id: listing.trainer_id,
      acquisition_type: 'enterprise_lock',
      commission_rate: price, // Use price as commission_rate for enterprise
    })
  } catch (error) {
    console.error('Truth Chain recording error:', error)
  }

  return {
    acquisition: {
      id: acquisition.id,
      type: 'enterprise_lock',
      price,
    },
    license,
  }
}

/**
 * Get enterprise license details
 */
export async function getEnterpriseLicense(acquisitionId: string): Promise<EnterpriseLicense | null> {
  const supabase = await createClient()

  const { data: acquisition, error } = await supabase
    .from('acquisitions')
    .select('*')
    .eq('id', acquisitionId)
    .eq('acquisition_type', 'enterprise_lock')
    .single()

  if (error || !acquisition) {
    return null
  }

  const terms = (acquisition.enterprise_license_terms as Record<string, unknown>) || {}

  return {
    id: `ent_${acquisition.id.slice(0, 16)}`,
    acquisitionId: acquisition.id,
    agentId: acquisition.agent_id,
    consumerId: acquisition.consumer_id,
    trainerId: acquisition.trainer_id,
    terms: {
      lockDuration: (terms.lockDuration as string) || 'perpetual',
      expiresAt: acquisition.expires_at,
      perpetual: (terms.perpetual as boolean) ?? true,
      exclusive: true,
      includesSupport: (terms.includesSupport as boolean) ?? false,
      includesUpdates: (terms.includesUpdates as boolean) ?? true,
      customTerms: terms.customTerms as string | undefined,
    },
    status: acquisition.status as EnterpriseLicense['status'],
    createdAt: acquisition.created_at,
    activatedAt: acquisition.created_at,
  }
}

/**
 * Release enterprise lock (early termination)
 */
export async function releaseEnterpriseLock(
  acquisitionId: string,
  consumerId: string,
  reason: string
): Promise<void> {
  const supabase = await createClient()

  // Verify ownership
  const { data: acquisition, error: fetchError } = await supabase
    .from('acquisitions')
    .select('*, marketplace_listings(*)')
    .eq('id', acquisitionId)
    .eq('consumer_id', consumerId)
    .eq('acquisition_type', 'enterprise_lock')
    .eq('status', 'active')
    .single()

  if (fetchError || !acquisition) {
    throw new Error('Enterprise lock not found or not authorized')
  }

  // Update acquisition status
  await supabase
    .from('acquisitions')
    .update({
      status: 'terminated',
      terminated_at: new Date().toISOString(),
      walk_away_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', acquisitionId)

  // Restore listing to marketplace if it was removed
  const listing = acquisition.marketplace_listings as any
  if (listing && listing.status === 'sold_out') {
    await supabase
      .from('marketplace_listings')
      .update({
        status: 'active',
        available_for_commission: true,
        available_for_enterprise: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listing.id)
  }
}
