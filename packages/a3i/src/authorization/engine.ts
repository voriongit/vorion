/**
 * Authorization Engine - Core authorization decision-making
 *
 * The AuthorizationEngine is the central component of A3I that makes
 * permit/deny decisions for agent intents based on:
 * - Agent's trust profile and band
 * - Intent characteristics (action type, data sensitivity, reversibility)
 * - Policy rules and constraints
 * - Context factors
 * - Hook system for extensibility
 *
 * Key principles:
 * - Deterministic: Same inputs always produce same outputs
 * - Fast: <50ms latency target for decisions
 * - Auditable: All decisions logged with reasoning
 * - Extensible: Hooks for pre/post authorization
 */

import {
  TrustBand,
  ActionType,
  DataSensitivity,
  Reversibility,
  DenialReason,
  type Intent,
  type Decision,
  type TrustProfile,
  type AuthorizationResponse,
} from '@orion/contracts';
import {
  generateConstraints,
  type ConstraintGenerationOptions,
  BAND_CONSTRAINT_PRESETS,
} from './constraints.js';
import {
  buildPermitDecision,
  buildDenyDecision,
  getRemediations,
  type DecisionBuildOptions,
} from './decision.js';
import { TrustProfileService } from '../trust/profile-service.js';
import {
  type HookManager,
  type HookExecutionSummary,
} from '../hooks/index.js';

/**
 * Minimum trust band required for each action type
 */
export const ACTION_TYPE_REQUIREMENTS: Record<ActionType, TrustBand> = {
  [ActionType.READ]: TrustBand.T1_SUPERVISED,
  [ActionType.WRITE]: TrustBand.T2_CONSTRAINED,
  [ActionType.DELETE]: TrustBand.T2_CONSTRAINED,
  [ActionType.EXECUTE]: TrustBand.T2_CONSTRAINED,
  [ActionType.COMMUNICATE]: TrustBand.T2_CONSTRAINED,
  [ActionType.TRANSFER]: TrustBand.T3_TRUSTED,
};

/**
 * Minimum trust band required for each data sensitivity level
 */
export const DATA_SENSITIVITY_REQUIREMENTS: Record<DataSensitivity, TrustBand> = {
  [DataSensitivity.PUBLIC]: TrustBand.T1_SUPERVISED,
  [DataSensitivity.INTERNAL]: TrustBand.T2_CONSTRAINED,
  [DataSensitivity.CONFIDENTIAL]: TrustBand.T3_TRUSTED,
  [DataSensitivity.RESTRICTED]: TrustBand.T4_AUTONOMOUS,
};

/**
 * Trust band adjustments for reversibility
 */
export const REVERSIBILITY_ADJUSTMENTS: Record<Reversibility, number> = {
  [Reversibility.REVERSIBLE]: 0,
  [Reversibility.PARTIALLY_REVERSIBLE]: 0,
  [Reversibility.IRREVERSIBLE]: 1, // Requires one band higher
};

/**
 * Proof plane event logger interface
 * (Actual implementation in ORION package)
 */
export interface ProofPlaneLogger {
  logDecision(decision: Decision, intent: Intent): Promise<void>;
}

/**
 * No-op proof plane logger for when proof plane is not connected
 */
export const noopProofLogger: ProofPlaneLogger = {
  async logDecision() {},
};

/**
 * Configuration for the authorization engine
 */
export interface AuthorizationEngineConfig {
  /** Profile service for trust lookups */
  profileService?: TrustProfileService;
  /** Custom action type requirements */
  actionTypeRequirements?: Partial<Record<ActionType, TrustBand>>;
  /** Custom data sensitivity requirements */
  dataSensitivityRequirements?: Partial<Record<DataSensitivity, TrustBand>>;
  /** Proof plane logger for audit trail */
  proofLogger?: ProofPlaneLogger;
  /** Hook manager for extensibility */
  hookManager?: HookManager;
  /** Default policy set ID */
  defaultPolicySetId?: string;
  /** Decision validity duration in ms */
  decisionValidityMs?: number;
  /** Enable strict mode (deny on any ambiguity) */
  strictMode?: boolean;
  /** Enable hooks (default: true if hookManager provided) */
  enableHooks?: boolean;
}

/**
 * Authorization request with full intent
 */
export interface AuthorizeRequest {
  /** The intent to authorize */
  intent: Intent;
  /** Optional: Override constraint generation */
  constraintOptions?: ConstraintGenerationOptions;
  /** Optional: Use specific policy set */
  policySetId?: string;
}

/**
 * AuthorizationEngine - Makes permit/deny decisions for agent intents
 */
export class AuthorizationEngine {
  private readonly profileService: TrustProfileService;
  private readonly actionRequirements: Record<ActionType, TrustBand>;
  private readonly sensitivityRequirements: Record<DataSensitivity, TrustBand>;
  private readonly proofLogger: ProofPlaneLogger;
  private readonly hookManager?: HookManager;
  private readonly config: Required<Omit<AuthorizationEngineConfig, 'profileService' | 'proofLogger' | 'hookManager' | 'actionTypeRequirements' | 'dataSensitivityRequirements'>>;

  constructor(config: AuthorizationEngineConfig = {}) {
    this.profileService = config.profileService ?? new TrustProfileService();
    this.actionRequirements = {
      ...ACTION_TYPE_REQUIREMENTS,
      ...config.actionTypeRequirements,
    };
    this.sensitivityRequirements = {
      ...DATA_SENSITIVITY_REQUIREMENTS,
      ...config.dataSensitivityRequirements,
    };
    this.proofLogger = config.proofLogger ?? noopProofLogger;
    this.hookManager = config.hookManager;
    this.config = {
      defaultPolicySetId: config.defaultPolicySetId ?? 'default',
      decisionValidityMs: config.decisionValidityMs ?? 5 * 60 * 1000,
      strictMode: config.strictMode ?? false,
      enableHooks: config.enableHooks ?? (config.hookManager !== undefined),
    };
  }

  /**
   * Authorize an intent
   *
   * This is the main entry point for authorization decisions.
   * Returns a Decision object indicating whether the intent is permitted.
   *
   * Hook integration:
   * - PRE_AUTHORIZE hooks run before evaluation (can abort)
   * - POST_AUTHORIZE hooks run after decision is made
   */
  async authorize(request: AuthorizeRequest): Promise<AuthorizationResponse> {
    const startTime = Date.now();
    const { intent, constraintOptions, policySetId } = request;
    const now = new Date();

    const buildOptions: DecisionBuildOptions = {
      policySetId: policySetId ?? this.config.defaultPolicySetId,
      validityDurationMs: this.config.decisionValidityMs,
      now,
    };

    // Check if intent is expired
    if (intent.expiresAt && intent.expiresAt < now) {
      const decision = buildDenyDecision(
        intent,
        null,
        DenialReason.EXPIRED_INTENT,
        ['Intent has expired'],
        buildOptions
      );
      decision.latencyMs = Date.now() - startTime;
      await this.proofLogger.logDecision(decision, intent);
      return {
        decision,
        remediations: getRemediations(DenialReason.EXPIRED_INTENT),
      };
    }

    // Get trust profile for agent
    const profile = await this.profileService.get(intent.agentId);
    if (!profile) {
      const decision = buildDenyDecision(
        intent,
        null,
        DenialReason.INSUFFICIENT_TRUST,
        ['No trust profile found for agent', 'Agent must be registered before authorization'],
        buildOptions
      );
      decision.latencyMs = Date.now() - startTime;
      await this.proofLogger.logDecision(decision, intent);
      return {
        decision,
        remediations: ['Register agent with trust profile before requesting authorization'],
      };
    }

    // Execute pre-authorize hooks
    let preAuthorizeResult: HookExecutionSummary | undefined;
    if (this.config.enableHooks && this.hookManager) {
      preAuthorizeResult = await this.hookManager.executePreAuthorize({
        correlationId: intent.correlationId,
        intent,
        profile,
      });

      // If a hook aborted, deny the authorization
      if (preAuthorizeResult.aborted) {
        const decision = buildDenyDecision(
          intent,
          profile,
          DenialReason.POLICY_VIOLATION,
          [
            'Authorization aborted by pre-authorize hook',
            `Reason: ${preAuthorizeResult.abortReason ?? 'No reason provided'}`,
          ],
          buildOptions
        );
        decision.latencyMs = Date.now() - startTime;
        await this.proofLogger.logDecision(decision, intent);
        return {
          decision,
          remediations: [preAuthorizeResult.abortReason ?? 'Pre-authorize hook aborted the request'],
        };
      }
    }

    // Evaluate authorization
    const evaluation = this.evaluate(intent, profile);

    let response: AuthorizationResponse;

    if (evaluation.permitted) {
      // Generate constraints
      const constraints = generateConstraints(profile.band, intent, constraintOptions);

      const decision = buildPermitDecision(
        intent,
        profile,
        constraints,
        evaluation.reasoning,
        buildOptions
      );
      decision.latencyMs = Date.now() - startTime;
      await this.proofLogger.logDecision(decision, intent);

      response = { decision };
    } else {
      const decision = buildDenyDecision(
        intent,
        profile,
        evaluation.denialReason,
        evaluation.reasoning,
        buildOptions
      );
      decision.latencyMs = Date.now() - startTime;
      await this.proofLogger.logDecision(decision, intent);

      response = {
        decision,
        remediations: getRemediations(evaluation.denialReason),
      };
    }

    // Execute post-authorize hooks
    if (this.config.enableHooks && this.hookManager) {
      await this.hookManager.executePostAuthorize({
        correlationId: intent.correlationId,
        intent,
        decision: response.decision,
        profile,
      });
    }

    return response;
  }

  /**
   * Evaluate an intent against a trust profile
   * This is the core authorization logic - deterministic and fast
   */
  evaluate(
    intent: Intent,
    profile: TrustProfile
  ): {
    permitted: boolean;
    reasoning: string[];
    denialReason: DenialReason;
    requiredBand: TrustBand;
  } {
    const reasoning: string[] = [];

    // Calculate minimum required trust band
    const actionBand = this.actionRequirements[intent.actionType];
    const sensitivityBand = this.sensitivityRequirements[intent.dataSensitivity];
    const reversibilityAdjustment = REVERSIBILITY_ADJUSTMENTS[intent.reversibility];

    // Take the maximum of all requirements
    let requiredBand = Math.max(actionBand, sensitivityBand) as TrustBand;

    // Apply reversibility adjustment
    if (reversibilityAdjustment > 0) {
      requiredBand = Math.min(requiredBand + reversibilityAdjustment, TrustBand.T5_MISSION_CRITICAL) as TrustBand;
    }

    reasoning.push(
      `Action type '${intent.actionType}' requires band ${TrustBand[actionBand]}`,
      `Data sensitivity '${intent.dataSensitivity}' requires band ${TrustBand[sensitivityBand]}`
    );

    if (reversibilityAdjustment > 0) {
      reasoning.push(
        `Irreversible action increases requirement by ${reversibilityAdjustment} band(s)`
      );
    }

    reasoning.push(`Minimum required band: ${TrustBand[requiredBand]}`);
    reasoning.push(`Agent's current band: ${TrustBand[profile.band]} (score: ${profile.adjustedScore})`);

    // Check band requirement
    if (profile.band < requiredBand) {
      reasoning.push(
        `DENIED: Agent band ${TrustBand[profile.band]} is below required ${TrustBand[requiredBand]}`
      );
      return {
        permitted: false,
        reasoning,
        denialReason: DenialReason.INSUFFICIENT_TRUST,
        requiredBand,
      };
    }

    // Check T0 always denied
    if (profile.band === TrustBand.T0_UNTRUSTED) {
      reasoning.push('DENIED: T0_UNTRUSTED agents cannot perform any actions');
      return {
        permitted: false,
        reasoning,
        denialReason: DenialReason.INSUFFICIENT_TRUST,
        requiredBand,
      };
    }

    // Check resource scope restrictions
    const scopeCheck = this.checkResourceScope(intent, profile);
    if (!scopeCheck.allowed) {
      reasoning.push(`DENIED: ${scopeCheck.reason}`);
      return {
        permitted: false,
        reasoning,
        denialReason: DenialReason.RESOURCE_RESTRICTED,
        requiredBand,
      };
    }

    // Check context restrictions
    const contextCheck = this.checkContext(intent, profile);
    if (!contextCheck.allowed) {
      reasoning.push(`DENIED: ${contextCheck.reason}`);
      return {
        permitted: false,
        reasoning,
        denialReason: DenialReason.CONTEXT_MISMATCH,
        requiredBand,
      };
    }

    // All checks passed
    reasoning.push('PERMITTED: All authorization checks passed');
    return {
      permitted: true,
      reasoning,
      denialReason: DenialReason.POLICY_VIOLATION, // Not used
      requiredBand,
    };
  }

  /**
   * Check resource scope restrictions
   */
  private checkResourceScope(
    intent: Intent,
    profile: TrustProfile
  ): { allowed: boolean; reason?: string } {
    const preset = BAND_CONSTRAINT_PRESETS[profile.band];

    // Check if band allows any data scopes
    if (preset.defaultDataScopes.length === 0) {
      return { allowed: false, reason: 'Band does not allow any data access' };
    }

    // Check for restricted resources at lower bands
    if (
      intent.dataSensitivity === DataSensitivity.RESTRICTED &&
      !preset.defaultDataScopes.includes('restricted') &&
      !preset.defaultDataScopes.includes('*')
    ) {
      return {
        allowed: false,
        reason: 'Restricted data requires higher trust band',
      };
    }

    return { allowed: true };
  }

  /**
   * Check context restrictions
   */
  private checkContext(
    intent: Intent,
    profile: TrustProfile
  ): { allowed: boolean; reason?: string } {
    const context = intent.context;

    // Check production environment restrictions
    if (context?.environment === 'production' && profile.band < TrustBand.T3_TRUSTED) {
      return {
        allowed: false,
        reason: 'Production environment requires T3+ trust band',
      };
    }

    // Check PII handling restrictions
    if (context?.handlesPii && profile.band < TrustBand.T2_CONSTRAINED) {
      return {
        allowed: false,
        reason: 'PII handling requires T2+ trust band',
      };
    }

    // Check PHI handling restrictions
    if (context?.handlesPhi && profile.band < TrustBand.T3_TRUSTED) {
      return {
        allowed: false,
        reason: 'PHI handling requires T3+ trust band',
      };
    }

    // In strict mode, require domain match
    if (this.config.strictMode && context?.domain) {
      // This would be extended with actual domain policy checks
    }

    return { allowed: true };
  }

  /**
   * Quick check if an agent can perform an action type
   * (Without full profile lookup - uses cached band if available)
   */
  canPerformActionType(band: TrustBand, actionType: ActionType): boolean {
    return band >= this.actionRequirements[actionType];
  }

  /**
   * Quick check if an agent can access data sensitivity level
   */
  canAccessDataSensitivity(band: TrustBand, sensitivity: DataSensitivity): boolean {
    return band >= this.sensitivityRequirements[sensitivity];
  }

  /**
   * Get the minimum band required for an action + sensitivity combination
   */
  getRequiredBand(
    actionType: ActionType,
    dataSensitivity: DataSensitivity,
    reversibility: Reversibility = Reversibility.REVERSIBLE
  ): TrustBand {
    const actionBand = this.actionRequirements[actionType];
    const sensitivityBand = this.sensitivityRequirements[dataSensitivity];
    const adjustment = REVERSIBILITY_ADJUSTMENTS[reversibility];
    const required = Math.max(actionBand, sensitivityBand) + adjustment;
    return Math.min(required, TrustBand.T5_MISSION_CRITICAL) as TrustBand;
  }

  /**
   * Get the profile service
   */
  getProfileService(): TrustProfileService {
    return this.profileService;
  }
}

/**
 * Create an AuthorizationEngine with default configuration
 */
export function createAuthorizationEngine(
  config?: AuthorizationEngineConfig
): AuthorizationEngine {
  return new AuthorizationEngine(config);
}
