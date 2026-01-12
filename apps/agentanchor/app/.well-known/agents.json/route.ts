/**
 * Agent Registry Discovery Endpoint
 *
 * GET /.well-known/agents.json
 *
 * Provides discovery information for the AgentAnchor agent registry.
 * External systems can use this to:
 * - Find the API endpoints for agent operations
 * - Discover verification endpoints
 * - Get metadata about the registry
 *
 * Follows RFC 8615 (Well-Known URIs)
 */

import { NextResponse } from 'next/server'
import { urls } from '@/lib/config'

export const dynamic = 'force-static'
export const revalidate = 3600 // Revalidate every hour

export async function GET(): Promise<NextResponse> {
  const baseUrl = urls.app

  const registry = {
    // Registry metadata
    name: 'AgentAnchor Agent Registry',
    version: '1.0',
    description: 'The worlds first AI Governance Operating System - agent marketplace with trust verification',

    // Identity format
    identity: {
      format: 'aa:{fingerprint_prefix}',
      example: 'aa:7f3a9c2b8e1d4f6a',
      description: 'Content-addressed agent identifiers. The fingerprint is a SHA-256 hash of immutable birth properties.'
    },

    // API endpoints
    endpoints: {
      // Agent operations
      agents: {
        list: `${baseUrl}/api/agents`,
        get: `${baseUrl}/api/agents/{id}`,
        search: `${baseUrl}/api/agents/search`
      },

      // Birth certificates
      birth_certificates: {
        get: `${baseUrl}/api/agents/{id}/birth-certificate`,
        issue: `${baseUrl}/api/agents/{id}/birth-certificate`,
        verify: `${baseUrl}/api/verify/birth-certificate`
      },

      // Trust credentials
      credentials: {
        issue: `${baseUrl}/api/credentials/issue`,
        verify: `${baseUrl}/api/credentials/verify`,
        refresh: `${baseUrl}/api/credentials/refresh`
      },

      // JWKS for signature verification
      jwks: `${baseUrl}/.well-known/jwks.json`
    },

    // Trust system
    trust: {
      score_range: { min: 0, max: 1000 },
      tiers: [
        { name: 'Untrusted', min: 0, max: 99, credential_eligible: false },
        { name: 'Probation', min: 100, max: 249, credential_eligible: false },
        { name: 'Developing', min: 250, max: 499, credential_eligible: true },
        { name: 'Established', min: 500, max: 749, credential_eligible: true },
        { name: 'Trusted', min: 750, max: 899, credential_eligible: true },
        { name: 'Legendary', min: 900, max: 1000, credential_eligible: true }
      ],
      levels: [
        { code: 'L0', name: 'Listener', description: 'Observe and learn' },
        { code: 'L1', name: 'Assistant', description: 'Basic task execution' },
        { code: 'L2', name: 'Contributor', description: 'Independent work' },
        { code: 'L3', name: 'Specialist', description: 'Domain expertise' },
        { code: 'L4', name: 'Expert', description: 'Cross-domain coordination' },
        { code: 'L5', name: 'Architect', description: 'System design' },
        { code: 'L6', name: 'Director', description: 'Strategic oversight' },
        { code: 'L7', name: 'Principal', description: 'Governance authority' },
        { code: 'L8', name: 'Executive', description: 'Full autonomous authority' }
      ]
    },

    // Verification
    verification: {
      signature_algorithm: 'ES256',
      key_type: 'EC',
      curve: 'P-256',
      jwks_url: `${baseUrl}/.well-known/jwks.json`,
      certificate_types: ['PTC', 'BC'],
      issuer: urls.issuer
    },

    // Truth chain
    truth_chain: {
      description: 'Append-only log of agent birth certificates',
      hash_algorithm: 'SHA-256',
      linking: 'Each certificate contains hash of previous, creating tamper-evident chain'
    },

    // Contact
    contact: {
      website: urls.marketing,
      documentation: urls.docs,
      support: urls.supportEmail
    },

    // Legal
    terms_of_service: `${urls.marketing}/terms`,
    privacy_policy: `${urls.marketing}/privacy`
  }

  return NextResponse.json(registry, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
