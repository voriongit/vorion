/**
 * Security Module - AgentAnchor
 *
 * Exports for Patents 7 & 8 security features
 */

export {
  PromptInjectionFirewall,
  promptFirewall,
  sanitizeInput,
  enforceInstructionHierarchy,
  validateOutput,
  generateCanaryConfig,
  checkCanaries,
  type SanitizationResult,
  type ThreatDetection,
  type ThreatType,
  type ValidationResult,
  type ValidationViolation,
  type InstructionLayer,
  type InstructionPrecedence,
  type ContentClassification,
  type FirewallConfig,
  type FirewallResult,
  type CanaryConfig,
} from './prompt-injection-firewall'

export {
  AdaptiveCircuitBreaker,
  adaptiveCircuitBreaker,
  type AnomalyScore,
  type BehaviorBaseline,
  type CircuitBreakerState,
  type TerminationRecord,
} from './adaptive-circuit-breaker'
