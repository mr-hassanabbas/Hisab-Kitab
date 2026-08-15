// Performance Metrics for Phase 13 - Performance & Cost Optimization
import { MetricsCollector } from './metrics-collector';

export interface PerformanceMetricsConfig {
  enableDatabaseMetrics: boolean;
  enableCacheMetrics: boolean;
  enableAIMetrics: boolean;
  enableVoiceMetrics: boolean;
  enableCostMetrics: boolean;
}

export class PerformanceMetrics {
  private metricsCollector: MetricsCollector;
  private config: PerformanceMetricsConfig;

  constructor(config?: Partial<PerformanceMetricsConfig>) {
    this.config = {
      enableDatabaseMetrics: true,
      enableCacheMetrics: true,
      enableAIMetrics: true,
      enableVoiceMetrics: true,
      enableCostMetrics: true,
      ...config
    };

    this.metricsCollector = new MetricsCollector(true);
  }

  /**
   * Database Performance Metrics
   */
  trackDatabaseQuery(operation: string, duration: number, success: boolean, tags?: Record<string, string>): void {
    if (!this.config.enableDatabaseMetrics) return;

    this.metricsCollector.recordTiming('db.query_duration', duration, {
      operation,
      success: success.toString(),
      ...tags
    });

    this.metricsCollector.incrementCounter('db.query_total', {
      operation,
      success: success.toString(),
      ...tags
    });

    if (!success) {
      this.metricsCollector.incrementCounter('db.query_errors', {
        operation,
        ...tags
      });
    }
  }

  trackDatabaseConnection(poolSize: number, activeConnections: number, waiting: number): void {
    if (!this.config.enableDatabaseMetrics) return;

    this.metricsCollector.recordGauge('db.pool_size', poolSize);
    this.metricsCollector.recordGauge('db.active_connections', activeConnections);
    this.metricsCollector.recordGauge('db.waiting_connections', waiting);
  }

  /**
   * Cache Performance Metrics
   */
  trackCacheHit(cacheType: 'memory' | 'redis', key: string, tags?: Record<string, string>): void {
    if (!this.config.enableCacheMetrics) return;

    this.metricsCollector.incrementCounter('cache.hits', {
      type: cacheType,
      ...tags
    });
  }

  trackCacheMiss(cacheType: 'memory' | 'redis', key: string, tags?: Record<string, string>): void {
    if (!this.config.enableCacheMetrics) return;

    this.metricsCollector.incrementCounter('cache.misses', {
      type: cacheType,
      ...tags
    });
  }

  trackCacheSize(cacheType: 'memory' | 'redis', size: number, entries: number): void {
    if (!this.config.enableCacheMetrics) return;

    this.metricsCollector.recordGauge(`cache.${cacheType}.size_bytes`, size);
    this.metricsCollector.recordGauge(`cache.${cacheType}.entries`, entries);
  }

  trackCacheEviction(cacheType: 'memory' | 'redis', reason: string): void {
    if (!this.config.enableCacheMetrics) return;

    this.metricsCollector.incrementCounter('cache.evictions', {
      type: cacheType,
      reason
    });
  }

  /**
   * AI Performance Metrics
   */
  trackAIRequest(model: string, provider: string, operation: string, duration: number, success: boolean): void {
    if (!this.config.enableAIMetrics) return;

    this.metricsCollector.recordTiming('ai.request_duration', duration, {
      model,
      provider,
      operation,
      success: success.toString()
    });

    this.metricsCollector.incrementCounter('ai.requests_total', {
      model,
      provider,
      operation,
      success: success.toString()
    });

    if (!success) {
      this.metricsCollector.incrementCounter('ai.request_errors', {
        model,
        provider,
        operation
      });
    }
  }

  trackAITokenUsage(model: string, inputTokens: number, outputTokens: number): void {
    if (!this.config.enableAIMetrics) return;

    this.metricsCollector.recordGauge('ai.input_tokens', inputTokens, { model });
    this.metricsCollector.recordGauge('ai.output_tokens', outputTokens, { model });
    this.metricsCollector.recordGauge('ai.total_tokens', inputTokens + outputTokens, { model });
  }

  trackAIIntentParsing(duration: number, confidence: number, intent: string): void {
    if (!this.config.enableAIMetrics) return;

    this.metricsCollector.recordTiming('ai.intent_parsing_duration', duration, { intent });
    this.metricsCollector.recordGauge('ai.intent_confidence', confidence, { intent });
  }

  trackAIEntityExtraction(duration: number, entitiesFound: number, entityType: string): void {
    if (!this.config.enableAIMetrics) return;

    this.metricsCollector.recordTiming('ai.entity_extraction_duration', duration, { entity_type: entityType });
    this.metricsCollector.recordGauge('ai.entities_found', entitiesFound, { entity_type: entityType });
  }

  /**
   * Voice Performance Metrics
   */
  trackVoiceRecognition(duration: number, confidence: number, language: string, provider: string): void {
    if (!this.config.enableVoiceMetrics) return;

    this.metricsCollector.recordTiming('voice.recognition_duration', duration, {
      language,
      provider
    });

    this.metricsCollector.recordGauge('voice.recognition_confidence', confidence, {
      language,
      provider
    });

    this.metricsCollector.incrementCounter('voice.recognition_total', {
      language,
      provider
    });
  }

  trackVoiceSynthesis(duration: number, textLength: number, language: string): void {
    if (!this.config.enableVoiceMetrics) return;

    this.metricsCollector.recordTiming('voice.synthesis_duration', duration, { language });
    this.metricsCollector.recordGauge('voice.synthesis_text_length', textLength, { language });
    this.metricsCollector.incrementCounter('voice.synthesis_total', { language });
  }

  trackVoiceError(errorType: string, language: string, provider: string): void {
    if (!this.config.enableVoiceMetrics) return;

    this.metricsCollector.incrementCounter('voice.errors', {
      error_type: errorType,
      language,
      provider
    });
  }

  /**
   * Cost Performance Metrics
   */
  trackCostOperation(operation: string, cost: number, model: string, provider: string): void {
    if (!this.config.enableCostMetrics) return;

    this.metricsCollector.recordGauge('cost.operation_cost', cost, {
      operation,
      model,
      provider
    });

    this.metricsCollector.incrementCounter('cost.operations_total', {
      operation,
      model,
      provider
    });
  }

  trackDailySpend(amount: number): void {
    if (!this.config.enableCostMetrics) return;

    this.metricsCollector.recordGauge('cost.daily_spend', amount);
  }

  trackMonthlySpend(amount: number): void {
    if (!this.config.enableCostMetrics) return;

    this.metricsCollector.recordGauge('cost.monthly_spend', amount);
  }

  trackBudgetAlert(type: 'daily' | 'monthly', percentage: number, severity: 'warning' | 'critical'): void {
    if (!this.config.enableCostMetrics) return;

    this.metricsCollector.recordGauge('cost.budget_percentage', percentage, { type });
    this.metricsCollector.incrementCounter('cost.budget_alerts', {
      type,
      severity
    });
  }

  trackTokenOptimization(originalTokens: number, optimizedTokens: number): void {
    if (!this.config.enableCostMetrics) return;

    const reduction = originalTokens - optimizedTokens;
    const percentage = (reduction / originalTokens) * 100;

    this.metricsCollector.recordGauge('cost.token_reduction', reduction);
    this.metricsCollector.recordGauge('cost.token_reduction_percentage', percentage);
    this.metricsCollector.incrementCounter('cost.optimizations_total');
  }

  /**
   * System Performance Metrics
   */
  trackMemoryUsage(heapUsed: number, heapTotal: number, rss: number): void {
    this.metricsCollector.recordGauge('system.memory_heap_used', heapUsed);
    this.metricsCollector.recordGauge('system.memory_heap_total', heapTotal);
    this.metricsCollector.recordGauge('system.memory_rss', rss);
  }

  trackCPUUsage(cpuPercent: number): void {
    this.metricsCollector.recordGauge('system.cpu_percent', cpuPercent);
  }

  trackEventLoopDelay(delay: number): void {
    this.metricsCollector.recordTiming('system.event_loop_delay', delay);
  }

  trackHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.metricsCollector.recordTiming('http.request_duration', duration, {
      method,
      path,
      status_code: statusCode.toString()
    });

    this.metricsCollector.incrementCounter('http.requests_total', {
      method,
      path,
      status_code: statusCode.toString()
    });

    if (statusCode >= 400) {
      this.metricsCollector.incrementCounter('http.errors', {
        method,
        path,
        status_code: statusCode.toString()
      });
    }
  }

  /**
   * Performance Summary
   */
  getPerformanceSummary(): {
    database: { avgQueryTime: number; errorRate: number; totalQueries: number };
    cache: { hitRate: number; totalHits: number; totalMisses: number };
    ai: { avgRequestTime: number; avgTokens: number; totalRequests: number };
    voice: { avgRecognitionTime: number; avgConfidence: number; totalRequests: number };
    cost: { totalSpend: number; avgCostPerRequest: number; totalOperations: number };
  } {
    const metrics = this.metricsCollector.getAllMetrics();

    // Database summary
    const dbMetrics = metrics.filter(m => m.name.startsWith('db.'));
    const dbQueries = dbMetrics.filter(m => m.name === 'db.query_total');
    const dbErrors = dbMetrics.filter(m => m.name === 'db.query_errors');
    const dbTimings = dbMetrics.filter(m => m.name === 'db.query_duration');

    const totalQueries = dbQueries.reduce((sum, m) => sum + m.value, 0);
    const totalErrors = dbErrors.reduce((sum, m) => sum + m.value, 0);
    const avgQueryTime = dbTimings.length > 0 
      ? dbTimings.reduce((sum, m) => sum + m.value, 0) / dbTimings.length 
      : 0;
    const errorRate = totalQueries > 0 ? (totalErrors / totalQueries) * 100 : 0;

    // Cache summary
    const cacheMetrics = metrics.filter(m => m.name.startsWith('cache.'));
    const cacheHits = cacheMetrics.filter(m => m.name === 'cache.hits');
    const cacheMisses = cacheMetrics.filter(m => m.name === 'cache.misses');

    const totalHits = cacheHits.reduce((sum, m) => sum + m.value, 0);
    const totalMisses = cacheMisses.reduce((sum, m) => sum + m.value, 0);
    const hitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

    // AI summary
    const aiMetrics = metrics.filter(m => m.name.startsWith('ai.'));
    const aiRequests = aiMetrics.filter(m => m.name === 'ai.requests_total');
    const aiTimings = aiMetrics.filter(m => m.name === 'ai.request_duration');
    const aiTokens = aiMetrics.filter(m => m.name === 'ai.total_tokens');

    const totalAIRequests = aiRequests.reduce((sum, m) => sum + m.value, 0);
    const avgAIRequestTime = aiTimings.length > 0
      ? aiTimings.reduce((sum, m) => sum + m.value, 0) / aiTimings.length
      : 0;
    const avgAITokens = aiTokens.length > 0
      ? aiTokens.reduce((sum, m) => sum + m.value, 0) / aiTokens.length
      : 0;

    // Voice summary
    const voiceMetrics = metrics.filter(m => m.name.startsWith('voice.'));
    const voiceRequests = voiceMetrics.filter(m => m.name === 'voice.recognition_total');
    const voiceTimings = voiceMetrics.filter(m => m.name === 'voice.recognition_duration');
    const voiceConfidence = voiceMetrics.filter(m => m.name === 'voice.recognition_confidence');

    const totalVoiceRequests = voiceRequests.reduce((sum, m) => sum + m.value, 0);
    const avgVoiceTime = voiceTimings.length > 0
      ? voiceTimings.reduce((sum, m) => sum + m.value, 0) / voiceTimings.length
      : 0;
    const avgVoiceConfidence = voiceConfidence.length > 0
      ? voiceConfidence.reduce((sum, m) => sum + m.value, 0) / voiceConfidence.length
      : 0;

    // Cost summary
    const costMetrics = metrics.filter(m => m.name.startsWith('cost.'));
    const costOps = costMetrics.filter(m => m.name === 'cost.operations_total');
    const costDaily = costMetrics.filter(m => m.name === 'cost.daily_spend');

    const totalCostOps = costOps.reduce((sum, m) => sum + m.value, 0);
    const totalDailySpend = costDaily.reduce((sum, m) => sum + m.value, 0);
    const avgCostPerRequest = totalCostOps > 0 ? totalDailySpend / totalCostOps : 0;

    return {
      database: {
        avgQueryTime,
        errorRate,
        totalQueries
      },
      cache: {
        hitRate,
        totalHits,
        totalMisses
      },
      ai: {
        avgRequestTime: avgAIRequestTime,
        avgTokens: avgAITokens,
        totalRequests: totalAIRequests
      },
      voice: {
        avgRecognitionTime: avgVoiceTime,
        avgConfidence: avgVoiceConfidence,
        totalRequests: totalVoiceRequests
      },
      cost: {
        totalSpend: totalDailySpend,
        avgCostPerRequest,
        totalOperations: totalCostOps
      }
    };
  }

  /**
   * Get the underlying metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Enable/disable specific metric categories
   */
  updateConfig(config: Partial<PerformanceMetricsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metricsCollector.clearMetrics();
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: string;
    metrics: ReturnType<MetricsCollector['getAllMetrics']>;
    summary: ReturnType<PerformanceMetrics['getPerformanceSummary']>;
  } {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metricsCollector.getAllMetrics(),
      summary: this.getPerformanceSummary()
    };
  }
}
