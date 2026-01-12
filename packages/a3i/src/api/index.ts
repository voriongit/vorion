/**
 * A3I API Module
 *
 * HTTP API for the A3I Trust Engine using Hono framework.
 *
 * Example usage:
 * ```typescript
 * import { createApi } from '@orion/a3i/api';
 *
 * const app = createApi({
 *   apiKey: {
 *     validKeys: new Set(['my-api-key']),
 *     allowUnauthenticated: false,
 *   },
 * });
 *
 * // Serve with Bun, Node, Deno, etc.
 * export default app;
 * ```
 */

// Routes and API factory
export {
  createApi,
  createApiWithContext,
  DEFAULT_API_CONFIG,
  type ApiConfig,
} from './routes.js';

// Handlers
export {
  createHandlers,
  type HandlerContext,
  type Handlers,
} from './handlers.js';

// Middleware
export {
  apiKeyAuth,
  timing,
  requestId,
  errorHandler,
  rateLimit,
  cors,
  bodyLimit,
  ValidationError,
  DEFAULT_API_KEY_CONFIG,
  type ApiKeyConfig,
  type RateLimitConfig,
  type CorsConfig,
  type ErrorResponse,
} from './middleware.js';
