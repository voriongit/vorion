/**
 * Phase 6 Trust Engine Hardening - Integration Tests
 *
 * Tests all 5 architecture decisions:
 * - Q1: Ceiling Enforcement
 * - Q2: Hierarchical Context
 * - Q3: Stratified Role Gates
 * - Q4: Federated Weight Presets
 * - Q5: Provenance + Policy Modifiers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Types
  TrustTier,
  AgentRole,
  ContextType,
  CreationType,
  RegulatoryFramework,
  CONTEXT_CEILINGS,
  ROLE_GATE_MATRIX,
  ACI_CANONICAL_PRESETS,
  getTierFromScore,
  getCeilingForContext,
  validateRoleGateKernel,
  clampToCeiling,

  // Q2: Context
  createDeploymentContext,
  createOrganizationalContext,
  createAgentContext,
  createOperationContext,
  OrganizationalContextBuilder,
  verifyDeploymentContext,
  verifyOrganizationalContext,
  verifyAgentContext,
  validateContextChain,
  getAgentContextCeiling,
  isOperationExpired,
  ContextService,
  createContextService,

  // Q4: Presets
  getACIPreset,
  getAllACIPresets,
  derivePreset,
  createVorionPreset,
  buildPresetLineage,
  verifyPresetLineage,
  normalizeWeights,
  validateWeights,
  calculateWeightsDelta,
  PresetService,
  createPresetService,
  initializeVorionPresets,

  // Q5: Provenance
  createProvenance,
  verifyProvenance,
  createModifierPolicy,
  evaluateModifier,
  ProvenanceService,
  createProvenanceService,
  initializeDefaultPolicies,
  DEFAULT_CREATION_MODIFIERS,

  // Q1: Ceiling
  calculateEffectiveCeiling,
  enforceKernelCeiling,
  detectGamingIndicators,
  getRetentionRequirements,
  createTrustComputationEvent,
  CeilingEnforcementService,
  createCeilingEnforcementService,

  // Q3: Role Gates
  getRoleGateMatrix,
  getMinimumTierForRole,
  evaluateKernelLayer,
  evaluatePolicyLayer,
  evaluateBasisLayer,
  evaluateRoleGate,
  RoleGateService,
  createRoleGateService,

  // Factory
  createPhase6TrustEngine,
  PHASE6_VERSION,
} from '../src/phase6/index.js';

// =============================================================================
// TYPE SYSTEM TESTS
// =============================================================================

describe('Phase 6 Type System', () => {
  describe('TrustTier', () => {
    it('should have 6 tiers from T0 to T5', () => {
      expect(Object.values(TrustTier)).toHaveLength(6);
      expect(TrustTier.T0).toBe('T0');
      expect(TrustTier.T5).toBe('T5');
    });
  });

  describe('AgentRole', () => {
    it('should have 9 roles from R-L0 to R-L8', () => {
      expect(Object.values(AgentRole)).toHaveLength(9);
      expect(AgentRole.R_L0).toBe('R-L0');
      expect(AgentRole.R_L8).toBe('R-L8');
    });
  });

  describe('ContextType', () => {
    it('should have 3 context types', () => {
      expect(Object.values(ContextType)).toHaveLength(3);
      expect(ContextType.LOCAL).toBe('local');
      expect(ContextType.ENTERPRISE).toBe('enterprise');
      expect(ContextType.SOVEREIGN).toBe('sovereign');
    });
  });

  describe('getTierFromScore', () => {
    it('should return T0 for scores 0-99', () => {
      expect(getTierFromScore(0)).toBe(TrustTier.T0);
      expect(getTierFromScore(50)).toBe(TrustTier.T0);
      expect(getTierFromScore(99)).toBe(TrustTier.T0);
    });

    it('should return T5 for scores 900+', () => {
      expect(getTierFromScore(900)).toBe(TrustTier.T5);
      expect(getTierFromScore(1000)).toBe(TrustTier.T5);
    });

    it('should return correct tier for boundary values', () => {
      expect(getTierFromScore(100)).toBe(TrustTier.T1);
      expect(getTierFromScore(300)).toBe(TrustTier.T2);
      expect(getTierFromScore(500)).toBe(TrustTier.T3);
      expect(getTierFromScore(700)).toBe(TrustTier.T4);
    });
  });

  describe('getCeilingForContext', () => {
    it('should return correct ceiling for each context type', () => {
      expect(getCeilingForContext(ContextType.LOCAL)).toBe(700);
      expect(getCeilingForContext(ContextType.ENTERPRISE)).toBe(900);
      expect(getCeilingForContext(ContextType.SOVEREIGN)).toBe(1000);
    });
  });

  describe('clampToCeiling', () => {
    it('should clamp score to ceiling', () => {
      expect(clampToCeiling(800, 700)).toBe(700);
      expect(clampToCeiling(500, 700)).toBe(500);
      expect(clampToCeiling(-10, 700)).toBe(0);
    });
  });
});

// =============================================================================
// Q2: HIERARCHICAL CONTEXT TESTS
// =============================================================================

describe('Q2: Hierarchical Context', () => {
  describe('Tier 1: Deployment Context', () => {
    it('should create immutable deployment context', async () => {
      const context = await createDeploymentContext({
        deploymentId: 'deploy-001',
        regulatoryFramework: RegulatoryFramework.HIPAA,
        maxAllowedTier: TrustTier.T4,
        allowedContextTypes: [ContextType.ENTERPRISE],
        deployedBy: 'admin@example.com',
      });

      expect(context.deploymentId).toBe('deploy-001');
      expect(context.regulatoryFramework).toBe(RegulatoryFramework.HIPAA);
      expect(context.immutable).toBe(true);
      expect(context.deploymentHash).toBeDefined();
      expect(context.deploymentHash.length).toBeGreaterThan(0);
    });

    it('should verify deployment context integrity', async () => {
      const context = await createDeploymentContext({
        deploymentId: 'deploy-002',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T5,
        allowedContextTypes: [ContextType.LOCAL, ContextType.ENTERPRISE],
        deployedBy: 'admin@example.com',
      });

      const result = await verifyDeploymentContext(context);
      expect(result.valid).toBe(true);
    });
  });

  describe('Tier 2: Organizational Context', () => {
    let deployment: Awaited<ReturnType<typeof createDeploymentContext>>;

    beforeEach(async () => {
      deployment = await createDeploymentContext({
        deploymentId: 'deploy-test',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T5,
        allowedContextTypes: [ContextType.LOCAL, ContextType.ENTERPRISE, ContextType.SOVEREIGN],
        deployedBy: 'admin@example.com',
      });
    });

    it('should create and lock organizational context', async () => {
      const builder = new OrganizationalContextBuilder({
        orgId: 'org-001',
        tenantId: 'tenant-001',
        parentDeployment: deployment,
        constraints: {
          deniedDomains: ['F'],
          requiredAttestations: ['identity'],
          dataClassification: 'confidential',
          auditLevel: 'comprehensive',
        },
      });

      const context = await builder.lock();

      expect(context.orgId).toBe('org-001');
      expect(context.lockedAt).toBeDefined();
      expect(context.orgHash).toBeDefined();
      expect(context.constraints.maxTrustTier).toBe(TrustTier.T5);
    });

    it('should prevent modification after locking', async () => {
      const builder = new OrganizationalContextBuilder({
        orgId: 'org-002',
        tenantId: 'tenant-002',
        parentDeployment: deployment,
        constraints: {
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'internal',
          auditLevel: 'standard',
        },
      });

      await builder.lock();

      expect(() => builder.addDeniedDomain('A')).toThrow();
    });

    it('should enforce parent ceiling constraint', async () => {
      const limitedDeployment = await createDeploymentContext({
        deploymentId: 'deploy-limited',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T3, // Limited to T3
        allowedContextTypes: [ContextType.LOCAL],
        deployedBy: 'admin@example.com',
      });

      const builder = new OrganizationalContextBuilder({
        orgId: 'org-003',
        tenantId: 'tenant-003',
        parentDeployment: limitedDeployment,
        constraints: {
          maxTrustTier: TrustTier.T5, // Tries to exceed parent
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'public',
          auditLevel: 'minimal',
        },
      });

      const context = await builder.lock();
      expect(context.constraints.maxTrustTier).toBe(TrustTier.T3); // Clamped to parent
    });
  });

  describe('Tier 3: Agent Context', () => {
    it('should create frozen agent context', async () => {
      const deployment = await createDeploymentContext({
        deploymentId: 'deploy-agent',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T5,
        allowedContextTypes: [ContextType.ENTERPRISE],
        deployedBy: 'admin@example.com',
      });

      const org = await createOrganizationalContext({
        orgId: 'org-agent',
        tenantId: 'tenant-agent',
        parentDeployment: deployment,
        constraints: {
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'internal',
          auditLevel: 'standard',
        },
      });

      const agent = await createAgentContext({
        agentId: 'agent-001',
        parentOrg: org,
        contextType: ContextType.ENTERPRISE,
        createdBy: 'system',
      });

      expect(agent.agentId).toBe('agent-001');
      expect(agent.contextType).toBe(ContextType.ENTERPRISE);
      expect(agent.contextHash).toBeDefined();
    });

    it('should reject invalid context type', async () => {
      const deployment = await createDeploymentContext({
        deploymentId: 'deploy-restricted',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T5,
        allowedContextTypes: [ContextType.LOCAL], // Only LOCAL allowed
        deployedBy: 'admin@example.com',
      });

      const org = await createOrganizationalContext({
        orgId: 'org-restricted',
        tenantId: 'tenant-restricted',
        parentDeployment: deployment,
        constraints: {
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'internal',
          auditLevel: 'standard',
        },
      });

      await expect(
        createAgentContext({
          agentId: 'agent-002',
          parentOrg: org,
          contextType: ContextType.ENTERPRISE, // Not allowed
          createdBy: 'system',
        })
      ).rejects.toThrow();
    });
  });

  describe('Tier 4: Operation Context', () => {
    let agentContext: Awaited<ReturnType<typeof createAgentContext>>;

    beforeEach(async () => {
      const deployment = await createDeploymentContext({
        deploymentId: 'deploy-op',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T5,
        allowedContextTypes: [ContextType.ENTERPRISE],
        deployedBy: 'admin@example.com',
      });

      const org = await createOrganizationalContext({
        orgId: 'org-op',
        tenantId: 'tenant-op',
        parentDeployment: deployment,
        constraints: {
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'internal',
          auditLevel: 'standard',
        },
      });

      agentContext = await createAgentContext({
        agentId: 'agent-op',
        parentOrg: org,
        contextType: ContextType.ENTERPRISE,
        createdBy: 'system',
      });
    });

    it('should create ephemeral operation context', async () => {
      const operation = await createOperationContext({
        parentAgent: agentContext,
        requestMetadata: { action: 'test' },
        ttlMs: 60000,
      });

      expect(operation.operationId).toBeDefined();
      expect(operation.ephemeral).toBe(true);
      expect(operation.correlationId).toBeDefined();
    });

    it('should correctly detect expiration', async () => {
      const shortTtl = await createOperationContext({
        parentAgent: agentContext,
        ttlMs: 1, // 1ms TTL
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(isOperationExpired(shortTtl)).toBe(true);
    });
  });

  describe('Context Service', () => {
    it('should manage context hierarchy', async () => {
      const service = createContextService();

      const deployment = await createDeploymentContext({
        deploymentId: 'svc-deploy',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T5,
        allowedContextTypes: [ContextType.ENTERPRISE],
        deployedBy: 'admin@example.com',
      });

      service.registerDeployment(deployment);

      const org = await createOrganizationalContext({
        orgId: 'svc-org',
        tenantId: 'svc-tenant',
        parentDeployment: deployment,
        constraints: {
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'internal',
          auditLevel: 'standard',
        },
      });

      service.registerOrganization(org);

      const stats = service.getStats();
      expect(stats.deployments).toBe(1);
      expect(stats.organizations).toBe(1);
    });
  });
});

// =============================================================================
// Q4: FEDERATED WEIGHT PRESETS TESTS
// =============================================================================

describe('Q4: Federated Weight Presets', () => {
  describe('ACI Canonical Presets', () => {
    it('should have balanced preset', () => {
      const balanced = getACIPreset('aci:preset:balanced');
      expect(balanced).toBeDefined();
      expect(balanced!.weights.observability).toBe(0.20);
      expect(balanced!.weights.capability).toBe(0.20);
    });

    it('should have 3 canonical presets', () => {
      const presets = getAllACIPresets();
      expect(presets.length).toBe(3);
    });
  });

  describe('Weight Normalization', () => {
    it('should normalize weights to sum to 1.0', () => {
      const weights = normalizeWeights({
        observability: 1,
        capability: 1,
        behavior: 1,
        governance: 1,
        context: 1,
      });

      const sum =
        weights.observability +
        weights.capability +
        weights.behavior +
        weights.governance +
        weights.context;

      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    });

    it('should validate weights that sum to 1.0', () => {
      const result = validateWeights({
        observability: 0.2,
        capability: 0.2,
        behavior: 0.2,
        governance: 0.2,
        context: 0.2,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Preset Derivation', () => {
    it('should derive preset from parent', async () => {
      const balanced = getACIPreset('aci:preset:balanced')!;

      const derived = await derivePreset({
        presetId: 'test:derived',
        name: 'Test Derived',
        description: 'Test derivation',
        source: 'vorion',
        parentPreset: balanced,
        weightOverrides: {
          observability: 0.30,
        },
        createdBy: 'test',
      });

      expect(derived.parentPresetId).toBe('aci:preset:balanced');
      expect(derived.parentHash).toBe(balanced.presetHash);
      expect(derived.derivationDelta).toBeDefined();
    });

    it('should enforce source hierarchy', async () => {
      const vorionPreset = await createVorionPreset(
        'test:vorion',
        'Test Vorion',
        'Test',
        'aci:preset:balanced',
        undefined,
        'Test',
        'test'
      );

      // Cannot derive ACI from Vorion
      await expect(
        derivePreset({
          presetId: 'test:invalid',
          name: 'Invalid',
          description: 'Invalid derivation',
          source: 'aci', // ACI cannot be derived
          parentPreset: vorionPreset,
          createdBy: 'test',
        })
      ).rejects.toThrow();
    });
  });

  describe('Preset Lineage', () => {
    it('should build and verify lineage chain', async () => {
      const service = createPresetService();
      await initializeVorionPresets(service);

      const axiomPreset = await service.createAxiomPreset(
        'axiom:test',
        'Axiom Test',
        'Test axiom preset',
        'vorion:preset:balanced-autonomy',
        { governance: 0.30 },
        'Test',
        'test'
      );

      const lineage = service.getLineage(axiomPreset.presetId);
      expect(lineage).toBeDefined();
      expect(lineage!.chain.length).toBe(3); // ACI -> Vorion -> Axiom

      const result = await service.verifyLineage(axiomPreset.presetId);
      expect(result.valid).toBe(true);
    });
  });

  describe('Preset Service', () => {
    it('should initialize with Vorion defaults', async () => {
      const service = createPresetService();
      await initializeVorionPresets(service);

      const stats = service.getStats();
      expect(stats.aciPresets).toBe(3);
      expect(stats.vorionPresets).toBe(3);
    });
  });
});

// =============================================================================
// Q5: PROVENANCE + POLICY MODIFIERS TESTS
// =============================================================================

describe('Q5: Provenance + Policy Modifiers', () => {
  describe('Agent Provenance', () => {
    it('should create immutable provenance for fresh agent', async () => {
      const provenance = await createProvenance({
        agentId: 'agent-fresh-001',
        creationType: CreationType.FRESH,
        createdBy: 'system',
      });

      expect(provenance.creationType).toBe(CreationType.FRESH);
      expect(provenance.provenanceHash).toBeDefined();
    });

    it('should require parent for cloned agents', async () => {
      await expect(
        createProvenance({
          agentId: 'agent-clone-001',
          creationType: CreationType.CLONED,
          createdBy: 'system',
          // Missing parent!
        })
      ).rejects.toThrow();
    });

    it('should verify provenance integrity', async () => {
      const provenance = await createProvenance({
        agentId: 'agent-verify',
        creationType: CreationType.FRESH,
        createdBy: 'system',
      });

      const result = await verifyProvenance(provenance);
      expect(result.valid).toBe(true);
    });
  });

  describe('Creation Modifier Policies', () => {
    it('should have default modifiers for each creation type', () => {
      expect(DEFAULT_CREATION_MODIFIERS[CreationType.FRESH]).toBe(0);
      expect(DEFAULT_CREATION_MODIFIERS[CreationType.CLONED]).toBe(-50);
      expect(DEFAULT_CREATION_MODIFIERS[CreationType.EVOLVED]).toBe(100);
      expect(DEFAULT_CREATION_MODIFIERS[CreationType.PROMOTED]).toBe(150);
      expect(DEFAULT_CREATION_MODIFIERS[CreationType.IMPORTED]).toBe(-100);
    });

    it('should create modifier policy', async () => {
      const policy = await createModifierPolicy({
        policyId: 'test:fresh',
        creationType: CreationType.FRESH,
        baselineModifier: 10,
        createdBy: 'test',
      });

      expect(policy.baselineModifier).toBe(10);
      expect(policy.version).toBe(1);
    });
  });

  describe('Modifier Evaluation', () => {
    it('should evaluate modifier using active policy', async () => {
      const service = createProvenanceService();
      await initializeDefaultPolicies(service);

      // Create a parent first
      await service.createProvenance({
        agentId: 'parent-for-evolved',
        creationType: CreationType.FRESH,
        createdBy: 'system',
      });

      // Now create evolved agent with parent
      await service.createProvenance({
        agentId: 'agent-eval',
        creationType: CreationType.EVOLVED,
        parentAgentId: 'parent-for-evolved',
        createdBy: 'system',
      });

      const record = await service.evaluateModifier('agent-eval');
      expect(record.computedModifier).toBe(100); // Evolved agents get +100
    });
  });

  describe('Provenance Service', () => {
    it('should verify provenance chain', async () => {
      const service = createProvenanceService();

      // Create parent
      await service.createProvenance({
        agentId: 'parent-agent',
        creationType: CreationType.FRESH,
        createdBy: 'system',
      });

      // Create child
      await service.createProvenance({
        agentId: 'child-agent',
        creationType: CreationType.CLONED,
        parentAgentId: 'parent-agent',
        createdBy: 'system',
      });

      const result = await service.verifyProvenanceChain('child-agent');
      expect(result.valid).toBe(true);
      expect(result.chain).toEqual(['child-agent', 'parent-agent']);
    });
  });
});

// =============================================================================
// Q1: CEILING ENFORCEMENT TESTS
// =============================================================================

describe('Q1: Ceiling Enforcement', () => {
  let agentContext: Awaited<ReturnType<typeof createAgentContext>>;

  beforeEach(async () => {
    const deployment = await createDeploymentContext({
      deploymentId: 'deploy-ceiling',
      regulatoryFramework: RegulatoryFramework.HIPAA,
      maxAllowedTier: TrustTier.T4, // Ceiling at T4 (899)
      allowedContextTypes: [ContextType.ENTERPRISE],
      deployedBy: 'admin@example.com',
    });

    const org = await createOrganizationalContext({
      orgId: 'org-ceiling',
      tenantId: 'tenant-ceiling',
      parentDeployment: deployment,
      constraints: {
        maxTrustTier: TrustTier.T4,
        deniedDomains: [],
        requiredAttestations: [],
        dataClassification: 'confidential',
        auditLevel: 'forensic',
      },
    });

    agentContext = await createAgentContext({
      agentId: 'agent-ceiling',
      parentOrg: org,
      contextType: ContextType.ENTERPRISE,
      createdBy: 'system',
    });
  });

  describe('Kernel Layer Enforcement', () => {
    it('should clamp score to ceiling', () => {
      const result = enforceKernelCeiling(950, { agentContext });

      expect(result.valid).toBe(true);
      expect(result.rawScore).toBe(950);
      expect(result.clampedScore).toBeLessThanOrEqual(899); // T4 ceiling
      expect(result.ceilingApplied).toBe(true);
    });

    it('should not clamp score below ceiling', () => {
      const result = enforceKernelCeiling(500, { agentContext });

      expect(result.clampedScore).toBe(500);
      expect(result.ceilingApplied).toBe(false);
    });
  });

  describe('Gaming Detection', () => {
    it('should detect variance anomaly', () => {
      const state = { recentEvents: [], lastCleanup: new Date() };

      // Large gap between raw and clamped
      const result = detectGamingIndicators(1000, 700, TrustTier.T4, state);

      expect(result.varianceAnomaly).toBe(true);
    });

    it('should detect frequency anomaly', () => {
      const state = {
        recentEvents: Array.from({ length: 15 }, (_, i) => ({
          timestamp: new Date(),
          rawScore: 500 + i,
          clampedScore: 500 + i,
          tier: TrustTier.T3,
        })),
        lastCleanup: new Date(),
      };

      const result = detectGamingIndicators(600, 600, TrustTier.T3, state);

      expect(result.frequencyAnomaly).toBe(true);
    });
  });

  describe('Retention Requirements', () => {
    it('should require retention for HIPAA', () => {
      const result = getRetentionRequirements(RegulatoryFramework.HIPAA, false);

      expect(result.required).toBe(true);
      expect(result.retentionDays).toBe(2190); // 6 years
    });

    it('should require retention for anomalies', () => {
      const result = getRetentionRequirements(RegulatoryFramework.NONE, true);

      expect(result.required).toBe(true);
      expect(result.retentionDays).toBe(90);
    });
  });

  describe('Ceiling Enforcement Service', () => {
    it('should compute trust with ceiling and audit', async () => {
      const service = createCeilingEnforcementService(RegulatoryFramework.HIPAA);

      const { event, auditEntry } = await service.computeTrust(
        'agent-test',
        950,
        { agentContext }
      );

      expect(event.rawScore).toBe(950);
      expect(event.clampedScore).toBeLessThanOrEqual(899);
      expect(auditEntry.regulatoryFramework).toBe(RegulatoryFramework.HIPAA);
      expect(auditEntry.retentionRequired).toBe(true);
    });

    it('should track compliance statistics', async () => {
      const service = createCeilingEnforcementService();

      // Multiple computations
      await service.computeTrust('agent-1', 500, { agentContext });
      await service.computeTrust('agent-2', 600, { agentContext });

      const stats = service.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.totalAuditEntries).toBe(2);
    });
  });
});

// =============================================================================
// Q3: STRATIFIED ROLE GATES TESTS
// =============================================================================

describe('Q3: Stratified Role Gates', () => {
  describe('Role Gate Matrix', () => {
    it('should have entries for all roles', () => {
      const matrix = getRoleGateMatrix();
      expect(matrix.length).toBe(9); // 9 roles
    });

    it('should allow R-L0 at T0', () => {
      expect(validateRoleGateKernel(AgentRole.R_L0, TrustTier.T0)).toBe(true);
    });

    it('should deny R-L6+ at anything below T5', () => {
      expect(validateRoleGateKernel(AgentRole.R_L6, TrustTier.T4)).toBe(false);
      expect(validateRoleGateKernel(AgentRole.R_L6, TrustTier.T5)).toBe(true);
    });

    it('should return correct minimum tier for roles', () => {
      expect(getMinimumTierForRole(AgentRole.R_L0)).toBe(TrustTier.T0);
      expect(getMinimumTierForRole(AgentRole.R_L3)).toBe(TrustTier.T2);
      expect(getMinimumTierForRole(AgentRole.R_L6)).toBe(TrustTier.T5);
    });
  });

  describe('Kernel Layer', () => {
    it('should validate role+tier combinations', () => {
      const valid = evaluateKernelLayer(AgentRole.R_L3, TrustTier.T3);
      expect(valid.valid).toBe(true);

      const invalid = evaluateKernelLayer(AgentRole.R_L5, TrustTier.T2);
      expect(invalid.valid).toBe(false);
      expect(invalid.reason).toContain('requires minimum tier');
    });
  });

  describe('Policy Layer', () => {
    it('should evaluate policy rules', async () => {
      const service = createRoleGateService();
      await service.initialize();

      const policy = service.getDefaultPolicy()!;

      const result = evaluatePolicyLayer(
        { role: AgentRole.R_L0, tier: TrustTier.T1 },
        policy
      );

      expect(result.action).toBe('ALLOW');
    });
  });

  describe('BASIS Layer', () => {
    it('should validate context constraints', () => {
      const result = evaluateBasisLayer(AgentRole.R_L2, {
        agentId: 'test',
        contextConstraints: {
          allowedRoles: [AgentRole.R_L0, AgentRole.R_L1, AgentRole.R_L2],
        },
      });

      expect(result.valid).toBe(true);
    });

    it('should deny when role is explicitly denied', () => {
      const result = evaluateBasisLayer(AgentRole.R_L5, {
        agentId: 'test',
        contextConstraints: {
          deniedRoles: [AgentRole.R_L5],
        },
      });

      expect(result.valid).toBe(false);
    });

    it('should require dual-control override', () => {
      const result = evaluateBasisLayer(AgentRole.R_L4, {
        agentId: 'test',
        contextConstraints: {
          requiresOverride: true,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.requiresOverride).toBe(true);
    });
  });

  describe('Role Gate Service', () => {
    it('should perform full 3-layer evaluation', async () => {
      const service = createRoleGateService();
      await service.initialize();

      const evaluation = await service.evaluate(
        'agent-gate',
        AgentRole.R_L2,
        TrustTier.T3,
        {
          agentId: 'agent-gate',
          contextConstraints: {},
        }
      );

      expect(evaluation.decision).toBe('ALLOW');
      expect(evaluation.kernelResult.valid).toBe(true);
      expect(evaluation.evaluationHash).toBeDefined();
    });

    it('should track evaluation statistics', async () => {
      const service = createRoleGateService();
      await service.initialize();

      await service.evaluate('agent-1', AgentRole.R_L1, TrustTier.T1, {
        agentId: 'agent-1',
        contextConstraints: {},
      });

      await service.evaluate('agent-2', AgentRole.R_L2, TrustTier.T2, {
        agentId: 'agent-2',
        contextConstraints: {},
      });

      const stats = service.getStats();
      expect(stats.totalEvaluations).toBe(2);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Phase 6 Integration', () => {
  describe('Trust Engine Factory', () => {
    it('should create fully initialized trust engine', async () => {
      const engine = await createPhase6TrustEngine({
        regulatoryFramework: RegulatoryFramework.GDPR,
        initializeDefaults: true,
      });

      expect(engine.context).toBeDefined();
      expect(engine.presets).toBeDefined();
      expect(engine.provenance).toBeDefined();
      expect(engine.ceiling).toBeDefined();
      expect(engine.roleGates).toBeDefined();

      // Verify presets are initialized
      const presetStats = engine.presets.getStats();
      expect(presetStats.vorionPresets).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Trust Flow', () => {
    it('should compute trust through all layers', async () => {
      const engine = await createPhase6TrustEngine();

      // 1. Create context hierarchy
      const deployment = await createDeploymentContext({
        deploymentId: 'e2e-deploy',
        regulatoryFramework: RegulatoryFramework.NONE,
        maxAllowedTier: TrustTier.T4,
        allowedContextTypes: [ContextType.ENTERPRISE],
        deployedBy: 'admin@example.com',
      });

      engine.context.registerDeployment(deployment);

      const org = await createOrganizationalContext({
        orgId: 'e2e-org',
        tenantId: 'e2e-tenant',
        parentDeployment: deployment,
        constraints: {
          maxTrustTier: TrustTier.T4,
          deniedDomains: [],
          requiredAttestations: [],
          dataClassification: 'internal',
          auditLevel: 'standard',
        },
      });

      engine.context.registerOrganization(org);

      const agentContext = await createAgentContext({
        agentId: 'e2e-agent',
        parentOrg: org,
        contextType: ContextType.ENTERPRISE,
        createdBy: 'system',
      });

      engine.context.registerAgent(agentContext);

      // 2. Create provenance
      await engine.provenance.createProvenance({
        agentId: 'e2e-agent',
        creationType: CreationType.FRESH,
        createdBy: 'system',
      });

      // 3. Evaluate modifier
      const modifier = await engine.provenance.evaluateModifier('e2e-agent');
      expect(modifier.computedModifier).toBe(0); // Fresh agent

      // 4. Compute trust with ceiling
      const { event, auditEntry } = await engine.ceiling.computeTrust(
        'e2e-agent',
        750,
        { agentContext }
      );

      expect(event.clampedScore).toBeLessThanOrEqual(CONTEXT_CEILINGS[ContextType.ENTERPRISE]);

      // 5. Evaluate role gate (use R_L2 which doesn't require special attestation)
      const roleEval = await engine.roleGates.evaluate(
        'e2e-agent',
        AgentRole.R_L2, // Planner role - simpler requirements than orchestrator
        getTierFromScore(event.clampedScore),
        {
          agentId: 'e2e-agent',
          contextConstraints: {},
        }
      );

      expect(roleEval.decision).toBe('ALLOW');
    });
  });

  describe('Version Information', () => {
    it('should export version info', () => {
      expect(PHASE6_VERSION.major).toBe(1);
      expect(PHASE6_VERSION.decisions).toContain('Q1');
      expect(PHASE6_VERSION.decisions).toContain('Q5');
    });
  });
});
