/**
 * BASIS Rule Parser
 *
 * Parses YAML/JSON rule definitions into executable rules.
 */

import { z } from 'zod';
import { createLogger } from '../common/logger.js';
import type { RuleNamespace, Rule } from './types.js';

const logger = createLogger({ component: 'basis-parser' });

/**
 * Schema for rule condition
 */
const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'in',
    'not_in',
    'contains',
    'not_contains',
    'matches',
    'exists',
    'not_exists',
  ]),
  value: z.unknown(),
});

/**
 * Schema for rule when clause
 */
const whenSchema = z.object({
  intentType: z.union([z.string(), z.array(z.string())]).optional(),
  entityType: z.union([z.string(), z.array(z.string())]).optional(),
  conditions: z.array(conditionSchema).optional(),
});

/**
 * Schema for escalation config
 */
const escalationSchema = z.object({
  to: z.string(),
  timeout: z.string(),
  requireJustification: z.boolean().optional(),
  autoDenyOnTimeout: z.boolean().optional(),
});

/**
 * Schema for rule evaluation step
 */
const evaluationSchema = z.object({
  condition: z.string(),
  result: z.enum(['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate']),
  reason: z.string().optional(),
  escalation: escalationSchema.optional(),
});

/**
 * Schema for individual rule
 */
const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  priority: z.number().default(100),
  enabled: z.boolean().default(true),
  when: whenSchema,
  evaluate: z.array(evaluationSchema),
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for rule namespace
 */
const namespaceSchema = z.object({
  namespace: z.string(),
  description: z.string().default(''),
  version: z.string().default('1.0.0'),
  rules: z.array(ruleSchema),
});

export type RuleDefinition = z.infer<typeof ruleSchema>;
export type NamespaceDefinition = z.infer<typeof namespaceSchema>;

/**
 * Parse a rule namespace from a definition object
 */
export function parseNamespace(definition: unknown): RuleNamespace {
  const parsed = namespaceSchema.parse(definition);
  const timestamp = new Date().toISOString();

  const rules: Rule[] = parsed.rules.map((r) => {
    const when: Rule['when'] = {};
    if (r.when.intentType !== undefined) when.intentType = r.when.intentType;
    if (r.when.entityType !== undefined) when.entityType = r.when.entityType;
    if (r.when.conditions !== undefined) {
      when.conditions = r.when.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      }));
    }

    const evaluate: Rule['evaluate'] = r.evaluate.map((e) => {
      const evalItem: Rule['evaluate'][number] = {
        condition: e.condition,
        result: e.result,
      };
      if (e.reason !== undefined) evalItem.reason = e.reason;
      if (e.escalation !== undefined) {
        const escalation: NonNullable<typeof evalItem.escalation> = {
          to: e.escalation.to,
          timeout: e.escalation.timeout,
        };
        if (e.escalation.requireJustification !== undefined) {
          escalation.requireJustification = e.escalation.requireJustification;
        }
        if (e.escalation.autoDenyOnTimeout !== undefined) {
          escalation.autoDenyOnTimeout = e.escalation.autoDenyOnTimeout;
        }
        evalItem.escalation = escalation;
      }
      return evalItem;
    });

    return {
      ...r,
      when,
      evaluate,
    };
  });

  logger.info(
    { namespace: parsed.namespace, ruleCount: rules.length },
    'Namespace parsed'
  );

  return {
    id: crypto.randomUUID(),
    name: parsed.namespace,
    description: parsed.description,
    version: parsed.version,
    rules,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Validate a rule definition
 */
export function validateRule(definition: unknown): {
  valid: boolean;
  errors: string[];
} {
  try {
    ruleSchema.parse(definition);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate a namespace definition
 */
export function validateNamespace(definition: unknown): {
  valid: boolean;
  errors: string[];
} {
  try {
    namespaceSchema.parse(definition);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}
