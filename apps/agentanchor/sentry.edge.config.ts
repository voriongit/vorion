/**
 * Sentry Edge Configuration
 *
 * This configuration is used for error tracking in Edge Runtime (middleware, edge functions).
 */

import * as Sentry from '@sentry/nextjs'

// Note: Edge runtime has limited access to environment variables
// Only NEXT_PUBLIC_* variables are available
const sentryDsn = process.env.SENTRY_DSN
const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || 'development'

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,

    // Lower sample rate for edge functions to reduce costs
    tracesSampleRate: 0.05,

    debug: false,

    beforeSend(event) {
      // Don't send errors from health checks
      if (event.request?.url?.includes('/api/health')) {
        return null
      }

      return event
    },
  })
}
