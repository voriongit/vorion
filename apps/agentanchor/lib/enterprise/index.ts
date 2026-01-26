/**
 * Phase 6 Enterprise Features
 *
 * Consolidated exports for all enterprise-grade features
 */

// =============================================================================
// Database & Data Access
// =============================================================================

export {
  DatabaseClient,
  Repository,
  getDatabase,
  type DatabaseConfig,
  type QueryResult,
  type DatabaseHealth,
} from '../db/client';

export {
  createRepositories,
  type Phase6Repositories,
} from '../db/repositories/phase6-repositories';

// =============================================================================
// Authentication & Authorization
// =============================================================================

export {
  createJWT,
  verifyJWT,
  createAPIKey,
  verifyAPIKey,
  authenticate,
  withAuth,
  requirePermission,
  apiKeyMiddleware,
  type AuthConfig,
  type AuthenticatedRequest,
  type JWTPayload,
  type APIKeyData,
} from '../auth/phase6-auth';

// =============================================================================
// Secrets Management
// =============================================================================

export {
  VaultClient,
  VaultError,
  getVaultClient,
  loadSecretsToEnv,
  getDynamicConnectionString,
  type VaultConfig,
  type VaultSecret,
} from '../secrets/vault-client';

// =============================================================================
// Feature Flags
// =============================================================================

export {
  featureFlags,
  evaluateFlag,
  isEnabled,
  getVariant,
  PHASE6_FLAGS,
  type FeatureFlag,
  type EvaluationContext,
  type FlagEvaluation,
} from '../feature-flags/phase6-flags';

// =============================================================================
// SLA Monitoring
// =============================================================================

export {
  slaMonitor,
  recordMetric,
  recordAvailability,
  recordLatency,
  recordError,
  calculateSLOStatus,
  getAllSLOStatuses,
  generateSLAReport,
  PHASE6_SLOS,
  type SLODefinition,
  type SLOStatus,
  type SLAReport,
  type IncidentSummary,
} from '../monitoring/sla-monitor';

// =============================================================================
// Contract Testing
// =============================================================================

export {
  pactContracts,
  PHASE6_CONTRACTS,
  Matchers,
  verifyResponse,
  runContractTests,
  publishContract,
  type PactContract,
  type PactInteraction,
  type VerificationResult,
  type ContractTestResults,
} from '../testing/pact-contracts';

// =============================================================================
// Backup & Disaster Recovery
// =============================================================================

export {
  backupRecovery,
  BackupManager,
  RestoreManager,
  DRExecutor,
  PHASE6_DR_PLAN,
  type BackupConfig,
  type BackupJob,
  type BackupManifest,
  type RestoreJob,
  type DisasterRecoveryPlan,
} from '../operations/backup-recovery';

// =============================================================================
// Compliance Framework
// =============================================================================

export {
  complianceFramework,
  ComplianceManager,
  SOC2_CONTROLS,
  HIPAA_CONTROLS,
  GDPR_CONTROLS,
  PHASE6_PROCESSING_RECORDS,
  type ComplianceControl,
  type ComplianceAudit,
  type AuditFinding,
  type DataProcessingRecord,
  type PrivacyImpactAssessment,
} from '../compliance/compliance-framework';

// =============================================================================
// Incident Response
// =============================================================================

export {
  incidentRunbooks,
  IncidentManager,
  PHASE6_RUNBOOKS,
  type Runbook,
  type RunbookStep,
  type EscalationPolicy,
  type Incident,
} from '../operations/incident-runbooks';

// =============================================================================
// Health Checks
// =============================================================================

export {
  healthChecks,
  HealthCheckManager,
  createHealthHandler,
  type HealthStatus,
  type HealthCheckResult,
  type SystemHealth,
  type DependencyHealth,
} from '../health/health-checks';

// =============================================================================
// Admin CLI
// =============================================================================

export {
  adminCli,
  CLI,
  COMMANDS,
  formatters,
  type CLICommand,
  type CLIResult,
  type CLIArgs,
  type CLIOptions,
} from '../cli/admin-cli';

// =============================================================================
// Enterprise Bundle
// =============================================================================

/**
 * Initialize all enterprise features
 */
export async function initializeEnterprise(config?: {
  database?: boolean;
  vault?: boolean;
  healthChecks?: boolean;
}): Promise<{
  database?: ReturnType<typeof getDatabase>;
  vault?: VaultClient;
  health?: HealthCheckManager;
}> {
  const result: {
    database?: ReturnType<typeof getDatabase>;
    vault?: VaultClient;
    health?: HealthCheckManager;
  } = {};

  if (config?.database !== false) {
    result.database = getDatabase();
  }

  if (config?.vault !== false) {
    result.vault = getVaultClient();
  }

  if (config?.healthChecks !== false) {
    result.health = new HealthCheckManager();
  }

  return result;
}

/**
 * Enterprise feature summary
 */
export const enterpriseFeatures = {
  database: {
    name: 'Database Integration',
    description: 'Production PostgreSQL with connection pooling, retries, and health checks',
    modules: ['DatabaseClient', 'Repository', 'Phase6Repositories'],
  },
  auth: {
    name: 'Authentication & Authorization',
    description: 'JWT tokens, API keys, OAuth integration, and RBAC',
    modules: ['createJWT', 'verifyJWT', 'createAPIKey', 'withAuth', 'requirePermission'],
  },
  secrets: {
    name: 'Secrets Management',
    description: 'HashiCorp Vault integration for secure secrets management',
    modules: ['VaultClient', 'loadSecretsToEnv', 'getDynamicConnectionString'],
  },
  featureFlags: {
    name: 'Feature Flags',
    description: 'Gradual rollouts, A/B testing, and user targeting',
    modules: ['evaluateFlag', 'isEnabled', 'getVariant', 'PHASE6_FLAGS'],
  },
  sla: {
    name: 'SLA Monitoring',
    description: 'SLO tracking, error budgets, and incident management',
    modules: ['slaMonitor', 'generateSLAReport', 'PHASE6_SLOS'],
  },
  contracts: {
    name: 'Contract Testing',
    description: 'Consumer-driven contract testing with Pact',
    modules: ['pactContracts', 'runContractTests', 'publishContract'],
  },
  backup: {
    name: 'Backup & DR',
    description: 'Backup management and disaster recovery procedures',
    modules: ['BackupManager', 'RestoreManager', 'DRExecutor', 'PHASE6_DR_PLAN'],
  },
  compliance: {
    name: 'Compliance Framework',
    description: 'SOC2, HIPAA, and GDPR compliance controls',
    modules: ['ComplianceManager', 'SOC2_CONTROLS', 'HIPAA_CONTROLS', 'GDPR_CONTROLS'],
  },
  incidents: {
    name: 'Incident Response',
    description: 'Standardized runbooks and incident management',
    modules: ['IncidentManager', 'PHASE6_RUNBOOKS'],
  },
  health: {
    name: 'Health Checks',
    description: 'Comprehensive health checks for all dependencies',
    modules: ['HealthCheckManager', 'createHealthHandler'],
  },
  cli: {
    name: 'Admin CLI',
    description: 'Command-line interface for operations',
    modules: ['CLI', 'COMMANDS', 'formatters'],
  },
};
