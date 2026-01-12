/**
 * Notification Service
 * Epic 7: Dashboard & Notifications (FR137-143)
 */

import { createClient } from '@/lib/supabase/server'
import {
  Notification,
  NotificationPreference,
  CreateNotificationInput,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NOTIFICATION_TYPES,
  EARNINGS_MILESTONES,
} from './types'

/**
 * Create a notification
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification> {
  const supabase = createClient()

  const priority = input.priority || NOTIFICATION_TYPES[input.type].defaultPriority

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.user_id,
      type: input.type,
      priority,
      title: input.title,
      message: input.message,
      data: input.data || {},
      action_url: input.action_url,
      expires_at: input.expires_at,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`)
  }

  // Queue delivery based on user preferences
  await queueDeliveries(data.id, input.user_id, input.type)

  return data
}

/**
 * Queue notification deliveries based on user preferences
 */
async function queueDeliveries(
  notificationId: string,
  userId: string,
  type: NotificationType
): Promise<void> {
  const supabase = createClient()

  // Get user's enabled channels for this notification type
  const { data: preferences } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .eq('enabled', true)

  if (!preferences || preferences.length === 0) {
    // Default to in-app if no preferences
    await supabase.from('notification_deliveries').insert({
      notification_id: notificationId,
      channel: 'in_app',
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    return
  }

  // Queue each enabled channel
  const deliveries = preferences.map((pref) => ({
    notification_id: notificationId,
    channel: pref.channel,
    status: pref.channel === 'in_app' ? 'sent' : 'pending',
    sent_at: pref.channel === 'in_app' ? new Date().toISOString() : null,
  }))

  await supabase.from('notification_deliveries').insert(deliveries)
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean
    type?: NotificationType
    limit?: number
    offset?: number
  } = {}
): Promise<{ notifications: Notification[]; total: number }> {
  const supabase = createClient()

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })

  if (options.unreadOnly) {
    query = query.eq('read', false)
  }

  if (options.type) {
    query = query.eq('type', options.type)
  }

  const limit = options.limit || 20
  const offset = options.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`)
  }

  return {
    notifications: data || [],
    total: count || 0,
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .eq('dismissed', false)

  if (error) {
    return 0
  }

  return count || 0
}

/**
 * Mark notifications as read
 */
export async function markAsRead(
  userId: string,
  notificationIds: string[]
): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', notificationIds)
    .eq('read', false)

  if (error) {
    throw new Error(`Failed to mark notifications as read: ${error.message}`)
  }

  return count || 0
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    throw new Error(`Failed to mark all as read: ${error.message}`)
  }

  return count || 0
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', notificationId)

  if (error) {
    throw new Error(`Failed to dismiss notification: ${error.message}`)
  }
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreference[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('notification_type')

  if (error) {
    throw new Error(`Failed to fetch preferences: ${error.message}`)
  }

  return data || []
}

/**
 * Update notification preference
 */
export async function updateNotificationPreference(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  enabled: boolean
): Promise<NotificationPreference> {
  const supabase = createClient()

  // Prevent disabling in-app for escalations
  if (type === 'escalation' && channel === 'in_app' && !enabled) {
    throw new Error('Escalation in-app notifications cannot be disabled')
  }

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .upsert({
      user_id: userId,
      notification_type: type,
      channel,
      enabled,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update preference: ${error.message}`)
  }

  return data
}

// =====================================================
// Event-specific notification creators
// =====================================================

/**
 * Send escalation notification (FR137)
 */
export async function notifyEscalation(
  userId: string,
  data: {
    agent_id: string
    agent_name: string
    action: string
    risk_level: number
    council_votes?: { approve: number; deny: number }
    decision_id: string
  }
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: 'escalation',
    priority: 'urgent',
    title: 'Escalation Requires Attention',
    message: `Agent "${data.agent_name}" requires human intervention for ${data.action}. Risk Level: ${data.risk_level}`,
    data,
    action_url: `/council/escalations/${data.decision_id}`,
  })
}

/**
 * Send graduation notification (FR138)
 */
export async function notifyGraduation(
  userId: string,
  data: {
    agent_id: string
    agent_name: string
    trust_tier: string
    trust_score: number
  }
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: 'graduation',
    priority: 'normal',
    title: 'Agent Graduated!',
    message: `Congratulations! "${data.agent_name}" has graduated and achieved ${data.trust_tier} status.`,
    data,
    action_url: `/agents/${data.agent_id}`,
  })
}

/**
 * Send anomaly notification (FR139)
 */
export async function notifyAnomaly(
  userId: string,
  data: {
    agent_id: string
    agent_name: string
    anomaly_type: string
    severity: string
    report_id: string
  }
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: 'anomaly',
    priority: 'high',
    title: 'Anomaly Detected',
    message: `Observer detected ${data.anomaly_type} anomaly in "${data.agent_name}". Severity: ${data.severity}`,
    data,
    action_url: `/observer/reports/${data.report_id}`,
  })
}

/**
 * Send ownership change notification (FR140)
 */
export async function notifyOwnershipChange(
  userId: string,
  data: {
    agent_id: string
    agent_name: string
    change_type: string
    new_owner?: string
  }
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: 'ownership_change',
    title: 'Ownership Change',
    message: `Agent "${data.agent_name}" ownership has changed: ${data.change_type}`,
    data,
    action_url: `/agents/${data.agent_id}`,
  })
}

/**
 * Send earnings milestone notification (FR141)
 */
export async function notifyEarningsMilestone(
  userId: string,
  data: {
    milestone_amount: number
    total_earnings: number
  }
): Promise<Notification> {
  const milestone = EARNINGS_MILESTONES.find(m => m.amount === data.milestone_amount)
  const label = milestone?.label || `$${data.milestone_amount} Earned`

  return createNotification({
    user_id: userId,
    type: 'earnings_milestone',
    priority: 'low',
    title: 'Milestone Achieved!',
    message: `Congratulations! You've reached the "${label}" milestone. Total earnings: $${data.total_earnings.toFixed(2)}`,
    data,
    action_url: '/earnings',
  })
}

/**
 * Send council decision notification
 */
export async function notifyCouncilDecision(
  userId: string,
  data: {
    decision_id: string
    agent_name: string
    action: string
    outcome: string
    votes: { approve: number; deny: number }
  }
): Promise<Notification> {
  return createNotification({
    user_id: userId,
    type: 'council_decision',
    title: 'Council Decision Made',
    message: `Council voted on "${data.agent_name}" ${data.action}: ${data.outcome}`,
    data,
    action_url: `/council/decisions/${data.decision_id}`,
  })
}

/**
 * Send acquisition notification
 */
export async function notifyAcquisition(
  trainerId: string,
  data: {
    agent_id: string
    agent_name: string
    listing_title: string
    consumer_name?: string
    acquisition_id: string
  }
): Promise<Notification> {
  return createNotification({
    user_id: trainerId,
    type: 'acquisition',
    title: 'New Acquisition',
    message: `Your agent "${data.agent_name}" has been acquired${data.consumer_name ? ` by ${data.consumer_name}` : ''}.`,
    data,
    action_url: `/marketplace/acquisitions/${data.acquisition_id}`,
  })
}

/**
 * Send feedback notification
 */
export async function notifyFeedback(
  trainerId: string,
  data: {
    agent_id: string
    agent_name: string
    rating: number
    is_complaint: boolean
    feedback_id: string
  }
): Promise<Notification> {
  return createNotification({
    user_id: trainerId,
    type: 'feedback_received',
    priority: data.is_complaint ? 'high' : 'low',
    title: data.is_complaint ? 'New Complaint' : 'New Review',
    message: `${data.is_complaint ? 'Complaint' : 'Review'} received for "${data.agent_name}": ${data.rating} stars`,
    data,
    action_url: `/marketplace/feedback/${data.feedback_id}`,
  })
}

/**
 * Send trust change notification
 */
export async function notifyTrustChange(
  userId: string,
  data: {
    agent_id: string
    agent_name: string
    old_score: number
    new_score: number
    old_tier: string
    new_tier: string
    reason: string
  }
): Promise<Notification> {
  const tierChanged = data.old_tier !== data.new_tier
  const direction = data.new_score > data.old_score ? 'increased' : 'decreased'

  return createNotification({
    user_id: userId,
    type: 'trust_change',
    priority: tierChanged ? 'high' : 'normal',
    title: tierChanged ? 'Trust Tier Changed' : 'Trust Score Updated',
    message: tierChanged
      ? `"${data.agent_name}" trust tier changed from ${data.old_tier} to ${data.new_tier}!`
      : `"${data.agent_name}" trust score ${direction} to ${data.new_score}.`,
    data,
    action_url: `/agents/${data.agent_id}`,
  })
}

/**
 * Generic consumer notification helper
 */
export async function notifyConsumer(input: {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  priority?: NotificationPriority
}): Promise<Notification> {
  return createNotification({
    user_id: input.userId,
    type: input.type as NotificationType,
    title: input.title,
    message: input.message,
    data: input.data,
    priority: input.priority,
  })
}

/**
 * Generic trainer notification helper
 */
export async function notifyTrainer(input: {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  priority?: NotificationPriority
}): Promise<Notification> {
  return createNotification({
    user_id: input.userId,
    type: input.type as NotificationType,
    title: input.title,
    message: input.message,
    data: input.data,
    priority: input.priority,
  })
}
