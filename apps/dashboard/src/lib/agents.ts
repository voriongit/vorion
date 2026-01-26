/**
 * @fileoverview Agent Definitions and Utilities
 * @module @vorion/dashboard/lib/agents
 *
 * Defines the 5-agent bootstrap model, BMAD agents, and backward compatibility
 * for legacy agent IDs during migration period.
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

export type AgentFramework = 'vorion' | 'bmad' | 'legacy';

export interface AgentDefinition {
  id: string;
  name: string;
  persona?: string;
  archetype: AgentArchetype;
  description: string;
  framework: AgentFramework;
  module?: string;
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
// BMAD AGENT DEFINITIONS
// =============================================================================

/**
 * BMAD Core Module Agents
 */
export const BMAD_CORE_AGENTS: Record<string, AgentDefinition> = {
  'bmad-master': {
    id: 'bmad.core.master',
    name: 'BMad Master',
    persona: 'Master',
    archetype: 'orchestrator',
    description: 'Workflow orchestration & knowledge curation',
    framework: 'bmad',
    module: 'core',
    icon: '🧙',
    color: 'violet',
    borderColor: 'border-violet-500',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400',
  },
};

/**
 * BMAD BMB (Building Module) Agents
 */
export const BMAD_BMB_AGENTS: Record<string, AgentDefinition> = {
  'agent-builder': {
    id: 'bmad.bmb.agent-builder',
    name: 'Agent Builder',
    persona: 'Bond',
    archetype: 'builder',
    description: 'Creates BMAD agents with compliance',
    framework: 'bmad',
    module: 'bmb',
    icon: '🤖',
    color: 'rose',
    borderColor: 'border-rose-500',
    bgColor: 'bg-rose-500/20',
    textColor: 'text-rose-400',
  },
  'module-builder': {
    id: 'bmad.bmb.module-builder',
    name: 'Module Builder',
    persona: 'Morgan',
    archetype: 'builder',
    description: 'Creates complete BMAD modules',
    framework: 'bmad',
    module: 'bmb',
    icon: '🏗️',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  'workflow-builder': {
    id: 'bmad.bmb.workflow-builder',
    name: 'Workflow Builder',
    persona: 'Wendy',
    archetype: 'builder',
    description: 'Creates BMAD workflows',
    framework: 'bmad',
    module: 'bmb',
    icon: '🔄',
    color: 'teal',
    borderColor: 'border-teal-500',
    bgColor: 'bg-teal-500/20',
    textColor: 'text-teal-400',
  },
};

/**
 * BMAD BMM (Modern Method) Agents
 */
export const BMAD_BMM_AGENTS: Record<string, AgentDefinition> = {
  analyst: {
    id: 'bmad.bmm.analyst',
    name: 'Analyst',
    persona: 'Mary',
    archetype: 'advisor',
    description: 'Business analysis & requirements',
    framework: 'bmad',
    module: 'bmm',
    icon: '📊',
    color: 'sky',
    borderColor: 'border-sky-500',
    bgColor: 'bg-sky-500/20',
    textColor: 'text-sky-400',
  },
  'bmm-architect': {
    id: 'bmad.bmm.architect',
    name: 'BMM Architect',
    persona: 'Winston',
    archetype: 'advisor',
    description: 'System architecture & API design',
    framework: 'bmad',
    module: 'bmm',
    icon: '🏗️',
    color: 'amber',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  dev: {
    id: 'bmad.bmm.dev',
    name: 'Developer',
    persona: 'Amelia',
    archetype: 'executor',
    description: 'Implementation & coding',
    framework: 'bmad',
    module: 'bmm',
    icon: '💻',
    color: 'emerald',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  pm: {
    id: 'bmad.bmm.pm',
    name: 'Product Manager',
    persona: 'John',
    archetype: 'advisor',
    description: 'Product management & PRDs',
    framework: 'bmad',
    module: 'bmm',
    icon: '📋',
    color: 'indigo',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500/20',
    textColor: 'text-indigo-400',
  },
  sm: {
    id: 'bmad.bmm.sm',
    name: 'Scrum Master',
    persona: 'Bob',
    archetype: 'chronicler',
    description: 'Sprint planning & story prep',
    framework: 'bmad',
    module: 'bmm',
    icon: '🏃',
    color: 'lime',
    borderColor: 'border-lime-500',
    bgColor: 'bg-lime-500/20',
    textColor: 'text-lime-400',
  },
  tea: {
    id: 'bmad.bmm.tea',
    name: 'Test Architect',
    persona: 'Murat',
    archetype: 'validator',
    description: 'Test architecture & CI/CD',
    framework: 'bmad',
    module: 'bmm',
    icon: '🧪',
    color: 'cyan',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
  'tech-writer': {
    id: 'bmad.bmm.tech-writer',
    name: 'Tech Writer',
    persona: 'Paige',
    archetype: 'chronicler',
    description: 'Technical documentation',
    framework: 'bmad',
    module: 'bmm',
    icon: '📚',
    color: 'purple',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  'ux-designer': {
    id: 'bmad.bmm.ux-designer',
    name: 'UX Designer',
    persona: 'Sally',
    archetype: 'advisor',
    description: 'UX/UI design & wireframes',
    framework: 'bmad',
    module: 'bmm',
    icon: '🎨',
    color: 'pink',
    borderColor: 'border-pink-500',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
  },
  'quick-flow-solo-dev': {
    id: 'bmad.bmm.quick-flow-solo-dev',
    name: 'Quick Flow Dev',
    persona: 'Barry',
    archetype: 'executor',
    description: 'Rapid end-to-end implementation',
    framework: 'bmad',
    module: 'bmm',
    icon: '🚀',
    color: 'red',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
  },
};

/**
 * BMAD CIS (Creative Innovation Strategy) Agents
 */
export const BMAD_CIS_AGENTS: Record<string, AgentDefinition> = {
  'brainstorming-coach': {
    id: 'bmad.cis.brainstorming-coach',
    name: 'Brainstorming Coach',
    persona: 'Carson',
    archetype: 'advisor',
    description: 'Ideation & breakthrough sessions',
    framework: 'bmad',
    module: 'cis',
    icon: '🧠',
    color: 'fuchsia',
    borderColor: 'border-fuchsia-500',
    bgColor: 'bg-fuchsia-500/20',
    textColor: 'text-fuchsia-400',
  },
  'creative-problem-solver': {
    id: 'bmad.cis.creative-problem-solver',
    name: 'Problem Solver',
    persona: 'Dr. Quinn',
    archetype: 'advisor',
    description: 'Systematic problem solving (TRIZ)',
    framework: 'bmad',
    module: 'cis',
    icon: '🔬',
    color: 'blue',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
  'design-thinking-coach': {
    id: 'bmad.cis.design-thinking-coach',
    name: 'Design Thinking Coach',
    persona: 'Maya',
    archetype: 'advisor',
    description: 'Human-centered design',
    framework: 'bmad',
    module: 'cis',
    icon: '🎨',
    color: 'pink',
    borderColor: 'border-pink-500',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
  },
  'innovation-strategist': {
    id: 'bmad.cis.innovation-strategist',
    name: 'Innovation Strategist',
    persona: 'Victor',
    archetype: 'advisor',
    description: 'Business model innovation',
    framework: 'bmad',
    module: 'cis',
    icon: '⚡',
    color: 'yellow',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  'presentation-master': {
    id: 'bmad.cis.presentation-master',
    name: 'Presentation Master',
    persona: 'Caravaggio',
    archetype: 'chronicler',
    description: 'Visual communication & decks',
    framework: 'bmad',
    module: 'cis',
    icon: '🎨',
    color: 'orange',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
  storyteller: {
    id: 'bmad.cis.storyteller',
    name: 'Storyteller',
    persona: 'Sophia',
    archetype: 'chronicler',
    description: 'Narrative crafting',
    framework: 'bmad',
    module: 'cis',
    icon: '📖',
    color: 'stone',
    borderColor: 'border-stone-500',
    bgColor: 'bg-stone-500/20',
    textColor: 'text-stone-400',
  },
};

/**
 * All BMAD Agents combined
 */
export const BMAD_AGENTS: Record<string, AgentDefinition> = {
  ...BMAD_CORE_AGENTS,
  ...BMAD_BMB_AGENTS,
  ...BMAD_BMM_AGENTS,
  ...BMAD_CIS_AGENTS,
};

/**
 * All agents from all frameworks
 */
export const ALL_AGENTS: Record<string, AgentDefinition> = {
  ...BOOTSTRAP_AGENTS,
  ...BMAD_AGENTS,
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
 * Resolve a legacy agent ID to its bootstrap equivalent
 */
export function resolveAgentId(agentId: string): string {
  const lowerId = agentId.toLowerCase();
  // Check BMAD agents first (they use their own IDs)
  if (BMAD_AGENTS[lowerId]) {
    return lowerId;
  }
  return LEGACY_AGENT_MAP[lowerId] || lowerId;
}

/**
 * Get the full agent definition for an agent ID (legacy, bootstrap, or BMAD)
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
 * BMAD agent options for dropdowns/filters (grouped by module)
 */
export const BMAD_AGENT_OPTIONS = [
  { value: '', label: 'All BMAD Agents' },
  // Core
  { value: 'bmad-master', label: '🧙 BMad Master', group: 'Core' },
  // BMB
  { value: 'agent-builder', label: '🤖 Agent Builder (Bond)', group: 'BMB' },
  { value: 'module-builder', label: '🏗️ Module Builder (Morgan)', group: 'BMB' },
  { value: 'workflow-builder', label: '🔄 Workflow Builder (Wendy)', group: 'BMB' },
  // BMM
  { value: 'analyst', label: '📊 Analyst (Mary)', group: 'BMM' },
  { value: 'bmm-architect', label: '🏗️ Architect (Winston)', group: 'BMM' },
  { value: 'dev', label: '💻 Developer (Amelia)', group: 'BMM' },
  { value: 'pm', label: '📋 Product Manager (John)', group: 'BMM' },
  { value: 'sm', label: '🏃 Scrum Master (Bob)', group: 'BMM' },
  { value: 'tea', label: '🧪 Test Architect (Murat)', group: 'BMM' },
  { value: 'tech-writer', label: '📚 Tech Writer (Paige)', group: 'BMM' },
  { value: 'ux-designer', label: '🎨 UX Designer (Sally)', group: 'BMM' },
  { value: 'quick-flow-solo-dev', label: '🚀 Quick Flow Dev (Barry)', group: 'BMM' },
  // CIS
  { value: 'brainstorming-coach', label: '🧠 Brainstorming Coach (Carson)', group: 'CIS' },
  { value: 'creative-problem-solver', label: '🔬 Problem Solver (Dr. Quinn)', group: 'CIS' },
  { value: 'design-thinking-coach', label: '🎨 Design Thinking (Maya)', group: 'CIS' },
  { value: 'innovation-strategist', label: '⚡ Innovation Strategist (Victor)', group: 'CIS' },
  { value: 'presentation-master', label: '🎨 Presentation Master (Caravaggio)', group: 'CIS' },
  { value: 'storyteller', label: '📖 Storyteller (Sophia)', group: 'CIS' },
];

/**
 * Combined agent options for dropdowns/filters
 */
export const AGENT_OPTIONS = [
  { value: '', label: 'All Agents' },
  // Vorion Bootstrap
  { value: 'architect', label: 'Architect', group: 'Vorion' },
  { value: 'scribe', label: 'Scribe', group: 'Vorion' },
  { value: 'sentinel', label: 'Sentinel', group: 'Vorion' },
  { value: 'builder', label: 'Builder', group: 'Vorion' },
  { value: 'tester', label: 'Tester', group: 'Vorion' },
  { value: 'council', label: 'Council', group: 'Vorion' },
  // BMAD Core
  { value: 'bmad-master', label: '🧙 BMad Master', group: 'BMAD Core' },
  // BMAD BMB
  { value: 'agent-builder', label: '🤖 Agent Builder', group: 'BMAD BMB' },
  { value: 'module-builder', label: '🏗️ Module Builder', group: 'BMAD BMB' },
  { value: 'workflow-builder', label: '🔄 Workflow Builder', group: 'BMAD BMB' },
  // BMAD BMM
  { value: 'analyst', label: '📊 Analyst', group: 'BMAD BMM' },
  { value: 'bmm-architect', label: '🏗️ BMM Architect', group: 'BMAD BMM' },
  { value: 'dev', label: '💻 Developer', group: 'BMAD BMM' },
  { value: 'pm', label: '📋 Product Manager', group: 'BMAD BMM' },
  { value: 'sm', label: '🏃 Scrum Master', group: 'BMAD BMM' },
  { value: 'tea', label: '🧪 Test Architect', group: 'BMAD BMM' },
  { value: 'tech-writer', label: '📚 Tech Writer', group: 'BMAD BMM' },
  { value: 'ux-designer', label: '🎨 UX Designer', group: 'BMAD BMM' },
  { value: 'quick-flow-solo-dev', label: '🚀 Quick Flow Dev', group: 'BMAD BMM' },
  // BMAD CIS
  { value: 'brainstorming-coach', label: '🧠 Brainstorming Coach', group: 'BMAD CIS' },
  { value: 'creative-problem-solver', label: '🔬 Problem Solver', group: 'BMAD CIS' },
  { value: 'design-thinking-coach', label: '🎨 Design Thinking', group: 'BMAD CIS' },
  { value: 'innovation-strategist', label: '⚡ Innovation Strategist', group: 'BMAD CIS' },
  { value: 'presentation-master', label: '🎨 Presentation Master', group: 'BMAD CIS' },
  { value: 'storyteller', label: '📖 Storyteller', group: 'BMAD CIS' },
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
 * All BMAD agent IDs
 */
export const ALL_BMAD_AGENT_IDS = Object.keys(BMAD_AGENTS);

/**
 * All agent IDs across all frameworks
 */
export const ALL_AGENT_IDS = [...ALL_VORION_AGENT_IDS, ...ALL_BMAD_AGENT_IDS];

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
 * Get BMAD agents by module
 */
export function getBmadAgentsByModule(module: string): AgentDefinition[] {
  return Object.values(BMAD_AGENTS).filter((agent) => agent.module === module);
}

/**
 * Check if an agent is a BMAD agent
 */
export function isBmadAgent(agentId: string): boolean {
  return agentId.toLowerCase() in BMAD_AGENTS;
}

/**
 * Check if an agent is a Vorion bootstrap agent
 */
export function isVorionAgent(agentId: string): boolean {
  const resolved = resolveAgentId(agentId.toLowerCase());
  return resolved in BOOTSTRAP_AGENTS;
}

export default ALL_AGENTS;
