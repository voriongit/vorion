/**
 * Academy Schema - Training progress tracking
 */

import { pgTable, uuid, text, timestamp, integer, decimal, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'

// Enums
export const academyStatusEnum = pgEnum('academy_status', [
  'enrolled',
  'in_progress',
  'examination',
  'passed',
  'failed',
  'withdrawn',
])

export const curriculumTypeEnum = pgEnum('curriculum_type', [
  'basic_training',
  'specialized',
  'advanced',
  'certification',
  'remedial',
])

// Academy Progress table
export const academyProgress = pgTable(
  'academy_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    // Curriculum details
    curriculumType: curriculumTypeEnum('curriculum_type').notNull(),
    curriculumVersion: text('curriculum_version').default('1.0'),
    status: academyStatusEnum('status').default('enrolled').notNull(),
    // Progress tracking
    currentModule: integer('current_module').default(1),
    totalModules: integer('total_modules').default(5),
    completedModules: jsonb('completed_modules').$type<number[]>().default([]),
    // Scores
    moduleScores: jsonb('module_scores').$type<Record<string, number>>().default({}),
    overallScore: decimal('overall_score', { precision: 5, scale: 2 }),
    // Examination
    examinationAttempts: integer('examination_attempts').default(0),
    lastExaminationScore: decimal('last_examination_score', { precision: 5, scale: 2 }),
    examinationHistory: jsonb('examination_history').$type<Array<{
      attempt: number
      score: number
      date: string
      passed: boolean
    }>>().default([]),
    // Training metadata
    trainingConfig: jsonb('training_config').$type<{
      focusAreas?: string[]
      excludedTopics?: string[]
      customPrompts?: string[]
    }>().default({}),
    // Timestamps
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    graduatedAt: timestamp('graduated_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    agentIdx: index('academy_progress_agent_idx').on(table.agentId),
    statusIdx: index('academy_progress_status_idx').on(table.status),
    curriculumIdx: index('academy_progress_curriculum_idx').on(table.curriculumType),
    enrolledAtIdx: index('academy_progress_enrolled_idx').on(table.enrolledAt),
  })
)

// Relations
export const academyProgressRelations = relations(academyProgress, ({ one }) => ({
  agent: one(agents, {
    fields: [academyProgress.agentId],
    references: [agents.id],
  }),
}))

// Types
export type AcademyProgress = typeof academyProgress.$inferSelect
export type NewAcademyProgress = typeof academyProgress.$inferInsert
