/**
 * Agent Registry Service
 *
 * Epic 10: Agent Connection Layer
 * Story 10.1: Agent Registry Service
 *
 * Handles agent registration:
 * - Structured ID generation (TRCCII format)
 * - JWT-based API key issuance
 * - Capability and skill declaration
 * - Supabase persistence
 */

import { randomBytes, createHmac, createHash } from 'crypto';
import { getSupabasePersistence, hasSupabaseConfig, type Agent } from '../core/SupabasePersistence.js';
import type { AgentId, AgentTier, AgentType } from '../types.js';
import {
    AgentRole,
    AgentCategory,
    generateAgentId,
    getRoleFromType,
    getCategoryFromCapabilities,
} from '../types/agentId.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentRegistrationRequest {
    name: string;
    type: AgentType;
    capabilities: string[];
    skills?: string[];
    metadata?: Record<string, unknown>;
}

export interface AgentRegistrationResult {
    agentId: string;
    structuredId: string;
    apiKey: string;
    apiKeyExpiresAt: string;
    agent: RegisteredAgent;
}

export interface RegisteredAgent {
    id: string;
    structuredId: string;
    name: string;
    type: string;
    tier: number;
    status: string;
    capabilities: string[];
    skills: string[];
    createdAt: string;
}

export interface AgentAPIKey {
    keyId: string;
    agentId: string;
    keyHash: string;
    permissions: string[];
    issuedAt: Date;
    expiresAt: Date;
    lastUsed?: Date;
    revoked: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const API_KEY_EXPIRY_DAYS = 30;
const API_KEY_PREFIX = 'tb_';

// ============================================================================
// Agent Registry Service
// ============================================================================

export class AgentRegistryService {
    private apiKeys: Map<string, AgentAPIKey> = new Map();
    private agentCount: Map<string, number> = new Map(); // category -> count
    private jwtSecret: Buffer;

    constructor(jwtSecret?: string) {
        const secret = jwtSecret ?? process.env.JWT_SECRET ?? process.env.TOKEN_SECRET;
        if (secret) {
            this.jwtSecret = Buffer.from(secret, 'hex');
        } else {
            this.jwtSecret = randomBytes(32);
            if (process.env.NODE_ENV === 'production') {
                console.warn('JWT_SECRET not set - using random key');
            }
        }
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /**
     * Register a new agent
     */
    async registerAgent(request: AgentRegistrationRequest): Promise<AgentRegistrationResult> {
        // Validate request
        this.validateRequest(request);

        // Generate structured ID
        const tier = 0; // New agents start at tier 0
        const structuredId = this.generateStructuredId(tier, request.type, request.capabilities);

        // Generate unique agent ID
        const agentId = this.generateAgentId();

        // Issue API key
        const { apiKey, apiKeyHash, expiresAt } = this.issueAPIKey(agentId);

        // Create agent record
        const now = new Date().toISOString();
        const agent: RegisteredAgent = {
            id: agentId,
            structuredId,
            name: request.name,
            type: request.type,
            tier,
            status: 'pending',
            capabilities: request.capabilities,
            skills: request.skills || [],
            createdAt: now,
        };

        // Persist to Supabase if available
        await this.persistAgent(agent, apiKeyHash);

        // Store API key metadata
        this.apiKeys.set(apiKeyHash, {
            keyId: apiKeyHash.substring(0, 8),
            agentId,
            keyHash: apiKeyHash,
            permissions: ['agent:read', 'agent:write', 'task:read', 'task:execute'],
            issuedAt: new Date(),
            expiresAt,
            revoked: false,
        });

        return {
            agentId,
            structuredId,
            apiKey,
            apiKeyExpiresAt: expiresAt.toISOString(),
            agent,
        };
    }

    // -------------------------------------------------------------------------
    // Structured ID Generation
    // -------------------------------------------------------------------------

    /**
     * Generate structured ID in TRCCII format using unified identity utilities.
     * Uses centralized CAPABILITY_TO_CATEGORY and TYPE_TO_ROLE mappings from agentId.ts.
     *
     * T: Tier (0-8)
     * R: Role (1-9)
     * CC: Category (10-99)
     * II: Instance (00-99)
     */
    generateStructuredId(tier: number, type: string, capabilities: string[]): string {
        // T: Tier (0-8) - clamp to valid range
        const t = Math.min(Math.max(tier, 0), 8);

        // R: Role from type - uses centralized TYPE_TO_ROLE mapping
        const r = getRoleFromType(type);

        // CC: Category from capabilities - uses centralized CAPABILITY_TO_CATEGORY mapping
        const cc = getCategoryFromCapabilities(capabilities);

        // II: Instance counter for this role-category combination
        const categoryKey = `${r}-${cc}`;
        const currentCount = this.agentCount.get(categoryKey) ?? 0;
        const ii = (currentCount + 1) % 100;
        this.agentCount.set(categoryKey, currentCount + 1);

        // Use centralized ID generation
        return generateAgentId(t, r, cc, ii);
    }

    /**
     * Parse a structured ID back to components
     */
    parseStructuredId(structuredId: string): {
        tier: number;
        role: number;
        category: number;
        instance: number;
    } | null {
        if (!/^\d{6}$/.test(structuredId)) {
            return null;
        }

        return {
            tier: parseInt(structuredId[0], 10),
            role: parseInt(structuredId[1], 10),
            category: parseInt(structuredId.substring(2, 4), 10),
            instance: parseInt(structuredId.substring(4, 6), 10),
        };
    }

    // -------------------------------------------------------------------------
    // API Key Management
    // -------------------------------------------------------------------------

    /**
     * Issue a new API key for an agent
     */
    issueAPIKey(agentId: string): {
        apiKey: string;
        apiKeyHash: string;
        expiresAt: Date;
    } {
        // Generate random key
        const keyBytes = randomBytes(32);
        const apiKey = API_KEY_PREFIX + keyBytes.toString('base64url');

        // Hash for storage
        const apiKeyHash = this.hashAPIKey(apiKey);

        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + API_KEY_EXPIRY_DAYS);

        return { apiKey, apiKeyHash, expiresAt };
    }

    /**
     * Hash an API key for secure storage
     */
    hashAPIKey(apiKey: string): string {
        return createHash('sha256').update(apiKey).digest('hex');
    }

    /**
     * Verify an API key
     */
    async verifyAPIKey(apiKey: string): Promise<{
        valid: boolean;
        agentId?: string;
        permissions?: string[];
        expired?: boolean;
        revoked?: boolean;
    }> {
        const hash = this.hashAPIKey(apiKey);
        const keyInfo = this.apiKeys.get(hash);

        if (!keyInfo) {
            // Check Supabase for key
            const dbResult = await this.verifyAPIKeyFromDB(hash);
            if (dbResult) {
                return dbResult;
            }
            return { valid: false };
        }

        if (keyInfo.revoked) {
            return { valid: false, revoked: true };
        }

        if (new Date() > keyInfo.expiresAt) {
            return { valid: false, expired: true };
        }

        // Update last used
        keyInfo.lastUsed = new Date();

        return {
            valid: true,
            agentId: keyInfo.agentId,
            permissions: keyInfo.permissions,
        };
    }

    /**
     * Revoke an API key
     */
    async revokeAPIKey(apiKey: string): Promise<boolean> {
        const hash = this.hashAPIKey(apiKey);
        const keyInfo = this.apiKeys.get(hash);

        if (keyInfo) {
            keyInfo.revoked = true;
            // Also update in database
            await this.revokeAPIKeyInDB(hash);
            return true;
        }

        return false;
    }

    // -------------------------------------------------------------------------
    // Agent Retrieval
    // -------------------------------------------------------------------------

    /**
     * Get agent by ID
     */
    async getAgent(agentId: string): Promise<RegisteredAgent | null> {
        if (hasSupabaseConfig()) {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            const { data, error } = await client
                .from('agents')
                .select('*')
                .eq('id', agentId)
                .single();

            if (error || !data) {
                return null;
            }

            return this.mapAgentFromDB(data as Agent);
        }

        return null;
    }

    /**
     * Get agent by structured ID
     */
    async getAgentByStructuredId(structuredId: string): Promise<RegisteredAgent | null> {
        if (hasSupabaseConfig()) {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            // Structured ID stored in metadata or a column
            const { data, error } = await client
                .from('agents')
                .select('*')
                .eq('floor', structuredId) // Using floor as structured ID field
                .single();

            if (error || !data) {
                return null;
            }

            return this.mapAgentFromDB(data as Agent);
        }

        return null;
    }

    /**
     * List all agents with optional filters
     */
    async listAgents(filters?: {
        type?: string;
        tier?: number;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<RegisteredAgent[]> {
        if (hasSupabaseConfig()) {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            let query = client.from('agents').select('*');

            if (filters?.type) {
                query = query.eq('type', filters.type);
            }
            if (filters?.tier !== undefined) {
                query = query.eq('tier', filters.tier);
            }
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.limit) {
                query = query.limit(filters.limit);
            }
            if (filters?.offset) {
                query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
            }

            const { data, error } = await query;

            if (error || !data) {
                return [];
            }

            return (data as Agent[]).map(a => this.mapAgentFromDB(a));
        }

        return [];
    }

    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------

    private validateRequest(request: AgentRegistrationRequest): void {
        if (!request.name || request.name.length < 2) {
            throw new Error('Agent name must be at least 2 characters');
        }
        if (request.name.length > 100) {
            throw new Error('Agent name must not exceed 100 characters');
        }
        if (!request.type) {
            throw new Error('Agent type is required');
        }
        if (!request.capabilities || request.capabilities.length === 0) {
            throw new Error('At least one capability is required');
        }
    }

    private generateAgentId(): string {
        return `agent_${randomBytes(12).toString('hex')}`;
    }

    private async persistAgent(agent: RegisteredAgent, apiKeyHash: string): Promise<void> {
        if (hasSupabaseConfig()) {
            const supabase = getSupabasePersistence();
            const client = supabase.getClient();

            const { error } = await client.from('agents').insert({
                id: agent.id,
                name: agent.name,
                type: agent.type,
                tier: agent.tier,
                status: agent.status,
                trust_score: 0,
                floor: agent.structuredId, // Store structured ID in floor column
                room: apiKeyHash.substring(0, 8), // Store key ID reference
                capabilities: agent.capabilities,
                skills: agent.skills,
                parent_id: null,
                created_at: agent.createdAt,
                updated_at: agent.createdAt,
            });

            if (error) {
                console.error('Failed to persist agent:', error);
                throw new Error('Failed to persist agent to database');
            }
        }
    }

    private async verifyAPIKeyFromDB(hash: string): Promise<{
        valid: boolean;
        agentId?: string;
        permissions?: string[];
    } | null> {
        // Future: implement DB-based API key verification
        return null;
    }

    private async revokeAPIKeyInDB(hash: string): Promise<void> {
        // Future: implement DB-based API key revocation
    }

    private mapAgentFromDB(data: Agent): RegisteredAgent {
        return {
            id: data.id,
            structuredId: data.floor || '',
            name: data.name,
            type: data.type,
            tier: data.tier,
            status: data.status,
            capabilities: data.capabilities || [],
            skills: data.skills || [],
            createdAt: data.created_at,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let registryInstance: AgentRegistryService | null = null;

export function getAgentRegistry(): AgentRegistryService {
    if (!registryInstance) {
        registryInstance = new AgentRegistryService();
    }
    return registryInstance;
}
