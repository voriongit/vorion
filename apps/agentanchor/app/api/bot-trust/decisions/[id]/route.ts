/**
 * Bot Decision Update API
 * PATCH /api/bot-trust/decisions/[id] - Update decision with user response
 */

import { NextRequest, NextResponse } from 'next/server';
import { decisionTracker, UserResponse } from '@/lib/bot-trust';
import logger from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { user_response, modification_details } = body;

    if (!user_response) {
      return NextResponse.json(
        { error: 'user_response is required' },
        { status: 400 }
      );
    }

    if (!Object.values(UserResponse).includes(user_response)) {
      return NextResponse.json(
        { error: 'Invalid user_response value' },
        { status: 400 }
      );
    }

    await decisionTracker.updateDecisionResponse(
      params.id,
      user_response as UserResponse,
      modification_details
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH /api/bot-trust/decisions/[id] failed', { error });
    return NextResponse.json(
      { error: 'Failed to update decision' },
      { status: 500 }
    );
  }
}
