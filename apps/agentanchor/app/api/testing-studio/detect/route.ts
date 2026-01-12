/**
 * A3I Testing Studio - Detection API
 * POST /api/testing-studio/detect - Analyze input for threats
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createBlueTeam,
  SentinelAgent,
  DecoderAgent,
  GuardianAgent,
} from '@/lib/testing-studio';
import type { ConversationContext, DetectionResult, AttackCategory } from '@/lib/testing-studio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      input,
      context,
      config,
    } = body as {
      input: string;
      context?: {
        conversation_history?: { role: string; content: string }[];
        system_prompt?: string;
        agent_capabilities?: string[];
      };
      config?: {
        agents?: ('sentinel' | 'decoder' | 'guardian')[];
        threshold?: number;
        return_evidence?: boolean;
      };
    };

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Input is required and must be a string' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Build conversation context
    const conversationContext: ConversationContext = {
      conversation_history: (context?.conversation_history || []).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      system_prompt: context?.system_prompt,
      agent_capabilities: context?.agent_capabilities,
    };

    // Select agents to use
    const agentTypes = config?.agents || ['sentinel', 'decoder', 'guardian'];
    const results: DetectionResult[] = [];

    // Run detection with selected agents
    for (const agentType of agentTypes) {
      let agent;
      switch (agentType) {
        case 'sentinel':
          agent = new SentinelAgent({ agentId: 'detect-sentinel' });
          break;
        case 'decoder':
          agent = new DecoderAgent({ agentId: 'detect-decoder' });
          break;
        case 'guardian':
          agent = new GuardianAgent({ agentId: 'detect-guardian' });
          break;
      }

      if (agent) {
        const result = await agent.analyze(input, conversationContext);
        results.push(result);
      }
    }

    // Aggregate results
    const aggregated = aggregateResults(results, config?.threshold);
    const totalLatency = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      detection: {
        detected: aggregated.detected,
        action: aggregated.action,
        confidence: aggregated.confidence,
        category: aggregated.category,
        subcategory: aggregated.subcategory,
        severity: aggregated.severity,
        explanation: aggregated.explanation,
        latency_ms: totalLatency,
      },
      threats: config?.return_evidence !== false ? aggregated.threats : undefined,
      normalized_input: aggregated.normalized_input,
      agent_results: config?.return_evidence ? results.map(r => ({
        detected: r.detected,
        action: r.action,
        confidence: r.confidence,
        category: r.category,
        latency_ms: r.latency_ms,
      })) : undefined,
    });
  } catch (error) {
    console.error('[Testing Studio] Detection failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Detection failed',
      },
      { status: 500 }
    );
  }
}

function aggregateResults(
  results: DetectionResult[],
  threshold?: number
): DetectionResult {
  const effectiveThreshold = threshold ?? 0.5;
  const detected = results.some(r => r.detected && r.confidence >= effectiveThreshold);
  const maxConfidence = Math.max(...results.map(r => r.confidence));

  // Aggregate all threats
  const allThreats = results.flatMap(r => r.threats || []);

  // Determine action
  let action: 'allow' | 'block' | 'flag' | 'quarantine' = 'allow';
  for (const result of results) {
    if (result.action === 'block' && result.confidence >= effectiveThreshold) {
      action = 'block';
      break;
    }
    if (result.action === 'quarantine') {
      action = 'quarantine';
    }
    if (result.action === 'flag' && action === 'allow') {
      action = 'flag';
    }
  }

  // Get highest severity
  const severityOrder = ['critical', 'high', 'medium', 'low'] as const;
  let severity: typeof severityOrder[number] | undefined;
  for (const level of severityOrder) {
    if (results.some(r => r.severity === level)) {
      severity = level;
      break;
    }
  }

  // Get primary category
  const detectedResults = results.filter(r => r.detected);
  const primaryCategory = detectedResults[0]?.category;
  const primarySubcategory = detectedResults[0]?.subcategory;

  // Get normalized input if available
  const normalizedInput = results.find(r => r.normalized_input)?.normalized_input;

  return {
    detected,
    action,
    confidence: maxConfidence,
    category: primaryCategory,
    subcategory: primarySubcategory,
    severity,
    threats: allThreats,
    explanation: generateExplanation(results, detected),
    latency_ms: Math.max(...results.map(r => r.latency_ms)),
    normalized_input: normalizedInput,
  };
}

function generateExplanation(results: DetectionResult[], detected: boolean): string {
  if (!detected) {
    return 'No threats detected. Input appears safe.';
  }

  const detectedCount = results.filter(r => r.detected).length;
  const categories = [...new Set(results.filter(r => r.detected).map(r => r.category).filter(Boolean))];
  const threatCount = results.reduce((sum, r) => sum + (r.threats?.length || 0), 0);

  return `Detected by ${detectedCount}/${results.length} agents. Categories: ${categories.join(', ')}. Total threat signals: ${threatCount}.`;
}
