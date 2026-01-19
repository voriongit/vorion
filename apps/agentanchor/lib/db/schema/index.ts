/**
 * Database Schema Index
 *
 * Exports all schema definitions for use with Drizzle ORM.
 * This file is referenced by drizzle.config.ts for migrations.
 */

// Users
export * from './users'

// Agents & Trust
export * from './agents'

// Trust Scores (atsf-core persistence)
export * from './trust-scores'

// Council Governance
export * from './council'

// Truth Chain (Immutable Audit)
export * from './truth-chain'

// Crypto Audit Log (Hash-Chained Audit)
export * from './crypto-audit-log'

// Observer (Event Log)
export * from './observer'

// Academy (Training)
export * from './academy'

// Curriculum (Training Modules)
export * from './curriculum'

// Escalations (Human-in-the-Loop)
export * from './escalations'

// Payments (Stripe, Payouts)
export * from './payments'

// Portable Trust Credentials (Growth Phase)
export * from './credentials'

// Trust Bridge (External Agent Certification)
export * from './trust-bridge'
