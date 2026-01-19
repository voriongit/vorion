/**
 * Aurais Agent ID Schema
 *
 * Agent ID Format: T.R.CC.II (6 digits, displayed as TRCCII)
 * - T:  Operating Tier (0-8)
 * - R:  Role/Type (1-9)
 * - CC: Category (10-99, with sub-category room)
 * - II: Instance (00=Genesis, 01-99=Spawned)
 *
 * HITL ID Format: 9.X.CC.I (4 digits, displayed as 9XCCI)
 * - 9:  HITL marker (always 9)
 * - X:  Authority level (9=CEO, 8=Exec, 7=Manager, etc.)
 * - CC: Area of guidance (01=All/General)
 * - I:  Instance
 */

// ============================================================================
// AGENT ROLE TYPES (R) - Single digit 1-9
// ============================================================================

export enum AgentRole {
  EXECUTOR = 1,       // Task execution, getting things done
  PLANNER = 2,        // Strategy and planning
  VALIDATOR = 3,      // Quality assurance, verification
  RESEARCHER = 4,     // Information gathering, analysis
  COMMUNICATOR = 5,   // Messaging, coordination, outreach
  ORCHESTRATOR = 6,   // Multi-agent coordination, workflow management
  // Reserved for future
  RESERVED_7 = 7,
  RESERVED_8 = 8,
  RESERVED_9 = 9,
}

export const AgentRoleLabels: Record<AgentRole, string> = {
  [AgentRole.EXECUTOR]: 'Executor',
  [AgentRole.PLANNER]: 'Planner',
  [AgentRole.VALIDATOR]: 'Validator',
  [AgentRole.RESEARCHER]: 'Researcher',
  [AgentRole.COMMUNICATOR]: 'Communicator',
  [AgentRole.ORCHESTRATOR]: 'Orchestrator',
  [AgentRole.RESERVED_7]: 'Reserved',
  [AgentRole.RESERVED_8]: 'Reserved',
  [AgentRole.RESERVED_9]: 'Reserved',
};

// ============================================================================
// AGENT CATEGORY TYPES (CC) - Two digits 10-99
// ============================================================================

export enum AgentCategory {
  // 10-19: Research & Analysis
  RESEARCH = 10,
  RESEARCH_MARKET = 11,
  RESEARCH_TECHNICAL = 12,
  RESEARCH_COMPETITIVE = 13,

  // 20-29: Content & Creative
  CONTENT = 20,
  CONTENT_WRITING = 21,
  CONTENT_SOCIAL = 22,
  CONTENT_DESIGN = 23,
  CONTENT_VIDEO = 24,

  // 30-39: Development & Technical
  DEVELOPMENT = 30,
  DEVELOPMENT_FRONTEND = 31,
  DEVELOPMENT_BACKEND = 32,
  DEVELOPMENT_DEVOPS = 33,
  DEVELOPMENT_QA = 34,
  DEVELOPMENT_SECURITY = 35,

  // 40-49: Social & Community
  SOCIAL = 40,
  SOCIAL_MONITORING = 41,
  SOCIAL_COMMUNITY = 42,
  SOCIAL_ENGAGEMENT = 43,

  // 50-59: Sales & Business Development
  SALES = 50,
  SALES_LEAD_GEN = 51,
  SALES_QUALIFICATION = 52,
  SALES_OUTREACH = 53,

  // 60-69: Support & Service
  SUPPORT = 60,
  SUPPORT_CUSTOMER = 61,
  SUPPORT_TECHNICAL = 62,
  SUPPORT_INTERNAL = 63,

  // 70-79: Operations & Administration
  OPERATIONS = 70,
  OPERATIONS_SCHEDULING = 71,
  OPERATIONS_INBOX = 72,
  OPERATIONS_WORKFLOW = 73,

  // 80-89: Analytics & Intelligence
  ANALYTICS = 80,
  ANALYTICS_METRICS = 81,
  ANALYTICS_REPORTING = 82,
  ANALYTICS_FORECASTING = 83,

  // 90-99: Executive & Strategy
  EXECUTIVE = 90,
  EXECUTIVE_COORDINATION = 91,
  EXECUTIVE_STRATEGY = 92,
  EXECUTIVE_GOVERNANCE = 93,
}

export const AgentCategoryLabels: Record<AgentCategory, string> = {
  [AgentCategory.RESEARCH]: 'Research',
  [AgentCategory.RESEARCH_MARKET]: 'Market Research',
  [AgentCategory.RESEARCH_TECHNICAL]: 'Technical Research',
  [AgentCategory.RESEARCH_COMPETITIVE]: 'Competitive Research',

  [AgentCategory.CONTENT]: 'Content',
  [AgentCategory.CONTENT_WRITING]: 'Content Writing',
  [AgentCategory.CONTENT_SOCIAL]: 'Social Content',
  [AgentCategory.CONTENT_DESIGN]: 'Design',
  [AgentCategory.CONTENT_VIDEO]: 'Video',

  [AgentCategory.DEVELOPMENT]: 'Development',
  [AgentCategory.DEVELOPMENT_FRONTEND]: 'Frontend Dev',
  [AgentCategory.DEVELOPMENT_BACKEND]: 'Backend Dev',
  [AgentCategory.DEVELOPMENT_DEVOPS]: 'DevOps',
  [AgentCategory.DEVELOPMENT_QA]: 'QA',
  [AgentCategory.DEVELOPMENT_SECURITY]: 'Security',

  [AgentCategory.SOCIAL]: 'Social',
  [AgentCategory.SOCIAL_MONITORING]: 'Social Monitoring',
  [AgentCategory.SOCIAL_COMMUNITY]: 'Community',
  [AgentCategory.SOCIAL_ENGAGEMENT]: 'Engagement',

  [AgentCategory.SALES]: 'Sales',
  [AgentCategory.SALES_LEAD_GEN]: 'Lead Generation',
  [AgentCategory.SALES_QUALIFICATION]: 'Lead Qualification',
  [AgentCategory.SALES_OUTREACH]: 'Sales Outreach',

  [AgentCategory.SUPPORT]: 'Support',
  [AgentCategory.SUPPORT_CUSTOMER]: 'Customer Support',
  [AgentCategory.SUPPORT_TECHNICAL]: 'Technical Support',
  [AgentCategory.SUPPORT_INTERNAL]: 'Internal Support',

  [AgentCategory.OPERATIONS]: 'Operations',
  [AgentCategory.OPERATIONS_SCHEDULING]: 'Scheduling',
  [AgentCategory.OPERATIONS_INBOX]: 'Inbox Management',
  [AgentCategory.OPERATIONS_WORKFLOW]: 'Workflow',

  [AgentCategory.ANALYTICS]: 'Analytics',
  [AgentCategory.ANALYTICS_METRICS]: 'Metrics',
  [AgentCategory.ANALYTICS_REPORTING]: 'Reporting',
  [AgentCategory.ANALYTICS_FORECASTING]: 'Forecasting',

  [AgentCategory.EXECUTIVE]: 'Executive',
  [AgentCategory.EXECUTIVE_COORDINATION]: 'Coordination',
  [AgentCategory.EXECUTIVE_STRATEGY]: 'Strategy',
  [AgentCategory.EXECUTIVE_GOVERNANCE]: 'Governance',
};

// ============================================================================
// HITL AUTHORITY LEVELS (X) - Single digit 1-9
// ============================================================================

export enum HITLAuthority {
  CEO = 9,            // Full authority, all areas
  EXECUTIVE = 8,      // Executive level
  DIRECTOR = 7,       // Department director
  MANAGER = 6,        // Team manager
  LEAD = 5,           // Team lead
  SENIOR = 4,         // Senior contributor
  STANDARD = 3,       // Standard user
  LIMITED = 2,        // Limited access
  OBSERVER = 1,       // View only
}

export const HITLAuthorityLabels: Record<HITLAuthority, string> = {
  [HITLAuthority.CEO]: 'CEO',
  [HITLAuthority.EXECUTIVE]: 'Executive',
  [HITLAuthority.DIRECTOR]: 'Director',
  [HITLAuthority.MANAGER]: 'Manager',
  [HITLAuthority.LEAD]: 'Lead',
  [HITLAuthority.SENIOR]: 'Senior',
  [HITLAuthority.STANDARD]: 'Standard',
  [HITLAuthority.LIMITED]: 'Limited',
  [HITLAuthority.OBSERVER]: 'Observer',
};

// ============================================================================
// HITL GUIDANCE AREAS (CC) - Two digits 01-99
// ============================================================================

export enum HITLArea {
  ALL = 1,              // General/All areas
  STRATEGY = 10,        // Strategic decisions
  FINANCE = 20,         // Financial oversight
  TECHNICAL = 30,       // Technical decisions
  PEOPLE = 40,          // HR/People decisions
  OPERATIONS = 50,      // Operational decisions
  SECURITY = 60,        // Security & compliance
  CUSTOMER = 70,        // Customer relations
  PRODUCT = 80,         // Product decisions
  GOVERNANCE = 90,      // Governance & policy
}

export const HITLAreaLabels: Record<HITLArea, string> = {
  [HITLArea.ALL]: 'All Areas',
  [HITLArea.STRATEGY]: 'Strategy',
  [HITLArea.FINANCE]: 'Finance',
  [HITLArea.TECHNICAL]: 'Technical',
  [HITLArea.PEOPLE]: 'People',
  [HITLArea.OPERATIONS]: 'Operations',
  [HITLArea.SECURITY]: 'Security',
  [HITLArea.CUSTOMER]: 'Customer',
  [HITLArea.PRODUCT]: 'Product',
  [HITLArea.GOVERNANCE]: 'Governance',
};

// ============================================================================
// STRUCTURED ID TYPES
// ============================================================================

/**
 * Parsed Agent ID structure
 */
export interface ParsedAgentId {
  type: 'AGENT';
  tier: number;           // 0-8
  role: AgentRole;        // 1-9
  category: AgentCategory; // 10-99
  instance: number;       // 00-99 (00 = genesis)
  isGenesis: boolean;
  raw: string;            // Original 6-digit string
}

/**
 * Parsed HITL ID structure
 */
export interface ParsedHITLId {
  type: 'HITL';
  authority: HITLAuthority; // 1-9
  area: HITLArea;           // 01-99
  instance: number;         // 1-9
  raw: string;              // Original 4-digit string
}

export type ParsedEntityId = ParsedAgentId | ParsedHITLId;

// ============================================================================
// ID GENERATION UTILITIES
// ============================================================================

/**
 * Generate a new Agent ID
 */
export function generateAgentId(
  tier: number,
  role: AgentRole,
  category: AgentCategory,
  instance: number
): string {
  if (tier < 0 || tier > 8) {
    throw new Error(`Invalid tier: ${tier}. Must be 0-8.`);
  }
  if (role < 1 || role > 9) {
    throw new Error(`Invalid role: ${role}. Must be 1-9.`);
  }
  if (category < 10 || category > 99) {
    throw new Error(`Invalid category: ${category}. Must be 10-99.`);
  }
  if (instance < 0 || instance > 99) {
    throw new Error(`Invalid instance: ${instance}. Must be 00-99.`);
  }

  const t = tier.toString();
  const r = role.toString();
  const cc = category.toString().padStart(2, '0');
  const ii = instance.toString().padStart(2, '0');

  return `${t}${r}${cc}${ii}`;
}

/**
 * Generate a genesis Agent ID (instance = 00)
 */
export function generateGenesisAgentId(
  tier: number,
  role: AgentRole,
  category: AgentCategory
): string {
  return generateAgentId(tier, role, category, 0);
}

/**
 * Generate a new HITL ID
 */
export function generateHITLId(
  authority: HITLAuthority,
  area: HITLArea,
  instance: number
): string {
  if (authority < 1 || authority > 9) {
    throw new Error(`Invalid authority: ${authority}. Must be 1-9.`);
  }
  if (area < 1 || area > 99) {
    throw new Error(`Invalid area: ${area}. Must be 01-99.`);
  }
  if (instance < 1 || instance > 9) {
    throw new Error(`Invalid instance: ${instance}. Must be 1-9.`);
  }

  const x = authority.toString();
  const cc = area.toString().padStart(2, '0');
  const i = instance.toString();

  return `9${x}${cc}${i}`;
}

// ============================================================================
// ID PARSING UTILITIES
// ============================================================================

/**
 * Parse any entity ID (Agent or HITL)
 */
export function parseEntityId(id: string): ParsedEntityId | null {
  if (!id || typeof id !== 'string') {
    return null;
  }

  // HITL IDs start with 9 and are 4 digits
  if (id.startsWith('9') && id.length === 4) {
    return parseHITLId(id);
  }

  // Agent IDs are 6 digits and don't start with 9
  if (id.length === 6 && !id.startsWith('9')) {
    return parseAgentId(id);
  }

  return null;
}

/**
 * Parse an Agent ID string
 */
export function parseAgentId(id: string): ParsedAgentId | null {
  if (!id || id.length !== 6) {
    return null;
  }

  const tierChar = id.charAt(0);
  const roleChar = id.charAt(1);
  const categoryStr = id.slice(2, 4);
  const instanceStr = id.slice(4, 6);

  const tier = parseInt(tierChar, 10);
  const role = parseInt(roleChar, 10) as AgentRole;
  const category = parseInt(categoryStr, 10) as AgentCategory;
  const instance = parseInt(instanceStr, 10);

  if (isNaN(tier) || isNaN(role) || isNaN(category) || isNaN(instance)) {
    return null;
  }

  if (tier < 0 || tier > 8) {
    return null;
  }

  return {
    type: 'AGENT',
    tier,
    role,
    category,
    instance,
    isGenesis: instance === 0,
    raw: id,
  };
}

/**
 * Parse a HITL ID string
 *
 * Format: 9XAI (4 digits)
 * - 9: HITL marker
 * - X: Authority level (1-9, 9=CEO)
 * - A: Area of guidance (0=All, 1-9 for specific areas)
 * - I: Instance number
 *
 * Example: 9901 = HITL + CEO(9) + All Areas(0) + Instance(1)
 */
export function parseHITLId(id: string): ParsedHITLId | null {
  if (!id || id.length !== 4 || !id.startsWith('9')) {
    return null;
  }

  const authorityChar = id.charAt(1);
  const areaChar = id.charAt(2);
  const instanceChar = id.charAt(3);

  const authority = parseInt(authorityChar, 10) as HITLAuthority;
  const area = parseInt(areaChar, 10) as HITLArea;
  const instance = parseInt(instanceChar, 10);

  if (isNaN(authority) || isNaN(area) || isNaN(instance)) {
    return null;
  }

  return {
    type: 'HITL',
    authority,
    area,
    instance,
    raw: id,
  };
}

// ============================================================================
// ID VALIDATION UTILITIES
// ============================================================================

/**
 * Check if a string is a valid Agent ID
 */
export function isValidAgentId(id: string): boolean {
  return parseAgentId(id) !== null;
}

/**
 * Check if a string is a valid HITL ID
 */
export function isValidHITLId(id: string): boolean {
  return parseHITLId(id) !== null;
}

/**
 * Check if an ID represents a genesis agent
 */
export function isGenesisAgent(id: string): boolean {
  const parsed = parseAgentId(id);
  return parsed !== null && parsed.isGenesis;
}

/**
 * Check if an ID represents a HITL user
 */
export function isHITL(id: string): boolean {
  return id.startsWith('9') && id.length === 4;
}

// ============================================================================
// ID DISPLAY UTILITIES
// ============================================================================

/**
 * Format an Agent ID for display with labels
 */
export function formatAgentIdDisplay(id: string): string {
  const parsed = parseAgentId(id);
  if (!parsed) {
    return id;
  }

  const tierLabel = `T${parsed.tier}`;
  const roleLabel = AgentRoleLabels[parsed.role] || `R${parsed.role}`;
  const categoryLabel = AgentCategoryLabels[parsed.category] || `C${parsed.category}`;
  const instanceLabel = parsed.isGenesis ? 'Genesis' : `#${parsed.instance}`;

  return `${tierLabel} ${roleLabel} - ${categoryLabel} ${instanceLabel}`;
}

/**
 * Format a HITL ID for display with labels
 */
export function formatHITLIdDisplay(id: string): string {
  const parsed = parseHITLId(id);
  if (!parsed) {
    return id;
  }

  const authorityLabel = HITLAuthorityLabels[parsed.authority] || `Auth${parsed.authority}`;
  const areaLabel = HITLAreaLabels[parsed.area] || `Area${parsed.area}`;

  return `HITL ${authorityLabel} - ${areaLabel} #${parsed.instance}`;
}

/**
 * Format any entity ID for display
 */
export function formatEntityIdDisplay(id: string): string {
  if (isHITL(id)) {
    return formatHITLIdDisplay(id);
  }
  return formatAgentIdDisplay(id);
}

/**
 * Get a short display format: ID + primary label
 */
export function formatIdShort(id: string): string {
  const parsed = parseEntityId(id);
  if (!parsed) {
    return id;
  }

  if (parsed.type === 'HITL') {
    return `${id} (${HITLAuthorityLabels[parsed.authority]})`;
  }

  return `${id} (${AgentCategoryLabels[parsed.category]})`;
}

// ============================================================================
// ID COMPARISON UTILITIES
// ============================================================================

/**
 * Compare two agent IDs by tier (for sorting)
 */
export function compareByTier(idA: string, idB: string): number {
  const parsedA = parseAgentId(idA);
  const parsedB = parseAgentId(idB);

  if (!parsedA || !parsedB) return 0;

  return parsedB.tier - parsedA.tier; // Higher tier first
}

/**
 * Compare two agent IDs by category (for grouping)
 */
export function compareByCategory(idA: string, idB: string): number {
  const parsedA = parseAgentId(idA);
  const parsedB = parseAgentId(idB);

  if (!parsedA || !parsedB) return 0;

  return parsedA.category - parsedB.category;
}

/**
 * Get the next available instance number for a given tier/role/category combo
 */
export function getNextInstance(
  existingIds: string[],
  tier: number,
  role: AgentRole,
  category: AgentCategory
): number {
  const prefix = `${tier}${role}${category.toString().padStart(2, '0')}`;

  const matchingInstances = existingIds
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.substring(4, 6), 10))
    .filter(n => !isNaN(n));

  if (matchingInstances.length === 0) {
    return 0; // First one is genesis
  }

  return Math.max(...matchingInstances) + 1;
}

// ============================================================================
// CAPABILITY-TO-CATEGORY MAPPING (Single Source of Truth)
// ============================================================================

/**
 * Maps agent capabilities to their corresponding category.
 * This is the canonical mapping used by all ID generation functions.
 */
export const CAPABILITY_TO_CATEGORY: Record<string, AgentCategory> = {
  // Research & Analysis (10-19)
  research: AgentCategory.RESEARCH,
  'market-research': AgentCategory.RESEARCH_MARKET,
  'technical-research': AgentCategory.RESEARCH_TECHNICAL,
  'competitive-research': AgentCategory.RESEARCH_COMPETITIVE,

  // Content & Creative (20-29)
  content: AgentCategory.CONTENT,
  writing: AgentCategory.CONTENT_WRITING,
  'content-writing': AgentCategory.CONTENT_WRITING,
  'social-media': AgentCategory.CONTENT_SOCIAL,
  design: AgentCategory.CONTENT_DESIGN,
  video: AgentCategory.CONTENT_VIDEO,

  // Development & Technical (30-39)
  development: AgentCategory.DEVELOPMENT,
  frontend: AgentCategory.DEVELOPMENT_FRONTEND,
  'frontend-dev': AgentCategory.DEVELOPMENT_FRONTEND,
  backend: AgentCategory.DEVELOPMENT_BACKEND,
  'backend-dev': AgentCategory.DEVELOPMENT_BACKEND,
  devops: AgentCategory.DEVELOPMENT_DEVOPS,
  testing: AgentCategory.DEVELOPMENT_QA,
  qa: AgentCategory.DEVELOPMENT_QA,
  security: AgentCategory.DEVELOPMENT_SECURITY,

  // Social & Community (40-49)
  social: AgentCategory.SOCIAL,
  monitoring: AgentCategory.SOCIAL_MONITORING,
  'social-monitoring': AgentCategory.SOCIAL_MONITORING,
  community: AgentCategory.SOCIAL_COMMUNITY,
  engagement: AgentCategory.SOCIAL_ENGAGEMENT,

  // Sales & Business Development (50-59)
  sales: AgentCategory.SALES,
  'lead-generation': AgentCategory.SALES_LEAD_GEN,
  'lead-gen': AgentCategory.SALES_LEAD_GEN,
  qualification: AgentCategory.SALES_QUALIFICATION,
  outreach: AgentCategory.SALES_OUTREACH,

  // Support & Service (60-69)
  support: AgentCategory.SUPPORT,
  'customer-support': AgentCategory.SUPPORT_CUSTOMER,
  'technical-support': AgentCategory.SUPPORT_TECHNICAL,
  'internal-support': AgentCategory.SUPPORT_INTERNAL,

  // Operations & Administration (70-79)
  operations: AgentCategory.OPERATIONS,
  scheduling: AgentCategory.OPERATIONS_SCHEDULING,
  inbox: AgentCategory.OPERATIONS_INBOX,
  workflow: AgentCategory.OPERATIONS_WORKFLOW,

  // Analytics & Intelligence (80-89)
  analytics: AgentCategory.ANALYTICS,
  metrics: AgentCategory.ANALYTICS_METRICS,
  reporting: AgentCategory.ANALYTICS_REPORTING,
  forecasting: AgentCategory.ANALYTICS_FORECASTING,

  // Executive & Strategy (90-99)
  executive: AgentCategory.EXECUTIVE,
  coordination: AgentCategory.EXECUTIVE_COORDINATION,
  strategy: AgentCategory.EXECUTIVE_STRATEGY,
  governance: AgentCategory.EXECUTIVE_GOVERNANCE,
};

/**
 * Maps agent type strings to their corresponding role.
 * This is the canonical mapping used by all ID generation functions.
 */
export const TYPE_TO_ROLE: Record<string, AgentRole> = {
  // Executor types
  worker: AgentRole.EXECUTOR,
  specialist: AgentRole.EXECUTOR,
  executor: AgentRole.EXECUTOR,

  // Planner types
  planner: AgentRole.PLANNER,

  // Validator types
  validator: AgentRole.VALIDATOR,
  auditor: AgentRole.VALIDATOR,

  // Researcher types
  researcher: AgentRole.RESEARCHER,
  analyst: AgentRole.RESEARCHER,
  analyzer: AgentRole.RESEARCHER,

  // Communicator types
  communicator: AgentRole.COMMUNICATOR,
  messenger: AgentRole.COMMUNICATOR,

  // Orchestrator types
  orchestrator: AgentRole.ORCHESTRATOR,
  coordinator: AgentRole.ORCHESTRATOR,
  manager: AgentRole.ORCHESTRATOR,
  executive: AgentRole.ORCHESTRATOR,
  spawner: AgentRole.ORCHESTRATOR,
  creator: AgentRole.ORCHESTRATOR,
  evolver: AgentRole.ORCHESTRATOR,
};

/**
 * Derive category from a list of capabilities.
 * Returns the first matching category or OPERATIONS as default.
 */
export function getCategoryFromCapabilities(capabilities: string[]): AgentCategory {
  for (const cap of capabilities) {
    const category = CAPABILITY_TO_CATEGORY[cap.toLowerCase()];
    if (category !== undefined) {
      return category;
    }
  }
  return AgentCategory.OPERATIONS;
}

/**
 * Derive role from agent type string.
 * Returns the matching role or EXECUTOR as default.
 */
export function getRoleFromType(type: string): AgentRole {
  return TYPE_TO_ROLE[type.toLowerCase()] ?? AgentRole.EXECUTOR;
}

/**
 * Generate a structured ID from agent metadata.
 * This is the unified function that should be used by all services.
 *
 * @param tier - Agent tier (0-8)
 * @param type - Agent type string (e.g., 'worker', 'planner')
 * @param capabilities - Array of capability strings
 * @param existingIds - Array of existing structured IDs for instance calculation
 */
export function generateStructuredIdFromMetadata(
  tier: number,
  type: string,
  capabilities: string[],
  existingIds: string[]
): string {
  const role = getRoleFromType(type);
  const category = getCategoryFromCapabilities(capabilities);
  const instance = getNextInstance(existingIds, tier, role, category);
  return generateAgentId(tier, role, category, instance);
}
