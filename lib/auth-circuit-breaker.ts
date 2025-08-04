/**
 * Circuit breaker for auth operations to prevent repeated timeouts
 */

import { logger } from './logger'

interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
}

class AuthCircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed'
  }
  
  private readonly maxFailures = 3
  private readonly timeoutMs = 30000 // 30 seconds
  private readonly retryTimeoutMs = 2000 // 2 seconds per attempt
  
  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state.state === 'open') {
      if (Date.now() - this.state.lastFailureTime > this.timeoutMs) {
        this.state.state = 'half-open'
        logger.info(`Circuit breaker half-open for ${operationName}`)
      } else {
        logger.warn(`Circuit breaker open for ${operationName}, using fallback`)
        throw new Error(`Circuit breaker open for ${operationName}`)
      }
    }
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`${operationName} timeout`)), this.retryTimeoutMs)
        })
      ])
      
      // Success - reset circuit breaker
      this.state.failures = 0
      this.state.state = 'closed'
      logger.debug(`Circuit breaker reset for ${operationName}`)
      
      return result
    } catch (error) {
      this.state.failures++
      this.state.lastFailureTime = Date.now()
      
      if (this.state.failures >= this.maxFailures) {
        this.state.state = 'open'
        logger.warn(`Circuit breaker opened for ${operationName} after ${this.state.failures} failures`)
      }
      
      throw error
    }
  }
  
  isOpen(): boolean {
    return this.state.state === 'open'
  }
  
  reset(): void {
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    }
    logger.info('Circuit breaker manually reset')
  }
}

export const authCircuitBreaker = new AuthCircuitBreaker()

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).authCircuitBreaker = authCircuitBreaker
}
