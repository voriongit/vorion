/**
 * Client-side Pusher Client
 *
 * Used in React components to subscribe to realtime events.
 */

'use client'

import PusherClient from 'pusher-js'

// Singleton instance
let pusherClientInstance: PusherClient | null = null

/**
 * Get or create the Pusher client instance
 */
export function getPusherClient(): PusherClient | null {
  // Only run in browser
  if (typeof window === 'undefined') {
    return null
  }

  // Check if Pusher is configured
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  if (!key || !cluster) {
    console.warn('[Pusher Client] Not configured - missing NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER')
    return null
  }

  // Create singleton instance
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(key, {
      cluster,
      // Enable logging in development
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(process.env.NODE_ENV === 'development' && { enabledTransports: ['ws', 'wss'] as any }),
    })

    // Log connection status in development
    if (process.env.NODE_ENV === 'development') {
      pusherClientInstance.connection.bind('connected', () => {
        console.log('[Pusher Client] Connected')
      })
      pusherClientInstance.connection.bind('disconnected', () => {
        console.log('[Pusher Client] Disconnected')
      })
      pusherClientInstance.connection.bind('error', (error: unknown) => {
        console.error('[Pusher Client] Error:', error)
      })
    }
  }

  return pusherClientInstance
}

/**
 * Subscribe to a channel and bind an event handler
 * Returns an unsubscribe function
 */
export function subscribeToChannel<T>(
  channelName: string,
  eventName: string,
  callback: (data: T) => void
): () => void {
  const client = getPusherClient()

  if (!client) {
    console.warn(`[Pusher Client] Cannot subscribe to ${channelName} - client not available`)
    return () => {}
  }

  const channel = client.subscribe(channelName)
  channel.bind(eventName, callback)

  // Return unsubscribe function
  return () => {
    channel.unbind(eventName, callback)
    client.unsubscribe(channelName)
  }
}

/**
 * Subscribe to a private channel (requires auth)
 * Note: Requires a Pusher auth endpoint at /api/pusher/auth
 */
export function subscribeToPrivateChannel<T>(
  channelName: string,
  eventName: string,
  callback: (data: T) => void
): () => void {
  const client = getPusherClient()

  if (!client) {
    console.warn(`[Pusher Client] Cannot subscribe to private-${channelName} - client not available`)
    return () => {}
  }

  const channel = client.subscribe(`private-${channelName}`)
  channel.bind(eventName, callback)

  return () => {
    channel.unbind(eventName, callback)
    client.unsubscribe(`private-${channelName}`)
  }
}

/**
 * Disconnect Pusher client
 */
export function disconnectPusher(): void {
  if (pusherClientInstance) {
    pusherClientInstance.disconnect()
    pusherClientInstance = null
  }
}

export default getPusherClient
