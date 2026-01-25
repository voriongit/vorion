/**
 * DEPENDENCY RESOLVER
 *
 * Handles dependency graph operations for execution plans.
 * Supports topological sorting and circular dependency detection.
 */

import { createLogger } from '../../common/logger.js';

const logger = createLogger({ component: 'dependency-resolver' });

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends Error {
  constructor(
    public cycle: string[],
    message?: string
  ) {
    super(message ?? `Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when dependencies reference unknown steps
 */
export class InvalidDependencyError extends Error {
  constructor(
    public stepId: string,
    public unknownDep: string
  ) {
    super(`Step "${stepId}" depends on unknown step "${unknownDep}"`);
    this.name = 'InvalidDependencyError';
  }
}

/**
 * Node state for DFS traversal
 */
type NodeState = 'unvisited' | 'visiting' | 'visited';

/**
 * DependencyResolver - Manages step dependencies and execution ordering
 */
export class DependencyResolver {
  /**
   * Validate that all dependencies reference existing steps
   */
  validateDependencies(
    steps: { id: string }[],
    dependencies: Record<string, string[]>
  ): void {
    const stepIds = new Set(steps.map(s => s.id));

    for (const [stepId, deps] of Object.entries(dependencies)) {
      // Check if the step exists (optional - may define deps for steps not yet added)
      if (!stepIds.has(stepId)) {
        logger.warn(
          { stepId },
          'Dependencies defined for non-existent step'
        );
      }

      // Check if all dependencies exist
      for (const dep of deps) {
        if (!stepIds.has(dep)) {
          throw new InvalidDependencyError(stepId, dep);
        }
      }
    }
  }

  /**
   * Get execution order using topological sort (Kahn's algorithm)
   * Throws CircularDependencyError if cycles are detected.
   */
  getExecutionOrder(
    stepIds: string[],
    dependencies: Record<string, string[]>
  ): string[] {
    if (stepIds.length === 0) {
      return [];
    }

    // Build in-degree map and adjacency list
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize all nodes
    for (const id of stepIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    // Build graph from dependencies
    // If A depends on B, then B -> A (B must complete before A)
    for (const [stepId, deps] of Object.entries(dependencies)) {
      if (!inDegree.has(stepId)) continue;

      for (const dep of deps) {
        if (!inDegree.has(dep)) continue;

        // Add edge from dependency to dependent
        adjacency.get(dep)!.push(stepId);
        inDegree.set(stepId, inDegree.get(stepId)! + 1);
      }
    }

    // Find all nodes with no incoming edges
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // For each neighbor, reduce in-degree
      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If we didn't process all nodes, there's a cycle
    if (result.length !== stepIds.length) {
      const cycle = this.findCycle(stepIds, dependencies);
      throw new CircularDependencyError(cycle);
    }

    return result;
  }

  /**
   * Find a cycle in the dependency graph using DFS
   */
  findCycle(
    stepIds: string[],
    dependencies: Record<string, string[]>
  ): string[] {
    const state = new Map<string, NodeState>();
    const parent = new Map<string, string | null>();

    for (const id of stepIds) {
      state.set(id, 'unvisited');
      parent.set(id, null);
    }

    // Build adjacency (dependency -> dependent)
    const adjacency = new Map<string, string[]>();
    for (const id of stepIds) {
      adjacency.set(id, []);
    }
    for (const [stepId, deps] of Object.entries(dependencies)) {
      if (!adjacency.has(stepId)) continue;
      for (const dep of deps) {
        if (adjacency.has(dep)) {
          adjacency.get(dep)!.push(stepId);
        }
      }
    }

    // DFS to find cycle
    const dfs = (node: string, path: string[]): string[] | null => {
      state.set(node, 'visiting');
      path.push(node);

      for (const neighbor of adjacency.get(node) ?? []) {
        const neighborState = state.get(neighbor);

        if (neighborState === 'visiting') {
          // Found a cycle - extract the cycle path
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor); // Complete the cycle
          return cycle;
        }

        if (neighborState === 'unvisited') {
          const result = dfs(neighbor, path);
          if (result) return result;
        }
      }

      state.set(node, 'visited');
      path.pop();
      return null;
    };

    for (const id of stepIds) {
      if (state.get(id) === 'unvisited') {
        const cycle = dfs(id, []);
        if (cycle) return cycle;
      }
    }

    // Shouldn't reach here if there's actually a cycle
    return ['unknown'];
  }

  /**
   * Get execution levels for parallel execution
   * Steps in the same level have no dependencies between them
   */
  getExecutionLevels(
    stepIds: string[],
    dependencies: Record<string, string[]>
  ): string[][] {
    if (stepIds.length === 0) {
      return [];
    }

    // Get topological order first (validates no cycles)
    const order = this.getExecutionOrder(stepIds, dependencies);

    // Calculate level for each node
    const levels = new Map<string, number>();

    for (const id of order) {
      const deps = dependencies[id] ?? [];
      if (deps.length === 0) {
        levels.set(id, 0);
      } else {
        // Level is max of dependency levels + 1
        const maxDepLevel = Math.max(
          ...deps.map(dep => levels.get(dep) ?? 0)
        );
        levels.set(id, maxDepLevel + 1);
      }
    }

    // Group by level
    const maxLevel = Math.max(...levels.values());
    const result: string[][] = [];

    for (let i = 0; i <= maxLevel; i++) {
      const levelNodes = order.filter(id => levels.get(id) === i);
      if (levelNodes.length > 0) {
        result.push(levelNodes);
      }
    }

    return result;
  }

  /**
   * Build reverse dependency map (step -> steps that depend on it)
   */
  buildReverseDependencyMap(
    stepIds: string[],
    dependencies: Record<string, string[]>
  ): Record<string, string[]> {
    const reverse: Record<string, string[]> = {};

    // Initialize all steps
    for (const id of stepIds) {
      reverse[id] = [];
    }

    // Build reverse map
    for (const [stepId, deps] of Object.entries(dependencies)) {
      for (const dep of deps) {
        if (reverse[dep]) {
          reverse[dep].push(stepId);
        }
      }
    }

    return reverse;
  }

  /**
   * Get all transitive dependencies of a step
   */
  getTransitiveDependencies(
    stepId: string,
    dependencies: Record<string, string[]>
  ): Set<string> {
    const result = new Set<string>();
    const queue = [...(dependencies[stepId] ?? [])];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      result.add(current);

      for (const dep of dependencies[current] ?? []) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return result;
  }

  /**
   * Get all transitive dependents of a step (steps that depend on it)
   */
  getTransitiveDependents(
    stepId: string,
    stepIds: string[],
    dependencies: Record<string, string[]>
  ): Set<string> {
    const reverse = this.buildReverseDependencyMap(stepIds, dependencies);
    const result = new Set<string>();
    const queue = [...(reverse[stepId] ?? [])];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      result.add(current);

      for (const dep of reverse[current] ?? []) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return result;
  }

  /**
   * Check if adding a dependency would create a cycle
   */
  wouldCreateCycle(
    stepId: string,
    newDependency: string,
    stepIds: string[],
    dependencies: Record<string, string[]>
  ): boolean {
    // A cycle would be created if newDependency transitively depends on stepId
    const transitiveDeps = this.getTransitiveDependencies(newDependency, dependencies);
    return transitiveDeps.has(stepId);
  }

  /**
   * Get the critical path (longest path through the graph)
   * Returns step IDs in the critical path and total duration
   */
  getCriticalPath(
    steps: { id: string; estimatedDuration?: number }[],
    dependencies: Record<string, string[]>
  ): { path: string[]; duration: number } {
    if (steps.length === 0) {
      return { path: [], duration: 0 };
    }

    const order = this.getExecutionOrder(
      steps.map(s => s.id),
      dependencies
    );

    const durations = new Map<string, number>();
    for (const step of steps) {
      durations.set(step.id, step.estimatedDuration ?? 0);
    }

    // Calculate longest path to each node
    const longestPath = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    for (const id of order) {
      predecessor.set(id, null);
      const deps = dependencies[id] ?? [];

      if (deps.length === 0) {
        longestPath.set(id, durations.get(id)!);
      } else {
        let maxPrev = 0;
        let maxPredecessor: string | null = null;

        for (const dep of deps) {
          const depPath = longestPath.get(dep) ?? 0;
          if (depPath > maxPrev) {
            maxPrev = depPath;
            maxPredecessor = dep;
          }
        }

        longestPath.set(id, maxPrev + durations.get(id)!);
        predecessor.set(id, maxPredecessor);
      }
    }

    // Find the node with longest path
    let maxNode = order[0];
    let maxDuration = longestPath.get(maxNode) ?? 0;

    for (const id of order) {
      const pathLen = longestPath.get(id) ?? 0;
      if (pathLen > maxDuration) {
        maxDuration = pathLen;
        maxNode = id;
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = maxNode;

    while (current) {
      path.unshift(current);
      current = predecessor.get(current) ?? null;
    }

    return { path, duration: maxDuration };
  }
}

/**
 * Create a new dependency resolver instance
 */
export function createDependencyResolver(): DependencyResolver {
  return new DependencyResolver();
}
