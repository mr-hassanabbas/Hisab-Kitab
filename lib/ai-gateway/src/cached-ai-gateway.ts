// Cached AI Gateway for Phase 13 - Performance & Cost Optimization
import { CacheManager } from '@workspace/cost';
import type { AIProvider, GenerationOptions, GenerationResult } from './types/ai-types';

export interface CachedGatewayOptions {
  enableCache: boolean;
  cacheTTL: number;
  cacheMaxSize: number;
  enableRedis: boolean;
  redisUrl?: string;
}

export interface CacheKeyComponents {
  provider: string;
  model: string;
  prompt: string;
  options: string;
}

export class CachedAIGateway {
  private provider: AIProvider;
  private cache: CacheManager<GenerationResult>;
  private options: CachedGatewayOptions;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(
    provider: AIProvider,
    options: Partial<CachedGatewayOptions> = {}
  ) {
    this.provider = provider;
    this.options = {
      enableCache: options.enableCache ?? true,
      cacheTTL: options.cacheTTL ?? 300000, // 5 minutes
      cacheMaxSize: options.cacheMaxSize ?? 50 * 1024 * 1024, // 50MB
      enableRedis: options.enableRedis ?? false,
      redisUrl: options.redisUrl ?? 'redis://localhost:6379'
    };

    this.cache = new CacheManager<GenerationResult>({
      ttl: this.options.cacheTTL,
      maxSize: this.options.cacheMaxSize,
      enableRedis: this.options.enableRedis,
      redisUrl: this.options.redisUrl,
      redisKeyPrefix: 'ai_gateway:'
    });
  }

  /**
   * Generate text with caching
   */
  async generateText(prompt: string, options: GenerationOptions): Promise<GenerationResult> {
    if (!this.options.enableCache) {
      return await this.provider.generateText(prompt, options);
    }

    const cacheKey = this.generateCacheKey(prompt, options);

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return {
        ...cached,
        cached: true,
        cacheHit: true
      };
    }

    // Cache miss - call provider
    this.cacheMisses++;
    const result = await this.provider.generateText(prompt, options);

    // Cache the result if successful
    if (result.success) {
      await this.cache.set(cacheKey, result, this.options.cacheTTL);
    }

    return {
      ...result,
      cached: false,
      cacheHit: false
    };
  }

  /**
   * Generate structured output with caching
   */
  async generateStructured(
    prompt: string,
    schema: any,
    options?: GenerationOptions
  ): Promise<any> {
    if (!this.options.enableCache || !this.provider.generateStructured) {
      return await this.provider.generateStructured?.(prompt, schema, options);
    }

    const cacheKey = this.generateCacheKey(prompt, options || {}, JSON.stringify(schema));

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return {
        ...cached,
        cached: true,
        cacheHit: true
      };
    }

    // Cache miss - call provider
    this.cacheMisses++;
    const result = await this.provider.generateStructured(prompt, schema, options);

    // Cache the result if successful
    if (result && result.success !== false) {
      await this.cache.set(cacheKey, result, this.options.cacheTTL);
    }

    return {
      ...result,
      cached: false,
      cacheHit: false
    };
  }

  /**
   * Generate cache key from request components
   */
  private generateCacheKey(prompt: string, options: GenerationOptions, schema?: string): string {
    const components: CacheKeyComponents = {
      provider: this.provider.name,
      model: options.model || 'default',
      prompt: this.normalizePrompt(prompt),
      options: JSON.stringify(options)
    };

    if (schema) {
      components.options += schema;
    }

    return Object.values(components).join('|');
  }

  /**
   * Normalize prompt for cache key
   */
  private normalizePrompt(prompt: string): string {
    return prompt
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .substring(0, 200); // Limit length for cache key
  }

  /**
   * Estimate cost for request
   */
  estimateCost(input: string, model: string): number {
    return this.provider.estimateCost?.(input, model) || 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    cacheStats: Awaited<ReturnType<CacheManager<GenerationResult>['getStats']>>
  }> {
    const cacheStats = await this.cache.getStats();
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
      cacheStats
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.options.enableCache = enabled;
  }

  /**
   * Update cache options
   */
  updateCacheOptions(options: Partial<CachedGatewayOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Pre-warm cache with common requests
   */
  async preWarmCache(requests: Array<{ prompt: string; options: GenerationOptions }>): Promise<void> {
    if (!this.options.enableCache) return;

    await Promise.all(
      requests.map(async ({ prompt, options }) => {
        const cacheKey = this.generateCacheKey(prompt, options);
        const cached = await this.cache.get(cacheKey);
        
        if (!cached) {
          try {
            const result = await this.provider.generateText(prompt, options);
            if (result.success) {
              await this.cache.set(cacheKey, result, this.options.cacheTTL);
            }
          } catch (error) {
            console.warn('Failed to pre-warm cache:', error);
          }
        }
      })
    );
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    // This would require pattern matching in cache manager
    // For now, we'll clear all cache
    await this.clearCache();
  }

  /**
   * Get underlying provider
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Close cache connection
   */
  async close(): Promise<void> {
    await this.cache.close();
  }

  /**
   * Get cache size information
   */
  async getCacheSizeInfo(): Promise<{
    memoryCount: number;
    memoryBytes: number;
    memoryMB: number;
    redisConnected: boolean;
  }> {
    return this.cache.getSizeInfo();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpired(): number {
    return this.cache.cleanupExpired();
  }

  /**
   * Get cache performance metrics
   */
  getCachePerformance(): {
    totalRequests: number;
    cachedRequests: number;
    savingsPercentage: number;
    estimatedCostSavings: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const cachedRequests = this.cacheHits;
    const savingsPercentage = total > 0 ? (cachedRequests / total) * 100 : 0;
    
    // Rough cost estimation (assuming $0.001 per cached request)
    const estimatedCostSavings = cachedRequests * 0.001;

    return {
      totalRequests: total,
      cachedRequests,
      savingsPercentage,
      estimatedCostSavings
    };
  }
}
