/**
 * Agent Registry Service - Unit Tests
 *
 * Epic 10: Agent Connection Layer
 * Story 10.1: Agent Registry Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistryService, type AgentRegistrationRequest } from './AgentRegistry.js';

describe('AgentRegistryService', () => {
    let registry: AgentRegistryService;

    beforeEach(() => {
        registry = new AgentRegistryService('0'.repeat(64)); // 32 bytes in hex
    });

    // ========================================================================
    // Registration Tests
    // ========================================================================

    describe('registerAgent', () => {
        it('registers a valid agent', async () => {
            const request: AgentRegistrationRequest = {
                name: 'TestWorker',
                type: 'worker',
                capabilities: ['development', 'testing'],
            };

            const result = await registry.registerAgent(request);

            expect(result.agentId).toMatch(/^agent_[a-f0-9]{24}$/);
            expect(result.structuredId).toMatch(/^\d{6}$/);
            expect(result.apiKey).toMatch(/^tb_[A-Za-z0-9_-]+$/);
            expect(result.agent.name).toBe('TestWorker');
            expect(result.agent.type).toBe('worker');
            expect(result.agent.tier).toBe(0);
            expect(result.agent.status).toBe('pending');
        });

        it('registers agent with skills', async () => {
            const request: AgentRegistrationRequest = {
                name: 'SkillfulAgent',
                type: 'researcher',
                capabilities: ['research'],
                skills: ['market-analysis', 'data-collection'],
            };

            const result = await registry.registerAgent(request);

            expect(result.agent.skills).toEqual(['market-analysis', 'data-collection']);
        });

        it('throws on empty name', async () => {
            const request: AgentRegistrationRequest = {
                name: '',
                type: 'worker',
                capabilities: ['development'],
            };

            await expect(registry.registerAgent(request)).rejects.toThrow('at least 2 characters');
        });

        it('throws on missing capabilities', async () => {
            const request: AgentRegistrationRequest = {
                name: 'NoCapAgent',
                type: 'worker',
                capabilities: [],
            };

            await expect(registry.registerAgent(request)).rejects.toThrow('capability is required');
        });

        it('sets API key expiry to 30 days', async () => {
            const request: AgentRegistrationRequest = {
                name: 'ExpiryTest',
                type: 'worker',
                capabilities: ['development'],
            };

            const result = await registry.registerAgent(request);
            const expiresAt = new Date(result.apiKeyExpiresAt);
            const now = new Date();
            const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

            expect(daysDiff).toBeGreaterThan(29);
            expect(daysDiff).toBeLessThan(31);
        });
    });

    // ========================================================================
    // Structured ID Tests
    // ========================================================================

    describe('generateStructuredId', () => {
        it('generates 6-digit structured ID', () => {
            const id = registry.generateStructuredId(0, 'worker', ['development']);
            expect(id).toMatch(/^\d{6}$/);
        });

        it('encodes tier correctly', () => {
            const id0 = registry.generateStructuredId(0, 'worker', ['development']);
            const id5 = registry.generateStructuredId(5, 'worker', ['development']);

            expect(id0[0]).toBe('0');
            expect(id5[0]).toBe('5');
        });

        it('encodes role from type', () => {
            const executor = registry.generateStructuredId(0, 'executor', ['development']);
            const planner = registry.generateStructuredId(0, 'planner', ['development']);
            const validator = registry.generateStructuredId(0, 'validator', ['development']);

            expect(executor[1]).toBe('1'); // EXECUTOR = 1
            expect(planner[1]).toBe('2'); // PLANNER = 2
            expect(validator[1]).toBe('3'); // VALIDATOR = 3
        });

        it('encodes category from capabilities', () => {
            const dev = registry.generateStructuredId(0, 'worker', ['development']);
            const research = registry.generateStructuredId(0, 'researcher', ['research']);

            // Development category = 30, Research = 10
            expect(dev.substring(2, 4)).toBe('30');
            expect(research.substring(2, 4)).toBe('10');
        });

        it('increments instance counter', () => {
            const first = registry.generateStructuredId(0, 'worker', ['development']);
            const second = registry.generateStructuredId(0, 'worker', ['development']);
            const third = registry.generateStructuredId(0, 'worker', ['development']);

            const firstInstance = parseInt(first.substring(4, 6), 10);
            const secondInstance = parseInt(second.substring(4, 6), 10);
            const thirdInstance = parseInt(third.substring(4, 6), 10);

            expect(secondInstance).toBe(firstInstance + 1);
            expect(thirdInstance).toBe(secondInstance + 1);
        });

        it('caps tier at 8', () => {
            const id = registry.generateStructuredId(99, 'worker', ['development']);
            expect(id[0]).toBe('8');
        });
    });

    describe('parseStructuredId', () => {
        it('parses valid structured ID', () => {
            const parsed = registry.parseStructuredId('013001');

            expect(parsed).toEqual({
                tier: 0,
                role: 1,
                category: 30,
                instance: 1,
            });
        });

        it('returns null for invalid ID', () => {
            expect(registry.parseStructuredId('12345')).toBeNull(); // too short
            expect(registry.parseStructuredId('1234567')).toBeNull(); // too long
            expect(registry.parseStructuredId('12345a')).toBeNull(); // non-digit
        });
    });

    // ========================================================================
    // API Key Tests
    // ========================================================================

    describe('issueAPIKey', () => {
        it('generates API key with correct prefix', () => {
            const { apiKey } = registry.issueAPIKey('agent_123');
            expect(apiKey).toMatch(/^tb_/);
        });

        it('generates unique API keys', () => {
            const { apiKey: key1 } = registry.issueAPIKey('agent_1');
            const { apiKey: key2 } = registry.issueAPIKey('agent_2');
            expect(key1).not.toBe(key2);
        });

        it('hash differs from original key', () => {
            const { apiKey, apiKeyHash } = registry.issueAPIKey('agent_123');
            expect(apiKeyHash).not.toBe(apiKey);
            expect(apiKeyHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
        });
    });

    describe('verifyAPIKey', () => {
        it('verifies valid API key after registration', async () => {
            const request: AgentRegistrationRequest = {
                name: 'VerifyTest',
                type: 'worker',
                capabilities: ['development'],
            };

            const { apiKey, agentId } = await registry.registerAgent(request);
            const result = await registry.verifyAPIKey(apiKey);

            expect(result.valid).toBe(true);
            expect(result.agentId).toBe(agentId);
            expect(result.permissions).toContain('agent:read');
        });

        it('rejects unknown API key', async () => {
            const result = await registry.verifyAPIKey('tb_unknown_key_here');
            expect(result.valid).toBe(false);
        });
    });

    describe('revokeAPIKey', () => {
        it('revokes existing API key', async () => {
            const request: AgentRegistrationRequest = {
                name: 'RevokeTest',
                type: 'worker',
                capabilities: ['development'],
            };

            const { apiKey } = await registry.registerAgent(request);

            // Verify key works
            const beforeRevoke = await registry.verifyAPIKey(apiKey);
            expect(beforeRevoke.valid).toBe(true);

            // Revoke
            const revoked = await registry.revokeAPIKey(apiKey);
            expect(revoked).toBe(true);

            // Verify key no longer works
            const afterRevoke = await registry.verifyAPIKey(apiKey);
            expect(afterRevoke.valid).toBe(false);
            expect(afterRevoke.revoked).toBe(true);
        });

        it('returns false for unknown key', async () => {
            const revoked = await registry.revokeAPIKey('tb_unknown');
            expect(revoked).toBe(false);
        });
    });

    // ========================================================================
    // Agent Type Mapping Tests
    // ========================================================================

    describe('agent type to role mapping', () => {
        const testCases = [
            { type: 'worker', expectedRole: '1' },
            { type: 'executor', expectedRole: '1' },
            { type: 'planner', expectedRole: '2' },
            { type: 'validator', expectedRole: '3' },
            { type: 'researcher', expectedRole: '4' },
            { type: 'communicator', expectedRole: '5' },
            { type: 'orchestrator', expectedRole: '6' },
        ];

        testCases.forEach(({ type, expectedRole }) => {
            it(`maps ${type} to role ${expectedRole}`, () => {
                const id = registry.generateStructuredId(0, type, ['development']);
                expect(id[1]).toBe(expectedRole);
            });
        });
    });

    // ========================================================================
    // Capability to Category Mapping Tests
    // ========================================================================

    describe('capability to category mapping', () => {
        const testCases = [
            { capability: 'research', expectedCategory: '10' },
            { capability: 'content', expectedCategory: '20' },
            { capability: 'development', expectedCategory: '30' },
            { capability: 'frontend', expectedCategory: '31' },
            { capability: 'backend', expectedCategory: '32' },
            { capability: 'social', expectedCategory: '40' },
            { capability: 'sales', expectedCategory: '50' },
            { capability: 'support', expectedCategory: '60' },
            { capability: 'operations', expectedCategory: '70' },
            { capability: 'analytics', expectedCategory: '80' },
        ];

        testCases.forEach(({ capability, expectedCategory }) => {
            it(`maps ${capability} to category ${expectedCategory}`, () => {
                const id = registry.generateStructuredId(0, 'worker', [capability]);
                expect(id.substring(2, 4)).toBe(expectedCategory);
            });
        });
    });
});
