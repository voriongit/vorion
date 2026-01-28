/**
 * Certification API - Agent Registration
 *
 * POST /v1/certify/register
 *
 * Initial agent registration. Returns agent_id and API keys.
 *
 * Request:
 * {
 *   manifest: BasisManifest;   // Full BASIS manifest
 *   owner: { name, email, org? };
 *   webhook_url?: string;
 * }
 *
 * Response:
 * {
 *   agent_id: string;
 *   api_key: string;
 *   api_secret: string;   // Show once
 *   tier: number;         // REGISTERED (1)
 *   next_steps: string[];
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'

// BASIS Manifest schema (simplified)
const BasisManifestSchema = z.object({
  schema_version: z.string(),
  agent: z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    version: z.string(),
    description: z.string().max(500),
  }),
  capabilities: z.array(z.object({
    code: z.string(),
    level: z.number().int().min(1).max(5),
    scope: z.array(z.string()).optional(),
    conditions: z.array(z.string()).optional(),
  })),
  constraints: z.array(z.object({
    type: z.enum(['resource', 'time', 'scope', 'rate']),
    rule: z.string(),
    action: z.enum(['allow', 'deny', 'audit', 'gate']),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const RegisterRequestSchema = z.object({
  manifest: BasisManifestSchema,
  owner: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    org: z.string().max(100).optional(),
  }),
  webhook_url: z.string().url().optional(),
})

function generateApiKey(): string {
  return `aa_key_${randomBytes(24).toString('base64url')}`
}

function generateApiSecret(): string {
  return `aa_secret_${randomBytes(32).toString('base64url')}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = RegisterRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'AA_INVALID_MANIFEST', message: parsed.error.message } },
        { status: 400 }
      )
    }

    const { manifest, owner, webhook_url } = parsed.data

    const supabase = createClient()

    // Generate credentials
    const apiKey = generateApiKey()
    const apiSecret = generateApiSecret()
    const secretHash = createHash('sha256').update(apiSecret).digest('hex')

    // Create agent/bot record
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .insert({
        name: manifest.agent.name,
        description: manifest.agent.description,
        status: 'active',
        trust_score: 100, // Starting score for REGISTERED tier
        trust_tier: 'novice', // T1 = REGISTERED
        capabilities: manifest.capabilities.map(c => c.code),
        personality_traits: [],
        system_prompt: `Agent governed by BASIS manifest v${manifest.schema_version}`,
        published: false,
        metadata: {
          basis_manifest: manifest,
          owner,
          webhook_url,
        },
      })
      .select('id')
      .single()

    if (agentError) {
      console.error('Agent creation error:', agentError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to create agent' } },
        { status: 500 }
      )
    }

    // Store API credentials
    await supabase.from('api_keys').insert({
      key_hash: createHash('sha256').update(apiKey).digest('hex'),
      secret_hash: secretHash,
      agent_id: agent.id,
      name: `${manifest.agent.name} API Key`,
      scopes: ['trust:read', 'trust:write', 'events:write'],
      rate_limit: 1000,
      status: 'active',
    })

    // Store webhook if provided
    if (webhook_url) {
      await supabase.from('webhooks').insert({
        agent_id: agent.id,
        url: webhook_url,
        events: ['trust.tier_change', 'trust.violation', 'cert.status_change'],
        status: 'active',
      })
    }

    // Record registration event
    await supabase.from('trust_events').insert({
      agent_id: agent.id,
      event_type: 'registration',
      score_delta: 0,
      metadata: {
        manifest_version: manifest.schema_version,
        owner_email: owner.email,
      },
    })

    return NextResponse.json({
      agent_id: agent.id,
      api_key: apiKey,
      api_secret: apiSecret, // Show only once!
      tier: 1, // REGISTERED
      next_steps: [
        'Submit execution events via POST /v1/events to build trust score',
        'Reach 1000+ scored events with zero violations for VERIFIED (T2) status',
        'Apply for CERTIFIED (T3) status via POST /v1/certify/apply',
      ],
    }, { status: 201 })
  } catch (err: any) {
    console.error('Registration error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message } },
      { status: 500 }
    )
  }
}
