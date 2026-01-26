/**
 * Phase 6 Multi-Tenancy Support
 *
 * Organization-based data isolation and tenant management
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Types
// =============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  settings: OrganizationSettings;
  limits: OrganizationLimits;
  createdAt: Date;
  updatedAt: Date;
  status: OrganizationStatus;
}

export type OrganizationPlan = 'free' | 'starter' | 'professional' | 'enterprise';
export type OrganizationStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export interface OrganizationSettings {
  allowedDomains?: string[];
  ssoEnabled?: boolean;
  ssoProvider?: string;
  defaultTrustTier?: string;
  webhooksEnabled?: boolean;
  auditRetentionDays?: number;
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    appName?: string;
  };
}

export interface OrganizationLimits {
  maxAgents: number;
  maxRoleGates: number;
  maxWebhooks: number;
  maxApiKeys: number;
  apiCallsPerHour: number;
  provenanceRetentionDays: number;
  maxTeamMembers: number;
}

export interface TenantContext {
  organizationId: string;
  organization?: Organization;
  userId?: string;
  userRole?: TenantUserRole;
  permissions: TenantPermission[];
}

export type TenantUserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type TenantPermission =
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
  | 'settings:read'
  | 'settings:write'
  | 'members:read'
  | 'members:write'
  | 'billing:read'
  | 'billing:write';

// =============================================================================
// Plan Limits Configuration
// =============================================================================

const PLAN_LIMITS: Record<OrganizationPlan, OrganizationLimits> = {
  free: {
    maxAgents: 10,
    maxRoleGates: 5,
    maxWebhooks: 1,
    maxApiKeys: 2,
    apiCallsPerHour: 1000,
    provenanceRetentionDays: 7,
    maxTeamMembers: 3,
  },
  starter: {
    maxAgents: 50,
    maxRoleGates: 20,
    maxWebhooks: 5,
    maxApiKeys: 10,
    apiCallsPerHour: 10000,
    provenanceRetentionDays: 30,
    maxTeamMembers: 10,
  },
  professional: {
    maxAgents: 500,
    maxRoleGates: 100,
    maxWebhooks: 20,
    maxApiKeys: 50,
    apiCallsPerHour: 100000,
    provenanceRetentionDays: 90,
    maxTeamMembers: 50,
  },
  enterprise: {
    maxAgents: -1, // unlimited
    maxRoleGates: -1,
    maxWebhooks: -1,
    maxApiKeys: -1,
    apiCallsPerHour: -1,
    provenanceRetentionDays: 365,
    maxTeamMembers: -1,
  },
};

const ROLE_PERMISSIONS: Record<TenantUserRole, TenantPermission[]> = {
  owner: [
    'role_gates:read',
    'role_gates:write',
    'role_gates:delete',
    'ceiling:read',
    'ceiling:write',
    'provenance:read',
    'provenance:export',
    'alerts:read',
    'alerts:manage',
    'webhooks:read',
    'webhooks:write',
    'presets:read',
    'presets:write',
    'presets:apply',
    'audit:read',
    'audit:export',
    'settings:read',
    'settings:write',
    'members:read',
    'members:write',
    'billing:read',
    'billing:write',
  ],
  admin: [
    'role_gates:read',
    'role_gates:write',
    'role_gates:delete',
    'ceiling:read',
    'ceiling:write',
    'provenance:read',
    'provenance:export',
    'alerts:read',
    'alerts:manage',
    'webhooks:read',
    'webhooks:write',
    'presets:read',
    'presets:write',
    'presets:apply',
    'audit:read',
    'audit:export',
    'settings:read',
    'settings:write',
    'members:read',
    'members:write',
  ],
  member: [
    'role_gates:read',
    'role_gates:write',
    'ceiling:read',
    'ceiling:write',
    'provenance:read',
    'alerts:read',
    'alerts:manage',
    'webhooks:read',
    'presets:read',
    'presets:apply',
    'audit:read',
  ],
  viewer: [
    'role_gates:read',
    'ceiling:read',
    'provenance:read',
    'alerts:read',
    'webhooks:read',
    'presets:read',
    'audit:read',
  ],
};

// =============================================================================
// In-Memory Store (replace with database in production)
// =============================================================================

const organizationsStore = new Map<string, Organization>();

// Initialize with a default organization
organizationsStore.set('default', {
  id: 'default',
  name: 'Default Organization',
  slug: 'default',
  plan: 'professional',
  settings: {},
  limits: PLAN_LIMITS.professional,
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'active',
});

// =============================================================================
// Organization Management
// =============================================================================

/**
 * Create a new organization
 */
export function createOrganization(
  name: string,
  plan: OrganizationPlan = 'free',
  options: { slug?: string; settings?: Partial<OrganizationSettings> } = {}
): Organization {
  const id = crypto.randomUUID();
  const slug =
    options.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const organization: Organization = {
    id,
    name,
    slug,
    plan,
    settings: options.settings || {},
    limits: PLAN_LIMITS[plan],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
  };

  organizationsStore.set(id, organization);
  return organization;
}

/**
 * Get organization by ID
 */
export function getOrganization(id: string): Organization | undefined {
  return organizationsStore.get(id);
}

/**
 * Get organization by slug
 */
export function getOrganizationBySlug(slug: string): Organization | undefined {
  return Array.from(organizationsStore.values()).find((o) => o.slug === slug);
}

/**
 * Update organization
 */
export function updateOrganization(
  id: string,
  updates: Partial<Pick<Organization, 'name' | 'settings' | 'plan' | 'status'>>
): Organization | undefined {
  const org = organizationsStore.get(id);
  if (!org) return undefined;

  const updated: Organization = {
    ...org,
    ...updates,
    limits: updates.plan ? PLAN_LIMITS[updates.plan] : org.limits,
    updatedAt: new Date(),
  };

  organizationsStore.set(id, updated);
  return updated;
}

/**
 * List all organizations
 */
export function listOrganizations(): Organization[] {
  return Array.from(organizationsStore.values()).filter(
    (o) => o.status !== 'deleted'
  );
}

/**
 * Delete organization (soft delete)
 */
export function deleteOrganization(id: string): boolean {
  const org = organizationsStore.get(id);
  if (!org) return false;

  org.status = 'deleted';
  org.updatedAt = new Date();
  organizationsStore.set(id, org);
  return true;
}

// =============================================================================
// Tenant Context
// =============================================================================

/**
 * Create tenant context from request
 */
export function createTenantContext(
  request: NextRequest
): TenantContext | null {
  const organizationId =
    request.headers.get('x-organization-id') ||
    request.nextUrl.searchParams.get('organizationId') ||
    'default';

  const organization = getOrganization(organizationId);
  if (!organization || organization.status !== 'active') {
    return null;
  }

  const userId = request.headers.get('x-user-id') || undefined;
  const userRole =
    (request.headers.get('x-user-role') as TenantUserRole) || 'viewer';
  const permissions = ROLE_PERMISSIONS[userRole] || [];

  return {
    organizationId,
    organization,
    userId,
    userRole,
    permissions,
  };
}

/**
 * Check if tenant has permission
 */
export function hasPermission(
  context: TenantContext,
  permission: TenantPermission
): boolean {
  return context.permissions.includes(permission);
}

/**
 * Check if tenant has any of the permissions
 */
export function hasAnyPermission(
  context: TenantContext,
  permissions: TenantPermission[]
): boolean {
  return permissions.some((p) => context.permissions.includes(p));
}

/**
 * Check if tenant has all permissions
 */
export function hasAllPermissions(
  context: TenantContext,
  permissions: TenantPermission[]
): boolean {
  return permissions.every((p) => context.permissions.includes(p));
}

// =============================================================================
// Limit Checking
// =============================================================================

/**
 * Check if organization is within limits
 */
export function checkLimit(
  organization: Organization,
  limitType: keyof OrganizationLimits,
  currentCount: number
): { allowed: boolean; limit: number; current: number; remaining: number } {
  const limit = organization.limits[limitType];

  // -1 means unlimited
  if (limit === -1) {
    return {
      allowed: true,
      limit: -1,
      current: currentCount,
      remaining: -1,
    };
  }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: Math.max(0, limit - currentCount),
  };
}

/**
 * Get all limits status for an organization
 */
export function getLimitsStatus(
  organization: Organization,
  currentUsage: Partial<Record<keyof OrganizationLimits, number>>
): Record<
  keyof OrganizationLimits,
  { limit: number; current: number; percentage: number }
> {
  const status = {} as Record<
    keyof OrganizationLimits,
    { limit: number; current: number; percentage: number }
  >;

  for (const [key, limit] of Object.entries(organization.limits)) {
    const current = currentUsage[key as keyof OrganizationLimits] || 0;
    status[key as keyof OrganizationLimits] = {
      limit,
      current,
      percentage: limit === -1 ? 0 : Math.round((current / limit) * 100),
    };
  }

  return status;
}

// =============================================================================
// Middleware
// =============================================================================

/**
 * Tenant isolation middleware
 */
export function withTenantContext<T>(
  handler: (
    request: NextRequest,
    context: TenantContext
  ) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T>> {
  return async (request: NextRequest) => {
    const tenantContext = createTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        {
          error: {
            code: 'P6_INVALID_ORGANIZATION',
            message: 'Invalid or inactive organization',
          },
        },
        { status: 403 }
      ) as NextResponse<T>;
    }

    return handler(request, tenantContext);
  };
}

/**
 * Permission check middleware
 */
export function requirePermission<T>(
  permission: TenantPermission,
  handler: (
    request: NextRequest,
    context: TenantContext
  ) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T>> {
  return withTenantContext(async (request, context) => {
    if (!hasPermission(context, permission)) {
      return NextResponse.json(
        {
          error: {
            code: 'P6_PERMISSION_DENIED',
            message: `Missing required permission: ${permission}`,
          },
        },
        { status: 403 }
      ) as NextResponse<T>;
    }

    return handler(request, context);
  });
}

/**
 * Limit check middleware
 */
export function checkResourceLimit<T>(
  limitType: keyof OrganizationLimits,
  getCurrentCount: (context: TenantContext) => Promise<number>,
  handler: (
    request: NextRequest,
    context: TenantContext
  ) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T>> {
  return withTenantContext(async (request, context) => {
    const currentCount = await getCurrentCount(context);
    const limitCheck = checkLimit(context.organization!, limitType, currentCount);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'P6_LIMIT_EXCEEDED',
            message: `Organization limit exceeded for ${limitType}`,
            details: {
              limit: limitCheck.limit,
              current: limitCheck.current,
            },
          },
        },
        { status: 429 }
      ) as NextResponse<T>;
    }

    return handler(request, context);
  });
}

// =============================================================================
// Data Isolation Helpers
// =============================================================================

/**
 * Add organization filter to query
 */
export function withOrganizationFilter<T extends Record<string, unknown>>(
  query: T,
  organizationId: string
): T & { organizationId: string } {
  return {
    ...query,
    organizationId,
  };
}

/**
 * Validate resource belongs to organization
 */
export function validateResourceOwnership(
  resource: { organizationId?: string } | null | undefined,
  organizationId: string
): boolean {
  if (!resource) return false;
  return resource.organizationId === organizationId;
}

// =============================================================================
// Exports
// =============================================================================

export const tenancyService = {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  updateOrganization,
  listOrganizations,
  deleteOrganization,
  createTenantContext,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  checkLimit,
  getLimitsStatus,
  withTenantContext,
  requirePermission,
  checkResourceLimit,
  withOrganizationFilter,
  validateResourceOwnership,
  PLAN_LIMITS,
  ROLE_PERMISSIONS,
};
