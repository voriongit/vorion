/**
 * Pusher React Hooks
 *
 * Convenient hooks for subscribing to Pusher events in React components.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { subscribeToChannel, subscribeToPrivateChannel, getPusherClient } from './client'
import type { EventPayloadMap } from './events'
import { EVENTS } from './events'

/**
 * Subscribe to a Pusher channel event
 *
 * @example
 * const { data, isConnected } = usePusherEvent('observer-feed', 'new-event')
 */
export function usePusherEvent<T = unknown>(
  channel: string,
  event: string,
  onEvent?: (data: T) => void
) {
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const client = getPusherClient()
    setIsConnected(client !== null)

    if (!client) return

    const handleEvent = (eventData: T) => {
      setData(eventData)
      onEvent?.(eventData)
    }

    const unsubscribe = subscribeToChannel<T>(channel, event, handleEvent)

    return () => {
      unsubscribe()
    }
  }, [channel, event, onEvent])

  return { data, isConnected }
}

/**
 * Subscribe to typed Pusher events with automatic type inference
 *
 * @example
 * const { data } = useTypedPusherEvent('observer-feed', EVENTS.NEW_OBSERVER_EVENT)
 * // data is automatically typed as ObserverEventPayload
 */
export function useTypedPusherEvent<E extends keyof EventPayloadMap>(
  channel: string,
  event: E,
  onEvent?: (data: EventPayloadMap[E]) => void
) {
  return usePusherEvent<EventPayloadMap[E]>(channel, event, onEvent)
}

/**
 * Subscribe to a private channel (requires authentication)
 *
 * @example
 * const { data } = usePrivatePusherEvent(`user-${userId}`, 'notification')
 */
export function usePrivatePusherEvent<T = unknown>(
  channelSuffix: string,
  event: string,
  onEvent?: (data: T) => void
) {
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const client = getPusherClient()
    setIsConnected(client !== null)

    if (!client) return

    const handleEvent = (eventData: T) => {
      setData(eventData)
      onEvent?.(eventData)
    }

    const unsubscribe = subscribeToPrivateChannel<T>(channelSuffix, event, handleEvent)

    return () => {
      unsubscribe()
    }
  }, [channelSuffix, event, onEvent])

  return { data, isConnected }
}

/**
 * Subscribe to observer feed events
 *
 * @example
 * const { events, latestEvent } = useObserverFeed()
 */
export function useObserverFeed(maxEvents: number = 50) {
  const [events, setEvents] = useState<EventPayloadMap[typeof EVENTS.NEW_OBSERVER_EVENT][]>([])

  const handleNewEvent = useCallback(
    (event: EventPayloadMap[typeof EVENTS.NEW_OBSERVER_EVENT]) => {
      setEvents((prev) => {
        const updated = [event, ...prev]
        return updated.slice(0, maxEvents)
      })
    },
    [maxEvents]
  )

  const { isConnected } = useTypedPusherEvent('observer-feed', EVENTS.NEW_OBSERVER_EVENT, handleNewEvent)

  return {
    events,
    latestEvent: events[0] ?? null,
    isConnected,
    clearEvents: () => setEvents([]),
  }
}

/**
 * Subscribe to user-specific notifications
 *
 * @example
 * const { notifications, unreadCount } = useUserNotifications(userId)
 */
export function useUserNotifications(userId: string | undefined, maxNotifications: number = 20) {
  const [notifications, setNotifications] = useState<EventPayloadMap[typeof EVENTS.NOTIFICATION][]>([])

  const handleNotification = useCallback(
    (notification: EventPayloadMap[typeof EVENTS.NOTIFICATION]) => {
      setNotifications((prev) => {
        const updated = [notification, ...prev]
        return updated.slice(0, maxNotifications)
      })
    },
    [maxNotifications]
  )

  const { isConnected } = usePrivatePusherEvent<EventPayloadMap[typeof EVENTS.NOTIFICATION]>(
    userId ? `user-${userId}` : '',
    EVENTS.NOTIFICATION,
    userId ? handleNotification : undefined
  )

  return {
    notifications,
    latestNotification: notifications[0] ?? null,
    unreadCount: notifications.length,
    isConnected: userId ? isConnected : false,
    clearNotifications: () => setNotifications([]),
  }
}
