/**
 * Authorization Module Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasAnyRole,
  hasAllRoles,
  POLICY_ROLES,
  createForbiddenResponse,
  type AuthorizationResult,
} from '../../../src/common/authorization.js';

describe('Authorization Module', () => {
  describe('hasAnyRole', () => {
    it('should return allowed when user has one of the required roles', () => {
      const result = hasAnyRole(['admin', 'user'], ['admin', 'superadmin']);

      expect(result.allowed).toBe(true);
      expect(result.matchedRoles).toEqual(['admin']);
    });

    it('should return allowed when user has multiple matching roles', () => {
      const result = hasAnyRole(['admin', 'policy_writer'], POLICY_ROLES.WRITE);

      expect(result.allowed).toBe(true);
      expect(result.matchedRoles).toContain('admin');
      expect(result.matchedRoles).toContain('policy_writer');
    });

    it('should return not allowed when user has no matching roles', () => {
      const result = hasAnyRole(['viewer', 'guest'], ['admin', 'policy_writer']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Required roles:');
      expect(result.reason).toContain('User roles:');
    });

    it('should return not allowed when user has no roles', () => {
      const result = hasAnyRole([], ['admin']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No roles found in token');
    });

    it('should return not allowed when user roles is undefined', () => {
      const result = hasAnyRole(undefined, ['admin']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No roles found in token');
    });

    it('should handle policy_reader role for READ access', () => {
      const result = hasAnyRole(['policy_reader'], POLICY_ROLES.READ);

      expect(result.allowed).toBe(true);
      expect(result.matchedRoles).toEqual(['policy_reader']);
    });

    it('should handle policy_writer role for WRITE access', () => {
      const result = hasAnyRole(['policy_writer'], POLICY_ROLES.WRITE);

      expect(result.allowed).toBe(true);
      expect(result.matchedRoles).toEqual(['policy_writer']);
    });

    it('should deny policy_reader for WRITE access', () => {
      const result = hasAnyRole(['policy_reader'], POLICY_ROLES.WRITE);

      expect(result.allowed).toBe(false);
    });

    it('should deny policy_writer for DELETE access', () => {
      const result = hasAnyRole(['policy_writer'], POLICY_ROLES.DELETE);

      expect(result.allowed).toBe(false);
    });

    it('should allow admin for all policy operations', () => {
      const readResult = hasAnyRole(['admin'], POLICY_ROLES.READ);
      const writeResult = hasAnyRole(['admin'], POLICY_ROLES.WRITE);
      const deleteResult = hasAnyRole(['admin'], POLICY_ROLES.DELETE);

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(true);
      expect(deleteResult.allowed).toBe(true);
    });

    it('should allow tenant:admin for all policy operations', () => {
      const readResult = hasAnyRole(['tenant:admin'], POLICY_ROLES.READ);
      const writeResult = hasAnyRole(['tenant:admin'], POLICY_ROLES.WRITE);
      const deleteResult = hasAnyRole(['tenant:admin'], POLICY_ROLES.DELETE);

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(true);
      expect(deleteResult.allowed).toBe(true);
    });

    it('should allow policy:admin for all policy operations', () => {
      const readResult = hasAnyRole(['policy:admin'], POLICY_ROLES.READ);
      const writeResult = hasAnyRole(['policy:admin'], POLICY_ROLES.WRITE);
      const deleteResult = hasAnyRole(['policy:admin'], POLICY_ROLES.DELETE);

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(true);
      expect(deleteResult.allowed).toBe(true);
    });
  });

  describe('hasAllRoles', () => {
    it('should return allowed when user has all required roles', () => {
      const result = hasAllRoles(['admin', 'policy_writer', 'user'], ['admin', 'policy_writer']);

      expect(result.allowed).toBe(true);
      expect(result.matchedRoles).toEqual(['admin', 'policy_writer']);
    });

    it('should return not allowed when user is missing a required role', () => {
      const result = hasAllRoles(['admin', 'user'], ['admin', 'policy_writer']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing required roles: policy_writer');
    });

    it('should return not allowed when user has no roles', () => {
      const result = hasAllRoles([], ['admin']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No roles found in token');
    });

    it('should return not allowed when user roles is undefined', () => {
      const result = hasAllRoles(undefined, ['admin']);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No roles found in token');
    });
  });

  describe('POLICY_ROLES', () => {
    it('should define READ roles correctly', () => {
      expect(POLICY_ROLES.READ).toContain('admin');
      expect(POLICY_ROLES.READ).toContain('tenant:admin');
      expect(POLICY_ROLES.READ).toContain('policy:admin');
      expect(POLICY_ROLES.READ).toContain('policy_reader');
      expect(POLICY_ROLES.READ).toContain('policy_writer');
    });

    it('should define WRITE roles correctly', () => {
      expect(POLICY_ROLES.WRITE).toContain('admin');
      expect(POLICY_ROLES.WRITE).toContain('tenant:admin');
      expect(POLICY_ROLES.WRITE).toContain('policy:admin');
      expect(POLICY_ROLES.WRITE).toContain('policy_writer');
      expect(POLICY_ROLES.WRITE).not.toContain('policy_reader');
    });

    it('should define DELETE roles correctly', () => {
      expect(POLICY_ROLES.DELETE).toContain('admin');
      expect(POLICY_ROLES.DELETE).toContain('tenant:admin');
      expect(POLICY_ROLES.DELETE).toContain('policy:admin');
      expect(POLICY_ROLES.DELETE).not.toContain('policy_writer');
      expect(POLICY_ROLES.DELETE).not.toContain('policy_reader');
    });
  });

  describe('createForbiddenResponse', () => {
    it('should create standard 403 response', () => {
      const response = createForbiddenResponse('Access denied');

      expect(response.error.code).toBe('FORBIDDEN');
      expect(response.error.message).toBe('Access denied');
    });

    it('should include required roles when provided', () => {
      const response = createForbiddenResponse('Access denied', ['admin', 'policy_writer']);

      expect(response.error.requiredRoles).toEqual(['admin', 'policy_writer']);
    });

    it('should not include requiredRoles when not provided', () => {
      const response = createForbiddenResponse('Access denied');

      expect(response.error.requiredRoles).toBeUndefined();
    });
  });

  describe('Role hierarchy tests', () => {
    it('policy_reader should have READ access only', () => {
      const roles = ['policy_reader'];

      expect(hasAnyRole(roles, POLICY_ROLES.READ).allowed).toBe(true);
      expect(hasAnyRole(roles, POLICY_ROLES.WRITE).allowed).toBe(false);
      expect(hasAnyRole(roles, POLICY_ROLES.DELETE).allowed).toBe(false);
    });

    it('policy_writer should have READ and WRITE access', () => {
      const roles = ['policy_writer'];

      expect(hasAnyRole(roles, POLICY_ROLES.READ).allowed).toBe(true);
      expect(hasAnyRole(roles, POLICY_ROLES.WRITE).allowed).toBe(true);
      expect(hasAnyRole(roles, POLICY_ROLES.DELETE).allowed).toBe(false);
    });

    it('admin should have full access', () => {
      const roles = ['admin'];

      expect(hasAnyRole(roles, POLICY_ROLES.READ).allowed).toBe(true);
      expect(hasAnyRole(roles, POLICY_ROLES.WRITE).allowed).toBe(true);
      expect(hasAnyRole(roles, POLICY_ROLES.DELETE).allowed).toBe(true);
    });

    it('user without policy roles should have no policy access', () => {
      const roles = ['user', 'viewer'];

      expect(hasAnyRole(roles, POLICY_ROLES.READ).allowed).toBe(false);
      expect(hasAnyRole(roles, POLICY_ROLES.WRITE).allowed).toBe(false);
      expect(hasAnyRole(roles, POLICY_ROLES.DELETE).allowed).toBe(false);
    });
  });
});
