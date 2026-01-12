/**
 * Birth Certificate Verification API
 *
 * POST /api/verify/birth-certificate
 *   - Verifies a birth certificate JWT
 *   - Public endpoint for external systems
 *   - Returns validity status and decoded data
 *
 * This endpoint allows external systems to verify that an agent
 * was legitimately registered with AgentAnchor and has not been
 * tampered with.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  decodeBirthCertificate,
  generateFingerprint,
  BirthCertificatePayload
} from '@/lib/credentials'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { urls } from '@/lib/config'

// JWKS endpoint for verification
const JWKS_URL = urls.jwks

// Cached JWKS
let jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwkSet() {
  if (!jwkSet) {
    jwkSet = createRemoteJWKSet(new URL(JWKS_URL), {
      cooldownDuration: 30000,
      timeoutDuration: 5000,
      cacheMaxAge: 300000
    })
  }
  return jwkSet
}

/**
 * POST - Verify a birth certificate
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { jwt, check_revocation = true, check_registry = true } = body

    if (!jwt || typeof jwt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid jwt parameter' },
        { status: 400 }
      )
    }

    // Step 1: Decode without verification (to get claims)
    const decoded = decodeBirthCertificate(jwt)
    if (!decoded) {
      return NextResponse.json({
        valid: false,
        error: 'Malformed certificate - cannot decode JWT',
        error_code: 'malformed'
      })
    }

    // Step 2: Verify signature using JWKS
    try {
      const jwks = getJwkSet()
      await jwtVerify(jwt, jwks, {
        issuer: urls.issuer,
        typ: 'BC'
      })
    } catch (sigError) {
      const errorMessage = sigError instanceof Error ? sigError.message : 'Unknown'
      return NextResponse.json({
        valid: false,
        error: `Signature verification failed: ${errorMessage}`,
        error_code: 'invalid_signature',
        canonical_id: decoded.sub
      })
    }

    // Step 3: Verify fingerprint matches birth data
    const expectedFingerprint = generateFingerprint({
      name: decoded.birth.name,
      creatorId: decoded.birth.creator_id,
      bornAt: new Date(decoded.birth.born_at),
      initialConfigHash: decoded.birth.initial_config_hash,
      level: decoded.birth.level,
      type: decoded.birth.type
    })

    if (expectedFingerprint !== decoded.fingerprint) {
      return NextResponse.json({
        valid: false,
        error: 'Fingerprint mismatch - birth data has been tampered with',
        error_code: 'fingerprint_mismatch',
        canonical_id: decoded.sub
      })
    }

    // Step 4: Check registry (optional)
    let registryStatus = null
    let revocationStatus = null

    if (check_registry || check_revocation) {
      const supabase = await createClient()

      if (check_registry) {
        const { data: registry } = await supabase
          .from('agent_birth_registry')
          .select('canonical_id, fingerprint, born_at, truth_chain_sequence')
          .eq('canonical_id', decoded.sub)
          .single()

        if (registry) {
          registryStatus = {
            registered: true,
            truth_chain_sequence: registry.truth_chain_sequence,
            born_at: registry.born_at
          }
        } else {
          registryStatus = {
            registered: false,
            warning: 'Certificate not found in birth registry'
          }
        }
      }

      // Step 5: Check revocation (optional)
      if (check_revocation) {
        const { data: revocation } = await supabase
          .from('agent_revocations')
          .select('revoked_at, reason')
          .eq('canonical_id', decoded.sub)
          .single()

        if (revocation) {
          return NextResponse.json({
            valid: false,
            error: 'Agent has been revoked',
            error_code: 'revoked',
            canonical_id: decoded.sub,
            revocation: {
              revoked_at: revocation.revoked_at,
              reason: revocation.reason
            }
          })
        }

        revocationStatus = { revoked: false }
      }
    }

    // Success - certificate is valid
    return NextResponse.json({
      valid: true,
      canonical_id: decoded.sub,
      fingerprint: decoded.fingerprint,
      birth: {
        name: decoded.birth.name,
        creator_id: decoded.birth.creator_id,
        born_at: decoded.birth.born_at,
        level: decoded.birth.level,
        type: decoded.birth.type
      },
      truth_chain: decoded.truth_chain,
      registry: registryStatus,
      revocation: revocationStatus,
      verified_at: new Date().toISOString(),
      issuer: decoded.iss
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error verifying birth certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}
