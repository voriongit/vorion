/**
 * Server-side Pusher Client
 *
 * Used in API routes to broadcast events to connected clients.
 */

import Pusher from 'pusher'

// Create server-side Pusher instance
const pusherServer =
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET &&
  process.env.PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true,
      })
    : null

/**
 * Check if Pusher is configured
 */
export function isPusherConfigured(): boolean {
  return pusherServer !== null
}

/**
 * Get the Pusher server instance
 * Throws if not configured
 */
export function getPusherServer(): Pusher {
  if (!pusherServer) {
    throw new Error(
      'Pusher is not configured. Please set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, and PUSHER_CLUSTER environment variables.'
    )
  }
  return pusherServer
}

/**
 * Trigger an event on a channel (safe - no-op if Pusher not configured)
 */
export async function triggerEvent(
  channel: string,
  event: string,
  data: unknown
): Promise<void> {
  if (!pusherServer) {
    console.warn(`[Pusher] Not configured - skipping event ${event} on ${channel}`)
    return
  }

  try {
    await pusherServer.trigger(channel, event, data)
  } catch (error) {
    console.error(`[Pusher] Failed to trigger event ${event}:`, error)
    throw error
  }
}

/**
 * Trigger an event to multiple channels
 */
export async function triggerBatch(
  channels: string[],
  event: string,
  data: unknown
): Promise<void> {
  if (!pusherServer) {
    console.warn(`[Pusher] Not configured - skipping batch event ${event}`)
    return
  }

  try {
    // Pusher has a limit of 100 channels per batch
    const batchSize = 100
    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize)
      await pusherServer.trigger(batch, event, data)
    }
  } catch (error) {
    console.error(`[Pusher] Failed to trigger batch event ${event}:`, error)
    throw error
  }
}

export default pusherServer
