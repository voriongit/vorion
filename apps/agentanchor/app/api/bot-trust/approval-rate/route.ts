/**
 * Bot Approval Rate API
 * POST /api/bot-trust/approval-rate - Calculate and store approval rate
 * GET /api/bot-trust/approval-rate?bot_id={id} - Get current approval rate
 * GET /api/bot-trust/approval-rate?bot_id={id}&history=true - Get approval rate history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApprovalRateCalculator } from '@/lib/bot-trust/approval-rate-calculator';

// Force dynamic rendering to avoid build-time initialization
export const dynamic = 'force-dynamic';
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

    await getApprovalRateCalculator().storeApprovalRate(bot_id);
    const approvalRate = await getApprovalRateCalculator().getApprovalRate(bot_id);

    return NextResponse.json({ success: true, approval_rate: approvalRate }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/bot-trust/approval-rate failed', { error });
    return NextResponse.json(
      { error: 'Failed to calculate approval rate' },
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
      const historyData = await getApprovalRateCalculator().getApprovalRateHistory(bot_id, limit);
      return NextResponse.json({ history: historyData });
    }

    const approvalRate = await getApprovalRateCalculator().getApprovalRate(bot_id);
    return NextResponse.json({ approval_rate: approvalRate });
  } catch (error) {
    logger.error('GET /api/bot-trust/approval-rate failed', { error });
    return NextResponse.json(
      { error: 'Failed to get approval rate' },
      { status: 500 }
    );
  }
}
