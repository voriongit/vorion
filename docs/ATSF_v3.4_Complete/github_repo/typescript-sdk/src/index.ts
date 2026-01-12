/**
 * ATSF TypeScript SDK
 * ===================
 * 
 * TypeScript/JavaScript client for ATSF API.
 * 
 * Features:
 * - Full API coverage
 * - TypeScript types
 * - WebSocket real-time events
 * - Browser and Node.js compatible
 * 
 * Usage:
 *   import { ATSF, Agent } from '@agentanchor/atsf';
 *   
 *   const atsf = new ATSF({ baseUrl: 'http://localhost:8000' });
 *   const agent = await atsf.createAgent('my_agent', 'my_creator');
 *   const result = await agent.execute('read', { target: 'file.txt' });
 * 
 * @version 3.4.0
 * @author ATSF Development Team
 */

// =============================================================================
// TYPES
// =============================================================================

export type TransparencyTier = 'black_box' | 'gray_box' | 'white_box' | 'verified_box';
export type ActionDecision = 'allow' | 'deny' | 'allow_monitored';
export type EventType = 
  | 'trust_change'
  | 'trust_threshold_breach'
  | 'trust_recovery'
  | 'action_requested'
  | 'action_allowed'
  | 'action_denied'
  | 'action_monitored'
  | 'security_alert'
  | 'injection_detected'
  | 'drift_detected'
  | 'anomaly_detected'
  | 'agent_registered'
  | 'agent_deactivated'
  | 'kill_switch_triggered'
  | 'system_health';

export interface ATSFConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface TrustScore {
  score: number;
  tier: TransparencyTier;
  ceiling: number;
  velocity: number;
  lastAction?: string;
  actionCount: number;
}

export interface ActionResult {
  requestId: string;
  decision: ActionDecision;
  trustScore: number;
  trustDelta: number;
  riskScore: number;
  processingTimeMs: number;
  explanation?: string;
  violations: string[];
  timestamp: string;
}

export interface AgentStatus {
  agentId: string;
  active: boolean;
  trust: TrustScore;
  actionCount: number;
  lastActionTime?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface AgentInsights {
  totalActions: number;
  allowedActions: number;
  deniedActions: number;
  monitoredActions: number;
  avgTrustScore: number;
  avgRiskScore: number;
  actionDistribution: Record<string, number>;
  decisionDistribution: Record<string, number>;
}

export interface ATSFEvent {
  eventType: EventType;
  timestamp: string;
  source: string;
  agentId?: string;
  data: Record<string, unknown>;
  severity?: string;
  correlationId?: string;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  severity: string;
  agentId?: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  agentsCount: number;
  creatorsCount: number;
  timestamp: string;
  version: string;
}

// =============================================================================
// HTTP CLIENT
// =============================================================================

class HTTPClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private retries: number;

  constructor(config: ATSFConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new ATSFError(
            error.message || `HTTP ${response.status}`,
            response.status,
            error
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retries - 1) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class ATSFError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ATSFError';
  }
}

export class ActionDeniedError extends ATSFError {
  constructor(
    public result: ActionResult
  ) {
    super(`Action denied: ${result.explanation || 'Trust too low'}`);
    this.name = 'ActionDeniedError';
  }
}

// =============================================================================
// AGENT CLASS
// =============================================================================

export class Agent {
  private client: HTTPClient;
  public readonly agentId: string;
  public readonly creatorId: string;

  constructor(client: HTTPClient, agentId: string, creatorId: string) {
    this.client = client;
    this.agentId = agentId;
    this.creatorId = creatorId;
  }

  /**
   * Execute an action with trust scoring
   */
  async execute(
    actionType: string,
    payload: Record<string, unknown>,
    reasoning?: string
  ): Promise<ActionResult> {
    const response = await this.client.post<ActionResult>('/actions', {
      agent_id: this.agentId,
      action_type: actionType,
      payload,
      reasoning_trace: reasoning,
    });

    return {
      requestId: response.requestId,
      decision: response.decision,
      trustScore: response.trustScore,
      trustDelta: response.trustDelta,
      riskScore: response.riskScore,
      processingTimeMs: response.processingTimeMs,
      explanation: response.explanation,
      violations: response.violations || [],
      timestamp: response.timestamp,
    };
  }

  /**
   * Execute action and throw if denied
   */
  async executeOrThrow(
    actionType: string,
    payload: Record<string, unknown>,
    reasoning?: string
  ): Promise<ActionResult> {
    const result = await this.execute(actionType, payload, reasoning);
    if (result.decision === 'deny') {
      throw new ActionDeniedError(result);
    }
    return result;
  }

  /**
   * Get current trust score
   */
  async getTrust(): Promise<TrustScore> {
    return this.client.get<TrustScore>(`/trust/${this.agentId}`);
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<AgentStatus> {
    return this.client.get<AgentStatus>(`/agents/${this.agentId}`);
  }

  /**
   * Get agent insights
   */
  async getInsights(): Promise<AgentInsights> {
    return this.client.get<AgentInsights>(`/insights/${this.agentId}`);
  }

  /**
   * Get memory context
   */
  async getMemoryContext(maxEntries: number = 10): Promise<unknown[]> {
    return this.client.get<unknown[]>(
      `/agents/${this.agentId}/memory?max_entries=${maxEntries}`
    );
  }

  /**
   * Consolidate memory
   */
  async consolidateMemory(): Promise<{ pruned: number; consolidated: number }> {
    return this.client.post(`/agents/${this.agentId}/consolidate`);
  }

  /**
   * Find causes for an effect
   */
  async findCauses(effect: string, maxDepth: number = 5): Promise<unknown[]> {
    return this.client.get<unknown[]>(
      `/agents/${this.agentId}/causes/${effect}?max_depth=${maxDepth}`
    );
  }
}

// =============================================================================
// WEBSOCKET CLIENT
// =============================================================================

export type EventHandler = (event: ATSFEvent) => void;

export class ATSFWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<EventType | '*', Set<EventHandler>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as ATSFEvent;
            this.emit(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
          this.handleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private emit(event: ATSFEvent): void {
    // Emit to specific handlers
    const typeHandlers = this.handlers.get(event.eventType);
    if (typeHandlers) {
      typeHandlers.forEach(handler => handler(event));
    }

    // Emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*' as EventType);
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(event));
    }
  }

  subscribe(eventType: EventType | '*', handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Send subscription message
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        event_type: eventType,
      }));
    }

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  unsubscribe(eventType: EventType): void {
    this.handlers.delete(eventType);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        event_type: eventType,
      }));
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// =============================================================================
// MAIN ATSF CLASS
// =============================================================================

export class ATSF {
  private client: HTTPClient;
  private config: ATSFConfig;
  private websocket?: ATSFWebSocket;
  private agents: Map<string, Agent> = new Map();

  constructor(config: ATSFConfig) {
    this.config = config;
    this.client = new HTTPClient(config);
  }

  // ===========================================================================
  // CREATOR MANAGEMENT
  // ===========================================================================

  /**
   * Register a new creator
   */
  async registerCreator(
    creatorId: string,
    options: {
      tier?: string;
      stake?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<{ creatorId: string }> {
    return this.client.post('/creators', {
      creator_id: creatorId,
      tier: options.tier || 'standard',
      stake: options.stake || 0,
      metadata: options.metadata || {},
    });
  }

  // ===========================================================================
  // AGENT MANAGEMENT
  // ===========================================================================

  /**
   * Create a new agent
   */
  async createAgent(
    agentId: string,
    creatorId: string,
    options: {
      tier?: TransparencyTier;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<Agent> {
    await this.client.post('/agents', {
      agent_id: agentId,
      creator_id: creatorId,
      tier: options.tier || 'gray_box',
      metadata: options.metadata || {},
    });

    const agent = new Agent(this.client, agentId, creatorId);
    this.agents.set(agentId, agent);
    return agent;
  }

  /**
   * Get an existing agent
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId)!;
    }

    try {
      const status = await this.client.get<AgentStatus>(`/agents/${agentId}`);
      const agent = new Agent(this.client, agentId, status.metadata?.creatorId as string || 'unknown');
      this.agents.set(agentId, agent);
      return agent;
    } catch {
      return null;
    }
  }

  /**
   * List all agents
   */
  async listAgents(creatorId?: string): Promise<AgentStatus[]> {
    const path = creatorId ? `/agents?creator_id=${creatorId}` : '/agents';
    return this.client.get<AgentStatus[]>(path);
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Connect to WebSocket for real-time events
   */
  async connectWebSocket(url?: string): Promise<ATSFWebSocket> {
    const wsUrl = url || this.config.baseUrl.replace(/^http/, 'ws') + '/ws';
    this.websocket = new ATSFWebSocket(wsUrl);
    await this.websocket.connect();
    return this.websocket;
  }

  /**
   * Subscribe to events
   */
  onEvent(eventType: EventType | '*', handler: EventHandler): () => void {
    if (!this.websocket) {
      throw new ATSFError('WebSocket not connected. Call connectWebSocket() first.');
    }
    return this.websocket.subscribe(eventType, handler);
  }

  // ===========================================================================
  // ALERTS
  // ===========================================================================

  /**
   * Set alert threshold
   */
  async setAlertThreshold(metric: string, threshold: number): Promise<void> {
    await this.client.post('/alerts/thresholds', { metric, threshold });
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(severity?: string): Promise<Alert[]> {
    const path = severity ? `/alerts?severity=${severity}` : '/alerts';
    return this.client.get<Alert[]>(path);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.client.post(`/alerts/${alertId}/acknowledge`);
  }

  // ===========================================================================
  // GOVERNANCE
  // ===========================================================================

  /**
   * Add constitutional rule
   */
  async addConstitutionalRule(
    ruleId: string,
    category: string,
    ruleText: string,
    keywords: string[],
    priority: number = 3
  ): Promise<void> {
    await this.client.post('/rules', {
      rule_id: ruleId,
      category,
      rule_text: ruleText,
      keywords,
      priority,
    });
  }

  /**
   * Trigger kill switch
   */
  async triggerKillSwitch(reason: string): Promise<void> {
    await this.client.post('/kill-switch', { reason });
  }

  // ===========================================================================
  // SYSTEM
  // ===========================================================================

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthStatus> {
    return this.client.get<HealthStatus>('/health');
  }

  /**
   * Get version
   */
  async getVersion(): Promise<string> {
    const health = await this.healthCheck();
    return health.version;
  }

  /**
   * Get metrics (Prometheus format)
   */
  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/metrics`);
    return response.text();
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let defaultInstance: ATSF | null = null;

/**
 * Initialize default ATSF instance
 */
export function init(config: ATSFConfig): ATSF {
  defaultInstance = new ATSF(config);
  return defaultInstance;
}

/**
 * Get default ATSF instance
 */
export function getInstance(): ATSF {
  if (!defaultInstance) {
    throw new ATSFError('ATSF not initialized. Call init() first.');
  }
  return defaultInstance;
}

/**
 * Create agent using default instance
 */
export async function createAgent(
  agentId: string,
  creatorId: string,
  options?: { tier?: TransparencyTier; metadata?: Record<string, unknown> }
): Promise<Agent> {
  return getInstance().createAgent(agentId, creatorId, options);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ATSF;
