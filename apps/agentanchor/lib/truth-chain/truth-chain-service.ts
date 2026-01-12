/**
 * Truth Chain Service - Immutable governance records
 * Story 5-4: Truth Chain Records (FR92-FR97)
 *
 * The Truth Chain is an append-only ledger that records:
 * - All Council decisions (FR92)
 * - All certifications (FR93)
 * - All human overrides (FR94)
 * - All ownership changes (FR95)
 *
 * Each record includes:
 * - Hash of previous record (FR96)
 * - Timestamp and signature (FR97)
 */

import { createClient } from '@/lib/supabase/server'
import {
  TruthChainRecord,
  TruthChainRecordInput,
  TruthChainQueryOptions,
  VerificationResult,
  TruthChainRecordType,
} from './types'

// Signing key (in production, use proper key management)
const SIGNING_KEY = process.env.TRUTH_CHAIN_SIGNING_KEY || 'truth-chain-dev-key'

/**
 * Generate SHA-256 hash
 */
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate HMAC signature
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
 * Get the last record hash
 */
async function getLastRecordHash(): Promise<string> {
  const supabase = createClient()

  const { data } = await supabase
    .from('truth_chain')
    .select('hash')
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  return data?.hash || '0'.repeat(64)
}

/**
 * Get next sequence number
 */
async function getNextSequence(): Promise<number> {
  const supabase = createClient()

  const { data } = await supabase
    .from('truth_chain')
    .select('sequence')
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  return (data?.sequence || 0) + 1
}

/**
 * Create a new Truth Chain record
 */
export async function createRecord(
  input: TruthChainRecordInput
): Promise<TruthChainRecord> {
  const supabase = createClient()

  const timestamp = new Date().toISOString()
  const sequence = await getNextSequence()
  const previousHash = await getLastRecordHash()

  // Create record data for hashing
  const recordData = {
    sequence,
    record_type: input.record_type,
    agent_id: input.agent_id,
    user_id: input.user_id,
    data: input.data,
    timestamp,
    previous_hash: previousHash,
  }

  // Generate hash and signature
  const dataToHash = JSON.stringify(recordData)
  const hash = await generateHash(dataToHash)
  const signature = await generateSignature(hash)

  // Generate verification URL
  const verificationUrl = `/api/truth-chain/verify/${hash.substring(0, 16)}`

  const record: Omit<TruthChainRecord, 'id'> = {
    sequence,
    record_type: input.record_type,
    agent_id: input.agent_id,
    user_id: input.user_id,
    data: input.data,
    timestamp,
    previous_hash: previousHash,
    hash,
    signature,
    verified: true,
    verification_url: verificationUrl,
  }

  const { data, error } = await supabase
    .from('truth_chain')
    .insert(record)
    .select()
    .single()

  if (error) {
    console.error('Truth Chain record error:', error)
    throw new Error('Failed to create Truth Chain record: ' + error.message)
  }

  return data as TruthChainRecord
}

/**
 * Record a Council decision (FR92)
 */
export async function recordCouncilDecision(
  decision: {
    decision_id: string
    request_id: string
    agent_id: string
    action_type: string
    risk_level: number
    outcome: string
    votes: any[]
    reasoning: string
    creates_precedent: boolean
  }
): Promise<TruthChainRecord> {
  return createRecord({
    record_type: 'council_decision',
    agent_id: decision.agent_id,
    data: decision,
  })
}

/**
 * Record a certification/graduation (FR93)
 */
export async function recordCertification(
  certification: {
    agent_id: string
    agent_name: string
    certification_type: string
    curriculum_id?: string
    curriculum_name?: string
    initial_trust_score?: number
    trust_tier?: string
    examination_id?: string
  }
): Promise<TruthChainRecord> {
  return createRecord({
    record_type: 'certification',
    agent_id: certification.agent_id,
    data: certification,
  })
}

/**
 * Record a human override (FR94)
 */
export async function recordHumanOverride(
  override: {
    escalation_id: string
    agent_id: string
    original_decision: string
    override_decision: string
    override_reason: string
    overridden_by: string
  }
): Promise<TruthChainRecord> {
  return createRecord({
    record_type: 'human_override',
    agent_id: override.agent_id,
    user_id: override.overridden_by,
    data: override,
  })
}

/**
 * Record an ownership change (FR95)
 */
export async function recordOwnershipChange(
  change: {
    agent_id: string
    agent_name: string
    previous_owner_id?: string
    new_owner_id: string
    change_type: string
    terms?: Record<string, unknown>
  }
): Promise<TruthChainRecord> {
  return createRecord({
    record_type: 'ownership_change',
    agent_id: change.agent_id,
    user_id: change.new_owner_id,
    data: change,
  })
}

/**
 * Record a marketplace listing (Epic 6)
 */
export async function recordMarketplaceListing(
  listing: {
    listing_id: string
    agent_id: string
    trainer_id: string
    action: 'published' | 'unpublished' | 'updated'
    commission_rate: number
    category?: string
  }
): Promise<TruthChainRecord> {
  return createRecord({
    record_type: 'marketplace_listing',
    agent_id: listing.agent_id,
    user_id: listing.trainer_id,
    data: listing,
  })
}

/**
 * Record an acquisition (Epic 6)
 */
export async function recordAcquisition(
  acquisition: {
    acquisition_id: string
    listing_id: string
    agent_id: string
    consumer_id: string
    trainer_id: string
    acquisition_type: string
    commission_rate: number
  }
): Promise<TruthChainRecord> {
  return createRecord({
    record_type: 'acquisition',
    agent_id: acquisition.agent_id,
    user_id: acquisition.consumer_id,
    data: acquisition,
  })
}

/**
 * Query Truth Chain records
 */
export async function queryRecords(
  options: TruthChainQueryOptions = {}
): Promise<{ records: TruthChainRecord[]; total: number }> {
  const supabase = createClient()

  let query = supabase
    .from('truth_chain')
    .select('*', { count: 'exact' })

  if (options.agent_id) {
    query = query.eq('agent_id', options.agent_id)
  }
  if (options.record_type) {
    query = query.eq('record_type', options.record_type)
  }
  if (options.from_timestamp) {
    query = query.gte('timestamp', options.from_timestamp)
  }
  if (options.to_timestamp) {
    query = query.lte('timestamp', options.to_timestamp)
  }

  query = query
    .order('sequence', { ascending: false })
    .range(
      options.offset || 0,
      (options.offset || 0) + (options.limit || 50) - 1
    )

  const { data, error, count } = await query

  if (error) {
    console.error('Truth Chain query error:', error)
    return { records: [], total: 0 }
  }

  return {
    records: (data || []) as TruthChainRecord[],
    total: count || 0,
  }
}

/**
 * Get a single record by hash (FR98, FR99)
 */
export async function getRecordByHash(
  hashPrefix: string
): Promise<TruthChainRecord | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('truth_chain')
    .select('*')
    .like('hash', `${hashPrefix}%`)
    .single()

  if (error || !data) {
    return null
  }

  return data as TruthChainRecord
}

/**
 * Verify a record's integrity (FR98)
 */
export async function verifyRecord(
  hashOrId: string
): Promise<VerificationResult> {
  const supabase = createClient()

  // Try to find by hash prefix or ID
  let record: TruthChainRecord | null = null

  if (hashOrId.length === 36) {
    // UUID
    const { data } = await supabase
      .from('truth_chain')
      .select('*')
      .eq('id', hashOrId)
      .single()
    record = data as TruthChainRecord | null
  } else {
    record = await getRecordByHash(hashOrId)
  }

  if (!record) {
    return { valid: false, error: 'Record not found' }
  }

  // Verify hash
  const recordData = {
    sequence: record.sequence,
    record_type: record.record_type,
    agent_id: record.agent_id,
    user_id: record.user_id,
    data: record.data,
    timestamp: record.timestamp,
    previous_hash: record.previous_hash,
  }

  const expectedHash = await generateHash(JSON.stringify(recordData))
  const expectedSignature = await generateSignature(expectedHash)

  const hashValid = record.hash === expectedHash
  const signatureValid = record.signature === expectedSignature

  if (!hashValid || !signatureValid) {
    return {
      valid: false,
      record,
      error: !hashValid ? 'Hash mismatch' : 'Signature mismatch',
    }
  }

  // Verify chain continuity
  if (record.sequence > 1) {
    const { data: prevRecord } = await supabase
      .from('truth_chain')
      .select('hash')
      .eq('sequence', record.sequence - 1)
      .single()

    if (prevRecord && prevRecord.hash !== record.previous_hash) {
      return {
        valid: false,
        record,
        chain_valid: false,
        error: 'Chain continuity broken',
      }
    }
  }

  return {
    valid: true,
    record,
    chain_valid: true,
  }
}

/**
 * Verify chain integrity for a range
 */
export async function verifyChainIntegrity(
  startSequence: number = 1,
  endSequence?: number
): Promise<{ valid: boolean; brokenAt?: number; error?: string }> {
  const supabase = createClient()

  let query = supabase
    .from('truth_chain')
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

  const records = data || []
  if (records.length === 0) {
    return { valid: true }
  }

  for (let i = 1; i < records.length; i++) {
    if (records[i].previous_hash !== records[i - 1].hash) {
      return {
        valid: false,
        brokenAt: records[i].sequence,
        error: `Chain broken at sequence ${records[i].sequence}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Get statistics for Truth Chain
 */
export async function getChainStats(): Promise<{
  total_records: number
  records_by_type: Record<string, number>
  latest_sequence: number
  chain_valid: boolean
}> {
  const supabase = createClient()

  const { count } = await supabase
    .from('truth_chain')
    .select('*', { count: 'exact', head: true })

  const { data: latest } = await supabase
    .from('truth_chain')
    .select('sequence')
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  const { data: byType } = await supabase
    .from('truth_chain')
    .select('record_type')

  const recordsByType: Record<string, number> = {}
  for (const r of byType || []) {
    recordsByType[r.record_type] = (recordsByType[r.record_type] || 0) + 1
  }

  const chainIntegrity = await verifyChainIntegrity()

  return {
    total_records: count || 0,
    records_by_type: recordsByType,
    latest_sequence: latest?.sequence || 0,
    chain_valid: chainIntegrity.valid,
  }
}
