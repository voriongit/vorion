/**
 * JWKS (JSON Web Key Set) Endpoint
 *
 * FR159: Public key discovery for Portable Trust Credential verification
 * Endpoint: GET /.well-known/jwks.json
 *
 * Exposes active signing public keys in standard JWK format for external
 * integrations to verify AgentAnchor-issued credentials.
 */

import { NextResponse } from 'next/server';
import { exportJWK, generateKeyPair, importSPKI } from 'jose';

// Cache the JWK Set for performance (refresh every 5 minutes)
let cachedJwks: { keys: JsonWebKey[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Development key pair cache (matches credential-service.ts)
let devKeyPair: { privateKey: CryptoKey; publicKey: CryptoKey } | null = null;

/**
 * Get the current signing key ID
 */
function getCurrentKeyId(): string {
  const year = new Date().getFullYear();
  return `aa_key_${year}_001`;
}

/**
 * Get the public key for JWK export
 */
async function getPublicKey(): Promise<CryptoKey> {
  const publicKeyPem = process.env.CREDENTIAL_SIGNING_PUBLIC_KEY;

  if (!publicKeyPem) {
    // In development, generate and cache a temporary key pair
    if (process.env.NODE_ENV === 'development') {
      if (!devKeyPair) {
        devKeyPair = await generateKeyPair('ES256');
      }
      return devKeyPair.publicKey;
    }
    throw new Error('CREDENTIAL_SIGNING_PUBLIC_KEY not configured');
  }

  return importSPKI(publicKeyPem, 'ES256');
}

/**
 * Build the JWK Set
 */
async function buildJwkSet(): Promise<{ keys: JsonWebKey[] }> {
  // Check cache
  if (cachedJwks && Date.now() - cachedJwks.timestamp < CACHE_TTL_MS) {
    return { keys: cachedJwks.keys };
  }

  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);

  // Add required metadata
  const keyId = getCurrentKeyId();
  const fullJwk: JsonWebKey = {
    ...jwk,
    kid: keyId,           // Key ID for key rotation
    use: 'sig',           // Key usage: signature verification
    alg: 'ES256',         // Algorithm: ECDSA with P-256
    key_ops: ['verify'],  // Key operations: verify only
  };

  // Cache the result
  cachedJwks = {
    keys: [fullJwk],
    timestamp: Date.now(),
  };

  return { keys: [fullJwk] };
}

/**
 * GET /.well-known/jwks.json
 *
 * Returns the JWK Set containing active public keys for credential verification.
 *
 * Response format (RFC 7517):
 * {
 *   "keys": [
 *     {
 *       "kty": "EC",
 *       "crv": "P-256",
 *       "x": "...",
 *       "y": "...",
 *       "kid": "aa_key_2025_001",
 *       "use": "sig",
 *       "alg": "ES256",
 *       "key_ops": ["verify"]
 *     }
 *   ]
 * }
 */
export async function GET() {
  try {
    const jwks = await buildJwkSet();

    // Return with appropriate caching headers
    return NextResponse.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        // CORS headers for external integrations
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept, Content-Type',
      },
    });
  } catch (error) {
    console.error('JWKS endpoint error:', error);

    // Return 503 if keys not configured (service unavailable)
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          message: 'Key configuration pending',
        },
        {
          status: 503,
          headers: {
            'Retry-After': '300',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /.well-known/jwks.json
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
