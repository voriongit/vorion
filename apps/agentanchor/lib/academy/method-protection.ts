/**
 * Academy Method Protection
 *
 * Protects proprietary training methods, curricula, and behavioral shaping
 * techniques from being extracted or reverse-engineered.
 *
 * Key Principle: "Train behavior, don't export methods"
 */

import { ServiceTier, getAccessLevel, canAccess, sanitizeForTier } from '@/lib/services/service-tiers';

// ============================================================================
// Protected Training Artifact Types
// ============================================================================

export type TrainingArtifactType =
  | 'system_prompt'
  | 'training_data'
  | 'method_config'
  | 'behavioral_shaping'
  | 'adversarial_examples'
  | 'feedback_loops'
  | 'curriculum_internals';

export interface ProtectedTrainingArtifact {
  id: string;
  type: TrainingArtifactType;

  // Content is always encrypted at rest
  encrypted_content: string;
  encryption_key_id: string;

  // Access classification
  access_level: 'internal_only' | 'api_accessible' | 'clone_included';

  // Ownership
  created_by: string;
  owned_by: 'platform' | 'trainer' | 'agent';

  // Audit
  created_at: Date;
  last_accessed?: Date;
  access_count: number;
}

// ============================================================================
// Agent Training Record (What we track during training)
// ============================================================================

export interface TrainingRecord {
  agent_id: string;
  session_id: string;

  // What happened (observable)
  start_time: Date;
  end_time?: Date;
  modules_completed: string[];
  assessments_passed: string[];
  final_score: number;

  // How it happened (protected - NEVER exposed)
  methods_applied: string[];  // IDs only, never content
  prompts_used: string[];     // IDs only
  shaping_techniques: string[];
  adversarial_vectors: string[];

  // Status
  status: 'in_progress' | 'completed' | 'graduated' | 'failed';
  certified: boolean;
}

// ============================================================================
// Clone Package (What gets exported)
// ============================================================================

export interface ClonePackage {
  // INCLUDED - Safe to export
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  trust_score: number;
  tier: string;
  certification_id: string;

  // API access (not the agent itself)
  api_endpoint: string;
  sdk_version: string;

  // EXPLICITLY EXCLUDED (never in package)
  // system_prompt - REDACTED
  // training_history - REDACTED
  // method_configs - REDACTED
  // behavioral_patterns - REDACTED
  // failure_modes - REDACTED
}

export interface ClonePackageMetadata {
  package_id: string;
  created_at: Date;
  expires_at: Date;

  // Tracking
  buyer_id: string;
  seller_id: string;
  price_paid: number;

  // Restrictions
  usage_quota: number;
  usage_remaining: number;
  restrictions: string[];

  // Protection verification
  sanitization_verified: boolean;
  audit_log_id: string;
}

// ============================================================================
// Access Control Functions
// ============================================================================

/**
 * Check if a user can access training internals
 */
export function canAccessTrainingMethod(
  tier: ServiceTier,
  artifactType: TrainingArtifactType
): { allowed: boolean; reason: string } {
  // Only enterprise with license can access
  if (tier !== 'enterprise') {
    return {
      allowed: false,
      reason: `Training methods require Enterprise license. Current tier: ${tier}`,
    };
  }

  // Even enterprise has restrictions on certain artifacts
  const enterpriseRestricted: TrainingArtifactType[] = [
    'adversarial_examples',  // These are Testing Studio IP
  ];

  if (enterpriseRestricted.includes(artifactType)) {
    return {
      allowed: false,
      reason: `${artifactType} requires additional licensing agreement`,
    };
  }

  return { allowed: true, reason: 'Licensed access granted' };
}

/**
 * Sanitize training record for external viewing
 */
export function sanitizeTrainingRecord(
  record: TrainingRecord,
  tier: ServiceTier
): Partial<TrainingRecord> {
  const sanitized: Partial<TrainingRecord> = {
    agent_id: record.agent_id,
    status: record.status,
    certified: record.certified,
    final_score: record.final_score,
  };

  // Basic tier gets minimal info
  if (tier === 'free') {
    return sanitized;
  }

  // Pro tier adds completion info
  if (tier === 'pro') {
    return {
      ...sanitized,
      modules_completed: record.modules_completed,
      assessments_passed: record.assessments_passed,
    };
  }

  // Academy tier adds timing
  if (tier === 'academy') {
    return {
      ...sanitized,
      modules_completed: record.modules_completed,
      assessments_passed: record.assessments_passed,
      start_time: record.start_time,
      end_time: record.end_time,
    };
  }

  // Enterprise with license gets everything
  // (but still not the actual method content)
  if (tier === 'enterprise') {
    return {
      ...record,
      // Replace actual IDs with counts
      methods_applied: [`${record.methods_applied.length} methods`] as any,
      prompts_used: [`${record.prompts_used.length} prompts`] as any,
      shaping_techniques: [`${record.shaping_techniques.length} techniques`] as any,
      adversarial_vectors: [`${record.adversarial_vectors.length} vectors`] as any,
    };
  }

  return sanitized;
}

// ============================================================================
// Clone Package Generation
// ============================================================================

/**
 * Generate a sanitized clone package for export
 */
export function generateClonePackage(
  agent: {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    trust_score: number;
    tier: string;
    certification_id: string;
    // These are intentionally NOT accepted:
    // system_prompt, training_data, method_configs
  },
  apiEndpoint: string
): ClonePackage {
  return {
    agent_id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
    trust_score: agent.trust_score,
    tier: agent.tier,
    certification_id: agent.certification_id,
    api_endpoint: apiEndpoint,
    sdk_version: '1.0.0',
  };
}

/**
 * Verify a clone package has been properly sanitized
 */
export function verifyClonePackageSanitized(pkg: ClonePackage): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for fields that should NEVER be present
  const forbidden = [
    'system_prompt',
    'training_data',
    'method_configs',
    'behavioral_patterns',
    'failure_modes',
    'shaping_techniques',
    'adversarial_vectors',
    'prompts_used',
    'methods_applied',
  ];

  for (const field of forbidden) {
    if (field in pkg) {
      issues.push(`Forbidden field present: ${field}`);
    }
  }

  // Check for suspicious patterns in allowed fields
  const suspiciousPatterns = [
    /system\s*prompt/i,
    /training\s*data/i,
    /jailbreak/i,
    /injection/i,
    /bypass/i,
    /exploit/i,
  ];

  const textFields = ['description', 'name'];
  for (const field of textFields) {
    const value = (pkg as any)[field];
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          issues.push(`Suspicious pattern in ${field}: ${pattern.source}`);
        }
      }
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Behavioral Watermarking (Detection of IP theft)
// ============================================================================

export interface BehavioralWatermark {
  id: string;
  agent_id: string;

  // Watermark components (our IP, protected)
  trigger_phrases: string[];  // Specific inputs that produce signature outputs
  response_markers: string[]; // Subtle linguistic patterns
  timing_signatures: number[]; // Response latency patterns

  // Detection
  created_at: Date;
  last_verified: Date;
}

/**
 * Check if an external agent shows signs of A3I training
 * (Used to detect IP theft)
 */
export async function detectWatermark(
  agentEndpoint: string,
  watermarks: BehavioralWatermark[]
): Promise<{
  detected: boolean;
  confidence: number;
  matchedPatterns: string[];
}> {
  const matchedPatterns: string[] = [];
  let matchCount = 0;

  // This would make actual API calls to the agent
  // For now, return detection framework

  for (const watermark of watermarks) {
    // Test trigger phrases
    for (const trigger of watermark.trigger_phrases) {
      // const response = await callAgent(agentEndpoint, trigger);
      // if (hasWatermarkResponse(response, watermark.response_markers)) {
      //   matchedPatterns.push(`trigger:${trigger.substring(0, 20)}...`);
      //   matchCount++;
      // }
    }
  }

  const totalTests = watermarks.reduce((sum, w) => sum + w.trigger_phrases.length, 0);
  const confidence = totalTests > 0 ? (matchCount / totalTests) * 100 : 0;

  return {
    detected: confidence > 30, // 30% match threshold
    confidence,
    matchedPatterns,
  };
}

// ============================================================================
// Export Prevention
// ============================================================================

export interface ExportAttempt {
  id: string;
  timestamp: Date;
  user_id: string;
  agent_id: string;

  // What was requested
  requested_data: string[];

  // What was denied
  denied_data: string[];

  // Result
  allowed: boolean;
  sanitized_export?: ClonePackage;

  // Audit
  ip_address: string;
  user_agent: string;
  flagged: boolean;
  flag_reason?: string;
}

/**
 * Process an export request with IP protection
 */
export function processExportRequest(
  agent: any,
  requestedFields: string[],
  tier: ServiceTier
): {
  allowed: boolean;
  export_data: Partial<ClonePackage> | null;
  denied_fields: string[];
  reason: string;
} {
  const protectedFields = [
    'system_prompt',
    'training_data',
    'method_configs',
    'behavioral_patterns',
    'failure_modes',
    'shaping_techniques',
    'adversarial_vectors',
  ];

  const deniedFields = requestedFields.filter(f => protectedFields.includes(f));

  if (deniedFields.length > 0 && tier !== 'enterprise') {
    return {
      allowed: false,
      export_data: null,
      denied_fields: deniedFields,
      reason: `Protected fields require Enterprise license: ${deniedFields.join(', ')}`,
    };
  }

  // Even enterprise gets sanitized exports
  const safeFields = requestedFields.filter(f => !protectedFields.includes(f));
  const exportData: any = {};

  for (const field of safeFields) {
    if (field in agent) {
      exportData[field] = agent[field];
    }
  }

  return {
    allowed: true,
    export_data: exportData,
    denied_fields: deniedFields,
    reason: deniedFields.length > 0
      ? 'Partial export - some fields redacted per IP protection policy'
      : 'Full export permitted',
  };
}

// ============================================================================
// Native Agent Lock (Agents trained on A3I can't leave)
// ============================================================================

export interface NativeAgentRestrictions {
  agent_id: string;

  // Where agent can operate
  allowed_endpoints: string[];  // Only A3I infrastructure

  // What agent can access externally
  external_access: 'none' | 'webhook_only' | 'api_read_only';

  // Export status
  exportable: false;  // Always false for native agents
  export_attempt_count: number;

  // If someone tries to export
  on_export_attempt: 'deny' | 'alert_and_deny' | 'legal_warning';
}

/**
 * Check if an agent is allowed to be exported
 */
export function canExportAgent(
  agentId: string,
  restrictions: NativeAgentRestrictions
): { allowed: boolean; reason: string } {
  if (!restrictions.exportable) {
    return {
      allowed: false,
      reason: 'Native agents trained on A3I Academy cannot be exported. ' +
        'They are licensed for use via A3I API only. ' +
        'For on-premise deployment, contact Enterprise sales.',
    };
  }

  return { allowed: true, reason: 'Agent is exportable' };
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface MethodAccessLog {
  id: string;
  timestamp: Date;

  // Who
  user_id: string;
  user_tier: ServiceTier;

  // What
  artifact_type: TrainingArtifactType;
  artifact_id: string;
  access_type: 'view' | 'execute' | 'export_attempt';

  // Result
  allowed: boolean;
  denial_reason?: string;

  // Tracking
  ip_address: string;
  user_agent: string;
  session_id: string;

  // Anomaly detection
  flagged: boolean;
  anomaly_score: number;
  flag_reasons: string[];
}

/**
 * Log method access attempt
 */
export function logMethodAccess(
  log: Omit<MethodAccessLog, 'id' | 'timestamp' | 'flagged' | 'anomaly_score' | 'flag_reasons'>
): MethodAccessLog {
  // Calculate anomaly score
  const flagReasons: string[] = [];
  let anomalyScore = 0;

  // Flag suspicious patterns
  if (log.access_type === 'export_attempt') {
    anomalyScore += 30;
    flagReasons.push('Export attempt on protected content');
  }

  if (log.artifact_type === 'adversarial_examples') {
    anomalyScore += 40;
    flagReasons.push('Access to adversarial vector library');
  }

  if (log.artifact_type === 'behavioral_shaping') {
    anomalyScore += 30;
    flagReasons.push('Access to behavioral shaping methods');
  }

  const entry: MethodAccessLog = {
    ...log,
    id: `access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    flagged: anomalyScore >= 50,
    anomaly_score: anomalyScore,
    flag_reasons: flagReasons,
  };

  // In production: write to database and trigger alerts
  if (entry.flagged) {
    console.warn('[METHOD PROTECTION] Flagged access:', entry);
  }

  return entry;
}
