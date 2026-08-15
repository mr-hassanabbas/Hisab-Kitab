// Cost Monitoring with Budget Enforcement for Phase 13
import type { BudgetConfig, CostTracking } from './types/cost-types';

export interface CostEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  model: string;
  provider: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  duration: number;
}

export interface BudgetAlert {
  id: string;
  timestamp: Date;
  type: 'daily' | 'monthly';
  threshold: number;
  current: number;
  percentage: number;
  message: string;
  severity: 'warning' | 'critical';
}

export interface CostReport {
  period: 'daily' | 'monthly' | 'custom';
  startDate: Date;
  endDate: Date;
  totalCost: number;
  totalRequests: number;
  averageCostPerRequest: number;
  modelBreakdown: Record<string, { count: number; cost: number; avgCost: number }>;
  operationBreakdown: Record<string, { count: number; cost: number; avgCost: number }>;
  topCostlyOperations: Array<{ operation: string; cost: number; count: number }>;
}

export class CostMonitor {
  private budgetConfig: BudgetConfig;
  private costTracking: CostTracking;
  private costEvents: CostEvent[] = [];
  private alerts: BudgetAlert[] = [];
  private eventCallback?: (event: CostEvent) => void;
  private alertCallback?: (alert: BudgetAlert) => void;

  constructor(budgetConfig: BudgetConfig) {
    this.budgetConfig = budgetConfig;
    this.costTracking = {
      dailySpend: 0,
      monthlySpend: 0,
      requestCount: 0,
      lastReset: new Date()
    };
  }

  /**
   * Track a cost event
   */
  trackCost(event: Omit<CostEvent, 'id' | 'timestamp'>): void {
    const costEvent: CostEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date()
    };

    this.costEvents.push(costEvent);
    this.updateCostTracking(costEvent);
    this.checkBudgetLimits();

    if (this.eventCallback) {
      this.eventCallback(costEvent);
    }
  }

  /**
   * Update cost tracking accumulators
   */
  private updateCostTracking(event: CostEvent): void {
    const now = new Date();
    const lastReset = this.costTracking.lastReset;

    // Reset daily if new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.costTracking.dailySpend = 0;
      this.costTracking.lastReset = now;
    }

    // Reset monthly if new month
    if (now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.costTracking.monthlySpend = 0;
      this.costTracking.lastReset = now;
    }

    this.costTracking.dailySpend += event.cost;
    this.costTracking.monthlySpend += event.cost;
    this.costTracking.requestCount++;
  }

  /**
   * Check if budget limits are exceeded
   */
  private checkBudgetLimits(): void {
    const dailyPercentage = (this.costTracking.dailySpend / this.budgetConfig.dailyBudget) * 100;
    const monthlyPercentage = (this.costTracking.monthlySpend / this.budgetConfig.monthlyBudget) * 100;

    // Check daily budget
    if (dailyPercentage >= this.budgetConfig.alertThreshold * 100) {
      this.createAlert('daily', dailyPercentage);
    }

    // Check monthly budget
    if (monthlyPercentage >= this.budgetConfig.alertThreshold * 100) {
      this.createAlert('monthly', monthlyPercentage);
    }

    // Enforce hard limit if configured
    if (this.budgetConfig.enforceLimit) {
      if (this.costTracking.dailySpend >= this.budgetConfig.dailyBudget) {
        this.createAlert('daily', 100, true);
      }
      if (this.costTracking.monthlySpend >= this.budgetConfig.monthlyBudget) {
        this.createAlert('monthly', 100, true);
      }
    }
  }

  /**
   * Create budget alert
   */
  private createAlert(type: 'daily' | 'monthly', percentage: number, isCritical: boolean = false): void {
    // Prevent duplicate alerts for same threshold
    const recentAlert = this.alerts.find(
      a => a.type === type && 
           a.timestamp > new Date(Date.now() - 3600000) && // Last hour
           Math.abs(a.percentage - percentage) < 5
    );

    if (recentAlert) return;

    const threshold = type === 'daily' ? this.budgetConfig.dailyBudget : this.budgetConfig.monthlyBudget;
    const current = type === 'daily' ? this.costTracking.dailySpend : this.costTracking.monthlySpend;

    const alert: BudgetAlert = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      threshold,
      current,
      percentage,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} budget ${percentage.toFixed(1)}% used ($${current.toFixed(2)} of $${threshold.toFixed(2)})`,
      severity: isCritical || percentage >= 100 ? 'critical' : 'warning'
    };

    this.alerts.push(alert);

    if (this.alertCallback) {
      this.alertCallback(alert);
    }
  }

  /**
   * Check if operation should be allowed based on budget
   */
  canSpend(estimatedCost: number): { allowed: boolean; reason?: string } {
    const dailyRemaining = this.budgetConfig.dailyBudget - this.costTracking.dailySpend;
    const monthlyRemaining = this.budgetConfig.monthlyBudget - this.costTracking.monthlySpend;

    if (this.budgetConfig.enforceLimit) {
      if (estimatedCost > dailyRemaining) {
        return {
          allowed: false,
          reason: `Daily budget exceeded. Remaining: $${dailyRemaining.toFixed(2)}, Required: $${estimatedCost.toFixed(2)}`
        };
      }

      if (estimatedCost > monthlyRemaining) {
        return {
          allowed: false,
          reason: `Monthly budget exceeded. Remaining: $${monthlyRemaining.toFixed(2)}, Required: $${estimatedCost.toFixed(2)}`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get current cost tracking status
   */
  getCostTracking(): CostTracking {
    return { ...this.costTracking };
  }

  /**
   * Get budget status
   */
  getBudgetStatus(): {
    daily: { spent: number; budget: number; remaining: number; percentage: number };
    monthly: { spent: number; budget: number; remaining: number; percentage: number };
    alerts: BudgetAlert[];
    nearLimit: boolean;
    exceeded: boolean;
  } {
    const dailySpent = this.costTracking.dailySpend;
    const monthlySpent = this.costTracking.monthlySpend;
    const dailyBudget = this.budgetConfig.dailyBudget;
    const monthlyBudget = this.budgetConfig.monthlyBudget;

    const dailyPercentage = (dailySpent / dailyBudget) * 100;
    const monthlyPercentage = (monthlySpent / monthlyBudget) * 100;

    const alertThreshold = this.budgetConfig.alertThreshold * 100;
    const nearLimit = dailyPercentage >= alertThreshold || monthlyPercentage >= alertThreshold;
    const exceeded = this.budgetConfig.enforceLimit && (dailySpent >= dailyBudget || monthlySpent >= monthlyBudget);

    return {
      daily: {
        spent: dailySpent,
        budget: dailyBudget,
        remaining: Math.max(0, dailyBudget - dailySpent),
        percentage: dailyPercentage
      },
      monthly: {
        spent: monthlySpent,
        budget: monthlyBudget,
        remaining: Math.max(0, monthlyBudget - monthlySpent),
        percentage: monthlyPercentage
      },
      alerts: this.alerts.filter(a => a.timestamp > new Date(Date.now() - 86400000)), // Last 24 hours
      nearLimit,
      exceeded
    };
  }

  /**
   * Generate cost report for a time period
   */
  generateCostReport(period: 'daily' | 'monthly' | 'custom', startDate?: Date, endDate?: Date): CostReport {
    let start: Date;
    let end: Date = new Date();

    switch (period) {
      case 'daily':
        start = new Date();
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          throw new Error('Custom period requires startDate and endDate');
        }
        start = startDate;
        end = endDate;
        break;
    }

    const periodEvents = this.costEvents.filter(
      e => e.timestamp >= start && e.timestamp <= end
    );

    const totalCost = periodEvents.reduce((sum, e) => sum + e.cost, 0);
    const totalRequests = periodEvents.length;
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    // Model breakdown
    const modelBreakdown: Record<string, { count: number; cost: number; avgCost: number }> = {};
    for (const event of periodEvents) {
      if (!modelBreakdown[event.model]) {
        modelBreakdown[event.model] = { count: 0, cost: 0, avgCost: 0 };
      }
      modelBreakdown[event.model].count++;
      modelBreakdown[event.model].cost += event.cost;
    }

    for (const model in modelBreakdown) {
      modelBreakdown[model].avgCost = modelBreakdown[model].cost / modelBreakdown[model].count;
    }

    // Operation breakdown
    const operationBreakdown: Record<string, { count: number; cost: number; avgCost: number }> = {};
    for (const event of periodEvents) {
      if (!operationBreakdown[event.operation]) {
        operationBreakdown[event.operation] = { count: 0, cost: 0, avgCost: 0 };
      }
      operationBreakdown[event.operation].count++;
      operationBreakdown[event.operation].cost += event.cost;
    }

    for (const operation in operationBreakdown) {
      operationBreakdown[operation].avgCost = operationBreakdown[operation].cost / operationBreakdown[operation].count;
    }

    // Top costly operations
    const topCostlyOperations = Object.entries(operationBreakdown)
      .map(([operation, data]) => ({ operation, cost: data.cost, count: data.count }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    return {
      period,
      startDate: start,
      endDate: end,
      totalCost,
      totalRequests,
      averageCostPerRequest,
      modelBreakdown,
      operationBreakdown,
      topCostlyOperations
    };
  }

  /**
   * Get recent cost events
   */
  getRecentEvents(limit: number = 50): CostEvent[] {
    return this.costEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get cost events for a specific user
   */
  getUserEvents(userId: string, limit: number = 50): CostEvent[] {
    return this.costEvents
      .filter(e => e.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Update budget configuration
   */
  updateBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config };
  }

  /**
   * Reset cost tracking (use with caution)
   */
  resetCostTracking(): void {
    this.costTracking = {
      dailySpend: 0,
      monthlySpend: 0,
      requestCount: 0,
      lastReset: new Date()
    };
  }

  /**
   * Clear old cost events to prevent memory issues
   */
  clearOldEvents(olderThanDays: number = 30): void {
    const cutoffDate = new Date(Date.now() - olderThanDays * 86400000);
    this.costEvents = this.costEvents.filter(e => e.timestamp >= cutoffDate);
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoffDate);
  }

  /**
   * Set callback for cost events
   */
  onCostEvent(callback: (event: CostEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Set callback for budget alerts
   */
  onBudgetAlert(callback: (alert: BudgetAlert) => void): void {
    this.alertCallback = callback;
  }

  /**
   * Get cost prediction for remaining period
   */
  predictCosts(): {
    daily: { projected: number; remaining: number; likelihood: number };
    monthly: { projected: number; remaining: number; likelihood: number };
  } {
    const now = new Date();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0);

    const hoursElapsedToday = (now.getTime() - dayStart.getTime()) / 3600000;
    const daysElapsedThisMonth = (now.getTime() - monthStart.getTime()) / 86400000;
    const hoursInDay = 24;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Simple linear projection
    const dailyRate = hoursElapsedToday > 0 ? this.costTracking.dailySpend / hoursElapsedToday : 0;
    const monthlyRate = daysElapsedThisMonth > 0 ? this.costTracking.monthlySpend / daysElapsedThisMonth : 0;

    const dailyProjected = this.costTracking.dailySpend + (dailyRate * (hoursInDay - hoursElapsedToday));
    const monthlyProjected = this.costTracking.monthlySpend + (monthlyRate * (daysInMonth - daysElapsedThisMonth));

    const dailyRemaining = this.budgetConfig.dailyBudget - dailyProjected;
    const monthlyRemaining = this.budgetConfig.monthlyBudget - monthlyProjected;

    // Calculate likelihood of staying within budget
    const dailyLikelihood = dailyRemaining > 0 ? Math.min(100, (dailyRemaining / this.budgetConfig.dailyBudget) * 100) : 0;
    const monthlyLikelihood = monthlyRemaining > 0 ? Math.min(100, (monthlyRemaining / this.budgetConfig.monthlyBudget) * 100) : 0;

    return {
      daily: {
        projected: dailyProjected,
        remaining: dailyRemaining,
        likelihood: dailyLikelihood
      },
      monthly: {
        projected: monthlyProjected,
        remaining: monthlyRemaining,
        likelihood: monthlyLikelihood
      }
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export cost data for analysis
   */
  exportCostData(): {
    events: CostEvent[];
    alerts: BudgetAlert[];
    tracking: CostTracking;
    budget: BudgetConfig;
    exportedAt: Date;
  } {
    return {
      events: [...this.costEvents],
      alerts: [...this.alerts],
      tracking: { ...this.costTracking },
      budget: { ...this.budgetConfig },
      exportedAt: new Date()
    };
  }

  /**
   * Import cost data (for recovery/testing)
   */
  importCostData(data: {
    events: CostEvent[];
    alerts: BudgetAlert[];
    tracking: CostTracking;
    budget: BudgetConfig;
  }): void {
    this.costEvents = data.events;
    this.alerts = data.alerts;
    this.costTracking = data.tracking;
    this.budgetConfig = data.budget;
  }
}
