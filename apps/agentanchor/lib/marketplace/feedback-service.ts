/**
 * Feedback Service
 * Story 6-5: Consumer Feedback (FR31, FR104)
 */

import { createClient } from '@/lib/supabase/server'
import {
  AgentFeedback,
  FeedbackWithConsumer,
  CreateFeedbackInput,
} from './types'
import { applyTrustChange } from '@/lib/agents/trust-service'

// Minimum tasks before feedback allowed
const MIN_TASKS_FOR_FEEDBACK = 3

/**
 * Submit feedback for an acquired agent
 */
export async function submitFeedback(
  consumerId: string,
  input: CreateFeedbackInput
): Promise<AgentFeedback> {
  const supabase = createClient()

  // Get acquisition and verify ownership
  const { data: acquisition, error: acqError } = await supabase
    .from('acquisitions')
    .select('*, listing:marketplace_listings(*)')
    .eq('id', input.acquisition_id)
    .eq('consumer_id', consumerId)
    .single()

  if (acqError || !acquisition) {
    throw new Error('Acquisition not found or access denied')
  }

  // Check minimum usage
  if (acquisition.total_tasks < MIN_TASKS_FOR_FEEDBACK) {
    throw new Error(`Please complete at least ${MIN_TASKS_FOR_FEEDBACK} tasks before submitting feedback`)
  }

  // Check for existing feedback
  const { data: existingFeedback } = await supabase
    .from('agent_feedback')
    .select('id')
    .eq('acquisition_id', input.acquisition_id)
    .single()

  if (existingFeedback) {
    throw new Error('You have already submitted feedback for this acquisition. Use updateFeedback to modify it.')
  }

  // Create feedback
  const { data: feedback, error: createError } = await supabase
    .from('agent_feedback')
    .insert({
      acquisition_id: input.acquisition_id,
      listing_id: acquisition.listing_id,
      agent_id: acquisition.agent_id,
      consumer_id: consumerId,
      rating: input.rating,
      title: input.title,
      review: input.review,
      is_complaint: input.is_complaint || false,
      complaint_status: input.is_complaint ? 'pending' : null,
      tasks_completed_at_review: acquisition.total_tasks,
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to submit feedback: ${createError.message}`)
  }

  // If complaint, apply trust penalty
  if (input.is_complaint) {
    try {
      await applyTrustChange(
        acquisition.agent_id,
        'complaint_filed',
        -20,
        `Consumer complaint filed: ${input.title || 'No title'}`,
        {
          feedback_id: feedback.id,
          rating: input.rating,
        }
      )
    } catch (error) {
      console.error('Failed to apply trust penalty for complaint:', error)
    }
  }

  // Apply positive trust change for good ratings
  if (input.rating >= 4 && !input.is_complaint) {
    try {
      await applyTrustChange(
        acquisition.agent_id,
        'user_positive_feedback',
        input.rating === 5 ? 5 : 2,
        `Positive consumer feedback: ${input.rating} stars`,
        {
          feedback_id: feedback.id,
          rating: input.rating,
        }
      )
    } catch (error) {
      console.error('Failed to apply trust bonus for positive feedback:', error)
    }
  }

  return feedback
}

/**
 * Update existing feedback
 */
export async function updateFeedback(
  feedbackId: string,
  consumerId: string,
  input: Partial<CreateFeedbackInput>
): Promise<AgentFeedback> {
  const supabase = createClient()

  const { data: feedback, error } = await supabase
    .from('agent_feedback')
    .update({
      rating: input.rating,
      title: input.title,
      review: input.review,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)
    .eq('consumer_id', consumerId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update feedback: ${error.message}`)
  }

  return feedback
}

/**
 * Add trainer response to feedback
 */
export async function addTrainerResponse(
  feedbackId: string,
  trainerId: string,
  response: string
): Promise<AgentFeedback> {
  const supabase = createClient()

  // Verify trainer owns the listing
  const { data: feedback, error: fetchError } = await supabase
    .from('agent_feedback')
    .select('*, listing:marketplace_listings!inner(trainer_id)')
    .eq('id', feedbackId)
    .single()

  if (fetchError || !feedback) {
    throw new Error('Feedback not found')
  }

  if (feedback.listing.trainer_id !== trainerId) {
    throw new Error('Access denied')
  }

  const { data: updated, error } = await supabase
    .from('agent_feedback')
    .update({
      trainer_response: response,
      trainer_responded_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add response: ${error.message}`)
  }

  return updated
}

/**
 * Get feedback for a listing
 */
export async function getListingFeedback(
  listingId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ feedback: FeedbackWithConsumer[]; total: number }> {
  const supabase = createClient()

  const { data, error, count } = await supabase
    .from('agent_feedback')
    .select(`
      *,
      consumer:auth.users(
        id,
        raw_user_meta_data
      )
    `, { count: 'exact' })
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch feedback: ${error.message}`)
  }

  const feedback: FeedbackWithConsumer[] = (data || []).map((item: any) => ({
    ...item,
    consumer: item.consumer ? {
      id: item.consumer.id,
      full_name: item.consumer.raw_user_meta_data?.full_name,
      avatar_url: item.consumer.raw_user_meta_data?.avatar_url,
    } : undefined,
  }))

  return {
    feedback,
    total: count || 0,
  }
}

/**
 * Get feedback for an agent
 */
export async function getAgentFeedback(
  agentId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ feedback: FeedbackWithConsumer[]; total: number }> {
  const supabase = createClient()

  const { data, error, count } = await supabase
    .from('agent_feedback')
    .select(`
      *,
      consumer:auth.users(
        id,
        raw_user_meta_data
      )
    `, { count: 'exact' })
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch feedback: ${error.message}`)
  }

  const feedback: FeedbackWithConsumer[] = (data || []).map((item: any) => ({
    ...item,
    consumer: item.consumer ? {
      id: item.consumer.id,
      full_name: item.consumer.raw_user_meta_data?.full_name,
      avatar_url: item.consumer.raw_user_meta_data?.avatar_url,
    } : undefined,
  }))

  return {
    feedback,
    total: count || 0,
  }
}

/**
 * Get consumer's submitted feedback
 */
export async function getConsumerFeedback(
  consumerId: string
): Promise<AgentFeedback[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_feedback')
    .select('*')
    .eq('consumer_id', consumerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch consumer feedback: ${error.message}`)
  }

  return data || []
}

/**
 * Get pending complaints for trainer
 */
export async function getTrainerComplaints(
  trainerId: string
): Promise<FeedbackWithConsumer[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_feedback')
    .select(`
      *,
      listing:marketplace_listings!inner(trainer_id),
      consumer:auth.users(
        id,
        raw_user_meta_data
      )
    `)
    .eq('listing.trainer_id', trainerId)
    .eq('is_complaint', true)
    .in('complaint_status', ['pending', 'investigating'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch complaints: ${error.message}`)
  }

  return (data || []).map((item: any) => ({
    ...item,
    consumer: item.consumer ? {
      id: item.consumer.id,
      full_name: item.consumer.raw_user_meta_data?.full_name,
      avatar_url: item.consumer.raw_user_meta_data?.avatar_url,
    } : undefined,
  })) as FeedbackWithConsumer[]
}

/**
 * Get rating distribution for a listing
 */
export async function getRatingDistribution(
  listingId: string
): Promise<{ rating: number; count: number }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_feedback')
    .select('rating')
    .eq('listing_id', listingId)

  if (error) {
    throw new Error(`Failed to fetch rating distribution: ${error.message}`)
  }

  // Count ratings
  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const item of data || []) {
    distribution[item.rating] = (distribution[item.rating] || 0) + 1
  }

  return Object.entries(distribution).map(([rating, count]) => ({
    rating: parseInt(rating),
    count,
  }))
}
