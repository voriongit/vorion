/**
 * Sentry Client Configuration
 *
 * This configuration is used for client-side error tracking in the browser.
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

    replaysOnErrorSampleRate: 1.0,

    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'Non-Error promise rejection captured',
      // Network errors
      'Network request failed',
      'NetworkError',
      // Intentional aborts
      'AbortError',
    ],

    beforeSend(event, hint) {
      // Filter out non-error rejections
      if (event.exception) {
        const error = hint.originalException
        if (error instanceof Error) {
          // Don't send errors that are just informational
          if (error.message?.includes('ResizeObserver loop')) {
            return null
          }
        }
      }

      return event
    },
  })
}
