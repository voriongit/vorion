/**
 * Curriculum Schema - Academy training modules
 * FR42-44: Academy curriculum and progress tracking
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, index, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { academyProgress } from './academy'

// Enums
export const moduleTypeEnum = pgEnum('module_type', [
  'lesson',
  'exercise',
  'quiz',
  'simulation',
  'assessment',
])

export const difficultyEnum = pgEnum('difficulty', [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
])

// Curriculum definitions
export const curricula = pgTable(
  'curricula',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Identity
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    version: text('version').default('1.0').notNull(),
    // Type
    type: text('type').notNull(), // basic_training, specialized, advanced, certification
    category: text('category'), // safety, ethics, domain-specific, etc.
    // Requirements
    prerequisites: jsonb('prerequisites').$type<string[]>().default([]),
    requiredTrustTier: text('required_trust_tier').default('untrusted'),
    // Completion requirements
    passingScore: integer('passing_score').default(70),
    requiredModules: integer('required_modules'),
    estimatedDuration: integer('estimated_duration'), // minutes
    // Status
    isActive: jsonb('is_active').$type<boolean>().default(true),
    isRequired: jsonb('is_required').$type<boolean>().default(false), // Required for all agents
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => ({
    slugIdx: index('curricula_slug_idx').on(table.slug),
    typeIdx: index('curricula_type_idx').on(table.type),
    activeIdx: index('curricula_active_idx').on(table.isActive),
  })
)

// Individual training modules
export const curriculumModules = pgTable(
  'curriculum_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    curriculumId: uuid('curriculum_id').notNull().references(() => curricula.id, { onDelete: 'cascade' }),
    // Identity
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    // Order and structure
    orderIndex: integer('order_index').notNull(),
    chapter: text('chapter'), // Optional chapter grouping
    // Content
    moduleType: moduleTypeEnum('module_type').default('lesson').notNull(),
    difficulty: difficultyEnum('difficulty').default('beginner'),
    content: jsonb('content').$type<{
      sections: Array<{
        type: 'text' | 'code' | 'example' | 'warning' | 'tip'
        content: string
      }>
      resources?: Array<{
        type: 'link' | 'document' | 'video'
        title: string
        url: string
      }>
    }>().notNull(),
    // For quizzes/assessments
    questions: jsonb('questions').$type<Array<{
      id: string
      type: 'multiple_choice' | 'true_false' | 'free_text' | 'scenario'
      question: string
      options?: string[]
      correctAnswer?: string | number
      explanation?: string
      points: number
    }>>(),
    // Completion criteria
    passingScore: integer('passing_score').default(70),
    maxAttempts: integer('max_attempts').default(3),
    estimatedDuration: integer('estimated_duration'), // minutes
    // Prerequisites within curriculum
    prerequisiteModules: jsonb('prerequisite_modules').$type<string[]>().default([]),
    // Status
    isActive: jsonb('is_active').$type<boolean>().default(true),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    curriculumIdx: index('modules_curriculum_idx').on(table.curriculumId),
    orderIdx: index('modules_order_idx').on(table.orderIndex),
    slugIdx: index('modules_slug_idx').on(table.slug),
  })
)

// Module completion tracking (per agent enrollment)
export const moduleCompletions = pgTable(
  'module_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Links
    enrollmentId: uuid('enrollment_id').notNull().references(() => academyProgress.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').notNull().references(() => curriculumModules.id, { onDelete: 'cascade' }),
    // Progress
    status: text('status').default('not_started').notNull(), // not_started, in_progress, completed, failed
    attempts: integer('attempts').default(0),
    // Scores
    score: integer('score'),
    maxScore: integer('max_score'),
    // For quizzes
    answers: jsonb('answers').$type<Record<string, string | number>>(),
    feedback: jsonb('feedback').$type<Array<{
      questionId: string
      correct: boolean
      feedback?: string
    }>>(),
    // Time tracking
    timeSpent: integer('time_spent'), // seconds
    // Timestamps
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    enrollmentIdx: index('completions_enrollment_idx').on(table.enrollmentId),
    moduleIdx: index('completions_module_idx').on(table.moduleId),
    statusIdx: index('completions_status_idx').on(table.status),
  })
)

// Relations
export const curriculaRelations = relations(curricula, ({ many }) => ({
  modules: many(curriculumModules),
}))

export const curriculumModulesRelations = relations(curriculumModules, ({ one, many }) => ({
  curriculum: one(curricula, {
    fields: [curriculumModules.curriculumId],
    references: [curricula.id],
  }),
  completions: many(moduleCompletions),
}))

export const moduleCompletionsRelations = relations(moduleCompletions, ({ one }) => ({
  enrollment: one(academyProgress, {
    fields: [moduleCompletions.enrollmentId],
    references: [academyProgress.id],
  }),
  module: one(curriculumModules, {
    fields: [moduleCompletions.moduleId],
    references: [curriculumModules.id],
  }),
}))

// Types
export type Curriculum = typeof curricula.$inferSelect
export type NewCurriculum = typeof curricula.$inferInsert
export type CurriculumModule = typeof curriculumModules.$inferSelect
export type NewCurriculumModule = typeof curriculumModules.$inferInsert
export type ModuleCompletion = typeof moduleCompletions.$inferSelect
export type NewModuleCompletion = typeof moduleCompletions.$inferInsert
