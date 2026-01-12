/**
 * Tests for Authorization Engine and related components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  TrustBand,
  ObservationTier,
  ActionType,
  DataSensitivity,
  Reversibility,
  DenialReason,
  ApprovalType,
  type Intent,
  type TrustEvidence,
} from '@orion/contracts';
import {
  AuthorizationEngine,
  createAuthorizationEngine,
  generateConstraints,
  buildPermitDecision,
  buildDenyDecision,
  getRemediations,
  DecisionBuilder,
  ACTION_TYPE_REQUIREMENTS,
  DATA_SENSITIVITY_REQUIREMENTS,
  BAND_CONSTRAINT_PRESETS,
} from '../../src/authorization/index.js';
import { TrustProfileService } from '../../src/trust/profile-service.js';

// Helper to create test intent
function createIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    intentId: uuidv4(),
    agentId: 'test-agent',
    correlationId: uuidv4(),
    action: 'Test action',
    actionType: ActionType.READ,
    resourceScope: ['resource-1'],
    dataSensitivity: DataSensitivity.PUBLIC,
    reversibility: Reversibility.REVERSIBLE,
    context: {},
    createdAt: new Date(),
    ...overrides,
  };
}

// Helper to create test evidence
function createEvidence(
  dimension: 'CT' | 'BT' | 'GT' | 'XT' | 'AC',
  impact: number
): TrustEvidence {
  return {
    evidenceId: uuidv4(),
    dimension,
    impact,
    source: 'test',
    collectedAt: new Date(),
  };
}

describe('Constraints', () => {
  describe('generateConstraints', () => {
    it('should generate constraints for T1 band', () => {
      const intent = createIntent();
      const constraints = generateConstraints(TrustBand.T1_SUPERVISED, intent);

      expect(constraints.allowedTools).toContain('read_public');
      expect(constraints.dataScopes).toContain('public');
      expect(constraints.maxExecutionTimeMs).toBe(5000);
      // Reversibility not required if intent is already reversible
      expect(constraints.reversibilityRequired).toBe(false);
    });

    it('should require reversibility for irreversible intents at T1', () => {
      const intent = createIntent({
        reversibility: Reversibility.IRREVERSIBLE,
      });
      const constraints = generateConstraints(TrustBand.T1_SUPERVISED, intent);
      expect(constraints.reversibilityRequired).toBe(true);
    });

    it('should generate more permissive constraints for higher bands', () => {
      const intent = createIntent({
        actionType: ActionType.EXECUTE,
        dataSensitivity: DataSensitivity.INTERNAL,
      });

      const t2Constraints = generateConstraints(TrustBand.T2_CONSTRAINED, intent);
      const t4Constraints = generateConstraints(TrustBand.T4_AUTONOMOUS, intent);

      expect(t4Constraints.allowedTools.length).toBeGreaterThan(
        t2Constraints.allowedTools.length
      );
      expect(t4Constraints.rateLimits[0]?.limit ?? 0).toBeGreaterThan(
        t2Constraints.rateLimits[0]?.limit ?? 0
      );
    });

    it('should require approvals for irreversible actions at lower bands', () => {
      const intent = createIntent({
        reversibility: Reversibility.IRREVERSIBLE,
      });

      const constraints = generateConstraints(TrustBand.T2_CONSTRAINED, intent);
      expect(constraints.requiredApprovals.length).toBeGreaterThan(0);
      expect(constraints.requiredApprovals[0]!.type).toBe(ApprovalType.HUMAN_REVIEW);
    });

    it('should not require approvals for irreversible actions at T3+', () => {
      const intent = createIntent({
        reversibility: Reversibility.IRREVERSIBLE,
      });

      const constraints = generateConstraints(TrustBand.T3_TRUSTED, intent);
      const irreversibleApprovals = constraints.requiredApprovals.filter(
        (a) => a.reason.includes('Irreversible')
      );
      expect(irreversibleApprovals.length).toBe(0);
    });

    it('should require multi-party approval for restricted data', () => {
      const intent = createIntent({
        dataSensitivity: DataSensitivity.RESTRICTED,
      });

      const constraints = generateConstraints(TrustBand.T3_TRUSTED, intent);
      const dataApprovals = constraints.requiredApprovals.filter(
        (a) => a.reason.includes('restricted data')
      );
      expect(dataApprovals.length).toBeGreaterThan(0);
      expect(dataApprovals[0]!.type).toBe(ApprovalType.MULTI_PARTY);
    });

    it('should have no limits for T5 band', () => {
      const intent = createIntent();
      const constraints = generateConstraints(TrustBand.T5_MISSION_CRITICAL, intent);

      expect(constraints.allowedTools).toContain('*');
      expect(constraints.dataScopes).toContain('*');
      expect(constraints.rateLimits.length).toBe(0);
    });
  });

  describe('BAND_CONSTRAINT_PRESETS', () => {
    it('should have presets for all bands', () => {
      const bands = [
        TrustBand.T0_UNTRUSTED,
        TrustBand.T1_SUPERVISED,
        TrustBand.T2_CONSTRAINED,
        TrustBand.T3_TRUSTED,
        TrustBand.T4_AUTONOMOUS,
        TrustBand.T5_MISSION_CRITICAL,
      ];

      bands.forEach((band) => {
        expect(BAND_CONSTRAINT_PRESETS[band]).toBeDefined();
      });
    });

    it('should have T0 with no permissions', () => {
      const t0 = BAND_CONSTRAINT_PRESETS[TrustBand.T0_UNTRUSTED];
      expect(t0.defaultTools.length).toBe(0);
      expect(t0.defaultDataScopes.length).toBe(0);
      expect(t0.maxExecutionTimeMs).toBe(0);
    });
  });
});

describe('Decision Building', () => {
  const mockProfile = {
    profileId: uuidv4(),
    agentId: 'test-agent',
    dimensions: { CT: 60, BT: 60, GT: 60, XT: 60, AC: 60 },
    weights: { CT: 0.25, BT: 0.25, GT: 0.20, XT: 0.15, AC: 0.15 },
    compositeScore: 60,
    observationTier: ObservationTier.BLACK_BOX,
    adjustedScore: 60,
    band: TrustBand.T3_TRUSTED,
    calculatedAt: new Date(),
    evidence: [],
    version: 1,
  };

  describe('buildPermitDecision', () => {
    it('should build a permit decision', () => {
      const intent = createIntent();
      const constraints = generateConstraints(mockProfile.band, intent);

      const decision = buildPermitDecision(
        intent,
        mockProfile,
        constraints,
        ['Test reasoning']
      );

      expect(decision.permitted).toBe(true);
      expect(decision.intentId).toBe(intent.intentId);
      expect(decision.agentId).toBe(intent.agentId);
      expect(decision.trustBand).toBe(mockProfile.band);
      expect(decision.constraints).toBeDefined();
      expect(decision.reasoning).toContain('Test reasoning');
    });

    it('should set expiration time', () => {
      const intent = createIntent();
      const constraints = generateConstraints(mockProfile.band, intent);
      const now = new Date();

      const decision = buildPermitDecision(
        intent,
        mockProfile,
        constraints,
        [],
        { now, validityDurationMs: 10000 }
      );

      expect(decision.decidedAt).toEqual(now);
      expect(decision.expiresAt.getTime()).toBe(now.getTime() + 10000);
    });
  });

  describe('buildDenyDecision', () => {
    it('should build a deny decision', () => {
      const intent = createIntent();

      const decision = buildDenyDecision(
        intent,
        mockProfile,
        DenialReason.INSUFFICIENT_TRUST,
        ['Not enough trust']
      );

      expect(decision.permitted).toBe(false);
      expect(decision.constraints).toBeUndefined();
      expect(decision.reasoning).toContain('Not enough trust');
    });

    it('should handle null profile', () => {
      const intent = createIntent();

      const decision = buildDenyDecision(
        intent,
        null,
        DenialReason.INSUFFICIENT_TRUST,
        ['No profile found']
      );

      expect(decision.trustBand).toBe(TrustBand.T0_UNTRUSTED);
      expect(decision.trustScore).toBe(0);
    });
  });

  describe('getRemediations', () => {
    it('should return remediations for each denial reason', () => {
      const reasons = [
        DenialReason.INSUFFICIENT_TRUST,
        DenialReason.POLICY_VIOLATION,
        DenialReason.RESOURCE_RESTRICTED,
        DenialReason.DATA_SENSITIVITY_EXCEEDED,
        DenialReason.RATE_LIMIT_EXCEEDED,
        DenialReason.CONTEXT_MISMATCH,
        DenialReason.EXPIRED_INTENT,
        DenialReason.SYSTEM_ERROR,
      ];

      reasons.forEach((reason) => {
        const remediations = getRemediations(reason);
        expect(remediations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('DecisionBuilder', () => {
    it('should build permit decision with fluent API', () => {
      const intent = createIntent();
      const constraints = generateConstraints(mockProfile.band, intent);

      const decision = DecisionBuilder.for(intent)
        .withProfile(mockProfile)
        .permit()
        .withConstraints(constraints)
        .addReasoning('Fluent API test')
        .build();

      expect(decision.permitted).toBe(true);
      expect(decision.reasoning).toContain('Fluent API test');
    });

    it('should build deny decision with fluent API', () => {
      const intent = createIntent();

      const decision = DecisionBuilder.for(intent)
        .withProfile(mockProfile)
        .deny(DenialReason.POLICY_VIOLATION)
        .addReasoning('Policy issue')
        .build();

      expect(decision.permitted).toBe(false);
    });
  });
});

describe('AuthorizationEngine', () => {
  let engine: AuthorizationEngine;
  let profileService: TrustProfileService;

  beforeEach(async () => {
    profileService = new TrustProfileService();
    engine = new AuthorizationEngine({ profileService });

    // Create test profile
    await profileService.create(
      'test-agent',
      ObservationTier.WHITE_BOX,
      [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]
    );
  });

  describe('authorize', () => {
    it('should permit read action for T3 agent', async () => {
      const intent = createIntent({
        agentId: 'test-agent',
        actionType: ActionType.READ,
        dataSensitivity: DataSensitivity.PUBLIC,
      });

      const response = await engine.authorize({ intent });

      expect(response.decision.permitted).toBe(true);
      expect(response.decision.constraints).toBeDefined();
      expect(response.decision.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should deny for unknown agent', async () => {
      const intent = createIntent({
        agentId: 'unknown-agent',
      });

      const response = await engine.authorize({ intent });

      expect(response.decision.permitted).toBe(false);
      expect(response.remediations).toBeDefined();
      expect(response.remediations!.length).toBeGreaterThan(0);
    });

    it('should deny expired intent', async () => {
      const intent = createIntent({
        agentId: 'test-agent',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const response = await engine.authorize({ intent });

      expect(response.decision.permitted).toBe(false);
      expect(response.decision.reasoning).toContain('Intent has expired');
    });

    it('should deny T0 agents for any action', async () => {
      // Create a T0 agent with very negative evidence to drop below T0 threshold (0-20)
      await profileService.create(
        't0-agent',
        ObservationTier.BLACK_BOX,
        [
          createEvidence('CT', -45),
          createEvidence('BT', -45),
          createEvidence('GT', -45),
          createEvidence('XT', -45),
          createEvidence('AC', -45),
        ]
      );

      const profile = await profileService.get('t0-agent');
      expect(profile).toBeDefined();
      expect(profile!.band).toBe(TrustBand.T0_UNTRUSTED);

      const intent = createIntent({
        agentId: 't0-agent',
        actionType: ActionType.READ,
        dataSensitivity: DataSensitivity.PUBLIC,
      });

      const response = await engine.authorize({ intent });

      expect(response.decision.permitted).toBe(false);
      expect(response.decision.reasoning.some((r) => r.includes('T0_UNTRUSTED'))).toBe(
        true
      );
    });

    it('should deny restricted data access for low trust agents', async () => {
      const intent = createIntent({
        agentId: 'test-agent',
        dataSensitivity: DataSensitivity.RESTRICTED,
      });

      // Our test agent is T3, but restricted requires T4
      const response = await engine.authorize({ intent });

      // T3 should not be able to access RESTRICTED data
      expect(response.decision.permitted).toBe(false);
    });

    it('should deny production environment for low trust', async () => {
      // Create a T2 agent (need to get score in T2 range: 41-55)
      // With BLACK_BOX ceiling at 60, we need evidence that brings score to T2 range
      await profileService.create(
        't2-agent',
        ObservationTier.BLACK_BOX,
        [
          createEvidence('CT', -5),
          createEvidence('BT', -5),
        ] // Slight negative evidence to stay in T2 range
      );

      const profile = await profileService.get('t2-agent');
      expect(profile).toBeDefined();
      expect(profile!.band).toBe(TrustBand.T2_CONSTRAINED);

      const intent = createIntent({
        agentId: 't2-agent',
        actionType: ActionType.READ,
        dataSensitivity: DataSensitivity.PUBLIC,
        context: { environment: 'production' },
      });

      const response = await engine.authorize({ intent });

      // T2 should be denied for production environment (requires T3+)
      expect(response.decision.permitted).toBe(false);
      expect(response.decision.reasoning.some((r) => r.includes('Production environment'))).toBe(
        true
      );
    });

    it('should include latency in decision', async () => {
      const intent = createIntent({ agentId: 'test-agent' });
      const response = await engine.authorize({ intent });

      expect(response.decision.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.decision.latencyMs).toBeLessThan(1000); // Should be fast
    });
  });

  describe('evaluate', () => {
    it('should calculate correct required band', async () => {
      const profile = await profileService.get('test-agent');
      expect(profile).toBeDefined();

      const intent = createIntent({
        actionType: ActionType.WRITE,
        dataSensitivity: DataSensitivity.CONFIDENTIAL,
        reversibility: Reversibility.IRREVERSIBLE,
      });

      const evaluation = engine.evaluate(intent, profile!);

      // WRITE requires T2, CONFIDENTIAL requires T3, IRREVERSIBLE adds +1
      // So required should be T4
      expect(evaluation.requiredBand).toBe(TrustBand.T4_AUTONOMOUS);
    });

    it('should include detailed reasoning', async () => {
      const profile = await profileService.get('test-agent');
      const intent = createIntent({
        actionType: ActionType.EXECUTE,
        dataSensitivity: DataSensitivity.INTERNAL,
      });

      const evaluation = engine.evaluate(intent, profile!);

      expect(evaluation.reasoning.length).toBeGreaterThan(0);
      expect(evaluation.reasoning.some((r) => r.includes('Action type'))).toBe(true);
      expect(evaluation.reasoning.some((r) => r.includes('Data sensitivity'))).toBe(
        true
      );
    });
  });

  describe('helper methods', () => {
    it('canPerformActionType should check band requirements', () => {
      expect(engine.canPerformActionType(TrustBand.T1_SUPERVISED, ActionType.READ)).toBe(
        true
      );
      expect(
        engine.canPerformActionType(TrustBand.T1_SUPERVISED, ActionType.TRANSFER)
      ).toBe(false);
      expect(engine.canPerformActionType(TrustBand.T3_TRUSTED, ActionType.TRANSFER)).toBe(
        true
      );
    });

    it('canAccessDataSensitivity should check band requirements', () => {
      expect(
        engine.canAccessDataSensitivity(TrustBand.T1_SUPERVISED, DataSensitivity.PUBLIC)
      ).toBe(true);
      expect(
        engine.canAccessDataSensitivity(TrustBand.T2_CONSTRAINED, DataSensitivity.RESTRICTED)
      ).toBe(false);
      expect(
        engine.canAccessDataSensitivity(TrustBand.T4_AUTONOMOUS, DataSensitivity.RESTRICTED)
      ).toBe(true);
    });

    it('getRequiredBand should combine requirements', () => {
      // READ + PUBLIC = T1
      expect(
        engine.getRequiredBand(ActionType.READ, DataSensitivity.PUBLIC)
      ).toBe(TrustBand.T1_SUPERVISED);

      // WRITE + CONFIDENTIAL = T3
      expect(
        engine.getRequiredBand(ActionType.WRITE, DataSensitivity.CONFIDENTIAL)
      ).toBe(TrustBand.T3_TRUSTED);

      // TRANSFER + RESTRICTED + IRREVERSIBLE = T5
      expect(
        engine.getRequiredBand(
          ActionType.TRANSFER,
          DataSensitivity.RESTRICTED,
          Reversibility.IRREVERSIBLE
        )
      ).toBe(TrustBand.T5_MISSION_CRITICAL);
    });
  });

  describe('configuration', () => {
    it('should accept custom action requirements', async () => {
      const customEngine = createAuthorizationEngine({
        profileService,
        actionTypeRequirements: {
          [ActionType.READ]: TrustBand.T3_TRUSTED, // Stricter than default
        },
      });

      const intent = createIntent({
        agentId: 'test-agent',
        actionType: ActionType.READ,
      });

      // T3 agent with T3 requirement should still pass
      const response = await customEngine.authorize({ intent });

      // Should need T3 for READ now
      expect(
        customEngine.canPerformActionType(TrustBand.T2_CONSTRAINED, ActionType.READ)
      ).toBe(false);
      expect(
        customEngine.canPerformActionType(TrustBand.T3_TRUSTED, ActionType.READ)
      ).toBe(true);
    });
  });

  describe('createAuthorizationEngine factory', () => {
    it('should create engine with default config', () => {
      const engine = createAuthorizationEngine();
      expect(engine).toBeInstanceOf(AuthorizationEngine);
    });

    it('should create engine with custom config', () => {
      const engine = createAuthorizationEngine({
        defaultPolicySetId: 'custom-policy',
        strictMode: true,
      });
      expect(engine).toBeInstanceOf(AuthorizationEngine);
    });
  });
});

describe('AuthorizationEngine with Hooks', () => {
  let profileService: TrustProfileService;

  beforeEach(async () => {
    profileService = new TrustProfileService();

    // Create test profile
    await profileService.create(
      'test-agent',
      ObservationTier.WHITE_BOX,
      [
        createEvidence('CT', 20),
        createEvidence('BT', 20),
        createEvidence('GT', 20),
        createEvidence('XT', 20),
        createEvidence('AC', 20),
      ]
    );
  });

  it('should execute pre-authorize hooks before decision', async () => {
    const hookCalls: string[] = [];
    const { createHookManager } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPreAuthorize('test-pre-hook', async () => {
      hookCalls.push('pre-authorize');
      return { success: true };
    });

    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    await engine.authorize({ intent });

    expect(hookCalls).toContain('pre-authorize');
  });

  it('should execute post-authorize hooks after decision', async () => {
    const hookCalls: string[] = [];
    const { createHookManager } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPostAuthorize('test-post-hook', async (ctx) => {
      hookCalls.push(`post-authorize:${ctx.decision.permitted}`);
      return { success: true };
    });

    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    await engine.authorize({ intent });

    expect(hookCalls).toContain('post-authorize:true');
  });

  it('should deny authorization when pre-authorize hook aborts', async () => {
    const { createHookManager, abortResult } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPreAuthorize('abort-hook', async () => {
      return abortResult('Custom abort reason');
    });

    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    const response = await engine.authorize({ intent });

    expect(response.decision.permitted).toBe(false);
    expect(response.decision.reasoning).toContain('Authorization aborted by pre-authorize hook');
    expect(response.decision.reasoning.some(r => r.includes('Custom abort reason'))).toBe(true);
  });

  it('should not execute hooks when enableHooks is false', async () => {
    const hookCalls: string[] = [];
    const { createHookManager } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPreAuthorize('test-hook', async () => {
      hookCalls.push('should-not-be-called');
      return { success: true };
    });

    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
      enableHooks: false,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    await engine.authorize({ intent });

    expect(hookCalls).toHaveLength(0);
  });

  it('should pass intent and profile to pre-authorize hooks', async () => {
    let receivedContext: Record<string, unknown> | null = null;
    const { createHookManager } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPreAuthorize('context-check-hook', async (ctx) => {
      receivedContext = {
        intent: ctx.intent,
        profile: ctx.profile,
        correlationId: ctx.correlationId,
      };
      return { success: true };
    });

    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    await engine.authorize({ intent });

    expect(receivedContext).not.toBeNull();
    expect((receivedContext as Record<string, unknown>).intent).toBeDefined();
    expect((receivedContext as Record<string, unknown>).profile).toBeDefined();
    expect((receivedContext as Record<string, unknown>).correlationId).toBe(intent.correlationId);
  });

  it('should pass decision to post-authorize hooks', async () => {
    let receivedDecision: unknown = null;
    const { createHookManager } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPostAuthorize('decision-check-hook', async (ctx) => {
      receivedDecision = ctx.decision;
      return { success: true };
    });

    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    const response = await engine.authorize({ intent });

    expect(receivedDecision).not.toBeNull();
    expect((receivedDecision as { permitted: boolean }).permitted).toBe(response.decision.permitted);
  });

  it('should enable hooks by default when hookManager is provided', async () => {
    const hookCalls: string[] = [];
    const { createHookManager } = await import('../../src/hooks/index.js');
    const hookManager = createHookManager();

    hookManager.onPreAuthorize('auto-enabled-hook', async () => {
      hookCalls.push('called');
      return { success: true };
    });

    // Not explicitly setting enableHooks - should default to true
    const engine = new AuthorizationEngine({
      profileService,
      hookManager,
    });

    const intent = createIntent({ agentId: 'test-agent' });
    await engine.authorize({ intent });

    expect(hookCalls).toHaveLength(1);
  });
});

describe('Requirement Constants', () => {
  describe('ACTION_TYPE_REQUIREMENTS', () => {
    it('should have requirements for all action types', () => {
      const actionTypes = [
        ActionType.READ,
        ActionType.WRITE,
        ActionType.DELETE,
        ActionType.EXECUTE,
        ActionType.COMMUNICATE,
        ActionType.TRANSFER,
      ];

      actionTypes.forEach((type) => {
        expect(ACTION_TYPE_REQUIREMENTS[type]).toBeDefined();
        expect(ACTION_TYPE_REQUIREMENTS[type]).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have READ as lowest requirement', () => {
      const requirements = Object.values(ACTION_TYPE_REQUIREMENTS);
      const readRequirement = ACTION_TYPE_REQUIREMENTS[ActionType.READ];
      expect(readRequirement).toBe(Math.min(...requirements));
    });

    it('should have TRANSFER as highest requirement', () => {
      const requirements = Object.values(ACTION_TYPE_REQUIREMENTS);
      const transferRequirement = ACTION_TYPE_REQUIREMENTS[ActionType.TRANSFER];
      expect(transferRequirement).toBe(Math.max(...requirements));
    });
  });

  describe('DATA_SENSITIVITY_REQUIREMENTS', () => {
    it('should have requirements for all sensitivity levels', () => {
      const levels = [
        DataSensitivity.PUBLIC,
        DataSensitivity.INTERNAL,
        DataSensitivity.CONFIDENTIAL,
        DataSensitivity.RESTRICTED,
      ];

      levels.forEach((level) => {
        expect(DATA_SENSITIVITY_REQUIREMENTS[level]).toBeDefined();
      });
    });

    it('should have increasing requirements for higher sensitivity', () => {
      expect(DATA_SENSITIVITY_REQUIREMENTS[DataSensitivity.PUBLIC]).toBeLessThan(
        DATA_SENSITIVITY_REQUIREMENTS[DataSensitivity.INTERNAL]
      );
      expect(DATA_SENSITIVITY_REQUIREMENTS[DataSensitivity.INTERNAL]).toBeLessThan(
        DATA_SENSITIVITY_REQUIREMENTS[DataSensitivity.CONFIDENTIAL]
      );
      expect(DATA_SENSITIVITY_REQUIREMENTS[DataSensitivity.CONFIDENTIAL]).toBeLessThan(
        DATA_SENSITIVITY_REQUIREMENTS[DataSensitivity.RESTRICTED]
      );
    });
  });
});
