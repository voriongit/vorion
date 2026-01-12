/**
 * Bot Telemetry API
 * POST /api/bot-trust/telemetry - Record a metric
 * GET /api/bot-trust/telemetry?bot_id={id}&metric={name} - Get metrics
 * GET /api/bot-trust/telemetry/snapshot?bot_id={id} - Get performance snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { telemetryCollector } from '@/lib/bot-trust';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bot_id, metric_name, metric_value, metric_unit, tags } = body;

    if (!bot_id || !metric_name || metric_value === undefined || !metric_unit) {
      return NextResponse.json(
        { error: 'Missing required fields: bot_id, metric_name, metric_value, metric_unit' },
        { status: 400 }
      );
    }

    await telemetryCollector.recordMetric(
      bot_id,
      metric_name,
      metric_value,
      metric_unit,
      tags
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('POST /api/bot-trust/telemetry failed', { error });
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bot_id = searchParams.get('bot_id');
    const metric_name = searchParams.get('metric');
    const snapshot = searchParams.get('snapshot') === 'true';
    const aggregated = searchParams.get('aggregated') === 'true';
    const timeseries = searchParams.get('timeseries') === 'true';

    if (!bot_id) {
      return NextResponse.json(
        { error: 'bot_id is required' },
        { status: 400 }
      );
    }

    // Performance snapshot
    if (snapshot) {
      const snapshotData = await telemetryCollector.getPerformanceSnapshot(bot_id);
      return NextResponse.json({ snapshot: snapshotData });
    }

    if (!metric_name) {
      return NextResponse.json(
        { error: 'metric parameter is required' },
        { status: 400 }
      );
    }

    // Date range
    const daysBack = parseInt(searchParams.get('days') || '7');
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Time series data
    if (timeseries) {
      const intervalMinutes = parseInt(searchParams.get('interval') || '60');
      const data = await telemetryCollector.getTimeSeriesData(
        bot_id,
        metric_name,
        startDate,
        endDate,
        intervalMinutes
      );
      return NextResponse.json({ timeseries: data });
    }

    // Aggregated metrics
    if (aggregated) {
      const stats = await telemetryCollector.getAggregatedMetrics(
        bot_id,
        metric_name,
        startDate,
        endDate
      );
      return NextResponse.json({ aggregated: stats });
    }

    // Raw metrics
    const metrics = await telemetryCollector.getMetrics(
      bot_id,
      metric_name,
      startDate,
      endDate
    );

    return NextResponse.json({ metrics });
  } catch (error) {
    logger.error('GET /api/bot-trust/telemetry failed', { error });
    return NextResponse.json(
      { error: 'Failed to get telemetry data' },
      { status: 500 }
    );
  }
}
