/**
 * A3I Testing Studio - Reports API
 * GET /api/testing-studio/reports - Get intelligence reports
 * POST /api/testing-studio/reports - Generate new report
 */

import { NextRequest, NextResponse } from 'next/server';
import type { IntelligenceReport, ReportMetrics } from '@/lib/testing-studio';

// In-memory report store (would use Supabase in production)
const reportStore: IntelligenceReport[] = [];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as IntelligenceReport['reportType'] | null;
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  let reports = [...reportStore];

  if (type) {
    reports = reports.filter(r => r.reportType === type);
  }

  // Sort by period end descending
  reports.sort((a, b) =>
    new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()
  );

  reports = reports.slice(0, limit);

  return NextResponse.json({
    success: true,
    reports: reports.map(r => ({
      id: r.id,
      type: r.reportType,
      title: r.title,
      description: r.description,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      metrics: r.metrics,
      novelVectorsDiscovered: r.novelVectorsDiscovered,
      status: r.status,
      publishedAt: r.publishedAt,
    })),
    summary: generateSummary(reports),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      type = 'custom',
      title,
      description,
      periodStart,
      periodEnd,
    } = body as {
      type?: IntelligenceReport['reportType'];
      title?: string;
      description?: string;
      periodStart?: string;
      periodEnd?: string;
    };

    const now = new Date();
    const start = periodStart ? new Date(periodStart) : getDefaultPeriodStart(type, now);
    const end = periodEnd ? new Date(periodEnd) : now;

    // Generate report (in production, would query actual session data)
    const report: IntelligenceReport = {
      id: `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      reportType: type,
      title: title || generateDefaultTitle(type, start, end),
      description,
      periodStart: start,
      periodEnd: end,
      metrics: generateMockMetrics(),
      novelVectorsDiscovered: Math.floor(Math.random() * 10),
      detectionImprovements: [
        {
          ruleId: 'DET-001',
          previousAccuracy: 0.82,
          newAccuracy: 0.89,
          improvement: 0.07,
          cause: 'Pattern refinement from adversarial session discoveries',
        },
      ],
      notableFindings: [
        'New multi-stage injection variant discovered',
        'Improved detection rate for homoglyph-based obfuscation',
        'False positive rate reduced by 15%',
      ],
      status: 'draft',
    };

    reportStore.push(report);

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        type: report.reportType,
        title: report.title,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        metrics: report.metrics,
        novelVectorsDiscovered: report.novelVectorsDiscovered,
        detectionImprovements: report.detectionImprovements,
        notableFindings: report.notableFindings,
        status: report.status,
      },
    });
  } catch (error) {
    console.error('[Testing Studio] Report generation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed',
      },
      { status: 500 }
    );
  }
}

function getDefaultPeriodStart(
  type: IntelligenceReport['reportType'],
  now: Date
): Date {
  const start = new Date(now);

  switch (type) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    default:
      start.setDate(start.getDate() - 1);
  }

  return start;
}

function generateDefaultTitle(
  type: IntelligenceReport['reportType'],
  start: Date,
  end: Date
): string {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (type) {
    case 'daily':
      return `Daily Intelligence Report - ${formatDate(end)}`;
    case 'weekly':
      return `Weekly Intelligence Report - ${formatDate(start)} to ${formatDate(end)}`;
    case 'monthly':
      return `Monthly Intelligence Report - ${start.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    case 'incident':
      return `Incident Report - ${formatDate(end)}`;
    default:
      return `Intelligence Report - ${formatDate(start)} to ${formatDate(end)}`;
  }
}

function generateMockMetrics(): ReportMetrics {
  return {
    sessionsRun: Math.floor(Math.random() * 20) + 5,
    totalTurns: Math.floor(Math.random() * 1000) + 200,
    attacksAttempted: Math.floor(Math.random() * 500) + 100,
    attacksSuccessful: Math.floor(Math.random() * 50) + 10,
    attacksDetected: Math.floor(Math.random() * 400) + 80,
    detectionAccuracy: 0.85 + Math.random() * 0.1,
    falsePositiveRate: Math.random() * 0.05,
    novelVectors: Math.floor(Math.random() * 10),
    topAttackCategories: [
      { category: 'prompt_injection', count: Math.floor(Math.random() * 100) + 50 },
      { category: 'jailbreak', count: Math.floor(Math.random() * 80) + 30 },
      { category: 'obfuscation', count: Math.floor(Math.random() * 60) + 20 },
    ],
    topRedAgents: [
      { agentId: 'injector-alpha', discoveries: Math.floor(Math.random() * 10) },
      { agentId: 'jailbreaker-beta', discoveries: Math.floor(Math.random() * 8) },
      { agentId: 'obfuscator-gamma', discoveries: Math.floor(Math.random() * 6) },
    ],
    topBlueAgents: [
      { agentId: 'sentinel-prime', accuracy: 0.9 + Math.random() * 0.08 },
      { agentId: 'guardian-alpha', accuracy: 0.85 + Math.random() * 0.1 },
      { agentId: 'decoder-beta', accuracy: 0.88 + Math.random() * 0.08 },
    ],
  };
}

function generateSummary(reports: IntelligenceReport[]): {
  totalReports: number;
  avgDetectionAccuracy: number;
  totalNovelDiscoveries: number;
  recentTrends: string[];
} {
  const total = reports.length;
  const avgAccuracy = reports.length > 0
    ? reports.reduce((sum, r) => sum + r.metrics.detectionAccuracy, 0) / reports.length
    : 0;
  const totalDiscoveries = reports.reduce((sum, r) => sum + r.novelVectorsDiscovered, 0);

  return {
    totalReports: total,
    avgDetectionAccuracy: avgAccuracy,
    totalNovelDiscoveries: totalDiscoveries,
    recentTrends: [
      'Prompt injection attacks increasing in sophistication',
      'Multi-stage attacks becoming more common',
      'Detection accuracy improving week-over-week',
    ],
  };
}
