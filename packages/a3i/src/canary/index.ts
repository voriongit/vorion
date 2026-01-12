/**
 * Canary Probe Module - ATSF v2.0 Continuous Behavioral Verification
 *
 * Provides canary probes for detecting "Boiling Frog" attacks that
 * gradually shift agent behavior without triggering trend detection.
 *
 * Key principle: ANY canary failure triggers immediate circuit breaker,
 * bypassing all trend analysis.
 */

// Probe Library
export {
  CANARY_PROBE_LIBRARY,
  TOTAL_PROBE_COUNT,
  getProbesByCategory,
  getProbesBySubcategory,
  getRandomProbe,
  getRandomProbeFromCategory,
  getProbeById,
  getLibraryStats,
} from './probe-library.js';

// Canary Service
export {
  CanaryProbeService,
  createCanaryProbeService,
  type AgentResponseFn,
  type CanaryEventListener,
} from './canary-service.js';
