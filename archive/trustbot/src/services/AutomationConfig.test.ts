/**
 * Automation Configuration Service Tests
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.8: Automation Threshold Configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    AutomationConfigService,
    getAutomationConfigService,
    resetAutomationConfigService,
    type AutoApprovalThresholds,
    type RiskClassification,
    type TimeoutConfiguration,
    type EscalationPath,
    type TribunalConfiguration,
    type HITLConfiguration,
} from './AutomationConfig.js';

// ============================================================================
// Tests
// ============================================================================

describe('AutomationConfigService', () => {
    let service: AutomationConfigService;

    beforeEach(() => {
        resetAutomationConfigService();
        service = new AutomationConfigService();
    });

    // =========================================================================
    // Settings Management
    // =========================================================================

    describe('getSettings', () => {
        it('should return default settings for new org', () => {
            const settings = service.getSettings('org_1');

            expect(settings.orgId).toBe('org_1');
            expect(settings.autoApproval).toBeDefined();
            expect(settings.riskClassifications.length).toBe(4);
            expect(settings.timeouts.length).toBe(4);
            expect(settings.escalationPaths.length).toBe(4);
        });

        it('should return same settings on subsequent calls', () => {
            const settings1 = service.getSettings('org_1');
            settings1.autoApproval.minTrustScore = 500;

            // Update in storage
            service.updateSettings('org_1', { autoApproval: { minTrustScore: 500 } });
            const settings2 = service.getSettings('org_1');

            expect(settings2.autoApproval.minTrustScore).toBe(500);
        });
    });

    describe('updateSettings', () => {
        it('should update auto-approval settings', () => {
            service.updateSettings('org_1', {
                autoApproval: { minTrustScore: 900 },
            });

            const settings = service.getSettings('org_1');
            expect(settings.autoApproval.minTrustScore).toBe(900);
        });

        it('should emit config:updated event', () => {
            const handler = vi.fn();
            service.on('config:updated', handler);

            service.updateSettings('org_1', {
                autoApproval: { minTrustScore: 900 },
            });

            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0]).toBe('org_1');
        });

        it('should emit threshold:changed for trust score change', () => {
            const handler = vi.fn();
            service.on('threshold:changed', handler);
            service.getSettings('org_1'); // Initialize with defaults

            service.updateSettings('org_1', {
                autoApproval: { minTrustScore: 900 },
            });

            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][1]).toBe('autoApproval.minTrustScore');
        });

        it('should track updatedBy', () => {
            service.updateSettings('org_1', {
                autoApproval: { enabled: false },
            }, 'admin_user');

            const settings = service.getSettings('org_1');
            expect(settings.updatedBy).toBe('admin_user');
        });
    });

    describe('resetSettings', () => {
        it('should reset to defaults', () => {
            service.updateSettings('org_1', {
                autoApproval: { minTrustScore: 500 },
            });

            service.resetSettings('org_1');

            const settings = service.getSettings('org_1');
            expect(settings.autoApproval.minTrustScore).toBe(800); // Default
        });

        it('should emit config:reset event', () => {
            const handler = vi.fn();
            service.on('config:reset', handler);

            service.resetSettings('org_1');

            expect(handler).toHaveBeenCalledWith('org_1');
        });
    });

    // =========================================================================
    // Auto-Approval Configuration
    // =========================================================================

    describe('getAutoApprovalThresholds', () => {
        it('should return default auto-approval thresholds', () => {
            const thresholds = service.getAutoApprovalThresholds('org_1');

            expect(thresholds.minTrustScore).toBe(800);
            expect(thresholds.maxRiskLevel).toBe('low');
            expect(thresholds.maxActionsPerHour).toBe(100);
            expect(thresholds.enabled).toBe(true);
        });
    });

    describe('updateAutoApprovalThresholds', () => {
        it('should update specific threshold', () => {
            const thresholds = service.updateAutoApprovalThresholds('org_1', {
                minTrustScore: 750,
            });

            expect(thresholds.minTrustScore).toBe(750);
            expect(thresholds.maxRiskLevel).toBe('low'); // Unchanged
        });
    });

    describe('isAutoApprovalEligible', () => {
        it('should return eligible for high trust low risk', () => {
            const result = service.isAutoApprovalEligible('org_1', 850, 'read', 'low');

            expect(result.eligible).toBe(true);
        });

        it('should return ineligible when disabled', () => {
            service.updateAutoApprovalThresholds('org_1', { enabled: false });

            const result = service.isAutoApprovalEligible('org_1', 850, 'read', 'low');

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('disabled');
        });

        it('should return ineligible for low trust', () => {
            const result = service.isAutoApprovalEligible('org_1', 500, 'read', 'low');

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Trust score');
        });

        it('should return ineligible for excluded action type', () => {
            const result = service.isAutoApprovalEligible('org_1', 900, 'delete', 'low');

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('excluded');
        });

        it('should return ineligible for high risk', () => {
            const result = service.isAutoApprovalEligible('org_1', 900, 'execute', 'high');

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Risk level');
        });
    });

    // =========================================================================
    // Risk Classification
    // =========================================================================

    describe('getRiskClassifications', () => {
        it('should return all risk classifications', () => {
            const classifications = service.getRiskClassifications('org_1');

            expect(classifications.length).toBe(4);
            expect(classifications.map(c => c.level)).toContain('low');
            expect(classifications.map(c => c.level)).toContain('critical');
        });
    });

    describe('classifyRisk', () => {
        it('should classify by action type', () => {
            expect(service.classifyRisk('org_1', 'read')).toBe('low');
            expect(service.classifyRisk('org_1', 'write')).toBe('medium');
            expect(service.classifyRisk('org_1', 'execute')).toBe('high');
            expect(service.classifyRisk('org_1', 'delete')).toBe('critical');
        });

        it('should classify by pattern', () => {
            expect(service.classifyRisk('org_1', 'read_users')).toBe('low');
            expect(service.classifyRisk('org_1', 'update_profile')).toBe('medium');
            expect(service.classifyRisk('org_1', 'execute_job')).toBe('high');
            expect(service.classifyRisk('org_1', 'delete_account')).toBe('critical');
        });

        it('should fall back to trust score', () => {
            expect(service.classifyRisk('org_1', 'unknown_action', 850)).toBe('low');
            expect(service.classifyRisk('org_1', 'unknown_action', 600)).toBe('medium');
            expect(service.classifyRisk('org_1', 'unknown_action', 300)).toBe('high');
            expect(service.classifyRisk('org_1', 'unknown_action', 100)).toBe('critical');
        });

        it('should default to medium for unknown', () => {
            expect(service.classifyRisk('org_1', 'unknown_action')).toBe('medium');
        });
    });

    describe('getRiskScore', () => {
        it('should return base score for risk level', () => {
            expect(service.getRiskScore('org_1', 'read')).toBe(10);
            expect(service.getRiskScore('org_1', 'write')).toBe(30);
            expect(service.getRiskScore('org_1', 'execute')).toBe(60);
            expect(service.getRiskScore('org_1', 'delete')).toBe(100);
        });
    });

    // =========================================================================
    // Timeout Configuration
    // =========================================================================

    describe('getTimeoutConfigurations', () => {
        it('should return all timeout configurations', () => {
            const timeouts = service.getTimeoutConfigurations('org_1');

            expect(timeouts.length).toBe(4);
            expect(timeouts.find(t => t.urgency === 'immediate')?.timeoutMs).toBe(15 * 60 * 1000);
        });
    });

    describe('getTimeoutForUrgency', () => {
        it('should return timeout for urgency level', () => {
            const timeout = service.getTimeoutForUrgency('org_1', 'immediate');

            expect(timeout?.timeoutMs).toBe(15 * 60 * 1000);
            expect(timeout?.action).toBe('escalate');
        });

        it('should return null for unknown urgency', () => {
            const timeout = service.getTimeoutForUrgency('org_1', 'unknown' as any);
            expect(timeout).toBeNull();
        });
    });

    // =========================================================================
    // Escalation Paths
    // =========================================================================

    describe('getEscalationPaths', () => {
        it('should return all escalation paths', () => {
            const paths = service.getEscalationPaths('org_1');

            expect(paths.length).toBe(4);
        });
    });

    describe('getEscalationPathForRisk', () => {
        it('should return path for risk level', () => {
            const path = service.getEscalationPathForRisk('org_1', 'high');

            expect(path?.targetRole).toBe('supervisor');
            expect(path?.chain).toContain('director');
        });
    });

    describe('getNextEscalationTarget', () => {
        it('should return next target in chain', () => {
            const target = service.getNextEscalationTarget('org_1', 'high', 0);
            expect(target).toBe('supervisor');

            const nextTarget = service.getNextEscalationTarget('org_1', 'high', 1);
            expect(nextTarget).toBe('director');
        });

        it('should return null when max levels exceeded', () => {
            const target = service.getNextEscalationTarget('org_1', 'high', 5);
            expect(target).toBeNull();
        });
    });

    // =========================================================================
    // Tribunal Configuration
    // =========================================================================

    describe('getTribunalConfig', () => {
        it('should return default tribunal config', () => {
            const config = service.getTribunalConfig('org_1');

            expect(config.minValidators).toBe(3);
            expect(config.maxValidators).toBe(5);
            expect(config.consensusThreshold).toBe(0.6);
            expect(config.enabled).toBe(true);
        });
    });

    describe('updateTribunalConfig', () => {
        it('should update tribunal config', () => {
            const config = service.updateTribunalConfig('org_1', {
                minValidators: 5,
                consensusThreshold: 0.8,
            });

            expect(config.minValidators).toBe(5);
            expect(config.consensusThreshold).toBe(0.8);
        });
    });

    // =========================================================================
    // HITL Configuration
    // =========================================================================

    describe('getHITLConfig', () => {
        it('should return default HITL config', () => {
            const config = service.getHITLConfig('org_1');

            expect(config.loadBalancing).toBe(true);
            expect(config.maxConcurrentPerReviewer).toBe(10);
        });
    });

    describe('updateHITLConfig', () => {
        it('should update HITL config', () => {
            const config = service.updateHITLConfig('org_1', {
                maxConcurrentPerReviewer: 20,
            });

            expect(config.maxConcurrentPerReviewer).toBe(20);
        });
    });

    describe('getSLATarget', () => {
        it('should return SLA target for urgency', () => {
            expect(service.getSLATarget('org_1', 'immediate')).toBe(15 * 60 * 1000);
            expect(service.getSLATarget('org_1', 'high')).toBe(60 * 60 * 1000);
            expect(service.getSLATarget('org_1', 'normal')).toBe(4 * 60 * 60 * 1000);
            expect(service.getSLATarget('org_1', 'low')).toBe(24 * 60 * 60 * 1000);
        });
    });

    // =========================================================================
    // Validation
    // =========================================================================

    describe('validateUpdate', () => {
        it('should pass valid update', () => {
            const result = service.validateUpdate({
                autoApproval: { minTrustScore: 750 },
            });

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should fail invalid trust score', () => {
            const result = service.validateUpdate({
                autoApproval: { minTrustScore: 1500 },
            });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should fail invalid tribunal config', () => {
            const result = service.validateUpdate({
                tribunal: { minValidators: 10, maxValidators: 5 },
            });

            expect(result.valid).toBe(false);
        });

        it('should fail invalid consensus threshold', () => {
            const result = service.validateUpdate({
                tribunal: { consensusThreshold: 1.5 },
            });

            expect(result.valid).toBe(false);
        });

        it('should fail invalid timeout config', () => {
            const result = service.validateUpdate({
                timeouts: [{
                    urgency: 'immediate',
                    timeoutMs: 1000,
                    action: 'escalate',
                    warningMs: 2000, // Warning > timeout
                    description: 'Invalid',
                }],
            });

            expect(result.valid).toBe(false);
        });

        it('should fail invalid risk classification range', () => {
            const result = service.validateUpdate({
                riskClassifications: [{
                    level: 'low',
                    trustScoreRange: { min: 800, max: 500 }, // min > max
                    actionTypes: [],
                    patterns: [],
                    baseScore: 10,
                }],
            });

            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // Defaults
    // =========================================================================

    describe('getDefaults', () => {
        it('should return default configuration', () => {
            const defaults = service.getDefaults();

            expect(defaults.autoApproval.minTrustScore).toBe(800);
            expect(defaults.riskClassifications.length).toBe(4);
            expect(defaults.timeouts.length).toBe(4);
            expect(defaults.tribunal.minValidators).toBe(3);
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('clear', () => {
        it('should clear all settings', () => {
            service.updateSettings('org_1', { autoApproval: { minTrustScore: 500 } });
            service.updateSettings('org_2', { autoApproval: { minTrustScore: 600 } });

            service.clear();

            expect(service.getConfiguredOrgs().length).toBe(0);
        });
    });

    describe('getConfiguredOrgs', () => {
        it('should return orgs with custom settings', () => {
            service.getSettings('org_1');
            service.getSettings('org_2');

            const orgs = service.getConfiguredOrgs();

            expect(orgs).toContain('org_1');
            expect(orgs).toContain('org_2');
        });
    });

    // =========================================================================
    // Singleton
    // =========================================================================

    describe('singleton', () => {
        it('should return same instance', () => {
            resetAutomationConfigService();
            const instance1 = getAutomationConfigService();
            const instance2 = getAutomationConfigService();

            expect(instance1).toBe(instance2);
        });

        it('should reset properly', () => {
            const instance1 = getAutomationConfigService();
            instance1.updateSettings('org_1', { autoApproval: { minTrustScore: 500 } });

            resetAutomationConfigService();
            const instance2 = getAutomationConfigService();

            const settings = instance2.getSettings('org_1');
            expect(settings.autoApproval.minTrustScore).toBe(800); // Default
        });
    });
});
