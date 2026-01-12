/**
 * Observer Service - Append-only event logging with cryptographic integrity
 * Story 5-1: Observer Event Logging (FR82-FR86)
 *
 * The Observer is an isolated audit layer that:
 * - Records every agent action (FR82)
 * - Enforces append-only logs (FR83)
 * - Includes cryptographic signatures (FR84)
 * - Is isolated from Worker/Council (FR85, FR86)
 */

import { createClient } from '@/lib/supabase/server'
import {
  ObserverEvent,
  EventInput,
  EventQueryOptions,
  EventFeedResponse,
  EventRiskLevel,
} from './types'

// Signing key from environment (in production, use proper key management)
const SIGNING_KEY = process.env.OBSERVER_SIGNING_KEY || 'development-key-not-for-production'

/**
 * Generate SHA-256 hash of data
 */
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate HMAC signature for event
 */
async function generateSignature(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(SIGNING_KEY)
  const messageData = encoder.encode(data)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get the last event hash for chain continuity
 */
async function getLastEventHash(): Promise<string> {
  const supabase = createClient()

  const { data } = await supabase
    .from('observer_events')
    .select('hash')
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  // Genesis block hash if no previous events
  return data?.hash || '0'.repeat(64)
}

/**
 * Get next sequence number
 */
async function getNextSequence(): Promise<number> {
  const supabase = createClient()

  const { data } = await supabase
    .from('observer_events')
    .select('sequence')
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  return (data?.sequence || 0) + 1
}

/**
 * Log an event to the Observer (FR82)
 * Events are append-only and cryptographically signed (FR83, FR84)
 */
export async function logEvent(input: EventInput): Promise<ObserverEvent> {
  const supabase = createClient()

  const timestamp = new Date().toISOString()
  const sequence = await getNextSequence()
  const previousHash = await getLastEventHash()

  // Create event data for hashing
  const eventData = {
    sequence,
    source: input.source,
    event_type: input.event_type,
    risk_level: input.risk_level || 'info',
    agent_id: input.agent_id,
    user_id: input.user_id,
    data: input.data,
    timestamp,
    previous_hash: previousHash,
  }

  // Generate hash chain
  const dataToHash = JSON.stringify(eventData)
  const hash = await generateHash(dataToHash)

  // Generate signature
  const signature = await generateSignature(hash)

  const event: Omit<ObserverEvent, 'id'> = {
    sequence,
    source: input.source,
    event_type: input.event_type,
    risk_level: input.risk_level || 'info',
    agent_id: input.agent_id,
    user_id: input.user_id,
    data: input.data,
    timestamp,
    previous_hash: previousHash,
    hash,
    signature,
  }

  // Insert into append-only table
  const { data: insertedEvent, error } = await supabase
    .from('observer_events')
    .insert(event)
    .select()
    .single()

  if (error) {
    console.error('Observer log error:', error)
    throw new Error('Failed to log event: ' + error.message)
  }

  return insertedEvent as ObserverEvent
}

/**
 * Query events with filters (FR88)
 */
export async function queryEvents(
  options: EventQueryOptions = {}
): Promise<EventFeedResponse> {
  const supabase = createClient()

  const {
    agent_id,
    user_id,
    event_type,
    source,
    risk_level,
    from_timestamp,
    to_timestamp,
    limit = 50,
    offset = 0,
  } = options

  // Build query
  let query = supabase
    .from('observer_events')
    .select('*', { count: 'exact' })

  if (agent_id) {
    query = query.eq('agent_id', agent_id)
  }
  if (user_id) {
    query = query.eq('user_id', user_id)
  }
  if (event_type) {
    query = query.eq('event_type', event_type)
  }
  if (source) {
    query = query.eq('source', source)
  }
  if (risk_level) {
    query = query.eq('risk_level', risk_level)
  }
  if (from_timestamp) {
    query = query.gte('timestamp', from_timestamp)
  }
  if (to_timestamp) {
    query = query.lte('timestamp', to_timestamp)
  }

  query = query
    .order('sequence', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Observer query error:', error)
    throw new Error('Failed to query events: ' + error.message)
  }

  const events = (data || []) as ObserverEvent[]
  const total = count || 0

  return {
    events,
    total,
    limit,
    offset,
    has_more: offset + events.length < total,
    latest_sequence: events[0]?.sequence || 0,
  }
}

/**
 * Get events since a specific sequence (for real-time updates)
 */
export async function getEventsSince(
  sinceSequence: number,
  limit: number = 100
): Promise<ObserverEvent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('observer_events')
    .select('*')
    .gt('sequence', sinceSequence)
    .order('sequence', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Observer getEventsSince error:', error)
    throw new Error('Failed to get events: ' + error.message)
  }

  return (data || []) as ObserverEvent[]
}

/**
 * Verify event signature integrity
 */
export async function verifyEvent(event: ObserverEvent): Promise<boolean> {
  const eventData = {
    sequence: event.sequence,
    source: event.source,
    event_type: event.event_type,
    risk_level: event.risk_level,
    agent_id: event.agent_id,
    user_id: event.user_id,
    data: event.data,
    timestamp: event.timestamp,
    previous_hash: event.previous_hash,
  }

  const dataToHash = JSON.stringify(eventData)
  const expectedHash = await generateHash(dataToHash)
  const expectedSignature = await generateSignature(expectedHash)

  return event.hash === expectedHash && event.signature === expectedSignature
}

/**
 * Verify chain integrity (check hash chain is unbroken)
 */
export async function verifyChainIntegrity(
  startSequence: number = 1,
  endSequence?: number
): Promise<{ valid: boolean; brokenAt?: number; error?: string }> {
  const supabase = createClient()

  let query = supabase
    .from('observer_events')
    .select('sequence, hash, previous_hash')
    .gte('sequence', startSequence)
    .order('sequence', { ascending: true })

  if (endSequence) {
    query = query.lte('sequence', endSequence)
  }

  const { data, error } = await query.limit(10000)

  if (error) {
    return { valid: false, error: error.message }
  }

  const events = data || []
  if (events.length === 0) {
    return { valid: true }
  }

  for (let i = 1; i < events.length; i++) {
    if (events[i].previous_hash !== events[i - 1].hash) {
      return {
        valid: false,
        brokenAt: events[i].sequence,
        error: `Hash chain broken at sequence ${events[i].sequence}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Get event statistics for an agent
 */
export async function getAgentStats(agentId: string): Promise<{
  total_events: number
  events_by_type: Record<string, number>
  events_by_risk: Record<string, number>
  first_event: string | null
  last_event: string | null
}> {
  const supabase = createClient()

  // Get total count
  const { count: totalCount } = await supabase
    .from('observer_events')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)

  // Get events for grouping
  const { data: events } = await supabase
    .from('observer_events')
    .select('event_type, risk_level, timestamp')
    .eq('agent_id', agentId)
    .order('timestamp', { ascending: true })

  const eventsList = events || []

  // Group by type
  const eventsByType: Record<string, number> = {}
  const eventsByRisk: Record<string, number> = {}

  for (const event of eventsList) {
    eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1
    eventsByRisk[event.risk_level] = (eventsByRisk[event.risk_level] || 0) + 1
  }

  return {
    total_events: totalCount || 0,
    events_by_type: eventsByType,
    events_by_risk: eventsByRisk,
    first_event: eventsList[0]?.timestamp || null,
    last_event: eventsList[eventsList.length - 1]?.timestamp || null,
  }
}

// Export types
export * from './types'
