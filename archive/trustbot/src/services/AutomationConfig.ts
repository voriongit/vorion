/**
 * Automation Configuration Service
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.8: Automation Threshold Configuration
 *
 * Allows directors to configure automation thresholds to balance
 * efficiency with oversight:
 * - Auto-approval trust thresholds
 * - Risk level classifications
 * - Timeout durations
 * - Escalation paths
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'immediate';
export type ReviewerRole = 'operator' | 'supervisor' | 'director' | 'security_team';
export type TimeoutAction = 'escalate' | 'expire' | 'auto_deny';

export interface AutoApprovalThresholds {
    /** Minimum trust score for auto-approval (0-1000) */
    minTrustScore: number;
    /** Maximum risk level that can be auto-approved */
    maxRiskLevel: RiskLevel;
    /** Maximum actions per hour for rate limiting */
    maxActionsPerHour: number;
    /** Required success streak before auto-approval eligible */
    requiredSuccessStreak: number;
    /** Action types that can never be auto-approved */
    excludedActionTypes: string[];
    /** Enable auto-approval system */
    enabled: boolean;
}

export interface RiskClassification {
    level: RiskLevel;
    /** Trust score range for this risk level */
    trustScoreRange: {
        min: number;
        max: number;
    };
    /** Action types classified as this risk */
    actionTypes: string[];
    /** Patterns that match this risk level */
    patterns: string[];
    /** Base score for this risk level */
    baseScore: number;
}

export interface TimeoutConfiguration {
    urgency: UrgencyLevel;
    /** Timeout duration in milliseconds */
    timeoutMs: number;
    /** Action to take on timeout */
    action: TimeoutAction;
    /** Warning time before timeout in milliseconds */
    warningMs: number;
    /** Description */
    description: string;
}

export interface EscalationPath {
    /** Source risk level */
    fromRisk: RiskLevel;
    /** Target role for escalation */
    targetRole: ReviewerRole;
    /** Escalation chain - ordered list of roles */
    chain: ReviewerRole[];
    /** Maximum escalation levels */
    maxLevels: number;
    /** Auto-escalate after timeout */
    autoEscalate: boolean;
    /** Notification settings */
    notifications: {
        email: boolean;
        slack: boolean;
        webhook?: string;
    };
}

export interface TribunalConfiguration {
    /** Minimum validators for quorum */
    minValidators: number;
    /** Maximum validators to select */
    maxValidators: number;
    /** Minimum trust score for validator eligibility */
    validatorMinTrust: number;
    /** Required consensus percentage (0-1) */
    consensusThreshold: number;
    /** Allow weighted voting by trust score */
    weightedVoting: boolean;
    /** Enable tribunal system */
    enabled: boolean;
}

export interface HITLConfiguration {
    /** Enable load balancing */
    loadBalancing: boolean;
    /** Maximum concurrent assignments per reviewer */
    maxConcurrentPerReviewer: number;
    /** Reviewer availability check */
    checkAvailability: boolean;
    /** Default urgency for unclassified requests */
    defaultUrgency: UrgencyLevel;
    /** SLA targets by urgency (in milliseconds) */
    slaTargets: Record<UrgencyLevel, number>;
}

export interface AutomationSettings {
    orgId: string;
    autoApproval: AutoApprovalThresholds;
    riskClassifications: RiskClassification[];
    timeouts: TimeoutConfiguration[];
    escalationPaths: EscalationPath[];
    tribunal: TribunalConfiguration;
    hitl: HITLConfiguration;
    updatedAt: Date;
    updatedBy?: string;
}

export interface AutomationConfigUpdate {
    autoApproval?: Partial<AutoApprovalThresholds>;
    riskClassifications?: RiskClassification[];
    timeouts?: TimeoutConfiguration[];
    escalationPaths?: EscalationPath[];
    tribunal?: Partial<TribunalConfiguration>;
    hitl?: Partial<HITLConfiguration>;
}

interface ConfigEvents {
    'config:updated': (orgId: string, settings: AutomationSettings) => void;
    'threshold:changed': (orgId: string, field: string, oldValue: unknown, newValue: unknown) => void;
    'config:reset': (orgId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_AUTO_APPROVAL: AutoApprovalThresholds = {
    minTrustScore: 800,
    maxRiskLevel: 'low',
    maxActionsPerHour: 100,
    requiredSuccessStreak: 5,
    excludedActionTypes: ['delete', 'financial', 'security_critical'],
    enabled: true,
};

const DEFAULT_RISK_CLASSIFICATIONS: RiskClassification[] = [
    {
        level: 'low',
        trustScoreRange: { min: 800, max: 1000 },
        actionTypes: ['read', 'query', 'report'],
        patterns: ['read_*', 'get_*', 'list_*'],
        baseScore: 10,
    },
    {
        level: 'medium',
        trustScoreRange: { min: 500, max: 799 },
        actionTypes: ['write', 'update', 'create'],
        patterns: ['write_*', 'update_*', 'create_*'],
        baseScore: 30,
    },
    {
        level: 'high',
        trustScoreRange: { min: 200, max: 499 },
        actionTypes: ['execute', 'external', 'modify'],
        patterns: ['execute_*', 'external_*', 'modify_*'],
        baseScore: 60,
    },
    {
        level: 'critical',
        trustScoreRange: { min: 0, max: 199 },
        actionTypes: ['delete', 'financial', 'security_critical'],
        patterns: ['delete_*', 'financial_*', 'admin_*'],
        baseScore: 100,
    },
];

const DEFAULT_TIMEOUTS: TimeoutConfiguration[] = [
    {
        urgency: 'immediate',
        timeoutMs: 15 * 60 * 1000, // 15 minutes
        action: 'escalate',
        warningMs: 10 * 60 * 1000, // 10 minutes
        description: 'Immediate urgency - escalates if not handled within 15 minutes',
    },
    {
        urgency: 'high',
        timeoutMs: 60 * 60 * 1000, // 1 hour
        action: 'escalate',
        warningMs: 45 * 60 * 1000, // 45 minutes
        description: 'High urgency - escalates if not handled within 1 hour',
    },
    {
        urgency: 'normal',
        timeoutMs: 4 * 60 * 60 * 1000, // 4 hours
        action: 'expire',
        warningMs: 3 * 60 * 60 * 1000, // 3 hours
        description: 'Normal urgency - expires if not handled within 4 hours',
    },
    {
        urgency: 'low',
        timeoutMs: 24 * 60 * 60 * 1000, // 24 hours
        action: 'expire',
        warningMs: 20 * 60 * 60 * 1000, // 20 hours
        description: 'Low urgency - expires if not handled within 24 hours',
    },
];

const DEFAULT_ESCALATION_PATHS: EscalationPath[] = [
    {
        fromRisk: 'low',
        targetRole: 'operator',
        chain: ['operator'],
        maxLevels: 1,
        autoEscalate: false,
        notifications: { email: false, slack: false },
    },
    {
        fromRisk: 'medium',
        targetRole: 'operator',
        chain: ['operator', 'supervisor'],
        maxLevels: 2,
        autoEscalate: true,
        notifications: { email: true, slack: false },
    },
    {
        fromRisk: 'high',
        targetRole: 'supervisor',
        chain: ['supervisor', 'director'],
        maxLevels: 2,
        autoEscalate: true,
        notifications: { email: true, slack: true },
    },
    {
        fromRisk: 'critical',
        targetRole: 'director',
        chain: ['director', 'security_team'],
        maxLevels: 2,
        autoEscalate: true,
        notifications: { email: true, slack: true },
    },
];

const DEFAULT_TRIBUNAL: TribunalConfiguration = {
    minValidators: 3,
    maxValidators: 5,
    validatorMinTrust: 700,
    consensusThreshold: 0.6,
    weightedVoting: true,
    enabled: true,
};

const DEFAULT_HITL: HITLConfiguration = {
    loadBalancing: true,
    maxConcurrentPerReviewer: 10,
    checkAvailability: true,
    defaultUrgency: 'normal',
    slaTargets: {
        immediate: 15 * 60 * 1000,  // 15 minutes
        high: 60 * 60 * 1000,        // 1 hour
        normal: 4 * 60 * 60 * 1000,  // 4 hours
        low: 24 * 60 * 60 * 1000,    // 24 hours
    },
};

// ============================================================================
// Automation Config Service
// ============================================================================

export class AutomationConfigService extends EventEmitter<ConfigEvents> {
    private settings: Map<string, AutomationSettings> = new Map();

    constructor() {
        super();
    }

    // =========================================================================
    // Settings Management
    // =========================================================================

    /**
     * Get settings for an organization (creates default if not exists)
     */
    getSettings(orgId: string): AutomationSettings {
        let settings = this.settings.get(orgId);
        if (!settings) {
            settings = this.createDefaultSettings(orgId);
            this.settings.set(orgId, settings);
        }
        return { ...settings };
    }

    /**
     * Update settings for an organization
     */
    updateSettings(
        orgId: string,
        update: AutomationConfigUpdate,
        updatedBy?: string
    ): AutomationSettings {
        const current = this.getSettings(orgId);

        // Update auto-approval settings
        if (update.autoApproval) {
            const oldThreshold = current.autoApproval.minTrustScore;
            current.autoApproval = { ...current.autoApproval, ...update.autoApproval };
            if (update.autoApproval.minTrustScore !== undefined && update.autoApproval.minTrustScore !== oldThreshold) {
                this.emit('threshold:changed', orgId, 'autoApproval.minTrustScore', oldThreshold, update.autoApproval.minTrustScore);
            }
        }

        // Replace risk classifications if provided
        if (update.riskClassifications) {
            current.riskClassifications = update.riskClassifications;
        }

        // Replace timeouts if provided
        if (update.timeouts) {
            current.timeouts = update.timeouts;
        }

        // Replace escalation paths if provided
        if (update.escalationPaths) {
            current.escalationPaths = update.escalationPaths;
        }

        // Update tribunal settings
        if (update.tribunal) {
            current.tribunal = { ...current.tribunal, ...update.tribunal };
        }

        // Update HITL settings
        if (update.hitl) {
            current.hitl = { ...current.hitl, ...update.hitl };
        }

        current.updatedAt = new Date();
        current.updatedBy = updatedBy;

        this.settings.set(orgId, current);
        this.emit('config:updated', orgId, current);

        return { ...current };
    }

    /**
     * Reset settings to defaults
     */
    resetSettings(orgId: string): AutomationSettings {
        const settings = this.createDefaultSettings(orgId);
        this.settings.set(orgId, settings);
        this.emit('config:reset', orgId);
        return { ...settings };
    }

    // =========================================================================
    // Auto-Approval Configuration
    // =========================================================================

    /**
     * Get auto-approval thresholds
     */
    getAutoApprovalThresholds(orgId: string): AutoApprovalThresholds {
        return { ...this.getSettings(orgId).autoApproval };
    }

    /**
     * Update auto-approval thresholds
     */
    updateAutoApprovalThresholds(
        orgId: string,
        update: Partial<AutoApprovalThresholds>
    ): AutoApprovalThresholds {
        const settings = this.updateSettings(orgId, { autoApproval: update });
        return settings.autoApproval;
    }

    /**
     * Check if an action is eligible for auto-approval
     */
    isAutoApprovalEligible(
        orgId: string,
        trustScore: number,
        actionType: string,
        riskLevel: RiskLevel
    ): { eligible: boolean; reason?: string } {
        const config = this.getAutoApprovalThresholds(orgId);

        if (!config.enabled) {
            return { eligible: false, reason: 'Auto-approval disabled' };
        }

        if (trustScore < config.minTrustScore) {
            return { eligible: false, reason: `Trust score ${trustScore} below threshold ${config.minTrustScore}` };
        }

        if (config.excludedActionTypes.includes(actionType)) {
            return { eligible: false, reason: `Action type ${actionType} excluded from auto-approval` };
        }

        const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
        if (riskOrder.indexOf(riskLevel) > riskOrder.indexOf(config.maxRiskLevel)) {
            return { eligible: false, reason: `Risk level ${riskLevel} exceeds maximum ${config.maxRiskLevel}` };
        }

        return { eligible: true };
    }

    // =========================================================================
    // Risk Classification
    // =========================================================================

    /**
     * Get risk classifications
     */
    getRiskClassifications(orgId: string): RiskClassification[] {
        return this.getSettings(orgId).riskClassifications.map(r => ({ ...r }));
    }

    /**
     * Classify an action's risk level
     */
    classifyRisk(orgId: string, actionType: string, trustScore?: number): RiskLevel {
        const classifications = this.getRiskClassifications(orgId);

        // Check by action type first
        for (const classification of classifications) {
            if (classification.actionTypes.includes(actionType)) {
                return classification.level;
            }
            // Check patterns
            for (const pattern of classification.patterns) {
                const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
                if (regex.test(actionType)) {
                    return classification.level;
                }
            }
        }

        // Fall back to trust score if provided
        if (trustScore !== undefined) {
            for (const classification of classifications) {
                if (trustScore >= classification.trustScoreRange.min &&
                    trustScore <= classification.trustScoreRange.max) {
                    return classification.level;
                }
            }
        }

        // Default to medium
        return 'medium';
    }

    /**
     * Get risk score for action
     */
    getRiskScore(orgId: string, actionType: string): number {
        const classifications = this.getRiskClassifications(orgId);
        const riskLevel = this.classifyRisk(orgId, actionType);
        const classification = classifications.find(c => c.level === riskLevel);
        return classification?.baseScore ?? 30;
    }

    // =========================================================================
    // Timeout Configuration
    // =========================================================================

    /**
     * Get timeout configurations
     */
    getTimeoutConfigurations(orgId: string): TimeoutConfiguration[] {
        return this.getSettings(orgId).timeouts.map(t => ({ ...t }));
    }

    /**
     * Get timeout for urgency level
     */
    getTimeoutForUrgency(orgId: string, urgency: UrgencyLevel): TimeoutConfiguration | null {
        const timeouts = this.getTimeoutConfigurations(orgId);
        return timeouts.find(t => t.urgency === urgency) || null;
    }

    // =========================================================================
    // Escalation Paths
    // =========================================================================

    /**
     * Get escalation paths
     */
    getEscalationPaths(orgId: string): EscalationPath[] {
        return this.getSettings(orgId).escalationPaths.map(e => ({ ...e }));
    }

    /**
     * Get escalation path for risk level
     */
    getEscalationPathForRisk(orgId: string, riskLevel: RiskLevel): EscalationPath | null {
        const paths = this.getEscalationPaths(orgId);
        return paths.find(p => p.fromRisk === riskLevel) || null;
    }

    /**
     * Get next escalation target
     */
    getNextEscalationTarget(
        orgId: string,
        riskLevel: RiskLevel,
        currentLevel: number
    ): ReviewerRole | null {
        const path = this.getEscalationPathForRisk(orgId, riskLevel);
        if (!path) return null;
        if (currentLevel >= path.maxLevels) return null;
        return path.chain[currentLevel] || null;
    }

    // =========================================================================
    // Tribunal Configuration
    // =========================================================================

    /**
     * Get tribunal configuration
     */
    getTribunalConfig(orgId: string): TribunalConfiguration {
        return { ...this.getSettings(orgId).tribunal };
    }

    /**
     * Update tribunal configuration
     */
    updateTribunalConfig(
        orgId: string,
        update: Partial<TribunalConfiguration>
    ): TribunalConfiguration {
        const settings = this.updateSettings(orgId, { tribunal: update });
        return settings.tribunal;
    }

    // =========================================================================
    // HITL Configuration
    // =========================================================================

    /**
     * Get HITL configuration
     */
    getHITLConfig(orgId: string): HITLConfiguration {
        return { ...this.getSettings(orgId).hitl };
    }

    /**
     * Update HITL configuration
     */
    updateHITLConfig(
        orgId: string,
        update: Partial<HITLConfiguration>
    ): HITLConfiguration {
        const settings = this.updateSettings(orgId, { hitl: update });
        return settings.hitl;
    }

    /**
     * Get SLA target for urgency
     */
    getSLATarget(orgId: string, urgency: UrgencyLevel): number {
        const config = this.getHITLConfig(orgId);
        return config.slaTargets[urgency];
    }

    // =========================================================================
    // Validation
    // =========================================================================

    /**
     * Validate configuration update
     */
    validateUpdate(update: AutomationConfigUpdate): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (update.autoApproval) {
            const aa = update.autoApproval;
            if (aa.minTrustScore !== undefined && (aa.minTrustScore < 0 || aa.minTrustScore > 1000)) {
                errors.push('autoApproval.minTrustScore must be between 0 and 1000');
            }
            if (aa.maxActionsPerHour !== undefined && aa.maxActionsPerHour < 1) {
                errors.push('autoApproval.maxActionsPerHour must be at least 1');
            }
            if (aa.requiredSuccessStreak !== undefined && aa.requiredSuccessStreak < 0) {
                errors.push('autoApproval.requiredSuccessStreak must be non-negative');
            }
        }

        if (update.tribunal) {
            const t = update.tribunal;
            if (t.minValidators !== undefined && t.minValidators < 1) {
                errors.push('tribunal.minValidators must be at least 1');
            }
            if (t.maxValidators !== undefined && t.maxValidators < 1) {
                errors.push('tribunal.maxValidators must be at least 1');
            }
            if (t.minValidators !== undefined && t.maxValidators !== undefined &&
                t.minValidators > t.maxValidators) {
                errors.push('tribunal.minValidators cannot exceed maxValidators');
            }
            if (t.consensusThreshold !== undefined && (t.consensusThreshold < 0 || t.consensusThreshold > 1)) {
                errors.push('tribunal.consensusThreshold must be between 0 and 1');
            }
        }

        if (update.hitl) {
            const h = update.hitl;
            if (h.maxConcurrentPerReviewer !== undefined && h.maxConcurrentPerReviewer < 1) {
                errors.push('hitl.maxConcurrentPerReviewer must be at least 1');
            }
        }

        if (update.riskClassifications) {
            for (let i = 0; i < update.riskClassifications.length; i++) {
                const rc = update.riskClassifications[i];
                if (rc.trustScoreRange.min > rc.trustScoreRange.max) {
                    errors.push(`riskClassifications[${i}].trustScoreRange: min cannot exceed max`);
                }
            }
        }

        if (update.timeouts) {
            for (let i = 0; i < update.timeouts.length; i++) {
                const t = update.timeouts[i];
                if (t.timeoutMs <= 0) {
                    errors.push(`timeouts[${i}].timeoutMs must be positive`);
                }
                if (t.warningMs >= t.timeoutMs) {
                    errors.push(`timeouts[${i}].warningMs must be less than timeoutMs`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    // =========================================================================
    // Defaults
    // =========================================================================

    /**
     * Get default settings
     */
    getDefaults(): Omit<AutomationSettings, 'orgId' | 'updatedAt'> {
        return {
            autoApproval: { ...DEFAULT_AUTO_APPROVAL },
            riskClassifications: DEFAULT_RISK_CLASSIFICATIONS.map(r => ({ ...r })),
            timeouts: DEFAULT_TIMEOUTS.map(t => ({ ...t })),
            escalationPaths: DEFAULT_ESCALATION_PATHS.map(e => ({ ...e })),
            tribunal: { ...DEFAULT_TRIBUNAL },
            hitl: { ...DEFAULT_HITL },
        };
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Clear all settings
     */
    clear(): void {
        this.settings.clear();
    }

    /**
     * Get all org IDs with custom settings
     */
    getConfiguredOrgs(): string[] {
        return Array.from(this.settings.keys());
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private createDefaultSettings(orgId: string): AutomationSettings {
        return {
            orgId,
            autoApproval: { ...DEFAULT_AUTO_APPROVAL },
            riskClassifications: DEFAULT_RISK_CLASSIFICATIONS.map(r => ({ ...r })),
            timeouts: DEFAULT_TIMEOUTS.map(t => ({ ...t })),
            escalationPaths: DEFAULT_ESCALATION_PATHS.map(e => ({ ...e })),
            tribunal: { ...DEFAULT_TRIBUNAL },
            hitl: { ...DEFAULT_HITL },
            updatedAt: new Date(),
        };
    }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: AutomationConfigService | null = null;

export function getAutomationConfigService(): AutomationConfigService {
    if (!instance) {
        instance = new AutomationConfigService();
    }
    return instance;
}

export function resetAutomationConfigService(): void {
    if (instance) {
        instance.clear();
    }
    instance = null;
}

export default AutomationConfigService;
