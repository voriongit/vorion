/**
 * Phase 6 Webhook Notifications API
 *
 * Manages webhook subscriptions for Phase 6 events:
 * - Gaming alerts
 * - Ceiling breaches
 * - Role gate escalations
 * - Compliance violations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, createHmac } from 'crypto'

// =============================================================================
// TYPES
// =============================================================================

interface WebhookSubscription {
  id: string
  url: string
  secret: string
  events: WebhookEventType[]
  filters?: {
    agentIds?: string[]
    severities?: string[]
    complianceFrameworks?: string[]
  }
  active: boolean
  createdAt: string
  lastTriggered?: string
  failureCount: number
}

type WebhookEventType =
  | 'gaming_alert.created'
  | 'gaming_alert.resolved'
  | 'ceiling.breach'
  | 'ceiling.warning'
  | 'role_gate.escalate'
  | 'role_gate.deny'
  | 'compliance.violation'
  | 'provenance.created'

interface WebhookPayload {
  id: string
  event: WebhookEventType
  timestamp: string
  data: Record<string, unknown>
}

// =============================================================================
// IN-MEMORY STORAGE (use database in production)
// =============================================================================

const webhookSubscriptions: Map<string, WebhookSubscription> = new Map()

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/phase6/webhooks
 * List webhook subscriptions
 */
export async function GET(request: NextRequest) {
  const subscriptions = Array.from(webhookSubscriptions.values())
    .map(sub => ({
      ...sub,
      secret: '***hidden***', // Don't expose secrets
    }))

  return NextResponse.json({
    subscriptions,
    count: subscriptions.length,
  })
}

/**
 * POST /api/phase6/webhooks
 * Create a new webhook subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, events, filters } = body

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid or missing URL' },
        { status: 400 }
      )
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event type is required' },
        { status: 400 }
      )
    }

    const validEvents: WebhookEventType[] = [
      'gaming_alert.created',
      'gaming_alert.resolved',
      'ceiling.breach',
      'ceiling.warning',
      'role_gate.escalate',
      'role_gate.deny',
      'compliance.violation',
      'provenance.created',
    ]

    for (const event of events) {
      if (!validEvents.includes(event)) {
        return NextResponse.json(
          { error: `Invalid event type: ${event}` },
          { status: 400 }
        )
      }
    }

    // Generate subscription
    const id = generateId()
    const secret = generateSecret()

    const subscription: WebhookSubscription = {
      id,
      url,
      secret,
      events,
      filters,
      active: true,
      createdAt: new Date().toISOString(),
      failureCount: 0,
    }

    webhookSubscriptions.set(id, subscription)

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        url: subscription.url,
        secret: subscription.secret, // Show secret only on creation
        events: subscription.events,
        active: subscription.active,
      },
      message: 'Webhook subscription created. Store the secret securely - it will not be shown again.',
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/phase6/webhooks
 * Delete a webhook subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Subscription ID required' },
        { status: 400 }
      )
    }

    if (!webhookSubscriptions.has(id)) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    webhookSubscriptions.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Webhook subscription deleted',
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/phase6/webhooks
 * Update a webhook subscription (toggle active, update filters)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, active, filters, events } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Subscription ID required' },
        { status: 400 }
      )
    }

    const subscription = webhookSubscriptions.get(id)
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Update fields
    if (active !== undefined) {
      subscription.active = active
    }
    if (filters !== undefined) {
      subscription.filters = filters
    }
    if (events !== undefined) {
      subscription.events = events
    }

    webhookSubscriptions.set(id, subscription)

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        url: subscription.url,
        events: subscription.events,
        active: subscription.active,
        filters: subscription.filters,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

// =============================================================================
// WEBHOOK DELIVERY (export for use by other services)
// =============================================================================

/**
 * Deliver webhook to all matching subscriptions
 */
export async function deliverWebhook(
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<{ delivered: number; failed: number }> {
  const payload: WebhookPayload = {
    id: generateId(),
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  let delivered = 0
  let failed = 0

  for (const subscription of webhookSubscriptions.values()) {
    // Check if subscription matches
    if (!subscription.active) continue
    if (!subscription.events.includes(event)) continue

    // Check filters
    if (subscription.filters) {
      if (subscription.filters.agentIds && data.agentId) {
        if (!subscription.filters.agentIds.includes(data.agentId as string)) {
          continue
        }
      }
      if (subscription.filters.severities && data.severity) {
        if (!subscription.filters.severities.includes(data.severity as string)) {
          continue
        }
      }
    }

    // Deliver webhook
    try {
      const signature = signPayload(payload, subscription.secret)

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': payload.id,
          'X-Webhook-Event': event,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok) {
        subscription.lastTriggered = new Date().toISOString()
        subscription.failureCount = 0
        delivered++
      } else {
        subscription.failureCount++
        failed++
      }
    } catch (error) {
      subscription.failureCount++
      failed++

      // Disable after 5 consecutive failures
      if (subscription.failureCount >= 5) {
        subscription.active = false
        console.warn(`[Webhook] Disabled subscription ${subscription.id} after 5 failures`)
      }
    }
  }

  return { delivered, failed }
}

// =============================================================================
// UTILITIES
// =============================================================================

function generateId(): string {
  return `whk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function generateSecret(): string {
  return `whsec_${createHash('sha256')
    .update(Math.random().toString())
    .digest('hex')
    .slice(0, 32)}`
}

function signPayload(payload: WebhookPayload, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify(payload)
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  return `t=${timestamp},v1=${signature}`
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost'
  } catch {
    return false
  }
}

/**
 * Verify webhook signature (for webhook receivers)
 */
export function verifyWebhookSignature(
  signature: string,
  body: string,
  secret: string,
  tolerance: number = 300 // 5 minutes
): boolean {
  const parts = signature.split(',')
  const timestampPart = parts.find(p => p.startsWith('t='))
  const signaturePart = parts.find(p => p.startsWith('v1='))

  if (!timestampPart || !signaturePart) {
    return false
  }

  const timestamp = parseInt(timestampPart.slice(2), 10)
  const receivedSig = signaturePart.slice(3)

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > tolerance) {
    return false
  }

  // Verify signature
  const expectedSig = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  return receivedSig === expectedSig
}
