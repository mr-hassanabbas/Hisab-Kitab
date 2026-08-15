// Comprehensive Audit Logger for Version 1
// Logs all voice commands, AI decisions, security events, and tool executions

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: number;
  sessionId: string;
  eventType: 'voice_command' | 'intent_classification' | 'entity_resolution' | 'security_decision' | 'tool_execution' | 'error' | 'authentication';
  category: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  duration?: number; // milliseconds
}

export interface AuditLogQuery {
  userId?: number;
  sessionId?: string;
  eventType?: AuditLogEntry['eventType'];
  category?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditLogEntry['severity'];
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditLogStatistics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  successRate: number;
  averageDuration: number;
  topUsers: Array<{ userId: number; eventCount: number }>;
  recentErrors: AuditLogEntry[];
}

export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000; // Keep last 10k logs in memory
  private retentionDays: number = 90; // Retain logs for 90 days

  /**
   * Log an event
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): string {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date()
    };

    this.logs.push(logEntry);

    // Limit memory usage
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // In production, this would also write to database
    console.log('[Audit Log]', JSON.stringify(logEntry));

    return logEntry.id;
  }

  /**
   * Log voice command
   */
  logVoiceCommand(
    userId: number,
    sessionId: string,
    transcript: string,
    intent: string,
    confidence: number,
    success: boolean,
    duration: number
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'voice_command',
      category: 'voice',
      details: {
        transcript,
        intent,
        confidence,
        language: 'detected' // Would be actual language detection
      },
      severity: 'info',
      success,
      duration
    });
  }

  /**
   * Log intent classification
   */
  logIntentClassification(
    userId: number,
    sessionId: string,
    transcript: string,
    intent: string,
    confidence: number,
    entities: Record<string, any>
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'intent_classification',
      category: 'ai',
      details: {
        transcript,
        intent,
        confidence,
        entities
      },
      severity: 'info',
      success: true
    });
  }

  /**
   * Log entity resolution
   */
  logEntityResolution(
    userId: number,
    sessionId: string,
    entityType: string,
    entityName: string,
    resolvedId: number | null,
    confidence: number
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'entity_resolution',
      category: 'ai',
      details: {
        entityType,
        entityName,
        resolvedId,
        confidence
      },
      severity: 'info',
      success: resolvedId !== null
    });
  }

  /**
   * Log security decision
   */
  logSecurityDecision(
    userId: number,
    sessionId: string,
    operation: string,
    allowed: boolean,
    reason: string,
    riskLevel: string
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'security_decision',
      category: 'security',
      details: {
        operation,
        allowed,
        reason,
        riskLevel
      },
      severity: allowed ? 'info' : 'warning',
      success: allowed
    });
  }

  /**
   * Log tool execution
   */
  logToolExecution(
    userId: number,
    sessionId: string,
    toolName: string,
    parameters: Record<string, any>,
    success: boolean,
    result?: any,
    error?: string,
    duration: number
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'tool_execution',
      category: 'tools',
      details: {
        toolName,
        parameters,
        result: success ? result : undefined,
        error: !success ? error : undefined
      },
      severity: success ? 'info' : 'error',
      success,
      duration
    });
  }

  /**
   * Log error
   */
  logError(
    userId: number,
    sessionId: string,
    errorType: string,
    errorMessage: string,
    stackTrace?: string,
    severity: 'warning' | 'error' | 'critical' = 'error'
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'error',
      category: 'system',
      details: {
        errorType,
        errorMessage,
        stackTrace
      },
      severity,
      success: false
    });
  }

  /**
   * Log authentication event
   */
  logAuthentication(
    userId: number,
    sessionId: string,
    method: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): string {
    return this.log({
      userId,
      sessionId,
      eventType: 'authentication',
      category: 'security',
      details: {
        method,
        ipAddress,
        userAgent
      },
      severity: success ? 'info' : 'warning',
      success,
      ipAddress,
      userAgent
    });
  }

  /**
   * Query logs
   */
  query(query: AuditLogQuery): AuditLogEntry[] {
    let results = [...this.logs];

    // Filter by user
    if (query.userId !== undefined) {
      results = results.filter(log => log.userId === query.userId);
    }

    // Filter by session
    if (query.sessionId !== undefined) {
      results = results.filter(log => log.sessionId === query.sessionId);
    }

    // Filter by event type
    if (query.eventType !== undefined) {
      results = results.filter(log => log.eventType === query.eventType);
    }

    // Filter by category
    if (query.category !== undefined) {
      results = results.filter(log => log.category === query.category);
    }

    // Filter by date range
    if (query.startDate !== undefined) {
      results = results.filter(log => log.timestamp >= query.startDate);
    }
    if (query.endDate !== undefined) {
      results = results.filter(log => log.timestamp <= query.endDate);
    }

    // Filter by severity
    if (query.severity !== undefined) {
      results = results.filter(log => log.severity === query.severity);
    }

    // Filter by success
    if (query.success !== undefined) {
      results = results.filter(log => log.success === query.success);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get log statistics
   */
  getStatistics(timeRange?: { startDate: Date; endDate: Date }): AuditLogStatistics {
    let logs = this.logs;

    // Apply time range filter
    if (timeRange) {
      logs = logs.filter(log => 
        log.timestamp >= timeRange.startDate && 
        log.timestamp <= timeRange.endDate
      );
    }

    const stats: AuditLogStatistics = {
      totalEvents: logs.length,
      eventsByType: {},
      eventsByCategory: {},
      eventsBySeverity: {},
      successRate: 0,
      averageDuration: 0,
      topUsers: [],
      recentErrors: []
    };

    // Count by type
    for (const log of logs) {
      stats.eventsByType[log.eventType] = (stats.eventsByType[log.eventType] || 0) + 1;
      stats.eventsByCategory[log.category] = (stats.eventsByCategory[log.category] || 0) + 1;
      stats.eventsBySeverity[log.severity] = (stats.eventsBySeverity[log.severity] || 0) + 1;
    }

    // Calculate success rate
    const successCount = logs.filter(log => log.success).length;
    stats.successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 0;

    // Calculate average duration
    const logsWithDuration = logs.filter(log => log.duration !== undefined);
    if (logsWithDuration.length > 0) {
      const totalDuration = logsWithDuration.reduce((sum, log) => sum + (log.duration || 0), 0);
      stats.averageDuration = totalDuration / logsWithDuration.length;
    }

    // Top users
    const userCounts = new Map<number, number>();
    for (const log of logs) {
      userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
    }
    stats.topUsers = Array.from(userCounts.entries())
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Recent errors
    stats.recentErrors = logs
      .filter(log => log.eventType === 'error' || !log.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return stats;
  }

  /**
   * Get user activity summary
   */
  getUserActivitySummary(userId: number, days: number = 7): {
    totalCommands: number;
    successRate: number;
    topIntents: Array<{ intent: string; count: number }>;
    averageDuration: number;
    recentActivity: AuditLogEntry[];
  } {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userLogs = this.query({
      userId,
      startDate,
      eventType: 'voice_command'
    });

    const totalCommands = userLogs.length;
    const successCount = userLogs.filter(log => log.success).length;
    const successRate = totalCommands > 0 ? (successCount / totalCommands) * 100 : 0;

    // Top intents
    const intentCounts = new Map<string, number>();
    for (const log of userLogs) {
      const intent = log.details.intent || 'unknown';
      intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
    }

    const topIntents = Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Average duration
    const logsWithDuration = userLogs.filter(log => log.duration !== undefined);
    const averageDuration = logsWithDuration.length > 0
      ? logsWithDuration.reduce((sum, log) => sum + (log.duration || 0), 0) / logsWithDuration.length
      : 0;

    return {
      totalCommands,
      successRate,
      topIntents,
      averageDuration,
      recentActivity: userLogs.slice(0, 10)
    };
  }

  /**
   * Export logs
   */
  exportLogs(query?: AuditLogQuery): string {
    const logs = query ? this.query(query) : this.logs;
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Clear old logs
   */
  clearOldLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const beforeCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
    const afterCount = this.logs.length;

    console.log(`[Audit Logger] Cleared ${beforeCount - afterCount} old logs`);
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    this.logs = [];
    console.log('[Audit Logger] Cleared all logs');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    maxLogs?: number;
    retentionDays?: number;
  }): void {
    if (config.maxLogs) this.maxLogs = config.maxLogs;
    if (config.retentionDays) this.retentionDays = config.retentionDays;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      maxLogs: this.maxLogs,
      retentionDays: this.retentionDays
    };
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

// Periodic cleanup
setInterval(() => {
  auditLogger.clearOldLogs();
}, 24 * 60 * 60 * 1000); // Every 24 hours
