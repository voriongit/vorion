/**
 * Marketplace Service
 * Epic 6: Marketplace & Acquisition
 *
 * Story 6-1: Agent Publishing (FR12, FR13)
 * Story 6-2: Marketplace Browse & Search (FR23, FR24, FR106)
 * Story 6-4: Agent Acquisition (FR27, FR30)
 */

import { createClient } from '@/lib/supabase/server'
import {
  MarketplaceListing,
  ListingWithAgent,
  CreateListingInput,
  UpdateListingInput,
  ListingSearchParams,
  Acquisition,
  AcquisitionWithDetails,
  CreateAcquisitionInput,
  MarketplaceCategory,
  PLATFORM_FEES,
  SubscriptionTier,
} from './types'
import { recordOwnershipChange, recordMarketplaceListing, recordAcquisition } from '@/lib/truth-chain'

// ============================================================================
// Listing Management (Story 6-1)
// ============================================================================

/**
 * Create a new marketplace listing
 * Requires agent to be graduated (status = 'active')
 */
export async function createListing(
  trainerId: string,
  input: CreateListingInput,
  subscriptionTier: SubscriptionTier = 'free'
): Promise<MarketplaceListing> {
  const supabase = createClient()

  // Verify agent exists and belongs to trainer
  const { data: agent, error: agentError } = await supabase
    .from('bots')
    .select('id, name, status, trust_score, trust_tier, user_id')
    .eq('id', input.agent_id)
    .single()

  if (agentError || !agent) {
    throw new Error('Agent not found')
  }

  if (agent.user_id !== trainerId) {
    throw new Error('Agent does not belong to trainer')
  }

  if (agent.status !== 'active') {
    throw new Error('Agent must complete Academy training before publishing')
  }

  // Check for existing listing
  const { data: existingListing } = await supabase
    .from('marketplace_listings')
    .select('id')
    .eq('agent_id', input.agent_id)
    .single()

  if (existingListing) {
    throw new Error('Agent already has a marketplace listing')
  }

  // Get platform fee based on subscription tier
  const platformFee = PLATFORM_FEES[subscriptionTier]

  // Create listing
  const { data: listing, error: createError } = await supabase
    .from('marketplace_listings')
    .insert({
      agent_id: input.agent_id,
      trainer_id: trainerId,
      title: input.title,
      description: input.description,
      short_description: input.short_description,
      category: input.category,
      tags: input.tags || [],
      commission_rate: input.commission_rate,
      complexity_multiplier: input.complexity_multiplier || 1.0,
      platform_fee_percent: platformFee,
      status: 'draft',
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create listing: ${createError.message}`)
  }

  return listing
}

/**
 * Update a marketplace listing
 */
export async function updateListing(
  listingId: string,
  trainerId: string,
  input: UpdateListingInput
): Promise<MarketplaceListing> {
  const supabase = createClient()

  // Verify ownership
  const { data: listing, error: fetchError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', listingId)
    .eq('trainer_id', trainerId)
    .single()

  if (fetchError || !listing) {
    throw new Error('Listing not found or access denied')
  }

  // Update listing
  const { data: updated, error: updateError } = await supabase
    .from('marketplace_listings')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to update listing: ${updateError.message}`)
  }

  return updated
}

/**
 * Publish a listing to the marketplace
 */
export async function publishListing(
  listingId: string,
  trainerId: string
): Promise<MarketplaceListing> {
  const supabase = createClient()

  // Verify ownership and status
  const { data: listing, error: fetchError } = await supabase
    .from('marketplace_listings')
    .select('*, bots!inner(trust_score, trust_tier, status)')
    .eq('id', listingId)
    .eq('trainer_id', trainerId)
    .single()

  if (fetchError || !listing) {
    throw new Error('Listing not found or access denied')
  }

  if (listing.status === 'active') {
    throw new Error('Listing is already published')
  }

  // Verify agent is still active
  if (listing.bots.status !== 'active') {
    throw new Error('Agent must be in active status to publish')
  }

  const now = new Date().toISOString()

  // Update listing status
  const { data: published, error: publishError } = await supabase
    .from('marketplace_listings')
    .update({
      status: 'active',
      published_at: now,
      updated_at: now,
    })
    .eq('id', listingId)
    .select()
    .single()

  if (publishError) {
    throw new Error(`Failed to publish listing: ${publishError.message}`)
  }

  // Update agent published flag
  await supabase
    .from('bots')
    .update({
      published: true,
      commission_rate: listing.commission_rate,
    })
    .eq('id', listing.agent_id)

  // Record on Truth Chain
  try {
    await recordMarketplaceListing({
      listing_id: listingId,
      agent_id: listing.agent_id,
      trainer_id: trainerId,
      action: 'published',
      commission_rate: listing.commission_rate,
    })
  } catch (error) {
    console.error('Truth Chain recording error:', error)
  }

  return published
}

/**
 * Unpublish (pause) a listing
 */
export async function unpublishListing(
  listingId: string,
  trainerId: string
): Promise<MarketplaceListing> {
  const supabase = createClient()

  const { data: updated, error } = await supabase
    .from('marketplace_listings')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .eq('trainer_id', trainerId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to unpublish listing: ${error.message}`)
  }

  // Update agent published flag
  await supabase
    .from('bots')
    .update({ published: false })
    .eq('id', updated.agent_id)

  return updated
}

// ============================================================================
// Marketplace Search (Story 6-2)
// ============================================================================

/**
 * Search and browse marketplace listings
 */
export async function searchListings(
  params: ListingSearchParams
): Promise<{ listings: ListingWithAgent[]; total: number }> {
  const supabase = createClient()

  let query = supabase
    .from('marketplace_listings')
    .select(`
      *,
      agent:bots!inner(
        id,
        name,
        description,
        trust_score,
        trust_tier,
        status,
        capabilities
      ),
      trainer:auth.users(
        id,
        email,
        raw_user_meta_data
      )
    `, { count: 'exact' })
    .eq('status', 'active')

  // Category filter
  if (params.category && params.category !== 'all') {
    query = query.eq('category', params.category)
  }

  // Trust score filter
  if (params.min_trust_score) {
    query = query.gte('agent.trust_score', params.min_trust_score)
  }

  // Commission filter
  if (params.max_commission) {
    query = query.lte('commission_rate', params.max_commission)
  }

  // Rating filter
  if (params.min_rating) {
    query = query.gte('average_rating', params.min_rating)
  }

  // Tags filter
  if (params.tags && params.tags.length > 0) {
    query = query.overlaps('tags', params.tags)
  }

  // Text search
  if (params.query) {
    query = query.textSearch('title', params.query, { type: 'websearch' })
  }

  // Sorting
  switch (params.sort_by) {
    case 'trust_score':
      query = query.order('agent(trust_score)', { ascending: false })
      break
    case 'rating':
      query = query.order('average_rating', { ascending: false, nullsFirst: false })
      break
    case 'acquisitions':
      query = query.order('total_acquisitions', { ascending: false })
      break
    case 'price_low':
      query = query.order('commission_rate', { ascending: true })
      break
    case 'price_high':
      query = query.order('commission_rate', { ascending: false })
      break
    case 'newest':
    default:
      query = query.order('published_at', { ascending: false })
  }

  // Pagination
  const limit = params.limit || 20
  const offset = params.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Search failed: ${error.message}`)
  }

  // Transform data
  const listings: ListingWithAgent[] = (data || []).map((item: any) => ({
    ...item,
    agent: item.agent,
    trainer: item.trainer ? {
      id: item.trainer.id,
      email: item.trainer.email,
      full_name: item.trainer.raw_user_meta_data?.full_name,
      avatar_url: item.trainer.raw_user_meta_data?.avatar_url,
    } : undefined,
  }))

  return {
    listings,
    total: count || 0,
  }
}

/**
 * Get a single listing with full details
 */
export async function getListing(listingId: string): Promise<ListingWithAgent | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(`
      *,
      agent:bots(
        id,
        name,
        description,
        trust_score,
        trust_tier,
        status,
        capabilities,
        personality_traits
      )
    `)
    .eq('id', listingId)
    .single()

  if (error || !data) {
    return null
  }

  // Type assertion needed due to Supabase's complex join types
  const listing = data as any

  return {
    ...listing,
    agent: listing.agent,
  } as ListingWithAgent
}

/**
 * Get listings by trainer
 */
export async function getTrainerListings(trainerId: string): Promise<ListingWithAgent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(`
      *,
      agent:bots(
        id,
        name,
        description,
        trust_score,
        trust_tier,
        status
      )
    `)
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch trainer listings: ${error.message}`)
  }

  return (data || []) as ListingWithAgent[]
}

/**
 * Get marketplace categories
 */
export async function getCategories(): Promise<MarketplaceCategory[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('marketplace_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order')

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`)
  }

  return data || []
}

// ============================================================================
// Acquisitions (Story 6-4)
// ============================================================================

/**
 * Acquire an agent (commission model)
 */
export async function acquireAgent(
  consumerId: string,
  input: CreateAcquisitionInput
): Promise<Acquisition> {
  const supabase = createClient()

  // Get listing details
  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', input.listing_id)
    .eq('status', 'active')
    .single()

  if (listingError || !listing) {
    throw new Error('Listing not found or not available')
  }

  // Check if consumer already has this agent
  const { data: existingAcquisition } = await supabase
    .from('acquisitions')
    .select('id')
    .eq('agent_id', listing.agent_id)
    .eq('consumer_id', consumerId)
    .eq('status', 'active')
    .single()

  if (existingAcquisition) {
    throw new Error('You have already acquired this agent')
  }

  // Cannot acquire own agent
  if (listing.trainer_id === consumerId) {
    throw new Error('You cannot acquire your own agent')
  }

  // Create acquisition
  const { data: acquisition, error: createError } = await supabase
    .from('acquisitions')
    .insert({
      listing_id: listing.id,
      agent_id: listing.agent_id,
      consumer_id: consumerId,
      trainer_id: listing.trainer_id,
      acquisition_type: input.acquisition_type || 'commission',
      status: 'active',
      commission_rate_locked: listing.commission_rate,
      platform_fee_locked: listing.platform_fee_percent,
      complexity_multiplier_locked: listing.complexity_multiplier,
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to acquire agent: ${createError.message}`)
  }

  // Update listing stats
  await supabase
    .from('marketplace_listings')
    .update({
      total_acquisitions: listing.total_acquisitions + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listing.id)

  // Record on Truth Chain
  try {
    await recordAcquisition({
      acquisition_id: acquisition.id,
      listing_id: listing.id,
      agent_id: listing.agent_id,
      consumer_id: consumerId,
      trainer_id: listing.trainer_id,
      acquisition_type: acquisition.acquisition_type,
      commission_rate: acquisition.commission_rate_locked,
    })
  } catch (error) {
    console.error('Truth Chain recording error:', error)
  }

  return acquisition
}

/**
 * Get consumer's acquired agents
 */
export async function getConsumerAcquisitions(
  consumerId: string
): Promise<AcquisitionWithDetails[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('acquisitions')
    .select(`
      *,
      listing:marketplace_listings(*),
      agent:bots(
        id,
        name,
        trust_score,
        trust_tier
      )
    `)
    .eq('consumer_id', consumerId)
    .order('acquired_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch acquisitions: ${error.message}`)
  }

  return (data || []) as AcquisitionWithDetails[]
}

/**
 * Terminate an acquisition
 */
export async function terminateAcquisition(
  acquisitionId: string,
  consumerId: string,
  reason: string
): Promise<Acquisition> {
  const supabase = createClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('acquisitions')
    .update({
      status: 'terminated',
      terminated_at: now,
      termination_reason: reason,
    })
    .eq('id', acquisitionId)
    .eq('consumer_id', consumerId)
    .eq('status', 'active')
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to terminate acquisition: ${error.message}`)
  }

  return data
}

// ============================================================================
// Usage Tracking (FR30)
// ============================================================================

/**
 * Record usage for billing
 */
export async function recordUsage(
  acquisitionId: string,
  taskType: string,
  tokensInput: number,
  tokensOutput: number,
  complexityFactor: number = 1.0
): Promise<void> {
  const supabase = createClient()

  // Get acquisition details
  const { data: acquisition, error: fetchError } = await supabase
    .from('acquisitions')
    .select('*, listing:marketplace_listings(*)')
    .eq('id', acquisitionId)
    .single()

  if (fetchError || !acquisition) {
    throw new Error('Acquisition not found')
  }

  // Calculate costs
  const baseCost = (tokensInput + tokensOutput) * acquisition.commission_rate_locked / 1000
  const finalCost = baseCost * acquisition.complexity_multiplier_locked * complexityFactor

  // Record usage
  const { error: usageError } = await supabase
    .from('acquisition_usage')
    .insert({
      acquisition_id: acquisitionId,
      agent_id: acquisition.agent_id,
      consumer_id: acquisition.consumer_id,
      task_type: taskType,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      complexity_factor: complexityFactor,
      base_cost: baseCost,
      final_cost: finalCost,
    })

  if (usageError) {
    throw new Error(`Failed to record usage: ${usageError.message}`)
  }

  // Calculate platform fee and earnings
  const platformFeeAmount = finalCost * (acquisition.platform_fee_locked / 100)
  const netAmount = finalCost - platformFeeAmount

  // Record earnings
  await supabase
    .from('trainer_earnings')
    .insert({
      trainer_id: acquisition.trainer_id,
      acquisition_id: acquisitionId,
      listing_id: acquisition.listing_id,
      agent_id: acquisition.agent_id,
      task_type: taskType,
      task_complexity: complexityFactor,
      gross_amount: finalCost,
      platform_fee: platformFeeAmount,
      net_amount: netAmount,
      status: 'pending',
    })

  // Update acquisition stats
  await supabase
    .from('acquisitions')
    .update({
      total_tasks: acquisition.total_tasks + 1,
      total_cost: Number(acquisition.total_cost) + finalCost,
      last_task_at: new Date().toISOString(),
    })
    .eq('id', acquisitionId)

  // Update listing stats
  await supabase
    .from('marketplace_listings')
    .update({
      total_tasks_completed: acquisition.listing.total_tasks_completed + 1,
      total_earnings: Number(acquisition.listing.total_earnings) + netAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', acquisition.listing_id)
}

// ============================================================================
// Featured Listings
// ============================================================================

/**
 * Get featured listings
 */
export async function getFeaturedListings(limit: number = 6): Promise<ListingWithAgent[]> {
  const supabase = createClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(`
      *,
      agent:bots(
        id,
        name,
        description,
        trust_score,
        trust_tier,
        status
      )
    `)
    .eq('status', 'active')
    .eq('featured', true)
    .or(`featured_until.is.null,featured_until.gt.${now}`)
    .order('average_rating', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch featured listings: ${error.message}`)
  }

  return (data || []) as ListingWithAgent[]
}

/**
 * Get top rated listings
 */
export async function getTopRatedListings(limit: number = 6): Promise<ListingWithAgent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(`
      *,
      agent:bots(
        id,
        name,
        description,
        trust_score,
        trust_tier,
        status
      )
    `)
    .eq('status', 'active')
    .not('average_rating', 'is', null)
    .gte('rating_count', 3) // Minimum 3 reviews
    .order('average_rating', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch top rated listings: ${error.message}`)
  }

  return (data || []) as ListingWithAgent[]
}
