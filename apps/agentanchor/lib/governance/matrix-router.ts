/**
 * Risk×Trust Matrix Router
 *
 * Council Priority #1 (80 points) - Unanimous
 *
 * Implements parallel routing architecture:
 * - GREEN Express Path: High trust (>=800), low-medium risk → Auto-approve
 * - YELLOW Standard Path: Medium trust (400-799), medium-high risk → Policy check
 * - RED Full Path: Low trust (<400) OR critical risk → Full consensus
 *
 * @see BAI Advisory Council Decision Document (2025-12-07)
 */

import { TrustTier, TrustContext, RiskLevel, GovernanceDecision } from './types';

// =============================================================================
// Routing Path Types
// =============================================================================

export type RoutingPath = 'green' | 'yellow' | 'red';

export interface RouteDecision {
  path: RoutingPath;
  pathName: string;
  description: string;
  requiresCouncil: boolean;
  requiresHuman: boolean;
  autoApprove: boolean;
  policyCheckOnly: boolean;
  maxLatencyMs: number;
  hitlRequired: boolean;
}

export interface MatrixInput {
  trustScore: number;
  riskLevel: RiskLevel;
  agentTier: TrustTier;
  actionType: string;
  context?: Record<string, unknown>;
}

export interface MatrixResult {
  route: RouteDecision;
  trustScore: number;
  riskLevel: RiskLevel;
  reasoning: string[];
  canProceed: boolean;
  nextAction: 'execute' | 'policy_check' | 'council_vote' | 'human_review';
}

// =============================================================================
// Route Definitions
// =============================================================================

const ROUTES: Record<RoutingPath, RouteDecision> = {
  green: {
    path: 'green',
    pathName: 'Express Path',
    description: 'High trust agent with low-medium risk action',
    requiresCouncil: false,
    requiresHuman: false,
    autoApprove: true,
    policyCheckOnly: false,
    maxLatencyMs: 100, // Fast lane
    hitlRequired: false,
  },
  yellow: {
    path: 'yellow',
    pathName: 'Standard Path',
    description: 'Medium trust or elevated risk - requires policy validation',
    requiresCouncil: false,
    requiresHuman: false,
    autoApprove: false,
    policyCheckOnly: true,
    maxLatencyMs: 500, // Policy check latency
    hitlRequired: false, // Can be enabled per maturity
  },
  red: {
    path: 'red',
    pathName: 'Full Governance Path',
    description: 'Low trust or critical risk - requires full council consensus',
    requiresCouncil: true,
    requiresHuman: false, // Unless critical
    autoApprove: false,
    policyCheckOnly: false,
    maxLatencyMs: 5000, // Council deliberation time
    hitlRequired: true, // For new agents
  },
};

// =============================================================================
// Risk Level Numeric Mapping
// =============================================================================

const RISK_NUMERIC: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// =============================================================================
// Matrix Router
// =============================================================================

/**
 * Route an action through the Risk×Trust Matrix
 *
 * @param input - Trust score, risk level, and context
 * @returns Matrix routing result with path and next action
 */
export function routeAction(input: MatrixInput): MatrixResult {
  const { trustScore, riskLevel, agentTier, actionType } = input;
  const reasoning: string[] = [];
  const riskNumeric = RISK_NUMERIC[riskLevel];

  // Determine routing path based on matrix
  let path: RoutingPath;

  // CRITICAL RISK: Always RED path regardless of trust
  if (riskLevel === 'critical') {
    path = 'red';
    reasoning.push(`Critical risk action requires full governance path`);
    reasoning.push(`Risk level 4 (critical) triggers human oversight`);
  }
  // GREEN PATH: High trust (>=800) AND low-medium risk (1-2)
  else if (trustScore >= 800 && riskNumeric <= 2) {
    path = 'green';
    reasoning.push(`Trust score ${trustScore} >= 800 qualifies for express path`);
    reasoning.push(`Risk level ${riskNumeric} (${riskLevel}) within express threshold`);
  }
  // YELLOW PATH: Medium trust (400-799) OR elevated risk (2-3) with sufficient trust
  else if (trustScore >= 400 && riskNumeric <= 3) {
    path = 'yellow';
    reasoning.push(`Trust score ${trustScore} in standard range (400-799)`);
    reasoning.push(`Risk level ${riskNumeric} (${riskLevel}) requires policy validation`);
  }
  // RED PATH: Low trust (<400) OR high risk (3+) without sufficient trust
  else {
    path = 'red';
    if (trustScore < 400) {
      reasoning.push(`Trust score ${trustScore} < 400 requires full governance`);
    }
    if (riskNumeric >= 3) {
      reasoning.push(`Risk level ${riskNumeric} (${riskLevel}) requires council approval`);
    }
  }

  const route = ROUTES[path];

  // Determine next action
  let nextAction: MatrixResult['nextAction'];
  let canProceed = true;

  switch (path) {
    case 'green':
      nextAction = 'execute';
      reasoning.push(`Action can proceed immediately with async logging`);
      break;
    case 'yellow':
      nextAction = 'policy_check';
      reasoning.push(`Action requires policy validation before execution`);
      break;
    case 'red':
      if (riskLevel === 'critical') {
        nextAction = 'human_review';
        reasoning.push(`Critical action escalated to human review`);
        canProceed = false; // Must wait for human
      } else {
        nextAction = 'council_vote';
        reasoning.push(`Action submitted to council for consensus vote`);
        canProceed = false; // Must wait for council
      }
      break;
    default:
      nextAction = 'council_vote';
  }

  return {
    route,
    trustScore,
    riskLevel,
    reasoning,
    canProceed,
    nextAction,
  };
}

// =============================================================================
// Matrix Visualization
// =============================================================================

/**
 * Get the full Risk×Trust Matrix for visualization
 */
export function getMatrix(): MatrixCell[][] {
  const trustLevels = [900, 800, 600, 400, 200, 0]; // Score thresholds
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

  return trustLevels.map(trustThreshold =>
    riskLevels.map(risk => {
      const result = routeAction({
        trustScore: trustThreshold,
        riskLevel: risk,
        agentTier: getTierFromScore(trustThreshold),
        actionType: 'generic',
      });
      return {
        trustScore: trustThreshold,
        riskLevel: risk,
        path: result.route.path,
        pathName: result.route.pathName,
        autoApprove: result.route.autoApprove,
      };
    })
  );
}

export interface MatrixCell {
  trustScore: number;
  riskLevel: RiskLevel;
  path: RoutingPath;
  pathName: string;
  autoApprove: boolean;
}

function getTierFromScore(score: number): TrustTier {
  if (score >= 900) return 'certified';
  if (score >= 800) return 'verified';
  if (score >= 600) return 'trusted';
  if (score >= 400) return 'established';
  if (score >= 200) return 'provisional';
  return 'untrusted';
}

// =============================================================================
// Policy Check (for YELLOW path)
// =============================================================================

export interface PolicyCheckInput {
  actionType: string;
  agentId: string;
  trustScore: number;
  context: Record<string, unknown>;
}

export interface PolicyCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  requiredApprovals: string[];
}

/**
 * Perform policy validation for YELLOW path actions
 */
export function checkPolicy(input: PolicyCheckInput): PolicyCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const requiredApprovals: string[] = [];

  // Check for known risky patterns
  if (input.context.externalApi) {
    warnings.push('Action involves external API - ensure rate limits');
  }

  if (input.context.userData) {
    if (input.trustScore < 600) {
      violations.push('User data access requires trust score >= 600');
    } else {
      warnings.push('User data access - audit trail required');
    }
  }

  if (input.context.financial) {
    violations.push('Financial actions require RED path (council approval)');
  }

  if (input.context.irreversible) {
    warnings.push('Irreversible action - confirm user intent');
    if (input.trustScore < 800) {
      requiredApprovals.push('User confirmation required');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    requiredApprovals,
  };
}

// =============================================================================
// Integration with existing governance
// =============================================================================

/**
 * Convert matrix result to governance decision format
 */
export function toGovernanceDecision(result: MatrixResult): GovernanceDecision {
  return {
    allowed: result.canProceed,
    requiresApproval: !result.route.autoApprove,
    escalateTo: result.nextAction === 'human_review'
      ? 'human'
      : result.nextAction === 'council_vote'
        ? 'council'
        : null,
    reason: result.reasoning.join('. '),
    trustImpact: result.route.autoApprove ? 1 : 0, // Small boost for express path actions
    auditRequired: true, // Always audit
  };
}

// =============================================================================
// Exports
// =============================================================================

export const MatrixRouter = {
  route: routeAction,
  getMatrix,
  checkPolicy,
  toGovernanceDecision,
  ROUTES,
};

export default MatrixRouter;
