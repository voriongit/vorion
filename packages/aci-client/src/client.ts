/**
 * ACI Client SDK
 *
 * TypeScript client for the Agent Classification Identifier (ACI) standard.
 * Provides type-safe access to Phase 6 Trust Engine APIs.
 */

import {
  ACIClientConfig,
  ACIResponse,
  DashboardData,
  ContextHierarchy,
  DeploymentContext,
  OrgContext,
  AgentContext,
  OperationContext,
  RoleGateRequest,
  RoleGateResponse,
  RoleGateEvaluation,
  CeilingCheckRequest,
  CeilingCheckResponse,
  CeilingEvent,
  GamingAlert,
  GamingAlertCreateRequest,
  AlertStatus,
  PresetHierarchy,
  ACIPreset,
  VorionPreset,
  AxiomPreset,
  Provenance,
  ProvenanceCreateRequest,
  RoleGateRequestSchema,
  CeilingCheckRequestSchema,
  ProvenanceCreateRequestSchema,
} from './types.js'

// =============================================================================
// CLIENT CLASS
// =============================================================================

/**
 * ACI Client for Phase 6 Trust Engine
 *
 * @example
 * ```typescript
 * const client = new ACIClient({
 *   baseUrl: 'https://api.agentanchor.ai',
 *   apiKey: 'your-api-key',
 * })
 *
 * // Get dashboard stats
 * const { stats } = await client.getStats()
 *
 * // Evaluate a role gate
 * const result = await client.evaluateRoleGate({
 *   agentId: 'agent-123',
 *   requestedRole: 'R_L3',
 *   currentTier: 'T3',
 * })
 *
 * // Check ceiling
 * const ceiling = await client.checkCeiling({
 *   agentId: 'agent-123',
 *   proposedScore: 750,
 *   complianceFramework: 'EU_AI_ACT',
 * })
 * ```
 */
export class ACIClient {
  private baseUrl: string
  private apiKey?: string
  private timeout: number
  private headers: Record<string, string>
  private debug: boolean

  constructor(config: ACIClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
    this.timeout = config.timeout ?? 30000
    this.headers = config.headers ?? {}
    this.debug = config.debug ?? false
  }

  // ===========================================================================
  // HTTP Methods
  // ===========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value)
        }
      })
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    if (this.debug) {
      console.log(`[ACI Client] ${method} ${url.toString()}`)
      if (body) console.log('[ACI Client] Body:', JSON.stringify(body, null, 2))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        throw new ACIError(
          data.error || `HTTP ${response.status}`,
          response.status,
          data
        )
      }

      if (this.debug) {
        console.log('[ACI Client] Response:', JSON.stringify(data, null, 2))
      }

      return data as T
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof ACIError) {
        throw error
      }

      if ((error as Error).name === 'AbortError') {
        throw new ACIError('Request timeout', 408)
      }

      throw new ACIError((error as Error).message, 0)
    }
  }

  private get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params)
  }

  private post<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, body, params)
  }

  private patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  // ===========================================================================
  // Stats & Dashboard
  // ===========================================================================

  /**
   * Get Phase 6 dashboard statistics
   */
  async getStats(): Promise<DashboardData> {
    return this.get<DashboardData>('/api/phase6/stats')
  }

  // ===========================================================================
  // Q2: Context Hierarchy
  // ===========================================================================

  /**
   * Get full context hierarchy
   */
  async getContextHierarchy(): Promise<ContextHierarchy> {
    const response = await this.get<{ data: ContextHierarchy }>('/api/phase6/context')
    return response.data
  }

  /**
   * Get deployment contexts
   */
  async getDeployments(): Promise<DeploymentContext[]> {
    const response = await this.get<{ data: DeploymentContext[] }>(
      '/api/phase6/context',
      { tier: 'deployment' }
    )
    return response.data
  }

  /**
   * Get organization contexts
   */
  async getOrganizations(deploymentId?: string): Promise<OrgContext[]> {
    const params: Record<string, string> = { tier: 'organization' }
    if (deploymentId) params.deploymentId = deploymentId

    const response = await this.get<{ data: OrgContext[] }>('/api/phase6/context', params)
    return response.data
  }

  /**
   * Get agent contexts
   */
  async getAgents(deploymentId?: string, orgId?: string): Promise<AgentContext[]> {
    const params: Record<string, string> = { tier: 'agent' }
    if (deploymentId) params.deploymentId = deploymentId
    if (orgId) params.orgId = orgId

    const response = await this.get<{ data: AgentContext[] }>('/api/phase6/context', params)
    return response.data
  }

  /**
   * Get operation contexts
   */
  async getOperations(agentId?: string): Promise<OperationContext[]> {
    const params: Record<string, string> = { tier: 'operation' }
    if (agentId) params.agentId = agentId

    const response = await this.get<{ data: OperationContext[] }>('/api/phase6/context', params)
    return response.data
  }

  /**
   * Create a deployment context
   */
  async createDeployment(
    data: Omit<DeploymentContext, 'id' | 'createdAt' | 'frozenAt'>
  ): Promise<DeploymentContext> {
    const response = await this.post<{ data: DeploymentContext }>(
      '/api/phase6/context',
      { tier: 'deployment', ...data }
    )
    return response.data
  }

  // ===========================================================================
  // Q3: Role Gates
  // ===========================================================================

  /**
   * Evaluate a role gate request
   *
   * @example
   * ```typescript
   * const result = await client.evaluateRoleGate({
   *   agentId: 'agent-123',
   *   requestedRole: 'R_L3',
   *   currentTier: 'T3',
   *   currentScore: 550,
   * })
   *
   * if (result.evaluation.finalDecision === 'ALLOW') {
   *   // Proceed with operation
   * } else if (result.evaluation.finalDecision === 'ESCALATE') {
   *   // Request override
   * } else {
   *   // Denied
   * }
   * ```
   */
  async evaluateRoleGate(request: RoleGateRequest): Promise<RoleGateResponse> {
    // Validate request
    const validated = RoleGateRequestSchema.parse(request)
    return this.post<RoleGateResponse>('/api/phase6/role-gates', validated)
  }

  /**
   * Get role gate evaluation history
   */
  async getRoleGateEvaluations(
    agentId?: string,
    options?: { limit?: number; includeMatrix?: boolean }
  ): Promise<{ evaluations: RoleGateEvaluation[]; summary: Record<string, number> }> {
    const params: Record<string, string> = {}
    if (agentId) params.agentId = agentId
    if (options?.limit) params.limit = String(options.limit)
    if (options?.includeMatrix) params.includeMatrix = 'true'

    return this.get('/api/phase6/role-gates', params)
  }

  // ===========================================================================
  // Q1: Ceiling Enforcement
  // ===========================================================================

  /**
   * Check a proposed trust score against ceilings
   *
   * @example
   * ```typescript
   * const result = await client.checkCeiling({
   *   agentId: 'agent-123',
   *   proposedScore: 750,
   *   complianceFramework: 'EU_AI_ACT',
   * })
   *
   * if (result.result.ceilingApplied) {
   *   console.log(`Score capped at ${result.result.finalScore}`)
   * }
   * ```
   */
  async checkCeiling(request: CeilingCheckRequest): Promise<CeilingCheckResponse> {
    // Validate request
    const validated = CeilingCheckRequestSchema.parse(request)
    return this.post<CeilingCheckResponse>('/api/phase6/ceiling', validated)
  }

  /**
   * Get ceiling events history
   */
  async getCeilingEvents(
    agentId?: string,
    options?: { limit?: number; includeConfig?: boolean }
  ): Promise<{ events: CeilingEvent[]; summary: Record<string, number> }> {
    const params: Record<string, string> = {}
    if (agentId) params.agentId = agentId
    if (options?.limit) params.limit = String(options.limit)
    if (options?.includeConfig) params.includeConfig = 'true'

    return this.get('/api/phase6/ceiling', params)
  }

  // ===========================================================================
  // Gaming Alerts
  // ===========================================================================

  /**
   * Get gaming alerts
   */
  async getGamingAlerts(
    status?: AlertStatus,
    limit?: number
  ): Promise<{ alerts: GamingAlert[]; summary: Record<string, number> }> {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (limit) params.limit = String(limit)

    return this.get('/api/phase6/alerts', params)
  }

  /**
   * Create a gaming alert
   */
  async createGamingAlert(request: GamingAlertCreateRequest): Promise<{ alert: GamingAlert }> {
    return this.post('/api/phase6/alerts', request)
  }

  /**
   * Update gaming alert status
   */
  async updateGamingAlertStatus(
    alertId: string,
    status: AlertStatus,
    resolvedBy?: string,
    resolutionNotes?: string
  ): Promise<{ alert: GamingAlert }> {
    return this.patch('/api/phase6/alerts', {
      alertId,
      status,
      resolvedBy,
      resolutionNotes,
    })
  }

  // ===========================================================================
  // Q4: Presets
  // ===========================================================================

  /**
   * Get all presets with hierarchy
   */
  async getPresetHierarchy(): Promise<PresetHierarchy> {
    const response = await this.get<{ data: PresetHierarchy }>('/api/phase6/presets')
    return response.data
  }

  /**
   * Get ACI canonical presets
   */
  async getACIPresets(): Promise<ACIPreset[]> {
    const response = await this.get<{ data: { presets: ACIPreset[] } }>(
      '/api/phase6/presets',
      { tier: 'aci' }
    )
    return response.data.presets
  }

  /**
   * Get Vorion reference presets
   */
  async getVorionPresets(): Promise<VorionPreset[]> {
    const response = await this.get<{ data: { presets: VorionPreset[] } }>(
      '/api/phase6/presets',
      { tier: 'vorion' }
    )
    return response.data.presets
  }

  /**
   * Get Axiom deployment presets
   */
  async getAxiomPresets(deploymentId?: string): Promise<AxiomPreset[]> {
    const params: Record<string, string> = { tier: 'axiom' }
    if (deploymentId) params.deploymentId = deploymentId

    const response = await this.get<{ data: { presets: AxiomPreset[] } }>(
      '/api/phase6/presets',
      params
    )
    return response.data.presets
  }

  /**
   * Verify preset lineage
   */
  async verifyPresetLineage(
    axiomPresetId: string
  ): Promise<{ verified: boolean; lineage?: Record<string, unknown>; reason?: string }> {
    return this.post('/api/phase6/presets', { axiomPresetId }, { action: 'verify-lineage' })
  }

  // ===========================================================================
  // Q5: Provenance
  // ===========================================================================

  /**
   * Get provenance records
   */
  async getProvenance(
    agentId?: string
  ): Promise<{ records: Provenance[]; summary: Record<string, number>; lineage?: Provenance[] }> {
    const params: Record<string, string> = {}
    if (agentId) params.agentId = agentId

    return this.get('/api/phase6/provenance', params)
  }

  /**
   * Create a provenance record
   *
   * @example
   * ```typescript
   * // Register a new agent
   * const provenance = await client.createProvenance({
   *   agentId: 'agent-new',
   *   creationType: 'FRESH',
   *   createdBy: 'system',
   * })
   *
   * // Clone an existing agent
   * const cloned = await client.createProvenance({
   *   agentId: 'agent-clone',
   *   creationType: 'CLONED',
   *   parentAgentId: 'agent-original',
   *   createdBy: 'admin@company.com',
   * })
   * ```
   */
  async createProvenance(request: ProvenanceCreateRequest): Promise<{ record: Provenance }> {
    // Validate request
    const validated = ProvenanceCreateRequestSchema.parse(request)
    return this.post('/api/phase6/provenance', validated)
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    const stats = await this.getStats()
    return {
      status: 'healthy',
      version: `${stats.version.major}.${stats.version.minor}.${stats.version.patch}`,
    }
  }
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * ACI Client Error
 */
export class ACIError extends Error {
  public readonly statusCode: number
  public readonly details?: unknown

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message)
    this.name = 'ACIError'
    this.statusCode = statusCode
    this.details = details
  }

  /**
   * Check if error is a specific HTTP status
   */
  isStatus(status: number): boolean {
    return this.statusCode === status
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500
  }

  /**
   * Check if error is a timeout
   */
  isTimeout(): boolean {
    return this.statusCode === 408
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an ACI client instance
 *
 * @example
 * ```typescript
 * const client = createACIClient({
 *   baseUrl: 'https://api.agentanchor.ai',
 *   apiKey: process.env.ACI_API_KEY,
 * })
 * ```
 */
export function createACIClient(config: ACIClientConfig): ACIClient {
  return new ACIClient(config)
}

/**
 * Create an ACI client for local development
 */
export function createLocalACIClient(port: number = 3000): ACIClient {
  return new ACIClient({
    baseUrl: `http://localhost:${port}`,
    debug: true,
  })
}
