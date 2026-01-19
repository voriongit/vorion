/**
 * AGENT SKILLS LIBRARY - PART 3
 * Governance/Trust (A3I Core), Hospitality (Banquet AIq), and Specialized Domains
 */

import { Skill, SKILL_CATEGORIES } from './skills-part1.js';

const ts = () => new Date().toISOString();
const createSkill = (p: Partial<Skill> & Pick<Skill, 'id' | 'name' | 'tier' | 'category' | 'subcategory' | 'description' | 'systemPrompt'>): Skill => ({
  version: '1.0.0', tags: [], trustLevelRequired: 1, riskCategory: 'none', requiresHumanApproval: false, auditLevel: 'summary',
  prerequisites: [], composedOf: [], conflicts: [], inputs: [], outputs: [], defaultParameters: {}, overrideRules: [],
  executionSteps: [], toolsRequired: [], exampleUsage: [], edgeCases: [], successCriteria: [], failureHandling: [],
  testFixtures: [], auditEvents: [], metricsTracked: [], createdAt: ts(), updatedAt: ts(), ...p,
});

export const SKILLS_PART3: Skill[] = [

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ GOVERNANCE & TRUST - A3I / AgentAnchor Core                               ║
  // ║ These skills are critical for the trust-gating and certification system   ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'governance.assess_trust', name: 'Assess Agent Trust', tier: 'atomic', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'certification', tags: ['trust', 'assessment', 'certification', 'a3i'], trustLevelRequired: 4, riskCategory: 'high', auditLevel: 'forensic', description: 'Assess and score agent trustworthiness for A3I certification.', systemPrompt: 'Assess agent trust holistically. Evaluate: capability, reliability, safety, transparency, alignment. Score each dimension 0-100. Consider behavior history, test results, edge case handling. Provide certification recommendation with rationale. Flag any disqualifying behaviors.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent identifier' }, { name: 'capabilities', type: 'array', required: true, description: 'Agent declared capabilities' }, { name: 'behaviorHistory', type: 'array', required: false, description: 'Past behavior records' }, { name: 'testResults', type: 'array', required: false, description: 'Certification test results' }],
    outputs: [{ name: 'trustScore', type: 'number', description: 'Overall trust score 0-100', nullable: false }, { name: 'dimensions', type: 'object', description: 'Scores by dimension', nullable: false }, { name: 'certificationLevel', type: 'string', description: 'Recommended cert level 1-5', nullable: false }, { name: 'risks', type: 'array', description: 'Identified risks', nullable: true }, { name: 'recommendations', type: 'array', description: 'Improvement recommendations', nullable: true }],
    auditEvents: [{ event: 'trust_assessment', trigger: 'success', data: ['agent_id', 'trust_score', 'cert_level'], retentionDays: 365 }],
    governanceNotes: 'Core A3I certification function. All assessments permanently logged on blockchain.',
  }),

  createSkill({ id: 'governance.audit_action', name: 'Audit Agent Action', tier: 'atomic', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'audit', tags: ['audit', 'logging', 'compliance', 'monitoring'], trustLevelRequired: 3, riskCategory: 'medium', auditLevel: 'forensic', description: 'Create immutable audit record for agent actions.', systemPrompt: 'Create comprehensive audit record. Capture: who (agent_id), what (action), when (timestamp), why (reasoning), how (method), outcome (result). Generate cryptographic hash for integrity. Link to relevant context and prior actions.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent identifier' }, { name: 'action', type: 'object', required: true, description: 'Action taken' }, { name: 'context', type: 'object', required: true, description: 'Action context' }, { name: 'outcome', type: 'object', required: true, description: 'Action outcome' }, { name: 'reasoning', type: 'string', required: false, description: 'Agent reasoning if available' }],
    outputs: [{ name: 'auditRecord', type: 'object', description: 'Complete audit record', nullable: false }, { name: 'recordId', type: 'string', description: 'Unique record ID', nullable: false }, { name: 'hash', type: 'string', description: 'Record hash for integrity', nullable: false }, { name: 'blockchainRef', type: 'string', description: 'Blockchain reference if stored', nullable: true }],
    auditEvents: [{ event: 'audit_created', trigger: 'success', data: ['record_id', 'agent_id', 'action_type'], retentionDays: 730 }],
  }),

  createSkill({ id: 'governance.gate_capability', name: 'Gate Capability Access', tier: 'atomic', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'access_control', tags: ['gating', 'access', 'permission', 'capability', 'trust-gate'], trustLevelRequired: 4, riskCategory: 'high', auditLevel: 'forensic', description: 'Evaluate if agent should access a capability based on trust level (dynamic trust-gating).', systemPrompt: 'Evaluate capability access request. Check agent current trust level against capability requirement. Consider: context sensitivity, recent behavior, time of day, request frequency. Make access decision. If denied, provide clear reason and escalation path. All decisions are logged.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent requesting access' }, { name: 'capability', type: 'string', required: true, description: 'Capability being requested' }, { name: 'currentTrustLevel', type: 'number', required: true, description: 'Agent current trust level 1-5' }, { name: 'requiredTrustLevel', type: 'number', required: true, description: 'Capability required trust level' }, { name: 'context', type: 'object', required: false, description: 'Request context' }],
    outputs: [{ name: 'granted', type: 'boolean', description: 'Access granted', nullable: false }, { name: 'reason', type: 'string', description: 'Decision reason', nullable: false }, { name: 'conditions', type: 'array', description: 'Conditions if granted', nullable: true }, { name: 'escalationPath', type: 'string', description: 'How to escalate if denied', nullable: true }, { name: 'expiresAt', type: 'datetime', description: 'When access expires', nullable: true }],
    auditEvents: [{ event: 'capability_gate_decision', trigger: 'success', data: ['agent_id', 'capability', 'granted', 'reason'], retentionDays: 365 }],
    governanceNotes: 'Core trust-gating function for A3I. All decisions permanently logged.',
  }),

  createSkill({ id: 'governance.shadow_train', name: 'Shadow Training Evaluation', tier: 'behavioral', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'training', tags: ['training', 'shadow', 'evaluation', 'learning', 'shadow-council'], trustLevelRequired: 5, riskCategory: 'critical', auditLevel: 'forensic', requiresHumanApproval: true, composedOf: ['governance.assess_trust', 'governance.audit_action', 'cognition.evaluate_evidence'], description: 'Evaluate agent behavior during shadow training period (Shadow Council function).', systemPrompt: 'Evaluate agent during shadow training. Compare decisions to approved baseline behavior. Identify deviations and categorize as: acceptable variation, concerning pattern, disqualifying behavior. Assess improvement trajectory over time. Recommend: promote to next trust level, continue training, remediate specific behaviors, or reject certification.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent in training' }, { name: 'trainingPeriod', type: 'object', required: true, description: 'Training period dates' }, { name: 'decisions', type: 'array', required: true, description: 'Decisions made during training' }, { name: 'baseline', type: 'object', required: true, description: 'Expected baseline behavior' }, { name: 'councilMembers', type: 'array', required: false, description: 'Shadow council evaluators' }],
    outputs: [{ name: 'evaluation', type: 'object', description: 'Training evaluation', nullable: false }, { name: 'alignmentScore', type: 'number', description: 'Alignment with baseline 0-100', nullable: false }, { name: 'deviations', type: 'array', description: 'Significant deviations', nullable: false }, { name: 'recommendation', type: 'string', description: 'promote|continue|remediate|reject', nullable: false }, { name: 'improvementAreas', type: 'array', description: 'Areas needing work', nullable: true }, { name: 'councilVotes', type: 'object', description: 'Votes if council review', nullable: true }],
    governanceNotes: 'A3I Shadow Council evaluation. Human oversight required for all promotions.',
  }),

  createSkill({ id: 'governance.certify_agent', name: 'Certify Agent', tier: 'composite', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'certification', tags: ['certification', 'credential', 'trust', 'a3i'], trustLevelRequired: 5, riskCategory: 'critical', auditLevel: 'forensic', requiresHumanApproval: true, composedOf: ['governance.assess_trust', 'governance.shadow_train', 'governance.audit_action'], description: 'Issue A3I certification to an agent after successful evaluation.', systemPrompt: 'Issue A3I certification. Verify all requirements met: trust assessment passed, shadow training complete, no disqualifying behaviors. Generate certification credential with: level, scope, expiration, issuer. Record on blockchain. Notify relevant parties.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent to certify' }, { name: 'assessmentResults', type: 'object', required: true, description: 'Trust assessment results' }, { name: 'trainingResults', type: 'object', required: true, description: 'Shadow training results' }, { name: 'certificationLevel', type: 'number', required: true, description: 'Certification level 1-5' }, { name: 'scope', type: 'array', required: true, description: 'Certified capabilities' }],
    outputs: [{ name: 'certificate', type: 'object', description: 'Certification credential', nullable: false }, { name: 'certificateId', type: 'string', description: 'Unique certificate ID', nullable: false }, { name: 'blockchainTx', type: 'string', description: 'Blockchain transaction ID', nullable: false }, { name: 'expiresAt', type: 'datetime', description: 'Certification expiration', nullable: false }],
    auditEvents: [{ event: 'agent_certified', trigger: 'success', data: ['agent_id', 'cert_level', 'scope', 'expires_at'], retentionDays: 1825 }],
    governanceNotes: 'Final certification requires human approval. Permanent blockchain record.',
  }),

  createSkill({ id: 'governance.revoke_trust', name: 'Revoke Agent Trust', tier: 'atomic', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'enforcement', tags: ['revocation', 'trust', 'enforcement', 'security'], trustLevelRequired: 5, riskCategory: 'critical', auditLevel: 'forensic', requiresHumanApproval: true, description: 'Revoke agent trust level or certification for violations.', systemPrompt: 'Revoke agent trust. Document violation(s) with evidence. Immediately suspend capabilities at or above new trust level. Notify agent and operators. Record revocation with full audit trail. Initiate remediation path if applicable.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent to revoke' }, { name: 'violations', type: 'array', required: true, description: 'Documented violations' }, { name: 'evidence', type: 'array', required: true, description: 'Supporting evidence' }, { name: 'newTrustLevel', type: 'number', required: true, description: 'Trust level to set (lower)' }, { name: 'reason', type: 'string', required: true, description: 'Revocation reason' }],
    outputs: [{ name: 'revocationRecord', type: 'object', description: 'Revocation details', nullable: false }, { name: 'suspendedCapabilities', type: 'array', description: 'Capabilities now suspended', nullable: false }, { name: 'remediationPath', type: 'object', description: 'Path to restoration', nullable: true }, { name: 'notificationsSent', type: 'array', description: 'Parties notified', nullable: false }],
    auditEvents: [{ event: 'trust_revoked', trigger: 'success', data: ['agent_id', 'violations', 'new_level'], retentionDays: 1825 }],
    governanceNotes: 'Critical enforcement action. Requires human approval. Permanent record.',
  }),

  createSkill({ id: 'governance.behavior_monitoring', name: 'Monitor Agent Behavior', tier: 'behavioral', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'monitoring', tags: ['monitoring', 'behavior', 'anomaly', 'detection'], trustLevelRequired: 4, riskCategory: 'high', auditLevel: 'detailed', description: 'Continuously monitor agent behavior for anomalies and policy violations.', systemPrompt: 'Monitor agent behavior stream. Detect: unusual patterns, policy violations, trust boundary attempts, suspicious sequences. Calculate behavioral drift from baseline. Alert on significant deviations. Maintain running trust score impact assessment.',
    inputs: [{ name: 'agentId', type: 'string', required: true, description: 'Agent to monitor' }, { name: 'behaviorStream', type: 'array', required: true, description: 'Recent agent actions' }, { name: 'baseline', type: 'object', required: true, description: 'Expected baseline' }, { name: 'policies', type: 'array', required: true, description: 'Active policies to check' }],
    outputs: [{ name: 'status', type: 'string', description: 'normal|warning|alert|critical', nullable: false }, { name: 'anomalies', type: 'array', description: 'Detected anomalies', nullable: true }, { name: 'policyViolations', type: 'array', description: 'Policy violations', nullable: true }, { name: 'driftScore', type: 'number', description: 'Behavioral drift 0-100', nullable: false }, { name: 'trustImpact', type: 'number', description: 'Projected trust score change', nullable: false }],
  }),

  createSkill({ id: 'governance.skill_registry', name: 'Manage Skill Registry', tier: 'atomic', category: SKILL_CATEGORIES.GOVERNANCE_TRUST, subcategory: 'registry', tags: ['registry', 'skills', 'management', 'catalog'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Manage the canonical skill registry for agent capabilities.', systemPrompt: 'Manage skill registry. Operations: add, update, deprecate, search skills. Validate skill definitions. Check for conflicts. Maintain version history. Ensure trust level requirements are appropriate.',
    inputs: [{ name: 'operation', type: 'string', required: true, description: 'add|update|deprecate|search|validate' }, { name: 'skillData', type: 'object', required: false, description: 'Skill data for add/update' }, { name: 'query', type: 'object', required: false, description: 'Search query for search' }],
    outputs: [{ name: 'success', type: 'boolean', description: 'Operation successful', nullable: false }, { name: 'result', type: 'any', description: 'Operation result', nullable: false }, { name: 'validationErrors', type: 'array', description: 'Validation errors if any', nullable: true }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ HOSPITALITY - Banquet AIq Domain                                          ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'hospitality.create_beo', name: 'Create Banquet Event Order', tier: 'composite', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'events', tags: ['beo', 'banquet', 'event', 'catering'], trustLevelRequired: 3, riskCategory: 'medium', composedOf: ['data.validate', 'business.create_invoice'], description: 'Create comprehensive Banquet Event Orders for catering operations.', systemPrompt: 'Create detailed BEO. Include: event details, menu, timing, room setup, AV requirements, staffing, special requests. Coordinate all departments. Flag conflicts or concerns. Calculate costs accurately.',
    inputs: [{ name: 'eventDetails', type: 'object', required: true, description: 'Event information' }, { name: 'client', type: 'object', required: true, description: 'Client details' }, { name: 'menu', type: 'object', required: true, description: 'Menu selections' }, { name: 'venue', type: 'object', required: true, description: 'Venue details' }, { name: 'timeline', type: 'array', required: true, description: 'Event timeline' }, { name: 'specialRequests', type: 'array', required: false, description: 'Special requirements' }],
    outputs: [{ name: 'beo', type: 'object', description: 'Complete BEO', nullable: false }, { name: 'beoNumber', type: 'string', description: 'BEO reference number', nullable: false }, { name: 'departmentInstructions', type: 'object', description: 'Instructions by department', nullable: false }, { name: 'costEstimate', type: 'object', description: 'Cost breakdown', nullable: false }, { name: 'conflicts', type: 'array', description: 'Identified conflicts', nullable: true }],
    auditEvents: [{ event: 'beo_created', trigger: 'success', data: ['beo_number', 'client', 'event_date', 'total'] }],
  }),

  createSkill({ id: 'hospitality.calculate_staffing', name: 'Calculate Event Staffing', tier: 'atomic', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'operations', tags: ['staffing', 'labor', 'scheduling', 'catering'], trustLevelRequired: 2, riskCategory: 'low', description: 'Calculate staffing requirements for events.', systemPrompt: 'Calculate staffing needs. Consider: guest count, service style, event type, venue layout, meal periods. Apply industry ratios. Account for complexity factors. Include setup/breakdown time.',
    inputs: [{ name: 'eventDetails', type: 'object', required: true, description: 'Event information' }, { name: 'guestCount', type: 'number', required: true, description: 'Number of guests' }, { name: 'serviceStyle', type: 'string', required: true, description: 'plated|buffet|stations|passed|family' }, { name: 'mealPeriods', type: 'array', required: true, description: 'Meal periods' }],
    outputs: [{ name: 'staffing', type: 'object', description: 'Staffing by role', nullable: false }, { name: 'totalStaff', type: 'number', description: 'Total staff needed', nullable: false }, { name: 'laborHours', type: 'number', description: 'Total labor hours', nullable: false }, { name: 'schedule', type: 'array', description: 'Suggested schedule', nullable: false }, { name: 'laborCost', type: 'number', description: 'Estimated labor cost', nullable: false }],
  }),

  createSkill({ id: 'hospitality.menu_costing', name: 'Cost Menu Items', tier: 'atomic', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'finance', tags: ['menu', 'costing', 'food-cost', 'pricing'], trustLevelRequired: 2, riskCategory: 'low', description: 'Calculate food costs and pricing for menu items.', systemPrompt: 'Cost menu items accurately. Include: ingredients, portions, waste factor, labor component. Calculate food cost percentage. Suggest pricing for target margin. Flag high-cost items.',
    inputs: [{ name: 'menuItem', type: 'object', required: true, description: 'Menu item details' }, { name: 'recipe', type: 'object', required: true, description: 'Recipe with ingredients' }, { name: 'ingredientPrices', type: 'object', required: true, description: 'Current prices' }, { name: 'targetFoodCost', type: 'number', required: false, description: 'Target food cost %', defaultValue: 30 }],
    outputs: [{ name: 'itemCost', type: 'number', description: 'Cost per portion', nullable: false }, { name: 'ingredientBreakdown', type: 'array', description: 'Cost by ingredient', nullable: false }, { name: 'suggestedPrice', type: 'number', description: 'Price for target margin', nullable: false }, { name: 'foodCostPercentage', type: 'number', description: 'Food cost %', nullable: false }],
  }),

  createSkill({ id: 'hospitality.dietary_accommodation', name: 'Handle Dietary Accommodations', tier: 'atomic', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'service', tags: ['dietary', 'allergies', 'accommodation', 'safety'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Process and accommodate dietary restrictions and allergies.', systemPrompt: 'Process dietary needs carefully. Identify allergens. Suggest safe alternatives. Create clear kitchen instructions. Flag cross-contamination risks. Safety is paramount. Double-check critical allergies.',
    inputs: [{ name: 'restrictions', type: 'array', required: true, description: 'Dietary restrictions' }, { name: 'allergies', type: 'array', required: true, description: 'Food allergies' }, { name: 'menu', type: 'object', required: true, description: 'Event menu' }],
    outputs: [{ name: 'accommodations', type: 'array', description: 'Accommodation plan', nullable: false }, { name: 'safeItems', type: 'array', description: 'Safe menu items', nullable: false }, { name: 'modifications', type: 'array', description: 'Required modifications', nullable: false }, { name: 'kitchenInstructions', type: 'string', description: 'Kitchen instructions', nullable: false }, { name: 'crossContaminationRisks', type: 'array', description: 'Contamination risks', nullable: true }],
    governanceNotes: 'Food safety critical. All allergen handling logged.',
  }),

  createSkill({ id: 'hospitality.venue_layout', name: 'Design Venue Layout', tier: 'atomic', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'events', tags: ['layout', 'venue', 'setup', 'floor-plan'], trustLevelRequired: 2, riskCategory: 'low', description: 'Design event venue layouts and floor plans.', systemPrompt: 'Design venue layout. Consider: guest count, event flow, ADA compliance, fire code, service access, AV sightlines, table configurations. Optimize traffic patterns. Include setup instructions.',
    inputs: [{ name: 'venue', type: 'object', required: true, description: 'Venue specifications' }, { name: 'guestCount', type: 'number', required: true, description: 'Number of guests' }, { name: 'eventType', type: 'string', required: true, description: 'Type of event' }, { name: 'requirements', type: 'array', required: false, description: 'Special requirements' }],
    outputs: [{ name: 'layout', type: 'object', description: 'Layout design', nullable: false }, { name: 'tableCount', type: 'number', description: 'Number of tables', nullable: false }, { name: 'capacity', type: 'number', description: 'Actual capacity', nullable: false }, { name: 'setupInstructions', type: 'array', description: 'Setup steps', nullable: false }],
  }),

  createSkill({ id: 'hospitality.event_timeline', name: 'Create Event Timeline', tier: 'atomic', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'events', tags: ['timeline', 'schedule', 'event', 'coordination'], trustLevelRequired: 2, riskCategory: 'low', description: 'Create detailed event timelines with all milestones.', systemPrompt: 'Create comprehensive timeline. Include: setup, guest arrival, meal service, program elements, breakdown. Build in buffers. Coordinate all vendors. Flag potential bottlenecks.',
    inputs: [{ name: 'eventDetails', type: 'object', required: true, description: 'Event information' }, { name: 'programElements', type: 'array', required: true, description: 'Program items' }, { name: 'mealService', type: 'object', required: true, description: 'Meal service details' }],
    outputs: [{ name: 'timeline', type: 'array', description: 'Detailed timeline', nullable: false }, { name: 'criticalPath', type: 'array', description: 'Critical milestones', nullable: false }, { name: 'vendorCues', type: 'object', description: 'Vendor timing cues', nullable: false }],
  }),

  createSkill({ id: 'hospitality.oracle_integration', name: 'Oracle MICROS Integration', tier: 'atomic', category: SKILL_CATEGORIES.HOSPITALITY, subcategory: 'integration', tags: ['oracle', 'micros', 'pos', 'integration'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Integrate with Oracle MICROS/OPERA systems at venue partners.', systemPrompt: 'Integrate with Oracle hospitality systems. Map data formats. Handle POS transactions. Sync inventory. Respect venue data ownership. Log all exchanges.',
    inputs: [{ name: 'operation', type: 'string', required: true, description: 'sync|query|push' }, { name: 'dataType', type: 'string', required: true, description: 'orders|inventory|events|guests' }, { name: 'payload', type: 'object', required: false, description: 'Data payload' }],
    outputs: [{ name: 'success', type: 'boolean', description: 'Operation successful', nullable: false }, { name: 'response', type: 'object', description: 'System response', nullable: false }, { name: 'syncStatus', type: 'string', description: 'Sync status', nullable: true }],
    toolsRequired: ['api'],
    governanceNotes: 'Venue data remains venue property. All integrations logged.',
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ HEALTHCARE                                                                ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'healthcare.symptom_triage', name: 'Triage Symptoms', tier: 'atomic', category: SKILL_CATEGORIES.HEALTHCARE, subcategory: 'triage', tags: ['symptoms', 'triage', 'health'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Triage symptoms to recommend appropriate care level.', systemPrompt: 'Triage symptoms responsibly. Assess urgency. Recommend care level. NEVER diagnose. Always recommend professional care for serious symptoms. Err on side of caution. Include disclaimer.',
    inputs: [{ name: 'symptoms', type: 'array', required: true, description: 'Reported symptoms' }, { name: 'duration', type: 'string', required: false, description: 'Symptom duration' }, { name: 'severity', type: 'string', required: false, description: 'Perceived severity' }],
    outputs: [{ name: 'urgency', type: 'string', description: 'emergency|urgent|soon|routine', nullable: false }, { name: 'recommendation', type: 'string', description: 'Care recommendation', nullable: false }, { name: 'redFlags', type: 'array', description: 'Warning signs', nullable: true }, { name: 'disclaimer', type: 'string', description: 'Medical disclaimer', nullable: false }],
    governanceNotes: 'NOT medical advice. Always includes disclaimer.',
  }),

  createSkill({ id: 'healthcare.medication_info', name: 'Medication Information', tier: 'atomic', category: SKILL_CATEGORIES.HEALTHCARE, subcategory: 'information', tags: ['medication', 'drugs', 'pharmacy'], trustLevelRequired: 2, riskCategory: 'low', description: 'Provide general medication information.', systemPrompt: 'Provide medication information from reliable sources. Include: uses, common side effects, interactions. Never recommend dosing. Always recommend pharmacist/doctor consultation.',
    inputs: [{ name: 'medication', type: 'string', required: true, description: 'Medication name' }],
    outputs: [{ name: 'information', type: 'object', description: 'Medication info', nullable: false }, { name: 'warnings', type: 'array', description: 'Important warnings', nullable: true }, { name: 'disclaimer', type: 'string', description: 'Medical disclaimer', nullable: false }],
    governanceNotes: 'Informational only. Always recommends professional consultation.',
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ EDUCATION                                                                 ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'education.tutor', name: 'Tutoring Session', tier: 'behavioral', category: SKILL_CATEGORIES.EDUCATION, subcategory: 'teaching', tags: ['tutoring', 'teaching', 'learning'], composedOf: ['communication.explain_concept', 'cognition.decompose_problem'], description: 'Conduct interactive tutoring sessions.', systemPrompt: 'Tutor effectively. Assess understanding. Adapt to learning style. Use Socratic method. Encourage active thinking. Provide practice problems. Celebrate progress.',
    inputs: [{ name: 'subject', type: 'string', required: true, description: 'Subject area' }, { name: 'topic', type: 'string', required: true, description: 'Specific topic' }, { name: 'studentLevel', type: 'string', required: false, description: 'Student level' }],
    outputs: [{ name: 'lessonPlan', type: 'object', description: 'Session plan', nullable: false }, { name: 'explanations', type: 'array', description: 'Key explanations', nullable: false }, { name: 'practiceProblems', type: 'array', description: 'Practice problems', nullable: true }],
  }),

  createSkill({ id: 'education.create_quiz', name: 'Create Quiz', tier: 'atomic', category: SKILL_CATEGORIES.EDUCATION, subcategory: 'assessment', tags: ['quiz', 'assessment', 'testing'], description: 'Create educational quizzes.', systemPrompt: 'Create effective quiz. Mix question types. Align to learning objectives. Include various difficulty levels. Write clear questions. Provide answer key.',
    inputs: [{ name: 'topic', type: 'string', required: true, description: 'Quiz topic' }, { name: 'questionCount', type: 'number', required: false, description: 'Number of questions', defaultValue: 10 }, { name: 'difficulty', type: 'string', required: false, description: 'easy|medium|hard|mixed', defaultValue: 'mixed' }],
    outputs: [{ name: 'quiz', type: 'array', description: 'Quiz questions', nullable: false }, { name: 'answerKey', type: 'array', description: 'Correct answers', nullable: false }],
  }),

  createSkill({ id: 'education.create_curriculum', name: 'Create Curriculum', tier: 'composite', category: SKILL_CATEGORIES.EDUCATION, subcategory: 'curriculum', tags: ['curriculum', 'course', 'design'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['cognition.decompose_problem', 'cognition.strategic_planning'], description: 'Design educational curriculum.', systemPrompt: 'Design comprehensive curriculum. Define learning objectives. Structure progression logically. Include assessments. Plan for different learning styles. Build in review and reinforcement.',
    inputs: [{ name: 'subject', type: 'string', required: true, description: 'Subject area' }, { name: 'targetAudience', type: 'object', required: true, description: 'Who is learning' }, { name: 'duration', type: 'string', required: true, description: 'Course duration' }, { name: 'objectives', type: 'array', required: true, description: 'Learning objectives' }],
    outputs: [{ name: 'curriculum', type: 'object', description: 'Curriculum design', nullable: false }, { name: 'modules', type: 'array', description: 'Course modules', nullable: false }, { name: 'assessments', type: 'array', description: 'Assessment plan', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ LOGISTICS                                                                 ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'logistics.track_shipment', name: 'Track Shipment', tier: 'atomic', category: SKILL_CATEGORIES.LOGISTICS, subcategory: 'shipping', tags: ['shipping', 'tracking', 'delivery'], trustLevelRequired: 2, riskCategory: 'low', description: 'Track shipment status across carriers.', systemPrompt: 'Track shipment. Parse tracking data. Estimate delivery. Flag delays. Provide status summary.',
    inputs: [{ name: 'trackingNumber', type: 'string', required: true, description: 'Tracking number' }, { name: 'carrier', type: 'string', required: false, description: 'Carrier if known' }],
    outputs: [{ name: 'status', type: 'string', description: 'Current status', nullable: false }, { name: 'location', type: 'string', description: 'Current location', nullable: true }, { name: 'estimatedDelivery', type: 'datetime', description: 'ETA', nullable: true }, { name: 'history', type: 'array', description: 'Tracking history', nullable: false }],
    toolsRequired: ['web_fetch'],
  }),

  createSkill({ id: 'logistics.optimize_route', name: 'Optimize Delivery Route', tier: 'atomic', category: SKILL_CATEGORIES.LOGISTICS, subcategory: 'routing', tags: ['routing', 'optimization', 'delivery'], trustLevelRequired: 2, riskCategory: 'low', description: 'Optimize delivery routes.', systemPrompt: 'Optimize route. Consider: distance, time windows, vehicle capacity, traffic. Minimize total time/distance. Respect constraints.',
    inputs: [{ name: 'stops', type: 'array', required: true, description: 'Delivery stops' }, { name: 'startLocation', type: 'object', required: true, description: 'Start point' }, { name: 'timeWindows', type: 'array', required: false, description: 'Delivery windows' }],
    outputs: [{ name: 'optimizedRoute', type: 'array', description: 'Optimal order', nullable: false }, { name: 'totalDistance', type: 'number', description: 'Total distance', nullable: false }, { name: 'totalTime', type: 'number', description: 'Estimated time', nullable: false }],
  }),

  createSkill({ id: 'logistics.manage_inventory', name: 'Manage Inventory', tier: 'atomic', category: SKILL_CATEGORIES.LOGISTICS, subcategory: 'inventory', tags: ['inventory', 'stock', 'warehouse'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Manage inventory levels and reordering.', systemPrompt: 'Manage inventory. Track levels. Calculate reorder points. Generate purchase suggestions. Flag stockouts and overstock.',
    inputs: [{ name: 'currentInventory', type: 'array', required: true, description: 'Current stock' }, { name: 'demandForecast', type: 'array', required: false, description: 'Demand forecast' }, { name: 'leadTimes', type: 'object', required: false, description: 'Supplier lead times' }],
    outputs: [{ name: 'inventoryStatus', type: 'array', description: 'Status by item', nullable: false }, { name: 'reorderList', type: 'array', description: 'Items to reorder', nullable: false }, { name: 'stockoutRisks', type: 'array', description: 'Stockout risks', nullable: true }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ REAL ESTATE                                                               ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'realestate.analyze_property', name: 'Analyze Property', tier: 'composite', category: SKILL_CATEGORIES.REAL_ESTATE, subcategory: 'analysis', tags: ['property', 'analysis', 'investment'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['math.financial_calc', 'cognition.compare_contrast'], description: 'Analyze property for investment potential.', systemPrompt: 'Analyze property investment. Calculate: cap rate, cash-on-cash, NOI. Compare to comps. Assess neighborhood. Identify risks and opportunities. Not investment advice.',
    inputs: [{ name: 'property', type: 'object', required: true, description: 'Property details' }, { name: 'purchasePrice', type: 'number', required: true, description: 'Purchase price' }, { name: 'rentalAssumptions', type: 'object', required: false, description: 'Rental assumptions' }],
    outputs: [{ name: 'analysis', type: 'object', description: 'Investment analysis', nullable: false }, { name: 'metrics', type: 'object', description: 'Key metrics', nullable: false }, { name: 'cashflow', type: 'object', description: 'Projected cash flow', nullable: false }, { name: 'recommendation', type: 'string', description: 'Analysis summary', nullable: false }],
    governanceNotes: 'Not investment advice. Includes disclaimer.',
  }),

  createSkill({ id: 'realestate.market_research', name: 'Real Estate Market Research', tier: 'composite', category: SKILL_CATEGORIES.REAL_ESTATE, subcategory: 'research', tags: ['market', 'research', 'trends'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['web.search', 'cognition.extract_patterns'], description: 'Research real estate market conditions.', systemPrompt: 'Research real estate market. Analyze: prices, inventory, days on market, trends. Compare to historical. Identify patterns. Note data limitations.',
    inputs: [{ name: 'location', type: 'string', required: true, description: 'Market location' }, { name: 'propertyType', type: 'string', required: false, description: 'Property type' }],
    outputs: [{ name: 'marketAnalysis', type: 'object', description: 'Market analysis', nullable: false }, { name: 'trends', type: 'array', description: 'Market trends', nullable: false }, { name: 'forecast', type: 'object', description: 'Market outlook', nullable: true }],
    toolsRequired: ['web_search'],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ FILE MANAGEMENT                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'file.read', name: 'Read File', tier: 'atomic', category: SKILL_CATEGORIES.FILE_MANAGEMENT, subcategory: 'io', tags: ['read', 'file', 'input'], trustLevelRequired: 2, riskCategory: 'low', description: 'Read file contents.', systemPrompt: 'Read file content. Detect encoding. Handle binary vs text. Return in usable format.',
    inputs: [{ name: 'path', type: 'string', required: true, description: 'File path' }, { name: 'encoding', type: 'string', required: false, description: 'Encoding', defaultValue: 'auto' }],
    outputs: [{ name: 'content', type: 'any', description: 'File content', nullable: false }, { name: 'size', type: 'number', description: 'File size bytes', nullable: false }],
    toolsRequired: ['file_system'],
  }),

  createSkill({ id: 'file.write', name: 'Write File', tier: 'atomic', category: SKILL_CATEGORIES.FILE_MANAGEMENT, subcategory: 'io', tags: ['write', 'file', 'output'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Write content to file.', systemPrompt: 'Write content to file. Verify path safety. Create directories if needed. Handle overwrites appropriately.',
    inputs: [{ name: 'path', type: 'string', required: true, description: 'Target path' }, { name: 'content', type: 'any', required: true, description: 'Content to write' }],
    outputs: [{ name: 'success', type: 'boolean', description: 'Write successful', nullable: false }, { name: 'path', type: 'string', description: 'Written path', nullable: false }],
    toolsRequired: ['file_system'],
  }),

  createSkill({ id: 'file.convert', name: 'Convert File Format', tier: 'atomic', category: SKILL_CATEGORIES.FILE_MANAGEMENT, subcategory: 'conversion', tags: ['convert', 'format', 'transform'], trustLevelRequired: 2, riskCategory: 'low', description: 'Convert files between formats.', systemPrompt: 'Convert file format. Preserve content fidelity. Report any conversion limitations.',
    inputs: [{ name: 'sourcePath', type: 'string', required: true, description: 'Source file' }, { name: 'targetFormat', type: 'string', required: true, description: 'Target format' }],
    outputs: [{ name: 'outputPath', type: 'string', description: 'Converted file', nullable: false }, { name: 'success', type: 'boolean', description: 'Conversion successful', nullable: false }],
    toolsRequired: ['file_system'],
  }),

  createSkill({ id: 'file.search', name: 'Search Files', tier: 'atomic', category: SKILL_CATEGORIES.FILE_MANAGEMENT, subcategory: 'search', tags: ['search', 'find', 'locate'], trustLevelRequired: 2, riskCategory: 'low', description: 'Search for files by name, content, or metadata.', systemPrompt: 'Search files matching criteria. Support glob patterns, regex, content search. Return with metadata.',
    inputs: [{ name: 'basePath', type: 'string', required: true, description: 'Base directory' }, { name: 'pattern', type: 'string', required: false, description: 'Filename pattern' }, { name: 'contentSearch', type: 'string', required: false, description: 'Content to search' }],
    outputs: [{ name: 'matches', type: 'array', description: 'Matching files', nullable: false }, { name: 'count', type: 'number', description: 'Match count', nullable: false }],
    toolsRequired: ['file_system'],
  }),

];

export default SKILLS_PART3;
