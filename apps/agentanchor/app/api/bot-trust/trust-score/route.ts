/**
 * Bot Trust Score API
 * POST /api/bot-trust/trust-score - Calculate and store new trust score
 * GET /api/bot-trust/trust-score?bot_id={id} - Get latest trust score
 * GET /api/bot-trust/trust-score?bot_id={id}&history=true - Get trust score history
 */

import { NextRequest, NextResponse } from 'next/server';
import { trustScoreEngine } from '@/lib/bot-trust';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bot_id } = body;

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    const trustScore = await trustScoreEngine.storeTrustScore(bot_id);

    return NextResponse.json({ success: true, trust_score: trustScore }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/bot-trust/trust-score failed', { error });
    return NextResponse.json(
      { error: 'Failed to calculate trust score' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bot_id = searchParams.get('bot_id');
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    if (history) {
      const historyData = await trustScoreEngine.getTrustScoreHistory(bot_id, limit);
      return NextResponse.json({ history: historyData });
    }

    const trustScore = await trustScoreEngine.getLatestTrustScore(bot_id);

    if (!trustScore) {
      return NextResponse.json(
        { error: 'No trust score found for this bot' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trust_score: trustScore });
  } catch (error) {
    logger.error('GET /api/bot-trust/trust-score failed', { error });
    return NextResponse.json(
      { error: 'Failed to get trust score' },
      { status: 500 }
    );
  }
}
