/**
 * Users Schema - Profiles and authentication
 */

import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'

// Enums
export const userRoleEnum = pgEnum('user_role', ['trainer', 'consumer', 'both'])
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'enterprise'])

// Profiles table
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').default('consumer').notNull(),
    subscriptionTier: subscriptionTierEnum('subscription_tier').default('free').notNull(),
    notificationPreferences: jsonb('notification_preferences').$type<{
      email: boolean
      in_app: boolean
      webhook: boolean
      webhook_url?: string
    }>().default({ email: true, in_app: true, webhook: false }),
    // Trainer-specific fields
    storefrontName: text('storefront_name'),
    storefrontBio: text('storefront_bio'),
    // Auth reference (Supabase auth.users or NextAuth)
    authUserId: text('auth_user_id').unique(),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('profiles_email_idx').on(table.email),
    authUserIdx: index('profiles_auth_user_idx').on(table.authUserId),
    roleIdx: index('profiles_role_idx').on(table.role),
  })
)

// Types
export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
