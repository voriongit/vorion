/**
 * Compliance Audit API
 * GET /api/compliance/audit - Query audit logs
 * POST /api/compliance/audit - Log audit event
 */

import { NextRequest, NextResponse } from 'next/server';
import { complianceAuditLogger } from '@/lib/compliance';
import type { ComplianceFramework } from '@/lib/compliance/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: Parameters<typeof complianceAuditLogger.query>[0] = {};

    // Parse query parameters
    if (searchParams.has('startDate')) {
      params.startDate = new Date(searchParams.get('startDate')!);
    }
    if (searchParams.has('endDate')) {
      params.endDate = new Date(searchParams.get('endDate')!);
    }
    if (searchParams.has('userId')) {
      params.userId = searchParams.get('userId')!;
    }
    if (searchParams.has('agentId')) {
      params.agentId = searchParams.get('agentId')!;
    }
    if (searchParams.has('resourceType')) {
      params.resourceType = searchParams.get('resourceType')!;
    }
    if (searchParams.has('frameworks')) {
      params.frameworks = searchParams.get('frameworks')!.split(',') as ComplianceFramework[];
    }
    if (searchParams.has('phiOnly')) {
      params.phiOnly = searchParams.get('phiOnly') === 'true';
    }
    if (searchParams.has('limit')) {
      params.limit = parseInt(searchParams.get('limit')!, 10);
    }
    if (searchParams.has('offset')) {
      params.offset = parseInt(searchParams.get('offset')!, 10);
    }

    const events = await complianceAuditLogger.query(params);

    return NextResponse.json({
      success: true,
      data: {
        events,
        count: events.length,
        params,
      },
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, ...eventData } = body;

    // Validate required fields
    if (!eventType || !eventData.resourceType || !eventData.resourceId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: eventType, resourceType, resourceId' },
        { status: 400 }
      );
    }

    // Log the event
    const eventId = await complianceAuditLogger.log({
      eventType,
      resourceType: eventData.resourceType,
      resourceId: eventData.resourceId,
      action: eventData.action || eventType,
      outcome: eventData.outcome || 'success',
      userId: eventData.userId,
      agentId: eventData.agentId,
      ipAddress: eventData.ipAddress,
      details: eventData.details || {},
      frameworks: eventData.frameworks || [],
      controlIds: eventData.controlIds || [],
      sensitivity: eventData.sensitivity || 'medium',
      phiInvolved: eventData.phiInvolved || false,
    });

    return NextResponse.json({
      success: true,
      data: { eventId },
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log audit event' },
      { status: 500 }
    );
  }
}
