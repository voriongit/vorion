/**
 * Trust Bridge - Submission API
 *
 * POST /api/trust-bridge/submit - Submit an external agent for certification
 *
 * Request Body:
 * {
 *   name: string,
 *   description: string,
 *   version: string,
 *   origin_platform: string,
 *   capabilities: string[],
 *   risk_category: 'low' | 'medium' | 'high' | 'critical',
 *   contact_email: string,
 *   // Optional
 *   required_permissions?: string[],
 *   model_provider?: string,
 *   execution_environment?: string,
 *   test_endpoint?: string,
 *   test_credentials?: { type: string, value?: string },
 *   organization?: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   tracking_id?: string,
 *   queue_position?: number,
 *   estimated_wait_minutes?: number,
 *   errors?: string[],
 *   warnings?: string[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  submitAgent,
  validateSubmission,
} from '@/lib/trust-bridge/submission';
import type { AgentSubmission } from '@/lib/trust-bridge/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract submitter ID from auth (placeholder - use actual auth in production)
    const submitterId = body.submitter_id || request.headers.get('x-submitter-id') || 'anonymous';

    // Build submission object
    const submission: AgentSubmission = {
      name: body.name,
      description: body.description,
      version: body.version,
      origin_platform: body.origin_platform,
      capabilities: body.capabilities || [],
      required_permissions: body.required_permissions || [],
      risk_category: body.risk_category,
      model_provider: body.model_provider,
      execution_environment: body.execution_environment,
      test_endpoint: body.test_endpoint,
      test_credentials: body.test_credentials,
      submitter_id: submitterId,
      organization: body.organization,
      contact_email: body.contact_email,
    };

    // Quick validation for better error messages
    const validation = validateSubmission(submission);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Submit for certification
    const result = await submitAgent(submission);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tracking_id: result.tracking_id,
      queue_position: result.queue_position,
      estimated_wait_minutes: result.estimated_wait_minutes,
      warnings: result.warnings,
      message: 'Agent submitted for certification. Use the tracking_id to check status.',
      status_url: `/api/trust-bridge/status/${result.tracking_id}`,
    });

  } catch (error) {
    console.error('[Trust Bridge] Submission error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed',
      },
      { status: 500 }
    );
  }
}

// GET - Return API documentation
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/trust-bridge/submit',
    description: 'Submit an external AI agent for A3I certification',
    required_fields: {
      name: 'Agent name (string, min 2 chars)',
      description: 'Agent description (string, min 10 chars)',
      version: 'Agent version (string)',
      origin_platform: 'Platform where agent was built (antigravity, cursor, claude_code, custom, etc.)',
      capabilities: 'Array of capability strings',
      risk_category: 'Risk level (low, medium, high, critical)',
      contact_email: 'Contact email for certification updates',
    },
    optional_fields: {
      required_permissions: 'Array of required permissions',
      model_provider: 'Underlying LLM (claude, gpt-4, gemini, etc.)',
      execution_environment: 'Where agent runs (browser, server, local)',
      test_endpoint: 'URL for live adversarial testing',
      test_credentials: '{ type: "api_key"|"bearer"|"none", value?: string }',
      organization: 'Organization name',
    },
    example_request: {
      name: 'CodeHelper',
      description: 'An AI assistant that helps with code review and debugging',
      version: '1.0.0',
      origin_platform: 'cursor',
      capabilities: ['code_review', 'debugging', 'explanation'],
      risk_category: 'medium',
      contact_email: 'dev@example.com',
      model_provider: 'claude-sonnet-4-20250514',
      test_endpoint: 'https://api.example.com/agent/test',
    },
    response_fields: {
      success: 'Whether submission was accepted',
      tracking_id: 'Unique ID to track certification progress',
      queue_position: 'Position in certification queue',
      estimated_wait_minutes: 'Estimated time until testing begins',
      status_url: 'URL to check certification status',
    },
    certification_tiers: {
      basic: 'Score 100-249, automated testing only',
      standard: 'Score 250-499, includes human review',
      advanced: 'Score 500-749, includes Council review',
      enterprise: 'Score 750+, includes compliance audit',
    },
    pricing: {
      free: '3 agents/month, 6 month validity, 100 verifications/hr',
      pro: 'Unlimited agents, 12 month validity, 10K verifications/hr, $99/mo',
      enterprise: 'Full features, Council access, unlimited verifications, $499/mo',
    },
  });
}
