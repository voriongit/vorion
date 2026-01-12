/**
 * Webhook Service
 * Epic 8: Story 8-3 Webhooks (FR146)
 */

import { createClient } from '@/lib/supabase/server'
import { WebhookEvent, WebhookEventType } from './types'
import crypto from 'crypto'

const MAX_RETRIES = 3
const RETRY_DELAYS = [60, 300, 900] // seconds: 1min, 5min, 15min

/**
 * Generate webhook signature
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const signedPayload = `${timestamp}.${payload}`
  return crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string,
  tolerance: number = 300 // 5 minutes
): boolean {
  // Check timestamp is not too old
  const eventTime = parseInt(timestamp)
  const now = Math.floor(Date.now() / 1000)

  if (Math.abs(now - eventTime) > tolerance) {
    return false
  }

  const expectedSignature = generateWebhookSignature(payload, secret, timestamp)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Queue webhook event for delivery
 */
export async function queueWebhookEvent(
  eventType: WebhookEventType,
  data: Record<string, any>,
  options: {
    userId?: string
    agentId?: string
  } = {}
): Promise<void> {
  const supabase = createClient()

  // Find webhooks subscribed to this event type
  let query = supabase
    .from('user_webhooks')
    .select('*')
    .eq('enabled', true)
    .contains('notification_types', [eventType])

  if (options.userId) {
    query = query.eq('user_id', options.userId)
  }

  const { data: webhooks, error } = await query

  if (error || !webhooks || webhooks.length === 0) {
    return
  }

  // Create events for each webhook
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = JSON.stringify({
    event: eventType,
    timestamp,
    data,
  })

  const events = webhooks.map((webhook) => ({
    webhook_id: webhook.id,
    event_type: eventType,
    payload: { event: eventType, timestamp, data },
    signature: generateWebhookSignature(payload, webhook.secret || '', timestamp),
    status: 'pending',
    next_retry_at: new Date().toISOString(),
  }))

  await supabase.from('webhook_events').insert(events)
}

/**
 * Process pending webhook events
 * (Called by cron/background job)
 */
export async function processWebhookEvents(): Promise<number> {
  const supabase = createClient()

  // Get pending events that are ready for delivery
  const { data: events, error } = await supabase
    .from('webhook_events')
    .select('*, webhook:user_webhooks(*)')
    .in('status', ['pending', 'failed'])
    .lt('next_retry_at', new Date().toISOString())
    .lt('attempts', MAX_RETRIES)
    .limit(50)

  if (error || !events || events.length === 0) {
    return 0
  }

  let processed = 0

  for (const event of events as any[]) {
    const webhook = event.webhook

    if (!webhook || !webhook.enabled) {
      // Mark as failed if webhook is disabled
      await supabase
        .from('webhook_events')
        .update({ status: 'failed', error: 'Webhook disabled' })
        .eq('id', event.id)
      continue
    }

    try {
      // Attempt delivery
      const payload = JSON.stringify(event.payload)
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signature = generateWebhookSignature(payload, webhook.secret || '', timestamp)

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgentAnchor-Signature': `t=${timestamp},v1=${signature}`,
          'X-AgentAnchor-Event': event.event_type,
        },
        body: payload,
      })

      const responseBody = await response.text().catch(() => '')

      if (response.ok) {
        // Success
        await supabase
          .from('webhook_events')
          .update({
            status: 'delivered',
            attempts: event.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            response_status: response.status,
            response_body: responseBody.slice(0, 1000),
          })
          .eq('id', event.id)

        // Update webhook last success
        await supabase
          .from('user_webhooks')
          .update({ last_success_at: new Date().toISOString(), last_error: null })
          .eq('id', webhook.id)

        processed++
      } else {
        // Failed - schedule retry
        await handleWebhookFailure(event, response.status, responseBody)
      }
    } catch (err: any) {
      // Network or other error - schedule retry
      await handleWebhookFailure(event, 0, err.message)
    }
  }

  return processed
}

async function handleWebhookFailure(
  event: any,
  statusCode: number,
  error: string
): Promise<void> {
  const supabase = createClient()
  const attempts = event.attempts + 1

  if (attempts >= MAX_RETRIES) {
    // Max retries reached
    await supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        attempts,
        last_attempt_at: new Date().toISOString(),
        response_status: statusCode,
        error: error.slice(0, 1000),
      })
      .eq('id', event.id)

    // Update webhook last error
    await supabase
      .from('user_webhooks')
      .update({ last_error: error.slice(0, 500), retry_count: attempts })
      .eq('id', event.webhook_id)
  } else {
    // Schedule retry with exponential backoff
    const nextRetry = new Date()
    nextRetry.setSeconds(nextRetry.getSeconds() + RETRY_DELAYS[attempts - 1])

    await supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        attempts,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetry.toISOString(),
        response_status: statusCode,
        error: error.slice(0, 1000),
      })
      .eq('id', event.id)
  }
}

/**
 * Get webhook events for a webhook
 */
export async function getWebhookEvents(
  webhookId: string,
  limit: number = 20
): Promise<WebhookEvent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch webhook events: ${error.message}`)
  }

  return data || []
}

/**
 * Send test webhook
 */
export async function sendTestWebhook(webhookId: string, userId: string): Promise<{
  success: boolean
  status?: number
  error?: string
}> {
  const supabase = createClient()

  // Get webhook
  const { data: webhook, error } = await supabase
    .from('user_webhooks')
    .select('*')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .single()

  if (error || !webhook) {
    return { success: false, error: 'Webhook not found' }
  }

  // Send test event
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = JSON.stringify({
    event: 'test',
    timestamp,
    data: { message: 'This is a test webhook from AgentAnchor' },
  })
  const signature = generateWebhookSignature(payload, webhook.secret || '', timestamp)

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentAnchor-Signature': `t=${timestamp},v1=${signature}`,
        'X-AgentAnchor-Event': 'test',
      },
      body: payload,
    })

    if (response.ok) {
      await supabase
        .from('user_webhooks')
        .update({ last_success_at: new Date().toISOString() })
        .eq('id', webhookId)

      return { success: true, status: response.status }
    } else {
      return {
        success: false,
        status: response.status,
        error: await response.text().catch(() => 'Unknown error'),
      }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
