/**
 * Public Truth Chain Verification API
 * Epic 8: Story 8-1 RESTful API - Public Verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyRecord } from '@/lib/truth-chain'
import { validateApiKey, checkRateLimit, logApiUsage } from '@/lib/api'

/**
 * GET /api/v1/truth-chain
 * Get truth chain records
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Optional API key auth for rate limiting
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const validation = await validateApiKey(key)
    if (validation) {
      userId = validation.userId
      keyId = validation.keyId

      const rateLimit = await checkRateLimit(keyId, userId)
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: { message: 'Rate limit exceeded', code: 'rate_limited' } },
          { status: 429 }
        )
      }
    }
  }

  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const agentId = searchParams.get('agent_id')
  const eventType = searchParams.get('event_type')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = (page - 1) * limit

  try {
    let query = supabase
      .from('truth_chain')
      .select('*', { count: 'exact' })
      .order('sequence_number', { ascending: false })

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    const responseTime = Date.now() - startTime

    if (userId) {
      await logApiUsage(keyId, userId, '/api/v1/truth-chain', 'GET', 200, responseTime)
    }

    if (error) {
      return NextResponse.json(
        { error: { message: error.message, code: 'internal_error' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/truth-chain/verify
 * Verify a truth chain record's integrity
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Optional API key auth
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let keyId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.slice(7)
    const validation = await validateApiKey(key)
    if (validation) {
      userId = validation.userId
      keyId = validation.keyId
    }
  }

  try {
    const body = await request.json()
    const { record_id, record_hash } = body

    if (!record_id && !record_hash) {
      return NextResponse.json(
        { error: { message: 'record_id or record_hash required', code: 'validation_error' } },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get the record
    let query = supabase.from('truth_chain').select('*')

    if (record_id) {
      query = query.eq('id', record_id)
    } else {
      query = query.eq('record_hash', record_hash)
    }

    const { data: record, error } = await query.single()

    const responseTime = Date.now() - startTime

    if (userId) {
      await logApiUsage(keyId, userId, '/api/v1/truth-chain/verify', 'POST', error ? 404 : 200, responseTime)
    }

    if (error || !record) {
      return NextResponse.json(
        { error: { message: 'Record not found', code: 'not_found' } },
        { status: 404 }
      )
    }

    // Verify the record's integrity using the verifyRecord function
    const verification = await verifyRecord(record.id)

    // Get chain verification status
    const { data: previousRecord } = await supabase
      .from('truth_chain')
      .select('record_hash')
      .eq('sequence_number', record.sequence_number - 1)
      .single()

    const chainValid = !previousRecord || record.previous_hash === previousRecord.record_hash

    return NextResponse.json({
      data: {
        record_id: record.id,
        sequence_number: record.sequence_number,
        record_hash: record.record_hash,
        is_valid: verification.valid,
        chain_valid: chainValid,
        verified_at: new Date().toISOString(),
        agent_id: record.agent_id,
        event_type: record.event_type,
        created_at: record.created_at,
        verification_error: verification.error,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message, code: 'internal_error' } },
      { status: 500 }
    )
  }
}
