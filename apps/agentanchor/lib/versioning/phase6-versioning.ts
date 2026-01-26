/**
 * Phase 6 API Versioning
 *
 * URL-based API versioning with backwards compatibility support
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Types
// =============================================================================

export type APIVersion = 'v1' | 'v2';

export interface VersionConfig {
  version: APIVersion;
  status: 'current' | 'stable' | 'deprecated' | 'sunset';
  deprecationDate?: string;
  sunsetDate?: string;
  changelog?: string;
}

export interface VersionedRequest extends NextRequest {
  apiVersion: APIVersion;
}

export interface VersionInfo {
  current: APIVersion;
  supported: APIVersion[];
  deprecated: APIVersion[];
  latest: APIVersion;
}

// =============================================================================
// Version Configuration
// =============================================================================

export const VERSION_CONFIG: Record<APIVersion, VersionConfig> = {
  v1: {
    version: 'v1',
    status: 'current',
    changelog: '/docs/api/changelog#v1',
  },
  v2: {
    version: 'v2',
    status: 'stable',
    changelog: '/docs/api/changelog#v2',
  },
};

export const CURRENT_VERSION: APIVersion = 'v1';
export const LATEST_VERSION: APIVersion = 'v1';
export const SUPPORTED_VERSIONS: APIVersion[] = ['v1'];
export const DEPRECATED_VERSIONS: APIVersion[] = [];

// =============================================================================
// Version Detection
// =============================================================================

/**
 * Extract API version from request
 */
export function extractVersion(request: NextRequest): APIVersion | null {
  // 1. Check URL path: /api/v1/phase6/...
  const pathMatch = request.nextUrl.pathname.match(/\/api\/(v\d+)\//);
  if (pathMatch) {
    const version = pathMatch[1] as APIVersion;
    if (isValidVersion(version)) {
      return version;
    }
  }

  // 2. Check Accept header: Accept: application/vnd.vorion.v1+json
  const acceptHeader = request.headers.get('accept');
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.vorion\.(v\d+)\+json/);
    if (versionMatch) {
      const version = versionMatch[1] as APIVersion;
      if (isValidVersion(version)) {
        return version;
      }
    }
  }

  // 3. Check custom header: X-API-Version: v1
  const versionHeader = request.headers.get('x-api-version');
  if (versionHeader && isValidVersion(versionHeader as APIVersion)) {
    return versionHeader as APIVersion;
  }

  // 4. Check query parameter: ?api_version=v1
  const queryVersion = request.nextUrl.searchParams.get('api_version');
  if (queryVersion && isValidVersion(queryVersion as APIVersion)) {
    return queryVersion as APIVersion;
  }

  return null;
}

/**
 * Check if version is valid
 */
export function isValidVersion(version: APIVersion): boolean {
  return version in VERSION_CONFIG;
}

/**
 * Check if version is supported
 */
export function isSupportedVersion(version: APIVersion): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

/**
 * Check if version is deprecated
 */
export function isDeprecatedVersion(version: APIVersion): boolean {
  return DEPRECATED_VERSIONS.includes(version);
}

// =============================================================================
// Response Headers
// =============================================================================

/**
 * Add version headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: APIVersion
): NextResponse {
  const config = VERSION_CONFIG[version];

  response.headers.set('X-API-Version', version);
  response.headers.set('X-API-Version-Status', config.status);

  if (config.deprecationDate) {
    response.headers.set('X-API-Deprecation-Date', config.deprecationDate);
    response.headers.set('Deprecation', config.deprecationDate);
  }

  if (config.sunsetDate) {
    response.headers.set('Sunset', config.sunsetDate);
  }

  // Add supported versions
  response.headers.set('X-API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));

  return response;
}

// =============================================================================
// Version Middleware
// =============================================================================

/**
 * API versioning middleware
 */
export function withVersioning<T>(
  handler: (request: VersionedRequest) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T>> {
  return async (request: NextRequest) => {
    const version = extractVersion(request) || CURRENT_VERSION;

    // Check if version is valid
    if (!isValidVersion(version)) {
      return NextResponse.json(
        {
          error: {
            code: 'P6_INVALID_VERSION',
            message: `Invalid API version: ${version}`,
            supportedVersions: SUPPORTED_VERSIONS,
          },
        },
        { status: 400 }
      ) as NextResponse<T>;
    }

    // Check if version is supported
    if (!isSupportedVersion(version)) {
      const config = VERSION_CONFIG[version];
      return NextResponse.json(
        {
          error: {
            code: 'P6_VERSION_SUNSET',
            message: `API version ${version} is no longer supported`,
            sunsetDate: config.sunsetDate,
            supportedVersions: SUPPORTED_VERSIONS,
          },
        },
        { status: 410 }
      ) as NextResponse<T>;
    }

    // Add version to request
    const versionedRequest = request as VersionedRequest;
    versionedRequest.apiVersion = version;

    // Call handler
    const response = await handler(versionedRequest);

    // Add version headers
    return addVersionHeaders(response, version);
  };
}

// =============================================================================
// Version-specific Handlers
// =============================================================================

type VersionHandler<T> = (request: VersionedRequest) => Promise<NextResponse<T>>;

/**
 * Create handler that routes to version-specific implementations
 */
export function versionedHandler<T>(
  handlers: Partial<Record<APIVersion, VersionHandler<T>>>,
  fallback?: VersionHandler<T>
): VersionHandler<T> {
  return async (request: VersionedRequest) => {
    const handler = handlers[request.apiVersion] || fallback;

    if (!handler) {
      return NextResponse.json(
        {
          error: {
            code: 'P6_VERSION_NOT_IMPLEMENTED',
            message: `Endpoint not implemented for API version ${request.apiVersion}`,
          },
        },
        { status: 501 }
      ) as NextResponse<T>;
    }

    return handler(request);
  };
}

// =============================================================================
// Response Transformers
// =============================================================================

/**
 * Transform response based on API version
 */
export function transformResponse<T>(
  data: T,
  version: APIVersion,
  transformers: Partial<Record<APIVersion, (data: T) => unknown>>
): unknown {
  const transformer = transformers[version];
  return transformer ? transformer(data) : data;
}

/**
 * Example: V1 to V2 field mapping
 */
export const V1_TO_V2_MAPPINGS = {
  roleGate: {
    // V1 field -> V2 field
    minimum_tier: 'minimumTier',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
  },
  provenance: {
    merkle_root: 'merkleRoot',
    parent_id: 'parentId',
    created_at: 'createdAt',
  },
};

// =============================================================================
// Version Information Endpoint
// =============================================================================

/**
 * Get API version information
 */
export function getVersionInfo(): VersionInfo {
  return {
    current: CURRENT_VERSION,
    supported: SUPPORTED_VERSIONS,
    deprecated: DEPRECATED_VERSIONS,
    latest: LATEST_VERSION,
  };
}

/**
 * Get detailed version status
 */
export function getVersionDetails(): Record<APIVersion, VersionConfig> {
  return VERSION_CONFIG;
}

// =============================================================================
// URL Rewriting
// =============================================================================

/**
 * Rewrite URL to include version prefix
 */
export function rewriteToVersionedUrl(
  pathname: string,
  version: APIVersion
): string {
  // Already versioned
  if (pathname.match(/\/api\/v\d+\//)) {
    return pathname;
  }

  // Add version prefix
  return pathname.replace('/api/', `/api/${version}/`);
}

/**
 * Strip version prefix from URL
 */
export function stripVersionPrefix(pathname: string): string {
  return pathname.replace(/\/api\/v\d+\//, '/api/');
}

// =============================================================================
// Migration Helpers
// =============================================================================

/**
 * Check if request needs migration to newer version
 */
export function needsMigration(
  requestVersion: APIVersion,
  targetVersion: APIVersion
): boolean {
  const versions = Object.keys(VERSION_CONFIG) as APIVersion[];
  const requestIndex = versions.indexOf(requestVersion);
  const targetIndex = versions.indexOf(targetVersion);
  return requestIndex < targetIndex;
}

/**
 * Log deprecation warning
 */
export function logDeprecationWarning(
  version: APIVersion,
  endpoint: string
): void {
  const config = VERSION_CONFIG[version];
  if (config.status === 'deprecated') {
    console.warn(
      `[API Deprecation] ${endpoint} called with deprecated version ${version}. ` +
        `Sunset date: ${config.sunsetDate || 'TBD'}`
    );
  }
}

// =============================================================================
// Exports
// =============================================================================

export const versioningService = {
  extractVersion,
  isValidVersion,
  isSupportedVersion,
  isDeprecatedVersion,
  addVersionHeaders,
  withVersioning,
  versionedHandler,
  transformResponse,
  getVersionInfo,
  getVersionDetails,
  rewriteToVersionedUrl,
  stripVersionPrefix,
  needsMigration,
  logDeprecationWarning,
  CURRENT_VERSION,
  LATEST_VERSION,
  SUPPORTED_VERSIONS,
  DEPRECATED_VERSIONS,
  VERSION_CONFIG,
};
