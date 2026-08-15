// Multi-level Caching Strategy for Phase 13
// Supports memory cache and optional Redis cache

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
  size: number;
}

export interface CacheStats {
  memorySize: number;
  memoryEntries: number;
  redisConnected: boolean;
  redisEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum memory cache size in bytes
  enableRedis?: boolean;
  redisUrl?: string;
  redisKeyPrefix?: string;
}

export class CacheManager<T> {
  private memoryCache: Map<string, CacheEntry<T>> = new Map();
  private redisClient: any = null; // Redis client (optional)
  private redisConnected: boolean = false;
  private options: Required<CacheOptions>;
  private stats = {
    hits: 0,
    misses: 0
  };
  private currentMemorySize: number = 0;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 300000, // 5 minutes default
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB default
      enableRedis: options.enableRedis || false,
      redisUrl: options.redisUrl || 'redis://localhost:6379',
      redisKeyPrefix: options.redisKeyPrefix || 'hk:'
    };

    if (this.options.enableRedis) {
      this.initializeRedis();
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Dynamic import to avoid requiring Redis when not used
      const { createClient } = await import('redis');
      
      this.redisClient = createClient({
        url: this.options.redisUrl
      });

      this.redisClient.on('error', (err: Error) => {
        console.error('Redis cache error:', err);
        this.redisConnected = false;
      });

      this.redisClient.on('connect', () => {
        console.log('Redis cache connected');
        this.redisConnected = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      console.warn('Redis initialization failed, falling back to memory cache only:', error);
      this.redisConnected = false;
    }
  }

  /**
   * Get value from cache (checks memory first, then Redis)
   */
  async get(key: string): Promise<T | null> {
    const memoryKey = this.normalizeKey(key);

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(memoryKey);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      memoryEntry.hits++;
      this.stats.hits++;
      return memoryEntry.value;
    }

    // Remove expired memory entry
    if (memoryEntry && this.isExpired(memoryEntry)) {
      this.removeFromMemory(memoryKey, memoryEntry.size);
    }

    // Check Redis cache if enabled
    if (this.options.enableRedis && this.redisConnected) {
      try {
        const redisKey = this.options.redisKeyPrefix + memoryKey;
        const redisValue = await this.redisClient.get(redisKey);
        
        if (redisValue) {
          const parsed = JSON.parse(redisValue) as CacheEntry<T>;
          
          if (!this.isExpired(parsed)) {
            // Promote to memory cache
            this.setToMemory(memoryKey, parsed);
            parsed.hits++;
            this.stats.hits++;
            return parsed.value;
          } else {
            // Remove expired Redis entry
            await this.redisClient.del(redisKey);
          }
        }
      } catch (error) {
        console.warn('Redis cache get error:', error);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache (both memory and Redis)
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const memoryKey = this.normalizeKey(key);
    const cacheTTL = ttl || this.options.ttl;
    const now = Date.now();
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + cacheTTL,
      createdAt: now,
      hits: 0,
      size
    };

    // Set in memory cache
    this.setToMemory(memoryKey, entry);

    // Set in Redis cache if enabled
    if (this.options.enableRedis && this.redisConnected) {
      try {
        const redisKey = this.options.redisKeyPrefix + memoryKey;
        const serializedEntry = JSON.stringify(entry);
        
        await this.redisClient.setEx(
          redisKey,
          Math.ceil(cacheTTL / 1000), // Redis uses seconds
          serializedEntry
        );
      } catch (error) {
        console.warn('Redis cache set error:', error);
      }
    }
  }

  /**
   * Set value in memory cache with size management
   */
  private setToMemory(key: string, entry: CacheEntry<T>): void {
    // Remove existing entry if present
    const existing = this.memoryCache.get(key);
    if (existing) {
      this.currentMemorySize -= existing.size;
    }

    // Check if we need to evict entries
    while (this.currentMemorySize + entry.size > this.options.maxSize && this.memoryCache.size > 0) {
      this.evictLRU();
    }

    // Add new entry
    this.memoryCache.set(key, entry);
    this.currentMemorySize += entry.size;
  }

  /**
   * Remove from memory cache
   */
  private removeFromMemory(key: string, size: number): void {
    this.memoryCache.delete(key);
    this.currentMemorySize -= size;
  }

  /**
   * Evict least recently used entry from memory cache
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    let lruSize = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.createdAt < lruTime) {
        lruTime = entry.createdAt;
        lruKey = key;
        lruSize = entry.size;
      }
    }

    if (lruKey) {
      this.removeFromMemory(lruKey, lruSize);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const memoryKey = this.normalizeKey(key);

    // Remove from memory
    const memoryEntry = this.memoryCache.get(memoryKey);
    if (memoryEntry) {
      this.removeFromMemory(memoryKey, memoryEntry.size);
    }

    // Remove from Redis
    if (this.options.enableRedis && this.redisConnected) {
      try {
        const redisKey = this.options.redisKeyPrefix + memoryKey;
        await this.redisClient.del(redisKey);
      } catch (error) {
        console.warn('Redis cache delete error:', error);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.currentMemorySize = 0;

    // Clear Redis cache
    if (this.options.enableRedis && this.redisConnected) {
      try {
        const pattern = this.options.redisKeyPrefix + '*';
        const keys = await this.redisClient.keys(pattern);
        
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (error) {
        console.warn('Redis cache clear error:', error);
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Normalize cache key
   */
  private normalizeKey(key: string): string {
    return key.replace(/\s+/g, '_').toLowerCase();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    let redisEntries = 0;

    if (this.options.enableRedis && this.redisConnected) {
      try {
        const pattern = this.options.redisKeyPrefix + '*';
        const keys = await this.redisClient.keys(pattern);
        redisEntries = keys.length;
      } catch (error) {
        console.warn('Redis stats error:', error);
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

    return {
      memorySize: this.currentMemorySize,
      memoryEntries: this.memoryCache.size,
      redisConnected: this.redisConnected,
      redisEntries,
      hitRate,
      missRate,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses
    };
  }

  /**
   * Clean up expired entries from memory cache
   */
  cleanupExpired(): number {
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.removeFromMemory(key, entry.size);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get or set pattern (useful for expensive operations)
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Get multiple keys at once
   */
  async getMany(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key);
        if (value !== null) {
          results.set(key, value);
        }
      })
    );

    return results;
  }

  /**
   * Set multiple keys at once
   */
  async setMany(entries: Map<string, T>, ttl?: number): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, ttl)
      )
    );
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0
    };
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisConnected = false;
    }
  }

  /**
   * Get cache size information
   */
  getSizeInfo(): {
    memoryCount: number;
    memoryBytes: number;
    memoryMB: number;
    redisConnected: boolean;
  } {
    return {
      memoryCount: this.memoryCache.size,
      memoryBytes: this.currentMemorySize,
      memoryMB: this.currentMemorySize / (1024 * 1024),
      redisConnected: this.redisConnected
    };
  }
}
