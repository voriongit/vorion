/**
 * Retry Logic with Exponential Backoff
 *
 * Provides retry capabilities for transient failures with configurable backoff strategies.
 */

import { ApiError, ErrorType } from './errors'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableErrors?: ErrorType[]
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT,
    ErrorType.ANTHROPIC_ERROR,
    ErrorType.API_ERROR,
  ],
  onRetry: () => {},
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break
      }

      // Check if error is retryable
      if (error instanceof ApiError) {
        if (!error.retryable && !opts.retryableErrors.includes(error.type)) {
          throw error
        }
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      )

      // Add jitter (±25% randomness to prevent thundering herd)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1)
      const finalDelay = Math.max(0, delay + jitter)

      // Call retry callback
      opts.onRetry(attempt + 1, lastError)

      // Wait before retrying
      await sleep(finalDelay)
    }
  }

  throw lastError!
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry with linear backoff (constant delay between retries)
 */
export async function withLinearRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, 'backoffMultiplier'> & { delay?: number } = {}
): Promise<T> {
  const delay = options.delay || 1000
  return withRetry(fn, {
    ...options,
    initialDelay: delay,
    backoffMultiplier: 1, // Linear (no exponential growth)
  })
}

/**
 * Retry with custom backoff function
 */
export async function withCustomRetry<T>(
  fn: () => Promise<T>,
  getDelay: (attempt: number) => number,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) {
        break
      }

      const delay = getDelay(attempt)
      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * Retry specific to Anthropic API calls
 */
export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelay: 2000, // Start with 2 seconds
    maxDelay: 60000, // Max 60 seconds
    backoffMultiplier: 3, // Aggressive backoff for API
    retryableErrors: [
      ErrorType.ANTHROPIC_ERROR,
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT,
    ],
    ...options,
  })
}

/**
 * Retry with timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs),
    retryOptions
  )
}

/**
 * Execute function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new ApiError(timeoutMessage, ErrorType.TIMEOUT, 504, true, {
          timeout: timeoutMs,
        })
      )
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}
