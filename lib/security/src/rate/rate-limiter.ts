/**
 * In-memory rate limiter for API endpoints
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Remove requests outside the time window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      const oldestRequest = timestamps[0];
      const resetTime = oldestRequest + this.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }

    // Add current request
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return {
      allowed: true,
      remaining: this.maxRequests - timestamps.length,
      resetTime: now + this.windowMs
    };
  }

  /**
   * Clear rate limit for identifier
   */
  clear(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Get current usage for identifier
   */
  getUsage(identifier: string): { count: number; remaining: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);

    return {
      count: validTimestamps.length,
      remaining: this.maxRequests - validTimestamps.length
    };
  }

  /**
   * Reset all rate limits (for testing or cleanup)
   */
  resetAll(): void {
    this.requests.clear();
  }
}

/**
 * AI-specific rate limiter with stricter limits
 */
export class AIRateLimiter extends RateLimiter {
  constructor() {
    // 10 requests per minute for AI endpoints
    super(60000, 10);
  }
}

/**
 * Tool execution rate limiter
 */
export class ToolRateLimiter extends RateLimiter {
  constructor() {
    // 30 requests per minute for tool execution
    super(60000, 30);
  }
}