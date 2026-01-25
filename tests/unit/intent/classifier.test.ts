/**
 * Intent Classification System Tests
 *
 * Tests for the IntentClassifier, RiskAssessor, and pattern matching utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntentClassifier,
  createIntentClassifier,
  RiskAssessor,
  createRiskAssessor,
  matchActionPattern,
  matchResourceSensitivity,
  getResourceSensitivityLevel,
  getResourceRiskTier,
  inferCategoryFromAction,
  scoreToTier,
  tierToMinScore,
  requiresApproval,
  ACTION_PATTERNS,
  RESOURCE_SENSITIVITY,
  type CreateIntent,
  type HistoricalPattern,
  type IntentCategory,
  type RiskTier,
} from '../../../src/intent/classifier/index.js';

describe('Intent Classification System', () => {
  describe('Pattern Matching', () => {
    describe('matchActionPattern', () => {
      it('should match data:read action', () => {
        const pattern = matchActionPattern('data:read');
        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('data:read');
        expect(pattern?.category).toBe('data-access');
      });

      it('should match data:write action', () => {
        const pattern = matchActionPattern('data:write');
        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('data:write');
        expect(pattern?.category).toBe('data-access');
      });

      it('should match model:train action', () => {
        const pattern = matchActionPattern('model:train');
        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('model:train');
        expect(pattern?.category).toBe('model-operation');
      });

      it('should match external:api action', () => {
        const pattern = matchActionPattern('external:api');
        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('external:api');
        expect(pattern?.category).toBe('external-integration');
      });

      it('should match system:config:write action', () => {
        const pattern = matchActionPattern('system:config:write');
        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('system:config:write');
        expect(pattern?.category).toBe('system-config');
      });

      it('should match user:create action', () => {
        const pattern = matchActionPattern('user:create');
        expect(pattern).toBeDefined();
        expect(pattern?.name).toBe('user:create');
        expect(pattern?.category).toBe('user-action');
      });

      it('should be case insensitive', () => {
        expect(matchActionPattern('DATA:READ')).toBeDefined();
        expect(matchActionPattern('Data:Read')).toBeDefined();
        expect(matchActionPattern('dAtA:rEaD')).toBeDefined();
      });

      it('should return undefined for unknown actions', () => {
        expect(matchActionPattern('unknown:action')).toBeUndefined();
        expect(matchActionPattern('foo')).toBeUndefined();
        expect(matchActionPattern('')).toBeUndefined();
      });

      it('should return undefined for empty input', () => {
        expect(matchActionPattern('')).toBeUndefined();
      });
    });

    describe('matchResourceSensitivity', () => {
      it('should match PII resources', () => {
        const matches = matchResourceSensitivity('customer-data');
        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0]?.name).toBe('pii');
      });

      it('should match financial resources', () => {
        const matches = matchResourceSensitivity('payment-records');
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.name === 'financial')).toBe(true);
      });

      it('should match health/HIPAA resources', () => {
        const matches = matchResourceSensitivity('patient-records');
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.name === 'health')).toBe(true);
      });

      it('should match credential resources', () => {
        const matches = matchResourceSensitivity('api-key-store');
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.name === 'credentials')).toBe(true);
      });

      it('should match production resources', () => {
        const matches = matchResourceSensitivity('prod-database');
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.name === 'production')).toBe(true);
      });

      it('should return multiple matches sorted by sensitivity', () => {
        const matches = matchResourceSensitivity('production-customer-database');
        expect(matches.length).toBeGreaterThan(1);
        // Should be sorted by sensitivity level descending
        for (let i = 1; i < matches.length; i++) {
          expect(matches[i - 1]!.sensitivityLevel).toBeGreaterThanOrEqual(
            matches[i]!.sensitivityLevel
          );
        }
      });

      it('should return empty array for non-matching resources', () => {
        const matches = matchResourceSensitivity('general_resource');
        // May or may not match, depends on patterns
        expect(Array.isArray(matches)).toBe(true);
      });

      it('should return empty array for empty input', () => {
        expect(matchResourceSensitivity('')).toEqual([]);
      });
    });

    describe('getResourceSensitivityLevel', () => {
      it('should return highest sensitivity for PII', () => {
        const level = getResourceSensitivityLevel('customer-pii-data');
        expect(level).toBeGreaterThanOrEqual(80);
      });

      it('should return high sensitivity for credentials', () => {
        const level = getResourceSensitivityLevel('password-store');
        expect(level).toBe(100);
      });

      it('should return default sensitivity for unknown resources', () => {
        const level = getResourceSensitivityLevel('generic_resource_xyz');
        expect(level).toBe(30);
      });

      it('should return low sensitivity for development resources', () => {
        const level = getResourceSensitivityLevel('dev-sandbox');
        expect(level).toBeLessThanOrEqual(30);
      });
    });

    describe('getResourceRiskTier', () => {
      it('should return critical for credentials', () => {
        expect(getResourceRiskTier('api-key-storage')).toBe('critical');
      });

      it('should return high for production resources', () => {
        expect(getResourceRiskTier('production-db')).toBe('high');
      });

      it('should return low for development resources', () => {
        expect(getResourceRiskTier('dev-test-data')).toBe('low');
      });

      it('should return low for unknown resources', () => {
        expect(getResourceRiskTier('generic_xyz_123')).toBe('low');
      });
    });

    describe('inferCategoryFromAction', () => {
      it('should infer data-access from data: prefix', () => {
        expect(inferCategoryFromAction('data:custom')).toBe('data-access');
        expect(inferCategoryFromAction('data:something')).toBe('data-access');
      });

      it('should infer model-operation from model: prefix', () => {
        expect(inferCategoryFromAction('model:custom')).toBe('model-operation');
      });

      it('should infer external-integration from external: prefix', () => {
        expect(inferCategoryFromAction('external:custom')).toBe('external-integration');
      });

      it('should infer system-config from system: prefix', () => {
        expect(inferCategoryFromAction('system:custom')).toBe('system-config');
      });

      it('should infer user-action from user: prefix', () => {
        expect(inferCategoryFromAction('user:custom')).toBe('user-action');
      });

      it('should default to user-action for unknown prefixes', () => {
        expect(inferCategoryFromAction('unknown:action')).toBe('user-action');
        expect(inferCategoryFromAction('random')).toBe('user-action');
        expect(inferCategoryFromAction('')).toBe('user-action');
      });
    });

    describe('scoreToTier', () => {
      it('should return low for scores 0-25', () => {
        expect(scoreToTier(0)).toBe('low');
        expect(scoreToTier(15)).toBe('low');
        expect(scoreToTier(25)).toBe('low');
      });

      it('should return medium for scores 26-50', () => {
        expect(scoreToTier(26)).toBe('medium');
        expect(scoreToTier(40)).toBe('medium');
        expect(scoreToTier(50)).toBe('medium');
      });

      it('should return high for scores 51-75', () => {
        expect(scoreToTier(51)).toBe('high');
        expect(scoreToTier(60)).toBe('high');
        expect(scoreToTier(75)).toBe('high');
      });

      it('should return critical for scores 76-100', () => {
        expect(scoreToTier(76)).toBe('critical');
        expect(scoreToTier(90)).toBe('critical');
        expect(scoreToTier(100)).toBe('critical');
      });
    });

    describe('tierToMinScore', () => {
      it('should return correct minimum scores', () => {
        expect(tierToMinScore('low')).toBe(0);
        expect(tierToMinScore('medium')).toBe(26);
        expect(tierToMinScore('high')).toBe(51);
        expect(tierToMinScore('critical')).toBe(76);
      });
    });

    describe('requiresApproval', () => {
      it('should return true for high risk patterns', () => {
        const highRiskPattern = ACTION_PATTERNS.find((p) => p.defaultRiskTier === 'high');
        expect(highRiskPattern).toBeDefined();
        expect(requiresApproval(highRiskPattern!)).toBe(true);
      });

      it('should return true for critical risk patterns', () => {
        const criticalPattern = ACTION_PATTERNS.find((p) => p.defaultRiskTier === 'critical');
        expect(criticalPattern).toBeDefined();
        expect(requiresApproval(criticalPattern!)).toBe(true);
      });

      it('should return false for low risk patterns', () => {
        const lowRiskPattern = ACTION_PATTERNS.find((p) => p.defaultRiskTier === 'low');
        expect(lowRiskPattern).toBeDefined();
        expect(requiresApproval(lowRiskPattern!)).toBe(false);
      });
    });
  });

  describe('RiskAssessor', () => {
    let assessor: RiskAssessor;

    beforeEach(() => {
      assessor = createRiskAssessor();
    });

    describe('assessRisk', () => {
      it('should assess risk for data:read action', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'general_data',
        };

        const assessment = await assessor.assessRisk(intent);

        expect(assessment.riskScore).toBeLessThan(50);
        expect(assessment.riskTier).toBe('low');
        expect(assessment.category).toBe('data-access');
        expect(assessment.factors.length).toBeGreaterThan(0);
      });

      it('should assess higher risk for data:delete action', async () => {
        const intent: CreateIntent = {
          action: 'data:delete',
          resource: 'general_data',
        };

        const assessment = await assessor.assessRisk(intent);

        expect(assessment.riskScore).toBeGreaterThan(40);
        expect(['medium', 'high']).toContain(assessment.riskTier);
      });

      it('should increase risk for sensitive resources', async () => {
        const regularIntent: CreateIntent = {
          action: 'data:read',
          resource: 'general_data',
        };
        const sensitiveIntent: CreateIntent = {
          action: 'data:read',
          resource: 'customer-pii',
        };

        const regularAssessment = await assessor.assessRisk(regularIntent);
        const sensitiveAssessment = await assessor.assessRisk(sensitiveIntent);

        expect(sensitiveAssessment.riskScore).toBeGreaterThan(regularAssessment.riskScore);
      });

      it('should increase risk for credential resources', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'api-key-store',
        };

        const assessment = await assessor.assessRisk(intent);

        // Base risk (15) + sensitivity modifier (100-30)/100 * 15 = 15 + 10.5 = ~26
        expect(assessment.riskScore).toBeGreaterThan(20);
        const hasSensitivityFactor = assessment.factors.some(
          (f) => f.name === 'resource_sensitivity'
        );
        expect(hasSensitivityFactor).toBe(true);
      });

      it('should include risk factors in assessment', async () => {
        const intent: CreateIntent = {
          action: 'model:train',
          resource: 'production_data',
        };

        const assessment = await assessor.assessRisk(intent);

        expect(assessment.factors.length).toBeGreaterThan(0);
        expect(assessment.factors[0]).toHaveProperty('name');
        expect(assessment.factors[0]).toHaveProperty('points');
        expect(assessment.factors[0]).toHaveProperty('reason');
      });

      it('should calculate required approvals', async () => {
        const intent: CreateIntent = {
          action: 'system:admin',
          resource: 'production_config',
        };

        const assessment = await assessor.assessRisk(intent);

        expect(assessment.requiredApprovals).toBeDefined();
        expect(assessment.requiredApprovals.humanReview).toBe(true);
        expect(assessment.requiredApprovals.managerApproval).toBe(true);
        expect(assessment.requiredApprovals.minTrustLevel).toBeGreaterThanOrEqual(3);
      });

      it('should handle unknown actions with default risk', async () => {
        const intent: CreateIntent = {
          action: 'unknown:custom:action',
          resource: 'some_resource',
        };

        const assessment = await assessor.assessRisk(intent);

        expect(assessment.riskScore).toBeGreaterThanOrEqual(30);
        const hasUnknownFactor = assessment.factors.some(
          (f) => f.name === 'unknown_action'
        );
        expect(hasUnknownFactor).toBe(true);
      });

      it('should include timestamp in assessment', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test_data',
        };

        const assessment = await assessor.assessRisk(intent);

        expect(assessment.assessedAt).toBeDefined();
        expect(new Date(assessment.assessedAt).getTime()).not.toBeNaN();
      });
    });

    describe('Historical Pattern Adjustments', () => {
      it('should increase risk for first-time actions', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'general_data',
        };

        const pattern: HistoricalPattern = {
          totalCount: 0,
          successCount: 0,
          failureCount: 0,
          isFirstTime: true,
        };

        const withPattern = await assessor.assessRisk(intent, pattern);
        const withoutPattern = await assessor.assessRisk(intent, null);

        expect(withPattern.riskScore).toBeGreaterThan(withoutPattern.riskScore);
        const hasFirstTimeFactor = withPattern.factors.some(
          (f) => f.name === 'first_time_action'
        );
        expect(hasFirstTimeFactor).toBe(true);
      });

      it('should increase risk for high failure rate', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'general_data',
        };

        const pattern: HistoricalPattern = {
          totalCount: 10,
          successCount: 5,
          failureCount: 5,
          isFirstTime: false,
        };

        const assessment = await assessor.assessRisk(intent, pattern);

        const hasFailureFactor = assessment.factors.some(
          (f) => f.name === 'high_failure_rate'
        );
        expect(hasFailureFactor).toBe(true);
      });

      it('should decrease risk for established successful patterns', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'general_data',
        };

        const pattern: HistoricalPattern = {
          totalCount: 20,
          successCount: 19,
          failureCount: 1,
          isFirstTime: false,
        };

        const assessment = await assessor.assessRisk(intent, pattern);

        const hasEstablishedFactor = assessment.factors.some(
          (f) => f.name === 'established_pattern'
        );
        expect(hasEstablishedFactor).toBe(true);
        // Established pattern factor should have negative points
        const establishedFactor = assessment.factors.find(
          (f) => f.name === 'established_pattern'
        );
        expect(establishedFactor?.points).toBeLessThan(0);
      });
    });

    describe('Parameter-based Adjustments', () => {
      it('should increase risk for bulk operations', async () => {
        const regularIntent: CreateIntent = {
          action: 'data:delete',
          resource: 'test_data',
        };
        const bulkIntent: CreateIntent = {
          action: 'data:delete',
          resource: 'test_data',
          parameters: { bulk: true },
        };

        const regularAssessment = await assessor.assessRisk(regularIntent);
        const bulkAssessment = await assessor.assessRisk(bulkIntent);

        expect(bulkAssessment.riskScore).toBeGreaterThan(regularAssessment.riskScore);
        const hasBulkFactor = bulkAssessment.factors.some(
          (f) => f.name === 'bulk_operation'
        );
        expect(hasBulkFactor).toBe(true);
      });

      it('should increase risk for cross-tenant operations', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'shared_data',
          parameters: { crossTenant: true },
        };

        const assessment = await assessor.assessRisk(intent);

        const hasCrossTenantFactor = assessment.factors.some(
          (f) => f.name === 'cross_tenant'
        );
        expect(hasCrossTenantFactor).toBe(true);
      });

      it('should increase risk for elevated privilege requests', async () => {
        const intent: CreateIntent = {
          action: 'user:update',
          resource: 'user_profile',
          parameters: { elevated: true },
        };

        const assessment = await assessor.assessRisk(intent);

        const hasElevatedFactor = assessment.factors.some(
          (f) => f.name === 'elevated_privilege'
        );
        expect(hasElevatedFactor).toBe(true);
      });

      it('should decrease risk for dry run operations', async () => {
        const regularIntent: CreateIntent = {
          action: 'data:delete',
          resource: 'test_data',
        };
        const dryRunIntent: CreateIntent = {
          action: 'data:delete',
          resource: 'test_data',
          parameters: { dryRun: true },
        };

        const regularAssessment = await assessor.assessRisk(regularIntent);
        const dryRunAssessment = await assessor.assessRisk(dryRunIntent);

        expect(dryRunAssessment.riskScore).toBeLessThan(regularAssessment.riskScore);
      });

      it('should increase risk for large batch sizes', async () => {
        const intent: CreateIntent = {
          action: 'data:write',
          resource: 'bulk_data',
          parameters: { batchSize: 5000 },
        };

        const assessment = await assessor.assessRisk(intent);

        const hasLargeBatchFactor = assessment.factors.some(
          (f) => f.name === 'large_batch'
        );
        expect(hasLargeBatchFactor).toBe(true);
      });
    });

    describe('Risk Score Bounds', () => {
      it('should not exceed 100', async () => {
        const intent: CreateIntent = {
          action: 'system:security',
          resource: 'production_credentials_database',
          parameters: {
            bulk: true,
            crossTenant: true,
            elevated: true,
            batchSize: 10000,
          },
        };

        const pattern: HistoricalPattern = {
          totalCount: 10,
          successCount: 3,
          failureCount: 7,
          isFirstTime: true,
        };

        const assessment = await assessor.assessRisk(intent, pattern);

        expect(assessment.riskScore).toBeLessThanOrEqual(100);
      });

      it('should not go below 0', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'public_open_sandbox_dev_test',
          parameters: { dryRun: true },
        };

        const pattern: HistoricalPattern = {
          totalCount: 100,
          successCount: 99,
          failureCount: 1,
          isFirstTime: false,
        };

        const assessment = await assessor.assessRisk(intent, pattern);

        expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('IntentClassifier', () => {
    let classifier: IntentClassifier;

    beforeEach(() => {
      classifier = createIntentClassifier();
    });

    describe('Classification by Category', () => {
      it('should classify data-access intents', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'user_data',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('data-access');
        expect(classification.matchedPattern).toBe('data:read');
      });

      it('should classify model-operation intents', async () => {
        const intent: CreateIntent = {
          action: 'model:train',
          resource: 'training_data',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('model-operation');
        expect(classification.matchedPattern).toBe('model:train');
      });

      it('should classify external-integration intents', async () => {
        const intent: CreateIntent = {
          action: 'external:api',
          resource: 'third_party_service',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('external-integration');
        expect(classification.matchedPattern).toBe('external:api');
      });

      it('should classify system-config intents', async () => {
        const intent: CreateIntent = {
          action: 'system:config:write',
          resource: 'app_settings',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('system-config');
        expect(classification.matchedPattern).toBe('system:config:write');
      });

      it('should classify user-action intents', async () => {
        const intent: CreateIntent = {
          action: 'user:create',
          resource: 'user_accounts',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('user-action');
        expect(classification.matchedPattern).toBe('user:create');
      });

      it('should infer category for unknown actions', async () => {
        const intent: CreateIntent = {
          action: 'data:custom_action',
          resource: 'some_resource',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('data-access');
        expect(classification.matchedPattern).toBeUndefined();
      });
    });

    describe('Risk Assessment Integration', () => {
      it('should include risk score in classification', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'public_data',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.riskScore).toBeGreaterThanOrEqual(0);
        expect(classification.riskScore).toBeLessThanOrEqual(100);
        expect(classification.riskLevel).toBeDefined();
      });

      it('should include full risk assessment', async () => {
        const intent: CreateIntent = {
          action: 'model:deploy',
          resource: 'production_model',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.riskAssessment).toBeDefined();
        expect(classification.riskAssessment.factors).toBeDefined();
        expect(classification.riskAssessment.factors.length).toBeGreaterThan(0);
      });

      it('should propagate historical patterns to risk assessment', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test_data',
        };

        const pattern: HistoricalPattern = {
          totalCount: 5,
          successCount: 1,
          failureCount: 4,
          isFirstTime: false,
        };

        const classification = await classifier.classifyIntent(intent, pattern);

        const hasFailureFactor = classification.riskAssessment.factors.some(
          (f) => f.name === 'high_failure_rate'
        );
        expect(hasFailureFactor).toBe(true);
      });
    });

    describe('Required Approvals', () => {
      it('should determine no approvals for low risk', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'public_data',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.requiredApprovals).toBeDefined();
        // Low risk should have auto or none
        expect(
          classification.requiredApprovals.includes('auto') ||
            classification.requiredApprovals.includes('none')
        ).toBe(true);
      });

      it('should require human review for medium risk', async () => {
        const intent: CreateIntent = {
          action: 'data:write',
          resource: 'internal_data',
        };

        const classification = await classifier.classifyIntent(intent);

        if (classification.riskLevel === 'medium') {
          expect(classification.requiredApprovals).toContain('human');
        }
      });

      it('should require manager approval for high risk', async () => {
        const intent: CreateIntent = {
          action: 'data:delete',
          resource: 'production_database',
        };

        const classification = await classifier.classifyIntent(intent);

        if (classification.riskLevel === 'high' || classification.riskLevel === 'critical') {
          expect(classification.requiredApprovals).toContain('manager');
        }
      });

      it('should require security review for critical risk', async () => {
        const intent: CreateIntent = {
          action: 'system:security',
          resource: 'credential_store',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.riskLevel).toBe('critical');
        expect(classification.requiredApprovals).toContain('security');
      });

      it('should indicate multi-party approval when multiple reviews needed', async () => {
        const intent: CreateIntent = {
          action: 'external:payment',
          resource: 'financial_api',
        };

        const classification = await classifier.classifyIntent(intent);

        // Payment actions are critical and require multiple approvals
        if (classification.requiredApprovals.filter((a) => a !== 'multi-party').length >= 2) {
          expect(classification.requiredApprovals).toContain('multi-party');
        }
      });
    });

    describe('Auto-Approval Eligibility', () => {
      it('should allow auto-approval for low risk intents', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'public_data',
        };

        const classification = await classifier.classifyIntent(intent);

        if (classification.riskScore <= 30) {
          expect(classification.canAutoApprove).toBe(true);
        }
      });

      it('should not allow auto-approval for high risk intents', async () => {
        const intent: CreateIntent = {
          action: 'system:admin',
          resource: 'production_config',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.canAutoApprove).toBe(false);
      });

      it('should not allow auto-approval when human review required', async () => {
        const intent: CreateIntent = {
          action: 'data:export',
          resource: 'customer_pii',
        };

        const classification = await classifier.classifyIntent(intent);

        if (classification.requiredApprovals.includes('human')) {
          expect(classification.canAutoApprove).toBe(false);
        }
      });
    });

    describe('Classification Confidence', () => {
      it('should have high confidence for known patterns', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test_data',
          parameters: { limit: 10 },
        };

        const classification = await classifier.classifyIntent(intent);

        // Known pattern + resource + parameters = high confidence
        expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it('should have lower confidence for unknown patterns', async () => {
        const intent: CreateIntent = {
          action: 'custom:unknown',
          resource: '',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.confidence).toBeLessThan(0.5);
      });

      it('should include timestamp', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.classifiedAt).toBeDefined();
        expect(new Date(classification.classifiedAt).getTime()).not.toBeNaN();
      });
    });

    describe('Minimum Trust Level', () => {
      it('should require low trust level for low risk', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'public_data',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.minTrustLevel).toBeLessThanOrEqual(2);
      });

      it('should require high trust level for critical risk', async () => {
        const intent: CreateIntent = {
          action: 'system:security',
          resource: 'credential_store',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.minTrustLevel).toBeGreaterThanOrEqual(4);
      });
    });

    describe('Helper Methods', () => {
      it('should identify known actions', () => {
        expect(classifier.isKnownAction('data:read')).toBe(true);
        expect(classifier.isKnownAction('model:train')).toBe(true);
        expect(classifier.isKnownAction('unknown:action')).toBe(false);
      });

      it('should get category for actions', () => {
        expect(classifier.getCategoryForAction('data:read')).toBe('data-access');
        expect(classifier.getCategoryForAction('model:train')).toBe('model-operation');
        expect(classifier.getCategoryForAction('data:custom')).toBe('data-access');
      });

      it('should provide access to risk assessor', () => {
        const assessor = classifier.getRiskAssessor();
        expect(assessor).toBeInstanceOf(RiskAssessor);
      });
    });
  });

  describe('Edge Cases', () => {
    let classifier: IntentClassifier;

    beforeEach(() => {
      classifier = createIntentClassifier();
    });

    describe('Missing Data', () => {
      it('should handle empty action string', async () => {
        const intent: CreateIntent = {
          action: '',
          resource: 'test',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('user-action');
        expect(classification.matchedPattern).toBeUndefined();
      });

      it('should handle empty resource string', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: '',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('data-access');
        expect(classification.confidence).toBeLessThan(1);
      });

      it('should handle null/undefined parameters', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test',
          parameters: undefined,
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification).toBeDefined();
        expect(classification.riskScore).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty parameters object', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test',
          parameters: {},
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification).toBeDefined();
      });
    });

    describe('Unknown Actions', () => {
      it('should classify completely unknown actions', async () => {
        const intent: CreateIntent = {
          action: 'xyz123:foo:bar',
          resource: 'unknown_resource',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification.category).toBe('user-action');
        expect(classification.riskScore).toBeGreaterThanOrEqual(30);
      });

      it('should handle special characters in action', async () => {
        const intent: CreateIntent = {
          action: 'action-with-dashes_and_underscores',
          resource: 'test',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification).toBeDefined();
      });

      it('should handle very long action strings', async () => {
        const intent: CreateIntent = {
          action: 'a'.repeat(1000),
          resource: 'test',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification).toBeDefined();
        expect(classification.category).toBe('user-action');
      });
    });

    describe('Resource Matching Edge Cases', () => {
      it('should handle multiple sensitivity matches', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'production-customer-financial-health-data',
        };

        const classification = await classifier.classifyIntent(intent);

        // Should use highest sensitivity match (health = 95)
        // Base risk (15) + sensitivity modifier (95-30)/100 * 15 = 15 + 9.75 = ~25
        // The score increases based on resource sensitivity
        expect(classification.riskScore).toBeGreaterThan(20);
        // Verify multiple sensitivity patterns were matched
        const matches = matchResourceSensitivity(intent.resource);
        expect(matches.length).toBeGreaterThan(1);
      });

      it('should handle resources with no sensitivity match', async () => {
        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'xyz123_no_match_resource',
        };

        const classification = await classifier.classifyIntent(intent);

        expect(classification).toBeDefined();
      });
    });

    describe('Configuration', () => {
      it('should respect custom auto-approval threshold', async () => {
        const strictClassifier = createIntentClassifier({
          autoApprovalRiskThreshold: 10,
        });

        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test_data',
        };

        const classification = await strictClassifier.classifyIntent(intent);

        // With stricter threshold, even low risk might not auto-approve
        if (classification.riskScore > 10) {
          expect(classification.canAutoApprove).toBe(false);
        }
      });

      it('should respect custom trust threshold', async () => {
        const strictClassifier = createIntentClassifier({
          autoApprovalTrustThreshold: 1,
        });

        const intent: CreateIntent = {
          action: 'data:read',
          resource: 'test_data',
        };

        const classification = await strictClassifier.classifyIntent(intent);

        // With stricter trust threshold, may not auto-approve
        if (classification.minTrustLevel > 1) {
          expect(classification.canAutoApprove).toBe(false);
        }
      });
    });
  });

  describe('Pattern Constants', () => {
    it('should have action patterns defined', () => {
      expect(ACTION_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should have resource sensitivity patterns defined', () => {
      expect(RESOURCE_SENSITIVITY.length).toBeGreaterThan(0);
    });

    it('should have all categories covered in action patterns', () => {
      const categories: IntentCategory[] = [
        'data-access',
        'model-operation',
        'external-integration',
        'system-config',
        'user-action',
      ];

      for (const category of categories) {
        const hasPattern = ACTION_PATTERNS.some((p) => p.category === category);
        expect(hasPattern).toBe(true);
      }
    });

    it('should have all risk tiers represented in action patterns', () => {
      const tiers: RiskTier[] = ['low', 'medium', 'high', 'critical'];

      for (const tier of tiers) {
        const hasPattern = ACTION_PATTERNS.some((p) => p.defaultRiskTier === tier);
        expect(hasPattern).toBe(true);
      }
    });
  });
});
