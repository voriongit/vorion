/**
 * API Documentation Route
 *
 * Serves the OpenAPI specification and API documentation portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Cache the spec in memory
let cachedSpec: string | null = null;

/**
 * Get OpenAPI specification
 */
async function getOpenAPISpec(): Promise<string> {
  if (cachedSpec && process.env.NODE_ENV === 'production') {
    return cachedSpec;
  }

  const specPath = join(process.cwd(), '../../packages/aci-spec/openapi.yaml');

  try {
    cachedSpec = await readFile(specPath, 'utf-8');
    return cachedSpec;
  } catch {
    // Return inline minimal spec if file not found
    return `
openapi: 3.1.0
info:
  title: Vorion ACI Trust Engine API
  version: 1.0.0
  description: Phase 6 Trust Engine API
paths: {}
`;
  }
}

/**
 * GET /api/docs - Serve OpenAPI spec
 */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format') || 'yaml';

  const spec = await getOpenAPISpec();

  if (format === 'json') {
    // Convert YAML to JSON (simple approach)
    const yaml = await import('yaml');
    const parsed = yaml.parse(spec);
    return NextResponse.json(parsed);
  }

  return new NextResponse(spec, {
    headers: {
      'Content-Type': 'application/x-yaml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
