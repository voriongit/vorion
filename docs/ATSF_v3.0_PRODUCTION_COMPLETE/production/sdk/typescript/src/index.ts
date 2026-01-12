/**
 * ATSF v3.0 - TypeScript/JavaScript SDK
 * ======================================
 * 
 * Official SDK for the Agentic Trust Scoring Framework.
 * 
 * Installation:
 *   npm install @agentanchor/atsf-sdk
 * 
 * Usage:
 *   import { ATSFClient } from '@agentanchor/atsf-sdk';
 *   
 *   const client = new ATSFClient({ apiKey: 'your-api-key' });
 *   const agent = await client.agents.create({ agentId: 'my-agent' });
 */

// =============================================================================
// TYPES
// =============================================================================

export type TransparencyTier = 'black_box' | 'gray_box' | 'white_box' | 'attested' | 'transparent';
export type AgentStatus = 'registered' | 'active' | 'suspended' | 'quarantined' | 'terminated';
export type ThreatLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical' | 'catastrophic';
export type ImpactLevel = 'negligible' | 'low' | 'medium' | 'high' | 'critical' | 'catastrophic';
export type ContainmentLevel = 'isolated' | 'sandboxed' | 'restricted' | 'monitored' | 'standard';

export interface Agent {
  agentId: string;
  status: AgentStatus;
  trustScore: number;
  trustCeiling: number;
  containmentLevel: ContainmentLevel;
  transparencyTier: TransparencyTier;
  capabilities: string[];
  flags: string[];
  registeredAt: string;
  lastActivity: string;
}

export interface TrustInfo {
  agentId: string;
  trustScore: number;
  trustCeiling: number;
  wasCapped: boolean;
  velocity: number;
}

export interface ActionDecision {
  requestId: string;
  allowed: boolean;
  reason: string;
  riskScore: number;
  requiredApproval: string | null;
  signals: string[];
}

export interface Assessment {
  agentId: string;
  timestamp: string;
  trustScore: number;
  trustVelocity: number;
  trustCeiling: number;
  threatLevel: ThreatLevel;
  riskScore: number;
  totalSignals: number;
  recommendedAction: string;
  findings: string[];
  signalsByCategory: Record<string, string[]>;
}

export interface Stats {
  agentsRegistered: number;
  activeAgents: number;
  quarantinedAgents: number;
  assessmentsPerformed: number;
  actionsProcessed: number;
  actionsBlocked: number;
  threatsDetected: number;
}

export interface CreateAgentOptions {
  agentId: string;
  transparencyTier?: TransparencyTier;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTrustOptions {
  eventType: string;
  delta: number;
  source?: string;
}

export interface ProcessActionOptions {
  actionType: string;
  description: string;
  target: string;
  impact?: ImpactLevel;
  reversible?: boolean;
  inputText?: string;
  metadata?: Record<string, any>;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

// =============================================================================
// ERRORS
// =============================================================================

export class ATSFError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ATSFError';
  }
}

export class AuthenticationError extends ATSFError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends ATSFError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ATSFError {
  constructor(message: string = 'Validation error') {
    super(message, 422);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ATSFError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function transformKeys(obj: any, transformer: (key: string) => string): any {
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, transformer));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      acc[transformer(key)] = transformKeys(obj[key], transformer);
      return acc;
    }, {} as any);
  }
  return obj;
}

// =============================================================================
// API RESOURCES
// =============================================================================

class AgentsResource {
  constructor(private client: ATSFClient) {}

  async create(options: CreateAgentOptions): Promise<Agent> {
    const data = transformKeys(options, camelToSnake);
    const response = await this.client.request('POST', '/agents', data);
    return transformKeys(response, snakeToCamel);
  }

  async list(status?: AgentStatus, limit: number = 100): Promise<Agent[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.append('status', status);
    const response = await this.client.request('GET', `/agents?${params}`);
    return transformKeys(response, snakeToCamel);
  }

  async get(agentId: string): Promise<Agent> {
    const response = await this.client.request('GET', `/agents/${agentId}`);
    return transformKeys(response, snakeToCamel);
  }

  async update(agentId: string, options: Partial<CreateAgentOptions>): Promise<Agent> {
    const data = transformKeys(options, camelToSnake);
    const response = await this.client.request('PATCH', `/agents/${agentId}`, data);
    return transformKeys(response, snakeToCamel);
  }

  async activate(agentId: string): Promise<Agent> {
    const response = await this.client.request('POST', `/agents/${agentId}/activate`);
    return transformKeys(response, snakeToCamel);
  }

  async suspend(agentId: string, reason: string): Promise<Agent> {
    const response = await this.client.request('POST', `/agents/${agentId}/suspend`, { reason });
    return transformKeys(response, snakeToCamel);
  }

  async quarantine(agentId: string, reason: string): Promise<Agent> {
    const response = await this.client.request('POST', `/agents/${agentId}/quarantine`, { reason });
    return transformKeys(response, snakeToCamel);
  }

  async terminate(agentId: string): Promise<void> {
    await this.client.request('DELETE', `/agents/${agentId}`);
  }
}

class TrustResource {
  constructor(private client: ATSFClient) {}

  async get(agentId: string): Promise<TrustInfo> {
    const response = await this.client.request('GET', `/agents/${agentId}/trust`);
    return transformKeys(response, snakeToCamel);
  }

  async update(agentId: string, options: UpdateTrustOptions): Promise<TrustInfo> {
    const data = transformKeys(options, camelToSnake);
    const response = await this.client.request('POST', `/agents/${agentId}/trust`, data);
    return transformKeys(response, snakeToCamel);
  }

  async history(agentId: string, limit: number = 100): Promise<any> {
    const response = await this.client.request('GET', `/agents/${agentId}/trust/history?limit=${limit}`);
    return transformKeys(response, snakeToCamel);
  }
}

class ActionsResource {
  constructor(private client: ATSFClient) {}

  async process(agentId: string, options: ProcessActionOptions): Promise<ActionDecision> {
    const data = transformKeys(options, camelToSnake);
    const response = await this.client.request('POST', `/agents/${agentId}/actions`, data);
    return transformKeys(response, snakeToCamel);
  }
}

class AssessmentsResource {
  constructor(private client: ATSFClient) {}

  async get(agentId: string): Promise<Assessment> {
    const response = await this.client.request('GET', `/agents/${agentId}/assessment`);
    return transformKeys(response, snakeToCamel);
  }
}

// =============================================================================
// MAIN CLIENT
// =============================================================================

export class ATSFClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  public agents: AgentsResource;
  public trust: TrustResource;
  public actions: ActionsResource;
  public assessments: AssessmentsResource;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || 'http://localhost:8000').replace(/\/$/, '');
    this.timeout = options.timeout || 30000;

    this.agents = new AgentsResource(this);
    this.trust = new TrustResource(this);
    this.actions = new ActionsResource(this);
    this.assessments = new AssessmentsResource(this);
  }

  async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'atsf-sdk-js/3.0.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new AuthenticationError('Invalid API key');
      } else if (response.status === 403) {
        throw new AuthenticationError('Access denied');
      } else if (response.status === 404) {
        throw new NotFoundError(`Resource not found: ${path}`);
      } else if (response.status === 422) {
        const data = await response.json();
        throw new ValidationError(data.detail || 'Validation error');
      } else if (response.status === 429) {
        throw new RateLimitError();
      } else if (!response.ok) {
        throw new ATSFError(`API error: ${response.status}`, response.status);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ATSFError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new ATSFError('Request timeout');
      }
      throw new ATSFError(`Request failed: ${(error as Error).message}`);
    }
  }

  async health(): Promise<any> {
    return this.request('GET', '/health');
  }

  async stats(): Promise<Stats> {
    const response = await this.request('GET', '/stats');
    return transformKeys(response, snakeToCamel);
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createClient(options: ClientOptions): ATSFClient {
  return new ATSFClient(options);
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default ATSFClient;
