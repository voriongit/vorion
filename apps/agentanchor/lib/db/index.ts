/**
 * Database Client - Neon PostgreSQL + Drizzle ORM
 *
 * Provides type-safe database access with connection pooling
 * optimized for serverless environments.
 */

import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Configure Neon for serverless
neonConfig.fetchConnectionCache = true

// Lazy initialization - only create client when DATABASE_URL is available
let _db: NeonHttpDatabase<typeof schema> | null = null

/**
 * Get the database client
 * Throws an error if DATABASE_URL is not configured
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is not configured. Please set the DATABASE_URL environment variable.'
      )
    }
    const sql = neon(databaseUrl)
    _db = drizzle(sql, { schema })
  }
  return _db
}

/**
 * Check if database is configured
 */
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

// Export a proxy that lazily initializes the database
// This allows imports without immediately requiring DATABASE_URL
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    return getDb()[prop as keyof NeonHttpDatabase<typeof schema>]
  },
})

// Export schema for use in queries
export { schema }

// Export types
export type Database = NeonHttpDatabase<typeof schema>
