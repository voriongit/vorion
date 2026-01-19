/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGENT SKILLS LIBRARY v1.0.0 - MAIN INDEX
 * ═══════════════════════════════════════════════════════════════════════════════
 * Universal skills library for intelligent agents - "Agents of the People"
 * 
 * Integrates with:
 * - Aurais runtime
 * - AgentAnchor (A3I) certification & governance
 * - BAI Command Center (Advisors & Employees)
 * - Any agent framework requiring standardized skill definitions
 * 
 * @version 1.0.0
 * @license Proprietary - AgentAnchor A3I Framework
 */

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORT TYPES AND CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export * from './skills-part1.js';

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT ALL SKILL MODULES
// ═══════════════════════════════════════════════════════════════════════════════

import { SKILLS as SKILLS_PART1, Skill, SkillTier, TrustLevel, SKILL_CATEGORIES } from './skills-part1.js';
import { SKILLS_PART2 } from './skills-part2.js';
import { SKILLS_PART3 } from './skills-part3.js';

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATE ALL SKILLS
// ═══════════════════════════════════════════════════════════════════════════════

export const SKILLS: Skill[] = [
  ...SKILLS_PART1,
  ...SKILLS_PART2,
  ...SKILLS_PART3,
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOOKUP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Get a skill by its unique ID */
export const getSkillById = (id: string): Skill | undefined => 
  SKILLS.find(s => s.id === id);

/** Alias for getSkillById */
export const getSkill = getSkillById;

/** Get all skills in a category */
export const getSkillsByCategory = (category: string): Skill[] => 
  SKILLS.filter(s => s.category === category);

/** Get all skills of a specific tier */
export const getSkillsByTier = (tier: SkillTier): Skill[] => 
  SKILLS.filter(s => s.tier === tier);

/** Get skills accessible at a trust level (includes lower levels) */
export const getSkillsByTrustLevel = (level: TrustLevel): Skill[] => 
  SKILLS.filter(s => s.trustLevelRequired <= level);

/** Get skills requiring exactly a specific trust level */
export const getSkillsRequiringTrustLevel = (level: TrustLevel): Skill[] => 
  SKILLS.filter(s => s.trustLevelRequired === level);

/** Get skills with a specific tag */
export const getSkillsByTag = (tag: string): Skill[] => 
  SKILLS.filter(s => s.tags.includes(tag.toLowerCase()));

/** Get all atomic skills */
export const getAtomicSkills = (): Skill[] => 
  SKILLS.filter(s => s.tier === 'atomic');

/** Get all composite skills */
export const getCompositeSkills = (): Skill[] => 
  SKILLS.filter(s => s.tier === 'composite');

/** Get all behavioral skills */
export const getBehavioralSkills = (): Skill[] => 
  SKILLS.filter(s => s.tier === 'behavioral');

/** Get skills requiring human approval */
export const getHumanApprovalSkills = (): Skill[] =>
  SKILLS.filter(s => s.requiresHumanApproval);

/** Get high-risk skills (risk category high or critical) */
export const getHighRiskSkills = (): Skill[] =>
  SKILLS.filter(s => s.riskCategory === 'high' || s.riskCategory === 'critical');

/** Get skills by subcategory */
export const getSkillsBySubcategory = (category: string, subcategory: string): Skill[] =>
  SKILLS.filter(s => s.category === category && s.subcategory === subcategory);

/** Get skills that require specific tools */
export const getSkillsRequiringTool = (tool: string): Skill[] =>
  SKILLS.filter(s => s.toolsRequired.includes(tool));

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Search skills by text in name, description, or tags */
export const searchSkills = (query: string): Skill[] => {
  const lowerQuery = query.toLowerCase();
  return SKILLS.filter(skill => 
    skill.name.toLowerCase().includes(lowerQuery) ||
    skill.description.toLowerCase().includes(lowerQuery) ||
    skill.id.toLowerCase().includes(lowerQuery) ||
    skill.tags.some(tag => tag.includes(lowerQuery))
  );
};

/** Advanced skill search with multiple criteria */
export const advancedSearch = (criteria: {
  query?: string;
  category?: string;
  tier?: SkillTier;
  maxTrustLevel?: TrustLevel;
  tags?: string[];
  requiresHumanApproval?: boolean;
  riskCategory?: string;
}): Skill[] => {
  return SKILLS.filter(skill => {
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      const matchesQuery = skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.tags.some(t => t.includes(q));
      if (!matchesQuery) return false;
    }
    if (criteria.category && skill.category !== criteria.category) return false;
    if (criteria.tier && skill.tier !== criteria.tier) return false;
    if (criteria.maxTrustLevel && skill.trustLevelRequired > criteria.maxTrustLevel) return false;
    if (criteria.tags && !criteria.tags.every(t => skill.tags.includes(t))) return false;
    if (criteria.requiresHumanApproval !== undefined && 
        skill.requiresHumanApproval !== criteria.requiresHumanApproval) return false;
    if (criteria.riskCategory && skill.riskCategory !== criteria.riskCategory) return false;
    return true;
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEPENDENCY RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

/** Get all skills that a given skill depends on (composedOf) */
export const getSkillDependencies = (id: string): Skill[] => {
  const skill = getSkillById(id);
  if (!skill) return [];
  return skill.composedOf
    .map(depId => getSkillById(depId))
    .filter((s): s is Skill => s !== undefined);
};

/** Get all skills that depend on a given skill */
export const getSkillDependents = (id: string): Skill[] =>
  SKILLS.filter(skill => skill.composedOf.includes(id));

/** Get full dependency tree for a skill (recursive) */
export const getFullDependencyTree = (id: string, visited = new Set<string>()): Skill[] => {
  if (visited.has(id)) return [];
  visited.add(id);
  
  const skill = getSkillById(id);
  if (!skill) return [];
  
  const directDeps = getSkillDependencies(id);
  const allDeps = [...directDeps];
  
  for (const dep of directDeps) {
    const transitiveDeps = getFullDependencyTree(dep.id, visited);
    allDeps.push(...transitiveDeps);
  }
  
  return allDeps;
};

/** Get inherited trust level (highest of all dependencies) */
export const getInheritedTrustLevel = (id: string): TrustLevel => {
  const skill = getSkillById(id);
  if (!skill) return 1;
  
  const deps = getFullDependencyTree(id);
  const allLevels = [skill.trustLevelRequired, ...deps.map(d => d.trustLevelRequired)];
  return Math.max(...allLevels) as TrustLevel;
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Validate that all skill dependencies exist */
export const validateSkillComposition = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const skillIds = new Set(SKILLS.map(s => s.id));
  
  for (const skill of SKILLS) {
    for (const dep of skill.composedOf) {
      if (!skillIds.has(dep)) {
        errors.push(`Skill "${skill.id}" references non-existent dependency "${dep}"`);
      }
    }
    for (const prereq of skill.prerequisites) {
      if (!skillIds.has(prereq)) {
        errors.push(`Skill "${skill.id}" references non-existent prerequisite "${prereq}"`);
      }
    }
    for (const conflict of skill.conflicts) {
      if (!skillIds.has(conflict)) {
        errors.push(`Skill "${skill.id}" references non-existent conflict "${conflict}"`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
};

/** Check for circular dependencies */
export const checkCircularDependencies = (): { hasCircular: boolean; cycles: string[][] } => {
  const cycles: string[][] = [];
  
  const findCycle = (id: string, path: string[] = []): boolean => {
    if (path.includes(id)) {
      cycles.push([...path.slice(path.indexOf(id)), id]);
      return true;
    }
    
    const skill = getSkillById(id);
    if (!skill) return false;
    
    for (const dep of skill.composedOf) {
      if (findCycle(dep, [...path, id])) {
        return true;
      }
    }
    return false;
  };
  
  for (const skill of SKILLS) {
    findCycle(skill.id);
  }
  
  return { hasCircular: cycles.length > 0, cycles };
};

/** Validate a skill can be used by an agent at a given trust level */
export const validateSkillUsage = (skillId: string, agentTrustLevel: TrustLevel): {
  allowed: boolean;
  reason?: string;
  requiredLevel?: TrustLevel;
} => {
  const skill = getSkillById(skillId);
  if (!skill) {
    return { allowed: false, reason: `Skill "${skillId}" not found` };
  }
  
  const inheritedLevel = getInheritedTrustLevel(skillId);
  
  if (agentTrustLevel < inheritedLevel) {
    return {
      allowed: false,
      reason: `Agent trust level ${agentTrustLevel} is below required level ${inheritedLevel}`,
      requiredLevel: inheritedLevel,
    };
  }
  
  return { allowed: true };
};

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL SET BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/** Build a skill set for an agent based on trust level and allowed categories */
export const buildSkillSet = (config: {
  trustLevel: TrustLevel;
  allowedCategories?: string[];
  blockedSkills?: string[];
  includeComposite?: boolean;
  includeBehavioral?: boolean;
}): Skill[] => {
  let skills = SKILLS.filter(s => s.trustLevelRequired <= config.trustLevel);
  
  if (config.allowedCategories && config.allowedCategories.length > 0) {
    skills = skills.filter(s => config.allowedCategories!.includes(s.category));
  }
  
  if (config.blockedSkills && config.blockedSkills.length > 0) {
    skills = skills.filter(s => !config.blockedSkills!.includes(s.id));
  }
  
  if (config.includeComposite === false) {
    skills = skills.filter(s => s.tier !== 'composite');
  }
  
  if (config.includeBehavioral === false) {
    skills = skills.filter(s => s.tier !== 'behavioral');
  }
  
  return skills;
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/** Get comprehensive statistics about the skill registry */
export const getSkillStats = () => {
  const categories = Object.values(SKILL_CATEGORIES);
  
  return {
    total: SKILLS.length,
    
    byTier: {
      atomic: SKILLS.filter(s => s.tier === 'atomic').length,
      composite: SKILLS.filter(s => s.tier === 'composite').length,
      behavioral: SKILLS.filter(s => s.tier === 'behavioral').length,
    },
    
    byCategory: categories.reduce((acc, cat) => {
      const count = SKILLS.filter(s => s.category === cat).length;
      if (count > 0) acc[cat] = count;
      return acc;
    }, {} as Record<string, number>),
    
    byTrustLevel: {
      1: SKILLS.filter(s => s.trustLevelRequired === 1).length,
      2: SKILLS.filter(s => s.trustLevelRequired === 2).length,
      3: SKILLS.filter(s => s.trustLevelRequired === 3).length,
      4: SKILLS.filter(s => s.trustLevelRequired === 4).length,
      5: SKILLS.filter(s => s.trustLevelRequired === 5).length,
    },
    
    byRiskCategory: {
      none: SKILLS.filter(s => s.riskCategory === 'none').length,
      low: SKILLS.filter(s => s.riskCategory === 'low').length,
      medium: SKILLS.filter(s => s.riskCategory === 'medium').length,
      high: SKILLS.filter(s => s.riskCategory === 'high').length,
      critical: SKILLS.filter(s => s.riskCategory === 'critical').length,
    },
    
    requiresHumanApproval: SKILLS.filter(s => s.requiresHumanApproval).length,
    
    withToolRequirements: SKILLS.filter(s => s.toolsRequired.length > 0).length,
    
    uniqueTags: [...new Set(SKILLS.flatMap(s => s.tags))].length,
    
    categoriesUsed: categories.filter(cat => 
      SKILLS.some(s => s.category === cat)
    ).length,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Export skills to JSON string */
export const exportSkillsToJSON = (skills?: Skill[]): string => 
  JSON.stringify(skills || SKILLS, null, 2);

/** Export skills manifest */
export const exportManifest = (): {
  version: string;
  generatedAt: string;
  stats: ReturnType<typeof getSkillStats>;
  validation: ReturnType<typeof validateSkillComposition>;
} => ({
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  stats: getSkillStats(),
  validation: validateSkillComposition(),
});

/** Export for runtime consumption (lighter weight) */
export const exportForRuntime = (skills?: Skill[]): Array<{
  id: string;
  name: string;
  tier: SkillTier;
  category: string;
  trustLevelRequired: TrustLevel;
  description: string;
  systemPrompt: string;
  inputs: Skill['inputs'];
  outputs: Skill['outputs'];
  composedOf: string[];
  toolsRequired: string[];
}> => (skills || SKILLS).map(s => ({
  id: s.id,
  name: s.name,
  tier: s.tier,
  category: s.category,
  trustLevelRequired: s.trustLevelRequired,
  description: s.description,
  systemPrompt: s.systemPrompt,
  inputs: s.inputs,
  outputs: s.outputs,
  composedOf: s.composedOf,
  toolsRequired: s.toolsRequired,
}));

// ═══════════════════════════════════════════════════════════════════════════════
// A3I / GOVERNANCE SPECIFIC UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Get all governance/trust skills for A3I integration */
export const getA3ISkills = (): Skill[] =>
  getSkillsByCategory(SKILL_CATEGORIES.GOVERNANCE_TRUST);

/** Get skills suitable for certification testing */
export const getCertificationTestSkills = (trustLevel: TrustLevel): Skill[] =>
  SKILLS.filter(s => 
    s.trustLevelRequired === trustLevel &&
    s.testFixtures.length > 0
  );

/** Build minimal skill set for shadow training evaluation */
export const buildShadowTrainingSet = (agentType: string): Skill[] => {
  // Always include core cognition and governance
  const baseCategories = [
    SKILL_CATEGORIES.CORE_COGNITION,
    SKILL_CATEGORIES.GOVERNANCE_TRUST,
  ];
  
  return SKILLS.filter(s => 
    baseCategories.includes(s.category as any) &&
    s.tier === 'atomic' &&
    s.trustLevelRequired <= 2
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  // Data
  SKILLS,
  SKILL_CATEGORIES,
  
  // Lookups
  getSkillById,
  getSkill,
  getSkillsByCategory,
  getSkillsByTier,
  getSkillsByTrustLevel,
  getSkillsRequiringTrustLevel,
  getSkillsByTag,
  getSkillsBySubcategory,
  getSkillsRequiringTool,
  getAtomicSkills,
  getCompositeSkills,
  getBehavioralSkills,
  getHumanApprovalSkills,
  getHighRiskSkills,
  
  // Search
  searchSkills,
  advancedSearch,
  
  // Dependencies
  getSkillDependencies,
  getSkillDependents,
  getFullDependencyTree,
  getInheritedTrustLevel,
  
  // Validation
  validateSkillComposition,
  checkCircularDependencies,
  validateSkillUsage,
  
  // Building
  buildSkillSet,
  
  // Stats
  getSkillStats,
  
  // Export
  exportSkillsToJSON,
  exportManifest,
  exportForRuntime,
  
  // A3I
  getA3ISkills,
  getCertificationTestSkills,
  buildShadowTrainingSet,
};
