import { NextResponse } from 'next/server'

/**
 * Health Check Endpoint
 *
 * Returns the current status of the application.
 * Used for deployment verification and monitoring.
 *
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version || '0.1.0',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
  })
}

// Ensure this endpoint is always dynamic (not cached)
export const dynamic = 'force-dynamic'
