/**
 * Truth Chain Verification API
 * Story 5-5: Truth Chain Verification (FR98, FR99)
 *
 * GET /api/truth-chain/verify/[hash] - Verify a record by hash
 *
 * This is a PUBLIC endpoint - no authentication required (FR98)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyRecord } from '@/lib/truth-chain'

export const dynamic = 'force-dynamic'

// GET /api/truth-chain/verify/[hash] - Public verification
export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const { hash } = params

    if (!hash || hash.length < 8) {
      return NextResponse.json(
        { error: 'Invalid hash. Provide at least 8 characters.' },
        { status: 400 }
      )
    }

    const result = await verifyRecord(hash)

    if (!result.valid) {
      return NextResponse.json({
        verified: false,
        error: result.error,
        record: result.record ? {
          id: result.record.id,
          sequence: result.record.sequence,
          record_type: result.record.record_type,
          timestamp: result.record.timestamp,
        } : null,
      })
    }

    // Return verification details
    return NextResponse.json({
      verified: true,
      chain_valid: result.chain_valid,
      record: {
        id: result.record!.id,
        sequence: result.record!.sequence,
        record_type: result.record!.record_type,
        agent_id: result.record!.agent_id,
        timestamp: result.record!.timestamp,
        hash: result.record!.hash,
        previous_hash: result.record!.previous_hash,
        data: result.record!.data,
      },
      verification_url: `/api/truth-chain/verify/${result.record!.hash.substring(0, 16)}`,
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
