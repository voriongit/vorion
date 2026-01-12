/**
 * Cascade Halt Protocol
 * Story 16-3: Automatic halt of dependent agents
 *
 * When a critical agent is paused, all agents that depend on it
 * are automatically halted to prevent partial operation failures.
 */

import {
  pauseAgent,
  getAgentState,
  registerDependencies,
  type AgentState,
  type PauseRecord,
} from './agent-control';

// ============================================================================
// Types
// ============================================================================

export interface DependencyNode {
  agentId: string;
  dependsOn: string[];
  dependentAgents: string[];
  cascadePolicy: CascadePolicy;
}

export interface CascadePolicy {
  // What to do when a dependency is paused
  onDependencyPause: 'halt' | 'degrade' | 'continue';

  // What to do when this agent is paused
  onSelfPause: 'halt_dependents' | 'notify_only' | 'ignore';

  // Auto-resume behavior
  autoResumeWithDependency: boolean;

  // Grace period before cascade (ms)
  cascadeDelayMs: number;

  // Maximum cascade depth
  maxCascadeDepth: number;
}

export interface CascadeEvent {
  id: string;
  sourceAgentId: string;
  sourceReason: string;
  triggeredAt: Date;
  completedAt?: Date;

  // Affected agents
  agentsHalted: string[];
  agentsDegraded: string[];
  agentsNotified: string[];

  // Cascade path
  cascadePath: Array<{
    fromAgent: string;
    toAgent: string;
    depth: number;
    action: 'halt' | 'degrade' | 'notify';
  }>;

  // Stats
  totalDepth: number;
  totalAffected: number;
}

// ============================================================================
// Dependency Graph
// ============================================================================

const dependencyGraph = new Map<string, DependencyNode>();

const DEFAULT_CASCADE_POLICY: CascadePolicy = {
  onDependencyPause: 'halt',
  onSelfPause: 'halt_dependents',
  autoResumeWithDependency: true,
  cascadeDelayMs: 0,
  maxCascadeDepth: 10,
};

// ============================================================================
// Dependency Management
// ============================================================================

/**
 * Register an agent with its dependencies
 */
export function registerAgentDependencies(
  agentId: string,
  dependsOn: string[],
  policy?: Partial<CascadePolicy>
): DependencyNode {
  const node: DependencyNode = {
    agentId,
    dependsOn,
    dependentAgents: [],
    cascadePolicy: { ...DEFAULT_CASCADE_POLICY, ...policy },
  };

  dependencyGraph.set(agentId, node);

  // Update parent nodes to include this as a dependent
  for (const parentId of dependsOn) {
    const parentNode = dependencyGraph.get(parentId);
    if (parentNode && !parentNode.dependentAgents.includes(agentId)) {
      parentNode.dependentAgents.push(agentId);
    }
  }

  // Also register with agent-control
  registerDependencies(agentId, dependsOn, node.dependentAgents);

  return node;
}

/**
 * Get dependency node for an agent
 */
export function getDependencyNode(agentId: string): DependencyNode | null {
  return dependencyGraph.get(agentId) || null;
}

/**
 * Get all agents that depend on a given agent (direct and transitive)
 */
export function getAllDependentAgents(
  agentId: string,
  maxDepth: number = 10
): string[] {
  const dependents: Set<string> = new Set();
  const visited: Set<string> = new Set();

  function traverse(currentId: string, depth: number) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const node = dependencyGraph.get(currentId);
    if (!node) return;

    for (const depId of node.dependentAgents) {
      dependents.add(depId);
      traverse(depId, depth + 1);
    }
  }

  traverse(agentId, 0);
  return Array.from(dependents);
}

/**
 * Get all agents that this agent depends on (direct and transitive)
 */
export function getAllDependencies(
  agentId: string,
  maxDepth: number = 10
): string[] {
  const dependencies: Set<string> = new Set();
  const visited: Set<string> = new Set();

  function traverse(currentId: string, depth: number) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const node = dependencyGraph.get(currentId);
    if (!node) return;

    for (const depId of node.dependsOn) {
      dependencies.add(depId);
      traverse(depId, depth + 1);
    }
  }

  traverse(agentId, 0);
  return Array.from(dependencies);
}

// ============================================================================
// Cascade Execution
// ============================================================================

/**
 * Execute cascade halt from a source agent
 */
export async function executeCascadeHalt(
  sourceAgentId: string,
  sourceReason: string,
  initiatedBy: string
): Promise<CascadeEvent> {
  const event: CascadeEvent = {
    id: `cascade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sourceAgentId,
    sourceReason,
    triggeredAt: new Date(),
    agentsHalted: [],
    agentsDegraded: [],
    agentsNotified: [],
    cascadePath: [],
    totalDepth: 0,
    totalAffected: 0,
  };

  const sourceNode = dependencyGraph.get(sourceAgentId);
  if (!sourceNode || sourceNode.cascadePolicy.onSelfPause === 'ignore') {
    event.completedAt = new Date();
    return event;
  }

  // Process cascade based on policy
  if (sourceNode.cascadePolicy.onSelfPause === 'notify_only') {
    // Just notify dependents, don't halt
    for (const depId of sourceNode.dependentAgents) {
      event.agentsNotified.push(depId);
      event.cascadePath.push({
        fromAgent: sourceAgentId,
        toAgent: depId,
        depth: 1,
        action: 'notify',
      });
    }
  } else {
    // Execute full cascade
    await processCascade(
      sourceAgentId,
      initiatedBy,
      event,
      new Set([sourceAgentId]),
      1
    );
  }

  event.completedAt = new Date();
  event.totalAffected =
    event.agentsHalted.length + event.agentsDegraded.length;

  return event;
}

/**
 * Process cascade recursively
 */
async function processCascade(
  currentAgentId: string,
  initiatedBy: string,
  event: CascadeEvent,
  visited: Set<string>,
  depth: number
): Promise<void> {
  const node = dependencyGraph.get(currentAgentId);
  if (!node) return;

  const maxDepth = node.cascadePolicy.maxCascadeDepth;
  if (depth > maxDepth) return;

  event.totalDepth = Math.max(event.totalDepth, depth);

  for (const depId of node.dependentAgents) {
    if (visited.has(depId)) continue;
    visited.add(depId);

    const depNode = dependencyGraph.get(depId);
    const policy = depNode?.cascadePolicy || DEFAULT_CASCADE_POLICY;

    // Apply delay if configured
    if (policy.cascadeDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, policy.cascadeDelayMs));
    }

    // Determine action based on dependent's policy
    let action: 'halt' | 'degrade' | 'notify' = 'halt';
    if (policy.onDependencyPause === 'degrade') {
      action = 'degrade';
    } else if (policy.onDependencyPause === 'continue') {
      action = 'notify';
    }

    event.cascadePath.push({
      fromAgent: currentAgentId,
      toAgent: depId,
      depth,
      action,
    });

    // Execute action
    switch (action) {
      case 'halt':
        await pauseAgent(
          depId,
          'cascade_halt',
          initiatedBy,
          'cascade',
          {
            notes: `Cascade from ${currentAgentId}: ${event.sourceReason}`,
            relatedIncidentId: event.id,
          }
        );
        event.agentsHalted.push(depId);

        // Continue cascade
        await processCascade(depId, initiatedBy, event, visited, depth + 1);
        break;

      case 'degrade':
        // Mark as degraded but don't fully halt
        event.agentsDegraded.push(depId);
        // Still propagate the cascade
        await processCascade(depId, initiatedBy, event, visited, depth + 1);
        break;

      case 'notify':
        event.agentsNotified.push(depId);
        // Don't propagate further
        break;
    }
  }
}

// ============================================================================
// Cascade Recovery
// ============================================================================

/**
 * Check if an agent can resume based on dependency health
 */
export function canResumeWithDependencies(agentId: string): {
  canResume: boolean;
  blockedBy: string[];
  reason?: string;
} {
  const node = dependencyGraph.get(agentId);
  if (!node) {
    return { canResume: true, blockedBy: [] };
  }

  const blockedBy: string[] = [];

  for (const depId of node.dependsOn) {
    const depState = getAgentState(depId);
    if (depState && depState.currentState !== 'active') {
      blockedBy.push(depId);
    }
  }

  if (blockedBy.length > 0) {
    return {
      canResume: false,
      blockedBy,
      reason: `Dependencies not active: ${blockedBy.join(', ')}`,
    };
  }

  return { canResume: true, blockedBy: [] };
}

/**
 * Get recommended resume order for a set of agents
 * Returns agents in order they should be resumed (dependencies first)
 */
export function getResumeOrder(agentIds: string[]): string[] {
  const order: string[] = [];
  const remaining = new Set(agentIds);
  const processed = new Set<string>();

  while (remaining.size > 0) {
    let progress = false;

    for (const agentId of remaining) {
      const node = dependencyGraph.get(agentId);

      // Agent can be resumed if all its dependencies are either:
      // 1. Not in the remaining set (already active or not being resumed)
      // 2. Already processed in this order
      const canResume = !node || node.dependsOn.every(
        depId => !remaining.has(depId) || processed.has(depId)
      );

      if (canResume) {
        order.push(agentId);
        processed.add(agentId);
        remaining.delete(agentId);
        progress = true;
      }
    }

    // Detect circular dependency
    if (!progress && remaining.size > 0) {
      // Add remaining agents anyway (circular dependency)
      for (const agentId of remaining) {
        order.push(agentId);
      }
      break;
    }
  }

  return order;
}

// ============================================================================
// Dependency Visualization
// ============================================================================

/**
 * Get dependency graph for visualization
 */
export function getDependencyGraphData(): {
  nodes: Array<{ id: string; dependsOn: string[]; dependentAgents: string[] }>;
  edges: Array<{ from: string; to: string; type: 'depends_on' }>;
} {
  const nodes: Array<{ id: string; dependsOn: string[]; dependentAgents: string[] }> = [];
  const edges: Array<{ from: string; to: string; type: 'depends_on' }> = [];

  for (const [agentId, node] of dependencyGraph) {
    nodes.push({
      id: agentId,
      dependsOn: node.dependsOn,
      dependentAgents: node.dependentAgents,
    });

    for (const depId of node.dependsOn) {
      edges.push({
        from: agentId,
        to: depId,
        type: 'depends_on',
      });
    }
  }

  return { nodes, edges };
}

/**
 * Clear dependency graph (for testing)
 */
export function clearDependencyGraph(): void {
  dependencyGraph.clear();
}
