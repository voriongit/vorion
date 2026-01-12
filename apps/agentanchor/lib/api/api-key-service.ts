/**
 * API Key Service
 * Epic 8: Story 8-2 API Authentication (FR145)
 */

import { createClient } from '@/lib/supabase/server'
import { ApiKey, ApiKeyScope, RateLimitInfo, RATE_LIMITS } from './types'
import crypto from 'crypto'

const MAX_KEYS_PER_USER = 10

/**
 * Generate a new API key
 */
export function generateApiKey(isTest: boolean = false): { key: string; prefix: string; hash: string } {
  const prefix = isTest ? 'aa_test_' : 'aa_live_'
  const randomBytes = crypto.randomBytes(24).toString('hex')
  const key = prefix + randomBytes

  // Hash the key for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex')

  return { key, prefix: prefix + randomBytes.slice(0, 8), hash }
}

/**
 * Create a new API key for user
 */
export async function createApiKey(
  userId: string,
  name: string,
  options: {
    scope?: ApiKeyScope
    isTest?: boolean
    expiresAt?: string
  } = {}
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  const supabase = createClient()

  // Check key limit
  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('revoked', false)

  if ((count || 0) >= MAX_KEYS_PER_USER) {
    throw new Error(`Maximum of ${MAX_KEYS_PER_USER} API keys per user`)
  }

  const { key, prefix, hash } = generateApiKey(options.isTest)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_prefix: prefix,
      key_hash: hash,
      scope: options.scope || 'read',
      is_test: options.isTest || false,
      expires_at: options.expiresAt,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`)
  }

  return {
    apiKey: data,
    rawKey: key, // Only returned once, never stored
  }
}

/**
 * Validate an API key and return user info
 */
export async function validateApiKey(
  rawKey: string
): Promise<{ userId: string; scope: ApiKeyScope; keyId: string } | null> {
  const supabase = createClient()

  // Extract prefix for lookup
  const prefix = rawKey.slice(0, 16) // aa_live_ or aa_test_ + 8 chars

  // Hash the full key for comparison
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, scope, key_hash, revoked, expires_at')
    .eq('key_prefix', prefix)
    .single()

  if (error || !data) {
    return null
  }

  // Verify hash matches
  if (data.key_hash !== hash) {
    return null
  }

  // Check if revoked
  if (data.revoked) {
    return null
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null
  }

  // Update last used
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    userId: data.user_id,
    scope: data.scope,
    keyId: data.id,
  }
}

/**
 * Get user's API keys (without hashes)
 */
export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, name, key_prefix, scope, is_test, last_used_at, last_used_ip, expires_at, revoked, revoked_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch API keys: ${error.message}`)
  }

  return data || []
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('api_keys')
    .update({
      revoked: true,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', keyId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`)
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete API key: ${error.message}`)
  }
}

/**
 * Check rate limit for API key/user
 */
export async function checkRateLimit(
  keyId: string | null,
  userId: string,
  tier: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<RateLimitInfo> {
  const supabase = createClient()
  const limit = RATE_LIMITS[tier]

  // Get current hour window
  const windowStart = new Date()
  windowStart.setMinutes(0, 0, 0)

  // Upsert window counter
  const { data, error } = await supabase
    .from('rate_limit_windows')
    .upsert({
      api_key_id: keyId,
      user_id: userId,
      window_start: windowStart.toISOString(),
      request_count: 1,
    }, {
      onConflict: keyId ? 'api_key_id,window_start' : 'user_id,window_start',
    })
    .select('request_count')
    .single()

  // If upsert failed, try to increment existing
  if (error) {
    const { data: existing } = await supabase
      .from('rate_limit_windows')
      .select('request_count')
      .eq(keyId ? 'api_key_id' : 'user_id', keyId || userId)
      .eq('window_start', windowStart.toISOString())
      .single()

    const count = existing?.request_count || 0

    return {
      allowed: count < limit,
      remaining: Math.max(limit - count - 1, 0),
      reset_at: new Date(windowStart.getTime() + 60 * 60 * 1000).toISOString(),
      limit,
    }
  }

  const count = data?.request_count || 1

  return {
    allowed: count <= limit,
    remaining: Math.max(limit - count, 0),
    reset_at: new Date(windowStart.getTime() + 60 * 60 * 1000).toISOString(),
    limit,
  }
}

/**
 * Log API usage
 */
export async function logApiUsage(
  keyId: string | null,
  userId: string | null,
  endpoint: string,
  method: string,
  statusCode?: number,
  responseTimeMs?: number
): Promise<void> {
  const supabase = createClient()

  await supabase.from('api_usage').insert({
    api_key_id: keyId,
    user_id: userId,
    endpoint,
    method,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
  })
}

/**
 * Get API usage stats for user
 */
export async function getApiUsageStats(
  userId: string,
  days: number = 30
): Promise<{
  total_requests: number
  by_endpoint: { endpoint: string; count: number }[]
  by_day: { date: string; count: number }[]
}> {
  const supabase = createClient()

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('api_usage')
    .select('endpoint, created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())

  if (error || !data) {
    return { total_requests: 0, by_endpoint: [], by_day: [] }
  }

  // Calculate stats
  const endpointCounts: Record<string, number> = {}
  const dayCounts: Record<string, number> = {}

  for (const item of data) {
    endpointCounts[item.endpoint] = (endpointCounts[item.endpoint] || 0) + 1
    const day = item.created_at.split('T')[0]
    dayCounts[day] = (dayCounts[day] || 0) + 1
  }

  return {
    total_requests: data.length,
    by_endpoint: Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count),
    by_day: Object.entries(dayCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}
