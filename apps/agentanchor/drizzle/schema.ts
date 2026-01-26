import { pgTable, index, foreignKey, uuid, integer, text, jsonb, timestamp, boolean, numeric, uniqueIndex, bigint, unique, date, doublePrecision, check, varchar, pgPolicy, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const academyStatus = pgEnum("academy_status", ['enrolled', 'in_progress', 'examination', 'passed', 'failed', 'withdrawn'])
/** @deprecated Used by legacy marketplace tables - will be removed in v2.0 */
export const acquisitionStatus = pgEnum("acquisition_status", ['active', 'suspended', 'terminated', 'expired'])
/** @deprecated Used by legacy marketplace tables - will be removed in v2.0 */
export const acquisitionType = pgEnum("acquisition_type", ['commission', 'clone', 'enterprise_lock'])
export const agentStatus = pgEnum("agent_status", ['draft', 'training', 'examination', 'active', 'suspended', 'retired'])
export const curriculumType = pgEnum("curriculum_type", ['basic_training', 'specialized', 'advanced', 'certification', 'remedial'])
export const decisionStatus = pgEnum("decision_status", ['pending', 'approved', 'rejected', 'escalated', 'overridden'])
export const decisionType = pgEnum("decision_type", ['approval', 'rejection', 'modification', 'escalation', 'suspension', 'reinstatement'])
export const eventCategory = pgEnum("event_category", ['agent_action', 'user_action', 'council_activity', 'trust_change', 'anomaly', 'system', 'security'])
export const eventSeverity = pgEnum("event_severity", ['debug', 'info', 'warning', 'error', 'critical'])
export const goalLevel = pgEnum("goal_level", ['mission', 'strategic', 'team_okr', 'agent_objective', 'task'])
export const goalStatus = pgEnum("goal_status", ['draft', 'active', 'completed', 'cancelled', 'blocked'])
export const guardRailScope = pgEnum("guard_rail_scope", ['universal', 'category', 'team', 'role', 'individual'])
export const guardRailType = pgEnum("guard_rail_type", ['hard_boundary', 'soft_boundary', 'warning', 'guidance'])
/** @deprecated Used by legacy marketplace tables - will be removed in v2.0 */
export const listingStatus = pgEnum("listing_status", ['draft', 'pending_review', 'active', 'paused', 'sold_out', 'retired'])
export const messagePriority = pgEnum("message_priority", ['low', 'medium', 'high', 'critical'])
export const messageType = pgEnum("message_type", ['request', 'response', 'broadcast', 'escalation', 'delegation', 'notification', 'collaboration'])
export const subscriptionTier = pgEnum("subscription_tier", ['free', 'pro', 'enterprise'])
export const teamType = pgEnum("team_type", ['council', 'team', 'guild', 'squad', 'incident'])
export const trustSource = pgEnum("trust_source", ['council_decision', 'behavior_analysis', 'user_feedback', 'examination', 'decay', 'manual_adjustment'])
export const truthRecordType = pgEnum("truth_record_type", ['agent_creation', 'agent_graduation', 'agent_suspension', 'council_decision', 'trust_change', 'acquisition', 'human_override', 'system_event'])
export const userRole = pgEnum("user_role", ['trainer', 'consumer', 'both'])


export const trustHistory = pgTable("trust_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id").notNull(),
	previousScore: integer("previous_score").notNull(),
	newScore: integer("new_score").notNull(),
	change: integer().notNull(),
	source: trustSource().notNull(),
	reason: text(),
	referenceId: uuid("reference_id"),
	referenceType: text("reference_type"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("trust_history_agent_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("trust_history_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("trust_history_source_idx").using("btree", table.source.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "trust_history_agent_id_agents_id_fk"
		}).onDelete("cascade"),
]);

export const councilDecisions = pgTable("council_decisions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id").notNull(),
	decisionType: decisionType("decision_type").notNull(),
	status: decisionStatus().default('pending').notNull(),
	riskLevel: integer("risk_level").default(0).notNull(),
	subjectAction: text("subject_action").notNull(),
	subjectContext: jsonb("subject_context").default({}),
	reasoning: text(),
	validatorAgentId: uuid("validator_agent_id"),
	votes: jsonb(),
	humanOverride: boolean("human_override").default(false),
	humanOverrideReason: text("human_override_reason"),
	humanOverrideBy: uuid("human_override_by"),
	trustImpact: integer("trust_impact").default(0),
	precedentId: uuid("precedent_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("council_decisions_agent_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("council_decisions_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("council_decisions_risk_level_idx").using("btree", table.riskLevel.asc().nullsLast().op("int4_ops")),
	index("council_decisions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("council_decisions_type_idx").using("btree", table.decisionType.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "council_decisions_agent_id_agents_id_fk"
		}).onDelete("cascade"),
]);

/**
 * @deprecated LEGACY TABLE - Marketplace feature is deprecated.
 * This table is retained for migration compatibility and historical data.
 * Do not add new features using this table. Will be removed in v2.0.
 * See: https://github.com/voriongit/vorion/issues/marketplace-deprecation
 */
export const marketplaceListings = pgTable("marketplace_listings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id").notNull(),
	sellerId: uuid("seller_id").notNull(),
	title: text().notNull(),
	description: text(),
	status: listingStatus().default('draft').notNull(),
	commissionRate: numeric("commission_rate", { precision: 10, scale:  4 }),
	clonePrice: numeric("clone_price", { precision: 10, scale:  2 }),
	enterprisePrice: numeric("enterprise_price", { precision: 10, scale:  2 }),
	availableForCommission: boolean("available_for_commission").default(true),
	availableForClone: boolean("available_for_clone").default(false),
	availableForEnterprise: boolean("available_for_enterprise").default(false),
	maxClones: integer("max_clones"),
	currentClones: integer("current_clones").default(0),
	tags: jsonb().default([]),
	category: text(),
	previewConfig: jsonb("preview_config").default({}),
	viewCount: integer("view_count").default(0),
	acquisitionCount: integer("acquisition_count").default(0),
	averageRating: numeric("average_rating", { precision: 3, scale:  2 }),
	reviewCount: integer("review_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("marketplace_listings_agent_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("marketplace_listings_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("marketplace_listings_published_idx").using("btree", table.publishedAt.asc().nullsLast().op("timestamptz_ops")),
	index("marketplace_listings_seller_idx").using("btree", table.sellerId.asc().nullsLast().op("uuid_ops")),
	index("marketplace_listings_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "marketplace_listings_agent_id_agents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sellerId],
			foreignColumns: [profiles.id],
			name: "marketplace_listings_seller_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

/**
 * @deprecated LEGACY TABLE - Marketplace feature is deprecated.
 * This table is retained for migration compatibility and historical data.
 * Do not add new features using this table. Will be removed in v2.0.
 * See: https://github.com/voriongit/vorion/issues/marketplace-deprecation
 */
export const acquisitions = pgTable("acquisitions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	listingId: uuid("listing_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	consumerId: uuid("consumer_id").notNull(),
	acquisitionType: acquisitionType("acquisition_type").notNull(),
	status: acquisitionStatus().default('active').notNull(),
	clonedAgentId: uuid("cloned_agent_id"),
	priceAtAcquisition: numeric("price_at_acquisition", { precision: 10, scale:  2 }),
	commissionRateAtAcquisition: numeric("commission_rate_at_acquisition", { precision: 10, scale:  4 }),
	totalUsage: integer("total_usage").default(0),
	totalSpent: numeric("total_spent", { precision: 10, scale:  2 }).default('0'),
	canWalkAway: boolean("can_walk_away").default(true),
	walkAwayReason: text("walk_away_reason"),
	rating: integer(),
	review: text(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	terminatedAt: timestamp("terminated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("acquisitions_agent_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("acquisitions_consumer_idx").using("btree", table.consumerId.asc().nullsLast().op("uuid_ops")),
	index("acquisitions_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("acquisitions_listing_idx").using("btree", table.listingId.asc().nullsLast().op("uuid_ops")),
	index("acquisitions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("acquisitions_type_idx").using("btree", table.acquisitionType.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [marketplaceListings.id],
			name: "acquisitions_listing_id_marketplace_listings_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "acquisitions_agent_id_agents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.consumerId],
			foreignColumns: [profiles.id],
			name: "acquisitions_consumer_id_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.clonedAgentId],
			foreignColumns: [agents.id],
			name: "acquisitions_cloned_agent_id_agents_id_fk"
		}),
]);

export const truthChain = pgTable("truth_chain", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	previousHash: text("previous_hash"),
	hash: text().notNull(),
	recordType: truthRecordType("record_type").notNull(),
	subjectType: text("subject_type").notNull(),
	subjectId: uuid("subject_id").notNull(),
	payload: jsonb().notNull(),
	actorId: uuid("actor_id"),
	actorType: text("actor_type"),
	signature: text(),
	anchoredAt: timestamp("anchored_at", { withTimezone: true, mode: 'string' }),
	anchorTxHash: text("anchor_tx_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("truth_chain_actor_idx").using("btree", table.actorId.asc().nullsLast().op("uuid_ops")),
	index("truth_chain_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("truth_chain_hash_idx").using("btree", table.hash.asc().nullsLast().op("text_ops")),
	index("truth_chain_record_type_idx").using("btree", table.recordType.asc().nullsLast().op("enum_ops")),
	uniqueIndex("truth_chain_sequence_idx").using("btree", table.sequenceNumber.asc().nullsLast().op("int8_ops")),
	index("truth_chain_subject_idx").using("btree", table.subjectType.asc().nullsLast().op("uuid_ops"), table.subjectId.asc().nullsLast().op("text_ops")),
]);

export const observerEvents = pgTable("observer_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	eventType: text("event_type").notNull(),
	category: eventCategory().notNull(),
	severity: eventSeverity().default('info').notNull(),
	subjectType: text("subject_type").notNull(),
	subjectId: uuid("subject_id").notNull(),
	actorType: text("actor_type"),
	actorId: uuid("actor_id"),
	title: text().notNull(),
	description: text(),
	payload: jsonb().default({}),
	sessionId: text("session_id"),
	requestId: text("request_id"),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	anomalyScore: integer("anomaly_score").default(0),
	flagged: integer().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("observer_events_actor_idx").using("btree", table.actorId.asc().nullsLast().op("uuid_ops")),
	index("observer_events_category_idx").using("btree", table.category.asc().nullsLast().op("enum_ops")),
	index("observer_events_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("observer_events_flagged_idx").using("btree", table.flagged.asc().nullsLast().op("int4_ops")),
	index("observer_events_severity_idx").using("btree", table.severity.asc().nullsLast().op("enum_ops")),
	index("observer_events_subject_idx").using("btree", table.subjectType.asc().nullsLast().op("uuid_ops"), table.subjectId.asc().nullsLast().op("uuid_ops")),
	index("observer_events_type_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
]);

export const academyProgress = pgTable("academy_progress", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id").notNull(),
	curriculumType: curriculumType("curriculum_type").notNull(),
	curriculumVersion: text("curriculum_version").default('1.0'),
	status: academyStatus().default('enrolled').notNull(),
	currentModule: integer("current_module").default(1),
	totalModules: integer("total_modules").default(5),
	completedModules: jsonb("completed_modules").default([]),
	moduleScores: jsonb("module_scores").default({}),
	overallScore: numeric("overall_score", { precision: 5, scale:  2 }),
	examinationAttempts: integer("examination_attempts").default(0),
	lastExaminationScore: numeric("last_examination_score", { precision: 5, scale:  2 }),
	examinationHistory: jsonb("examination_history").default([]),
	trainingConfig: jsonb("training_config").default({}),
	enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	graduatedAt: timestamp("graduated_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("academy_progress_agent_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("academy_progress_curriculum_idx").using("btree", table.curriculumType.asc().nullsLast().op("enum_ops")),
	index("academy_progress_enrolled_idx").using("btree", table.enrolledAt.asc().nullsLast().op("timestamptz_ops")),
	index("academy_progress_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "academy_progress_agent_id_agents_id_fk"
		}).onDelete("cascade"),
]);

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	role: userRole().default('consumer').notNull(),
	subscriptionTier: subscriptionTier("subscription_tier").default('free').notNull(),
	notificationPreferences: jsonb("notification_preferences").default({"email":true,"in_app":true,"webhook":false}),
	storefrontName: text("storefront_name"),
	storefrontBio: text("storefront_bio"),
	authUserId: text("auth_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("profiles_auth_user_idx").using("btree", table.authUserId.asc().nullsLast().op("text_ops")),
	index("profiles_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("profiles_role_idx").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	unique("profiles_email_unique").on(table.email),
	unique("profiles_auth_user_id_unique").on(table.authUserId),
]);

export const agents = pgTable("agents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid("owner_id").notNull(),
	name: text().notNull(),
	description: text(),
	systemPrompt: text("system_prompt"),
	model: text().default('claude-3-5-sonnet-20241022').notNull(),
	status: agentStatus().default('draft').notNull(),
	trustScore: integer("trust_score").default(100).notNull(),
	config: jsonb().default({}),
	metadata: jsonb().default({}),
	totalInteractions: integer("total_interactions").default(0).notNull(),
	successfulInteractions: integer("successful_interactions").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	graduatedAt: timestamp("graduated_at", { withTimezone: true, mode: 'string' }),
	retiredAt: timestamp("retired_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("agents_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("agents_owner_idx").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	index("agents_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("agents_trust_score_idx").using("btree", table.trustScore.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [profiles.id],
			name: "agents_owner_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const decisionLog = pgTable("decision_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id"),
	teamId: uuid("team_id"),
	councilId: uuid("council_id"),
	decisionType: text("decision_type").notNull(),
	decision: text().notNull(),
	reasoning: text().notNull(),
	alternatives: jsonb().default([]),
	goalId: uuid("goal_id"),
	guardRailsChecked: uuid("guard_rails_checked").array(),
	expectedOutcome: text("expected_outcome"),
	actualOutcome: text("actual_outcome"),
	outcomeAssessedAt: timestamp("outcome_assessed_at", { withTimezone: true, mode: 'string' }),
	impactAssessment: jsonb("impact_assessment"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "decision_log_agent_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "decision_log_team_id_fkey"
		}),
	foreignKey({
			columns: [table.councilId],
			foreignColumns: [teams.id],
			name: "decision_log_council_id_fkey"
		}),
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [goals.id],
			name: "decision_log_goal_id_fkey"
		}),
]);

export const delegations = pgTable("delegations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	delegatorId: uuid("delegator_id").notNull(),
	delegateeId: uuid("delegatee_id").notNull(),
	taskDescription: text("task_description").notNull(),
	acceptanceCriteria: jsonb("acceptance_criteria").notNull(),
	context: jsonb(),
	delegatedAt: timestamp("delegated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	checkInSchedule: jsonb("check_in_schedule").default([]),
	checkIns: jsonb("check_ins").default([]),
	status: text().default('active'),
	completionNotes: text("completion_notes"),
	delegatorRemainsAccountable: boolean("delegator_remains_accountable").default(true),
}, (table) => [
	index("idx_delegations_delegatee").using("btree", table.delegateeId.asc().nullsLast().op("uuid_ops")),
	index("idx_delegations_delegator").using("btree", table.delegatorId.asc().nullsLast().op("uuid_ops")),
	index("idx_delegations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.delegatorId],
			foreignColumns: [agents.id],
			name: "delegations_delegator_id_fkey"
		}),
	foreignKey({
			columns: [table.delegateeId],
			foreignColumns: [agents.id],
			name: "delegations_delegatee_id_fkey"
		}),
]);

export const escalationChains = pgTable("escalation_chains", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	chain: jsonb().notNull(),
	triggers: jsonb().default([]),
	slaByLevel: jsonb("sla_by_level").default({}),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("escalation_chains_name_key").on(table.name),
]);

export const escalationEvents = pgTable("escalation_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chainId: uuid("chain_id").notNull(),
	triggeredBy: uuid("triggered_by").notNull(),
	triggerReason: text("trigger_reason").notNull(),
	context: jsonb(),
	currentLevel: integer("current_level").default(1),
	escalationHistory: jsonb("escalation_history").default([]),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
	resolution: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_escalation_events_chain").using("btree", table.chainId.asc().nullsLast().op("uuid_ops")),
	index("idx_escalation_events_triggered").using("btree", table.triggeredBy.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.chainId],
			foreignColumns: [escalationChains.id],
			name: "escalation_events_chain_id_fkey"
		}),
	foreignKey({
			columns: [table.triggeredBy],
			foreignColumns: [agents.id],
			name: "escalation_events_triggered_by_fkey"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [agents.id],
			name: "escalation_events_resolved_by_fkey"
		}),
]);

export const guardRails = pgTable("guard_rails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	type: guardRailType().default('warning').notNull(),
	scope: guardRailScope().default('universal').notNull(),
	scopeTarget: text("scope_target"),
	appliesTo: uuid("applies_to").array(),
	ruleDefinition: jsonb("rule_definition").notNull(),
	onViolation: text("on_violation").default('block').notNull(),
	escalationTarget: text("escalation_target"),
	rationale: text(),
	source: text(),
	version: integer().default(1),
	isActive: boolean("is_active").default(true),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow(),
	effectiveUntil: timestamp("effective_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("guard_rails_name_key").on(table.name),
]);

export const teams = pgTable("teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	type: teamType().default('team').notNull(),
	icon: text(),
	parentTeamId: uuid("parent_team_id"),
	leadAgentId: uuid("lead_agent_id"),
	purpose: text().notNull(),
	responsibilities: jsonb().default([]),
	authorityLevel: integer("authority_level").default(1),
	canApprove: jsonb("can_approve").default([]),
	mustEscalate: jsonb("must_escalate").default([]),
	quorumRequired: integer("quorum_required").default(1),
	decisionMethod: text("decision_method").default('consensus'),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.parentTeamId],
			foreignColumns: [table.id],
			name: "teams_parent_team_id_fkey"
		}),
	foreignKey({
			columns: [table.leadAgentId],
			foreignColumns: [agents.id],
			name: "teams_lead_agent_id_fkey"
		}),
	unique("teams_name_key").on(table.name),
]);

export const teamMemberships = pgTable("team_memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	role: text().default('member'),
	responsibilities: text().array(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	leftAt: timestamp("left_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_memberships_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "team_memberships_agent_id_fkey"
		}).onDelete("cascade"),
	unique("team_memberships_team_id_agent_id_key").on(table.teamId, table.agentId),
]);

export const goals = pgTable("goals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	level: goalLevel().notNull(),
	parentGoalId: uuid("parent_goal_id"),
	ownerAgentId: uuid("owner_agent_id"),
	ownerTeamId: uuid("owner_team_id"),
	startDate: date("start_date"),
	targetDate: date("target_date"),
	status: goalStatus().default('draft'),
	progressPercent: integer("progress_percent").default(0),
	keyResults: jsonb("key_results").default([]),
	alignmentScore: doublePrecision("alignment_score"),
	alignmentNotes: text("alignment_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.parentGoalId],
			foreignColumns: [table.id],
			name: "goals_parent_goal_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerAgentId],
			foreignColumns: [agents.id],
			name: "goals_owner_agent_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerTeamId],
			foreignColumns: [teams.id],
			name: "goals_owner_team_id_fkey"
		}),
]);

export const agentMessages = pgTable("agent_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fromAgentId: uuid("from_agent_id").notNull(),
	toAgentId: uuid("to_agent_id"),
	toTeamId: uuid("to_team_id"),
	type: messageType().notNull(),
	priority: messagePriority().default('medium'),
	subject: text().notNull(),
	content: text().notNull(),
	context: jsonb(),
	threadId: uuid("thread_id"),
	inReplyTo: uuid("in_reply_to"),
	status: text().default('sent'),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	actedAt: timestamp("acted_at", { withTimezone: true, mode: 'string' }),
	requiresResponse: boolean("requires_response").default(false),
	responseDeadline: timestamp("response_deadline", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.fromAgentId],
			foreignColumns: [agents.id],
			name: "agent_messages_from_agent_id_fkey"
		}),
	foreignKey({
			columns: [table.toAgentId],
			foreignColumns: [agents.id],
			name: "agent_messages_to_agent_id_fkey"
		}),
	foreignKey({
			columns: [table.toTeamId],
			foreignColumns: [teams.id],
			name: "agent_messages_to_team_id_fkey"
		}),
	foreignKey({
			columns: [table.inReplyTo],
			foreignColumns: [table.id],
			name: "agent_messages_in_reply_to_fkey"
		}),
]);

export const agentMemories = pgTable("agent_memories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id").notNull(),
	memoryType: text("memory_type").default('episodic').notNull(),
	content: text().notNull(),
	summary: text(),
	sourceAgentId: uuid("source_agent_id"),
	sourceInteractionId: uuid("source_interaction_id"),
	confidence: doublePrecision().default(1),
	importance: doublePrecision().default(0.5),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	lastAccessed: timestamp("last_accessed", { withTimezone: true, mode: 'string' }).defaultNow(),
	accessCount: integer("access_count").default(0),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	tags: jsonb().default([]),
	category: text(),
}, (table) => [
	index("idx_agent_memories_agent").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("idx_agent_memories_importance").using("btree", table.importance.desc().nullsFirst().op("float8_ops")),
	index("idx_agent_memories_type").using("btree", table.memoryType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_memories_agent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourceAgentId],
			foreignColumns: [agents.id],
			name: "agent_memories_source_agent_id_fkey"
		}),
	check("valid_am_confidence", sql`(confidence >= (0)::double precision) AND (confidence <= (1)::double precision)`),
	check("valid_am_importance", sql`(importance >= (0)::double precision) AND (importance <= (1)::double precision)`),
]);

export const trustBridgeSubmissions = pgTable("trust_bridge_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	trackingId: varchar("tracking_id", { length: 50 }).notNull(),
	submission: jsonb().notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	queuePosition: integer("queue_position"),
	priorityScore: integer("priority_score").default(0),
	estimatedStart: timestamp("estimated_start", { withTimezone: true, mode: 'string' }),
	testResults: jsonb("test_results"),
	testSessionId: uuid("test_session_id"),
	certification: jsonb(),
	credentialToken: text("credential_token"),
	councilReviewed: boolean("council_reviewed").default(false),
	councilDecisionId: uuid("council_decision_id"),
	reviewNotes: text("review_notes"),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	submitterId: varchar("submitter_id", { length: 100 }).notNull(),
	submitterTier: varchar("submitter_tier", { length: 20 }).default('free'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tb_submissions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_tb_submissions_tracking_id").using("btree", table.trackingId.asc().nullsLast().op("text_ops")),
	unique("trust_bridge_submissions_tracking_id_key").on(table.trackingId),
]);

export const trustBridgeCredentials = pgTable("trust_bridge_credentials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: varchar("agent_id", { length: 100 }).notNull(),
	submissionId: uuid("submission_id"),
	token: text().notNull(),
	payload: jsonb().notNull(),
	trustScore: integer("trust_score").notNull(),
	tier: varchar({ length: 20 }).notNull(),
	originPlatform: varchar("origin_platform", { length: 50 }).notNull(),
	capabilities: text().array().default([""]).notNull(),
	restrictions: text().array().default([""]).notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revocationReason: text("revocation_reason"),
	councilReviewed: boolean("council_reviewed").default(false),
	councilDecisionId: uuid("council_decision_id"),
	truthChainHash: varchar("truth_chain_hash", { length: 100 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tb_credentials_agent_id").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	unique("trust_bridge_credentials_agent_id_key").on(table.agentId),
]);

export const cryptoAuditLog = pgTable("crypto_audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	previousHash: text("previous_hash").notNull(),
	entryHash: text("entry_hash").notNull(),
	action: text().notNull(),
	actorType: text("actor_type").notNull(),
	actorId: text("actor_id").notNull(),
	actorTier: text("actor_tier"),
	targetType: text("target_type"),
	targetId: text("target_id"),
	details: jsonb().default({}).notNull(),
	outcome: text().notNull(),
	reason: text(),
	merkleRoot: text("merkle_root"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("crypto_audit_log_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("crypto_audit_log_actor_idx").using("btree", table.actorId.asc().nullsLast().op("text_ops")),
	index("crypto_audit_log_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("crypto_audit_log_hash_idx").using("btree", table.entryHash.asc().nullsLast().op("text_ops")),
	uniqueIndex("crypto_audit_log_sequence_idx").using("btree", table.sequenceNumber.asc().nullsLast().op("int8_ops")),
	pgPolicy("crypto_audit_log_insert_service", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("crypto_audit_log_read_all", { as: "permissive", for: "select", to: ["public"] }),
	check("crypto_audit_log_actor_type_check", sql`actor_type = ANY (ARRAY['HUMAN'::text, 'AGENT'::text, 'SYSTEM'::text])`),
	check("crypto_audit_log_target_type_check", sql`target_type = ANY (ARRAY['AGENT'::text, 'ENTRY'::text, 'SYSTEM'::text])`),
	check("crypto_audit_log_outcome_check", sql`outcome = ANY (ARRAY['SUCCESS'::text, 'DENIED'::text, 'ERROR'::text])`),
]);
export const bots = pgView("bots", {	id: uuid(),
	userId: text("user_id"),
	ownerId: uuid("owner_id"),
	name: text(),
	description: text(),
	systemPrompt: text("system_prompt"),
	model: text(),
	status: agentStatus(),
	trustScore: integer("trust_score"),
	config: jsonb(),
	metadata: jsonb(),
	totalInteractions: integer("total_interactions"),
	successfulInteractions: integer("successful_interactions"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	graduatedAt: timestamp("graduated_at", { withTimezone: true, mode: 'string' }),
	retiredAt: timestamp("retired_at", { withTimezone: true, mode: 'string' }),
	certificationLevel: integer("certification_level"),
}).as(sql`SELECT a.id, p.auth_user_id AS user_id, a.owner_id, a.name, a.description, a.system_prompt, a.model, a.status, a.trust_score, a.config, a.metadata, a.total_interactions, a.successful_interactions, a.created_at, a.updated_at, a.graduated_at, a.retired_at, 0 AS certification_level FROM agents a LEFT JOIN profiles p ON a.owner_id = p.id`);