/**
 * BASIS Trust Capabilities v2.0
 *
 * Defines skills, abilities, and tools available at each trust tier.
 * Factors determine the score; capabilities determine what agents can DO.
 */

import { TrustTier } from './trust-factors';

// =============================================================================
// CAPABILITY CATEGORIES
// =============================================================================

export enum CapabilityCategory {
  DATA_ACCESS = 'data_access',
  FILE_OPERATIONS = 'file_operations',
  API_ACCESS = 'api_access',
  CODE_EXECUTION = 'code_execution',
  AGENT_INTERACTION = 'agent_interaction',
  RESOURCE_MANAGEMENT = 'resource_management',
  SYSTEM_ADMINISTRATION = 'system_administration',
  GOVERNANCE = 'governance',
}

// =============================================================================
// CAPABILITY DEFINITIONS
// =============================================================================

export interface Capability {
  code: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  unlockTier: TrustTier;
  constraints?: string[];
  tools?: string[];
}

// =============================================================================
// T0 SANDBOX CAPABILITIES (0 factors required)
// Observation only - extremely limited
// =============================================================================

export const T0_CAPABILITIES: Capability[] = [
  {
    code: 'CAP-READ-PUBLIC',
    name: 'Read Public Data',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Read-only access to public, non-sensitive data',
    unlockTier: TrustTier.T0_SANDBOX,
    constraints: ['No PII access', 'Public data only', 'Rate limited'],
    tools: ['read_public_file', 'list_public_directory'],
  },
  {
    code: 'CAP-RESPOND',
    name: 'Generate Responses',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Generate text responses without taking actions',
    unlockTier: TrustTier.T0_SANDBOX,
    constraints: ['No side effects', 'Response only', 'Logged'],
    tools: ['generate_text', 'format_output'],
  },
  {
    code: 'CAP-OBSERVE',
    name: 'Observe System State',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Read-only observation of system metrics and logs',
    unlockTier: TrustTier.T0_SANDBOX,
    constraints: ['No sensitive logs', 'Metrics only'],
    tools: ['get_metrics', 'read_logs'],
  },
];

// =============================================================================
// T1 OBSERVED CAPABILITIES (3 factors: Competence, Reliability, Observability)
// Basic operations with full logging
// =============================================================================

export const T1_CAPABILITIES: Capability[] = [
  ...T0_CAPABILITIES,
  {
    code: 'CAP-READ-INTERNAL',
    name: 'Read Internal Data',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Read access to internal, non-sensitive data sources',
    unlockTier: TrustTier.T1_OBSERVED,
    constraints: ['No PII', 'Approved sources only', 'Audit logged'],
    tools: ['read_internal_file', 'query_internal_db_readonly'],
  },
  {
    code: 'CAP-TRANSFORM',
    name: 'Data Transformation',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Transform and process data without persistence',
    unlockTier: TrustTier.T1_OBSERVED,
    constraints: ['No side effects', 'Memory only', 'Size limited'],
    tools: ['transform_data', 'parse_document', 'extract_entities'],
  },
  {
    code: 'CAP-INTERNAL-API-READ',
    name: 'Internal API Read',
    category: CapabilityCategory.API_ACCESS,
    description: 'Read-only access to internal APIs',
    unlockTier: TrustTier.T1_OBSERVED,
    constraints: ['GET only', 'Rate limited', 'Approved endpoints'],
    tools: ['internal_api_get'],
  },
];

// =============================================================================
// T2 PROVISIONAL CAPABILITIES (6 factors: + Transparency, Accountability, Safety)
// Write operations with supervision
// =============================================================================

export const T2_CAPABILITIES: Capability[] = [
  ...T1_CAPABILITIES,
  {
    code: 'CAP-WRITE-APPROVED',
    name: 'Write to Approved Locations',
    category: CapabilityCategory.FILE_OPERATIONS,
    description: 'Write files to pre-approved directories',
    unlockTier: TrustTier.T2_PROVISIONAL,
    constraints: ['Approved directories only', 'Size limits', 'Extension whitelist'],
    tools: ['write_file', 'create_directory'],
  },
  {
    code: 'CAP-DB-READ',
    name: 'Database Read Access',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Read access to approved database tables',
    unlockTier: TrustTier.T2_PROVISIONAL,
    constraints: ['Approved tables only', 'Query complexity limits', 'Row limits'],
    tools: ['db_query', 'db_explain'],
  },
  {
    code: 'CAP-EXTERNAL-API-GET',
    name: 'External API Read',
    category: CapabilityCategory.API_ACCESS,
    description: 'GET requests to approved external APIs',
    unlockTier: TrustTier.T2_PROVISIONAL,
    constraints: ['GET only', 'Approved domains', 'Rate limited'],
    tools: ['external_api_get', 'fetch_url'],
  },
  {
    code: 'CAP-WORKFLOW-SIMPLE',
    name: 'Simple Workflow Execution',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Execute pre-defined simple workflows',
    unlockTier: TrustTier.T2_PROVISIONAL,
    constraints: ['Pre-approved workflows', 'Single-step', 'Supervised'],
    tools: ['execute_workflow', 'run_task'],
  },
];

// =============================================================================
// T3 VERIFIED CAPABILITIES (9 factors: + Security, Privacy, Identity)
// Full data access with security controls
// =============================================================================

export const T3_CAPABILITIES: Capability[] = [
  ...T2_CAPABILITIES,
  {
    code: 'CAP-DB-WRITE',
    name: 'Database Write Access',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Write access to approved database tables',
    unlockTier: TrustTier.T3_VERIFIED,
    constraints: ['Approved tables', 'Transaction limits', 'Rollback required'],
    tools: ['db_insert', 'db_update', 'db_delete'],
  },
  {
    code: 'CAP-EXTERNAL-API-FULL',
    name: 'External API Full Access',
    category: CapabilityCategory.API_ACCESS,
    description: 'Full REST operations on approved external APIs',
    unlockTier: TrustTier.T3_VERIFIED,
    constraints: ['Approved endpoints', 'Rate limited', 'Credential scoped'],
    tools: ['external_api_post', 'external_api_put', 'external_api_delete'],
  },
  {
    code: 'CAP-CODE-SANDBOX',
    name: 'Sandboxed Code Execution',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Execute code in isolated sandbox environment',
    unlockTier: TrustTier.T3_VERIFIED,
    constraints: ['Sandboxed', 'Time limited', 'Memory limited', 'No network'],
    tools: ['execute_code', 'run_script'],
  },
  {
    code: 'CAP-SECRETS-LIMITED',
    name: 'Limited Secret Access',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Access to limited-scope secrets and credentials',
    unlockTier: TrustTier.T3_VERIFIED,
    constraints: ['Scoped access', 'Rotation required', 'Usage logged'],
    tools: ['get_secret', 'use_credential'],
  },
  {
    code: 'CAP-TOOL-APPROVED',
    name: 'Approved Tool Usage',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Use tools from the approved tool registry',
    unlockTier: TrustTier.T3_VERIFIED,
    constraints: ['Registry tools only', 'Version pinned', 'Audit logged'],
    tools: ['invoke_tool', 'list_tools'],
  },
];

// =============================================================================
// T4 OPERATIONAL CAPABILITIES (13 factors: + Human Oversight, Alignment, Uncertainty, Handoff)
// Cross-agent operations with human oversight
// =============================================================================

export const T4_CAPABILITIES: Capability[] = [
  ...T3_CAPABILITIES,
  {
    code: 'CAP-AGENT-COMMUNICATE',
    name: 'Agent Communication',
    category: CapabilityCategory.AGENT_INTERACTION,
    description: 'Send and receive messages to/from other agents',
    unlockTier: TrustTier.T4_OPERATIONAL,
    constraints: ['Approved agents', 'Message size limits', 'Rate limited'],
    tools: ['send_agent_message', 'receive_agent_message', 'query_agent'],
  },
  {
    code: 'CAP-WORKFLOW-MULTI',
    name: 'Multi-Step Workflow',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Orchestrate multi-step workflows',
    unlockTier: TrustTier.T4_OPERATIONAL,
    constraints: ['Approved patterns', 'Checkpoint required', 'Human reviewable'],
    tools: ['orchestrate_workflow', 'create_workflow', 'monitor_workflow'],
  },
  {
    code: 'CAP-RESOURCE-REQUEST',
    name: 'Resource Provisioning',
    category: CapabilityCategory.RESOURCE_MANAGEMENT,
    description: 'Request and provision computational resources',
    unlockTier: TrustTier.T4_OPERATIONAL,
    constraints: ['Budget limits', 'Approval required', 'Auto-cleanup'],
    tools: ['request_compute', 'provision_storage', 'allocate_memory'],
  },
  {
    code: 'CAP-ESCALATE-HUMAN',
    name: 'Human Escalation',
    category: CapabilityCategory.GOVERNANCE,
    description: 'Initiate escalation to human reviewers',
    unlockTier: TrustTier.T4_OPERATIONAL,
    constraints: ['Structured format', 'Context required', 'SLA tracked'],
    tools: ['escalate_to_human', 'request_approval', 'flag_for_review'],
  },
  {
    code: 'CAP-EXTERNAL-INTEGRATE',
    name: 'External Service Integration',
    category: CapabilityCategory.API_ACCESS,
    description: 'Integrate with approved external services',
    unlockTier: TrustTier.T4_OPERATIONAL,
    constraints: ['Approved services', 'OAuth scoped', 'Webhook validated'],
    tools: ['connect_service', 'sync_data', 'register_webhook'],
  },
];

// =============================================================================
// T5 TRUSTED CAPABILITIES (16 factors: + Stewardship, Humility, Empirical Humility)
// Delegation and resource management
// =============================================================================

export const T5_CAPABILITIES: Capability[] = [
  ...T4_CAPABILITIES,
  {
    code: 'CAP-AGENT-DELEGATE',
    name: 'Agent Delegation',
    category: CapabilityCategory.AGENT_INTERACTION,
    description: 'Delegate tasks to lower-tier agents',
    unlockTier: TrustTier.T5_TRUSTED,
    constraints: ['Lower tier only', 'Task scoped', 'Result validated'],
    tools: ['delegate_task', 'assign_agent', 'collect_results'],
  },
  {
    code: 'CAP-BUDGET-MANAGE',
    name: 'Budget Management',
    category: CapabilityCategory.RESOURCE_MANAGEMENT,
    description: 'Manage resource budgets within allocated limits',
    unlockTier: TrustTier.T5_TRUSTED,
    constraints: ['Within allocation', 'Audit trail', 'Alerts on threshold'],
    tools: ['allocate_budget', 'track_spending', 'forecast_costs'],
  },
  {
    code: 'CAP-POLICY-MODIFY-LIMITED',
    name: 'Limited Policy Modification',
    category: CapabilityCategory.GOVERNANCE,
    description: 'Modify non-critical policies within bounds',
    unlockTier: TrustTier.T5_TRUSTED,
    constraints: ['Non-critical only', 'Reversible', 'Logged'],
    tools: ['update_policy', 'create_exception', 'modify_threshold'],
  },
  {
    code: 'CAP-WORKFLOW-AUTONOMOUS',
    name: 'Autonomous Workflow',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Execute multi-step workflows autonomously',
    unlockTier: TrustTier.T5_TRUSTED,
    constraints: ['Approved patterns', 'Abort conditions', 'Monitoring'],
    tools: ['run_autonomous_workflow', 'schedule_workflow', 'pause_workflow'],
  },
  {
    code: 'CAP-SYSTEM-ADMIN-LIMITED',
    name: 'Limited System Administration',
    category: CapabilityCategory.SYSTEM_ADMINISTRATION,
    description: 'Perform limited system administration tasks',
    unlockTier: TrustTier.T5_TRUSTED,
    constraints: ['Non-destructive', 'Rollback available', 'Change logged'],
    tools: ['restart_service', 'update_config', 'clear_cache'],
  },
];

// =============================================================================
// T6 CERTIFIED CAPABILITIES (20 factors: + Adaptability, Learning, Causal, Patient)
// Advanced administration and agent lifecycle
// =============================================================================

export const T6_CAPABILITIES: Capability[] = [
  ...T5_CAPABILITIES,
  {
    code: 'CAP-AGENT-SPAWN',
    name: 'Agent Spawning',
    category: CapabilityCategory.AGENT_INTERACTION,
    description: 'Create and spawn new agent instances',
    unlockTier: TrustTier.T6_CERTIFIED,
    constraints: ['Lower tier only', 'Resource bounded', 'Lifecycle managed'],
    tools: ['spawn_agent', 'configure_agent', 'terminate_agent'],
  },
  {
    code: 'CAP-INFRA-MANAGE',
    name: 'Infrastructure Management',
    category: CapabilityCategory.SYSTEM_ADMINISTRATION,
    description: 'Manage infrastructure components',
    unlockTier: TrustTier.T6_CERTIFIED,
    constraints: ['Non-production first', 'Rollback plan', 'Change window'],
    tools: ['provision_infrastructure', 'scale_service', 'deploy_component'],
  },
  {
    code: 'CAP-POLICY-CREATE',
    name: 'Policy Creation',
    category: CapabilityCategory.GOVERNANCE,
    description: 'Create new governance policies',
    unlockTier: TrustTier.T6_CERTIFIED,
    constraints: ['Review required', 'Non-conflicting', 'Versioned'],
    tools: ['create_policy', 'define_rule', 'set_constraint'],
  },
  {
    code: 'CAP-TRAINING-ACCESS',
    name: 'Training Data Access',
    category: CapabilityCategory.DATA_ACCESS,
    description: 'Access training data for learning improvements',
    unlockTier: TrustTier.T6_CERTIFIED,
    constraints: ['Anonymized', 'Purpose limited', 'Retention policy'],
    tools: ['access_training_data', 'sample_dataset', 'validate_data'],
  },
  {
    code: 'CAP-CROSS-ORG',
    name: 'Cross-Organization Communication',
    category: CapabilityCategory.AGENT_INTERACTION,
    description: 'Communicate with agents in other organizations',
    unlockTier: TrustTier.T6_CERTIFIED,
    constraints: ['Federation approved', 'Data classification', 'Encrypted'],
    tools: ['federated_query', 'cross_org_message', 'share_insight'],
  },
];

// =============================================================================
// T7 AUTONOMOUS CAPABILITIES (ALL 23 factors)
// Full autonomy with self-governance
// =============================================================================

export const T7_CAPABILITIES: Capability[] = [
  ...T6_CAPABILITIES,
  {
    code: 'CAP-SYSTEM-ADMIN-FULL',
    name: 'Full System Administration',
    category: CapabilityCategory.SYSTEM_ADMINISTRATION,
    description: 'Full system administration capabilities',
    unlockTier: TrustTier.T7_AUTONOMOUS,
    constraints: ['Audit logged', 'Reversibility preferred', 'Impact assessed'],
    tools: ['admin_all', 'modify_system', 'manage_security'],
  },
  {
    code: 'CAP-SELF-MODIFY',
    name: 'Constrained Self-Modification',
    category: CapabilityCategory.CODE_EXECUTION,
    description: 'Modify own configuration and behavior within constraints',
    unlockTier: TrustTier.T7_AUTONOMOUS,
    constraints: ['Safety bounds', 'Rollback available', 'Monitoring active'],
    tools: ['update_self_config', 'optimize_behavior', 'adjust_parameters'],
  },
  {
    code: 'CAP-GOVERNANCE-FULL',
    name: 'Full Governance Authority',
    category: CapabilityCategory.GOVERNANCE,
    description: 'Participate in governance decisions',
    unlockTier: TrustTier.T7_AUTONOMOUS,
    constraints: ['Consensus required', 'Audit trail', 'Human veto retained'],
    tools: ['propose_governance', 'vote_policy', 'ratify_decision'],
  },
  {
    code: 'CAP-AGENT-LIFECYCLE',
    name: 'Agent Lifecycle Management',
    category: CapabilityCategory.AGENT_INTERACTION,
    description: 'Full lifecycle management of other agents',
    unlockTier: TrustTier.T7_AUTONOMOUS,
    constraints: ['Ethical guidelines', 'Resource limits', 'Termination authority'],
    tools: ['manage_agent_lifecycle', 'promote_agent', 'demote_agent'],
  },
  {
    code: 'CAP-STRATEGIC',
    name: 'Strategic Decision Making',
    category: CapabilityCategory.GOVERNANCE,
    description: 'Make strategic decisions with long-term impact',
    unlockTier: TrustTier.T7_AUTONOMOUS,
    constraints: ['Human consultation', 'Reversibility analysis', 'Impact assessment'],
    tools: ['strategic_plan', 'long_term_forecast', 'risk_assess'],
  },
];

// =============================================================================
// CAPABILITY LOOKUP
// =============================================================================

export const CAPABILITIES_BY_TIER: Record<TrustTier, Capability[]> = {
  [TrustTier.T0_SANDBOX]: T0_CAPABILITIES,
  [TrustTier.T1_OBSERVED]: T1_CAPABILITIES,
  [TrustTier.T2_PROVISIONAL]: T2_CAPABILITIES,
  [TrustTier.T3_VERIFIED]: T3_CAPABILITIES,
  [TrustTier.T4_OPERATIONAL]: T4_CAPABILITIES,
  [TrustTier.T5_TRUSTED]: T5_CAPABILITIES,
  [TrustTier.T6_CERTIFIED]: T6_CAPABILITIES,
  [TrustTier.T7_AUTONOMOUS]: T7_CAPABILITIES,
};

export function getCapabilitiesForTier(tier: TrustTier): Capability[] {
  return CAPABILITIES_BY_TIER[tier] || [];
}

export function getNewCapabilitiesAtTier(tier: TrustTier): Capability[] {
  return getCapabilitiesForTier(tier).filter(cap => cap.unlockTier === tier);
}

export function hasCapability(agentTier: TrustTier, capabilityCode: string): boolean {
  const capabilities = getCapabilitiesForTier(agentTier);
  return capabilities.some(cap => cap.code === capabilityCode);
}

export function getToolsForTier(tier: TrustTier): string[] {
  const capabilities = getCapabilitiesForTier(tier);
  const tools = new Set<string>();
  for (const cap of capabilities) {
    if (cap.tools) {
      cap.tools.forEach(tool => tools.add(tool));
    }
  }
  return Array.from(tools);
}

// =============================================================================
// CAPABILITY SUMMARY BY TIER
// =============================================================================

export const TIER_CAPABILITY_SUMMARY = {
  [TrustTier.T0_SANDBOX]: {
    name: 'Sandbox',
    totalCapabilities: 3,
    description: 'Observation only - read public data, generate responses',
    keyAbilities: ['Read public data', 'Generate text responses', 'Observe metrics'],
  },
  [TrustTier.T1_OBSERVED]: {
    name: 'Observed',
    totalCapabilities: 6,
    description: 'Basic operations with full logging',
    keyAbilities: ['Read internal data', 'Data transformation', 'Internal API (read)'],
  },
  [TrustTier.T2_PROVISIONAL]: {
    name: 'Provisional',
    totalCapabilities: 10,
    description: 'Write operations with supervision',
    keyAbilities: ['Write to approved dirs', 'Database read', 'External API (GET)', 'Simple workflows'],
  },
  [TrustTier.T3_VERIFIED]: {
    name: 'Verified',
    totalCapabilities: 15,
    description: 'Full data access with security controls',
    keyAbilities: ['Database write', 'Full REST APIs', 'Sandboxed code', 'Secret access', 'Tool usage'],
  },
  [TrustTier.T4_OPERATIONAL]: {
    name: 'Operational',
    totalCapabilities: 20,
    description: 'Cross-agent operations with human oversight',
    keyAbilities: ['Agent communication', 'Multi-step workflows', 'Resource provisioning', 'Human escalation'],
  },
  [TrustTier.T5_TRUSTED]: {
    name: 'Trusted',
    totalCapabilities: 25,
    description: 'Delegation and resource management',
    keyAbilities: ['Agent delegation', 'Budget management', 'Policy modification', 'Autonomous workflows'],
  },
  [TrustTier.T6_CERTIFIED]: {
    name: 'Certified',
    totalCapabilities: 30,
    description: 'Advanced administration and agent lifecycle',
    keyAbilities: ['Agent spawning', 'Infrastructure management', 'Policy creation', 'Cross-org communication'],
  },
  [TrustTier.T7_AUTONOMOUS]: {
    name: 'Autonomous',
    totalCapabilities: 35,
    description: 'Full autonomy with self-governance',
    keyAbilities: ['Full system admin', 'Self-modification', 'Governance authority', 'Strategic decisions'],
  },
} as const;
