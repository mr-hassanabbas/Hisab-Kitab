import type { Metric } from "../types/observability-types.js";

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private isEnabled: boolean = true;

  constructor(isEnabled: boolean = true) {
    this.isEnabled = isEnabled;
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    const metric = this.getOrCreateMetric(name, 'counter');
    metric.value++;
    metric.tags = { ...metric.tags, ...tags };
    metric.timestamp = new Date().toISOString();
  }

  /**
   * Record a timing metric
   */
  recordTiming(name: string, duration: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    const metric = this.getOrCreateMetric(name, 'timing');
    metric.value = duration;
    metric.tags = { ...metric.tags, ...tags };
    metric.timestamp = new Date().toISOString();
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    const metric = this.getOrCreateMetric(name, 'gauge');
    metric.value = value;
    metric.tags = { ...metric.tags, ...tags };
    metric.timestamp = new Date().toISOString();
  }

  /**
   * Get or create a metric
   */
  private getOrCreateMetric(name: string, type: 'counter' | 'timing' | 'gauge'): Metric {
    const key = `${name}:${type}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        name,
        type,
        value: 0,
        tags: {},
        timestamp: new Date().toISOString()
      });
    }
    
    return this.metrics.get(key)!;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): Metric[] {
    return this.getAllMetrics().filter(m => m.name === name);
  }

  /**
   * Get metrics by type
   */
  getMetricsByType(type: 'counter' | 'timing' | 'gauge'): Metric[] {
    return this.getAllMetrics().filter(m => m.type === type);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Reset specific metric
   */
  resetMetric(name: string): void {
    const keys = Array.from(this.metrics.keys()).filter(k => k.startsWith(`${name}:`));
    keys.forEach(key => this.metrics.delete(key));
  }

  /**
   * Enable or disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if metrics collection is enabled
   */
  isMetricsEnabled(): boolean {
    return this.isEnabled;
  }
}