/**
 * Aurais System - Main Entry Point
 * 
 * Bootstraps the Tier 5 Supreme Orchestrators and initializes the system.
 */

import { T5Executor, T5Planner, T5Validator, T5Evolver, T5Spawner } from './orchestrators/index.js';
import { blackboard, trustEngine, hitlGateway } from './core/index.js';

// ============================================================================
// System State
// ============================================================================

interface SystemState {
    executor: T5Executor | null;
    planner: T5Planner | null;
    validator: T5Validator | null;
    evolver: T5Evolver | null;
    spawner: T5Spawner | null;
    isRunning: boolean;
    startedAt: Date | null;
}

const state: SystemState = {
    executor: null,
    planner: null,
    validator: null,
    evolver: null,
    spawner: null,
    isRunning: false,
    startedAt: null,
};

// ============================================================================
// Bootstrap
// ============================================================================

/**
 * Bootstrap the Aurais system
 */
export async function bootstrap(): Promise<void> {
    console.log('🏢 Aurais System - Initializing...');
    console.log('');

    // Set initial HITL level to 100%
    trustEngine.setHITLLevel(100);
    console.log(`📊 HITL Governance Level: ${trustEngine.getHITLLevel()}%`);
    console.log('');

    // Create T5 Orchestrators
    console.log('🎖️  Creating T5-EXECUTOR (Supreme Commander)...');
    state.executor = new T5Executor();
    await state.executor.initialize();

    console.log('🧠 Creating T5-PLANNER (Strategic Architect)...');
    state.planner = new T5Planner();
    await state.planner.initialize();

    console.log('🛡️  Creating T5-VALIDATOR (Trust Guardian)...');
    state.validator = new T5Validator();
    await state.validator.initialize();

    console.log('🧬 Creating T5-EVOLVER (Adaptive Intelligence)...');
    state.evolver = new T5Evolver();
    await state.evolver.initialize();

    console.log('🏭 Creating T5-SPAWNER (Agent Factory)...');
    state.spawner = new T5Spawner();
    await state.spawner.initialize();

    // Register T5 agents with Executor
    state.executor.registerT5Agent('PLANNER', state.planner.id);
    state.executor.registerT5Agent('VALIDATOR', state.validator.id);
    state.executor.registerT5Agent('EVOLVER', state.evolver.id);
    state.executor.registerT5Agent('SPAWNER', state.spawner.id);

    console.log('');
    console.log('✅ All T5 Orchestrators online!');
    console.log('');

    // Spawn initial agents (Listeners and Assistants)
    console.log('👂 Spawning initial Listener agents...');
    state.spawner.spawnListener('DecisionListener', 'Observe and log all decisions for transparency');
    state.spawner.spawnListener('CommunicationListener', 'Monitor inter-agent communications');
    state.spawner.spawnListener('HITLReportListener', 'Prepare daily reports for HITL review');

    console.log('🤖 Spawning initial Assistant agents...');
    state.spawner.spawnAssistant('ResearchAssistant', 'Gather information for T5-Planner');
    state.spawner.spawnAssistant('DocumentationAssistant', 'Maintain knowledge base documentation');

    console.log('');

    // Display system status
    const stats = trustEngine.getStats();
    const bbStats = blackboard.getStats();

    console.log('📊 System Status:');
    console.log(`   Total Agents: ${stats.totalAgents}`);
    console.log(`   HITL Level: ${stats.hitlLevel}%`);
    console.log(`   Average Trust: ${stats.avgTrust}`);
    console.log(`   Blackboard Entries: ${bbStats.total}`);
    console.log('');

    state.isRunning = true;
    state.startedAt = new Date();

    console.log('🏢 Aurais System - ONLINE');
    console.log(`   Started at: ${state.startedAt.toISOString()}`);
    console.log('');
}

/**
 * Get system state
 */
export function getState(): SystemState {
    return { ...state };
}

/**
 * Get all T5 blueprints
 */
export function getT5Blueprints() {
    return {
        executor: state.executor?.toBlueprint(),
        planner: state.planner?.toBlueprint(),
        validator: state.validator?.toBlueprint(),
        evolver: state.evolver?.toBlueprint(),
        spawner: state.spawner?.toBlueprint(),
    };
}

/**
 * Get system metrics
 */
export function getMetrics() {
    return {
        trust: trustEngine.getStats(),
        blackboard: blackboard.getStats(),
        hitl: hitlGateway.getStats(),
        uptime: state.startedAt
            ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
            : 0,
    };
}

/**
 * Shutdown the system
 */
export async function shutdown(): Promise<void> {
    console.log('🛑 Aurais System - Shutting down...');

    if (state.spawner) await state.spawner.terminate();
    if (state.evolver) await state.evolver.terminate();
    if (state.validator) await state.validator.terminate();
    if (state.planner) await state.planner.terminate();
    if (state.executor) await state.executor.terminate();

    state.isRunning = false;
    console.log('✅ Shutdown complete');
}

// ============================================================================
// Run if executed directly
// ============================================================================

// Auto-bootstrap
bootstrap().catch(console.error);
