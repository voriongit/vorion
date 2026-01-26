/**
 * Phase 6 Repository Implementations
 *
 * Type-safe database access for Phase 6 Trust Engine entities
 */

import { DatabaseClient, Repository, TransactionClient } from '../client';

// =============================================================================
// Types
// =============================================================================

export type TrustTier = 'UNKNOWN' | 'BASIC' | 'VERIFIED' | 'TRUSTED' | 'PRIVILEGED';
export type AgentRole =
  | 'READER'
  | 'WRITER'
  | 'DATA_ANALYST'
  | 'CODE_EXECUTOR'
  | 'SYSTEM_ADMIN'
  | 'EXTERNAL_COMMUNICATOR'
  | 'RESOURCE_MANAGER'
  | 'AUDITOR';
export type GateDecision = 'ALLOW' | 'DENY' | 'ESCALATE';
export type ProvenanceType = 'ROLE_GATE' | 'CEILING' | 'ESCALATION' | 'ALERT';
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type ResourceType = 'API_CALLS' | 'DATA_ACCESS' | 'COMPUTE' | 'STORAGE' | 'NETWORK';

// =============================================================================
// Entity Interfaces
// =============================================================================

export interface RoleGate {
  id: string;
  role: AgentRole;
  minimumTier: TrustTier;
  description?: string;
  conditions: RoleGateCondition[];
  enabled: boolean;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface RoleGateCondition {
  type: 'TIME_WINDOW' | 'RESOURCE_MATCH' | 'ENVIRONMENT' | 'CUSTOM';
  config: Record<string, unknown>;
}

export interface RoleGateEvaluation {
  id: string;
  gateId?: string;
  agentId: string;
  requestedRole: AgentRole;
  agentTier: TrustTier;
  decision: GateDecision;
  reason?: string;
  context: Record<string, unknown>;
  provenanceId?: string;
  evaluatedAt: Date;
  organizationId?: string;
}

export interface CapabilityCeiling {
  id: string;
  tier: TrustTier;
  resourceType: ResourceType;
  ceilingValue: number;
  windowSeconds: number;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapabilityUsage {
  id: string;
  agentId: string;
  resourceType: ResourceType;
  usageCount: number;
  windowStart: Date;
  windowEnd: Date;
  organizationId?: string;
  updatedAt: Date;
}

export interface ProvenanceRecord {
  id: string;
  type: ProvenanceType;
  agentId: string;
  decision: string;
  reason?: string;
  context: Record<string, unknown>;
  parentId?: string;
  merkleRoot?: string;
  signature?: string;
  organizationId?: string;
  createdAt: Date;
}

export interface GamingAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  agentId: string;
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  organizationId?: string;
}

export interface ACIPreset {
  id: string;
  name: string;
  description?: string;
  category: string;
  config: Record<string, unknown>;
  isBuiltin: boolean;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  organizationId?: string;
  createdAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

// =============================================================================
// Role Gates Repository
// =============================================================================

export class RoleGatesRepository extends Repository<RoleGate> {
  constructor(db: DatabaseClient) {
    super(db, 'phase6_role_gates');
  }

  protected mapRow(row: Record<string, unknown>): RoleGate {
    return {
      id: row.id as string,
      role: row.role as AgentRole,
      minimumTier: row.minimum_tier as TrustTier,
      description: row.description as string | undefined,
      conditions: (row.conditions as RoleGateCondition[]) || [],
      enabled: row.enabled as boolean,
      organizationId: row.organization_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string | undefined,
    };
  }

  async findByRole(role: AgentRole, organizationId?: string): Promise<RoleGate | null> {
    let sql = 'SELECT * FROM phase6_role_gates WHERE role = $1';
    const params: unknown[] = [role];

    if (organizationId) {
      sql += ' AND organization_id = $2';
      params.push(organizationId);
    } else {
      sql += ' AND organization_id IS NULL';
    }

    const row = await this.db.queryOne<Record<string, unknown>>(sql, params);
    return row ? this.mapRow(row) : null;
  }

  async findByTier(tier: TrustTier, organizationId?: string): Promise<RoleGate[]> {
    let sql = 'SELECT * FROM phase6_role_gates WHERE minimum_tier = $1';
    const params: unknown[] = [tier];

    if (organizationId) {
      sql += ' AND organization_id = $2';
      params.push(organizationId);
    }

    sql += ' ORDER BY role';

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async findEnabled(organizationId?: string): Promise<RoleGate[]> {
    let sql = 'SELECT * FROM phase6_role_gates WHERE enabled = true';
    const params: unknown[] = [];

    if (organizationId) {
      sql += ' AND organization_id = $1';
      params.push(organizationId);
    }

    sql += ' ORDER BY role';

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async create(gate: Omit<RoleGate, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoleGate> {
    const sql = `
      INSERT INTO phase6_role_gates (role, minimum_tier, description, conditions, enabled, organization_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, [
      gate.role,
      gate.minimumTier,
      gate.description,
      JSON.stringify(gate.conditions),
      gate.enabled,
      gate.organizationId,
      gate.createdBy,
    ]);

    return this.mapRow(row!);
  }

  async update(id: string, updates: Partial<RoleGate>): Promise<RoleGate | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.minimumTier !== undefined) {
      fields.push(`minimum_tier = $${paramIndex++}`);
      params.push(updates.minimumTier);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.conditions !== undefined) {
      fields.push(`conditions = $${paramIndex++}`);
      params.push(JSON.stringify(updates.conditions));
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      params.push(updates.enabled);
    }

    if (fields.length === 0) return this.findById(id);

    params.push(id);

    const sql = `
      UPDATE phase6_role_gates
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, params);
    return row ? this.mapRow(row) : null;
  }
}

// =============================================================================
// Role Gate Evaluations Repository
// =============================================================================

export class RoleGateEvaluationsRepository extends Repository<RoleGateEvaluation> {
  constructor(db: DatabaseClient) {
    super(db, 'phase6_role_gate_evaluations');
  }

  protected mapRow(row: Record<string, unknown>): RoleGateEvaluation {
    return {
      id: row.id as string,
      gateId: row.gate_id as string | undefined,
      agentId: row.agent_id as string,
      requestedRole: row.requested_role as AgentRole,
      agentTier: row.agent_tier as TrustTier,
      decision: row.decision as GateDecision,
      reason: row.reason as string | undefined,
      context: (row.context as Record<string, unknown>) || {},
      provenanceId: row.provenance_id as string | undefined,
      evaluatedAt: new Date(row.evaluated_at as string),
      organizationId: row.organization_id as string | undefined,
    };
  }

  async create(
    evaluation: Omit<RoleGateEvaluation, 'id' | 'evaluatedAt'>
  ): Promise<RoleGateEvaluation> {
    const sql = `
      INSERT INTO phase6_role_gate_evaluations
      (gate_id, agent_id, requested_role, agent_tier, decision, reason, context, provenance_id, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, [
      evaluation.gateId,
      evaluation.agentId,
      evaluation.requestedRole,
      evaluation.agentTier,
      evaluation.decision,
      evaluation.reason,
      JSON.stringify(evaluation.context),
      evaluation.provenanceId,
      evaluation.organizationId,
    ]);

    return this.mapRow(row!);
  }

  async findByAgent(
    agentId: string,
    options?: { limit?: number; offset?: number; startTime?: Date; endTime?: Date }
  ): Promise<RoleGateEvaluation[]> {
    let sql = 'SELECT * FROM phase6_role_gate_evaluations WHERE agent_id = $1';
    const params: unknown[] = [agentId];
    let paramIndex = 2;

    if (options?.startTime) {
      sql += ` AND evaluated_at >= $${paramIndex++}`;
      params.push(options.startTime);
    }
    if (options?.endTime) {
      sql += ` AND evaluated_at <= $${paramIndex++}`;
      params.push(options.endTime);
    }

    sql += ' ORDER BY evaluated_at DESC';

    if (options?.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async getStats(
    organizationId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    total: number;
    allowed: number;
    denied: number;
    escalated: number;
    byTier: Record<TrustTier, number>;
  }> {
    let whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (organizationId) {
      whereClauses.push(`organization_id = $${paramIndex++}`);
      params.push(organizationId);
    }
    if (timeRange) {
      whereClauses.push(`evaluated_at >= $${paramIndex++}`);
      params.push(timeRange.start);
      whereClauses.push(`evaluated_at <= $${paramIndex++}`);
      params.push(timeRange.end);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE decision = 'ALLOW') as allowed,
        COUNT(*) FILTER (WHERE decision = 'DENY') as denied,
        COUNT(*) FILTER (WHERE decision = 'ESCALATE') as escalated,
        agent_tier,
        COUNT(*) as tier_count
      FROM phase6_role_gate_evaluations
      ${whereClause}
      GROUP BY agent_tier
    `;

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, params);

    const byTier: Record<TrustTier, number> = {
      UNKNOWN: 0,
      BASIC: 0,
      VERIFIED: 0,
      TRUSTED: 0,
      PRIVILEGED: 0,
    };

    let total = 0, allowed = 0, denied = 0, escalated = 0;

    for (const row of rows) {
      total += parseInt(row.total as string, 10);
      allowed += parseInt(row.allowed as string, 10);
      denied += parseInt(row.denied as string, 10);
      escalated += parseInt(row.escalated as string, 10);
      byTier[row.agent_tier as TrustTier] = parseInt(row.tier_count as string, 10);
    }

    return { total, allowed, denied, escalated, byTier };
  }
}

// =============================================================================
// Capability Ceilings Repository
// =============================================================================

export class CapabilityCeilingsRepository extends Repository<CapabilityCeiling> {
  constructor(db: DatabaseClient) {
    super(db, 'phase6_capability_ceilings');
  }

  protected mapRow(row: Record<string, unknown>): CapabilityCeiling {
    return {
      id: row.id as string,
      tier: row.tier as TrustTier,
      resourceType: row.resource_type as ResourceType,
      ceilingValue: row.ceiling_value as number,
      windowSeconds: row.window_seconds as number,
      organizationId: row.organization_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async findByTierAndResource(
    tier: TrustTier,
    resourceType: ResourceType,
    organizationId?: string
  ): Promise<CapabilityCeiling | null> {
    let sql = `
      SELECT * FROM phase6_capability_ceilings
      WHERE tier = $1 AND resource_type = $2
    `;
    const params: unknown[] = [tier, resourceType];

    if (organizationId) {
      sql += ' AND organization_id = $3';
      params.push(organizationId);
    } else {
      sql += ' AND organization_id IS NULL';
    }

    const row = await this.db.queryOne<Record<string, unknown>>(sql, params);
    return row ? this.mapRow(row) : null;
  }

  async upsert(ceiling: Omit<CapabilityCeiling, 'id' | 'createdAt' | 'updatedAt'>): Promise<CapabilityCeiling> {
    const sql = `
      INSERT INTO phase6_capability_ceilings (tier, resource_type, ceiling_value, window_seconds, organization_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tier, resource_type, organization_id)
      DO UPDATE SET ceiling_value = $3, window_seconds = $4, updated_at = NOW()
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, [
      ceiling.tier,
      ceiling.resourceType,
      ceiling.ceilingValue,
      ceiling.windowSeconds,
      ceiling.organizationId,
    ]);

    return this.mapRow(row!);
  }
}

// =============================================================================
// Capability Usage Repository
// =============================================================================

export class CapabilityUsageRepository extends Repository<CapabilityUsage> {
  constructor(db: DatabaseClient) {
    super(db, 'phase6_capability_usage');
  }

  protected mapRow(row: Record<string, unknown>): CapabilityUsage {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      resourceType: row.resource_type as ResourceType,
      usageCount: row.usage_count as number,
      windowStart: new Date(row.window_start as string),
      windowEnd: new Date(row.window_end as string),
      organizationId: row.organization_id as string | undefined,
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async getCurrentUsage(
    agentId: string,
    resourceType: ResourceType,
    organizationId?: string
  ): Promise<number> {
    const now = new Date();
    let sql = `
      SELECT COALESCE(SUM(usage_count), 0) as total
      FROM phase6_capability_usage
      WHERE agent_id = $1 AND resource_type = $2 AND window_end > $3
    `;
    const params: unknown[] = [agentId, resourceType, now];

    if (organizationId) {
      sql += ' AND organization_id = $4';
      params.push(organizationId);
    }

    const row = await this.db.queryOne<{ total: string }>(sql, params);
    return parseInt(row?.total || '0', 10);
  }

  async incrementUsage(
    agentId: string,
    resourceType: ResourceType,
    amount: number,
    windowSeconds: number,
    organizationId?: string
  ): Promise<CapabilityUsage> {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
    const windowEnd = new Date(windowStart.getTime() + windowSeconds * 1000);

    const sql = `
      INSERT INTO phase6_capability_usage (agent_id, resource_type, usage_count, window_start, window_end, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (agent_id, resource_type, window_start)
      DO UPDATE SET usage_count = phase6_capability_usage.usage_count + $3, updated_at = NOW()
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, [
      agentId,
      resourceType,
      amount,
      windowStart,
      windowEnd,
      organizationId,
    ]);

    return this.mapRow(row!);
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM phase6_capability_usage WHERE window_end < NOW()'
    );
    return result.rowCount ?? 0;
  }
}

// =============================================================================
// Provenance Repository
// =============================================================================

export class ProvenanceRepository extends Repository<ProvenanceRecord> {
  constructor(db: DatabaseClient) {
    super(db, 'phase6_provenance');
  }

  protected mapRow(row: Record<string, unknown>): ProvenanceRecord {
    return {
      id: row.id as string,
      type: row.type as ProvenanceType,
      agentId: row.agent_id as string,
      decision: row.decision as string,
      reason: row.reason as string | undefined,
      context: (row.context as Record<string, unknown>) || {},
      parentId: row.parent_id as string | undefined,
      merkleRoot: row.merkle_root as string | undefined,
      signature: row.signature as string | undefined,
      organizationId: row.organization_id as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  async create(
    record: Omit<ProvenanceRecord, 'id' | 'createdAt'>
  ): Promise<ProvenanceRecord> {
    const sql = `
      INSERT INTO phase6_provenance
      (type, agent_id, decision, reason, context, parent_id, merkle_root, signature, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, [
      record.type,
      record.agentId,
      record.decision,
      record.reason,
      JSON.stringify(record.context),
      record.parentId,
      record.merkleRoot,
      record.signature,
      record.organizationId,
    ]);

    return this.mapRow(row!);
  }

  async findChain(id: string, maxDepth: number = 10): Promise<ProvenanceRecord[]> {
    const sql = `
      WITH RECURSIVE chain AS (
        SELECT *, 1 as depth FROM phase6_provenance WHERE id = $1
        UNION ALL
        SELECT p.*, c.depth + 1
        FROM phase6_provenance p
        INNER JOIN chain c ON p.id = c.parent_id
        WHERE c.depth < $2
      )
      SELECT * FROM chain ORDER BY depth
    `;

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, [id, maxDepth]);
    return rows.map((row) => this.mapRow(row));
  }

  async getStats(organizationId?: string): Promise<{ total: number; byType: Record<ProvenanceType, number> }> {
    let sql = `
      SELECT type, COUNT(*) as count
      FROM phase6_provenance
    `;
    const params: unknown[] = [];

    if (organizationId) {
      sql += ' WHERE organization_id = $1';
      params.push(organizationId);
    }

    sql += ' GROUP BY type';

    const rows = await this.db.queryAll<{ type: ProvenanceType; count: string }>(sql, params);

    const byType: Record<ProvenanceType, number> = {
      ROLE_GATE: 0,
      CEILING: 0,
      ESCALATION: 0,
      ALERT: 0,
    };

    let total = 0;
    for (const row of rows) {
      const count = parseInt(row.count, 10);
      byType[row.type] = count;
      total += count;
    }

    return { total, byType };
  }
}

// =============================================================================
// Alerts Repository
// =============================================================================

export class AlertsRepository extends Repository<GamingAlert> {
  constructor(db: DatabaseClient) {
    super(db, 'phase6_gaming_alerts');
  }

  protected mapRow(row: Record<string, unknown>): GamingAlert {
    return {
      id: row.id as string,
      type: row.type as string,
      severity: row.severity as AlertSeverity,
      status: row.status as AlertStatus,
      agentId: row.agent_id as string,
      description: row.description as string,
      evidence: (row.evidence as Record<string, unknown>) || {},
      detectedAt: new Date(row.detected_at as string),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
      acknowledgedBy: row.acknowledged_by as string | undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      resolvedBy: row.resolved_by as string | undefined,
      resolution: row.resolution as string | undefined,
      organizationId: row.organization_id as string | undefined,
    };
  }

  async create(alert: Omit<GamingAlert, 'id' | 'detectedAt' | 'status'>): Promise<GamingAlert> {
    const sql = `
      INSERT INTO phase6_gaming_alerts
      (type, severity, agent_id, description, evidence, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const row = await this.db.queryOne<Record<string, unknown>>(sql, [
      alert.type,
      alert.severity,
      alert.agentId,
      alert.description,
      JSON.stringify(alert.evidence),
      alert.organizationId,
    ]);

    return this.mapRow(row!);
  }

  async updateStatus(
    id: string,
    status: AlertStatus,
    options?: { userId?: string; resolution?: string }
  ): Promise<GamingAlert | null> {
    let sql: string;
    let params: unknown[];

    if (status === 'ACKNOWLEDGED') {
      sql = `
        UPDATE phase6_gaming_alerts
        SET status = $1, acknowledged_at = NOW(), acknowledged_by = $2
        WHERE id = $3
        RETURNING *
      `;
      params = [status, options?.userId, id];
    } else if (status === 'RESOLVED') {
      sql = `
        UPDATE phase6_gaming_alerts
        SET status = $1, resolved_at = NOW(), resolved_by = $2, resolution = $3
        WHERE id = $4
        RETURNING *
      `;
      params = [status, options?.userId, options?.resolution, id];
    } else {
      sql = `
        UPDATE phase6_gaming_alerts
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      params = [status, id];
    }

    const row = await this.db.queryOne<Record<string, unknown>>(sql, params);
    return row ? this.mapRow(row) : null;
  }

  async findActive(organizationId?: string): Promise<GamingAlert[]> {
    let sql = "SELECT * FROM phase6_gaming_alerts WHERE status = 'ACTIVE'";
    const params: unknown[] = [];

    if (organizationId) {
      sql += ' AND organization_id = $1';
      params.push(organizationId);
    }

    sql += ' ORDER BY severity, detected_at DESC';

    const rows = await this.db.queryAll<Record<string, unknown>>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async getStats(organizationId?: string): Promise<{ active: number; bySeverity: Record<AlertSeverity, number> }> {
    let sql = `
      SELECT severity, COUNT(*) as count
      FROM phase6_gaming_alerts
      WHERE status = 'ACTIVE'
    `;
    const params: unknown[] = [];

    if (organizationId) {
      sql += ' AND organization_id = $1';
      params.push(organizationId);
    }

    sql += ' GROUP BY severity';

    const rows = await this.db.queryAll<{ severity: AlertSeverity; count: string }>(sql, params);

    const bySeverity: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    let active = 0;
    for (const row of rows) {
      const count = parseInt(row.count, 10);
      bySeverity[row.severity] = count;
      active += count;
    }

    return { active, bySeverity };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export interface Phase6Repositories {
  roleGates: RoleGatesRepository;
  evaluations: RoleGateEvaluationsRepository;
  ceilings: CapabilityCeilingsRepository;
  usage: CapabilityUsageRepository;
  provenance: ProvenanceRepository;
  alerts: AlertsRepository;
}

export function createRepositories(db: DatabaseClient): Phase6Repositories {
  return {
    roleGates: new RoleGatesRepository(db),
    evaluations: new RoleGateEvaluationsRepository(db),
    ceilings: new CapabilityCeilingsRepository(db),
    usage: new CapabilityUsageRepository(db),
    provenance: new ProvenanceRepository(db),
    alerts: new AlertsRepository(db),
  };
}
