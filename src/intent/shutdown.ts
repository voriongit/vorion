/**
 * Graceful Shutdown Module
 *
 * Provides graceful shutdown handling for the INTENT module to ensure
 * in-flight requests are completed during deployment.
 *
 * Features:
 * - Track active HTTP requests
 * - Reject new requests during shutdown with 503 status
 * - Wait for in-flight requests to complete (with timeout)
 * - Coordinate BullMQ worker shutdown
 * - Close database and Redis connections
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../common/logger.js';
import { closeDatabase } from '../common/db.js';
import { closeRedis } from '../common/redis.js';
import { shutdownWorkers } from './queues.js';
import { shutdownGdprWorker } from './gdpr.js';
import { stopScheduler } from './scheduler.js';

const logger = createLogger({ component: 'shutdown' });

// Shutdown state
let isShuttingDown = false;
let activeRequests = 0;
let shutdownPromise: Promise<void> | null = null;

// Configuration
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds max wait
const REQUEST_POLL_INTERVAL_MS = 1000; // Check every second

/**
 * Check if the server is currently shutting down
 */
export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * Get the current number of active requests
 */
export function getActiveRequestCount(): number {
  return activeRequests;
}

/**
 * Track a new request and return a cleanup function to call when complete.
 * The cleanup function should be called in onResponse hook.
 */
export function trackRequest(): () => void {
  if (isShuttingDown) {
    // Even during shutdown, track for monitoring purposes
    logger.warn('Request tracked during shutdown phase');
  }
  activeRequests++;
  logger.debug({ activeRequests }, 'Request started');

  let cleaned = false;
  return () => {
    if (cleaned) return; // Prevent double cleanup
    cleaned = true;
    activeRequests--;
    logger.debug({ activeRequests }, 'Request completed');
  };
}

/**
 * Wait for all active requests to complete with timeout
 */
async function waitForRequestsToComplete(timeoutMs: number): Promise<boolean> {
  const startWait = Date.now();

  while (activeRequests > 0 && Date.now() - startWait < timeoutMs) {
    logger.info(
      { activeRequests, elapsedMs: Date.now() - startWait, timeoutMs },
      'Waiting for in-flight requests to complete'
    );
    await new Promise((resolve) => setTimeout(resolve, REQUEST_POLL_INTERVAL_MS));
  }

  return activeRequests === 0;
}

export interface GracefulShutdownOptions {
  /** Maximum time to wait for requests to complete in milliseconds */
  timeoutMs?: number;
  /** Skip closing database connections (for testing) */
  skipDatabase?: boolean;
  /** Skip closing Redis connections (for testing) */
  skipRedis?: boolean;
  /** Skip worker shutdown (for testing) */
  skipWorkers?: boolean;
  /** Skip scheduler shutdown (for testing) */
  skipScheduler?: boolean;
}

/**
 * Perform graceful shutdown of the server and all resources.
 *
 * Shutdown sequence:
 * 1. Stop accepting new connections
 * 2. Stop processing new queue jobs
 * 3. Wait for in-flight requests to complete
 * 4. Close database connections
 * 5. Close Redis connections
 */
export async function gracefulShutdown(
  server: FastifyInstance,
  options: GracefulShutdownOptions = {}
): Promise<void> {
  // Prevent multiple shutdown calls
  if (shutdownPromise) {
    logger.info('Shutdown already in progress, waiting...');
    return shutdownPromise;
  }

  isShuttingDown = true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;

  shutdownPromise = (async () => {
    logger.info({ timeoutMs }, 'Graceful shutdown initiated');

    // 1. Stop accepting new connections
    try {
      await server.close();
      logger.info('HTTP server closed - no longer accepting connections');
    } catch (error) {
      logger.error({ error }, 'Error closing HTTP server');
    }

    // 2. Stop scheduled jobs and resign leadership
    if (!options.skipScheduler) {
      try {
        await stopScheduler();
        logger.info('Scheduler stopped and leadership resigned');
      } catch (error) {
        logger.error({ error }, 'Error stopping scheduler');
      }
    }

    // 3. Stop processing new queue jobs
    if (!options.skipWorkers) {
      try {
        await shutdownWorkers(timeoutMs / 2); // Give workers half the timeout
        logger.info('BullMQ workers shutdown complete');
      } catch (error) {
        logger.error({ error }, 'Error shutting down workers');
      }

      try {
        await shutdownGdprWorker();
        logger.info('GDPR workers shutdown complete');
      } catch (error) {
        logger.error({ error }, 'Error shutting down GDPR workers');
      }
    }

    // 4. Wait for in-flight HTTP requests to complete
    const allCompleted = await waitForRequestsToComplete(timeoutMs / 2);

    if (!allCompleted) {
      logger.warn(
        { activeRequests },
        'Forcing shutdown with active requests still in progress'
      );
    } else {
      logger.info('All in-flight requests completed');
    }

    // 5. Close database connections
    if (!options.skipDatabase) {
      try {
        await closeDatabase();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error({ error }, 'Error closing database connections');
      }
    }

    // 6. Close Redis connections
    if (!options.skipRedis) {
      try {
        await closeRedis();
        logger.info('Redis connections closed');
      } catch (error) {
        logger.error({ error }, 'Error closing Redis connections');
      }
    }

    logger.info('Graceful shutdown complete');
  })();

  return shutdownPromise;
}

/**
 * Register signal handlers for graceful shutdown.
 *
 * Handles SIGTERM (Kubernetes/Docker) and SIGINT (Ctrl+C).
 */
export function registerShutdownHandlers(
  server: FastifyInstance,
  options?: GracefulShutdownOptions
): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    await gracefulShutdown(server, options);
    process.exit(0);
  };

  // SIGTERM: Kubernetes sends this for graceful termination
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  // SIGINT: Ctrl+C in terminal
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  logger.debug('Shutdown signal handlers registered');
}

/**
 * Default retry delay in seconds for 503 responses during shutdown
 */
const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Fastify hook to reject requests during shutdown.
 * Add this to server.addHook('onRequest', ...)
 *
 * When the server is shutting down:
 * - Returns 503 Service Unavailable
 * - Includes Retry-After header (RFC 7231)
 * - Provides structured error response
 */
export function shutdownRequestHook(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (isShuttingDown) {
    logger.info(
      { url: request.url, method: request.method },
      'Rejecting request - server is shutting down'
    );

    // Set Retry-After header per RFC 7231 Section 7.1.3
    void reply
      .status(503)
      .header('Retry-After', String(DEFAULT_RETRY_AFTER_SECONDS))
      .header('Connection', 'close')
      .send({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'The server is shutting down. Please retry your request shortly.',
        },
        retryAfter: DEFAULT_RETRY_AFTER_SECONDS,
        timestamp: new Date().toISOString(),
      });
    return;
  }

  // Track the request
  const cleanup = trackRequest();

  // Store cleanup function on request for onResponse hook
  // Use type assertion to add our custom property
  (request as FastifyRequest & { shutdownCleanup?: () => void }).shutdownCleanup = cleanup;
}

/**
 * Fastify hook to clean up request tracking.
 * Add this to server.addHook('onResponse', ...)
 */
export function shutdownResponseHook(request: FastifyRequest): void {
  const cleanup = (request as FastifyRequest & { shutdownCleanup?: () => void }).shutdownCleanup;
  if (cleanup) {
    cleanup();
  }
}

/**
 * Reset shutdown state (for testing purposes only)
 */
export function resetShutdownState(): void {
  isShuttingDown = false;
  activeRequests = 0;
  shutdownPromise = null;
}
