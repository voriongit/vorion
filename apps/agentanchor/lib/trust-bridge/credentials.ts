/**
 * Trust Bridge - Credentials Module
 *
 * Issues and verifies Trust Bridge Credentials (TBC) for external agents
 */

import * as jose from 'jose';
import type {
  AgentSubmission,
  TestResults,
  TrustBridgeCredential,
  TrustBridgePayload,
  VerificationResult,
  CertificationTier,
} from './types';
import { determineTier } from './certification';
import { urls } from '@/lib/config';

// ============================================================================
// Key Management (Placeholder - use proper key management in production)
// ============================================================================

// In production, these would be loaded from secure storage
// For now, generate ephemeral keys for development
let signingKey: CryptoKey | null = null;
let verifyKey: CryptoKey | null = null;
let currentKeyId = 'a3i-tb-dev-key-2024';

async function ensureKeys() {
  if (!signingKey) {
    // In production: load from env/secrets manager
    // For development: generate ephemeral keys
    const keyPair = await jose.generateKeyPair('ES256');
    signingKey = keyPair.privateKey;
    verifyKey = keyPair.publicKey;
  }
}

export async function getPublicJWKS(): Promise<jose.JSONWebKeySet> {
  await ensureKeys();
  const jwk = await jose.exportJWK(verifyKey!);
  return {
    keys: [
      {
        ...jwk,
        kid: currentKeyId,
        use: 'sig',
        alg: 'ES256',
      },
    ],
  };
}

// ============================================================================
// Credential Issuance
// ============================================================================

export interface IssueCredentialInput {
  submission: AgentSubmission;
  testResults: TestResults;
  restrictions: string[];
  councilReviewed: boolean;
}

export async function issueCredential(
  input: IssueCredentialInput
): Promise<TrustBridgeCredential | null> {
  await ensureKeys();

  const tier = determineTier(input.testResults.total_score);
  if (!tier) {
    return null; // Did not pass certification
  }

  const now = Math.floor(Date.now() / 1000);
  const validityMonths = 6; // 6 months for external agents
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + validityMonths);
  const exp = Math.floor(expiryDate.getTime() / 1000);

  // Generate agent ID
  const agentId = generateExternalAgentId(
    input.submission.origin_platform,
    input.submission.name
  );

  // Build payload
  const payload: TrustBridgePayload = {
    iss: urls.apiIssuer,
    sub: agentId,
    aud: ['*'],
    iat: now,
    exp: exp,
    a3i: {
      type: 'trust_bridge',
      trust_score: input.testResults.total_score,
      tier,
      origin_platform: input.submission.origin_platform,
      capabilities: input.submission.capabilities,
      risk_level: input.submission.risk_category,
      certification_date: new Date().toISOString().split('T')[0],
      tests_passed: input.testResults.tests_passed,
      tests_total: input.testResults.tests_total,
      council_reviewed: input.councilReviewed,
      restrictions: input.restrictions,
      valid_until: expiryDate.toISOString().split('T')[0],
    },
  };

  // Sign the token
  const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'A3I-TBC',
      kid: currentKeyId,
    })
    .sign(signingKey!);

  return {
    token,
    payload,
    issued_at: new Date(now * 1000),
    expires_at: expiryDate,
  };
}

function generateExternalAgentId(platform: string, name: string): string {
  const platformCode = platform.substring(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '');
  const nameCode = name.substring(0, 16).toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.random().toString(36).substring(2, 8);
  return `ext-${platformCode}-${nameCode}-${random}`;
}

// ============================================================================
// Credential Verification
// ============================================================================

// In-memory revocation list (use database in production)
const revokedCredentials: Set<string> = new Set();

export async function verifyCredential(token: string): Promise<VerificationResult> {
  await ensureKeys();

  try {
    // Verify signature and decode
    const { payload, protectedHeader } = await jose.jwtVerify(
      token,
      verifyKey!,
      {
        algorithms: ['ES256'],
        issuer: urls.apiIssuer,
      }
    );

    const tbPayload = payload as unknown as TrustBridgePayload;

    // Check if revoked
    if (revokedCredentials.has(tbPayload.sub)) {
      return {
        valid: false,
        error: 'Agent credential has been revoked',
        error_code: 'revoked',
      };
    }

    // Check type
    if (tbPayload.a3i?.type !== 'trust_bridge') {
      return {
        valid: false,
        error: 'Not a Trust Bridge credential',
        error_code: 'malformed',
      };
    }

    // Build warnings
    const warnings: string[] = [];

    // Check if trust score might be stale (credential older than 30 days)
    const issueDate = new Date(tbPayload.iat * 1000);
    const daysSinceIssue = (Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceIssue > 30) {
      warnings.push('trust_score_may_be_stale');
    }

    // Check if approaching expiry
    const daysUntilExpiry = (tbPayload.exp * 1000 - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry < 30) {
      warnings.push('credential_expiring_soon');
    }

    return {
      valid: true,
      agent_id: tbPayload.sub,
      trust_score: tbPayload.a3i.trust_score,
      tier: tbPayload.a3i.tier,
      origin_platform: tbPayload.a3i.origin_platform,
      restrictions: tbPayload.a3i.restrictions,
      certified_until: tbPayload.a3i.valid_until,
      council_reviewed: tbPayload.a3i.council_reviewed,
      test_summary: {
        tests_passed: tbPayload.a3i.tests_passed,
        tests_total: tbPayload.a3i.tests_total,
        certification_date: tbPayload.a3i.certification_date,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return {
        valid: false,
        error: 'Credential has expired',
        error_code: 'expired',
      };
    }

    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return {
        valid: false,
        error: 'Credential validation failed',
        error_code: 'invalid_signature',
      };
    }

    if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      return {
        valid: false,
        error: 'Invalid credential signature',
        error_code: 'invalid_signature',
      };
    }

    return {
      valid: false,
      error: 'Malformed credential',
      error_code: 'malformed',
    };
  }
}

// ============================================================================
// Credential Revocation
// ============================================================================

export interface RevokeResult {
  success: boolean;
  error?: string;
}

export async function revokeCredential(agentId: string, reason: string): Promise<RevokeResult> {
  // Add to revocation list
  revokedCredentials.add(agentId);

  // In production: Store in database with reason and timestamp
  console.log(`[Trust Bridge] Revoked credential for ${agentId}: ${reason}`);

  return { success: true };
}

export function isRevoked(agentId: string): boolean {
  return revokedCredentials.has(agentId);
}

// ============================================================================
// Credential Refresh
// ============================================================================

export interface RefreshInput {
  currentToken: string;
  submission: AgentSubmission;
  // Optional: new test results for re-certification
  newTestResults?: TestResults;
}

export interface RefreshResult {
  success: boolean;
  credential?: TrustBridgeCredential;
  error?: string;
}

export async function refreshCredential(input: RefreshInput): Promise<RefreshResult> {
  // Verify current credential is valid (or recently expired)
  const verification = await verifyCredential(input.currentToken);

  if (!verification.valid && verification.error_code !== 'expired') {
    return {
      success: false,
      error: `Cannot refresh: ${verification.error}`,
    };
  }

  // Check if within refresh window (can refresh within 30 days of expiry)
  // For expired credentials, allow refresh within 7 days
  if (verification.error_code === 'expired') {
    // Would need to decode token manually to check expiry date
    // For now, allow refresh of recently expired credentials
  }

  // If no new test results, use original scores from credential
  if (!input.newTestResults) {
    // In production: Look up original test results from database
    // For now, create mock results based on original credential
    return {
      success: false,
      error: 'Re-certification required - please run new tests',
    };
  }

  // Issue new credential with new test results
  const newCredential = await issueCredential({
    submission: input.submission,
    testResults: input.newTestResults,
    restrictions: verification.restrictions || [],
    councilReviewed: verification.council_reviewed || false,
  });

  if (!newCredential) {
    return {
      success: false,
      error: 'Agent no longer meets certification requirements',
    };
  }

  return {
    success: true,
    credential: newCredential,
  };
}
