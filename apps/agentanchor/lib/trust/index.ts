/**
 * Trust Module - AgentAnchor
 *
 * Exports for trust scoring, creator trust, and signal integrity (Patents 1 & 5)
 */

// Patent 5: Creator Trust (Transitive Trust Model)
export {
  calculateCreatorTrust,
  createAgentCreatorBinding,
  getAgentCreatorBinding,
  getCreatorFleetSummary,
  assessCreatorRisk,
  type CreatorTrustScore,
  type CreatorTrustSignals,
  type AgentCreatorBinding,
  type FleetSummary,
  type CreatorRiskAssessment,
} from './creator-trust-service'

// Patent 1: Signal Integrity Verification
export {
  SignalFactory,
  SignalVerifier,
  AdversarialResistance,
  ScoreCertificateGenerator,
  signalFactory,
  signalVerifier,
  adversarialResistance,
  scoreCertificateGenerator,
  type TrustSignal,
  type TrustSignalType,
  type SignalSource,
  type SignalVerificationResult,
  type ScoreCertificate,
} from './signal-integrity'

// Re-export existing trust functions
export {
  getTrustTier,
  getTrustTierInfo,
  calculateDecay,
  buildTrustContext,
  assessRisk,
  evaluateAction,
  applyTrustChange,
  TRUST_IMPACTS,
} from '@/lib/governance/trust'
