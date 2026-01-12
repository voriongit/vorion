/**
 * Observer Schema - Action audit log
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'
import { profiles } from './users'

// Enums
export const eventSeverityEnum = pgEnum('event_severity', [
  'debug',
  'info',
  'warning',
  'error',
  'critical',
])

export const eventCategoryEnum = pgEnum('event_category', [
  'agent_action',
  'user_action',
  'council_activity',
  'trust_change',
  'anomaly',
  'system',
  'security',
])

// Observer Events table - append-only action log
export const observerEvents = pgTable(
  'observer_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Event identification
    eventType: text('event_type').notNull(),
    category: eventCategoryEnum('category').notNull(),
    severity: eventSeverityEnum('severity').default('info').notNull(),
    // Subject (what the event is about)
    subjectType: text('subject_type').notNull(), // 'agent', 'user', 'decision', 'acquisition'
    subjectId: uuid('subject_id').notNull(),
    // Actor (who/what triggered the event)
    actorType: text('actor_type'), // 'user', 'agent', 'system'
    actorId: uuid('actor_id'),
    // Event data
    title: text('title').notNull(),
    description: text('description'),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    // Context
    sessionId: text('session_id'),
    requestId: text('request_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    // Anomaly detection
    anomalyScore: integer('anomaly_score').default(0),
    flagged: integer('flagged').default(0), // 0 = not flagged, 1 = flagged
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // Note: No updatedAt - this table is append-only
  },
  (table) => ({
    subjectIdx: index('observer_events_subject_idx').on(table.subjectType, table.subjectId),
    actorIdx: index('observer_events_actor_idx').on(table.actorId),
    categoryIdx: index('observer_events_category_idx').on(table.category),
    severityIdx: index('observer_events_severity_idx').on(table.severity),
    createdAtIdx: index('observer_events_created_at_idx').on(table.createdAt),
    eventTypeIdx: index('observer_events_type_idx').on(table.eventType),
    flaggedIdx: index('observer_events_flagged_idx').on(table.flagged),
  })
)

// Relations
export const observerEventsRelations = relations(observerEvents, ({ one }) => ({
  subjectAgent: one(agents, {
    fields: [observerEvents.subjectId],
    references: [agents.id],
  }),
  actorProfile: one(profiles, {
    fields: [observerEvents.actorId],
    references: [profiles.id],
  }),
}))

// Types
export type ObserverEvent = typeof observerEvents.$inferSelect
export type NewObserverEvent = typeof observerEvents.$inferInsert
