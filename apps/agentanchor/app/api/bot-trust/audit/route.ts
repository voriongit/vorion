/**
 * Bot Audit Log API
 * POST /api/bot-trust/audit - Log an audit event
 * GET /api/bot-trust/audit?bot_id={id} - Get audit history
 * GET /api/bot-trust/audit/verify?bot_id={id} - Verify audit chain integrity
 * GET /api/bot-trust/audit/export?bot_id={id} - Export audit log
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditLogger, AuditEventType } from '@/lib/bot-trust';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bot_id, event_type, event_data, context } = body;

    if (!bot_id || !event_type || !event_data) {
      return NextResponse.json(
        { error: 'Missing required fields: bot_id, event_type, event_data' },
        { status: 400 }
      );
    }

    if (!Object.values(AuditEventType).includes(event_type)) {
      return NextResponse.json(
        { error: 'Invalid event_type' },
        { status: 400 }
      );
    }

    await auditLogger.logEvent(
      bot_id,
      event_type as AuditEventType,
      event_data,
      context
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('POST /api/bot-trust/audit failed', { error });
    return NextResponse.json(
      { error: 'Failed to log audit event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bot_id = searchParams.get('bot_id');
    const verify = searchParams.get('verify') === 'true';
    const exportLog = searchParams.get('export') === 'true';
    const stats = searchParams.get('stats') === 'true';

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    // Verify chain integrity
    if (verify) {
      const verification = await auditLogger.verifyChain(bot_id);
      return NextResponse.json({ verification });
    }

    // Export audit log
    if (exportLog) {
      const exportData = await auditLogger.exportAuditLog(bot_id);
      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="audit-log-${bot_id}.json"`,
        },
      });
    }

    // Get statistics
    if (stats) {
      const daysBack = parseInt(searchParams.get('days') || '30');
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const statistics = await auditLogger.getAuditStats(bot_id, startDate, endDate);
      return NextResponse.json({ stats: statistics });
    }

    // Get audit history
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const event_type = searchParams.get('event_type') as AuditEventType | undefined;

    const history = await auditLogger.getAuditHistory(bot_id, {
      limit,
      offset,
      event_type,
    });

    return NextResponse.json({ history });
  } catch (error) {
    logger.error('GET /api/bot-trust/audit failed', { error });
    return NextResponse.json(
      { error: 'Failed to get audit data' },
      { status: 500 }
    );
  }
}
