/**
 * Pre-Action Gate Module - ATSF v2.0 Capability Gating
 *
 * Implements pre-action verification to prevent "Treacherous Turn" attacks.
 * Low-trust agents cannot request high-risk actions.
 *
 * Key principle: Trust must be earned through demonstrated success
 * on low-risk actions first.
 */

// Risk Classifier
export {
  classifyRisk,
  getRiskLevel,
  isReadOnly,
  involvesTransfer,
  isDestructive,
  explainRiskFactors,
  requiresVerification,
  requiresHumanApproval,
} from './risk-classifier.js';

// Pre-Action Gate
export {
  PreActionGate,
  createPreActionGate,
  createMapTrustProvider,
  type TrustProvider,
  type GateEventListener,
} from './pre-action-gate.js';
