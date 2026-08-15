// Performance Monitoring Dashboard for Phase 13
import { PerformanceMetrics } from '../metrics/performance-metrics';
import { CostMonitor } from '@workspace/cost';

export interface DashboardConfig {
  refreshInterval: number; // milliseconds
  enableRealTimeUpdates: boolean;
  showCostMetrics: boolean;
  showDatabaseMetrics: boolean;
  showCacheMetrics: boolean;
  showAIMetrics: boolean;
  showVoiceMetrics: boolean;
}

export interface PerformanceDashboardData {
  timestamp: string;
  database: {
    avgQueryTime: number;
    errorRate: number;
    totalQueries: number;
    status: 'good' | 'warning' | 'critical';
  };
  cache: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    status: 'good' | 'warning' | 'critical';
  };
  ai: {
    avgRequestTime: number;
    avgTokens: number;
    totalRequests: number;
    status: 'good' | 'warning' | 'critical';
  };
  voice: {
    avgRecognitionTime: number;
    avgConfidence: number;
    totalRequests: number;
    status: 'good' | 'warning' | 'critical';
  };
  cost: {
    totalSpend: number;
    avgCostPerRequest: number;
    totalOperations: number;
    budgetStatus: {
      dailyRemaining: number;
      monthlyRemaining: number;
      dailyPercentage: number;
      monthlyPercentage: number;
      alertTriggered: boolean;
    };
    status: 'good' | 'warning' | 'critical';
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    eventLoopDelay: number;
    status: 'good' | 'warning' | 'critical';
  };
}

export class PerformanceDashboard {
  private performanceMetrics: PerformanceMetrics;
  private costMonitor: CostMonitor;
  private config: DashboardConfig;
  private updateInterval?: NodeJS.Timeout;
  private currentData: PerformanceDashboardData | null = null;
  private subscribers: Set<(data: PerformanceDashboardData) => void> = new Set();

  constructor(
    performanceMetrics: PerformanceMetrics,
    costMonitor: CostMonitor,
    config: Partial<DashboardConfig> = {}
  ) {
    this.performanceMetrics = performanceMetrics;
    this.costMonitor = costMonitor;
    this.config = {
      refreshInterval: config.refreshInterval || 5000, // 5 seconds
      enableRealTimeUpdates: config.enableRealTimeUpdates ?? true,
      showCostMetrics: config.showCostMetrics ?? true,
      showDatabaseMetrics: config.showDatabaseMetrics ?? true,
      showCacheMetrics: config.showCacheMetrics ?? true,
      showAIMetrics: config.showAIMetrics ?? true,
      showVoiceMetrics: config.showVoiceMetrics ?? true,
      ...config
    };

    if (this.config.enableRealTimeUpdates) {
      this.startRealTimeUpdates();
    }
  }

  /**
   * Start real-time updates
   */
  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, this.config.refreshInterval);
  }

  /**
   * Stop real-time updates
   */
  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Update dashboard data
   */
  private updateDashboard(): void {
    const data = this.collectDashboardData();
    this.currentData = data;
    this.notifySubscribers(data);
  }

  /**
   * Collect all dashboard data
   */
  private collectDashboardData(): PerformanceDashboardData {
    const summary = this.performanceMetrics.getPerformanceSummary();
    const budgetStatus = this.costMonitor.getBudgetStatus();

    return {
      timestamp: new Date().toISOString(),
      database: {
        avgQueryTime: summary.database.avgQueryTime,
        errorRate: summary.database.errorRate,
        totalQueries: summary.database.totalQueries,
        status: this.evaluateDatabaseStatus(summary.database)
      },
      cache: {
        hitRate: summary.cache.hitRate,
        totalHits: summary.cache.totalHits,
        totalMisses: summary.cache.totalMisses,
        status: this.evaluateCacheStatus(summary.cache)
      },
      ai: {
        avgRequestTime: summary.ai.avgRequestTime,
        avgTokens: summary.ai.avgTokens,
        totalRequests: summary.ai.totalRequests,
        status: this.evaluateAIStatus(summary.ai)
      },
      voice: {
        avgRecognitionTime: summary.voice.avgRecognitionTime,
        avgConfidence: summary.voice.avgConfidence,
        totalRequests: summary.voice.totalRequests,
        status: this.evaluateVoiceStatus(summary.voice)
      },
      cost: {
        totalSpend: summary.cost.totalSpend,
        avgCostPerRequest: summary.cost.avgCostPerRequest,
        totalOperations: summary.cost.totalOperations,
        budgetStatus,
        status: this.evaluateCostStatus(summary.cost, budgetStatus)
      },
      system: {
        memoryUsage: 0, // Would need actual system monitoring
        cpuUsage: 0, // Would need actual system monitoring
        eventLoopDelay: 0, // Would need actual system monitoring
        status: 'good' // Default for now
      }
    };
  }

  /**
   * Evaluate database status
   */
  private evaluateDatabaseStatus(db: typeof PerformanceDashboardData['database']): 'good' | 'warning' | 'critical' {
    if (db.errorRate > 5) return 'critical';
    if (db.errorRate > 1) return 'warning';
    if (db.avgQueryTime > 1000) return 'warning';
    return 'good';
  }

  /**
   * Evaluate cache status
   */
  private evaluateCacheStatus(cache: typeof PerformanceDashboardData['cache']): 'good' | 'warning' | 'critical' {
    if (cache.hitRate < 50) return 'warning';
    if (cache.hitRate < 30) return 'critical';
    return 'good';
  }

  /**
   * Evaluate AI status
   */
  private evaluateAIStatus(ai: typeof PerformanceDashboardData['ai']): 'good' | 'warning' | 'critical' {
    if (ai.avgRequestTime > 5000) return 'critical';
    if (ai.avgRequestTime > 3000) return 'warning';
    return 'good';
  }

  /**
   * Evaluate voice status
   */
  private evaluateVoiceStatus(voice: typeof PerformanceDashboardData['voice']): 'good' | 'warning' | 'critical' {
    if (voice.avgRecognitionTime > 3000) return 'critical';
    if (voice.avgRecognitionTime > 2000) return 'warning';
    if (voice.avgConfidence < 0.7) return 'warning';
    if (voice.avgConfidence < 0.5) return 'critical';
    return 'good';
  }

  /**
   * Evaluate cost status
   */
  private evaluateCostStatus(
    cost: typeof PerformanceDashboardData['cost'],
    budget: typeof PerformanceDashboardData['cost']['budgetStatus']
  ): 'good' | 'warning' | 'critical' {
    if (budget.alertTriggered) return 'critical';
    if (budget.dailyPercentage > 80) return 'warning';
    if (budget.monthlyPercentage > 80) return 'warning';
    return 'good';
  }

  /**
   * Get current dashboard data
   */
  getCurrentData(): PerformanceDashboardData | null {
    return this.currentData || this.collectDashboardData();
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribe(callback: (data: PerformanceDashboardData) => void): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(data: PerformanceDashboardData): void {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Dashboard subscriber error:', error);
      }
    });
  }

  /**
   * Force immediate update
   */
  forceUpdate(): PerformanceDashboardData {
    this.updateDashboard();
    return this.currentData!;
  }

  /**
   * Get dashboard summary for notifications
   */
  getSummary(): {
    overallStatus: 'good' | 'warning' | 'critical';
    criticalIssues: string[];
    warnings: string[];
  } {
    const data = this.getCurrentData();
    if (!data) {
      return {
        overallStatus: 'good',
        criticalIssues: [],
        warnings: []
      };
    }

    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    if (data.database.status === 'critical') {
      criticalIssues.push('Database performance critical');
    } else if (data.database.status === 'warning') {
      warnings.push('Database performance degraded');
    }

    if (data.cache.status === 'critical') {
      criticalIssues.push('Cache hit rate critically low');
    } else if (data.cache.status === 'warning') {
      warnings.push('Cache hit rate below optimal');
    }

    if (data.ai.status === 'critical') {
      criticalIssues.push('AI response time critical');
    } else if (data.ai.status === 'warning') {
      warnings.push('AI response time elevated');
    }

    if (data.voice.status === 'critical') {
      criticalIssues.push('Voice recognition performance critical');
    } else if (data.voice.status === 'warning') {
      warnings.push('Voice recognition performance degraded');
    }

    if (data.cost.status === 'critical') {
      criticalIssues.push('Budget limit exceeded or near critical');
    } else if (data.cost.status === 'warning') {
      warnings.push('Budget usage high');
    }

    const overallStatus = criticalIssues.length > 0 ? 'critical' :
                         warnings.length > 0 ? 'warning' : 'good';

    return {
      overallStatus,
      criticalIssues,
      warnings
    };
  }

  /**
   * Get performance trends (would need historical data)
   */
  getTrends(): {
    database: { trend: 'improving' | 'stable' | 'degrading'; change: number };
    cache: { trend: 'improving' | 'stable' | 'degrading'; change: number };
    ai: { trend: 'improving' | 'stable' | 'degrading'; change: number };
    cost: { trend: 'increasing' | 'stable' | 'decreasing'; change: number };
  } {
    // Placeholder for trend analysis
    // Would need historical data storage for real implementation
    return {
      database: { trend: 'stable', change: 0 },
      cache: { trend: 'stable', change: 0 },
      ai: { trend: 'stable', change: 0 },
      cost: { trend: 'stable', change: 0 }
    };
  }

  /**
   * Export dashboard data
   */
  exportData(): {
    timestamp: string;
    data: PerformanceDashboardData;
    summary: ReturnType<PerformanceDashboard['getSummary']>;
    trends: ReturnType<PerformanceDashboard['getTrends']>;
  } {
    return {
      timestamp: new Date().toISOString(),
      data: this.getCurrentData()!,
      summary: this.getSummary(),
      trends: this.getTrends()
    };
  }

  /**
   * Update dashboard configuration
   */
  updateConfig(config: Partial<DashboardConfig>): void {
    const wasEnabled = this.config.enableRealTimeUpdates;
    this.config = { ...this.config, ...config };

    if (this.config.enableRealTimeUpdates && !wasEnabled) {
      this.startRealTimeUpdates();
    } else if (!this.config.enableRealTimeUpdates && wasEnabled) {
      this.stopRealTimeUpdates();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopRealTimeUpdates();
    this.subscribers.clear();
  }

  /**
   * Get historical data (placeholder for future implementation)
   */
  getHistoricalData(period: 'hour' | 'day' | 'week'): PerformanceDashboardData[] {
    // Placeholder - would need historical data storage
    return [];
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    generatedAt: string;
    period: string;
    summary: ReturnType<PerformanceDashboard['getSummary']>;
    recommendations: string[];
    data: PerformanceDashboardData;
  } {
    const data = this.getCurrentData()!;
    const summary = this.getSummary();
    const recommendations = this.generateRecommendations(data, summary);

    return {
      generatedAt: new Date().toISOString(),
      period: 'current',
      summary,
      recommendations,
      data
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    data: PerformanceDashboardData,
    summary: ReturnType<PerformanceDashboard['getSummary']>
  ): string[] {
    const recommendations: string[] = [];

    if (data.database.avgQueryTime > 500) {
      recommendations.push('Consider adding database indexes for slow queries');
    }

    if (data.cache.hitRate < 70) {
      recommendations.push('Review cache strategy - hit rate is below optimal');
    }

    if (data.ai.avgRequestTime > 2000) {
      recommendations.push('Consider using faster AI models for simple tasks');
    }

    if (data.cost.budgetStatus.dailyPercentage > 70) {
      recommendations.push('Monitor AI usage closely - daily budget usage high');
    }

    if (data.voice.avgConfidence < 0.8) {
      recommendations.push('Consider improving voice recognition quality settings');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is optimal - no immediate actions needed');
    }

    return recommendations;
  }
}
