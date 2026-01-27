/**
 * @fileoverview Agent Definitions and Utilities
 * @module @vorion/dashboard/lib/agents
 *
 * Defines the Vorion agent ecosystem: Bootstrap agents, Core orchestration,
 * Factory (building), Forge (development), and Labs (innovation) modules.
 */

// =============================================================================
// AGENT TYPE DEFINITIONS
// =============================================================================

export type AgentArchetype =
  | 'advisor'
  | 'chronicler'
  | 'validator'
  | 'executor'
  | 'builder'
  | 'orchestrator';

export type AgentFramework = 'vorion' | 'legacy';

export type AgentModule = 'bootstrap' | 'core' | 'factory' | 'forge' | 'labs' | 'ops' | 'security' | 'data';

export interface AgentDefinition {
  id: string;
  name: string;
  persona?: string;
  archetype: AgentArchetype;
  description: string;
  framework: AgentFramework;
  module?: AgentModule;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  icon?: string;
}

// =============================================================================
// VORION BOOTSTRAP AGENT DEFINITIONS
// =============================================================================

/**
 * The 5 Bootstrap Agents + Council governance layer
 */
export const BOOTSTRAP_AGENTS: Record<string, AgentDefinition> = {
  architect: {
    id: 'vorion.bootstrap.architect',
    name: 'Architect',
    archetype: 'advisor',
    description: 'Architecture decisions, ADRs, structure review',
    framework: 'vorion',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  scribe: {
    id: 'vorion.bootstrap.scribe',
    name: 'Scribe',
    archetype: 'chronicler',
    description: 'Documentation, specs, changelogs',
    framework: 'vorion',
    color: 'purple',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  sentinel: {
    id: 'vorion.bootstrap.sentinel',
    name: 'Sentinel',
    archetype: 'validator',
    description: 'Code review, security scanning, quality gates',
    framework: 'vorion',
    color: 'blue',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
  builder: {
    id: 'vorion.bootstrap.builder',
    name: 'Builder',
    archetype: 'executor',
    description: 'Implementation, code generation',
    framework: 'vorion',
    color: 'emerald',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  tester: {
    id: 'vorion.bootstrap.tester',
    name: 'Tester',
    archetype: 'validator',
    description: 'Test generation, validation, coverage',
    framework: 'vorion',
    color: 'cyan',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
  council: {
    id: 'vorion.governance.council',
    name: 'Council',
    archetype: 'advisor',
    description: 'Governance orchestration layer',
    framework: 'vorion',
    color: 'orange',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
};

// =============================================================================
// VORION CORE AGENTS (Orchestration & Command)
// =============================================================================

/**
 * Vorion Core Module - Orchestration & Knowledge Management
 */
export const VORION_CORE_AGENTS: Record<string, AgentDefinition> = {
  'nexus': {
    id: 'vorion.core.nexus',
    name: 'Nexus',
    archetype: 'orchestrator',
    description: 'Workflow orchestration & knowledge curation',
    framework: 'vorion',
    module: 'core',
    icon: '🧙',
    color: 'violet',
    borderColor: 'border-violet-500',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400',
  },
  'herald': {
    id: 'vorion.core.herald',
    name: 'Herald',
    archetype: 'orchestrator',
    description: 'Intent interpretation & command routing',
    framework: 'vorion',
    module: 'core',
    icon: '📢',
    color: 'indigo',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500/20',
    textColor: 'text-indigo-400',
  },
  'dispatcher': {
    id: 'vorion.core.dispatcher',
    name: 'Dispatcher',
    archetype: 'orchestrator',
    description: 'Task distribution & load balancing',
    framework: 'vorion',
    module: 'core',
    icon: '📡',
    color: 'cyan',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
  'mediator': {
    id: 'vorion.core.mediator',
    name: 'Mediator',
    archetype: 'orchestrator',
    description: 'Conflict resolution & agent coordination',
    framework: 'vorion',
    module: 'core',
    icon: '⚖️',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
};

// =============================================================================
// VORION FACTORY AGENTS (Building & Creation)
// =============================================================================

/**
 * Vorion Factory Module - Agent, Module, and Workflow Creation
 */
export const VORION_FACTORY_AGENTS: Record<string, AgentDefinition> = {
  'forge-master': {
    id: 'vorion.factory.forge-master',
    name: 'Forge Master',
    archetype: 'builder',
    description: 'Creates governed agents with compliance',
    framework: 'vorion',
    module: 'factory',
    icon: '🤖',
    color: 'rose',
    borderColor: 'border-rose-500',
    bgColor: 'bg-rose-500/20',
    textColor: 'text-rose-400',
  },
  'assembler': {
    id: 'vorion.factory.assembler',
    name: 'Assembler',
    archetype: 'builder',
    description: 'Creates complete system modules',
    framework: 'vorion',
    module: 'factory',
    icon: '🏗️',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  'pipeline': {
    id: 'vorion.factory.pipeline',
    name: 'Pipeline',
    archetype: 'builder',
    description: 'Creates automated workflows',
    framework: 'vorion',
    module: 'factory',
    icon: '🔄',
    color: 'teal',
    borderColor: 'border-teal-500',
    bgColor: 'bg-teal-500/20',
    textColor: 'text-teal-400',
  },
};

// =============================================================================
// VORION FORGE AGENTS (Development Workflow)
// =============================================================================

/**
 * Vorion Forge Module - Software Development Workflow
 */
export const VORION_FORGE_AGENTS: Record<string, AgentDefinition> = {
  'analyst': {
    id: 'vorion.forge.analyst',
    name: 'Analyst',
    archetype: 'advisor',
    description: 'Business analysis & requirements',
    framework: 'vorion',
    module: 'forge',
    icon: '📊',
    color: 'sky',
    borderColor: 'border-sky-500',
    bgColor: 'bg-sky-500/20',
    textColor: 'text-sky-400',
  },
  'systems-architect': {
    id: 'vorion.forge.systems-architect',
    name: 'Systems Architect',
    archetype: 'advisor',
    description: 'System architecture & API design',
    framework: 'vorion',
    module: 'forge',
    icon: '🏛️',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  'developer': {
    id: 'vorion.forge.developer',
    name: 'Developer',
    archetype: 'executor',
    description: 'Implementation & coding',
    framework: 'vorion',
    module: 'forge',
    icon: '💻',
    color: 'emerald',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  'product-lead': {
    id: 'vorion.forge.product-lead',
    name: 'Product Lead',
    archetype: 'advisor',
    description: 'Product management & PRDs',
    framework: 'vorion',
    module: 'forge',
    icon: '📋',
    color: 'indigo',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500/20',
    textColor: 'text-indigo-400',
  },
  'sprint-master': {
    id: 'vorion.forge.sprint-master',
    name: 'Sprint Master',
    archetype: 'chronicler',
    description: 'Sprint planning & story prep',
    framework: 'vorion',
    module: 'forge',
    icon: '🏃',
    color: 'lime',
    borderColor: 'border-lime-500',
    bgColor: 'bg-lime-500/20',
    textColor: 'text-lime-400',
  },
  'quality-architect': {
    id: 'vorion.forge.quality-architect',
    name: 'Quality Architect',
    archetype: 'validator',
    description: 'Test architecture & CI/CD',
    framework: 'vorion',
    module: 'forge',
    icon: '🧪',
    color: 'cyan',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
  'documentarian': {
    id: 'vorion.forge.documentarian',
    name: 'Documentarian',
    archetype: 'chronicler',
    description: 'Technical documentation',
    framework: 'vorion',
    module: 'forge',
    icon: '📚',
    color: 'purple',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  'experience-designer': {
    id: 'vorion.forge.experience-designer',
    name: 'Experience Designer',
    archetype: 'advisor',
    description: 'UX/UI design & wireframes',
    framework: 'vorion',
    module: 'forge',
    icon: '🎨',
    color: 'pink',
    borderColor: 'border-pink-500',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
  },
  'rapid-dev': {
    id: 'vorion.forge.rapid-dev',
    name: 'Rapid Dev',
    archetype: 'executor',
    description: 'Rapid end-to-end implementation',
    framework: 'vorion',
    module: 'forge',
    icon: '🚀',
    color: 'red',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
  },
  'api-designer': {
    id: 'vorion.forge.api-designer',
    name: 'API Designer',
    archetype: 'advisor',
    description: 'API design & OpenAPI specs',
    framework: 'vorion',
    module: 'forge',
    icon: '🔌',
    color: 'violet',
    borderColor: 'border-violet-500',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400',
  },
  'database-architect': {
    id: 'vorion.forge.database-architect',
    name: 'Database Architect',
    archetype: 'advisor',
    description: 'Database design & optimization',
    framework: 'vorion',
    module: 'forge',
    icon: '🗄️',
    color: 'orange',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
  'performance-engineer': {
    id: 'vorion.forge.performance-engineer',
    name: 'Performance Engineer',
    archetype: 'validator',
    description: 'Performance testing & optimization',
    framework: 'vorion',
    module: 'forge',
    icon: '⚡',
    color: 'yellow',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  'accessibility-expert': {
    id: 'vorion.forge.accessibility-expert',
    name: 'Accessibility Expert',
    archetype: 'validator',
    description: 'A11y audits & WCAG compliance',
    framework: 'vorion',
    module: 'forge',
    icon: '♿',
    color: 'blue',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
};

// =============================================================================
// VORION LABS AGENTS (Innovation & Strategy)
// =============================================================================

/**
 * Vorion Labs Module - Innovation, Strategy, and Creative Agents
 */
export const VORION_LABS_AGENTS: Record<string, AgentDefinition> = {
  'ideation-coach': {
    id: 'vorion.labs.ideation-coach',
    name: 'Ideation Coach',
    archetype: 'advisor',
    description: 'Ideation & breakthrough sessions',
    framework: 'vorion',
    module: 'labs',
    icon: '🧠',
    color: 'fuchsia',
    borderColor: 'border-fuchsia-500',
    bgColor: 'bg-fuchsia-500/20',
    textColor: 'text-fuchsia-400',
  },
  'problem-solver': {
    id: 'vorion.labs.problem-solver',
    name: 'Problem Solver',
    archetype: 'advisor',
    description: 'Systematic problem solving (TRIZ)',
    framework: 'vorion',
    module: 'labs',
    icon: '🔬',
    color: 'blue',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
  'design-thinker': {
    id: 'vorion.labs.design-thinker',
    name: 'Design Thinker',
    archetype: 'advisor',
    description: 'Human-centered design',
    framework: 'vorion',
    module: 'labs',
    icon: '🎯',
    color: 'pink',
    borderColor: 'border-pink-500',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
  },
  'strategist': {
    id: 'vorion.labs.strategist',
    name: 'Strategist',
    archetype: 'advisor',
    description: 'Business model innovation',
    framework: 'vorion',
    module: 'labs',
    icon: '⚡',
    color: 'yellow',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  'presenter': {
    id: 'vorion.labs.presenter',
    name: 'Presenter',
    archetype: 'chronicler',
    description: 'Visual communication & decks',
    framework: 'vorion',
    module: 'labs',
    icon: '🎬',
    color: 'orange',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
  'storyteller': {
    id: 'vorion.labs.storyteller',
    name: 'Storyteller',
    archetype: 'chronicler',
    description: 'Narrative crafting',
    framework: 'vorion',
    module: 'labs',
    icon: '📖',
    color: 'stone',
    borderColor: 'border-stone-500',
    bgColor: 'bg-stone-500/20',
    textColor: 'text-stone-400',
  },
  'researcher': {
    id: 'vorion.labs.researcher',
    name: 'Researcher',
    archetype: 'advisor',
    description: 'Deep research & competitive analysis',
    framework: 'vorion',
    module: 'labs',
    icon: '🔍',
    color: 'slate',
    borderColor: 'border-slate-500',
    bgColor: 'bg-slate-500/20',
    textColor: 'text-slate-400',
  },
  'futurist': {
    id: 'vorion.labs.futurist',
    name: 'Futurist',
    archetype: 'advisor',
    description: 'Trend forecasting & future planning',
    framework: 'vorion',
    module: 'labs',
    icon: '🔮',
    color: 'violet',
    borderColor: 'border-violet-500',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400',
  },
};

// =============================================================================
// VORION OPS AGENTS (Operations & Platform)
// =============================================================================

/**
 * Vorion Ops Module - DevOps, Platform, and Infrastructure Agents
 */
export const VORION_OPS_AGENTS: Record<string, AgentDefinition> = {
  'deployer': {
    id: 'vorion.ops.deployer',
    name: 'Deployer',
    archetype: 'executor',
    description: 'Deployment automation & release management',
    framework: 'vorion',
    module: 'ops',
    icon: '🚢',
    color: 'blue',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
  'observer': {
    id: 'vorion.ops.observer',
    name: 'Observer',
    archetype: 'validator',
    description: 'Monitoring, alerting & observability',
    framework: 'vorion',
    module: 'ops',
    icon: '👁️',
    color: 'cyan',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
  'incident-commander': {
    id: 'vorion.ops.incident-commander',
    name: 'Incident Commander',
    archetype: 'orchestrator',
    description: 'Incident response & coordination',
    framework: 'vorion',
    module: 'ops',
    icon: '🚨',
    color: 'red',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
  },
  'infrastructure': {
    id: 'vorion.ops.infrastructure',
    name: 'Infrastructure',
    archetype: 'builder',
    description: 'IaC, cloud provisioning & scaling',
    framework: 'vorion',
    module: 'ops',
    icon: '☁️',
    color: 'sky',
    borderColor: 'border-sky-500',
    bgColor: 'bg-sky-500/20',
    textColor: 'text-sky-400',
  },
};

// =============================================================================
// VORION SECURITY AGENTS (Security & Compliance)
// =============================================================================

/**
 * Vorion Security Module - Security, Compliance, and Risk Agents
 */
export const VORION_SECURITY_AGENTS: Record<string, AgentDefinition> = {
  'auditor': {
    id: 'vorion.security.auditor',
    name: 'Auditor',
    archetype: 'validator',
    description: 'Security audits & vulnerability assessment',
    framework: 'vorion',
    module: 'security',
    icon: '🔒',
    color: 'emerald',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  'compliance': {
    id: 'vorion.security.compliance',
    name: 'Compliance',
    archetype: 'validator',
    description: 'Regulatory compliance & policy enforcement',
    framework: 'vorion',
    module: 'security',
    icon: '📜',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  'penetration-tester': {
    id: 'vorion.security.penetration-tester',
    name: 'Penetration Tester',
    archetype: 'executor',
    description: 'Security testing & ethical hacking',
    framework: 'vorion',
    module: 'security',
    icon: '🎯',
    color: 'rose',
    borderColor: 'border-rose-500',
    bgColor: 'bg-rose-500/20',
    textColor: 'text-rose-400',
  },
};

// =============================================================================
// VORION DATA AGENTS (Data & ML)
// =============================================================================

/**
 * Vorion Data Module - Data Engineering, Analytics, and ML Agents
 */
export const VORION_DATA_AGENTS: Record<string, AgentDefinition> = {
  'data-engineer': {
    id: 'vorion.data.data-engineer',
    name: 'Data Engineer',
    archetype: 'builder',
    description: 'Data pipelines & ETL workflows',
    framework: 'vorion',
    module: 'data',
    icon: '🔧',
    color: 'orange',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
  'data-analyst': {
    id: 'vorion.data.data-analyst',
    name: 'Data Analyst',
    archetype: 'advisor',
    description: 'Data analysis & business intelligence',
    framework: 'vorion',
    module: 'data',
    icon: '📈',
    color: 'teal',
    borderColor: 'border-teal-500',
    bgColor: 'bg-teal-500/20',
    textColor: 'text-teal-400',
  },
  'ml-engineer': {
    id: 'vorion.data.ml-engineer',
    name: 'ML Engineer',
    archetype: 'builder',
    description: 'Machine learning & model deployment',
    framework: 'vorion',
    module: 'data',
    icon: '🤖',
    color: 'purple',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
};

/**
 * All Extended Vorion Agents (non-bootstrap)
 */
export const VORION_EXTENDED_AGENTS: Record<string, AgentDefinition> = {
  ...VORION_CORE_AGENTS,
  ...VORION_FACTORY_AGENTS,
  ...VORION_FORGE_AGENTS,
  ...VORION_LABS_AGENTS,
  ...VORION_OPS_AGENTS,
  ...VORION_SECURITY_AGENTS,
  ...VORION_DATA_AGENTS,
};

/**
 * All agents from all Vorion modules
 */
export const ALL_AGENTS: Record<string, AgentDefinition> = {
  ...BOOTSTRAP_AGENTS,
  ...VORION_EXTENDED_AGENTS,
};

// =============================================================================
// LEGACY AGENT MAPPING
// =============================================================================

/**
 * Maps legacy agent IDs to their bootstrap agent equivalents
 */
export const LEGACY_AGENT_MAP: Record<string, string> = {
  herald: 'builder',
  watchman: 'sentinel',
  envoy: 'builder',
  librarian: 'architect',
  curator: 'scribe',
  'ts-fixer': 'builder',
  // Direct mappings (already correct)
  architect: 'architect',
  scribe: 'scribe',
  sentinel: 'sentinel',
  builder: 'builder',
  tester: 'tester',
  council: 'council',
};

/**
 * Resolve a legacy agent ID to its current equivalent
 */
export function resolveAgentId(agentId: string): string {
  const lowerId = agentId.toLowerCase();
  // Check extended Vorion agents first (they use their own IDs)
  if (VORION_EXTENDED_AGENTS[lowerId]) {
    return lowerId;
  }
  return LEGACY_AGENT_MAP[lowerId] || lowerId;
}

/**
 * Get the full agent definition for an agent ID (legacy, bootstrap, or extended)
 */
export function getAgentDefinition(agentId: string): AgentDefinition | undefined {
  const lowerId = agentId.toLowerCase();

  // Check all agents directly first
  if (ALL_AGENTS[lowerId]) {
    return ALL_AGENTS[lowerId];
  }

  // Try resolved ID for legacy agents
  const resolvedId = resolveAgentId(lowerId);
  return ALL_AGENTS[resolvedId];
}

/**
 * Get the display name for an agent ID
 */
export function getAgentDisplayName(agentId: string): string {
  const def = getAgentDefinition(agentId);
  if (def?.persona) {
    return `${def.name} (${def.persona})`;
  }
  return def?.name || agentId;
}

/**
 * Get the short display name (no persona)
 */
export function getAgentShortName(agentId: string): string {
  const def = getAgentDefinition(agentId);
  return def?.name || agentId;
}

/**
 * Get the border color class for an agent ID
 */
export function getAgentBorderColor(agentId: string): string {
  const def = getAgentDefinition(agentId);
  return def?.borderColor || 'border-slate-500';
}

/**
 * Get the text color class for an agent ID
 */
export function getAgentTextColor(agentId: string): string {
  const def = getAgentDefinition(agentId);
  return def?.textColor || 'text-slate-400';
}

/**
 * Get the background color class for an agent ID
 */
export function getAgentBgColor(agentId: string): string {
  const def = getAgentDefinition(agentId);
  return def?.bgColor || 'bg-slate-500/20';
}

/**
 * Get the icon for an agent ID
 */
export function getAgentIcon(agentId: string): string | undefined {
  const def = getAgentDefinition(agentId);
  return def?.icon;
}

// =============================================================================
// AGENT LISTS FOR UI
// =============================================================================

/**
 * Vorion agent options for dropdowns/filters
 */
export const VORION_AGENT_OPTIONS = [
  { value: '', label: 'All Vorion Agents' },
  { value: 'architect', label: 'Architect' },
  { value: 'scribe', label: 'Scribe' },
  { value: 'sentinel', label: 'Sentinel' },
  { value: 'builder', label: 'Builder' },
  { value: 'tester', label: 'Tester' },
  { value: 'council', label: 'Council' },
];

/**
 * Vorion extended agent options for dropdowns/filters (grouped by module)
 */
export const VORION_EXTENDED_OPTIONS = [
  { value: '', label: 'All Extended Agents' },
  // Core
  { value: 'nexus', label: '🧙 Nexus', group: 'Core' },
  { value: 'herald', label: '📢 Herald', group: 'Core' },
  { value: 'dispatcher', label: '📡 Dispatcher', group: 'Core' },
  { value: 'mediator', label: '⚖️ Mediator', group: 'Core' },
  // Factory
  { value: 'forge-master', label: '🤖 Forge Master', group: 'Factory' },
  { value: 'assembler', label: '🏗️ Assembler', group: 'Factory' },
  { value: 'pipeline', label: '🔄 Pipeline', group: 'Factory' },
  // Forge
  { value: 'analyst', label: '📊 Analyst', group: 'Forge' },
  { value: 'systems-architect', label: '🏛️ Systems Architect', group: 'Forge' },
  { value: 'developer', label: '💻 Developer', group: 'Forge' },
  { value: 'product-lead', label: '📋 Product Lead', group: 'Forge' },
  { value: 'sprint-master', label: '🏃 Sprint Master', group: 'Forge' },
  { value: 'quality-architect', label: '🧪 Quality Architect', group: 'Forge' },
  { value: 'documentarian', label: '📚 Documentarian', group: 'Forge' },
  { value: 'experience-designer', label: '🎨 Experience Designer', group: 'Forge' },
  { value: 'rapid-dev', label: '🚀 Rapid Dev', group: 'Forge' },
  { value: 'api-designer', label: '🔌 API Designer', group: 'Forge' },
  { value: 'database-architect', label: '🗄️ Database Architect', group: 'Forge' },
  { value: 'performance-engineer', label: '⚡ Performance Engineer', group: 'Forge' },
  { value: 'accessibility-expert', label: '♿ Accessibility Expert', group: 'Forge' },
  // Labs
  { value: 'ideation-coach', label: '🧠 Ideation Coach', group: 'Labs' },
  { value: 'problem-solver', label: '🔬 Problem Solver', group: 'Labs' },
  { value: 'design-thinker', label: '🎯 Design Thinker', group: 'Labs' },
  { value: 'strategist', label: '⚡ Strategist', group: 'Labs' },
  { value: 'presenter', label: '🎬 Presenter', group: 'Labs' },
  { value: 'storyteller', label: '📖 Storyteller', group: 'Labs' },
  { value: 'researcher', label: '🔍 Researcher', group: 'Labs' },
  { value: 'futurist', label: '🔮 Futurist', group: 'Labs' },
  // Ops
  { value: 'deployer', label: '🚢 Deployer', group: 'Ops' },
  { value: 'observer', label: '👁️ Observer', group: 'Ops' },
  { value: 'incident-commander', label: '🚨 Incident Commander', group: 'Ops' },
  { value: 'infrastructure', label: '☁️ Infrastructure', group: 'Ops' },
  // Security
  { value: 'auditor', label: '🔒 Auditor', group: 'Security' },
  { value: 'compliance', label: '📜 Compliance', group: 'Security' },
  { value: 'penetration-tester', label: '🎯 Penetration Tester', group: 'Security' },
  // Data
  { value: 'data-engineer', label: '🔧 Data Engineer', group: 'Data' },
  { value: 'data-analyst', label: '📈 Data Analyst', group: 'Data' },
  { value: 'ml-engineer', label: '🤖 ML Engineer', group: 'Data' },
];

/**
 * Combined agent options for dropdowns/filters
 */
export const AGENT_OPTIONS = [
  { value: '', label: 'All Agents' },
  // Vorion Bootstrap
  { value: 'architect', label: 'Architect', group: 'Bootstrap' },
  { value: 'scribe', label: 'Scribe', group: 'Bootstrap' },
  { value: 'sentinel', label: 'Sentinel', group: 'Bootstrap' },
  { value: 'builder', label: 'Builder', group: 'Bootstrap' },
  { value: 'tester', label: 'Tester', group: 'Bootstrap' },
  { value: 'council', label: 'Council', group: 'Bootstrap' },
  // Vorion Core
  { value: 'nexus', label: '🧙 Nexus', group: 'Core' },
  { value: 'herald', label: '📢 Herald', group: 'Core' },
  { value: 'dispatcher', label: '📡 Dispatcher', group: 'Core' },
  { value: 'mediator', label: '⚖️ Mediator', group: 'Core' },
  // Vorion Factory
  { value: 'forge-master', label: '🤖 Forge Master', group: 'Factory' },
  { value: 'assembler', label: '🏗️ Assembler', group: 'Factory' },
  { value: 'pipeline', label: '🔄 Pipeline', group: 'Factory' },
  // Vorion Forge
  { value: 'analyst', label: '📊 Analyst', group: 'Forge' },
  { value: 'systems-architect', label: '🏛️ Systems Architect', group: 'Forge' },
  { value: 'developer', label: '💻 Developer', group: 'Forge' },
  { value: 'product-lead', label: '📋 Product Lead', group: 'Forge' },
  { value: 'sprint-master', label: '🏃 Sprint Master', group: 'Forge' },
  { value: 'quality-architect', label: '🧪 Quality Architect', group: 'Forge' },
  { value: 'documentarian', label: '📚 Documentarian', group: 'Forge' },
  { value: 'experience-designer', label: '🎨 Experience Designer', group: 'Forge' },
  { value: 'rapid-dev', label: '🚀 Rapid Dev', group: 'Forge' },
  { value: 'api-designer', label: '🔌 API Designer', group: 'Forge' },
  { value: 'database-architect', label: '🗄️ Database Architect', group: 'Forge' },
  { value: 'performance-engineer', label: '⚡ Performance Engineer', group: 'Forge' },
  { value: 'accessibility-expert', label: '♿ Accessibility Expert', group: 'Forge' },
  // Vorion Labs
  { value: 'ideation-coach', label: '🧠 Ideation Coach', group: 'Labs' },
  { value: 'problem-solver', label: '🔬 Problem Solver', group: 'Labs' },
  { value: 'design-thinker', label: '🎯 Design Thinker', group: 'Labs' },
  { value: 'strategist', label: '⚡ Strategist', group: 'Labs' },
  { value: 'presenter', label: '🎬 Presenter', group: 'Labs' },
  { value: 'storyteller', label: '📖 Storyteller', group: 'Labs' },
  { value: 'researcher', label: '🔍 Researcher', group: 'Labs' },
  { value: 'futurist', label: '🔮 Futurist', group: 'Labs' },
  // Vorion Ops
  { value: 'deployer', label: '🚢 Deployer', group: 'Ops' },
  { value: 'observer', label: '👁️ Observer', group: 'Ops' },
  { value: 'incident-commander', label: '🚨 Incident Commander', group: 'Ops' },
  { value: 'infrastructure', label: '☁️ Infrastructure', group: 'Ops' },
  // Vorion Security
  { value: 'auditor', label: '🔒 Auditor', group: 'Security' },
  { value: 'compliance', label: '📜 Compliance', group: 'Security' },
  { value: 'penetration-tester', label: '🎯 Penetration Tester', group: 'Security' },
  // Vorion Data
  { value: 'data-engineer', label: '🔧 Data Engineer', group: 'Data' },
  { value: 'data-analyst', label: '📈 Data Analyst', group: 'Data' },
  { value: 'ml-engineer', label: '🤖 ML Engineer', group: 'Data' },
];

/**
 * Bootstrap agent IDs only (no council)
 */
export const BOOTSTRAP_AGENT_IDS = ['architect', 'scribe', 'sentinel', 'builder', 'tester'];

/**
 * All Vorion agent IDs including governance
 */
export const ALL_VORION_AGENT_IDS = [...BOOTSTRAP_AGENT_IDS, 'council'];

/**
 * All extended Vorion agent IDs
 */
export const ALL_EXTENDED_AGENT_IDS = Object.keys(VORION_EXTENDED_AGENTS);

/**
 * All agent IDs across all modules
 */
export const ALL_AGENT_IDS = [...ALL_VORION_AGENT_IDS, ...ALL_EXTENDED_AGENT_IDS];

// =============================================================================
// AGENT COLORS (for components)
// =============================================================================

/**
 * Border colors for all agent IDs
 */
export const AGENT_BORDER_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_AGENTS).map(([key, def]) => [key, def.borderColor])
);

// Add legacy mappings
Object.assign(AGENT_BORDER_COLORS, {
  herald: 'border-emerald-500',
  watchman: 'border-blue-500',
  envoy: 'border-emerald-500',
  librarian: 'border-amber-500',
  curator: 'border-purple-500',
  'ts-fixer': 'border-emerald-500',
});

/**
 * Text colors for all agent IDs
 */
export const AGENT_TEXT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_AGENTS).map(([key, def]) => [key, def.textColor])
);

// Add legacy mappings
Object.assign(AGENT_TEXT_COLORS, {
  herald: 'text-emerald-400',
  watchman: 'text-blue-400',
  envoy: 'text-emerald-400',
  librarian: 'text-amber-400',
  curator: 'text-purple-400',
  'ts-fixer': 'text-emerald-400',
});

/**
 * Background colors for all agent IDs
 */
export const AGENT_BG_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_AGENTS).map(([key, def]) => [key, def.bgColor])
);

// =============================================================================
// AGENT FILTERING UTILITIES
// =============================================================================

/**
 * Get agents by framework
 */
export function getAgentsByFramework(framework: AgentFramework): AgentDefinition[] {
  return Object.values(ALL_AGENTS).filter((agent) => agent.framework === framework);
}

/**
 * Get agents by archetype
 */
export function getAgentsByArchetype(archetype: AgentArchetype): AgentDefinition[] {
  return Object.values(ALL_AGENTS).filter((agent) => agent.archetype === archetype);
}

/**
 * Get agents by module
 */
export function getAgentsByModule(module: AgentModule): AgentDefinition[] {
  if (module === 'bootstrap') {
    return Object.values(BOOTSTRAP_AGENTS);
  }
  return Object.values(VORION_EXTENDED_AGENTS).filter((agent) => agent.module === module);
}

/**
 * Check if an agent is an extended Vorion agent (non-bootstrap)
 */
export function isExtendedAgent(agentId: string): boolean {
  return agentId.toLowerCase() in VORION_EXTENDED_AGENTS;
}

/**
 * Check if an agent is a Vorion bootstrap agent
 */
export function isBootstrapAgent(agentId: string): boolean {
  const resolved = resolveAgentId(agentId.toLowerCase());
  return resolved in BOOTSTRAP_AGENTS;
}

/**
 * Check if an agent is any Vorion agent
 */
export function isVorionAgent(agentId: string): boolean {
  const lowerId = agentId.toLowerCase();
  return lowerId in ALL_AGENTS || resolveAgentId(lowerId) in ALL_AGENTS;
}

export default ALL_AGENTS;
