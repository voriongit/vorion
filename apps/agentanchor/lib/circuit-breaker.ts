/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by temporarily blocking calls to failing services.
 * States: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing recovery)
 */

import { CircuitBreakerError } from './errors'

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Blocking all requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number // Number of failures before opening
  successThreshold?: number // Number of successes to close from half-open
  timeout?: number // Time in ms before attempting recovery (OPEN -> HALF_OPEN)
  resetTimeout?: number // Time in ms to reset failure count in CLOSED state
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void
  onFailure?: (error: Error) => void
  onSuccess?: () => void
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  resetTimeout: 10000, // 10 seconds
  onStateChange: () => {},
  onFailure: () => {},
  onSuccess: () => {},
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  private lastSuccessTime: number = 0
  private nextAttemptTime: number = 0
  private readonly options: Required<CircuitBreakerOptions>
  private readonly serviceName: string

  constructor(serviceName: string, options: CircuitBreakerOptions = {}) {
    this.serviceName = serviceName
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can proceed based on current state
    if (!this.canExecute()) {
      throw new CircuitBreakerError(this.serviceName, {
        state: this.state,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      })
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error as Error)
      throw error
    }
  }

  /**
   * Check if execution is allowed based on current state
   */
  private canExecute(): boolean {
    const now = Date.now()

    switch (this.state) {
      case CircuitState.CLOSED:
        // Always allow execution in closed state
        return true

      case CircuitState.OPEN:
        // Check if timeout has elapsed
        if (now >= this.nextAttemptTime) {
          this.transitionTo(CircuitState.HALF_OPEN)
          return true
        }
        return false

      case CircuitState.HALF_OPEN:
        // Allow limited requests to test recovery
        return true
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now()
    this.options.onSuccess()

    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count after successful execution
        this.failureCount = 0
        break

      case CircuitState.HALF_OPEN:
        this.successCount++
        // Close circuit if enough consecutive successes
        if (this.successCount >= this.options.successThreshold) {
          this.transitionTo(CircuitState.CLOSED)
          this.failureCount = 0
          this.successCount = 0
        }
        break
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now()
    this.failureCount++
    this.options.onFailure(error)

    switch (this.state) {
      case CircuitState.CLOSED:
        // Open circuit if failure threshold exceeded
        if (this.failureCount >= this.options.failureThreshold) {
          this.transitionTo(CircuitState.OPEN)
          this.nextAttemptTime = Date.now() + this.options.timeout
        }
        break

      case CircuitState.HALF_OPEN:
        // Return to open state on any failure
        this.transitionTo(CircuitState.OPEN)
        this.nextAttemptTime = Date.now() + this.options.timeout
        this.successCount = 0
        break
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state
    if (oldState !== newState) {
      this.state = newState
      this.options.onStateChange(oldState, newState)

      console.log(
        `Circuit breaker [${this.serviceName}] state changed: ${oldState} -> ${newState}`,
        {
          failureCount: this.failureCount,
          successCount: this.successCount,
        }
      )
    }
  }

  /**
   * Force the circuit to OPEN state
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN)
    this.nextAttemptTime = Date.now() + this.options.timeout
  }

  /**
   * Force the circuit to CLOSED state
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED)
    this.failureCount = 0
    this.successCount = 0
  }

  /**
   * Get current circuit status
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
      lastSuccessTime: this.lastSuccessTime
        ? new Date(this.lastSuccessTime).toISOString()
        : null,
      nextAttemptTime:
        this.state === CircuitState.OPEN
          ? new Date(this.nextAttemptTime).toISOString()
          : null,
    }
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>()

  /**
   * Get or create a circuit breaker for a service
   */
  static getOrCreate(
    serviceName: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, options))
    }
    return this.breakers.get(serviceName)!
  }

  /**
   * Get all circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return this.breakers
  }

  /**
   * Get health status of all circuit breakers
   */
  static getHealthStatus() {
    const status: Record<string, any> = {}
    this.breakers.forEach((breaker, name) => {
      status[name] = breaker.getStatus()
    })
    return status
  }

  /**
   * Check if all circuit breakers are healthy
   */
  static isAllHealthy(): boolean {
    return Array.from(this.breakers.values()).every((breaker) =>
      breaker.isHealthy()
    )
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.breakers.forEach((breaker) => breaker.forceClose())
  }
}

/**
 * Pre-configured circuit breakers for common services
 */
export const anthropicCircuitBreaker = CircuitBreakerRegistry.getOrCreate(
  'anthropic',
  {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    onStateChange: (oldState, newState) => {
      console.warn(`Anthropic circuit breaker: ${oldState} -> ${newState}`)
    },
  }
)

export const supabaseCircuitBreaker = CircuitBreakerRegistry.getOrCreate(
  'supabase',
  {
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 30000, // 30 seconds
    onStateChange: (oldState, newState) => {
      console.warn(`Supabase circuit breaker: ${oldState} -> ${newState}`)
    },
  }
)
