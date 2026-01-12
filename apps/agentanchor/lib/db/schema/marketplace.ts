/**
 * Marketplace Schema - Listings and acquisitions
 */

import { pgTable, uuid, text, timestamp, integer, decimal, jsonb, pgEnum, index, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { agents } from './agents'
import { profiles } from './users'

// Enums
export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'pending_review',
  'active',
  'paused',
  'sold_out',
  'retired',
])

export const acquisitionTypeEnum = pgEnum('acquisition_type', [
  'commission', // Pay per use
  'clone', // One-time purchase, own a copy
  'enterprise_lock', // Exclusive enterprise license
])

export const acquisitionStatusEnum = pgEnum('acquisition_status', [
  'active',
  'suspended',
  'terminated',
  'expired',
])

// Marketplace Listings table
export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    // Listing details
    title: text('title').notNull(),
    description: text('description'),
    status: listingStatusEnum('status').default('draft').notNull(),
    // Pricing
    commissionRate: decimal('commission_rate', { precision: 10, scale: 4 }), // Per-use rate
    clonePrice: decimal('clone_price', { precision: 10, scale: 2 }), // One-time clone price
    enterprisePrice: decimal('enterprise_price', { precision: 10, scale: 2 }), // Enterprise lock price
    // Availability
    availableForCommission: boolean('available_for_commission').default(true),
    availableForClone: boolean('available_for_clone').default(false),
    availableForEnterprise: boolean('available_for_enterprise').default(false),
    // Limits
    maxClones: integer('max_clones'),
    currentClones: integer('current_clones').default(0),
    // Metadata
    tags: jsonb('tags').$type<string[]>().default([]),
    category: text('category'),
    previewConfig: jsonb('preview_config').$type<Record<string, unknown>>().default({}),
    // Statistics
    viewCount: integer('view_count').default(0),
    acquisitionCount: integer('acquisition_count').default(0),
    averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
    reviewCount: integer('review_count').default(0),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => ({
    agentIdx: index('marketplace_listings_agent_idx').on(table.agentId),
    sellerIdx: index('marketplace_listings_seller_idx').on(table.sellerId),
    statusIdx: index('marketplace_listings_status_idx').on(table.status),
    categoryIdx: index('marketplace_listings_category_idx').on(table.category),
    publishedAtIdx: index('marketplace_listings_published_idx').on(table.publishedAt),
  })
)

// Acquisitions table - consumer-agent relationships
export const acquisitions = pgTable(
  'acquisitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id').notNull().references(() => marketplaceListings.id),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    consumerId: uuid('consumer_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    // Acquisition details
    acquisitionType: acquisitionTypeEnum('acquisition_type').notNull(),
    status: acquisitionStatusEnum('status').default('active').notNull(),
    // For clones - reference to the cloned agent
    clonedAgentId: uuid('cloned_agent_id').references(() => agents.id),
    // Pricing at time of acquisition
    priceAtAcquisition: decimal('price_at_acquisition', { precision: 10, scale: 2 }),
    commissionRateAtAcquisition: decimal('commission_rate_at_acquisition', { precision: 10, scale: 4 }),
    // Usage tracking
    totalUsage: integer('total_usage').default(0),
    totalSpent: decimal('total_spent', { precision: 10, scale: 2 }).default('0'),
    // Walk-away rights (client protection)
    canWalkAway: boolean('can_walk_away').default(true),
    walkAwayReason: text('walk_away_reason'),
    // Consumer feedback
    rating: integer('rating'), // 1-5
    review: text('review'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    terminatedAt: timestamp('terminated_at', { withTimezone: true }),
  },
  (table) => ({
    listingIdx: index('acquisitions_listing_idx').on(table.listingId),
    agentIdx: index('acquisitions_agent_idx').on(table.agentId),
    consumerIdx: index('acquisitions_consumer_idx').on(table.consumerId),
    statusIdx: index('acquisitions_status_idx').on(table.status),
    typeIdx: index('acquisitions_type_idx').on(table.acquisitionType),
    createdAtIdx: index('acquisitions_created_at_idx').on(table.createdAt),
  })
)

// Relations
export const marketplaceListingsRelations = relations(marketplaceListings, ({ one, many }) => ({
  agent: one(agents, {
    fields: [marketplaceListings.agentId],
    references: [agents.id],
  }),
  seller: one(profiles, {
    fields: [marketplaceListings.sellerId],
    references: [profiles.id],
  }),
  acquisitions: many(acquisitions),
}))

export const acquisitionsRelations = relations(acquisitions, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [acquisitions.listingId],
    references: [marketplaceListings.id],
  }),
  agent: one(agents, {
    fields: [acquisitions.agentId],
    references: [agents.id],
  }),
  consumer: one(profiles, {
    fields: [acquisitions.consumerId],
    references: [profiles.id],
  }),
  clonedAgent: one(agents, {
    fields: [acquisitions.clonedAgentId],
    references: [agents.id],
  }),
}))

// Types
export type MarketplaceListing = typeof marketplaceListings.$inferSelect
export type NewMarketplaceListing = typeof marketplaceListings.$inferInsert
export type Acquisition = typeof acquisitions.$inferSelect
export type NewAcquisition = typeof acquisitions.$inferInsert
