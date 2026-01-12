/**
 * Role-Based Access Control (RBAC) - Permission enforcement
 */

import {
  UserRole,
  AgentStatus,
  Permission,
  RolePermissions,
  ROLE_PERMISSIONS,
} from './types';

// =============================================================================
// Permission Checking
// =============================================================================

export interface PermissionContext {
  userId: string;
  userRole: UserRole;
  resourceOwnerId?: string;
  agentStatus?: AgentStatus;
  additionalConditions?: Record<string, unknown>;
}

export interface PermissionResult {
  allowed: boolean;
  reason: string;
  matchedPermission?: Permission;
}

export function checkPermission(
  action: string,
  resource: string,
  context: PermissionContext
): PermissionResult {
  const rolePermissions = ROLE_PERMISSIONS.find(rp => rp.role === context.userRole);

  if (!rolePermissions) {
    return { allowed: false, reason: `Unknown role: ${context.userRole}` };
  }

  // Check for matching permission
  for (const permission of rolePermissions.permissions) {
    if (matchesPermission(permission, action, resource, context)) {
      return {
        allowed: true,
        reason: 'Permission granted',
        matchedPermission: permission,
      };
    }
  }

  return {
    allowed: false,
    reason: `No permission for ${action} on ${resource}`,
  };
}

function matchesPermission(
  permission: Permission,
  action: string,
  resource: string,
  context: PermissionContext
): boolean {
  // Wildcard permissions
  if (permission.action === '*' && permission.resource === '*') {
    return true;
  }

  // Check action match
  if (permission.action !== '*' && permission.action !== action) {
    return false;
  }

  // Check resource match
  if (permission.resource !== '*' && permission.resource !== resource) {
    return false;
  }

  // Check conditions
  if (permission.conditions) {
    return checkConditions(permission.conditions, context);
  }

  return true;
}

function checkConditions(
  conditions: Record<string, unknown>,
  context: PermissionContext
): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    switch (key) {
      case 'owned':
        // Check if user owns the resource
        if (value === true && context.resourceOwnerId !== context.userId) {
          return false;
        }
        break;

      case 'status':
        // Check agent status
        if (context.agentStatus && context.agentStatus !== value) {
          return false;
        }
        break;

      default:
        // Check additional conditions
        if (context.additionalConditions?.[key] !== value) {
          return false;
        }
    }
  }

  return true;
}

// =============================================================================
// Role Utilities
// =============================================================================

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS.find(rp => rp.role === role)?.permissions || [];
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  // Role hierarchy: admin > both > trainer/consumer
  if (userRole === 'admin') return true;
  if (userRole === requiredRole) return true;
  if (userRole === 'both' && (requiredRole === 'trainer' || requiredRole === 'consumer')) {
    return true;
  }
  return false;
}

export function canPerformAction(
  userRole: UserRole,
  action: string,
  resource: string
): boolean {
  const result = checkPermission(action, resource, {
    userId: '',
    userRole,
  });
  return result.allowed;
}

// =============================================================================
// Agent Status Transitions
// =============================================================================

const VALID_STATUS_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  draft: ['training'],
  training: ['examination', 'draft'], // Can go back to draft or proceed to examination
  examination: ['active', 'training'], // Pass to active, fail back to training
  active: ['suspended', 'retired'],
  suspended: ['active', 'retired'],
  retired: [], // Terminal state
};

export function canTransitionStatus(
  current: AgentStatus,
  target: AgentStatus,
  userRole: UserRole
): { allowed: boolean; reason: string } {
  // Admin can do anything
  if (userRole === 'admin') {
    return { allowed: true, reason: 'Admin override' };
  }

  // Check valid transitions
  const validTargets = VALID_STATUS_TRANSITIONS[current];
  if (!validTargets.includes(target)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${current} to ${target}`,
    };
  }

  // Role-specific restrictions - non-admins can't directly activate
  // (admin case already returned above)
  if (target === 'active') {
    return {
      allowed: false,
      reason: 'Only council/admin can activate agents',
    };
  }

  return { allowed: true, reason: 'Transition allowed' };
}

// =============================================================================
// Resource Access Control
// =============================================================================

export interface ResourceAccess {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExecute: boolean;
}

export function getResourceAccess(
  resource: string,
  context: PermissionContext
): ResourceAccess {
  return {
    canView: checkPermission('read', resource, context).allowed,
    canEdit: checkPermission('update', resource, context).allowed,
    canDelete: checkPermission('delete', resource, context).allowed,
    canExecute: checkPermission('use', resource, context).allowed,
  };
}

// =============================================================================
// API Middleware Helper
// =============================================================================

export interface AuthContext {
  userId: string;
  userRole: UserRole;
  sessionId?: string;
}

export function createAuthMiddleware(requiredPermissions: Array<{ action: string; resource: string }>) {
  return (context: AuthContext, resourceOwnerId?: string): PermissionResult => {
    for (const { action, resource } of requiredPermissions) {
      const result = checkPermission(action, resource, {
        ...context,
        resourceOwnerId,
      });

      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true, reason: 'All permissions granted' };
  };
}

// =============================================================================
// Role-based UI Visibility
// =============================================================================

export interface UIVisibility {
  showTrainerFeatures: boolean;
  showConsumerFeatures: boolean;
  showAdminFeatures: boolean;
  showAcademy: boolean;
  showMarketplace: boolean;
  showAgentCreation: boolean;
  showCouncil: boolean;
}

export function getUIVisibility(role: UserRole): UIVisibility {
  return {
    showTrainerFeatures: hasRole(role, 'trainer'),
    showConsumerFeatures: hasRole(role, 'consumer'),
    showAdminFeatures: role === 'admin',
    showAcademy: hasRole(role, 'trainer'),
    showMarketplace: true, // Everyone can view
    showAgentCreation: hasRole(role, 'trainer'),
    showCouncil: role === 'admin', // Only admins for now
  };
}

// =============================================================================
// Audit Trail for Permission Checks
// =============================================================================

export interface PermissionAuditEntry {
  timestamp: Date;
  userId: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  allowed: boolean;
  reason: string;
}

export function createPermissionAuditEntry(
  context: PermissionContext,
  action: string,
  resource: string,
  result: PermissionResult,
  resourceId?: string
): PermissionAuditEntry {
  return {
    timestamp: new Date(),
    userId: context.userId,
    userRole: context.userRole,
    action,
    resource,
    resourceId,
    allowed: result.allowed,
    reason: result.reason,
  };
}
