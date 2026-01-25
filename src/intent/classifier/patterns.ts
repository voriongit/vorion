/**
 * Intent Classification Patterns
 *
 * Contains known action patterns, resource sensitivity mappings, and pattern matching utilities
 * for rule-based intent classification in the Vorion AI Governance Platform.
 */

/**
 * Intent category for classification
 */
export type IntentCategory =
  | 'data-access'
  | 'model-operation'
  | 'external-integration'
  | 'system-config'
  | 'user-action';

/**
 * Risk tier levels
 */
export type RiskTier = 'low' | 'medium' | 'high' | 'critical';

/**
 * Action pattern definition with default risk configuration
 */
export interface ActionPattern {
  /** Pattern name for identification */
  name: string;
  /** Regex pattern to match action strings */
  pattern: RegExp;
  /** Category this action belongs to */
  category: IntentCategory;
  /** Default base risk score (0-100) */
  defaultRiskScore: number;
  /** Default risk tier */
  defaultRiskTier: RiskTier;
  /** Description of the action type */
  description: string;
}

/**
 * Resource sensitivity mapping
 */
export interface ResourceSensitivity {
  /** Pattern name for identification */
  name: string;
  /** Regex pattern to match resource strings */
  pattern: RegExp;
  /** Sensitivity level (0-100) */
  sensitivityLevel: number;
  /** Risk tier when accessing this resource */
  riskTier: RiskTier;
  /** Description of why this resource is sensitive */
  description: string;
}

/**
 * Known action patterns with their default risk levels.
 *
 * Risk Score Guidelines:
 * - 0-25: Low risk, routine operations
 * - 26-50: Medium risk, requires monitoring
 * - 51-75: High risk, requires review
 * - 76-100: Critical risk, requires explicit approval
 */
export const ACTION_PATTERNS: ActionPattern[] = [
  // Data Access Patterns
  {
    name: 'data:read',
    pattern: /^data:read$/i,
    category: 'data-access',
    defaultRiskScore: 15,
    defaultRiskTier: 'low',
    description: 'Read data from a resource',
  },
  {
    name: 'data:write',
    pattern: /^data:write$/i,
    category: 'data-access',
    defaultRiskScore: 35,
    defaultRiskTier: 'medium',
    description: 'Write data to a resource',
  },
  {
    name: 'data:delete',
    pattern: /^data:delete$/i,
    category: 'data-access',
    defaultRiskScore: 60,
    defaultRiskTier: 'high',
    description: 'Delete data from a resource',
  },
  {
    name: 'data:export',
    pattern: /^data:export$/i,
    category: 'data-access',
    defaultRiskScore: 55,
    defaultRiskTier: 'high',
    description: 'Export data from the system',
  },
  {
    name: 'data:import',
    pattern: /^data:import$/i,
    category: 'data-access',
    defaultRiskScore: 40,
    defaultRiskTier: 'medium',
    description: 'Import data into the system',
  },
  {
    name: 'data:query',
    pattern: /^data:query$/i,
    category: 'data-access',
    defaultRiskScore: 20,
    defaultRiskTier: 'low',
    description: 'Query data from a resource',
  },

  // Model Operation Patterns
  {
    name: 'model:train',
    pattern: /^model:train$/i,
    category: 'model-operation',
    defaultRiskScore: 45,
    defaultRiskTier: 'medium',
    description: 'Train a machine learning model',
  },
  {
    name: 'model:inference',
    pattern: /^model:inference$/i,
    category: 'model-operation',
    defaultRiskScore: 25,
    defaultRiskTier: 'low',
    description: 'Run inference on a model',
  },
  {
    name: 'model:deploy',
    pattern: /^model:deploy$/i,
    category: 'model-operation',
    defaultRiskScore: 70,
    defaultRiskTier: 'high',
    description: 'Deploy a model to production',
  },
  {
    name: 'model:evaluate',
    pattern: /^model:evaluate$/i,
    category: 'model-operation',
    defaultRiskScore: 20,
    defaultRiskTier: 'low',
    description: 'Evaluate model performance',
  },
  {
    name: 'model:finetune',
    pattern: /^model:finetune$/i,
    category: 'model-operation',
    defaultRiskScore: 50,
    defaultRiskTier: 'medium',
    description: 'Fine-tune an existing model',
  },

  // External Integration Patterns
  {
    name: 'external:api',
    pattern: /^external:api$/i,
    category: 'external-integration',
    defaultRiskScore: 40,
    defaultRiskTier: 'medium',
    description: 'Call an external API',
  },
  {
    name: 'external:webhook',
    pattern: /^external:webhook$/i,
    category: 'external-integration',
    defaultRiskScore: 35,
    defaultRiskTier: 'medium',
    description: 'Send data to a webhook',
  },
  {
    name: 'external:email',
    pattern: /^external:email$/i,
    category: 'external-integration',
    defaultRiskScore: 30,
    defaultRiskTier: 'medium',
    description: 'Send an email externally',
  },
  {
    name: 'external:payment',
    pattern: /^external:payment$/i,
    category: 'external-integration',
    defaultRiskScore: 85,
    defaultRiskTier: 'critical',
    description: 'Process a payment transaction',
  },
  {
    name: 'external:storage',
    pattern: /^external:storage$/i,
    category: 'external-integration',
    defaultRiskScore: 45,
    defaultRiskTier: 'medium',
    description: 'Access external storage service',
  },

  // System Configuration Patterns
  {
    name: 'system:config:read',
    pattern: /^system:config:read$/i,
    category: 'system-config',
    defaultRiskScore: 25,
    defaultRiskTier: 'low',
    description: 'Read system configuration',
  },
  {
    name: 'system:config:write',
    pattern: /^system:config:write$/i,
    category: 'system-config',
    defaultRiskScore: 75,
    defaultRiskTier: 'high',
    description: 'Modify system configuration',
  },
  {
    name: 'system:admin',
    pattern: /^system:admin$/i,
    category: 'system-config',
    defaultRiskScore: 90,
    defaultRiskTier: 'critical',
    description: 'Administrative system operation',
  },
  {
    name: 'system:security',
    pattern: /^system:security$/i,
    category: 'system-config',
    defaultRiskScore: 95,
    defaultRiskTier: 'critical',
    description: 'Security-related system operation',
  },
  {
    name: 'system:audit',
    pattern: /^system:audit$/i,
    category: 'system-config',
    defaultRiskScore: 30,
    defaultRiskTier: 'medium',
    description: 'Audit log operation',
  },

  // User Action Patterns
  {
    name: 'user:create',
    pattern: /^user:create$/i,
    category: 'user-action',
    defaultRiskScore: 40,
    defaultRiskTier: 'medium',
    description: 'Create a new user account',
  },
  {
    name: 'user:update',
    pattern: /^user:update$/i,
    category: 'user-action',
    defaultRiskScore: 35,
    defaultRiskTier: 'medium',
    description: 'Update user information',
  },
  {
    name: 'user:delete',
    pattern: /^user:delete$/i,
    category: 'user-action',
    defaultRiskScore: 65,
    defaultRiskTier: 'high',
    description: 'Delete a user account',
  },
  {
    name: 'user:permissions',
    pattern: /^user:permissions$/i,
    category: 'user-action',
    defaultRiskScore: 70,
    defaultRiskTier: 'high',
    description: 'Modify user permissions',
  },
  {
    name: 'user:authenticate',
    pattern: /^user:authenticate$/i,
    category: 'user-action',
    defaultRiskScore: 20,
    defaultRiskTier: 'low',
    description: 'User authentication action',
  },
];

/**
 * Resource sensitivity mappings for risk calculation.
 *
 * Resources are matched against patterns and their sensitivity level
 * is used as a multiplier in risk calculation.
 *
 * Note: Patterns use (^|[-_]) and ([-_]|$) for word boundaries that work
 * with underscore/hyphen delimited resource names (e.g., "customer_data").
 */
export const RESOURCE_SENSITIVITY: ResourceSensitivity[] = [
  // PII and Personal Data
  {
    name: 'pii',
    pattern: /(^|[-_])(pii|personal|customer|user)([-_]|$)/i,
    sensitivityLevel: 80,
    riskTier: 'high',
    description: 'Personally Identifiable Information',
  },
  {
    name: 'financial',
    pattern: /(^|[-_])(financial|payment|billing|credit|bank)([-_]|$)/i,
    sensitivityLevel: 90,
    riskTier: 'critical',
    description: 'Financial data including payment information',
  },
  {
    name: 'health',
    pattern: /(^|[-_])(health|medical|hipaa|patient)([-_]|$)/i,
    sensitivityLevel: 95,
    riskTier: 'critical',
    description: 'Protected Health Information (PHI)',
  },
  {
    name: 'credentials',
    pattern: /(^|[-_])(credential|password|secret|key|token|api[-_]?key)([-_]|$)/i,
    sensitivityLevel: 100,
    riskTier: 'critical',
    description: 'Authentication credentials and secrets',
  },

  // System Resources
  {
    name: 'production',
    pattern: /(^|[-_])(prod|production)([-_]|$)/i,
    sensitivityLevel: 70,
    riskTier: 'high',
    description: 'Production environment resources',
  },
  {
    name: 'staging',
    pattern: /(^|[-_])(stag|staging|preprod)([-_]|$)/i,
    sensitivityLevel: 40,
    riskTier: 'medium',
    description: 'Staging environment resources',
  },
  {
    name: 'development',
    pattern: /(^|[-_])(dev|development|test|sandbox)([-_]|$)/i,
    sensitivityLevel: 15,
    riskTier: 'low',
    description: 'Development and test environment resources',
  },

  // Data Classifications
  {
    name: 'confidential',
    pattern: /(^|[-_])(confidential|classified|restricted)([-_]|$)/i,
    sensitivityLevel: 85,
    riskTier: 'critical',
    description: 'Confidential or classified data',
  },
  {
    name: 'internal',
    pattern: /(^|[-_])(internal|private)([-_]|$)/i,
    sensitivityLevel: 50,
    riskTier: 'medium',
    description: 'Internal use only data',
  },
  {
    name: 'public',
    pattern: /(^|[-_])(public|open)([-_]|$)/i,
    sensitivityLevel: 10,
    riskTier: 'low',
    description: 'Public or openly accessible data',
  },

  // Infrastructure
  {
    name: 'database',
    pattern: /(^|[-_])(database|db|sql|mongo|postgres|mysql)([-_]|$)/i,
    sensitivityLevel: 60,
    riskTier: 'high',
    description: 'Database resources',
  },
  {
    name: 'logs',
    pattern: /(^|[-_])(log|logs|audit[-_]?log|access[-_]?log)([-_]|$)/i,
    sensitivityLevel: 45,
    riskTier: 'medium',
    description: 'Log and audit data',
  },
  {
    name: 'config',
    pattern: /(^|[-_])(config|configuration|settings)([-_]|$)/i,
    sensitivityLevel: 55,
    riskTier: 'medium',
    description: 'System configuration',
  },
];

/**
 * Match an action string against known patterns
 *
 * @param action - The action string to match (e.g., 'data:read')
 * @returns Matching action pattern or undefined if no match
 */
export function matchActionPattern(action: string): ActionPattern | undefined {
  if (!action) {
    return undefined;
  }

  return ACTION_PATTERNS.find((p) => p.pattern.test(action));
}

/**
 * Match a resource string against sensitivity patterns
 *
 * @param resource - The resource string to match
 * @returns Array of matching sensitivity patterns, sorted by sensitivity level (descending)
 */
export function matchResourceSensitivity(resource: string): ResourceSensitivity[] {
  if (!resource) {
    return [];
  }

  return RESOURCE_SENSITIVITY
    .filter((s) => s.pattern.test(resource))
    .sort((a, b) => b.sensitivityLevel - a.sensitivityLevel);
}

/**
 * Get the highest sensitivity level for a resource
 *
 * @param resource - The resource string to evaluate
 * @returns Highest sensitivity level (0-100), defaults to 30 if no match
 */
export function getResourceSensitivityLevel(resource: string): number {
  const matches = matchResourceSensitivity(resource);
  if (matches.length === 0) {
    // Default sensitivity for unknown resources
    return 30;
  }
  // Return the highest sensitivity found
  return matches[0]!.sensitivityLevel;
}

/**
 * Get the risk tier for a resource based on sensitivity patterns
 *
 * @param resource - The resource string to evaluate
 * @returns Risk tier for the resource
 */
export function getResourceRiskTier(resource: string): RiskTier {
  const matches = matchResourceSensitivity(resource);
  if (matches.length === 0) {
    return 'low';
  }
  return matches[0]!.riskTier;
}

/**
 * Infer category from action string when no pattern matches
 *
 * @param action - The action string to analyze
 * @returns Inferred category based on action prefix
 */
export function inferCategoryFromAction(action: string): IntentCategory {
  if (!action) {
    return 'user-action';
  }

  const lowerAction = action.toLowerCase();

  if (lowerAction.startsWith('data:')) {
    return 'data-access';
  }
  if (lowerAction.startsWith('model:')) {
    return 'model-operation';
  }
  if (lowerAction.startsWith('external:')) {
    return 'external-integration';
  }
  if (lowerAction.startsWith('system:')) {
    return 'system-config';
  }
  if (lowerAction.startsWith('user:')) {
    return 'user-action';
  }

  // Default to user-action for unknown patterns
  return 'user-action';
}

/**
 * Convert a risk score to a risk tier
 *
 * @param score - Risk score (0-100)
 * @returns Corresponding risk tier
 *
 * Tier Thresholds:
 * - low: 0-25
 * - medium: 26-50
 * - high: 51-75
 * - critical: 76-100
 */
export function scoreToTier(score: number): RiskTier {
  if (score <= 25) {
    return 'low';
  }
  if (score <= 50) {
    return 'medium';
  }
  if (score <= 75) {
    return 'high';
  }
  return 'critical';
}

/**
 * Get the minimum score for a given tier
 *
 * @param tier - Risk tier
 * @returns Minimum score for the tier
 */
export function tierToMinScore(tier: RiskTier): number {
  switch (tier) {
    case 'low':
      return 0;
    case 'medium':
      return 26;
    case 'high':
      return 51;
    case 'critical':
      return 76;
  }
}

/**
 * Check if an action pattern requires approval based on default risk tier
 *
 * @param pattern - Action pattern to check
 * @returns True if the pattern typically requires approval
 */
export function requiresApproval(pattern: ActionPattern): boolean {
  return pattern.defaultRiskTier === 'high' || pattern.defaultRiskTier === 'critical';
}
