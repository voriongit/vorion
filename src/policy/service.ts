/**
 * Policy Service
 *
 * Handles CRUD operations for policies with versioning and validation.
 *
 * @packageDocumentation
 */

import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import { createLogger } from '../common/logger.js';
import { getDatabase } from '../common/db.js';
import { policies, policyVersions } from '../intent/schema.js';
import type { ID } from '../common/types.js';
import type {
  Policy,
  PolicyVersion,
  PolicyDefinition,
  PolicyStatus,
  CreatePolicyInput,
  UpdatePolicyInput,
  PolicyListFilters,
  PolicyValidationResult,
  PolicyValidationError,
  PolicyRule,
  PolicyCondition,
  POLICY_STATUSES,
  CONDITION_OPERATORS,
} from './types.js';

const logger = createLogger({ component: 'policy-service' });

/**
 * Generate a checksum for a policy definition
 */
function generateChecksum(definition: PolicyDefinition): string {
  const json = JSON.stringify(definition, Object.keys(definition).sort());
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Validate a policy definition
 */
export function validatePolicyDefinition(definition: unknown): PolicyValidationResult {
  const errors: PolicyValidationError[] = [];

  if (!definition || typeof definition !== 'object') {
    errors.push({
      path: '',
      message: 'Policy definition must be an object',
      code: 'INVALID_TYPE',
    });
    return { valid: false, errors };
  }

  const def = definition as Record<string, unknown>;

  // Validate version
  if (def.version !== '1.0') {
    errors.push({
      path: 'version',
      message: 'Policy version must be "1.0"',
      code: 'INVALID_VERSION',
    });
  }

  // Validate rules array
  if (!Array.isArray(def.rules)) {
    errors.push({
      path: 'rules',
      message: 'Policy must have a rules array',
      code: 'MISSING_RULES',
    });
  } else {
    // Validate each rule
    def.rules.forEach((rule, index) => {
      const ruleErrors = validateRule(rule, `rules[${index}]`);
      errors.push(...ruleErrors);
    });
  }

  // Validate defaultAction
  const validActions = ['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate'];
  if (!validActions.includes(def.defaultAction as string)) {
    errors.push({
      path: 'defaultAction',
      message: `defaultAction must be one of: ${validActions.join(', ')}`,
      code: 'INVALID_DEFAULT_ACTION',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single rule
 */
function validateRule(rule: unknown, path: string): PolicyValidationError[] {
  const errors: PolicyValidationError[] = [];

  if (!rule || typeof rule !== 'object') {
    errors.push({
      path,
      message: 'Rule must be an object',
      code: 'INVALID_RULE_TYPE',
    });
    return errors;
  }

  const r = rule as Record<string, unknown>;

  // Required fields
  if (typeof r.id !== 'string' || !r.id) {
    errors.push({
      path: `${path}.id`,
      message: 'Rule must have a string id',
      code: 'MISSING_RULE_ID',
    });
  }

  if (typeof r.name !== 'string' || !r.name) {
    errors.push({
      path: `${path}.name`,
      message: 'Rule must have a string name',
      code: 'MISSING_RULE_NAME',
    });
  }

  if (typeof r.priority !== 'number') {
    errors.push({
      path: `${path}.priority`,
      message: 'Rule must have a numeric priority',
      code: 'MISSING_PRIORITY',
    });
  }

  // Validate when condition
  if (!r.when) {
    errors.push({
      path: `${path}.when`,
      message: 'Rule must have a when condition',
      code: 'MISSING_WHEN',
    });
  } else {
    const conditionErrors = validateCondition(r.when, `${path}.when`);
    errors.push(...conditionErrors);
  }

  // Validate then action
  if (!r.then || typeof r.then !== 'object') {
    errors.push({
      path: `${path}.then`,
      message: 'Rule must have a then action',
      code: 'MISSING_THEN',
    });
  } else {
    const then = r.then as Record<string, unknown>;
    const validActions = ['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate'];
    if (!validActions.includes(then.action as string)) {
      errors.push({
        path: `${path}.then.action`,
        message: `Action must be one of: ${validActions.join(', ')}`,
        code: 'INVALID_ACTION',
      });
    }
  }

  return errors;
}

/**
 * Validate a condition
 */
function validateCondition(condition: unknown, path: string): PolicyValidationError[] {
  const errors: PolicyValidationError[] = [];

  if (!condition || typeof condition !== 'object') {
    errors.push({
      path,
      message: 'Condition must be an object',
      code: 'INVALID_CONDITION_TYPE',
    });
    return errors;
  }

  const c = condition as Record<string, unknown>;

  switch (c.type) {
    case 'field':
      if (typeof c.field !== 'string') {
        errors.push({
          path: `${path}.field`,
          message: 'Field condition must specify a field path',
          code: 'MISSING_FIELD_PATH',
        });
      }
      if (typeof c.operator !== 'string') {
        errors.push({
          path: `${path}.operator`,
          message: 'Field condition must specify an operator',
          code: 'MISSING_OPERATOR',
        });
      }
      break;

    case 'compound':
      if (!['and', 'or', 'not'].includes(c.operator as string)) {
        errors.push({
          path: `${path}.operator`,
          message: 'Compound operator must be "and", "or", or "not"',
          code: 'INVALID_LOGICAL_OPERATOR',
        });
      }
      if (!Array.isArray(c.conditions)) {
        errors.push({
          path: `${path}.conditions`,
          message: 'Compound condition must have conditions array',
          code: 'MISSING_CONDITIONS',
        });
      } else {
        c.conditions.forEach((subCond, i) => {
          errors.push(...validateCondition(subCond, `${path}.conditions[${i}]`));
        });
      }
      break;

    case 'trust':
      if (typeof c.level !== 'number' || c.level < 0 || c.level > 4) {
        errors.push({
          path: `${path}.level`,
          message: 'Trust level must be a number between 0 and 4',
          code: 'INVALID_TRUST_LEVEL',
        });
      }
      break;

    case 'time':
      if (!['hour', 'dayOfWeek', 'date'].includes(c.field as string)) {
        errors.push({
          path: `${path}.field`,
          message: 'Time field must be "hour", "dayOfWeek", or "date"',
          code: 'INVALID_TIME_FIELD',
        });
      }
      break;

    default:
      errors.push({
        path: `${path}.type`,
        message: 'Condition type must be "field", "compound", "trust", or "time"',
        code: 'INVALID_CONDITION_TYPE',
      });
  }

  return errors;
}

/**
 * Policy Service class
 */
export class PolicyService {
  /**
   * Create a new policy
   */
  async create(tenantId: ID, input: CreatePolicyInput): Promise<Policy> {
    const db = getDatabase();

    // Validate definition
    const validation = validatePolicyDefinition(input.definition);
    if (!validation.valid) {
      throw new PolicyValidationException('Invalid policy definition', validation.errors);
    }

    const checksum = generateChecksum(input.definition);

    const [row] = await db
      .insert(policies)
      .values({
        tenantId,
        name: input.name,
        namespace: input.namespace ?? 'default',
        description: input.description,
        version: 1,
        status: 'draft',
        definition: input.definition,
        checksum,
        createdBy: input.createdBy,
      })
      .returning();

    logger.info(
      { policyId: row.id, name: input.name, tenantId },
      'Policy created'
    );

    return this.rowToPolicy(row);
  }

  /**
   * Get a policy by ID
   */
  async findById(id: ID, tenantId: ID): Promise<Policy | null> {
    const db = getDatabase();

    const [row] = await db
      .select()
      .from(policies)
      .where(and(eq(policies.id, id), eq(policies.tenantId, tenantId)))
      .limit(1);

    return row ? this.rowToPolicy(row) : null;
  }

  /**
   * Get a policy by name and namespace
   */
  async findByName(
    tenantId: ID,
    name: string,
    namespace: string = 'default'
  ): Promise<Policy | null> {
    const db = getDatabase();

    const [row] = await db
      .select()
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          eq(policies.name, name),
          eq(policies.namespace, namespace)
        )
      )
      .orderBy(desc(policies.version))
      .limit(1);

    return row ? this.rowToPolicy(row) : null;
  }

  /**
   * Update a policy (creates new version)
   */
  async update(id: ID, tenantId: ID, input: UpdatePolicyInput): Promise<Policy | null> {
    const db = getDatabase();

    const existing = await this.findById(id, tenantId);
    if (!existing) return null;

    // Validate new definition if provided
    if (input.definition) {
      const validation = validatePolicyDefinition(input.definition);
      if (!validation.valid) {
        throw new PolicyValidationException('Invalid policy definition', validation.errors);
      }
    }

    const newDefinition = input.definition ?? existing.definition;
    const newChecksum = generateChecksum(newDefinition);
    const newVersion = existing.version + 1;

    // Start transaction
    return await db.transaction(async (tx) => {
      // Archive current version
      await tx.insert(policyVersions).values({
        policyId: existing.id,
        version: existing.version,
        definition: existing.definition,
        checksum: existing.checksum,
        changeSummary: input.changeSummary,
        createdBy: input.updatedBy,
      });

      // Update policy
      const [updated] = await tx
        .update(policies)
        .set({
          description: input.description ?? existing.description,
          definition: newDefinition,
          checksum: newChecksum,
          version: newVersion,
          status: input.status ?? existing.status,
          updatedAt: new Date(),
          publishedAt: input.status === 'published' ? new Date() : (existing.publishedAt ? new Date(existing.publishedAt) : null),
        })
        .where(and(eq(policies.id, id), eq(policies.tenantId, tenantId)))
        .returning();

      logger.info(
        { policyId: id, version: newVersion, tenantId },
        'Policy updated'
      );

      return this.rowToPolicy(updated);
    });
  }

  /**
   * Publish a policy (makes it active)
   */
  async publish(id: ID, tenantId: ID): Promise<Policy | null> {
    return this.update(id, tenantId, { status: 'published' });
  }

  /**
   * Deprecate a policy
   */
  async deprecate(id: ID, tenantId: ID): Promise<Policy | null> {
    return this.update(id, tenantId, { status: 'deprecated' });
  }

  /**
   * Archive a policy
   */
  async archive(id: ID, tenantId: ID): Promise<Policy | null> {
    return this.update(id, tenantId, { status: 'archived' });
  }

  /**
   * List policies with filters
   */
  async list(filters: PolicyListFilters): Promise<Policy[]> {
    const db = getDatabase();
    const { tenantId, namespace, status, name, limit = 50, offset = 0 } = filters;

    const conditions = [eq(policies.tenantId, tenantId)];

    if (namespace) {
      conditions.push(eq(policies.namespace, namespace));
    }
    if (status) {
      conditions.push(eq(policies.status, status));
    }
    // Note: name filtering would need LIKE, implementing simple exact match for now

    const rows = await db
      .select()
      .from(policies)
      .where(and(...conditions))
      .orderBy(desc(policies.updatedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.rowToPolicy(row));
  }

  /**
   * Get published policies for evaluation
   */
  async getPublishedPolicies(tenantId: ID, namespace?: string): Promise<Policy[]> {
    return this.list({
      tenantId,
      namespace,
      status: 'published',
    });
  }

  /**
   * Get policy versions
   */
  async getVersionHistory(id: ID, tenantId: ID): Promise<PolicyVersion[]> {
    const db = getDatabase();

    // First verify the policy belongs to the tenant
    const policy = await this.findById(id, tenantId);
    if (!policy) return [];

    const rows = await db
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.policyId, id))
      .orderBy(desc(policyVersions.version));

    return rows.map((row) => ({
      id: row.id,
      policyId: row.policyId,
      version: row.version,
      definition: row.definition as PolicyDefinition,
      checksum: row.checksum,
      changeSummary: row.changeSummary,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Delete a policy (soft delete - archives it)
   */
  async delete(id: ID, tenantId: ID): Promise<boolean> {
    const result = await this.archive(id, tenantId);
    return result !== null;
  }

  /**
   * Convert database row to Policy object
   */
  private rowToPolicy(row: typeof policies.$inferSelect): Policy {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      namespace: row.namespace,
      description: row.description,
      version: row.version,
      status: row.status as PolicyStatus,
      definition: row.definition as PolicyDefinition,
      checksum: row.checksum,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }
}

/**
 * Custom error for policy validation failures
 */
export class PolicyValidationException extends Error {
  public readonly errors: PolicyValidationError[];

  constructor(message: string, errors: PolicyValidationError[]) {
    super(message);
    this.name = 'PolicyValidationException';
    this.errors = errors;
  }
}

/**
 * Create a new policy service instance
 */
export function createPolicyService(): PolicyService {
  return new PolicyService();
}
