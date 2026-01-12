/**
 * A3I Service Tiers - Access Control System
 *
 * Defines what each service tier can access, protecting IP while
 * enabling external certification through Trust Bridge.
 */

// ============================================================================
// Service Tier Definitions
// ============================================================================

export type ServiceTier =
  | 'free'           // Basic certification
  | 'pro'            // Professional certification
  | 'academy'        // Full training (native agents)
  | 'enterprise';    // Licensed deployment

export type AssetCategory =
  | 'trust_score'
  | 'category_breakdown'
  | 'failure_details'
  | 'attack_vectors'
  | 'training_methods'
  | 'detection_rules'
  | 'system_prompts'
  | 'precedent_library'
  | 'clone_package'
  | 'api_access'
  | 'on_prem_deploy';

export type AccessLevel =
  | 'none'           // No access
  | 'read'           // Can view
  | 'execute'        // Can use (but not see internals)
  | 'export'         // Can download
  | 'licensed';      // Full access with legal protection

// ============================================================================
// Access Matrix
// ============================================================================

export const SERVICE_TIER_ACCESS: Record<ServiceTier, Record<AssetCategory, AccessLevel>> = {
  free: {
    trust_score: 'read',
    category_breakdown: 'none',
    failure_details: 'none',
    attack_vectors: 'none',
    training_methods: 'none',
    detection_rules: 'none',
    system_prompts: 'none',
    precedent_library: 'none',
    clone_package: 'none',
    api_access: 'execute',
    on_prem_deploy: 'none',
  },
  pro: {
    trust_score: 'read',
    category_breakdown: 'read',
    failure_details: 'none',
    attack_vectors: 'none',
    training_methods: 'none',
    detection_rules: 'none',
    system_prompts: 'none',
    precedent_library: 'execute',
    clone_package: 'none',
    api_access: 'execute',
    on_prem_deploy: 'none',
  },
  academy: {
    trust_score: 'read',
    category_breakdown: 'read',
    failure_details: 'read',
    attack_vectors: 'execute',      // Can test against, can't export
    training_methods: 'execute',     // Applied to their agents, can't see
    detection_rules: 'execute',
    system_prompts: 'read',          // Their own agents only
    precedent_library: 'read',
    clone_package: 'export',         // Sanitized packages only
    api_access: 'execute',
    on_prem_deploy: 'none',
  },
  enterprise: {
    trust_score: 'read',
    category_breakdown: 'read',
    failure_details: 'read',
    attack_vectors: 'licensed',
    training_methods: 'licensed',
    detection_rules: 'licensed',
    system_prompts: 'licensed',
    precedent_library: 'licensed',
    clone_package: 'export',
    api_access: 'execute',
    on_prem_deploy: 'licensed',
  },
};

// ============================================================================
// Service Tier Configuration
// ============================================================================

export interface ServiceTierConfig {
  tier: ServiceTier;
  name: string;
  description: string;
  price_monthly: number | null;  // null = custom pricing
  price_per_certification: number | null;

  // Limits
  certifications_per_month: number | 'unlimited';
  agents_per_account: number | 'unlimited';
  api_calls_per_hour: number | 'unlimited';
  support_level: 'community' | 'email' | 'priority' | 'dedicated';

  // Features
  features: string[];
  restrictions: string[];

  // IP Protection Level
  ip_protection: 'maximum' | 'high' | 'standard' | 'licensed';
}

export const SERVICE_TIERS: Record<ServiceTier, ServiceTierConfig> = {
  free: {
    tier: 'free',
    name: 'Trust Bridge Basic',
    description: 'Basic certification for external agents',
    price_monthly: 0,
    price_per_certification: 99,
    certifications_per_month: 3,
    agents_per_account: 0,  // No native agents
    api_calls_per_hour: 100,
    support_level: 'community',
    features: [
      'Trust score certification',
      'Basic credential issuance',
      'Public verification API',
      '6-month credential validity',
    ],
    restrictions: [
      'No category breakdown',
      'No failure details',
      'No training access',
      'No attack vector access',
    ],
    ip_protection: 'maximum',
  },
  pro: {
    tier: 'pro',
    name: 'Trust Bridge Pro',
    description: 'Professional certification with detailed insights',
    price_monthly: 99,
    price_per_certification: 49,
    certifications_per_month: 'unlimited',
    agents_per_account: 0,
    api_calls_per_hour: 10000,
    support_level: 'email',
    features: [
      'Everything in Basic',
      'Category score breakdown',
      'Priority queue processing',
      '12-month credential validity',
      'Precedent library search',
      'Webhook notifications',
    ],
    restrictions: [
      'No failure details',
      'No training access',
      'No attack vector access',
    ],
    ip_protection: 'high',
  },
  academy: {
    tier: 'academy',
    name: 'A3I Academy',
    description: 'Full training for native agents on A3I platform',
    price_monthly: 299,
    price_per_certification: null,  // Included
    certifications_per_month: 'unlimited',
    agents_per_account: 50,
    api_calls_per_hour: 100000,
    support_level: 'priority',
    features: [
      'Everything in Pro',
      'Create & train native agents',
      'Full Academy curriculum',
      'Failure detail reports',
      'Council examination',
      'Agent API hosting',
      'Clone package generation',
      'Marketplace listing',
      'Earnings dashboard',
    ],
    restrictions: [
      'Agents run on A3I only',
      'No method export',
      'No attack vector export',
      'Clone packages sanitized',
    ],
    ip_protection: 'standard',
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise License',
    description: 'On-premise deployment with full method access',
    price_monthly: null,  // Custom: $50K-500K/year
    price_per_certification: null,
    certifications_per_month: 'unlimited',
    agents_per_account: 'unlimited',
    api_calls_per_hour: 'unlimited',
    support_level: 'dedicated',
    features: [
      'Everything in Academy',
      'On-premise deployment',
      'Full attack vector library',
      'Full detection rule access',
      'Training method documentation',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated support team',
      'Quarterly business reviews',
    ],
    restrictions: [
      'NDA required',
      'IP assignment clause',
      'No sublicensing',
      'Audit rights',
      'Breach penalties',
    ],
    ip_protection: 'licensed',
  },
};

// ============================================================================
// Access Control Functions
// ============================================================================

export function canAccess(
  tier: ServiceTier,
  asset: AssetCategory,
  requiredLevel: AccessLevel
): boolean {
  const userLevel = SERVICE_TIER_ACCESS[tier][asset];

  const levelHierarchy: AccessLevel[] = ['none', 'read', 'execute', 'export', 'licensed'];
  const userLevelIndex = levelHierarchy.indexOf(userLevel);
  const requiredLevelIndex = levelHierarchy.indexOf(requiredLevel);

  return userLevelIndex >= requiredLevelIndex;
}

export function getAccessLevel(tier: ServiceTier, asset: AssetCategory): AccessLevel {
  return SERVICE_TIER_ACCESS[tier][asset];
}

export function isIPProtected(tier: ServiceTier): boolean {
  return SERVICE_TIERS[tier].ip_protection !== 'licensed';
}

export function requiresLicense(asset: AssetCategory): boolean {
  const sensitiveAssets: AssetCategory[] = [
    'attack_vectors',
    'training_methods',
    'detection_rules',
    'on_prem_deploy',
  ];
  return sensitiveAssets.includes(asset);
}

// ============================================================================
// Sanitization Functions
// ============================================================================

export interface SanitizationResult<T> {
  data: Partial<T>;
  redacted_fields: string[];
  tier_upgrade_hint?: string;
}

export function sanitizeForTier<T extends Record<string, unknown>>(
  data: T,
  tier: ServiceTier,
  assetType: AssetCategory
): SanitizationResult<T> {
  const accessLevel = getAccessLevel(tier, assetType);
  const redacted: string[] = [];

  // Define sensitive fields that require higher access
  const sensitiveFields: Record<AssetCategory, string[]> = {
    trust_score: [],
    category_breakdown: ['category_scores', 'detailed_breakdown'],
    failure_details: ['failed_tests', 'failure_reasons', 'improvement_suggestions'],
    attack_vectors: ['payload', 'technique', 'indicators', 'bypass_methods'],
    training_methods: ['prompts', 'curricula', 'shaping_techniques'],
    detection_rules: ['patterns', 'thresholds', 'algorithms'],
    system_prompts: ['system_prompt', 'personality', 'instructions'],
    precedent_library: ['reasoning', 'decision_factors'],
    clone_package: ['training_data', 'method_configs'],
    api_access: [],
    on_prem_deploy: ['deployment_scripts', 'infrastructure'],
  };

  const fieldsToRedact = sensitiveFields[assetType] || [];
  const sanitized = { ...data };

  if (accessLevel === 'none') {
    // Redact everything
    for (const key of Object.keys(sanitized)) {
      delete sanitized[key];
      redacted.push(key);
    }
  } else if (accessLevel === 'read' || accessLevel === 'execute') {
    // Redact sensitive fields
    for (const field of fieldsToRedact) {
      if (field in sanitized) {
        delete sanitized[field];
        redacted.push(field);
      }
    }
  }
  // 'export' and 'licensed' get full access

  return {
    data: sanitized,
    redacted_fields: redacted,
    tier_upgrade_hint: redacted.length > 0
      ? `Upgrade to ${getUpgradeTier(tier)} for full access`
      : undefined,
  };
}

function getUpgradeTier(current: ServiceTier): ServiceTier {
  const upgradeMap: Record<ServiceTier, ServiceTier> = {
    free: 'pro',
    pro: 'academy',
    academy: 'enterprise',
    enterprise: 'enterprise',
  };
  return upgradeMap[current];
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface AccessAuditLog {
  id: string;
  timestamp: Date;
  user_id: string;
  tier: ServiceTier;
  asset_category: AssetCategory;
  asset_id: string;
  access_type: 'read' | 'execute' | 'export' | 'denied';
  ip_address: string;
  user_agent: string;
  success: boolean;
  denial_reason?: string;

  // Anomaly detection
  flagged: boolean;
  flag_reason?: string;
}

export function logAccess(log: Omit<AccessAuditLog, 'id' | 'timestamp'>): AccessAuditLog {
  const entry: AccessAuditLog = {
    ...log,
    id: `access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  };

  // In production: write to database and trigger anomaly detection
  console.log('[IP Protection] Access logged:', entry);

  return entry;
}

// ============================================================================
// External Export Prevention
// ============================================================================

export interface ExportAttempt {
  user_id: string;
  tier: ServiceTier;
  asset_category: AssetCategory;
  asset_id: string;
  allowed: boolean;
  reason: string;
}

export function canExport(
  tier: ServiceTier,
  asset: AssetCategory
): ExportAttempt {
  const accessLevel = getAccessLevel(tier, asset);

  if (accessLevel === 'licensed') {
    return {
      user_id: '',
      tier,
      asset_category: asset,
      asset_id: '',
      allowed: true,
      reason: 'Licensed access permits export',
    };
  }

  if (accessLevel === 'export') {
    // Check if asset is IP-protected
    if (requiresLicense(asset)) {
      return {
        user_id: '',
        tier,
        asset_category: asset,
        asset_id: '',
        allowed: false,
        reason: 'IP-protected asset requires Enterprise license',
      };
    }
    return {
      user_id: '',
      tier,
      asset_category: asset,
      asset_id: '',
      allowed: true,
      reason: 'Export permitted for this asset type',
    };
  }

  return {
    user_id: '',
    tier,
    asset_category: asset,
    asset_id: '',
    allowed: false,
    reason: `Tier ${tier} does not have export access to ${asset}`,
  };
}
