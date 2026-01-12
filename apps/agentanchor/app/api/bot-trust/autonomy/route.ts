/**
 * Bot Autonomy API
 * GET /api/bot-trust/autonomy?bot_id={id} - Get current autonomy level
 * GET /api/bot-trust/autonomy?bot_id={id}&evaluate=true - Evaluate progression eligibility
 * POST /api/bot-trust/autonomy - Progress bot to next level
 * POST /api/bot-trust/autonomy/demote - Demote bot autonomy level
 * POST /api/bot-trust/autonomy/initialize - Initialize new bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { autonomyManager, RiskLevel } from '@/lib/bot-trust';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bot_id = searchParams.get('bot_id');
    const evaluate = searchParams.get('evaluate') === 'true';
    const history = searchParams.get('history') === 'true';

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    if (history) {
      const historyData = await autonomyManager.getAutonomyHistory(bot_id);
      return NextResponse.json({ history: historyData });
    }

    if (evaluate) {
      const evaluation = await autonomyManager.evaluateProgression(bot_id);
      return NextResponse.json({ evaluation });
    }

    const currentLevel = await autonomyManager.getCurrentLevel(bot_id);
    return NextResponse.json({ current_level: currentLevel });
  } catch (error) {
    logger.error('GET /api/bot-trust/autonomy failed', { error });
    return NextResponse.json(
      { error: 'Failed to get autonomy level' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bot_id, action } = body;

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    if (action === 'initialize') {
      await autonomyManager.initializeBot(bot_id);
      return NextResponse.json({ success: true, level: 1 });
    }

    if (action === 'progress') {
      const newLevel = await autonomyManager.progressToNextLevel(bot_id);
      return NextResponse.json({ success: true, new_level: newLevel });
    }

    if (action === 'demote') {
      const { reason } = body;
      if (!reason) {
        return NextResponse.json(
          { error: 'reason is required for demotion' },
          { status: 400 }
        );
      }
      const newLevel = await autonomyManager.demoteLevel(bot_id, reason);
      return NextResponse.json({ success: true, new_level: newLevel });
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "initialize", "progress", or "demote"' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('POST /api/bot-trust/autonomy failed', { error });
    return NextResponse.json(
      { error: 'Failed to update autonomy level' },
      { status: 500 }
    );
  }
}
