/**
 * Promise timeout utility
 *
 * Provides a mechanism to wrap promises with timeout behavior
 * to prevent indefinite hangs during health checks.
 */

import { createLogger } from './logger.js';

const timeoutLogger = createLogger({ component: 'timeout' });

/**
 * Wraps a promise with a timeout, rejecting if the operation
 * takes longer than the specified duration.
 *
 * @param promise - The promise to wrap with timeout
 * @param timeoutMs - Timeout duration in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns The result of the promise if it resolves before timeout
 * @throws Error if the operation times out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timeoutLogger.warn({ timeoutMs, errorMessage }, 'Operation timed out');
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * TimeoutError class for type checking timeout errors
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout, returning a TimeoutError instance
 * for easier type checking.
 *
 * @param promise - The promise to wrap with timeout
 * @param timeoutMs - Timeout duration in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns The result of the promise if it resolves before timeout
 * @throws TimeoutError if the operation times out
 */
export async function withTimeoutTyped<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timeoutLogger.warn({ timeoutMs, errorMessage }, 'Operation timed out');
      reject(new TimeoutError(errorMessage, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
