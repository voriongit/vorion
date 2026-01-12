/**
 * Trust Bridge - JWKS Endpoint
 *
 * GET /api/trust-bridge/jwks - Get JSON Web Key Set for credential verification
 *
 * This endpoint provides the public keys needed to verify Trust Bridge Credentials.
 * Third parties can use these keys to verify credentials offline.
 */

import { NextResponse } from 'next/server';
import { getPublicJWKS } from '@/lib/trust-bridge/credentials';

export async function GET() {
  const jwks = await getPublicJWKS();

  return NextResponse.json(jwks, {
    headers: {
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Content-Type': 'application/json',
    },
  });
}
