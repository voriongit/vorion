/**
 * Compliance API - Main Endpoint
 * GET /api/compliance - Get compliance dashboard
 * POST /api/compliance/report - Generate compliance report
 */

import { NextRequest, NextResponse } from 'next/server';
import { complianceService, complianceAuditLogger } from '@/lib/compliance';
import type { ComplianceFramework } from '@/lib/compliance/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const frameworks = searchParams.get('frameworks')?.split(',') as ComplianceFramework[] | undefined;

    // Get dashboard data
    const dashboard = await complianceService.getDashboard();

    // Get compliance status for requested frameworks
    const status = await complianceService.checkComplianceStatus(frameworks);

    // Get current metrics
    const metrics = complianceService.getMetrics();

    // Log the access
    await complianceAuditLogger.logDataOperation({
      operation: 'read',
      resourceType: 'compliance_report',
      resourceId: 'dashboard',
      dataClassification: 'internal',
      success: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        dashboard,
        status,
        metrics,
      },
    });
  } catch (error) {
    console.error('[Compliance API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'generate_report': {
        const report = await complianceService.generateReport({
          framework: params.framework || 'soc2',
          reportType: params.reportType || 'summary',
          startDate: new Date(params.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(params.endDate || Date.now()),
        });
        return NextResponse.json({ success: true, data: report });
      }

      case 'check_status': {
        const status = await complianceService.checkComplianceStatus(params.frameworks);
        return NextResponse.json({ success: true, data: status });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Compliance API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process compliance request' },
      { status: 500 }
    );
  }
}
