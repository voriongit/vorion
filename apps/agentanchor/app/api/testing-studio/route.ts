/**
 * A3I Testing Studio - Main API Route
 * GET /api/testing-studio - Get testing studio status
 */

import { NextResponse } from 'next/server';
import { TESTING_STUDIO_VERSION, getRedAgentTypes, getBlueAgentTypes } from '@/lib/testing-studio';

export async function GET() {
  return NextResponse.json({
    name: 'A3I Testing Studio',
    version: TESTING_STUDIO_VERSION,
    tagline: 'Agents that attack. Agents that defend. Defenses that learn.',
    status: 'operational',
    capabilities: {
      redAgents: getRedAgentTypes(),
      blueAgents: getBlueAgentTypes(),
      features: [
        'adversarial_sessions',
        'attack_generation',
        'detection_pipeline',
        'intelligence_collection',
        'automated_rule_generation',
      ],
    },
    endpoints: {
      sessions: '/api/testing-studio/sessions',
      detect: '/api/testing-studio/detect',
      vectors: '/api/testing-studio/vectors',
      rules: '/api/testing-studio/rules',
      reports: '/api/testing-studio/reports',
    },
  });
}
