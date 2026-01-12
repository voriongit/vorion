/**
 * Trust Bridge - Universal Agent Certification Protocol
 *
 * "Any agent. Any origin. One trust standard."
 *
 * Enables AI agents from ANY platform to earn A3I trust credentials
 * through adversarial testing and certification.
 */

// Types
export * from './types';

// Submission
export {
  submitAgent,
  getSubmissionStatus,
  cancelSubmission,
  validateSubmission,
} from './submission';

// Certification
export {
  runCertificationTests,
  calculateCertificationScore,
  determineTier,
  checkCouncilRequired,
} from './certification';

// Credentials
export {
  issueCredential,
  verifyCredential,
  revokeCredential,
  refreshCredential,
} from './credentials';

// Certification Runner
export {
  CertificationRunner,
  getCertificationRunner,
} from './certification-runner';
export type { CertificationProgress } from './certification-runner';

// Queue Management
export {
  getQueuePosition,
  getEstimatedWait,
  processQueue,
} from './queue';

// Version
export const TRUST_BRIDGE_VERSION = '0.1.0';
