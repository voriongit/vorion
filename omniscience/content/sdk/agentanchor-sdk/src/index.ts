/**
 * @agentanchor/sdk
 * Official SDK for the AgentAnchor AI governance platform
 */

import {
  Agent,
  TrustScore,
  TrustComponents,
  GovernanceRequest,
  GovernanceResult,
  Capability,
  Certification,
  CertificationLevel,
  AuditRecord,
  Policy,
  BasisError,
  BasisErrorCode,
} from '@basis-protocol/core';

// =============================================================================
// SDK CONFIGURATION
// =============================================================================

export interface AgentAnchorConfig {
  /** API key for authentication */
  apiKey: string;
  /** Environment: 'production' | 'staging' | 'development' */
  environment?: 'production' | 'staging' | 'development';
  /** Custom API base URL (overrides environment) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

const DEFAULT_CONFIG: Partial<AgentAnchorConfig> = {
  environment: 'production',
  timeout: 30000,
  debug: false,
};

const API_URLS: Record<string, string> = {
  production: 'https://api.agentanchorai.com/v1',
  staging: 'https://staging-api.agentanchorai.com/v1',
  development: 'http://localhost:3000/api/v1',
};

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface ApiResponse<T> {
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

// =============================================================================
// MAIN CLIENT
// =============================================================================

/**
 * AgentAnchor SDK Client
 * 
 * @example
 * ```typescript
 * import { AgentAnchor } from '@agentanchor/sdk';
 * 
 * const anchor = new AgentAnchor({
 *   apiKey: process.env.AGENTANCHOR_API_KEY!,
 *   environment: 'production'
 * });
 * 
 * // Register an agent
 * const agent = await anchor.agents.register({
 *   name: 'My AI Assistant',
 *   capabilities: ['generate_text', 'send_email']
 * });
 * 
 * // Process an action through governance
 * const decision = await anchor.governance.process({
 *   agentId: agent.id,
 *   action: 'send_email',
 *   payload: { to: 'user@example.com' }
 * });
 * ```
 */
export class AgentAnchor {
  private config: Required<AgentAnchorConfig>;
  private baseUrl: string;

  /** Agent management */
  public readonly agents: AgentsClient;
  /** Trust score management */
  public readonly trust: TrustClient;
  /** Governance processing */
  public readonly governance: GovernanceClient;
  /** Certification management */
  public readonly certification: CertificationClient;
  /** Audit trail access */
  public readonly audit: AuditClient;
  /** Policy management */
  public readonly policies: PoliciesClient;

  constructor(config: AgentAnchorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<AgentAnchorConfig>;
    this.baseUrl = config.baseUrl || API_URLS[this.config.environment];

    // Initialize sub-clients
    this.agents = new AgentsClient(this);
    this.trust = new TrustClient(this);
    this.governance = new GovernanceClient(this);
    this.certification = new CertificationClient(this);
    this.audit = new AuditClient(this);
    this.policies = new PoliciesClient(this);
  }

  /**
   * Make authenticated API request
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    if (this.config.debug) {
      console.log(`[AgentAnchor] ${method} ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-SDK-Version': '1.0.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new BasisError(
          (error.code as BasisErrorCode) || 'INTERNAL_ERROR',
          error.message || `API error: ${response.status}`,
          error.details
        );
      }

      const json = await response.json() as ApiResponse<T>;
      return json.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof BasisError) throw error;
      throw new BasisError(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request('GET', '/health');
  }
}

// =============================================================================
// AGENTS CLIENT
// =============================================================================

export interface RegisterAgentInput {
  name: string;
  description?: string;
  capabilities: Capability[];
  manifest?: {
    basisVersion?: string;
    governance?: {
      escalationEndpoint?: string;
      auditEndpoint?: string;
    };
    model?: {
      provider: string;
      modelId: string;
    };
  };
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  capabilities?: Capability[];
}

class AgentsClient {
  constructor(private client: AgentAnchor) {}

  /**
   * Register a new agent
   */
  async register(input: RegisterAgentInput): Promise<Agent> {
    return this.client.request('POST', '/agents', input);
  }

  /**
   * Get agent by ID
   */
  async get(agentId: string): Promise<Agent> {
    return this.client.request('GET', `/agents/${agentId}`);
  }

  /**
   * List all agents
   */
  async list(params?: { 
    page?: number; 
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Agent>> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.client.request('GET', `/agents?${query}`);
  }

  /**
   * Update agent
   */
  async update(agentId: string, input: UpdateAgentInput): Promise<Agent> {
    return this.client.request('PATCH', `/agents/${agentId}`, input);
  }

  /**
   * Pause agent
   */
  async pause(agentId: string, reason: string): Promise<Agent> {
    return this.client.request('POST', `/agents/${agentId}/pause`, { reason });
  }

  /**
   * Resume agent
   */
  async resume(agentId: string): Promise<Agent> {
    return this.client.request('POST', `/agents/${agentId}/resume`);
  }

  /**
   * Terminate agent (permanent)
   */
  async terminate(agentId: string, reason: string): Promise<void> {
    await this.client.request('DELETE', `/agents/${agentId}`, { reason });
  }
}

// =============================================================================
// TRUST CLIENT
// =============================================================================

class TrustClient {
  constructor(private client: AgentAnchor) {}

  /**
   * Get current trust score
   */
  async getScore(agentId: string): Promise<TrustScore> {
    return this.client.request('GET', `/trust/score/${agentId}`);
  }

  /**
   * Get trust score history
   */
  async getHistory(agentId: string, params?: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<{ scores: (TrustScore & { timestamp: string })[] }> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.client.request('GET', `/trust/score/${agentId}/history?${query}`);
  }

  /**
   * Get trust statistics
   */
  async getStats(): Promise<{
    totalAgents: number;
    averageScore: number;
    tierDistribution: Record<string, number>;
  }> {
    return this.client.request('GET', '/trust/stats');
  }

  /**
   * Manually adjust trust (admin only)
   */
  async adjust(agentId: string, adjustment: {
    delta: number;
    reason: string;
    component?: keyof TrustComponents;
  }): Promise<TrustScore> {
    return this.client.request('POST', `/trust/score/${agentId}/adjust`, adjustment);
  }
}

// =============================================================================
// GOVERNANCE CLIENT
// =============================================================================

class GovernanceClient {
  constructor(private client: AgentAnchor) {}

  /**
   * Process an action through governance
   */
  async process(request: GovernanceRequest): Promise<GovernanceResult> {
    return this.client.request('POST', '/governance/process', request);
  }

  /**
   * Check if action would be allowed (dry run)
   */
  async check(request: GovernanceRequest): Promise<{
    wouldAllow: boolean;
    reason: string;
    requiredTrust: number;
    currentTrust: number;
  }> {
    return this.client.request('POST', '/governance/check', request);
  }

  /**
   * Get pending escalations
   */
  async getPendingEscalations(params?: {
    agentId?: string;
    limit?: number;
  }): Promise<PaginatedResponse<{
    id: string;
    request: GovernanceRequest;
    createdAt: string;
  }>> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.client.request('GET', `/governance/escalations?${query}`);
  }

  /**
   * Resolve escalation (human decision)
   */
  async resolveEscalation(escalationId: string, decision: {
    decision: 'ALLOW' | 'DENY';
    reason: string;
  }): Promise<GovernanceResult> {
    return this.client.request(
      'POST', 
      `/governance/escalations/${escalationId}/resolve`, 
      decision
    );
  }
}

// =============================================================================
// CERTIFICATION CLIENT
// =============================================================================

export interface SubmitCertificationInput {
  agentId: string;
  level: CertificationLevel;
  evidence?: {
    complianceReport?: string;
    testResults?: string;
    auditReport?: string;
  };
}

class CertificationClient {
  constructor(private client: AgentAnchor) {}

  /**
   * Submit agent for certification
   */
  async submit(input: SubmitCertificationInput): Promise<{
    certificationId: string;
    status: 'pending';
    estimatedReviewTime: string;
  }> {
    return this.client.request('POST', '/certifications', input);
  }

  /**
   * Get certification status
   */
  async get(certificationId: string): Promise<Certification> {
    return this.client.request('GET', `/certifications/${certificationId}`);
  }

  /**
   * Get certification for agent
   */
  async getForAgent(agentId: string): Promise<Certification | null> {
    return this.client.request('GET', `/agents/${agentId}/certification`);
  }

  /**
   * List all certifications
   */
  async list(params?: {
    status?: string;
    level?: string;
  }): Promise<PaginatedResponse<Certification>> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.client.request('GET', `/certifications?${query}`);
  }

  /**
   * Run compliance tests
   */
  async runTests(agentId: string): Promise<{
    overall: number;
    categories: {
      intent: number;
      enforce: number;
      proof: number;
      chain: number;
    };
    details: Array<{
      testId: string;
      name: string;
      passed: boolean;
      error?: string;
    }>;
  }> {
    return this.client.request('POST', `/agents/${agentId}/compliance-tests`);
  }
}

// =============================================================================
// AUDIT CLIENT
// =============================================================================

class AuditClient {
  constructor(private client: AgentAnchor) {}

  /**
   * Get audit trail for agent
   */
  async getTrail(agentId: string, params?: {
    from?: string;
    to?: string;
    eventType?: string;
    limit?: number;
  }): Promise<PaginatedResponse<AuditRecord>> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.client.request('GET', `/audit/${agentId}/trail?${query}`);
  }

  /**
   * Get specific audit record
   */
  async getRecord(recordId: string): Promise<AuditRecord> {
    return this.client.request('GET', `/audit/records/${recordId}`);
  }

  /**
   * Verify audit chain integrity
   */
  async verifyChain(agentId: string, params?: {
    from?: string;
    to?: string;
  }): Promise<{
    valid: boolean;
    recordsChecked: number;
    firstRecord: string;
    lastRecord: string;
    invalidRecords?: string[];
  }> {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.client.request('GET', `/audit/${agentId}/verify?${query}`);
  }

  /**
   * Export audit trail
   */
  async export(agentId: string, format: 'json' | 'csv'): Promise<{
    downloadUrl: string;
    expiresAt: string;
  }> {
    return this.client.request('POST', `/audit/${agentId}/export`, { format });
  }
}

// =============================================================================
// POLICIES CLIENT
// =============================================================================

export interface CreatePolicyInput {
  name: string;
  description?: string;
  rules: Array<{
    name: string;
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
    action: 'ALLOW' | 'DENY' | 'ESCALATE';
    priority: number;
  }>;
  defaultAction?: 'ALLOW' | 'DENY' | 'ESCALATE';
}

class PoliciesClient {
  constructor(private client: AgentAnchor) {}

  /**
   * Create policy
   */
  async create(input: CreatePolicyInput): Promise<Policy> {
    return this.client.request('POST', '/policies', input);
  }

  /**
   * Get policy
   */
  async get(policyId: string): Promise<Policy> {
    return this.client.request('GET', `/policies/${policyId}`);
  }

  /**
   * List policies
   */
  async list(): Promise<PaginatedResponse<Policy>> {
    return this.client.request('GET', '/policies');
  }

  /**
   * Update policy
   */
  async update(policyId: string, input: Partial<CreatePolicyInput>): Promise<Policy> {
    return this.client.request('PATCH', `/policies/${policyId}`, input);
  }

  /**
   * Delete policy
   */
  async delete(policyId: string): Promise<void> {
    await this.client.request('DELETE', `/policies/${policyId}`);
  }

  /**
   * Attach policy to agent
   */
  async attachToAgent(policyId: string, agentId: string): Promise<void> {
    await this.client.request('POST', `/policies/${policyId}/agents`, { agentId });
  }

  /**
   * Detach policy from agent
   */
  async detachFromAgent(policyId: string, agentId: string): Promise<void> {
    await this.client.request('DELETE', `/policies/${policyId}/agents/${agentId}`);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { AgentAnchor as default };

// Re-export core types for convenience
export * from '@basis-protocol/core';
