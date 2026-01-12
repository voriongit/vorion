/**
 * AgentAnchor Governance SDK
 *
 * Provides trust-based autonomy, persona injection, capability activation,
 * MCP execution, role enforcement, shadow mode training, and async audit
 * for AI agents.
 *
 * Risk×Trust Matrix Router (Council Priority #1)
 * - GREEN Path: Express approval for high-trust, low-risk
 * - YELLOW Path: Policy check for medium trust/risk
 * - RED Path: Full council consensus for low-trust or high-risk
 */

export * from './types';
export * from './trust';
export * from './persona';
export * from './capabilities';
export * from './mcp';
export * from './roles';
export * from './agent-wrapper';
export * from './shadow-mode';
export * from './observer-queue';
export * from './matrix-router';
