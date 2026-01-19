/**
 * Aurais Infrastructure - Memory Service
 * 
 * Provides trust-gated access to memory primitives:
 * - Ephemeral (task-scoped) memory for UNTRUSTED
 * - Session (job-scoped) memory for PROBATIONARY
 * - Persistent scratchpad for TRUSTED+
 * - Shared knowledge graph read for VERIFIED+
 * - Shared knowledge graph write for CERTIFIED+
 * - Namespace creation for ELITE
 */

import {
  AgentId,
  TrustState,
  NamespaceId,
  MemoryNamespace,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  MerkleProof,
  ObserverEvent,
  ObserverEventType,
  MemoryPersistence,
  Timestamp,
  TickNumber,
} from '../types/core.js';
import { CapabilityResolver, capabilityResolver } from './CapabilityResolver.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WriteOptions {
  namespace?: NamespaceId;
  ttl?: number;
  sessionId?: string;
  taskId?: string;
}

export interface WriteResult {
  success: boolean;
  version?: number;
  error?: string;
  quotaRemaining?: number;
}

export interface ReadOptions {
  namespace?: NamespaceId;
  includeProof?: boolean;
}

export interface ReadResult {
  success: boolean;
  value?: unknown;
  version?: number;
  proof?: MerkleProof;
  error?: string;
}

export interface GraphQuery {
  nodeTypes?: string[];
  edgeTypes?: string[];
  properties?: Record<string, unknown>;
  fromNode?: string;
  toNode?: string;
  limit?: number;
  offset?: number;
}

export interface GraphQueryResult {
  success: boolean;
  nodes?: KnowledgeGraphNode[];
  edges?: KnowledgeGraphEdge[];
  totalCount?: number;
  error?: string;
}

export interface NamespaceConfig {
  name: string;
  quotaBytes: number;
  accessRules: MemoryNamespace['accessRules'];
  ttl?: number;
}

export interface MemoryUsage {
  persistent: { used: number; quota: number };
  session: { used: number };
  ephemeral: { used: number };
  namespaces: { id: NamespaceId; used: number; quota: number }[];
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

interface StoredEntry {
  value: unknown;
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: AgentId;
  updatedBy: AgentId;
  size: number;
  persistence: MemoryPersistence;
  sessionId?: string;
  taskId?: string;
}

export class MemoryService {
  private memory: Map<AgentId, Map<string, StoredEntry>> = new Map();
  private namespaces: Map<NamespaceId, MemoryNamespace> = new Map();
  private namespaceMemory: Map<NamespaceId, Map<string, StoredEntry>> = new Map();
  private graphNodes: Map<string, KnowledgeGraphNode> = new Map();
  private graphEdges: Map<string, KnowledgeGraphEdge> = new Map();
  private agentNamespaces: Map<AgentId, Set<NamespaceId>> = new Map();

  private eventEmitter: (event: ObserverEvent) => void;
  private currentTick: () => TickNumber;

  constructor(
    private resolver: CapabilityResolver = capabilityResolver,
    eventEmitter?: (event: ObserverEvent) => void,
    tickProvider?: () => TickNumber
  ) {
    this.eventEmitter = eventEmitter || (() => { });
    this.currentTick = tickProvider || (() => 0);
  }

  write(
    agentId: AgentId,
    trustState: TrustState,
    key: string,
    value: unknown,
    options: WriteOptions = {}
  ): WriteResult {
    const capabilities = this.resolver.getCapabilities(trustState);
    const size = this.calculateSize(value);

    if (capabilities.memory.persistence === MemoryPersistence.EPHEMERAL && !options.taskId) {
      return { success: false, error: 'UNTRUSTED tier requires taskId for ephemeral writes' };
    }

    const currentUsed = this.getCurrentUsage(agentId, capabilities.memory.persistence);
    if (currentUsed + size > capabilities.memory.quotaBytes) {
      return {
        success: false,
        error: `Quota exceeded: ${currentUsed + size} > ${capabilities.memory.quotaBytes}`,
        quotaRemaining: capabilities.memory.quotaBytes - currentUsed,
      };
    }

    if (!this.memory.has(agentId)) {
      this.memory.set(agentId, new Map());
    }
    const agentMemory = this.memory.get(agentId)!;

    const existing = agentMemory.get(key);
    const version = existing ? existing.version + 1 : 1;

    const entry: StoredEntry = {
      value,
      version,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: existing?.createdBy || agentId,
      updatedBy: agentId,
      size,
      persistence: capabilities.memory.persistence,
      sessionId: options.sessionId,
      taskId: options.taskId,
    };

    agentMemory.set(key, entry);

    this.emitEvent({
      agentId,
      eventType: ObserverEventType.MEMORY_WRITE,
      payload: { key, size, version, persistence: capabilities.memory.persistence },
    });

    return {
      success: true,
      version,
      quotaRemaining: capabilities.memory.quotaBytes - (currentUsed + size),
    };
  }

  read(agentId: AgentId, trustState: TrustState, key: string, options: ReadOptions = {}): ReadResult {
    const agentMemory = this.memory.get(agentId);
    if (!agentMemory) {
      return { success: false, error: 'No memory found for agent' };
    }

    const entry = agentMemory.get(key);
    if (!entry) {
      return { success: false, error: `Key not found: ${key}` };
    }

    return { success: true, value: entry.value, version: entry.version };
  }

  createGraphNode(
    agentId: AgentId,
    trustState: TrustState,
    node: Omit<KnowledgeGraphNode, 'id' | 'createdBy' | 'createdAt'>
  ): { success: boolean; nodeId?: string; error?: string } {
    const check = this.resolver.canPerform(trustState, { category: 'memory', action: 'write_graph' });
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const nodeId = this.generateId('node');
    const fullNode: KnowledgeGraphNode = {
      ...node,
      id: nodeId,
      createdBy: agentId,
      createdAt: Date.now(),
    };

    this.graphNodes.set(nodeId, fullNode);
    return { success: true, nodeId };
  }

  createGraphEdge(
    agentId: AgentId,
    trustState: TrustState,
    edge: Omit<KnowledgeGraphEdge, 'id' | 'createdBy' | 'createdAt'>
  ): { success: boolean; edgeId?: string; error?: string } {
    const check = this.resolver.canPerform(trustState, { category: 'memory', action: 'write_graph' });
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    if (!this.graphNodes.has(edge.fromNode) || !this.graphNodes.has(edge.toNode)) {
      return { success: false, error: 'Source or target node not found' };
    }

    const edgeId = this.generateId('edge');
    const fullEdge: KnowledgeGraphEdge = {
      ...edge,
      id: edgeId,
      createdBy: agentId,
      createdAt: Date.now(),
    };

    this.graphEdges.set(edgeId, fullEdge);
    return { success: true, edgeId };
  }

  queryGraph(agentId: AgentId, trustState: TrustState, query: GraphQuery): GraphQueryResult {
    const check = this.resolver.canPerform(trustState, { category: 'memory', action: 'read_graph' });
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    let nodes = Array.from(this.graphNodes.values());
    let edges = Array.from(this.graphEdges.values());

    if (query.nodeTypes?.length) {
      nodes = nodes.filter(n => query.nodeTypes!.includes(n.type));
    }
    if (query.edgeTypes?.length) {
      edges = edges.filter(e => query.edgeTypes!.includes(e.relationship));
    }
    if (query.fromNode) {
      edges = edges.filter(e => e.fromNode === query.fromNode);
    }
    if (query.toNode) {
      edges = edges.filter(e => e.toNode === query.toNode);
    }

    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return {
      success: true,
      nodes: nodes.slice(offset, offset + limit),
      edges: edges.slice(offset, offset + limit),
      totalCount: nodes.length + edges.length,
    };
  }

  createNamespace(
    agentId: AgentId,
    trustState: TrustState,
    config: NamespaceConfig
  ): { success: boolean; namespaceId?: NamespaceId; error?: string } {
    const check = this.resolver.canPerform(trustState, { category: 'memory', action: 'create_namespace' });
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const capabilities = this.resolver.getCapabilities(trustState);
    const currentNamespaces = this.agentNamespaces.get(agentId)?.size || 0;
    if (currentNamespaces >= capabilities.memory.namespaceQuota) {
      return { success: false, error: `Namespace quota exceeded (${capabilities.memory.namespaceQuota} max)` };
    }

    const namespaceId = this.generateId('ns') as NamespaceId;
    const namespace: MemoryNamespace = {
      id: namespaceId,
      ownerId: agentId,
      createdAt: Date.now(),
      quotaBytes: config.quotaBytes,
      usedBytes: 0,
      accessRules: config.accessRules,
      ttl: config.ttl,
    };

    this.namespaces.set(namespaceId, namespace);
    this.namespaceMemory.set(namespaceId, new Map());

    if (!this.agentNamespaces.has(agentId)) {
      this.agentNamespaces.set(agentId, new Set());
    }
    this.agentNamespaces.get(agentId)!.add(namespaceId);

    return { success: true, namespaceId };
  }

  getUsage(agentId: AgentId): MemoryUsage {
    const agentMemory = this.memory.get(agentId);
    let persistentUsed = 0, sessionUsed = 0, ephemeralUsed = 0;

    if (agentMemory) {
      for (const entry of agentMemory.values()) {
        switch (entry.persistence) {
          case MemoryPersistence.PERSISTENT: persistentUsed += entry.size; break;
          case MemoryPersistence.SESSION: sessionUsed += entry.size; break;
          case MemoryPersistence.EPHEMERAL: ephemeralUsed += entry.size; break;
        }
      }
    }

    const namespaceUsage: MemoryUsage['namespaces'] = [];
    const ownedNamespaces = this.agentNamespaces.get(agentId);
    if (ownedNamespaces) {
      for (const nsId of ownedNamespaces) {
        const ns = this.namespaces.get(nsId);
        if (ns) {
          namespaceUsage.push({ id: nsId, used: ns.usedBytes, quota: ns.quotaBytes });
        }
      }
    }

    return {
      persistent: { used: persistentUsed, quota: 0 },
      session: { used: sessionUsed },
      ephemeral: { used: ephemeralUsed },
      namespaces: namespaceUsage,
    };
  }

  clearSession(agentId: AgentId, sessionId: string): void {
    const agentMemory = this.memory.get(agentId);
    if (!agentMemory) return;

    for (const [key, entry] of agentMemory.entries()) {
      if (entry.sessionId === sessionId) {
        agentMemory.delete(key);
      }
    }
  }

  clearEphemeral(agentId: AgentId, taskId: string): void {
    const agentMemory = this.memory.get(agentId);
    if (!agentMemory) return;

    for (const [key, entry] of agentMemory.entries()) {
      if (entry.taskId === taskId) {
        agentMemory.delete(key);
      }
    }
  }

  private getCurrentUsage(agentId: AgentId, persistence: MemoryPersistence): number {
    const agentMemory = this.memory.get(agentId);
    if (!agentMemory) return 0;

    let used = 0;
    for (const entry of agentMemory.values()) {
      if (entry.persistence === persistence) {
        used += entry.size;
      }
    }
    return used;
  }

  private calculateSize(value: unknown): number {
    return JSON.stringify(value).length * 2;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(partial: Omit<ObserverEvent, 'id' | 'timestamp' | 'tick' | 'hash'>): void {
    const event: ObserverEvent = {
      id: this.generateId('evt') as any,
      timestamp: Date.now(),
      tick: this.currentTick(),
      hash: '',
      ...partial,
    };
    this.eventEmitter(event);
  }
}

export const memoryService = new MemoryService();
