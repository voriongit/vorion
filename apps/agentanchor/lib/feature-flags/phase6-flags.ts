/**
 * Phase 6 Feature Flags System
 *
 * Enterprise feature flag management with gradual rollouts,
 * user targeting, and A/B testing support
 */

// =============================================================================
// Types
// =============================================================================

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  defaultValue: boolean;
  rules: FlagRule[];
  variants?: FlagVariant[];
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface FlagRule {
  id: string;
  conditions: FlagCondition[];
  percentage?: number; // 0-100 for gradual rollout
  variant?: string;
  enabled: boolean;
}

export interface FlagCondition {
  attribute: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'matches_regex';

export interface FlagVariant {
  key: string;
  name: string;
  weight: number; // 0-100
  payload?: Record<string, unknown>;
}

export interface EvaluationContext {
  userId?: string;
  organizationId?: string;
  userRole?: string;
  environment?: string;
  platform?: string;
  version?: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  variant?: string;
  payload?: Record<string, unknown>;
  reason: EvaluationReason;
  ruleId?: string;
}

export type EvaluationReason =
  | 'FLAG_DISABLED'
  | 'DEFAULT_VALUE'
  | 'RULE_MATCH'
  | 'PERCENTAGE_ROLLOUT'
  | 'VARIANT_ASSIGNMENT'
  | 'ERROR';

// =============================================================================
// Feature Flag Definitions
// =============================================================================

export const PHASE6_FLAGS: Record<string, Omit<FeatureFlag, 'createdAt' | 'updatedAt'>> = {
  // Core Features
  'phase6.role_gates.enabled': {
    key: 'phase6.role_gates.enabled',
    name: 'Role Gates',
    description: 'Enable role-based access control gates',
    enabled: true,
    defaultValue: true,
    rules: [],
    tags: ['core', 'security'],
  },
  'phase6.ceiling.enabled': {
    key: 'phase6.ceiling.enabled',
    name: 'Capability Ceiling',
    description: 'Enable capability ceiling enforcement',
    enabled: true,
    defaultValue: true,
    rules: [],
    tags: ['core', 'limits'],
  },
  'phase6.provenance.merkle_enabled': {
    key: 'phase6.provenance.merkle_enabled',
    name: 'Merkle Provenance',
    description: 'Enable Merkle tree integrity for provenance records',
    enabled: true,
    defaultValue: true,
    rules: [],
    tags: ['core', 'security'],
  },
  'phase6.gaming_detection.enabled': {
    key: 'phase6.gaming_detection.enabled',
    name: 'Gaming Detection',
    description: 'Enable gaming/abuse detection algorithms',
    enabled: true,
    defaultValue: true,
    rules: [],
    tags: ['core', 'security'],
  },

  // Beta Features
  'phase6.beta.ml_scoring': {
    key: 'phase6.beta.ml_scoring',
    name: 'ML Trust Scoring',
    description: 'Use machine learning for trust score calculation',
    enabled: false,
    defaultValue: false,
    rules: [
      {
        id: 'beta-users',
        conditions: [{ attribute: 'userRole', operator: 'in', value: ['admin', 'beta_tester'] }],
        enabled: true,
      },
    ],
    tags: ['beta', 'ml'],
  },
  'phase6.beta.real_time_alerts': {
    key: 'phase6.beta.real_time_alerts',
    name: 'Real-time Alerts',
    description: 'Enable real-time WebSocket alert notifications',
    enabled: false,
    defaultValue: false,
    rules: [
      {
        id: 'gradual-rollout',
        conditions: [],
        percentage: 25,
        enabled: true,
      },
    ],
    tags: ['beta', 'notifications'],
  },

  // Experiments
  'phase6.experiment.new_dashboard': {
    key: 'phase6.experiment.new_dashboard',
    name: 'New Dashboard UI',
    description: 'A/B test for new dashboard design',
    enabled: true,
    defaultValue: false,
    rules: [],
    variants: [
      { key: 'control', name: 'Original', weight: 50 },
      { key: 'treatment', name: 'New Design', weight: 50 },
    ],
    tags: ['experiment', 'ui'],
  },

  // Enterprise Features
  'phase6.enterprise.multi_tenancy': {
    key: 'phase6.enterprise.multi_tenancy',
    name: 'Multi-tenancy',
    description: 'Enable organization-based data isolation',
    enabled: true,
    defaultValue: false,
    rules: [
      {
        id: 'enterprise-plans',
        conditions: [{ attribute: 'plan', operator: 'in', value: ['professional', 'enterprise'] }],
        enabled: true,
      },
    ],
    tags: ['enterprise'],
  },
  'phase6.enterprise.sso': {
    key: 'phase6.enterprise.sso',
    name: 'SSO Integration',
    description: 'Enable SAML/OIDC single sign-on',
    enabled: true,
    defaultValue: false,
    rules: [
      {
        id: 'enterprise-only',
        conditions: [{ attribute: 'plan', operator: 'equals', value: 'enterprise' }],
        enabled: true,
      },
    ],
    tags: ['enterprise', 'auth'],
  },
  'phase6.enterprise.audit_export': {
    key: 'phase6.enterprise.audit_export',
    name: 'Audit Log Export',
    description: 'Enable audit log export to external systems',
    enabled: true,
    defaultValue: false,
    rules: [
      {
        id: 'enterprise-plans',
        conditions: [{ attribute: 'plan', operator: 'in', value: ['professional', 'enterprise'] }],
        enabled: true,
      },
    ],
    tags: ['enterprise', 'compliance'],
  },
};

// =============================================================================
// Feature Flag Store
// =============================================================================

const flagsStore = new Map<string, FeatureFlag>();
const evaluationCache = new Map<string, { evaluation: FlagEvaluation; expiry: Date }>();

// Initialize flags
for (const [key, flag] of Object.entries(PHASE6_FLAGS)) {
  flagsStore.set(key, {
    ...flag,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// =============================================================================
// Evaluation Functions
// =============================================================================

/**
 * Evaluate a feature flag for a given context
 */
export function evaluateFlag(key: string, context: EvaluationContext = {}): FlagEvaluation {
  const cacheKey = `${key}:${hashContext(context)}`;
  const cached = evaluationCache.get(cacheKey);

  if (cached && cached.expiry > new Date()) {
    return cached.evaluation;
  }

  const flag = flagsStore.get(key);

  if (!flag) {
    return {
      key,
      enabled: false,
      reason: 'ERROR',
    };
  }

  // Check if flag is globally disabled
  if (!flag.enabled) {
    return cacheEvaluation(cacheKey, {
      key,
      enabled: false,
      reason: 'FLAG_DISABLED',
    });
  }

  // Evaluate rules
  for (const rule of flag.rules) {
    if (!rule.enabled) continue;

    const conditionsMet = evaluateConditions(rule.conditions, context);

    if (conditionsMet) {
      // Check percentage rollout
      if (rule.percentage !== undefined) {
        const hash = hashForPercentage(context.userId || context.organizationId || 'anonymous', key);
        if (hash > rule.percentage) continue;
      }

      // Check variant
      if (rule.variant && flag.variants) {
        const variant = flag.variants.find((v) => v.key === rule.variant);
        return cacheEvaluation(cacheKey, {
          key,
          enabled: true,
          variant: rule.variant,
          payload: variant?.payload,
          reason: 'RULE_MATCH',
          ruleId: rule.id,
        });
      }

      return cacheEvaluation(cacheKey, {
        key,
        enabled: true,
        reason: rule.percentage !== undefined ? 'PERCENTAGE_ROLLOUT' : 'RULE_MATCH',
        ruleId: rule.id,
      });
    }
  }

  // Handle variants without rules (A/B testing)
  if (flag.variants && flag.variants.length > 0) {
    const variant = selectVariant(flag.variants, context.userId || 'anonymous', key);
    return cacheEvaluation(cacheKey, {
      key,
      enabled: variant.key !== 'control' || flag.defaultValue,
      variant: variant.key,
      payload: variant.payload,
      reason: 'VARIANT_ASSIGNMENT',
    });
  }

  // Return default value
  return cacheEvaluation(cacheKey, {
    key,
    enabled: flag.defaultValue,
    reason: 'DEFAULT_VALUE',
  });
}

/**
 * Check if a feature is enabled
 */
export function isEnabled(key: string, context: EvaluationContext = {}): boolean {
  return evaluateFlag(key, context).enabled;
}

/**
 * Get feature variant
 */
export function getVariant(key: string, context: EvaluationContext = {}): string | undefined {
  return evaluateFlag(key, context).variant;
}

/**
 * Get all enabled features for a context
 */
export function getEnabledFeatures(context: EvaluationContext = {}): string[] {
  const enabled: string[] = [];

  for (const key of flagsStore.keys()) {
    if (isEnabled(key, context)) {
      enabled.push(key);
    }
  }

  return enabled;
}

// =============================================================================
// Flag Management
// =============================================================================

/**
 * Get all flags
 */
export function getAllFlags(): FeatureFlag[] {
  return Array.from(flagsStore.values());
}

/**
 * Get flag by key
 */
export function getFlag(key: string): FeatureFlag | undefined {
  return flagsStore.get(key);
}

/**
 * Update flag
 */
export function updateFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
  const flag = flagsStore.get(key);
  if (!flag) return null;

  const updated: FeatureFlag = {
    ...flag,
    ...updates,
    key: flag.key, // Prevent key changes
    updatedAt: new Date(),
  };

  flagsStore.set(key, updated);
  clearFlagCache(key);

  return updated;
}

/**
 * Create new flag
 */
export function createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): FeatureFlag {
  const newFlag: FeatureFlag = {
    ...flag,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  flagsStore.set(flag.key, newFlag);
  return newFlag;
}

/**
 * Delete flag
 */
export function deleteFlag(key: string): boolean {
  clearFlagCache(key);
  return flagsStore.delete(key);
}

/**
 * Get flags by tag
 */
export function getFlagsByTag(tag: string): FeatureFlag[] {
  return Array.from(flagsStore.values()).filter((f) => f.tags?.includes(tag));
}

// =============================================================================
// Helper Functions
// =============================================================================

function evaluateConditions(conditions: FlagCondition[], context: EvaluationContext): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((condition) => {
    const value = getContextValue(condition.attribute, context);
    return evaluateCondition(condition, value);
  });
}

function getContextValue(attribute: string, context: EvaluationContext): unknown {
  if (attribute in context) {
    return context[attribute as keyof EvaluationContext];
  }
  return context.attributes?.[attribute];
}

function evaluateCondition(condition: FlagCondition, value: unknown): boolean {
  const { operator, value: conditionValue } = condition;

  switch (operator) {
    case 'equals':
      return value === conditionValue;
    case 'not_equals':
      return value !== conditionValue;
    case 'contains':
      return String(value).includes(String(conditionValue));
    case 'not_contains':
      return !String(value).includes(String(conditionValue));
    case 'starts_with':
      return String(value).startsWith(String(conditionValue));
    case 'ends_with':
      return String(value).endsWith(String(conditionValue));
    case 'greater_than':
      return Number(value) > Number(conditionValue);
    case 'less_than':
      return Number(value) < Number(conditionValue);
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(value);
    case 'not_in':
      return Array.isArray(conditionValue) && !conditionValue.includes(value);
    case 'matches_regex':
      return new RegExp(String(conditionValue)).test(String(value));
    default:
      return false;
  }
}

function selectVariant(variants: FlagVariant[], userId: string, flagKey: string): FlagVariant {
  const hash = hashForPercentage(userId, flagKey);
  let cumulative = 0;

  for (const variant of variants) {
    cumulative += variant.weight;
    if (hash <= cumulative) {
      return variant;
    }
  }

  return variants[variants.length - 1];
}

function hashForPercentage(id: string, salt: string): number {
  const str = `${id}:${salt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 100);
}

function hashContext(context: EvaluationContext): string {
  return JSON.stringify(context);
}

function cacheEvaluation(cacheKey: string, evaluation: FlagEvaluation): FlagEvaluation {
  evaluationCache.set(cacheKey, {
    evaluation,
    expiry: new Date(Date.now() + 60000), // 1 minute cache
  });
  return evaluation;
}

function clearFlagCache(key: string): void {
  for (const cacheKey of evaluationCache.keys()) {
    if (cacheKey.startsWith(`${key}:`)) {
      evaluationCache.delete(cacheKey);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

export const featureFlags = {
  evaluate: evaluateFlag,
  isEnabled,
  getVariant,
  getEnabledFeatures,
  getAll: getAllFlags,
  get: getFlag,
  update: updateFlag,
  create: createFlag,
  delete: deleteFlag,
  getByTag: getFlagsByTag,
};
