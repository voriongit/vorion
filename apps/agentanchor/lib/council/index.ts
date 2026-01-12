// Council Module - Public API
export * from './types'
export * from './validators'
export {
  evaluateRequest,
  evaluateExamination,
} from './council-service'
export {
  assessRisk,
  canAutoApprove,
  getRequiredApproval,
} from './risk-assessment'
export {
  submitUpchainRequest,
  getPendingRequests,
  getDecisionHistory,
  recordHumanResponse,
} from './upchain-service'
export type { UpchainSubmission, UpchainResult } from './upchain-service'
export {
  createEscalation,
  getPendingEscalations,
  getEscalationById,
  assignEscalation,
  respondToEscalation,
  cancelEscalation,
  getEscalationHistory,
  getEscalationStats,
} from './escalation-service'
export type {
  Escalation,
  EscalationStatus,
  EscalationPriority,
  HumanDecision,
  CreateEscalationInput,
  EscalationResponse,
} from './escalation-service'

// Epic 14: Precedent Flywheel (MOAT BUILDER)
export {
  generateEmbedding,
  indexPrecedent,
  indexAllPrecedents,
  findSimilarPrecedents,
  buildValidatorContext,
  formatPrecedentsForPrompt,
} from './precedent-flywheel'
export type {
  PrecedentWithSimilarity,
  SimilaritySearchOptions,
  ValidatorContext,
} from './precedent-flywheel'

export {
  checkDecisionConsistency,
  getDecisionFlags,
  resolveConsistencyFlag,
  getUnresolvedFlags,
  getConsistencyMetrics,
} from './consistency-service'
export type {
  ConsistencyFlag,
  ConsistencyReport,
  InconsistencyType,
} from './consistency-service'

export {
  getActivePromptVersion,
  getPromptVersions,
  createPromptVersion,
  activatePromptVersion,
  generateTrainingExamples,
  recordValidatorDecision,
  updateDecisionFeedback,
  calculateVersionMetrics,
  updateVersionMetrics,
} from './fine-tuning-service'
export type {
  ValidatorType,
  ValidatorPromptVersion,
  ValidatorDecision,
  TrainingExample,
} from './fine-tuning-service'
