import { relations } from "drizzle-orm/relations";
import { agents, trustHistory, councilDecisions, marketplaceListings, profiles, acquisitions, academyProgress, decisionLog, teams, goals, delegations, escalationChains, escalationEvents, teamMemberships, agentMessages, agentMemories } from "./schema";

export const trustHistoryRelations = relations(trustHistory, ({one}) => ({
	agent: one(agents, {
		fields: [trustHistory.agentId],
		references: [agents.id]
	}),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	trustHistories: many(trustHistory),
	councilDecisions: many(councilDecisions),
	marketplaceListings: many(marketplaceListings),
	acquisitions_agentId: many(acquisitions, {
		relationName: "acquisitions_agentId_agents_id"
	}),
	acquisitions_clonedAgentId: many(acquisitions, {
		relationName: "acquisitions_clonedAgentId_agents_id"
	}),
	academyProgresses: many(academyProgress),
	profile: one(profiles, {
		fields: [agents.ownerId],
		references: [profiles.id]
	}),
	decisionLogs: many(decisionLog),
	delegations_delegatorId: many(delegations, {
		relationName: "delegations_delegatorId_agents_id"
	}),
	delegations_delegateeId: many(delegations, {
		relationName: "delegations_delegateeId_agents_id"
	}),
	escalationEvents_triggeredBy: many(escalationEvents, {
		relationName: "escalationEvents_triggeredBy_agents_id"
	}),
	escalationEvents_resolvedBy: many(escalationEvents, {
		relationName: "escalationEvents_resolvedBy_agents_id"
	}),
	teams: many(teams),
	teamMemberships: many(teamMemberships),
	goals: many(goals),
	agentMessages_fromAgentId: many(agentMessages, {
		relationName: "agentMessages_fromAgentId_agents_id"
	}),
	agentMessages_toAgentId: many(agentMessages, {
		relationName: "agentMessages_toAgentId_agents_id"
	}),
	agentMemories_agentId: many(agentMemories, {
		relationName: "agentMemories_agentId_agents_id"
	}),
	agentMemories_sourceAgentId: many(agentMemories, {
		relationName: "agentMemories_sourceAgentId_agents_id"
	}),
}));

export const councilDecisionsRelations = relations(councilDecisions, ({one}) => ({
	agent: one(agents, {
		fields: [councilDecisions.agentId],
		references: [agents.id]
	}),
}));

export const marketplaceListingsRelations = relations(marketplaceListings, ({one, many}) => ({
	agent: one(agents, {
		fields: [marketplaceListings.agentId],
		references: [agents.id]
	}),
	profile: one(profiles, {
		fields: [marketplaceListings.sellerId],
		references: [profiles.id]
	}),
	acquisitions: many(acquisitions),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	marketplaceListings: many(marketplaceListings),
	acquisitions: many(acquisitions),
	agents: many(agents),
}));

export const acquisitionsRelations = relations(acquisitions, ({one}) => ({
	marketplaceListing: one(marketplaceListings, {
		fields: [acquisitions.listingId],
		references: [marketplaceListings.id]
	}),
	agent_agentId: one(agents, {
		fields: [acquisitions.agentId],
		references: [agents.id],
		relationName: "acquisitions_agentId_agents_id"
	}),
	profile: one(profiles, {
		fields: [acquisitions.consumerId],
		references: [profiles.id]
	}),
	agent_clonedAgentId: one(agents, {
		fields: [acquisitions.clonedAgentId],
		references: [agents.id],
		relationName: "acquisitions_clonedAgentId_agents_id"
	}),
}));

export const academyProgressRelations = relations(academyProgress, ({one}) => ({
	agent: one(agents, {
		fields: [academyProgress.agentId],
		references: [agents.id]
	}),
}));

export const decisionLogRelations = relations(decisionLog, ({one}) => ({
	agent: one(agents, {
		fields: [decisionLog.agentId],
		references: [agents.id]
	}),
	team_teamId: one(teams, {
		fields: [decisionLog.teamId],
		references: [teams.id],
		relationName: "decisionLog_teamId_teams_id"
	}),
	team_councilId: one(teams, {
		fields: [decisionLog.councilId],
		references: [teams.id],
		relationName: "decisionLog_councilId_teams_id"
	}),
	goal: one(goals, {
		fields: [decisionLog.goalId],
		references: [goals.id]
	}),
}));

export const teamsRelations = relations(teams, ({one, many}) => ({
	decisionLogs_teamId: many(decisionLog, {
		relationName: "decisionLog_teamId_teams_id"
	}),
	decisionLogs_councilId: many(decisionLog, {
		relationName: "decisionLog_councilId_teams_id"
	}),
	team: one(teams, {
		fields: [teams.parentTeamId],
		references: [teams.id],
		relationName: "teams_parentTeamId_teams_id"
	}),
	teams: many(teams, {
		relationName: "teams_parentTeamId_teams_id"
	}),
	agent: one(agents, {
		fields: [teams.leadAgentId],
		references: [agents.id]
	}),
	teamMemberships: many(teamMemberships),
	goals: many(goals),
	agentMessages: many(agentMessages),
}));

export const goalsRelations = relations(goals, ({one, many}) => ({
	decisionLogs: many(decisionLog),
	goal: one(goals, {
		fields: [goals.parentGoalId],
		references: [goals.id],
		relationName: "goals_parentGoalId_goals_id"
	}),
	goals: many(goals, {
		relationName: "goals_parentGoalId_goals_id"
	}),
	agent: one(agents, {
		fields: [goals.ownerAgentId],
		references: [agents.id]
	}),
	team: one(teams, {
		fields: [goals.ownerTeamId],
		references: [teams.id]
	}),
}));

export const delegationsRelations = relations(delegations, ({one}) => ({
	agent_delegatorId: one(agents, {
		fields: [delegations.delegatorId],
		references: [agents.id],
		relationName: "delegations_delegatorId_agents_id"
	}),
	agent_delegateeId: one(agents, {
		fields: [delegations.delegateeId],
		references: [agents.id],
		relationName: "delegations_delegateeId_agents_id"
	}),
}));

export const escalationEventsRelations = relations(escalationEvents, ({one}) => ({
	escalationChain: one(escalationChains, {
		fields: [escalationEvents.chainId],
		references: [escalationChains.id]
	}),
	agent_triggeredBy: one(agents, {
		fields: [escalationEvents.triggeredBy],
		references: [agents.id],
		relationName: "escalationEvents_triggeredBy_agents_id"
	}),
	agent_resolvedBy: one(agents, {
		fields: [escalationEvents.resolvedBy],
		references: [agents.id],
		relationName: "escalationEvents_resolvedBy_agents_id"
	}),
}));

export const escalationChainsRelations = relations(escalationChains, ({many}) => ({
	escalationEvents: many(escalationEvents),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({one}) => ({
	team: one(teams, {
		fields: [teamMemberships.teamId],
		references: [teams.id]
	}),
	agent: one(agents, {
		fields: [teamMemberships.agentId],
		references: [agents.id]
	}),
}));

export const agentMessagesRelations = relations(agentMessages, ({one, many}) => ({
	agent_fromAgentId: one(agents, {
		fields: [agentMessages.fromAgentId],
		references: [agents.id],
		relationName: "agentMessages_fromAgentId_agents_id"
	}),
	agent_toAgentId: one(agents, {
		fields: [agentMessages.toAgentId],
		references: [agents.id],
		relationName: "agentMessages_toAgentId_agents_id"
	}),
	team: one(teams, {
		fields: [agentMessages.toTeamId],
		references: [teams.id]
	}),
	agentMessage: one(agentMessages, {
		fields: [agentMessages.inReplyTo],
		references: [agentMessages.id],
		relationName: "agentMessages_inReplyTo_agentMessages_id"
	}),
	agentMessages: many(agentMessages, {
		relationName: "agentMessages_inReplyTo_agentMessages_id"
	}),
}));

export const agentMemoriesRelations = relations(agentMemories, ({one}) => ({
	agent_agentId: one(agents, {
		fields: [agentMemories.agentId],
		references: [agents.id],
		relationName: "agentMemories_agentId_agents_id"
	}),
	agent_sourceAgentId: one(agents, {
		fields: [agentMemories.sourceAgentId],
		references: [agents.id],
		relationName: "agentMemories_sourceAgentId_agents_id"
	}),
}));