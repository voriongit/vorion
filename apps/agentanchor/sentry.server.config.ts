/**
 * Sentry Server Configuration
 *
 * This configuration is used for server-side error tracking in API routes and Server Components.
 */

import * as Sentry from '@sentry/nextjs'
import { config } from './lib/config'

if (config.monitoring.sentry) {
  Sentry.init({
    dsn: config.monitoring.sentry.dsn,
    environment: config.monitoring.sentry.environment,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: config.monitoring.sentry.tracesSampleRate,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Ignore certain errors
    ignoreErrors: [
      'ECONNRESET',
      'EPIPE',
      'ETIMEDOUT',
    ],

    beforeSend(event, hint) {
      // Add user context if available
      const error = hint.originalException

      // Don't send errors from health checks
      if (event.request?.url?.includes('/api/health')) {
        return null
      }

      // Enhance error context
      if (error instanceof Error) {
        event.extra = {
          ...event.extra,
          errorName: error.name,
          errorStack: error.stack,
        }
      }

      return event
    },
  })
}
