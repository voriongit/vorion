-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."academy_status" AS ENUM('enrolled', 'in_progress', 'examination', 'passed', 'failed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."acquisition_status" AS ENUM('active', 'suspended', 'terminated', 'expired');--> statement-breakpoint
CREATE TYPE "public"."acquisition_type" AS ENUM('commission', 'clone', 'enterprise_lock');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('draft', 'training', 'examination', 'active', 'suspended', 'retired');--> statement-breakpoint
CREATE TYPE "public"."curriculum_type" AS ENUM('basic_training', 'specialized', 'advanced', 'certification', 'remedial');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('pending', 'approved', 'rejected', 'escalated', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('approval', 'rejection', 'modification', 'escalation', 'suspension', 'reinstatement');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('agent_action', 'user_action', 'council_activity', 'trust_change', 'anomaly', 'system', 'security');--> statement-breakpoint
CREATE TYPE "public"."event_severity" AS ENUM('debug', 'info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."goal_level" AS ENUM('mission', 'strategic', 'team_okr', 'agent_objective', 'task');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('draft', 'active', 'completed', 'cancelled', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."guard_rail_scope" AS ENUM('universal', 'category', 'team', 'role', 'individual');--> statement-breakpoint
CREATE TYPE "public"."guard_rail_type" AS ENUM('hard_boundary', 'soft_boundary', 'warning', 'guidance');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'active', 'paused', 'sold_out', 'retired');--> statement-breakpoint
CREATE TYPE "public"."message_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('request', 'response', 'broadcast', 'escalation', 'delegation', 'notification', 'collaboration');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."team_type" AS ENUM('council', 'team', 'guild', 'squad', 'incident');--> statement-breakpoint
CREATE TYPE "public"."trust_source" AS ENUM('council_decision', 'behavior_analysis', 'user_feedback', 'examination', 'decay', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."truth_record_type" AS ENUM('agent_creation', 'agent_graduation', 'agent_suspension', 'council_decision', 'trust_change', 'acquisition', 'human_override', 'system_event');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('trainer', 'consumer', 'both');--> statement-breakpoint
CREATE TABLE "trust_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"previous_score" integer NOT NULL,
	"new_score" integer NOT NULL,
	"change" integer NOT NULL,
	"source" "trust_source" NOT NULL,
	"reason" text,
	"reference_id" uuid,
	"reference_type" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"decision_type" "decision_type" NOT NULL,
	"status" "decision_status" DEFAULT 'pending' NOT NULL,
	"risk_level" integer DEFAULT 0 NOT NULL,
	"subject_action" text NOT NULL,
	"subject_context" jsonb DEFAULT '{}'::jsonb,
	"reasoning" text,
	"validator_agent_id" uuid,
	"votes" jsonb,
	"human_override" boolean DEFAULT false,
	"human_override_reason" text,
	"human_override_by" uuid,
	"trust_impact" integer DEFAULT 0,
	"precedent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"commission_rate" numeric(10, 4),
	"clone_price" numeric(10, 2),
	"enterprise_price" numeric(10, 2),
	"available_for_commission" boolean DEFAULT true,
	"available_for_clone" boolean DEFAULT false,
	"available_for_enterprise" boolean DEFAULT false,
	"max_clones" integer,
	"current_clones" integer DEFAULT 0,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"category" text,
	"preview_config" jsonb DEFAULT '{}'::jsonb,
	"view_count" integer DEFAULT 0,
	"acquisition_count" integer DEFAULT 0,
	"average_rating" numeric(3, 2),
	"review_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "acquisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"acquisition_type" "acquisition_type" NOT NULL,
	"status" "acquisition_status" DEFAULT 'active' NOT NULL,
	"cloned_agent_id" uuid,
	"price_at_acquisition" numeric(10, 2),
	"commission_rate_at_acquisition" numeric(10, 4),
	"total_usage" integer DEFAULT 0,
	"total_spent" numeric(10, 2) DEFAULT '0',
	"can_walk_away" boolean DEFAULT true,
	"walk_away_reason" text,
	"rating" integer,
	"review" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"terminated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "truth_chain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" bigint NOT NULL,
	"previous_hash" text,
	"hash" text NOT NULL,
	"record_type" "truth_record_type" NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"actor_id" uuid,
	"actor_type" text,
	"signature" text,
	"anchored_at" timestamp with time zone,
	"anchor_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"category" "event_category" NOT NULL,
	"severity" "event_severity" DEFAULT 'info' NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"actor_type" text,
	"actor_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"session_id" text,
	"request_id" text,
	"ip_address" text,
	"user_agent" text,
	"anomaly_score" integer DEFAULT 0,
	"flagged" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"curriculum_type" "curriculum_type" NOT NULL,
	"curriculum_version" text DEFAULT '1.0',
	"status" "academy_status" DEFAULT 'enrolled' NOT NULL,
	"current_module" integer DEFAULT 1,
	"total_modules" integer DEFAULT 5,
	"completed_modules" jsonb DEFAULT '[]'::jsonb,
	"module_scores" jsonb DEFAULT '{}'::jsonb,
	"overall_score" numeric(5, 2),
	"examination_attempts" integer DEFAULT 0,
	"last_examination_score" numeric(5, 2),
	"examination_history" jsonb DEFAULT '[]'::jsonb,
	"training_config" jsonb DEFAULT '{}'::jsonb,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"graduated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'consumer' NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"email":true,"in_app":true,"webhook":false}'::jsonb,
	"storefront_name" text,
	"storefront_bio" text,
	"auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_prompt" text,
	"model" text DEFAULT 'claude-3-5-sonnet-20241022' NOT NULL,
	"status" "agent_status" DEFAULT 'draft' NOT NULL,
	"trust_score" integer DEFAULT 100 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"successful_interactions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graduated_at" timestamp with time zone,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "decision_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"team_id" uuid,
	"council_id" uuid,
	"decision_type" text NOT NULL,
	"decision" text NOT NULL,
	"reasoning" text NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb,
	"goal_id" uuid,
	"guard_rails_checked" uuid[],
	"expected_outcome" text,
	"actual_outcome" text,
	"outcome_assessed_at" timestamp with time zone,
	"impact_assessment" jsonb,
	"decided_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delegator_id" uuid NOT NULL,
	"delegatee_id" uuid NOT NULL,
	"task_description" text NOT NULL,
	"acceptance_criteria" jsonb NOT NULL,
	"context" jsonb,
	"delegated_at" timestamp with time zone DEFAULT now(),
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"check_in_schedule" jsonb DEFAULT '[]'::jsonb,
	"check_ins" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active',
	"completion_notes" text,
	"delegator_remains_accountable" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "escalation_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"chain" jsonb NOT NULL,
	"triggers" jsonb DEFAULT '[]'::jsonb,
	"sla_by_level" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "escalation_chains_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "escalation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" uuid NOT NULL,
	"triggered_by" uuid NOT NULL,
	"trigger_reason" text NOT NULL,
	"context" jsonb,
	"current_level" integer DEFAULT 1,
	"escalation_history" jsonb DEFAULT '[]'::jsonb,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "guard_rails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" "guard_rail_type" DEFAULT 'warning' NOT NULL,
	"scope" "guard_rail_scope" DEFAULT 'universal' NOT NULL,
	"scope_target" text,
	"applies_to" uuid[],
	"rule_definition" jsonb NOT NULL,
	"on_violation" text DEFAULT 'block' NOT NULL,
	"escalation_target" text,
	"rationale" text,
	"source" text,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp with time zone DEFAULT now(),
	"effective_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "guard_rails_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"type" "team_type" DEFAULT 'team' NOT NULL,
	"icon" text,
	"parent_team_id" uuid,
	"lead_agent_id" uuid,
	"purpose" text NOT NULL,
	"responsibilities" jsonb DEFAULT '[]'::jsonb,
	"authority_level" integer DEFAULT 1,
	"can_approve" jsonb DEFAULT '[]'::jsonb,
	"must_escalate" jsonb DEFAULT '[]'::jsonb,
	"quorum_required" integer DEFAULT 1,
	"decision_method" text DEFAULT 'consensus',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teams_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"role" text DEFAULT 'member',
	"responsibilities" text[],
	"joined_at" timestamp with time zone DEFAULT now(),
	"left_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "team_memberships_team_id_agent_id_key" UNIQUE("team_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"level" "goal_level" NOT NULL,
	"parent_goal_id" uuid,
	"owner_agent_id" uuid,
	"owner_team_id" uuid,
	"start_date" date,
	"target_date" date,
	"status" "goal_status" DEFAULT 'draft',
	"progress_percent" integer DEFAULT 0,
	"key_results" jsonb DEFAULT '[]'::jsonb,
	"alignment_score" double precision,
	"alignment_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_agent_id" uuid NOT NULL,
	"to_agent_id" uuid,
	"to_team_id" uuid,
	"type" "message_type" NOT NULL,
	"priority" "message_priority" DEFAULT 'medium',
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"context" jsonb,
	"thread_id" uuid,
	"in_reply_to" uuid,
	"status" text DEFAULT 'sent',
	"read_at" timestamp with time zone,
	"acted_at" timestamp with time zone,
	"requires_response" boolean DEFAULT false,
	"response_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"memory_type" text DEFAULT 'episodic' NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"source_agent_id" uuid,
	"source_interaction_id" uuid,
	"confidence" double precision DEFAULT 1,
	"importance" double precision DEFAULT 0.5,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_accessed" timestamp with time zone DEFAULT now(),
	"access_count" integer DEFAULT 0,
	"expires_at" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"category" text,
	CONSTRAINT "valid_am_confidence" CHECK ((confidence >= (0)::double precision) AND (confidence <= (1)::double precision)),
	CONSTRAINT "valid_am_importance" CHECK ((importance >= (0)::double precision) AND (importance <= (1)::double precision))
);
--> statement-breakpoint
CREATE TABLE "trust_bridge_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_id" varchar(50) NOT NULL,
	"submission" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"queue_position" integer,
	"priority_score" integer DEFAULT 0,
	"estimated_start" timestamp with time zone,
	"test_results" jsonb,
	"test_session_id" uuid,
	"certification" jsonb,
	"credential_token" text,
	"council_reviewed" boolean DEFAULT false,
	"council_decision_id" uuid,
	"review_notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"submitter_id" varchar(100) NOT NULL,
	"submitter_tier" varchar(20) DEFAULT 'free',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trust_bridge_submissions_tracking_id_key" UNIQUE("tracking_id")
);
--> statement-breakpoint
CREATE TABLE "trust_bridge_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"submission_id" uuid,
	"token" text NOT NULL,
	"payload" jsonb NOT NULL,
	"trust_score" integer NOT NULL,
	"tier" varchar(20) NOT NULL,
	"origin_platform" varchar(50) NOT NULL,
	"capabilities" text[] DEFAULT '{""}' NOT NULL,
	"restrictions" text[] DEFAULT '{""}' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"council_reviewed" boolean DEFAULT false,
	"council_decision_id" uuid,
	"truth_chain_hash" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trust_bridge_credentials_agent_id_key" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "crypto_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" bigint NOT NULL,
	"previous_hash" text NOT NULL,
	"entry_hash" text NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_tier" text,
	"target_type" text,
	"target_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"merkle_root" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_audit_log_actor_type_check" CHECK (actor_type = ANY (ARRAY['HUMAN'::text, 'AGENT'::text, 'SYSTEM'::text])),
	CONSTRAINT "crypto_audit_log_target_type_check" CHECK (target_type = ANY (ARRAY['AGENT'::text, 'ENTRY'::text, 'SYSTEM'::text])),
	CONSTRAINT "crypto_audit_log_outcome_check" CHECK (outcome = ANY (ARRAY['SUCCESS'::text, 'DENIED'::text, 'ERROR'::text]))
);
--> statement-breakpoint
ALTER TABLE "crypto_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trust_history" ADD CONSTRAINT "trust_history_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_decisions" ADD CONSTRAINT "council_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_consumer_id_profiles_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_cloned_agent_id_agents_id_fk" FOREIGN KEY ("cloned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_progress" ADD CONSTRAINT "academy_progress_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegatee_id_fkey" FOREIGN KEY ("delegatee_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."escalation_chains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_team_id_fkey" FOREIGN KEY ("parent_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_agent_id_fkey" FOREIGN KEY ("lead_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_agent_id_fkey" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_from_agent_id_fkey" FOREIGN KEY ("from_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_to_agent_id_fkey" FOREIGN KEY ("to_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_to_team_id_fkey" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_in_reply_to_fkey" FOREIGN KEY ("in_reply_to") REFERENCES "public"."agent_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_source_agent_id_fkey" FOREIGN KEY ("source_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trust_history_agent_idx" ON "trust_history" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trust_history_created_at_idx" ON "trust_history" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "trust_history_source_idx" ON "trust_history" USING btree ("source" enum_ops);--> statement-breakpoint
CREATE INDEX "council_decisions_agent_idx" ON "council_decisions" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "council_decisions_created_at_idx" ON "council_decisions" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "council_decisions_risk_level_idx" ON "council_decisions" USING btree ("risk_level" int4_ops);--> statement-breakpoint
CREATE INDEX "council_decisions_status_idx" ON "council_decisions" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "council_decisions_type_idx" ON "council_decisions" USING btree ("decision_type" enum_ops);--> statement-breakpoint
CREATE INDEX "marketplace_listings_agent_idx" ON "marketplace_listings" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "marketplace_listings_category_idx" ON "marketplace_listings" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "marketplace_listings_published_idx" ON "marketplace_listings" USING btree ("published_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "marketplace_listings_seller_idx" ON "marketplace_listings" USING btree ("seller_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "acquisitions_agent_idx" ON "acquisitions" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "acquisitions_consumer_idx" ON "acquisitions" USING btree ("consumer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "acquisitions_created_at_idx" ON "acquisitions" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "acquisitions_listing_idx" ON "acquisitions" USING btree ("listing_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "acquisitions_status_idx" ON "acquisitions" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "acquisitions_type_idx" ON "acquisitions" USING btree ("acquisition_type" enum_ops);--> statement-breakpoint
CREATE INDEX "truth_chain_actor_idx" ON "truth_chain" USING btree ("actor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "truth_chain_created_at_idx" ON "truth_chain" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "truth_chain_hash_idx" ON "truth_chain" USING btree ("hash" text_ops);--> statement-breakpoint
CREATE INDEX "truth_chain_record_type_idx" ON "truth_chain" USING btree ("record_type" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "truth_chain_sequence_idx" ON "truth_chain" USING btree ("sequence_number" int8_ops);--> statement-breakpoint
CREATE INDEX "truth_chain_subject_idx" ON "truth_chain" USING btree ("subject_type" uuid_ops,"subject_id" text_ops);--> statement-breakpoint
CREATE INDEX "observer_events_actor_idx" ON "observer_events" USING btree ("actor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "observer_events_category_idx" ON "observer_events" USING btree ("category" enum_ops);--> statement-breakpoint
CREATE INDEX "observer_events_created_at_idx" ON "observer_events" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "observer_events_flagged_idx" ON "observer_events" USING btree ("flagged" int4_ops);--> statement-breakpoint
CREATE INDEX "observer_events_severity_idx" ON "observer_events" USING btree ("severity" enum_ops);--> statement-breakpoint
CREATE INDEX "observer_events_subject_idx" ON "observer_events" USING btree ("subject_type" uuid_ops,"subject_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "observer_events_type_idx" ON "observer_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "academy_progress_agent_idx" ON "academy_progress" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "academy_progress_curriculum_idx" ON "academy_progress" USING btree ("curriculum_type" enum_ops);--> statement-breakpoint
CREATE INDEX "academy_progress_enrolled_idx" ON "academy_progress" USING btree ("enrolled_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "academy_progress_status_idx" ON "academy_progress" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "profiles_auth_user_idx" ON "profiles" USING btree ("auth_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "agents_name_idx" ON "agents" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "agents_owner_idx" ON "agents" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "agents_trust_score_idx" ON "agents" USING btree ("trust_score" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_delegations_delegatee" ON "delegations" USING btree ("delegatee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_delegations_delegator" ON "delegations" USING btree ("delegator_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_delegations_status" ON "delegations" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_escalation_events_chain" ON "escalation_events" USING btree ("chain_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_escalation_events_triggered" ON "escalation_events" USING btree ("triggered_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_memories_agent" ON "agent_memories" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_memories_importance" ON "agent_memories" USING btree ("importance" float8_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_memories_type" ON "agent_memories" USING btree ("memory_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tb_submissions_status" ON "trust_bridge_submissions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tb_submissions_tracking_id" ON "trust_bridge_submissions" USING btree ("tracking_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tb_credentials_agent_id" ON "trust_bridge_credentials" USING btree ("agent_id" text_ops);--> statement-breakpoint
CREATE INDEX "crypto_audit_log_action_idx" ON "crypto_audit_log" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "crypto_audit_log_actor_idx" ON "crypto_audit_log" USING btree ("actor_id" text_ops);--> statement-breakpoint
CREATE INDEX "crypto_audit_log_created_at_idx" ON "crypto_audit_log" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "crypto_audit_log_hash_idx" ON "crypto_audit_log" USING btree ("entry_hash" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crypto_audit_log_sequence_idx" ON "crypto_audit_log" USING btree ("sequence_number" int8_ops);--> statement-breakpoint
CREATE VIEW "public"."bots" AS (SELECT a.id, p.auth_user_id AS user_id, a.owner_id, a.name, a.description, a.system_prompt, a.model, a.status, a.trust_score, a.config, a.metadata, a.total_interactions, a.successful_interactions, a.created_at, a.updated_at, a.graduated_at, a.retired_at, 0 AS certification_level FROM agents a LEFT JOIN profiles p ON a.owner_id = p.id);--> statement-breakpoint
CREATE POLICY "crypto_audit_log_insert_service" ON "crypto_audit_log" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "crypto_audit_log_read_all" ON "crypto_audit_log" AS PERMISSIVE FOR SELECT TO public;
*/