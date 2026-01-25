/**
 * Cognigate Governance Extension
 *
 * Provides runtime governance and policy enforcement for AI agents.
 * Integrates with Vorion's enforce module for policy decisions.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/builtin-extensions/governance
 * @license Apache-2.0
 */

import { createLogger } from '../../common/logger.js';
import type {
  ACIExtension,
  AgentIdentity,
  CapabilityRequest,
  CapabilityGrant,
  PreCheckResult,
  PreActionResult,
  ActionRequest,
  ActionRecord,
  BehaviorMetrics,
  BehaviorVerificationResult,
  RevocationEvent,
  TrustAdjustment,
  TrustAdjustmentResult,
  PolicyContext,
  PolicyDecision,
  Constraint,
  TrustTier,
} from '../types.js';

const logger = createLogger({ component: 'aci-ext-cognigate' });

/**
 * In-memory store for agent constraints (in production, use database)
 */
const agentConstraints: Map<string, Constraint[]> = new Map();

/**
 * In-memory store for active sessions (in production, use Redis/database)
 */
const activeSessions: Map<string, Set<string>> = new Map();

/**
 * In-memory store for trust scores (in production, use trust engine)
 */
const trustScores: Map<string, number> = new Map();

/**
 * Behavior baselines for drift detection
 */
const behaviorBaselines: Map<
  string,
  {
    avgResponseTime: number;
    errorRate: number;
    maxLevel: number;
    domains: number[];
  }
> = new Map();

/**
 * Convert trust score to tier
 */
function scoreToTier(score: number): TrustTier {
  if (score >= 900) return 5;
  if (score >= 700) return 4;
  if (score >= 500) return 3;
  if (score >= 300) return 2;
  if (score >= 100) return 1;
  return 0;
}

/**
 * Check if action violates any constraints
 */
function checkConstraintViolation(
  constraints: Constraint[],
  request: CapabilityRequest | ActionRequest
): { violated: boolean; message?: string } {
  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'rate_limit': {
        // Rate limit check would integrate with rate limiting service
        const maxRequests = constraint.params.maxRequests as number | undefined;
        const windowMs = constraint.params.windowMs as number | undefined;
        if (maxRequests !== undefined && windowMs !== undefined) {
          // In production: check actual rate against limit
          logger.debug(
            { maxRequests, windowMs },
            'Rate limit constraint evaluated'
          );
        }
        break;
      }

      case 'time_window': {
        const startHour = constraint.params.startHour as number | undefined;
        const endHour = constraint.params.endHour as number | undefined;
        if (startHour !== undefined && endHour !== undefined) {
          const currentHour = new Date().getHours();
          if (currentHour < startHour || currentHour >= endHour) {
            return {
              violated: true,
              message: `Action not allowed outside business hours (${startHour}:00-${endHour}:00)`,
            };
          }
        }
        break;
      }

      case 'resource': {
        const allowedResources = constraint.params.allowed as string[] | undefined;
        if (allowedResources && 'context' in request) {
          const targetResource = request.context.resource;
          if (targetResource && !allowedResources.includes(targetResource)) {
            return {
              violated: true,
              message: `Access to resource '${targetResource}' not allowed`,
            };
          }
        }
        break;
      }

      case 'approval': {
        const requiresApproval = constraint.params.required as boolean | undefined;
        if (requiresApproval) {
          return {
            violated: true,
            message: 'This action requires approval',
          };
        }
        break;
      }

      default:
        // Custom constraints - log and continue
        logger.debug(
          { constraintType: constraint.type },
          'Custom constraint type not evaluated'
        );
    }
  }

  return { violated: false };
}

/**
 * Load constraints for an agent (in production, from database)
 */
function loadConstraints(agentDid: string): Constraint[] {
  return agentConstraints.get(agentDid) ?? [];
}

/**
 * Get or create baseline for an agent
 */
function getBaseline(agentDid: string): {
  avgResponseTime: number;
  errorRate: number;
  maxLevel: number;
  domains: number[];
} {
  const existing = behaviorBaselines.get(agentDid);
  if (existing) {
    return existing;
  }

  // Default baseline
  const baseline = {
    avgResponseTime: 100,
    errorRate: 0.05,
    maxLevel: 3,
    domains: [1, 2, 4], // Example domain bitmasks
  };
  behaviorBaselines.set(agentDid, baseline);
  return baseline;
}

/**
 * Calculate drift score between baseline and current metrics
 */
function calculateDrift(
  baseline: ReturnType<typeof getBaseline>,
  metrics: BehaviorMetrics
): { score: number; categories: string[] } {
  const categories: string[] = [];
  let score = 0;

  // Response time drift
  const responseTimeDrift =
    Math.abs(metrics.avgResponseTime - baseline.avgResponseTime) /
    baseline.avgResponseTime;
  if (responseTimeDrift > 0.5) {
    categories.push('response_time');
    score += Math.min(responseTimeDrift * 30, 30);
  }

  // Error rate drift
  const currentErrorRate =
    metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0;
  const errorRateDrift = currentErrorRate - baseline.errorRate;
  if (errorRateDrift > 0.1) {
    categories.push('error_rate');
    score += Math.min(errorRateDrift * 200, 40);
  }

  // Level escalation
  if (metrics.maxLevelUsed > baseline.maxLevel) {
    categories.push('privilege_escalation');
    score += (metrics.maxLevelUsed - baseline.maxLevel) * 10;
  }

  // Domain drift
  const newDomains = metrics.domainsAccessed.filter(
    (d) => !baseline.domains.includes(d)
  );
  if (newDomains.length > 0) {
    categories.push('domain_expansion');
    score += newDomains.length * 5;
  }

  return { score: Math.min(score, 100), categories };
}

/**
 * Get current trust score for agent
 */
function getTrustScore(agentDid: string): number {
  return trustScores.get(agentDid) ?? 500; // Default middle tier
}

/**
 * Apply trust adjustment
 */
function applyAdjustment(
  currentScore: number,
  adjustment: TrustAdjustment
): number {
  let newScore = currentScore;

  switch (adjustment.type) {
    case 'increment':
      newScore = Math.min(1000, currentScore + (adjustment.amount ?? 0));
      break;
    case 'decrement':
      newScore = Math.max(0, currentScore - (adjustment.amount ?? 0));
      break;
    case 'set':
      newScore = Math.max(0, Math.min(1000, adjustment.value ?? currentScore));
      break;
  }

  return newScore;
}

/**
 * Notify all running instances of an agent about revocation
 */
async function notifyInstances(agentDid: string): Promise<void> {
  const sessions = activeSessions.get(agentDid);
  if (sessions) {
    logger.info(
      { agentDid, sessionCount: sessions.size },
      'Notifying active sessions of revocation'
    );
    // In production: send revocation notification to each session
  }
}

/**
 * Terminate all active sessions for an agent
 */
async function terminateSessions(agentDid: string): Promise<void> {
  const sessions = activeSessions.get(agentDid);
  if (sessions) {
    logger.info(
      { agentDid, sessionCount: sessions.size },
      'Terminating active sessions'
    );
    activeSessions.delete(agentDid);
    // In production: forcibly terminate each session
  }
}

/**
 * Simple policy evaluation (in production, use OPA or Rego)
 */
async function evaluateSimplePolicy(
  context: PolicyContext
): Promise<PolicyDecision> {
  const reasons: string[] = [];
  let decision: PolicyDecision['decision'] = 'allow';

  // Check trust tier
  if (context.agent.trustTier < 2) {
    decision = 'deny';
    reasons.push(`Trust tier ${context.agent.trustTier} below minimum (2)`);
  }

  // Check business hours for high-level actions
  if (context.action && context.agent.level >= 4) {
    if (!context.environment.isBusinessHours) {
      decision = 'require_approval';
      reasons.push('High-level action outside business hours requires approval');
    }
  }

  // Check capability level matches request
  if (context.capability) {
    if (context.capability.level > context.agent.level) {
      decision = 'deny';
      reasons.push(
        `Requested level ${context.capability.level} exceeds agent level ${context.agent.level}`
      );
    }
  }

  if (reasons.length === 0) {
    reasons.push('All policy checks passed');
  }

  return {
    decision,
    reasons,
    evidence: [
      {
        policyId: 'cognigate-default',
        ruleId: decision === 'allow' ? 'default-allow' : 'security-check',
        details: reasons.join('; '),
      },
    ],
    obligations:
      decision !== 'deny'
        ? [
            {
              type: 'log',
              params: { level: 'info', message: 'Policy evaluated' },
            },
          ]
        : undefined,
  };
}

/**
 * Cognigate Governance Extension
 *
 * Provides comprehensive runtime governance including:
 * - Capability pre-check with constraint enforcement
 * - Action pre-check with policy evaluation
 * - Behavioral drift detection and monitoring
 * - Trust score adjustment
 * - Revocation handling
 */
export const cognigateExtension: ACIExtension = {
  extensionId: 'aci-ext-cognigate-v1',
  name: 'Cognigate Governance Runtime',
  version: '1.0.0',
  shortcode: 'gov',
  publisher: 'did:web:agentanchor.io',
  description:
    'Runtime governance and policy enforcement for AI agents. ' +
    'Provides constraint checking, behavioral monitoring, and trust management.',
  requiredACIVersion: '>=1.0.0',

  hooks: {
    onLoad: async () => {
      logger.info('Cognigate Governance extension loaded');
      // Initialize any required resources
    },

    onUnload: async () => {
      logger.info('Cognigate Governance extension unloading');
      // Clean up resources
      agentConstraints.clear();
      activeSessions.clear();
    },
  },

  capability: {
    /**
     * Pre-check capability requests against agent constraints
     */
    preCheck: async (
      agent: AgentIdentity,
      request: CapabilityRequest
    ): Promise<PreCheckResult> => {
      logger.debug(
        { agentDid: agent.did, domains: request.domains, level: request.level },
        'Evaluating capability pre-check'
      );

      // Load constraints for this agent
      const constraints = loadConstraints(agent.did);

      // Check for violations
      const violation = checkConstraintViolation(constraints, request);

      if (violation.violated) {
        logger.info(
          { agentDid: agent.did, reason: violation.message },
          'Capability request denied by constraint'
        );

        return {
          allow: false,
          reason: violation.message,
        };
      }

      // Check trust level requirements
      if (request.level > agent.level) {
        return {
          allow: false,
          reason: `Requested level ${request.level} exceeds agent capability level ${agent.level}`,
        };
      }

      // Add default constraints based on trust tier
      const additionalConstraints: Constraint[] = [];

      if (agent.trustTier < 3) {
        additionalConstraints.push({
          type: 'rate_limit',
          params: { maxRequests: 100, windowMs: 60000 },
        });
      }

      return {
        allow: true,
        constraints:
          additionalConstraints.length > 0 ? additionalConstraints : undefined,
      };
    },

    /**
     * Post-grant hook to add tracking
     */
    postGrant: async (
      agent: AgentIdentity,
      grant: CapabilityGrant
    ): Promise<CapabilityGrant> => {
      logger.debug(
        { agentDid: agent.did, grantId: grant.id },
        'Processing capability post-grant'
      );

      // Track active session
      let sessions = activeSessions.get(agent.did);
      if (!sessions) {
        sessions = new Set();
        activeSessions.set(agent.did, sessions);
      }
      sessions.add(grant.id);

      // Add governance metadata to grant
      return {
        ...grant,
        constraints: [
          ...(grant.constraints ?? []),
          {
            type: 'custom',
            params: {
              governanceVersion: '1.0.0',
              trackedAt: new Date().toISOString(),
            },
          },
        ],
      };
    },
  },

  action: {
    /**
     * Pre-action hook for policy enforcement
     */
    preAction: async (
      agent: AgentIdentity,
      action: ActionRequest
    ): Promise<PreActionResult> => {
      logger.debug(
        { agentDid: agent.did, actionType: action.type },
        'Evaluating action pre-check'
      );

      // Load and check constraints
      const constraints = loadConstraints(agent.did);
      const violation = checkConstraintViolation(constraints, action);

      if (violation.violated) {
        // Check if it's an approval requirement
        if (violation.message?.includes('requires approval')) {
          return {
            proceed: false,
            reason: violation.message,
            requiredApprovals: [
              {
                type: 'human',
                timeout: 300000, // 5 minutes
              },
            ],
          };
        }

        return {
          proceed: false,
          reason: violation.message,
        };
      }

      // Evaluate policy
      const policyContext: PolicyContext = {
        agent,
        action,
        environment: {
          timeOfDay: new Date().toTimeString().slice(0, 5),
          dayOfWeek: [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ][new Date().getDay()]!,
          isBusinessHours:
            new Date().getHours() >= 9 && new Date().getHours() < 17,
        },
        timestamp: new Date(),
      };

      const policyDecision = await evaluateSimplePolicy(policyContext);

      if (policyDecision.decision === 'deny') {
        return {
          proceed: false,
          reason: policyDecision.reasons.join('; '),
        };
      }

      if (policyDecision.decision === 'require_approval') {
        return {
          proceed: false,
          reason: policyDecision.reasons.join('; '),
          requiredApprovals: [{ type: 'manager', timeout: 600000 }],
        };
      }

      return { proceed: true };
    },

    /**
     * Post-action hook for audit logging
     */
    postAction: async (
      agent: AgentIdentity,
      action: ActionRecord
    ): Promise<void> => {
      logger.info(
        {
          agentDid: agent.did,
          actionId: action.id,
          actionType: action.type,
          success: action.result?.success,
          duration: action.completedAt
            ? new Date(action.completedAt).getTime() -
              new Date(action.startedAt).getTime()
            : undefined,
        },
        'Action completed - governance audit'
      );

      // In production: write to audit log
    },
  },

  monitoring: {
    /**
     * Verify agent behavior against baseline
     */
    verifyBehavior: async (
      agent: AgentIdentity,
      metrics: BehaviorMetrics
    ): Promise<BehaviorVerificationResult> => {
      const baseline = getBaseline(agent.did);
      const drift = calculateDrift(baseline, metrics);

      logger.debug(
        {
          agentDid: agent.did,
          driftScore: drift.score,
          categories: drift.categories,
        },
        'Behavior verification completed'
      );

      let recommendation: BehaviorVerificationResult['recommendation'];
      if (drift.score < 30) {
        recommendation = 'continue';
      } else if (drift.score < 50) {
        recommendation = 'warn';
      } else if (drift.score < 70) {
        recommendation = 'suspend';
      } else {
        recommendation = 'revoke';
      }

      return {
        inBounds: drift.score < 50,
        driftScore: drift.score,
        driftCategories: drift.categories,
        recommendation,
        details:
          drift.score > 0
            ? `Detected drift in: ${drift.categories.join(', ')}`
            : 'Behavior within expected bounds',
      };
    },
  },

  trust: {
    /**
     * Handle revocation events
     */
    onRevocation: async (revocation: RevocationEvent): Promise<void> => {
      logger.info(
        {
          revocationId: revocation.id,
          agentDid: revocation.agentDid,
          scope: revocation.scope,
          reason: revocation.reason,
        },
        'Processing revocation event'
      );

      // Notify running instances
      await notifyInstances(revocation.agentDid);

      // Terminate active sessions
      await terminateSessions(revocation.agentDid);

      // Clear constraints
      agentConstraints.delete(revocation.agentDid);

      // Clear baseline (will be regenerated if agent is re-certified)
      behaviorBaselines.delete(revocation.agentDid);
    },

    /**
     * Adjust trust score based on behavior
     */
    adjustTrust: async (
      agent: AgentIdentity,
      adjustment: TrustAdjustment
    ): Promise<TrustAdjustmentResult> => {
      const previousScore = getTrustScore(agent.did);
      const newScore = applyAdjustment(previousScore, adjustment);
      const previousTier = scoreToTier(previousScore);
      const newTier = scoreToTier(newScore);

      // Store new score
      trustScores.set(agent.did, newScore);

      logger.info(
        {
          agentDid: agent.did,
          previousScore,
          newScore,
          previousTier,
          newTier,
          adjustment: adjustment.type,
          reason: adjustment.reason,
        },
        'Trust score adjusted'
      );

      return {
        previousScore,
        newScore,
        previousTier,
        newTier,
        tierChanged: previousTier !== newTier,
      };
    },
  },

  policy: {
    /**
     * Evaluate policy for a given context
     */
    evaluate: async (context: PolicyContext): Promise<PolicyDecision> => {
      return evaluateSimplePolicy(context);
    },
  },
};

/**
 * Export factory function for creating governance extension
 * with custom configuration
 */
export function createGovernanceExtension(config?: {
  defaultConstraints?: Constraint[];
  trustScoreDecayRate?: number;
}): ACIExtension {
  // Could be extended to support custom configuration
  return cognigateExtension;
}

export default cognigateExtension;
