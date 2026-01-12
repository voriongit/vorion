/**
 * Payments Schema - Stripe Connect, payouts, and billing
 * FR109-115: Commission and payment handling
 */

import { pgTable, uuid, text, timestamp, decimal, jsonb, pgEnum, index, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { profiles, subscriptionTierEnum } from './users'
import { agents } from './agents'

// Enums
export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const payoutMethodEnum = pgEnum('payout_method', [
  'bank_transfer',
  'stripe',
  'crypto',
])

// Trainer payout accounts (Stripe Connect)
export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    // Stripe Connect
    stripeAccountId: text('stripe_account_id'),
    stripeAccountStatus: text('stripe_account_status').default('pending'),
    stripeOnboardingComplete: jsonb('stripe_onboarding_complete').$type<boolean>().default(false),
    // Payout preferences
    payoutMethod: payoutMethodEnum('payout_method').default('stripe'),
    payoutSchedule: text('payout_schedule').default('weekly'), // weekly, monthly, threshold
    payoutThreshold: decimal('payout_threshold', { precision: 10, scale: 2 }).default('100.00'),
    // Crypto (future)
    cryptoWalletAddress: text('crypto_wallet_address'),
    cryptoNetwork: text('crypto_network'),
    // Subscription
    subscriptionTier: subscriptionTierEnum('subscription_tier').default('free'),
    subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('payout_accounts_user_idx').on(table.userId),
    stripeAccountIdx: index('payout_accounts_stripe_idx').on(table.stripeAccountId),
  })
)

// Individual payouts
export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainerId: uuid('trainer_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').notNull().references(() => payoutAccounts.id),
    // Amount
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').default('usd').notNull(),
    platformFee: decimal('platform_fee', { precision: 10, scale: 2 }).default('0.00'),
    netAmount: decimal('net_amount', { precision: 10, scale: 2 }).notNull(),
    // Status
    status: payoutStatusEnum('status').default('pending').notNull(),
    // Stripe transfer
    stripeTransferId: text('stripe_transfer_id'),
    stripePayoutId: text('stripe_payout_id'),
    // Error handling
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').default(0),
    // Period covered
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    // Breakdown
    breakdown: jsonb('breakdown').$type<{
      commissions: number
      cloneRoyalties: number
      enterpriseFees: number
      adjustments: number
    }>().default({ commissions: 0, cloneRoyalties: 0, enterpriseFees: 0, adjustments: 0 }),
    // Timestamps
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    trainerIdx: index('payouts_trainer_idx').on(table.trainerId),
    statusIdx: index('payouts_status_idx').on(table.status),
    requestedAtIdx: index('payouts_requested_at_idx').on(table.requestedAt),
  })
)

// Usage billing records
export const usageBilling = pgTable(
  'usage_billing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Who owes
    consumerId: uuid('consumer_id').notNull().references(() => profiles.id),
    // For which agent
    agentId: uuid('agent_id').notNull().references(() => agents.id),
    trainerId: uuid('trainer_id').notNull().references(() => profiles.id),
    // Usage details
    taskCount: integer('task_count').default(1).notNull(),
    complexityMultiplier: decimal('complexity_multiplier', { precision: 3, scale: 1 }).default('1.0'),
    // Amounts
    grossAmount: decimal('gross_amount', { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal('platform_fee', { precision: 10, scale: 2 }).notNull(),
    trainerEarning: decimal('trainer_earning', { precision: 10, scale: 2 }).notNull(),
    // Billing status
    billed: jsonb('billed').$type<boolean>().default(false),
    billedAt: timestamp('billed_at', { withTimezone: true }),
    payoutId: uuid('payout_id').references(() => payouts.id),
    // Context
    taskType: text('task_type'),
    taskDescription: text('task_description'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    consumerIdx: index('usage_billing_consumer_idx').on(table.consumerId),
    agentIdx: index('usage_billing_agent_idx').on(table.agentId),
    trainerIdx: index('usage_billing_trainer_idx').on(table.trainerId),
    billedIdx: index('usage_billing_billed_idx').on(table.billed),
    createdAtIdx: index('usage_billing_created_at_idx').on(table.createdAt),
  })
)

// Relations
export const payoutAccountsRelations = relations(payoutAccounts, ({ one, many }) => ({
  user: one(profiles, {
    fields: [payoutAccounts.userId],
    references: [profiles.id],
  }),
  payouts: many(payouts),
}))

export const payoutsRelations = relations(payouts, ({ one }) => ({
  trainer: one(profiles, {
    fields: [payouts.trainerId],
    references: [profiles.id],
  }),
  account: one(payoutAccounts, {
    fields: [payouts.accountId],
    references: [payoutAccounts.id],
  }),
}))

export const usageBillingRelations = relations(usageBilling, ({ one }) => ({
  consumer: one(profiles, {
    fields: [usageBilling.consumerId],
    references: [profiles.id],
  }),
  agent: one(agents, {
    fields: [usageBilling.agentId],
    references: [agents.id],
  }),
  trainer: one(profiles, {
    fields: [usageBilling.trainerId],
    references: [profiles.id],
  }),
  payout: one(payouts, {
    fields: [usageBilling.payoutId],
    references: [payouts.id],
  }),
}))

// Types
export type PayoutAccount = typeof payoutAccounts.$inferSelect
export type NewPayoutAccount = typeof payoutAccounts.$inferInsert
export type Payout = typeof payouts.$inferSelect
export type NewPayout = typeof payouts.$inferInsert
export type UsageBilling = typeof usageBilling.$inferSelect
export type NewUsageBilling = typeof usageBilling.$inferInsert
