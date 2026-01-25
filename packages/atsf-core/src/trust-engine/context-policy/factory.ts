/**
 * Phase 6 Q2: Context Policy - Multi-Tenant Factory
 * 
 * Creates and manages agent contexts across multiple tenants
 * Ensures strict isolation and immutability per tenant
 */

import {
  ContextType,
  AgentContext,
  createAgentContext,
  verifyContextIntegrity,
} from './enforcement';

/**
 * Agent context registry per tenant
 * Maintains immutable contexts and prevents cross-tenant access
 */
export class MultiTenantContextFactory {
  private contexts: Map<string, Map<string, AgentContext>> = new Map(); // tenantId → agentId → context
  private tenantHierarchy: Map<string, ContextType> = new Map(); // tenantId → max allowed context
  private creationLog: Array<{
    timestamp: Date;
    tenantId: string;
    agentId: string;
    contextType: ContextType;
    createdBy: string;
  }> = [];

  /**
   * Register a tenant with maximum allowed context level
   */
  registerTenant(tenantId: string, maxContext: ContextType): void {
    this.tenantHierarchy.set(tenantId, maxContext);
    this.contexts.set(tenantId, new Map());
  }

  /**
   * Create an agent context for a specific tenant
   * Enforces tenant's maximum context level
   */
  createContextForTenant(
    tenantId: string,
    agentId: string,
    requestedContext: ContextType,
    createdBy: string
  ): AgentContext {
    // Validate tenant exists
    if (!this.tenantHierarchy.has(tenantId)) {
      throw new Error(`Tenant not registered: ${tenantId}`);
    }

    // Enforce tenant's max context level
    const maxContext = this.tenantHierarchy.get(tenantId)!;
    const contextOrder = [
      ContextType.LOCAL,
      ContextType.ENTERPRISE,
      ContextType.SOVEREIGN,
    ];
    const requestedRank = contextOrder.indexOf(requestedContext);
    const maxRank = contextOrder.indexOf(maxContext);

    if (requestedRank > maxRank) {
      throw new Error(
        `Tenant ${tenantId} not allowed context ${requestedContext} (max: ${maxContext})`
      );
    }

    // Check if context already exists (immutability - can't recreate)
    const tenantContexts = this.contexts.get(tenantId)!;
    if (tenantContexts.has(agentId)) {
      throw new Error(
        `Agent ${agentId} context already exists (immutable) - cannot recreate`
      );
    }

    // Create context
    const context = createAgentContext(
      requestedContext,
      agentId,
      tenantId,
      createdBy
    );

    // Store in tenant's registry
    tenantContexts.set(agentId, context);

    // Log creation
    this.creationLog.push({
      timestamp: new Date(),
      tenantId,
      agentId,
      contextType: requestedContext,
      createdBy,
    });

    return context;
  }

  /**
   * Retrieve an agent's context (only from its own tenant)
   * Enforces strict multi-tenant isolation
   */
  getContextForAgent(
    tenantId: string,
    agentId: string
  ): AgentContext | null {
    const tenantContexts = this.contexts.get(tenantId);
    if (!tenantContexts) {
      return null;
    }

    return tenantContexts.get(agentId) || null;
  }

  /**
   * Verify context integrity across all tenants
   * Detects tampering or corruption
   */
  verifyAllContexts(): {
    valid: number;
    invalid: number;
    invalidContexts: Array<{ tenantId: string; agentId: string }>;
  } {
    let valid = 0;
    let invalid = 0;
    const invalidContexts: Array<{ tenantId: string; agentId: string }> = [];

    this.contexts.forEach((tenantContexts, tenantId) => {
      tenantContexts.forEach((context, agentId) => {
        if (verifyContextIntegrity(context)) {
          valid++;
        } else {
          invalid++;
          invalidContexts.push({ tenantId, agentId });
        }
      });
    });

    return { valid, invalid, invalidContexts };
  }

  /**
   * Get creation audit log
   */
  getCreationLog(): Array<{
    timestamp: Date;
    tenantId: string;
    agentId: string;
    contextType: ContextType;
    createdBy: string;
  }> {
    return [...this.creationLog];
  }

  /**
   * Get creation log for specific tenant
   */
  getTenantCreationLog(tenantId: string): Array<{
    timestamp: Date;
    tenantId: string;
    agentId: string;
    contextType: ContextType;
    createdBy: string;
  }> {
    return this.creationLog.filter((log) => log.tenantId === tenantId);
  }

  /**
   * Count agents per tenant
   */
  getAgentCountPerTenant(): Map<string, number> {
    const counts = new Map<string, number>();
    this.contexts.forEach((tenantContexts, tenantId) => {
      counts.set(tenantId, tenantContexts.size);
    });
    return counts;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.contexts.clear();
    this.tenantHierarchy.clear();
    this.creationLog = [];
  }
}

/**
 * Global multi-tenant factory instance
 */
export const globalContextFactory = new MultiTenantContextFactory();
