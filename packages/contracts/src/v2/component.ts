/**
 * Component types - for the ORION component registry
 */

import type { ComponentStatus, ComponentType, ObservationTier } from './enums.js';

/**
 * Component dependency
 */
export interface Dependency {
  /** Component ID of the dependency */
  componentId: string;
  /** Component name */
  name: string;
  /** Required version range (semver) */
  versionRange: string;
  /** Is this a required or optional dependency? */
  required: boolean;
}

/**
 * Component - a registered entity in the ORION platform
 */
export interface Component {
  /** Unique component identifier */
  componentId: string;
  /** Component name */
  name: string;
  /** Type of component */
  type: ComponentType;
  /** Current version */
  version: string;
  /** Lifecycle status */
  status: ComponentStatus;
  /** Owner (person or team) */
  owner: string;

  /** Human-readable description */
  description: string;
  /** Source repository URL */
  repository?: string;

  /** Dependencies on other components */
  dependencies: Dependency[];

  /** Associated trust profile ID */
  trustProfileId?: string;
  /** Observation tier for this component */
  observationTier?: ObservationTier;

  /** Component capabilities/tags */
  capabilities: string[];

  /** Configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;

  /** Lifecycle timestamps */
  createdAt: Date;
  updatedAt: Date;
  retiredAt?: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Component filter for queries
 */
export interface ComponentFilter {
  type?: ComponentType;
  status?: ComponentStatus;
  owner?: string;
  name?: string;
  capabilities?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Request to register a new component
 */
export interface RegisterComponentRequest {
  name: string;
  type: ComponentType;
  version: string;
  owner: string;
  description: string;
  repository?: string;
  dependencies?: Omit<Dependency, 'name'>[];
  observationTier?: ObservationTier;
  capabilities?: string[];
  configSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Request to update a component
 */
export interface UpdateComponentRequest {
  version?: string;
  status?: ComponentStatus;
  description?: string;
  repository?: string;
  dependencies?: Omit<Dependency, 'name'>[];
  observationTier?: ObservationTier;
  capabilities?: string[];
  configSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Component summary for listings
 */
export interface ComponentSummary {
  componentId: string;
  name: string;
  type: ComponentType;
  version: string;
  status: ComponentStatus;
  owner: string;
  observationTier?: ObservationTier;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dependency graph node
 */
export interface DependencyGraphNode {
  componentId: string;
  name: string;
  version: string;
  dependsOn: string[];
  dependedOnBy: string[];
  depth: number;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  rootComponentId: string;
  nodes: DependencyGraphNode[];
  maxDepth: number;
  totalDependencies: number;
  cyclicDependencies: string[][];
}
