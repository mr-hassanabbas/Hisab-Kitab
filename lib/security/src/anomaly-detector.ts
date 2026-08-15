// Anomaly Detection for Version 1
// Detects unusual patterns in user behavior and system usage

export interface AnomalyType {
  id: string;
  type: 'command_frequency' | 'time_pattern' | 'location_pattern' | 'amount_pattern' | 'error_pattern' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  description: string;
  detectedAt: Date;
  userId: number;
  details: Record<string, any>;
}

export interface AnomalyRule {
  id: string;
  name: string;
  type: AnomalyType['type'];
  check: (context: AnomalyContext) => AnomalyType | null;
  enabled: boolean;
}

export interface AnomalyContext {
  userId: number;
  currentCommand: string;
  currentIntent: string;
  currentAmount?: number;
  currentTime: Date;
  currentLocation?: string;
  recentCommands: Array<{ command: string; timestamp: Date }>;
  recentErrors: Array<{ error: string; timestamp: Date }>;
  historicalData: {
    averageCommandsPerHour: number;
    commonIntents: string[];
    typicalTimeRange: { start: number; end: number };
    typicalAmounts: number[];
  };
}

export class AnomalyDetector {
  private rules: Map<string, AnomalyRule>;
  private detectedAnomalies: AnomalyType[];
  private maxAnomalies: number = 1000;
  private anomalyRetentionDays: number = 30;

  constructor() {
    this.rules = new Map();
    this.detectedAnomalies = [];
    this.initializeRules();
  }

  /**
   * Initialize default anomaly detection rules
   */
  private initializeRules(): void {
    // Rule 1: Unusual command frequency
    this.addRule({
      id: 'high_command_frequency',
      name: 'High Command Frequency',
      type: 'command_frequency',
      enabled: true,
      check: (context) => {
        const oneHourAgo = new Date(context.currentTime.getTime() - 60 * 60 * 1000);
        const recentCommands = context.recentCommands.filter(c => c.timestamp >= oneHourAgo);
        
        if (recentCommands.length > 100) {
          return {
            id: this.generateId(),
            type: 'command_frequency',
            severity: 'high',
            confidence: 0.9,
            description: `Unusually high command frequency: ${recentCommands.length} commands in last hour`,
            detectedAt: context.currentTime,
            userId: context.userId,
            details: { commandCount: recentCommands.length, timeWindow: '1 hour' }
          };
        }
        
        return null;
      }
    });

    // Rule 2: Unusual time pattern
    this.addRule({
      id: 'unusual_time',
      name: 'Unusual Time Pattern',
      type: 'time_pattern',
      enabled: true,
      check: (context) => {
        const hour = context.currentTime.getHours();
        const { start, end } = context.historicalData.typicalTimeRange;
        
        // Check if outside typical range (allow 2 hour buffer)
        if (hour < start - 2 || hour > end + 2) {
          return {
            id: this.generateId(),
            type: 'time_pattern',
            severity: 'medium',
            confidence: 0.7,
            description: `Activity at unusual time: ${hour}:00 (typical: ${start}:00-${end}:00)`,
            detectedAt: context.currentTime,
            userId: context.userId,
            details: { currentHour: hour, typicalRange: `${start}-${end}` }
          };
        }
        
        return null;
      }
    });

    // Rule 3: Unusual amount pattern
    this.addRule({
      id: 'unusual_amount',
      name: 'Unusual Amount Pattern',
      type: 'amount_pattern',
      enabled: true,
      check: (context) => {
        if (context.currentAmount === undefined) {
          return null;
        }

        const amounts = context.historicalData.typicalAmounts;
        if (amounts.length === 0) {
          return null;
        }

        const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
        const stdDev = Math.sqrt(
          amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
        );

        // Flag if amount is > 3 standard deviations from mean
        if (context.currentAmount > avgAmount + 3 * stdDev) {
          return {
            id: this.generateId(),
            type: 'amount_pattern',
            severity: 'high',
            confidence: 0.85,
            description: `Unusually high amount: ${context.currentAmount} (typical avg: ${avgAmount.toFixed(2)})`,
            detectedAt: context.currentTime,
            userId: context.userId,
            details: {
              amount: context.currentAmount,
              average: avgAmount,
              stdDev: stdDev
            }
          };
        }
        
        return null;
      }
    });

    // Rule 4: High error rate
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      type: 'error_pattern',
      enabled: true,
      check: (context) => {
        const oneHourAgo = new Date(context.currentTime.getTime() - 60 * 60 * 1000);
        const recentErrors = context.recentErrors.filter(e => e.timestamp >= oneHourAgo);
        
        if (recentErrors.length > 10) {
          return {
            id: this.generateId(),
            type: 'error_pattern',
            severity: 'medium',
            confidence: 0.8,
            description: `High error rate: ${recentErrors.length} errors in last hour`,
            detectedAt: context.currentTime,
            userId: context.userId,
            details: { errorCount: recentErrors.length, timeWindow: '1 hour' }
          };
        }
        
        return null;
      }
    });

    // Rule 5: Unusual intent
    this.addRule({
      id: 'unusual_intent',
      name: 'Unusual Intent',
      type: 'behavioral',
      enabled: true,
      check: (context) => {
        const commonIntents = context.historicalData.commonIntents;
        
        if (!commonIntents.includes(context.currentIntent)) {
          return {
            id: this.generateId(),
            type: 'behavioral',
            severity: 'low',
            confidence: 0.5,
            description: `Unusual intent detected: ${context.currentIntent}`,
            detectedAt: context.currentTime,
            userId: context.userId,
            details: { intent: context.currentIntent, commonIntents }
          };
        }
        
        return null;
      }
    });
  }

  /**
   * Check for anomalies
   */
  checkAnomalies(context: AnomalyContext): AnomalyType[] {
    const anomalies: AnomalyType[] = [];

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const anomaly = rule.check(context);
        if (anomaly) {
          anomalies.push(anomaly);
          this.detectedAnomalies.push(anomaly);
        }
      } catch (error) {
        console.error(`[Anomaly Detector] Rule ${ruleId} failed:`, error);
      }
    }

    // Limit stored anomalies
    if (this.detectedAnomalies.length > this.maxAnomalies) {
      this.detectedAnomalies = this.detectedAnomalies.slice(-this.maxAnomalies);
    }

    return anomalies;
  }

  /**
   * Add custom rule
   */
  addRule(rule: AnomalyRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all rules
   */
  getRules(): AnomalyRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get detected anomalies
   */
  getAnomalies(userId?: number, startDate?: Date, endDate?: Date): AnomalyType[] {
    let anomalies = [...this.detectedAnomalies];

    if (userId !== undefined) {
      anomalies = anomalies.filter(a => a.userId === userId);
    }

    if (startDate !== undefined) {
      anomalies = anomalies.filter(a => a.detectedAt >= startDate);
    }

    if (endDate !== undefined) {
      anomalies = anomalies.filter(a => a.detectedAt <= endDate);
    }

    return anomalies.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /**
   * Get anomaly statistics
   */
  getStatistics(): {
    totalAnomalies: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byUser: Map<number, number>;
    recentAnomalies: AnomalyType[];
  } {
    const stats = {
      totalAnomalies: this.detectedAnomalies.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byUser: new Map<number, number>(),
      recentAnomalies: this.detectedAnomalies.slice(-10)
    };

    for (const anomaly of this.detectedAnomalies) {
      stats.byType[anomaly.type] = (stats.byType[anomaly.type] || 0) + 1;
      stats.bySeverity[anomaly.severity] = (stats.bySeverity[anomaly.severity] || 0) + 1;
      stats.byUser.set(anomaly.userId, (stats.byUser.get(anomaly.userId) || 0) + 1);
    }

    return stats;
  }

  /**
   * Clear old anomalies
   */
  clearOldAnomalies(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.anomalyRetentionDays);

    const beforeCount = this.detectedAnomalies.length;
    this.detectedAnomalies = this.detectedAnomalies.filter(a => a.detectedAt >= cutoffDate);
    const afterCount = this.detectedAnomalies.length;

    console.log(`[Anomaly Detector] Cleared ${beforeCount - afterCount} old anomalies`);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    maxAnomalies?: number;
    anomalyRetentionDays?: number;
  }): void {
    if (config.maxAnomalies) this.maxAnomalies = config.maxAnomalies;
    if (config.anomalyRetentionDays) this.anomalyRetentionDays = config.anomalyRetentionDays;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      maxAnomalies: this.maxAnomalies,
      anomalyRetentionDays: this.anomalyRetentionDays
    };
  }
}

// Singleton instance
export const anomalyDetector = new AnomalyDetector();

// Periodic cleanup
setInterval(() => {
  anomalyDetector.clearOldAnomalies();
}, 24 * 60 * 60 * 1000); // Every 24 hours
