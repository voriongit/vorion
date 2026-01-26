/**
 * Phase 6 Authentication & Authorization
 *
 * Enterprise-grade authentication with JWT, API keys, and OAuth support
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  organizationId?: string;
  permissions: Permission[];
  metadata?: Record<string, unknown>;
}

export interface APIKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions: Permission[];
  organizationId?: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  rateLimit?: number;
  allowedIPs?: string[];
  enabled: boolean;
}

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  name?: string;
  role: UserRole;
  org?: string; // Organization ID
  permissions: Permission[];
  iat: number;
  exp: number;
  jti?: string; // JWT ID for revocation
}

export interface OAuthConfig {
  provider: 'google' | 'github' | 'azure' | 'okta' | 'custom';
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  callbackUrl: string;
}

export type UserRole = 'super_admin' | 'admin' | 'member' | 'viewer' | 'api';
export type Permission =
  | 'phase6:read'
  | 'phase6:write'
  | 'phase6:admin'
  | 'role_gates:read'
  | 'role_gates:write'
  | 'role_gates:delete'
  | 'ceiling:read'
  | 'ceiling:write'
  | 'provenance:read'
  | 'provenance:export'
  | 'alerts:read'
  | 'alerts:manage'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'presets:read'
  | 'presets:write'
  | 'presets:apply'
  | 'audit:read'
  | 'audit:export'
  | 'api_keys:read'
  | 'api_keys:write'
  | 'users:read'
  | 'users:write'
  | 'settings:read'
  | 'settings:write';

export interface AuthContext {
  user?: AuthUser;
  apiKey?: APIKey;
  method: 'jwt' | 'api_key' | 'oauth' | 'anonymous';
  organizationId?: string;
  requestId: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: number;
  jwtRefreshExpiresIn: number;
  apiKeyPrefix: string;
  apiKeyLength: number;
  allowAnonymous: boolean;
  requireOrganization: boolean;
  revokedTokensCache?: Set<string>;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: 3600, // 1 hour
  jwtRefreshExpiresIn: 604800, // 7 days
  apiKeyPrefix: 'vak_', // Vorion API Key
  apiKeyLength: 32,
  allowAnonymous: false,
  requireOrganization: false,
};

// =============================================================================
// Role Permissions Mapping
// =============================================================================

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'phase6:read', 'phase6:write', 'phase6:admin',
    'role_gates:read', 'role_gates:write', 'role_gates:delete',
    'ceiling:read', 'ceiling:write',
    'provenance:read', 'provenance:export',
    'alerts:read', 'alerts:manage',
    'webhooks:read', 'webhooks:write',
    'presets:read', 'presets:write', 'presets:apply',
    'audit:read', 'audit:export',
    'api_keys:read', 'api_keys:write',
    'users:read', 'users:write',
    'settings:read', 'settings:write',
  ],
  admin: [
    'phase6:read', 'phase6:write',
    'role_gates:read', 'role_gates:write', 'role_gates:delete',
    'ceiling:read', 'ceiling:write',
    'provenance:read', 'provenance:export',
    'alerts:read', 'alerts:manage',
    'webhooks:read', 'webhooks:write',
    'presets:read', 'presets:write', 'presets:apply',
    'audit:read', 'audit:export',
    'api_keys:read', 'api_keys:write',
    'users:read', 'users:write',
    'settings:read',
  ],
  member: [
    'phase6:read', 'phase6:write',
    'role_gates:read', 'role_gates:write',
    'ceiling:read', 'ceiling:write',
    'provenance:read',
    'alerts:read', 'alerts:manage',
    'webhooks:read',
    'presets:read', 'presets:apply',
    'audit:read',
  ],
  viewer: [
    'phase6:read',
    'role_gates:read',
    'ceiling:read',
    'provenance:read',
    'alerts:read',
    'webhooks:read',
    'presets:read',
    'audit:read',
  ],
  api: [
    'phase6:read', 'phase6:write',
    'role_gates:read', 'role_gates:write',
    'ceiling:read', 'ceiling:write',
    'provenance:read',
    'alerts:read',
    'presets:read',
  ],
};

// =============================================================================
// In-Memory Stores (replace with database in production)
// =============================================================================

const apiKeysStore = new Map<string, APIKey>();
const revokedTokens = new Set<string>();
const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();

// =============================================================================
// JWT Utilities
// =============================================================================

/**
 * Encode base64url
 */
function base64UrlEncode(data: string | Buffer): string {
  const base64 = Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url
 */
function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(base64 + padding, 'base64').toString();
}

/**
 * Create JWT signature
 */
function createJWTSignature(header: string, payload: string, secret: string): string {
  const data = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  return base64UrlEncode(signature);
}

/**
 * Create JWT token
 */
export function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  config: Partial<AuthConfig> = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + cfg.jwtExpiresIn,
    jti: randomBytes(16).toString('hex'),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = createJWTSignature(header, encodedPayload, cfg.jwtSecret);

  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode JWT token
 */
export function verifyJWT(
  token: string,
  config: Partial<AuthConfig> = {}
): JWTPayload | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Verify signature
    const expectedSignature = createJWTSignature(header, payload, cfg.jwtSecret);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    // Decode payload
    const decoded = JSON.parse(base64UrlDecode(payload)) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return null;

    // Check if revoked
    if (decoded.jti && revokedTokens.has(decoded.jti)) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Revoke a JWT token
 */
export function revokeJWT(jti: string): void {
  revokedTokens.add(jti);
}

/**
 * Create refresh token
 */
export function createRefreshToken(
  userId: string,
  config: Partial<AuthConfig> = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + cfg.jwtRefreshExpiresIn * 1000);

  refreshTokens.set(token, { userId, expiresAt });
  return token;
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): string | null {
  const data = refreshTokens.get(token);
  if (!data) return null;
  if (data.expiresAt < new Date()) {
    refreshTokens.delete(token);
    return null;
  }
  return data.userId;
}

/**
 * Revoke refresh token
 */
export function revokeRefreshToken(token: string): void {
  refreshTokens.delete(token);
}

// =============================================================================
// API Key Utilities
// =============================================================================

/**
 * Generate a new API key
 */
export function generateAPIKey(
  config: Partial<AuthConfig> = {}
): { key: string; hash: string; prefix: string } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const key = cfg.apiKeyPrefix + randomBytes(cfg.apiKeyLength).toString('hex');
  const hash = createHmac('sha256', cfg.jwtSecret).update(key).digest('hex');
  const prefix = key.substring(0, 12);

  return { key, hash, prefix };
}

/**
 * Verify API key
 */
export function verifyAPIKey(
  key: string,
  config: Partial<AuthConfig> = {}
): APIKey | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Compute hash
  const hash = createHmac('sha256', cfg.jwtSecret).update(key).digest('hex');

  // Find API key by hash
  for (const apiKey of apiKeysStore.values()) {
    if (apiKey.keyHash === hash) {
      // Check if enabled
      if (!apiKey.enabled) return null;

      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

      // Update last used
      apiKey.lastUsedAt = new Date();
      apiKeysStore.set(apiKey.id, apiKey);

      return apiKey;
    }
  }

  return null;
}

/**
 * Create a new API key
 */
export function createAPIKey(
  name: string,
  createdBy: string,
  options: {
    permissions?: Permission[];
    organizationId?: string;
    expiresAt?: Date;
    rateLimit?: number;
    allowedIPs?: string[];
  } = {},
  config: Partial<AuthConfig> = {}
): { apiKey: APIKey; rawKey: string } {
  const { key, hash, prefix } = generateAPIKey(config);
  const id = randomBytes(16).toString('hex');

  const apiKey: APIKey = {
    id,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions: options.permissions || ROLE_PERMISSIONS.api,
    organizationId: options.organizationId,
    createdBy,
    createdAt: new Date(),
    expiresAt: options.expiresAt,
    rateLimit: options.rateLimit,
    allowedIPs: options.allowedIPs,
    enabled: true,
  };

  apiKeysStore.set(id, apiKey);

  return { apiKey, rawKey: key };
}

/**
 * Revoke API key
 */
export function revokeAPIKey(id: string): boolean {
  const apiKey = apiKeysStore.get(id);
  if (!apiKey) return false;

  apiKey.enabled = false;
  apiKeysStore.set(id, apiKey);
  return true;
}

/**
 * Delete API key
 */
export function deleteAPIKey(id: string): boolean {
  return apiKeysStore.delete(id);
}

/**
 * List API keys for an organization
 */
export function listAPIKeys(organizationId?: string): APIKey[] {
  const keys = Array.from(apiKeysStore.values());
  if (organizationId) {
    return keys.filter((k) => k.organizationId === organizationId);
  }
  return keys;
}

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Extract auth context from request
 */
export async function authenticate(
  request: NextRequest,
  config: Partial<AuthConfig> = {}
): Promise<AuthContext> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const requestId = request.headers.get('x-request-id') || randomBytes(8).toString('hex');

  // Try Bearer token (JWT)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyJWT(token, cfg);

    if (payload) {
      return {
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          organizationId: payload.org,
          permissions: payload.permissions,
        },
        method: 'jwt',
        organizationId: payload.org,
        requestId,
      };
    }
  }

  // Try API Key
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    const apiKey = verifyAPIKey(apiKeyHeader, cfg);

    if (apiKey) {
      // Check IP allowlist
      if (apiKey.allowedIPs?.length) {
        const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip');

        if (clientIP && !apiKey.allowedIPs.includes(clientIP)) {
          throw new AuthError('IP_NOT_ALLOWED', 'IP address not in allowlist');
        }
      }

      return {
        apiKey,
        method: 'api_key',
        organizationId: apiKey.organizationId,
        requestId,
      };
    }
  }

  // Anonymous access
  if (cfg.allowAnonymous) {
    return {
      method: 'anonymous',
      requestId,
    };
  }

  throw new AuthError('UNAUTHORIZED', 'Authentication required');
}

/**
 * Check if context has permission
 */
export function hasPermission(context: AuthContext, permission: Permission): boolean {
  if (context.user) {
    return context.user.permissions.includes(permission);
  }
  if (context.apiKey) {
    return context.apiKey.permissions.includes(permission);
  }
  return false;
}

/**
 * Check if context has any of the permissions
 */
export function hasAnyPermission(context: AuthContext, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(context, p));
}

/**
 * Check if context has all permissions
 */
export function hasAllPermissions(context: AuthContext, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(context, p));
}

// =============================================================================
// Middleware Wrappers
// =============================================================================

export interface AuthenticatedRequest extends NextRequest {
  auth: AuthContext;
}

/**
 * Authentication middleware
 */
export function withAuth<T>(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse<T>>,
  config: Partial<AuthConfig> = {}
): (request: NextRequest) => Promise<NextResponse<T>> {
  return async (request: NextRequest) => {
    try {
      const auth = await authenticate(request, config);
      const authRequest = request as AuthenticatedRequest;
      authRequest.auth = auth;
      return handler(authRequest);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status }
        ) as NextResponse<T>;
      }
      throw error;
    }
  };
}

/**
 * Permission check middleware
 */
export function requirePermission<T>(
  permission: Permission,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse<T>>,
  config: Partial<AuthConfig> = {}
): (request: NextRequest) => Promise<NextResponse<T>> {
  return withAuth(async (request) => {
    if (!hasPermission(request.auth, permission)) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: `Missing required permission: ${permission}`,
          },
        },
        { status: 403 }
      ) as NextResponse<T>;
    }
    return handler(request);
  }, config);
}

/**
 * Role check middleware
 */
export function requireRole<T>(
  roles: UserRole[],
  handler: (request: AuthenticatedRequest) => Promise<NextResponse<T>>,
  config: Partial<AuthConfig> = {}
): (request: NextRequest) => Promise<NextResponse<T>> {
  return withAuth(async (request) => {
    const userRole = request.auth.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: `Required role: ${roles.join(' or ')}`,
          },
        },
        { status: 403 }
      ) as NextResponse<T>;
    }
    return handler(request);
  }, config);
}

// =============================================================================
// Error Classes
// =============================================================================

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// =============================================================================
// OAuth Helpers
// =============================================================================

/**
 * Generate OAuth authorization URL
 */
export function getOAuthAuthorizationUrl(
  config: OAuthConfig,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange OAuth code for tokens
 */
export async function exchangeOAuthCode(
  config: OAuthConfig,
  code: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new AuthError('OAUTH_ERROR', 'Failed to exchange code for tokens');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get OAuth user info
 */
export async function getOAuthUserInfo(
  config: OAuthConfig,
  accessToken: string
): Promise<{ id: string; email: string; name?: string }> {
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new AuthError('OAUTH_ERROR', 'Failed to get user info');
  }

  const data = await response.json();

  // Handle different provider response formats
  switch (config.provider) {
    case 'google':
      return { id: data.sub, email: data.email, name: data.name };
    case 'github':
      return { id: String(data.id), email: data.email, name: data.name };
    case 'azure':
      return { id: data.sub, email: data.email, name: data.name };
    default:
      return { id: data.id || data.sub, email: data.email, name: data.name };
  }
}

// =============================================================================
// Exports
// =============================================================================

export const authService = {
  // JWT
  createJWT,
  verifyJWT,
  revokeJWT,
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  // API Keys
  generateAPIKey,
  verifyAPIKey,
  createAPIKey,
  revokeAPIKey,
  deleteAPIKey,
  listAPIKeys,
  // Authentication
  authenticate,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  // Middleware
  withAuth,
  requirePermission,
  requireRole,
  // OAuth
  getOAuthAuthorizationUrl,
  exchangeOAuthCode,
  getOAuthUserInfo,
  // Config
  ROLE_PERMISSIONS,
};
