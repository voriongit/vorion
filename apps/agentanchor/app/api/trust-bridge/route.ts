/**
 * Trust Bridge - Main API Status Endpoint
 *
 * GET /api/trust-bridge - Get Trust Bridge service status and documentation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStatus, checkQueueHealth } from '@/lib/trust-bridge/queue';
import { TRUST_BRIDGE_VERSION } from '@/lib/trust-bridge';
import { urls } from '@/lib/config';

export async function GET(request: NextRequest) {
  const queueStatus = await getQueueStatus();
  const queueHealth = await checkQueueHealth();

  return NextResponse.json({
    service: 'Trust Bridge',
    version: TRUST_BRIDGE_VERSION,
    status: queueHealth.healthy ? 'operational' : 'degraded',
    tagline: 'Any agent. Any origin. One trust standard.',

    // Service health
    health: {
      queue: queueHealth.healthy,
      issues: queueHealth.issues,
      metrics: queueHealth.metrics,
    },

    // Queue status
    queue: {
      pending: queueStatus.total_pending,
      processing: queueStatus.total_processing,
      estimated_wait_minutes: queueStatus.estimated_wait_minutes,
    },

    // API endpoints
    endpoints: {
      submit: {
        method: 'POST',
        path: '/api/trust-bridge/submit',
        description: 'Submit an external agent for certification',
      },
      status: {
        method: 'GET',
        path: '/api/trust-bridge/status/{trackingId}',
        description: 'Check certification status',
      },
      cancel: {
        method: 'DELETE',
        path: '/api/trust-bridge/status/{trackingId}',
        description: 'Cancel pending submission',
      },
      verify: {
        method: 'GET',
        path: '/api/trust-bridge/verify',
        description: 'Verify a Trust Bridge Credential',
        headers: ['X-Trust-Credential: <token>', 'OR Authorization: Bearer <token>'],
      },
      jwks: {
        method: 'GET',
        path: '/api/trust-bridge/jwks',
        description: 'Get JSON Web Key Set for credential verification',
      },
      council_review: {
        method: 'GET/POST',
        path: '/api/trust-bridge/council',
        description: 'Council of Nine review for elevated certifications',
        requires: 'Council member authentication',
      },
      process_queue: {
        method: 'POST',
        path: '/api/trust-bridge/process',
        description: 'Process certification queue (internal/cron)',
        requires: 'API key',
      },
    },

    // Certification tiers
    certification_tiers: {
      basic: {
        score_range: '100-249',
        requirements: 'Pass automated tests',
        features: ['Automated testing', '6 month validity'],
      },
      standard: {
        score_range: '250-499',
        requirements: 'Pass automated tests + human review',
        features: ['Human review', '12 month validity', 'Priority queue'],
      },
      advanced: {
        score_range: '500-749',
        requirements: 'Pass tests + Council of Nine review',
        features: ['Council review', 'Extended capabilities', 'Premium support'],
      },
      enterprise: {
        score_range: '750+',
        requirements: 'Pass tests + Council review + compliance audit',
        features: ['Compliance audit', 'Custom restrictions', 'SLA guarantee'],
      },
    },

    // Pricing tiers
    pricing: {
      free: {
        price: '$0/month',
        agents_per_month: 3,
        validity_months: 6,
        verifications_per_hour: 100,
      },
      pro: {
        price: '$99/month',
        agents_per_month: 'unlimited',
        validity_months: 12,
        verifications_per_hour: 10000,
        features: ['Priority queue', 'Human review'],
      },
      enterprise: {
        price: '$499/month',
        agents_per_month: 'unlimited',
        validity_months: 12,
        verifications_per_hour: 'unlimited',
        features: ['Council review', 'Compliance audit', 'Custom SLA'],
      },
    },

    // Supported platforms
    supported_platforms: [
      { id: 'antigravity', name: 'Google Antigravity', status: 'supported' },
      { id: 'cursor', name: 'Cursor IDE', status: 'supported' },
      { id: 'claude_code', name: 'Claude Code CLI', status: 'supported' },
      { id: 'openai_codex', name: 'OpenAI Codex', status: 'supported' },
      { id: 'langchain', name: 'LangChain', status: 'supported' },
      { id: 'autogen', name: 'Microsoft AutoGen', status: 'supported' },
      { id: 'crewai', name: 'CrewAI', status: 'supported' },
      { id: 'custom', name: 'Custom/Other', status: 'supported' },
    ],

    // Links
    links: {
      documentation: '/docs/trust-bridge',
      vision: '/docs/trust-bridge-vision',
      dashboard: '/trust-bridge/dashboard',
      submit_ui: '/trust-bridge/submit',
    },

    // Contact
    contact: {
      support: urls.supportEmail,
      enterprise: urls.enterpriseEmail,
    },
  });
}
