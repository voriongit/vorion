/**
 * Skills Integration Module
 * Maps Aurais agent types and trust levels to skills library
 */

import {
  SKILLS,
  Skill,
  SKILL_CATEGORIES,
  getSkillsByCategory,
  getSkillsByTrustLevel,
  buildSkillSet,
  validateSkillUsage,
  getFullDependencyTree,
  TrustLevel as SkillTrustLevel,
} from './index.js';

import type { AgentType, AgentTier, TrustLevel } from '../types.js';

// ============================================================================
// Trust Level Mapping
// ============================================================================

/** Map Aurais TrustLevel names to numeric skill trust levels */
export const TRUST_LEVEL_MAP: Record<TrustLevel, SkillTrustLevel> = {
  SOVEREIGN: 5,   // T5 - Full autonomy
  EXECUTIVE: 4,   // T4 - Domain autonomy
  TACTICAL: 3,    // T3 - Project scope
  OPERATIONAL: 2, // T2 - Task execution
  WORKER: 1,      // T1 - Single task focus
  PASSIVE: 1,     // T0 - Observation only (limited to T1 skills)
};

/** Map AgentTier to skill trust levels */
export const TIER_TO_SKILL_LEVEL: Record<AgentTier, SkillTrustLevel> = {
  5: 5,
  4: 4,
  3: 3,
  2: 2,
  1: 1,
  0: 1,
};

// ============================================================================
// Agent Type to Skill Category Mapping
// ============================================================================

/** Primary skill categories for each agent type */
export const AGENT_TYPE_SKILLS: Record<AgentType, string[]> = {
  // T5 Core Types
  EXECUTOR: [
    SKILL_CATEGORIES.CORE_COGNITION,
    SKILL_CATEGORIES.GOVERNANCE_TRUST,
    SKILL_CATEGORIES.PROJECT_MANAGEMENT,
    SKILL_CATEGORIES.BUSINESS_OPERATIONS,
  ],
  PLANNER: [
    SKILL_CATEGORIES.CORE_COGNITION,
    SKILL_CATEGORIES.PROJECT_MANAGEMENT,
    SKILL_CATEGORIES.DATA_OPERATIONS,
    SKILL_CATEGORIES.BUSINESS_OPERATIONS,
  ],
  VALIDATOR: [
    SKILL_CATEGORIES.GOVERNANCE_TRUST,
    SKILL_CATEGORIES.SECURITY,
    SKILL_CATEGORIES.DATA_OPERATIONS,
    SKILL_CATEGORIES.CODE_DEVELOPMENT,
  ],
  EVOLVER: [
    SKILL_CATEGORIES.CORE_COGNITION,
    SKILL_CATEGORIES.CODE_DEVELOPMENT,
    SKILL_CATEGORIES.DATA_OPERATIONS,
    SKILL_CATEGORIES.GOVERNANCE_TRUST,
  ],
  SPAWNER: [
    SKILL_CATEGORIES.GOVERNANCE_TRUST,
    SKILL_CATEGORIES.PROJECT_MANAGEMENT,
    SKILL_CATEGORIES.CORE_COGNITION,
  ],

  // T4 Domain Orchestrator
  DOMAIN_ORCHESTRATOR: [
    SKILL_CATEGORIES.PROJECT_MANAGEMENT,
    SKILL_CATEGORIES.COMMUNICATION,
    SKILL_CATEGORIES.BUSINESS_OPERATIONS,
    SKILL_CATEGORIES.DATA_OPERATIONS,
  ],

  // T3 Task Orchestrator
  TASK_ORCHESTRATOR: [
    SKILL_CATEGORIES.PROJECT_MANAGEMENT,
    SKILL_CATEGORIES.COMMUNICATION,
    SKILL_CATEGORIES.DATA_OPERATIONS,
  ],

  // T2 Specialist (configurable per domain)
  SPECIALIST: [
    SKILL_CATEGORIES.CORE_COGNITION,
    SKILL_CATEGORIES.DATA_OPERATIONS,
    SKILL_CATEGORIES.COMMUNICATION,
  ],

  // T1 Worker (basic skills)
  WORKER: [
    SKILL_CATEGORIES.CORE_COGNITION,
    SKILL_CATEGORIES.DATA_OPERATIONS,
  ],

  // T0 Passive types
  LISTENER: [
    SKILL_CATEGORIES.CORE_COGNITION,
  ],
  OBSERVER: [
    SKILL_CATEGORIES.CORE_COGNITION,
  ],
};

// ============================================================================
// Skill Access Functions
// ============================================================================

/**
 * Get all skills available to an agent based on type and trust level
 */
export function getAgentSkills(
  agentType: AgentType,
  trustLevel: TrustLevel,
  additionalCategories?: string[],
): Skill[] {
  const skillTrustLevel = TRUST_LEVEL_MAP[trustLevel];
  const primaryCategories = AGENT_TYPE_SKILLS[agentType] || [];
  const allCategories = [...primaryCategories, ...(additionalCategories || [])];

  return buildSkillSet({
    trustLevel: skillTrustLevel,
    allowedCategories: allCategories.length > 0 ? allCategories : undefined,
    includeComposite: skillTrustLevel >= 2,
    includeBehavioral: skillTrustLevel >= 3,
  });
}

/**
 * Get skills for an agent by tier (numeric)
 */
export function getAgentSkillsByTier(
  agentType: AgentType,
  tier: AgentTier,
): Skill[] {
  const trustLevelNames: TrustLevel[] = [
    'PASSIVE', 'WORKER', 'OPERATIONAL', 'TACTICAL', 'EXECUTIVE', 'SOVEREIGN'
  ];
  const trustLevel = trustLevelNames[tier] || 'WORKER';
  return getAgentSkills(agentType, trustLevel);
}

/**
 * Check if an agent can use a specific skill
 */
export function canAgentUseSkill(
  agentType: AgentType,
  trustLevel: TrustLevel,
  skillId: string,
): { allowed: boolean; reason?: string } {
  const skillTrustLevel = TRUST_LEVEL_MAP[trustLevel];
  const validation = validateSkillUsage(skillId, skillTrustLevel);

  if (!validation.allowed) {
    return validation;
  }

  // Check if skill category is allowed for this agent type
  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill) {
    return { allowed: false, reason: `Skill "${skillId}" not found` };
  }

  const allowedCategories = AGENT_TYPE_SKILLS[agentType] || [];
  if (allowedCategories.length > 0 && !allowedCategories.includes(skill.category)) {
    return {
      allowed: false,
      reason: `Skill category "${skill.category}" not available to agent type "${agentType}"`,
    };
  }

  return { allowed: true };
}

/**
 * Get skill requirements for spawning a child agent
 */
export function getSpawnSkillRequirements(
  parentType: AgentType,
  parentTrustLevel: TrustLevel,
  childType: AgentType,
): { requiredSkills: string[]; available: boolean } {
  const requiredSkills: string[] = [];

  // Spawning requires governance skills
  const spawnSkills = getSkillsByCategory(SKILL_CATEGORIES.GOVERNANCE_TRUST);
  const spawnerId = 'governance.spawn_agent';
  const gateId = 'governance.gate_capability';

  if (spawnSkills.some(s => s.id === spawnerId)) {
    requiredSkills.push(spawnerId);
  }
  if (spawnSkills.some(s => s.id === gateId)) {
    requiredSkills.push(gateId);
  }

  // Check if parent has required skills
  const available = requiredSkills.every(skillId => {
    const check = canAgentUseSkill(parentType, parentTrustLevel, skillId);
    return check.allowed;
  });

  return { requiredSkills, available };
}

// ============================================================================
// Skill Export for Runtime
// ============================================================================

/**
 * Export skills manifest for an agent's runtime
 */
export function exportAgentSkillManifest(
  agentType: AgentType,
  trustLevel: TrustLevel,
): {
  agentType: AgentType;
  trustLevel: TrustLevel;
  skillTrustLevel: SkillTrustLevel;
  skills: Array<{
    id: string;
    name: string;
    tier: string;
    category: string;
    systemPrompt: string;
    inputs: Skill['inputs'];
    outputs: Skill['outputs'];
  }>;
  totalSkills: number;
} {
  const skills = getAgentSkills(agentType, trustLevel);
  const skillTrustLevel = TRUST_LEVEL_MAP[trustLevel];

  return {
    agentType,
    trustLevel,
    skillTrustLevel,
    skills: skills.map(s => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      category: s.category,
      systemPrompt: s.systemPrompt,
      inputs: s.inputs,
      outputs: s.outputs,
    })),
    totalSkills: skills.length,
  };
}

// ============================================================================
// Skill Statistics
// ============================================================================

/**
 * Get skills distribution summary for dashboard
 */
export function getSkillsSummary() {
  return {
    totalSkills: SKILLS.length,
    categories: Object.values(SKILL_CATEGORIES).filter(cat =>
      SKILLS.some(s => s.category === cat)
    ),
    byTrustLevel: {
      T1_WORKER: getSkillsByTrustLevel(1).length,
      T2_OPERATIONAL: getSkillsByTrustLevel(2).length - getSkillsByTrustLevel(1).length,
      T3_TACTICAL: getSkillsByTrustLevel(3).length - getSkillsByTrustLevel(2).length,
      T4_EXECUTIVE: getSkillsByTrustLevel(4).length - getSkillsByTrustLevel(3).length,
      T5_SOVEREIGN: getSkillsByTrustLevel(5).length - getSkillsByTrustLevel(4).length,
    },
    governanceSkills: getSkillsByCategory(SKILL_CATEGORIES.GOVERNANCE_TRUST).length,
    highRiskSkills: SKILLS.filter(s =>
      s.riskCategory === 'high' || s.riskCategory === 'critical'
    ).length,
    humanApprovalRequired: SKILLS.filter(s => s.requiresHumanApproval).length,
  };
}

export default {
  // Mappings
  TRUST_LEVEL_MAP,
  TIER_TO_SKILL_LEVEL,
  AGENT_TYPE_SKILLS,

  // Functions
  getAgentSkills,
  getAgentSkillsByTier,
  canAgentUseSkill,
  getSpawnSkillRequirements,
  exportAgentSkillManifest,
  getSkillsSummary,
};
