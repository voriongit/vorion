/**
 * Bot Decisions API
 * POST /api/bot-trust/decisions - Log a new decision
 * GET /api/bot-trust/decisions?bot_id={id} - Get decision history
 */

import { NextRequest, NextResponse } from 'next/server';
import { decisionTracker, DecisionType, RiskLevel } from '@/lib/bot-trust';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      bot_id,
      decision_type,
      action_taken,
      context_data,
      reasoning,
      alternatives_considered,
      confidence_score,
      risk_level,
    } = body;

    // Validation
    if (!bot_id || !decision_type || !action_taken || confidence_score === undefined || !risk_level) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (confidence_score < 0 || confidence_score > 1) {
      return NextResponse.json(
        { error: 'Confidence score must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Log the decision
    const decision = await decisionTracker.logDecision({
      bot_id,
      decision_type: decision_type as DecisionType,
      action_taken,
      context_data,
      reasoning,
      alternatives_considered,
      confidence_score,
      risk_level: risk_level as RiskLevel,
    });

    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/bot-trust/decisions failed', { error });
    return NextResponse.json(
      { error: 'Failed to log decision' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bot_id = searchParams.get('bot_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const decision_type = searchParams.get('decision_type') as DecisionType | undefined;
    const risk_level = searchParams.get('risk_level') as RiskLevel | undefined;

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    const decisions = await decisionTracker.getDecisionHistory(bot_id, {
      limit,
      offset,
      decisionType: decision_type,
      riskLevel: risk_level,
    });

    return NextResponse.json({ decisions });
  } catch (error) {
    logger.error('GET /api/bot-trust/decisions failed', { error });
    return NextResponse.json(
      { error: 'Failed to get decision history' },
      { status: 500 }
    );
  }
}
