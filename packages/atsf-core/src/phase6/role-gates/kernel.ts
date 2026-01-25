/**
 * Q3: Role Gates - Kernel Validation Layer
 * Fast-path role + tier combination validation with matrix lookups
 *
 * Architecture:
 * - Fail-fast kernel validation (<0.5ms)
 * - Pre-computed matrix for O(1) lookups
 * - 9 roles (R-L0 to R-L8) × 6 tiers (T0 to T5) = 48 valid combinations
 */

/**
 * Agent role enumeration (9 levels)
 * Defines hierarchical responsibility and operational scope
 */
export enum AgentRole {
  R_L0 = 'R-L0', // Minimal autonomy, strict supervision
  R_L1 = 'R-L1', // Limited autonomy, high oversight
  R_L2 = 'R-L2', // Moderate autonomy, medium oversight
  R_L3 = 'R-L3', // Balanced autonomy, routine oversight
  R_L4 = 'R-L4', // Higher autonomy, conditional oversight
  R_L5 = 'R-L5', // Strong autonomy, rare oversight
  R_L6 = 'R-L6', // Very strong autonomy, minimal oversight
  R_L7 = 'R-L7', // Near-complete autonomy, exception handling
  R_L8 = 'R-L8', // Full autonomy, no restrictions
}

/**
 * Trust tier enumeration (6 levels)
 * Defines operational authorization scope and resource access
 */
export enum TrustTier {
  T0 = 'T0', // Read-only, no state mutations
  T1 = 'T1', // Read + limited mutations, single domain
  T2 = 'T2', // Read + mutations, multiple domains
  T3 = 'T3', // Read + mutations + external API access
  T4 = 'T4', // Full resource access, regulatory compliance
  T5 = 'T5', // Unrestricted access, all capabilities
}

/**
 * Role Gate Matrix: Valid role + tier combinations
 * Rows: Roles (R-L0 to R-L8)
 * Cols: Tiers (T0 to T5)
 * Value: true if combination is valid
 *
 * Matrix structure:
 * - R-L0 can reach: T0, T1
 * - R-L1 can reach: T0, T1, T2
 * - R-L2 can reach: T0, T1, T2, T3
 * - R-L3 can reach: T0, T1, T2, T3, T4
 * - R-L4 can reach: T0, T1, T2, T3, T4
 * - R-L5 can reach: T0, T1, T2, T3, T4
 * - R-L6 can reach: T0, T1, T2, T3, T4, T5
 * - R-L7 can reach: T0, T1, T2, T3, T4, T5
 * - R-L8 can reach: T0, T1, T2, T3, T4, T5
 */
export const ROLE_GATE_MATRIX: Record<AgentRole, Record<TrustTier, boolean>> = {
  [AgentRole.R_L0]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: false,
    [TrustTier.T3]: false,
    [TrustTier.T4]: false,
    [TrustTier.T5]: false,
  },
  [AgentRole.R_L1]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: false,
    [TrustTier.T4]: false,
    [TrustTier.T5]: false,
  },
  [AgentRole.R_L2]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: false,
    [TrustTier.T5]: false,
  },
  [AgentRole.R_L3]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: true,
    [TrustTier.T5]: false,
  },
  [AgentRole.R_L4]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: true,
    [TrustTier.T5]: false,
  },
  [AgentRole.R_L5]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: true,
    [TrustTier.T5]: false,
  },
  [AgentRole.R_L6]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: true,
    [TrustTier.T5]: true,
  },
  [AgentRole.R_L7]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: true,
    [TrustTier.T5]: true,
  },
  [AgentRole.R_L8]: {
    [TrustTier.T0]: true,
    [TrustTier.T1]: true,
    [TrustTier.T2]: true,
    [TrustTier.T3]: true,
    [TrustTier.T4]: true,
    [TrustTier.T5]: true,
  },
};

/**
 * Validate role + tier combination
 * O(1) matrix lookup, fail-fast validation
 */
export function validateRoleAndTier(role: AgentRole, tier: TrustTier): boolean {
  if (!isValidRole(role) || !isValidTier(tier)) {
    return false;
  }
  return ROLE_GATE_MATRIX[role]?.[tier] ?? false;
}

/**
 * Check if value is a valid AgentRole
 */
export function isValidRole(role: unknown): role is AgentRole {
  if (typeof role !== 'string') return false;
  return Object.values(AgentRole).includes(role as AgentRole);
}

/**
 * Check if value is a valid TrustTier
 */
export function isValidTier(tier: unknown): tier is TrustTier {
  if (typeof tier !== 'string') return false;
  return Object.values(TrustTier).includes(tier as TrustTier);
}

/**
 * Get maximum tier reachable for a given role
 */
export function getMaxTierForRole(role: AgentRole): TrustTier {
  if (!isValidRole(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  const roleEntry = ROLE_GATE_MATRIX[role];
  if (!roleEntry) {
    return TrustTier.T0;
  }

  // Debug logging for R-L0
  const isDebug = role === 'R-L0';
  if (isDebug) {
    console.log('getMaxTierForRole debug for R-L0:');
    console.log('  roleEntry:', roleEntry);
    console.log('  TrustTier.T1:', TrustTier.T1);
    console.log('  roleEntry[TrustTier.T1]:', roleEntry[TrustTier.T1]);
  }

  // Check tiers from highest to lowest
  const t5Val = roleEntry[TrustTier.T5];
  if (t5Val === true) {
    if (isDebug) console.log('  returning T5');
    return TrustTier.T5;
  }
  
  const t4Val = roleEntry[TrustTier.T4];
  if (t4Val === true) {
    if (isDebug) console.log('  returning T4');
    return TrustTier.T4;
  }
  
  const t3Val = roleEntry[TrustTier.T3];
  if (t3Val === true) {
    if (isDebug) console.log('  returning T3');
    return TrustTier.T3;
  }
  
  const t2Val = roleEntry[TrustTier.T2];
  if (t2Val === true) {
    if (isDebug) console.log('  returning T2');
    return TrustTier.T2;
  }
  
  const t1Val = roleEntry[TrustTier.T1];
  if (isDebug) console.log('  t1Val:', t1Val, 't1Val === true:', t1Val === true);
  if (t1Val === true) {
    if (isDebug) console.log('  returning T1');
    return TrustTier.T1;
  }
  
  const t0Val = roleEntry[TrustTier.T0];
  if (t0Val === true) {
    if (isDebug) console.log('  returning T0');
    return TrustTier.T0;
  }

  // Fallback
  if (isDebug) console.log('  returning fallback T0');
  return TrustTier.T0;
}

/**
 * Get minimum role required for a given tier
 */
export function getMinRoleForTier(tier: TrustTier): AgentRole {
  if (!isValidTier(tier)) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const roleOrder = [
    AgentRole.R_L0,
    AgentRole.R_L1,
    AgentRole.R_L2,
    AgentRole.R_L3,
    AgentRole.R_L4,
    AgentRole.R_L5,
    AgentRole.R_L6,
    AgentRole.R_L7,
    AgentRole.R_L8,
  ];

  for (const role of roleOrder) {
    if (ROLE_GATE_MATRIX[role]?.[tier]) {
      return role;
    }
  }

  // Fallback
  return AgentRole.R_L0;
}

/**
 * Custom error for role gate validation failures
 */
export class RoleGateValidationError extends Error {
  constructor(
    public role: AgentRole,
    public tier: TrustTier,
    message?: string
  ) {
    super(message || `Invalid role+tier combination: ${role} + ${tier}`);
    this.name = 'RoleGateValidationError';
  }
}
