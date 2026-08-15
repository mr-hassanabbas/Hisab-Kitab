import type { PerformanceReport } from "../types/observability-types.js";

export interface PerformanceThreshold {
  metric: string;
  maxDuration: number;
  unit: string;
}

export class PerformanceMonitor {
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private measurements: Map<string, number[]> = new Map();

  constructor() {
    this.initializeThresholds();
  }

  /**
   * Initialize performance thresholds
   */
  private initializeThresholds(): void {
    this.thresholds.set('ai.latency', { metric: 'ai.latency', maxDuration: 3000, unit: 'ms' });
    this.thresholds.set('voice.recognition_latency', { metric: 'voice.recognition_latency', maxDuration: 2000, unit: 'ms' });
    this.thresholds.set('tool.execution_time', { metric: 'tool.execution_time', maxDuration: 1000, unit: 'ms' });
    this.thresholds.set('database.query_time', { metric: 'database.query_time', maxDuration: 500, unit: 'ms' });
    this.thresholds.set('api.response_time', { metric: 'api.response_time', maxDuration: 1000, unit: 'ms' });
  }

  /**
   * Record a measurement
   */
  recordMeasurement(metric: string, value: number): void {
    if (!this.measurements.has(metric)) {
      this.measurements.set(metric, []);
    }
    this.measurements.get(metric)!.push(value);
  }

  /**
   * Check performance against thresholds
   */
  checkPerformanceThresholds(): PerformanceReport {
    const report: PerformanceReport = {
      ai_latency: this.checkMetric('ai.latency'),
      voice_recognition: this.checkMetric('voice.recognition_latency'),
      tool_execution: this.checkMetric('tool.execution_time'),
      database_queries: this.checkMetric('database.query_time'),
      api_response: this.checkMetric('api.response_time'),
      details: this.getPerformanceDetails()
    };

    return report;
  }

  /**
   * Check specific metric against threshold
   */
  private checkMetric(metricName: string): boolean {
    const threshold = this.thresholds.get(metricName);
    if (!threshold) return true;

    const measurements = this.measurements.get(metricName);
    if (!measurements || measurements.length === 0) return true;

    const average = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    return average <= threshold.maxDuration;
  }

  /**
   * Get performance details
   */
  private getPerformanceDetails(): Record<string, unknown> {
    const details: Record<string, unknown> = {};

    this.measurements.forEach((values, metric) => {
      const threshold = this.thresholds.get(metric);
      if (!threshold) return;

      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const p95 = this.percentile(values, 95);

      details[metric] = {
        average_ms: average,
        max_ms: max,
        min_ms: min,
        p95_ms: p95,
        threshold_ms: threshold.maxDuration,
        within_threshold: average <= threshold.maxDuration,
        unit: threshold.unit
      };
    });

    return details;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    healthy: boolean;
    totalMeasurements: number;
    metrics: Record<string, { average: number; threshold: number; status: string }>;
  } {
    const report = this.checkPerformanceThresholds();
    const metrics: Record<string, { average: number; threshold: number; status: string }> = {};

    Object.entries(report.details as Record<string, any>).forEach(([key, value]) => {
      metrics[key] = {
        average: value.average_ms,
        threshold: value.threshold_ms,
        status: value.within_threshold ? 'healthy' : 'degraded'
      };
    });

    const healthy = Object.values(metrics).every(m => m.status === 'healthy');
    const totalMeasurements = Array.from(this.measurements.values()).reduce((sum, vals) => sum + vals.length, 0);

    return {
      healthy,
      totalMeasurements,
      metrics
    };
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurements.clear();
  }

  /**
   * Add custom threshold
   */
  addThreshold(metric: string, maxDuration: number, unit: string = 'ms'): void {
    this.thresholds.set(metric, { metric, maxDuration, unit });
  }
}