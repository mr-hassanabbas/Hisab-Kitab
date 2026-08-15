// Advanced Rate Limiter for Version 1
// Prevents abuse with adaptive throttling and per-operation limits

export interface RateLimitConfig {
  perUserLimit: number; // commands per minute
  perOperationLimit: Record<string, number>; // operation-specific limits
  globalLimit: number; // system-wide limit
  windowMs: number; // time window in milliseconds
  adaptiveThrottling: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  reason?: string;
  retryAfter?: number; // milliseconds
}

export interface UserRateLimit {
  userId: number;
  commands: Array<{ timestamp: Date; operation: string }>;
  operationCounts: Map<string, number>;
  warnings: number;
  blocked: boolean;
  blockedUntil?: Date;
}

export class AdvancedRateLimiter {
  private config: RateLimitConfig;
  private userLimits: Map<number, UserRateLimit>;
  private globalCommands: Array<{ timestamp: Date; userId: number }>;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      perUserLimit: config.perUserLimit || 30, // 30 commands per minute
      perOperationLimit: config.perOperationLimit || {
        'delete_project': 5,
        'delete_worker': 10,
        'delete_payment': 10,
        'create_payment': 20
      },
      globalLimit: config.globalLimit || 1000, // 1000 commands per minute system-wide
      windowMs: config.windowMs || 60 * 1000, // 1 minute window
      adaptiveThrottling: config.adaptiveThrottling ?? true
    };

    this.userLimits = new Map();
    this.globalCommands = [];

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  /**
   * Check if request is allowed
   */
  checkLimit(userId: number, operation: string): RateLimitResult {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);

    // Check if user is blocked
    const userLimit = this.getUserLimit(userId);
    if (userLimit.blocked && userLimit.blockedUntil && now < userLimit.blockedUntil) {
      return {
        allowed: false,
        limit: this.config.perUserLimit,
        remaining: 0,
        resetTime: userLimit.blockedUntil,
        reason: 'User is temporarily blocked due to excessive requests',
        retryAfter: userLimit.blockedUntil.getTime() - now.getTime()
      };
    }

    // Check global limit
    const recentGlobalCommands = this.globalCommands.filter(c => c.timestamp >= windowStart);
    if (recentGlobalCommands.length >= this.config.globalLimit) {
      return {
        allowed: false,
        limit: this.config.globalLimit,
        remaining: 0,
        resetTime: new Date(windowStart.getTime() + this.config.windowMs),
        reason: 'Global rate limit exceeded',
        retryAfter: this.config.windowMs
      };
    }

    // Check per-user limit
    const recentUserCommands = userLimit.commands.filter(c => c.timestamp >= windowStart);
    const userLimitResult = this.checkUserLimit(userId, operation, recentUserCommands.length, windowStart);
    
    if (!userLimitResult.allowed) {
      // Adaptive throttling: block temporarily if warnings exceeded
      if (this.config.adaptiveThrottling && userLimit.warnings >= 3) {
        this.blockUser(userId, 5 * 60 * 1000); // Block for 5 minutes
        userLimitResult.reason = 'User temporarily blocked due to repeated violations';
        userLimitResult.retryAfter = 5 * 60 * 1000;
      }
      
      return userLimitResult;
    }

    // Check per-operation limit
    const operationLimit = this.config.perOperationLimit[operation];
    if (operationLimit !== undefined) {
      const operationCount = recentUserCommands.filter(c => c.operation === operation).length;
      
      if (operationCount >= operationLimit) {
        return {
          allowed: false,
          limit: operationLimit,
          remaining: 0,
          resetTime: new Date(windowStart.getTime() + this.config.windowMs),
          reason: `Operation limit exceeded for ${operation}`,
          retryAfter: this.config.windowMs
        };
      }
    }

    // Request allowed - record it
    this.recordCommand(userId, operation);

    return {
      allowed: true,
      limit: this.config.perUserLimit,
      remaining: this.config.perUserLimit - recentUserCommands.length - 1,
      resetTime: new Date(windowStart.getTime() + this.config.windowMs)
    };
  }

  /**
   * Check user-specific limit
   */
  private checkUserLimit(
    userId: number,
    operation: string,
    currentCount: number,
    windowStart: Date
  ): RateLimitResult {
    if (currentCount >= this.config.perUserLimit) {
      // Increment warning counter
      const userLimit = this.getUserLimit(userId);
      userLimit.warnings++;

      return {
        allowed: false,
        limit: this.config.perUserLimit,
        remaining: 0,
        resetTime: new Date(windowStart.getTime() + this.config.windowMs),
        reason: 'Per-user rate limit exceeded',
        retryAfter: this.config.windowMs
      };
    }

    // Warning threshold at 80%
    if (currentCount >= this.config.perUserLimit * 0.8) {
      const userLimit = this.getUserLimit(userId);
      userLimit.warnings++;
    }

    return {
      allowed: true,
      limit: this.config.perUserLimit,
      remaining: this.config.perUserLimit - currentCount,
      resetTime: new Date(windowStart.getTime() + this.config.windowMs)
    };
  }

  /**
   * Record a command
   */
  private recordCommand(userId: number, operation: string): void {
    const now = new Date();
    const userLimit = this.getUserLimit(userId);

    userLimit.commands.push({ timestamp: now, operation });
    userLimit.operationCounts.set(operation, (userLimit.operationCounts.get(operation) || 0) + 1);

    this.globalCommands.push({ timestamp: now, userId });
  }

  /**
   * Get or create user limit
   */
  private getUserLimit(userId: number): UserRateLimit {
    let userLimit = this.userLimits.get(userId);
    
    if (!userLimit) {
      userLimit = {
        userId,
        commands: [],
        operationCounts: new Map(),
        warnings: 0,
        blocked: false
      };
      this.userLimits.set(userId, userLimit);
    }

    return userLimit;
  }

  /**
   * Block user temporarily
   */
  blockUser(userId: number, durationMs: number): void {
    const userLimit = this.getUserLimit(userId);
    userLimit.blocked = true;
    userLimit.blockedUntil = new Date(Date.now() + durationMs);
    
    console.log(`[Rate Limiter] Blocked user ${userId} for ${durationMs}ms`);
  }

  /**
   * Unblock user
   */
  unblockUser(userId: number): void {
    const userLimit = this.getUserLimit(userId);
    userLimit.blocked = false;
    userLimit.blockedUntil = undefined;
    userLimit.warnings = 0; // Reset warnings
    
    console.log(`[Rate Limiter] Unblocked user ${userId}`);
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);

    // Cleanup user commands
    for (const [userId, userLimit] of this.userLimits.entries()) {
      userLimit.commands = userLimit.commands.filter(c => c.timestamp >= windowStart);
      
      // Unblock if block period expired
      if (userLimit.blocked && userLimit.blockedUntil && now >= userLimit.blockedUntil) {
        this.unblockUser(userId);
      }
    }

    // Cleanup global commands
    this.globalCommands = this.globalCommands.filter(c => c.timestamp >= windowStart);

    // Remove inactive users
    for (const [userId, userLimit] of this.userLimits.entries()) {
      if (userLimit.commands.length === 0 && !userLimit.blocked) {
        this.userLimits.delete(userId);
      }
    }

    console.log('[Rate Limiter] Cleanup completed');
  }

  /**
   * Get user statistics
   */
  getUserStats(userId: number): {
    currentCount: number;
    remaining: number;
    warnings: number;
    blocked: boolean;
    operationCounts: Record<string, number>;
  } {
    const userLimit = this.getUserLimit(userId);
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);
    const recentCommands = userLimit.commands.filter(c => c.timestamp >= windowStart);

    const operationCounts: Record<string, number> = {};
    for (const [op, count] of userLimit.operationCounts.entries()) {
      operationCounts[op] = count;
    }

    return {
      currentCount: recentCommands.length,
      remaining: this.config.perUserLimit - recentCommands.length,
      warnings: userLimit.warnings,
      blocked: userLimit.blocked,
      operationCounts
    };
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalUsers: number;
    totalCommands: number;
    blockedUsers: number;
    activeUsers: number;
  } {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);
    const recentGlobalCommands = this.globalCommands.filter(c => c.timestamp >= windowStart);

    const activeUsers = new Set(recentGlobalCommands.map(c => c.userId));
    const blockedUsers = Array.from(this.userLimits.values()).filter(u => u.blocked).length;

    return {
      totalUsers: this.userLimits.size,
      totalCommands: recentGlobalCommands.length,
      blockedUsers,
      activeUsers: activeUsers.size
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Reset user limits
   */
  resetUserLimit(userId: number): void {
    const userLimit = this.getUserLimit(userId);
    userLimit.commands = [];
    userLimit.operationCounts.clear();
    userLimit.warnings = 0;
    userLimit.blocked = false;
    userLimit.blockedUntil = undefined;
    
    console.log(`[Rate Limiter] Reset limits for user ${userId}`);
  }

  /**
   * Reset all limits
   */
  resetAllLimits(): void {
    this.userLimits.clear();
    this.globalCommands = [];
    console.log('[Rate Limiter] Reset all limits');
  }
}

// Singleton instance
export const advancedRateLimiter = new AdvancedRateLimiter();
