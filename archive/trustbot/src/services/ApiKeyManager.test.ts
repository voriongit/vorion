/**
 * API Key Manager - Unit Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.4: Agent Authentication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiKeyManager } from './ApiKeyManager.js';

// Mock Supabase
vi.mock('../core/SupabasePersistence.js', () => ({
    hasSupabaseConfig: () => false,
    getSupabasePersistence: () => ({}),
}));

describe('ApiKeyManager', () => {
    let manager: ApiKeyManager;

    beforeEach(() => {
        manager = new ApiKeyManager({
            defaultExpiryDays: 30,
            rotationGracePeriodMs: 1000, // 1 second for faster tests
            maxKeysPerAgent: 3,
        });
    });

    afterEach(() => {
        manager.clear();
    });

    // ========================================================================
    // Key Creation Tests
    // ========================================================================

    describe('createKey', () => {
        it('creates a valid API key', async () => {
            const result = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            expect(result.id).toMatch(/^key_[a-f0-9]{16}$/);
            expect(result.key).toMatch(/^tb_/);
            expect(result.keyPrefix).toMatch(/^tb_.+\.\.\.$/);
            expect(result.expiresAt).toBeInstanceOf(Date);
        });

        it('creates key with custom permissions', async () => {
            const result = await manager.createKey({
                agentId: 'agent_123',
                name: 'Custom Key',
                permissions: ['custom:read', 'custom:write'],
            });

            const verification = await manager.verifyKey(result.key);
            expect(verification.permissions).toContain('custom:read');
            expect(verification.permissions).toContain('custom:write');
        });

        it('creates key with custom expiry', async () => {
            const result = await manager.createKey({
                agentId: 'agent_123',
                name: 'Short Expiry',
                expiresInDays: 7,
            });

            const now = new Date();
            const expectedExpiry = new Date(now);
            expectedExpiry.setDate(expectedExpiry.getDate() + 7);

            // Should expire within 7 days (+/- 1 second for test timing)
            const diff = Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime());
            expect(diff).toBeLessThan(2000);
        });

        it('enforces max keys per agent', async () => {
            // Create max keys
            await manager.createKey({ agentId: 'agent_123', name: 'Key 1' });
            await manager.createKey({ agentId: 'agent_123', name: 'Key 2' });
            await manager.createKey({ agentId: 'agent_123', name: 'Key 3' });

            // Fourth should fail
            await expect(
                manager.createKey({ agentId: 'agent_123', name: 'Key 4' })
            ).rejects.toThrow('Maximum keys');
        });

        it('emits key:created event', async () => {
            const handler = vi.fn();
            manager.on('key:created', handler);

            const result = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            expect(handler).toHaveBeenCalledWith(result.id, 'agent_123');
        });
    });

    // ========================================================================
    // Key Verification Tests
    // ========================================================================

    describe('verifyKey', () => {
        it('verifies valid key', async () => {
            const { key } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            const result = await manager.verifyKey(key);

            expect(result.valid).toBe(true);
            expect(result.agentId).toBe('agent_123');
            expect(result.permissions).toBeDefined();
        });

        it('rejects invalid key', async () => {
            const result = await manager.verifyKey('invalid_key_here');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Key not found');
        });

        it('rejects expired key', async () => {
            // Create key that expires immediately
            const { key } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Expired Key',
                expiresInDays: -1, // Already expired
            });

            const result = await manager.verifyKey(key);

            expect(result.valid).toBe(false);
            expect(result.expired).toBe(true);
        });

        it('rejects revoked key', async () => {
            const { key } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Revoked Key',
            });

            await manager.revokeKey(key, 'Test revocation');

            const result = await manager.verifyKey(key);

            expect(result.valid).toBe(false);
            expect(result.revoked).toBe(true);
        });

        it('tracks key usage', async () => {
            const { key, id } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Usage Test',
            });

            await manager.verifyKey(key);
            await manager.verifyKey(key);
            await manager.verifyKey(key);

            const keyInfo = manager.getKeyById(id);
            expect(keyInfo?.usageCount).toBe(3);
            expect(keyInfo?.lastUsedAt).toBeInstanceOf(Date);
        });

        it('emits key:used event', async () => {
            const handler = vi.fn();
            manager.on('key:used', handler);

            const { key, id } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            await manager.verifyKey(key);

            expect(handler).toHaveBeenCalledWith(id, 'agent_123');
        });
    });

    // ========================================================================
    // Key Rotation Tests
    // ========================================================================

    describe('rotateKey', () => {
        it('creates new key on rotation', async () => {
            const { key: oldKey } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Original Key',
            });

            const result = await manager.rotateKey(oldKey);

            expect(result.newKey.id).toBeDefined();
            expect(result.newKey.key).not.toBe(oldKey);
            expect(result.gracePeriodMs).toBe(1000);
        });

        it('old key works during grace period', async () => {
            const { key: oldKey } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Original Key',
            });

            await manager.rotateKey(oldKey);

            // Old key should still work
            const verification = await manager.verifyKey(oldKey);
            expect(verification.valid).toBe(true);
        });

        it('new key works immediately', async () => {
            const { key: oldKey } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Original Key',
            });

            const result = await manager.rotateKey(oldKey);

            const verification = await manager.verifyKey(result.newKey.key);
            expect(verification.valid).toBe(true);
        });

        it('throws on non-existent key', async () => {
            await expect(
                manager.rotateKey('non_existent_key')
            ).rejects.toThrow('Key not found');
        });

        it('throws on revoked key', async () => {
            const { key } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            await manager.revokeKey(key);

            await expect(
                manager.rotateKey(key)
            ).rejects.toThrow('Cannot rotate revoked key');
        });

        it('emits key:rotated event', async () => {
            const handler = vi.fn();
            manager.on('key:rotated', handler);

            const { key, id: oldId } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Original Key',
            });

            const result = await manager.rotateKey(key);

            expect(handler).toHaveBeenCalledWith(oldId, result.newKey.id, 'agent_123');
        });
    });

    // ========================================================================
    // Key Revocation Tests
    // ========================================================================

    describe('revokeKey', () => {
        it('revokes existing key', async () => {
            const { key } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            const result = await manager.revokeKey(key, 'Test reason');

            expect(result).toBe(true);
        });

        it('returns false for non-existent key', async () => {
            const result = await manager.revokeKey('non_existent');
            expect(result).toBe(false);
        });

        it('immediate revocation effect', async () => {
            const { key } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            // Verify works before
            expect((await manager.verifyKey(key)).valid).toBe(true);

            // Revoke
            await manager.revokeKey(key);

            // Verify fails immediately
            expect((await manager.verifyKey(key)).valid).toBe(false);
            expect((await manager.verifyKey(key)).revoked).toBe(true);
        });

        it('emits key:revoked event', async () => {
            const handler = vi.fn();
            manager.on('key:revoked', handler);

            const { key, id } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Test Key',
            });

            await manager.revokeKey(key, 'Test reason');

            expect(handler).toHaveBeenCalledWith(id, 'agent_123', 'Test reason');
        });
    });

    describe('revokeAllAgentKeys', () => {
        it('revokes all keys for agent', async () => {
            await manager.createKey({ agentId: 'agent_123', name: 'Key 1' });
            await manager.createKey({ agentId: 'agent_123', name: 'Key 2' });
            await manager.createKey({ agentId: 'agent_456', name: 'Other Agent' });

            const revoked = await manager.revokeAllAgentKeys('agent_123');

            expect(revoked).toBe(2);
            expect(manager.hasValidKeys('agent_123')).toBe(false);
            expect(manager.hasValidKeys('agent_456')).toBe(true);
        });
    });

    // ========================================================================
    // Query Tests
    // ========================================================================

    describe('Queries', () => {
        it('getAgentKeys returns active keys', async () => {
            await manager.createKey({ agentId: 'agent_123', name: 'Key 1' });
            await manager.createKey({ agentId: 'agent_123', name: 'Key 2' });

            const keys = manager.getAgentKeys('agent_123');

            expect(keys.length).toBe(2);
        });

        it('getAgentKeys excludes revoked keys', async () => {
            const { key: key1 } = await manager.createKey({ agentId: 'agent_123', name: 'Key 1' });
            await manager.createKey({ agentId: 'agent_123', name: 'Key 2' });

            await manager.revokeKey(key1);

            const keys = manager.getAgentKeys('agent_123');

            expect(keys.length).toBe(1);
        });

        it('getKeyById returns correct key', async () => {
            const { id } = await manager.createKey({
                agentId: 'agent_123',
                name: 'Find Me',
            });

            const key = manager.getKeyById(id);

            expect(key?.name).toBe('Find Me');
        });

        it('hasValidKeys returns correct status', async () => {
            expect(manager.hasValidKeys('agent_123')).toBe(false);

            await manager.createKey({ agentId: 'agent_123', name: 'Key 1' });

            expect(manager.hasValidKeys('agent_123')).toBe(true);
        });

        it('getStats returns correct counts', async () => {
            await manager.createKey({ agentId: 'agent_123', name: 'Active 1' });
            await manager.createKey({ agentId: 'agent_123', name: 'Active 2' });
            const { key: toRevoke } = await manager.createKey({ agentId: 'agent_456', name: 'To Revoke' });
            await manager.revokeKey(toRevoke);

            const stats = manager.getStats();

            expect(stats.totalKeys).toBe(3);
            expect(stats.activeKeys).toBe(2);
            expect(stats.revokedKeys).toBe(1);
        });
    });

    // ========================================================================
    // Utility Tests
    // ========================================================================

    describe('Utilities', () => {
        it('hashKey produces consistent hash', () => {
            const hash1 = manager.hashKey('test_key');
            const hash2 = manager.hashKey('test_key');

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        });

        it('hashKey produces different hashes for different keys', () => {
            const hash1 = manager.hashKey('key_1');
            const hash2 = manager.hashKey('key_2');

            expect(hash1).not.toBe(hash2);
        });

        it('getKeyPrefix returns masked key', () => {
            const prefix = manager.getKeyPrefix('tb_abcdefghijklmnop');

            expect(prefix).toBe('tb_abcdefg...');
        });

        it('cleanupExpiredKeys removes old keys', async () => {
            // Create already expired key
            await manager.createKey({
                agentId: 'agent_123',
                name: 'Expired',
                expiresInDays: -1,
            });
            await manager.createKey({
                agentId: 'agent_123',
                name: 'Valid',
            });

            const cleaned = await manager.cleanupExpiredKeys();

            expect(cleaned).toBe(1);
            expect(manager.getAgentKeys('agent_123').length).toBe(1);
        });
    });
});
