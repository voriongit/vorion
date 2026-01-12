/**
 * Agent Birth Certificate API
 *
 * GET /api/agents/[id]/birth-certificate
 *   - Returns the birth certificate for an agent
 *   - Public endpoint for verification
 *
 * POST /api/agents/[id]/birth-certificate
 *   - Issues a birth certificate (if not already issued)
 *   - Requires authentication and ownership
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  issueBirthCertificate,
  hashAgentConfig,
  decodeBirthCertificate,
  initializeTruthChain
} from '@/lib/credentials'
import { urls } from '@/lib/config'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Types for agent data (Supabase types not generated)
interface AgentBasic {
  id: string
  name: string
  canonical_id: string | null
  fingerprint: string | null
  birth_certificate: { jwt: string } | null
}

interface AgentFull {
  id: string
  name: string
  type: string
  level: string
  system_prompt: string
  metadata: Record<string, unknown>
  owner_id: string
  created_at: string
  canonical_id: string | null
  fingerprint: string | null
  birth_certificate: { jwt: string } | null
}

interface TruthChainData {
  truth_chain_sequence: number
  truth_chain_hash: string
}

/**
 * GET - Retrieve birth certificate
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Get agent with birth certificate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agentData, error } = await (supabase as any)
      .from('agents')
      .select('id, name, canonical_id, fingerprint, birth_certificate')
      .eq('id', id)
      .single()

    if (error || !agentData) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = agentData as AgentBasic

    if (!agent.birth_certificate) {
      return NextResponse.json(
        { error: 'Birth certificate not yet issued', code: 'not_issued' },
        { status: 404 }
      )
    }

    // Return certificate with decoded payload
    const payload = decodeBirthCertificate(agent.birth_certificate.jwt)

    return NextResponse.json({
      canonical_id: agent.canonical_id,
      fingerprint: agent.fingerprint,
      certificate: agent.birth_certificate,
      payload,
      verification_url: `${urls.app}/api/verify/birth-certificate`
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error retrieving birth certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Issue birth certificate
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agentData, error: agentError } = await (supabase as any)
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (agentError || !agentData) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = agentData as AgentFull

    // Check ownership
    if (agent.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to issue birth certificate for this agent' },
        { status: 403 }
      )
    }

    // Check if already issued
    if (agent.birth_certificate) {
      return NextResponse.json(
        {
          error: 'Birth certificate already issued',
          code: 'already_issued',
          canonical_id: agent.canonical_id
        },
        { status: 409 }
      )
    }

    // Initialize truth chain from latest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: latestCert } = await (supabase as any)
      .from('agent_birth_registry')
      .select('truth_chain_sequence, truth_chain_hash')
      .order('truth_chain_sequence', { ascending: false })
      .limit(1)
      .single()

    if (latestCert) {
      const cert = latestCert as TruthChainData
      initializeTruthChain(cert.truth_chain_sequence, cert.truth_chain_hash)
    }

    // Issue certificate
    const config = {
      name: agent.name,
      type: agent.type,
      level: agent.level,
      system_prompt: agent.system_prompt,
      metadata: agent.metadata
    }

    const certificate = await issueBirthCertificate({
      name: agent.name,
      creatorId: user.id,
      bornAt: new Date(agent.created_at),
      initialConfigHash: hashAgentConfig(config),
      level: agent.level,
      type: agent.type
    })

    // Store in agent record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('agents')
      .update({
        canonical_id: certificate.canonicalId,
        fingerprint: certificate.fingerprint,
        birth_certificate: {
          jwt: certificate.jwt,
          issued_at: new Date().toISOString(),
          truth_chain_sequence: certificate.truthChainSequence,
          truth_chain_hash: certificate.truthChainHash
        }
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json(
        { error: 'Failed to store birth certificate' },
        { status: 500 }
      )
    }

    // Register in birth registry (immutable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: registryError } = await (supabase as any)
      .from('agent_birth_registry')
      .insert({
        canonical_id: certificate.canonicalId,
        fingerprint: certificate.fingerprint,
        agent_id: id,
        agent_name: agent.name,
        creator_id: user.id,
        born_at: agent.created_at,
        initial_config_hash: hashAgentConfig(config),
        birth_jwt: certificate.jwt,
        truth_chain_sequence: certificate.truthChainSequence,
        truth_chain_prev_hash: certificate.payload.truth_chain.prev_hash,
        truth_chain_hash: certificate.truthChainHash
      })

    if (registryError) {
      console.error('Error registering birth certificate:', registryError)
      // Don't fail - agent already has certificate
    }

    return NextResponse.json({
      success: true,
      canonical_id: certificate.canonicalId,
      fingerprint: certificate.fingerprint,
      certificate: {
        jwt: certificate.jwt,
        issued_at: new Date().toISOString(),
        truth_chain_sequence: certificate.truthChainSequence,
        truth_chain_hash: certificate.truthChainHash
      },
      message: 'Birth certificate issued successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error issuing birth certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
