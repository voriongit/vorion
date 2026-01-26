/**
 * Phase 6 Real-time Events API (SSE)
 *
 * Server-Sent Events endpoint for real-time trust event streaming.
 * Streams ceiling events, role gate evaluations, gaming alerts, etc.
 */

import { NextRequest } from 'next/server'

// Event types
type Phase6EventType =
  | 'ceiling'
  | 'role_gate'
  | 'gaming_alert'
  | 'provenance'
  | 'context_change'
  | 'heartbeat'

interface Phase6Event {
  id: string
  type: Phase6EventType
  data: Record<string, unknown>
  timestamp: string
}

// In-memory event buffer (would use Redis/Kafka in production)
const eventBuffer: Phase6Event[] = []
const MAX_BUFFER_SIZE = 1000

/**
 * Add event to buffer (called by other services)
 */
export function emitPhase6Event(
  type: Phase6EventType,
  data: Record<string, unknown>
): void {
  const event: Phase6Event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    data,
    timestamp: new Date().toISOString(),
  }

  eventBuffer.push(event)

  // Trim buffer if too large
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER_SIZE)
  }
}

/**
 * GET /api/phase6/events
 * SSE endpoint for real-time event streaming
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filterType = searchParams.get('type')
  const filterAgentId = searchParams.get('agentId')
  const lastEventId = searchParams.get('lastEventId')

  // Create readable stream for SSE
  const encoder = new TextEncoder()
  let isConnected = true

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({
        message: 'Connected to Phase 6 event stream',
        filters: { type: filterType, agentId: filterAgentId },
        timestamp: new Date().toISOString(),
      })}\n\n`
      controller.enqueue(encoder.encode(connectEvent))

      // Send any buffered events after lastEventId
      if (lastEventId) {
        const lastIdx = eventBuffer.findIndex(e => e.id === lastEventId)
        if (lastIdx >= 0) {
          const missedEvents = eventBuffer.slice(lastIdx + 1)
          for (const event of missedEvents) {
            if (shouldSendEvent(event, filterType, filterAgentId)) {
              const sseEvent = formatSSEEvent(event)
              controller.enqueue(encoder.encode(sseEvent))
            }
          }
        }
      }

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        if (!isConnected) {
          clearInterval(heartbeatInterval)
          return
        }

        const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
          timestamp: new Date().toISOString(),
          bufferSize: eventBuffer.length,
        })}\n\n`
        controller.enqueue(encoder.encode(heartbeat))
      }, 30000) // Every 30 seconds

      // Poll for new events (would use pub/sub in production)
      let lastProcessedIndex = eventBuffer.length - 1
      const pollInterval = setInterval(() => {
        if (!isConnected) {
          clearInterval(pollInterval)
          return
        }

        // Check for new events
        if (eventBuffer.length > lastProcessedIndex + 1) {
          const newEvents = eventBuffer.slice(lastProcessedIndex + 1)
          for (const event of newEvents) {
            if (shouldSendEvent(event, filterType, filterAgentId)) {
              const sseEvent = formatSSEEvent(event)
              controller.enqueue(encoder.encode(sseEvent))
            }
          }
          lastProcessedIndex = eventBuffer.length - 1
        }
      }, 1000) // Poll every second

      // Handle disconnect
      request.signal.addEventListener('abort', () => {
        isConnected = false
        clearInterval(heartbeatInterval)
        clearInterval(pollInterval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

function shouldSendEvent(
  event: Phase6Event,
  filterType: string | null,
  filterAgentId: string | null
): boolean {
  if (filterType && event.type !== filterType) {
    return false
  }

  if (filterAgentId && event.data.agentId !== filterAgentId) {
    return false
  }

  return true
}

function formatSSEEvent(event: Phase6Event): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * POST /api/phase6/events
 * Publish an event (internal use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return Response.json(
        { error: 'Missing type or data' },
        { status: 400 }
      )
    }

    emitPhase6Event(type, data)

    return Response.json({
      success: true,
      eventCount: eventBuffer.length,
    })
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
