/**
 * Council Governance Module
 *
 * Provides distributed governance through a council of high-tier agents.
 * The council reviews and votes on critical decisions when HITL oversight is low.
 */

// Types
export * from './types.js';

// Services
export { CouncilMemberRegistry, councilMemberRegistry } from './CouncilMemberRegistry.js';
export { CouncilService, councilService } from './CouncilService.js';
export { PrecedentService, precedentService } from './PrecedentService.js';
export { CouncilGatewayIntegration } from './CouncilGatewayIntegration.js';
export type {
    UnifiedApprovalRequest,
    UnifiedApprovalResult,
    GatewayIntegrationConfig,
    RoutingDecision,
} from './CouncilGatewayIntegration.js';
