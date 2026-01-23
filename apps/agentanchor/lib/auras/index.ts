/**
 * Auras Module - 16 Archetypal AI Advisory Personas
 *
 * Multi-provider AI council for governance decisions.
 */

// Types
export * from './types';

// Registry
export {
    AURA_REGISTRY,
    STANDARD_COUNCILS,
    getAura,
    getAllAuras,
    getAurasByDomain,
    getCouncil,
    getAllCouncils,
    getCouncilForUseCase,
} from './registry';

// Service
export {
    AuraService,
    getAuraService,
    createAuraService,
} from './aura-service';
export type { AuraServiceConfig } from './aura-service';

// Governance Integration
export {
    requestCouncilDecision,
    quickGovernanceCheck,
    selectCouncilForDecision,
} from './governance-integration';
export type {
    GovernanceDecisionRequest,
    GovernanceDecisionResult,
} from './governance-integration';
