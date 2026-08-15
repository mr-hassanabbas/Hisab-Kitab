// Multi-Model Router for Version 1
// Intelligently routes AI requests to appropriate models based on cost, performance, and task complexity

import { TaskType, ComplexityLevel } from './types/ai-types.js';

export interface AIModel {
  id: string;
  name: string;
  provider: 'openrouter' | 'openai' | 'anthropic' | 'local';
  costPer1kTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'low' | 'medium' | 'high';
  maxTokens: number;
  supportedLanguages: string[];
  capabilities: string[];
}

export interface RoutingDecision {
  selectedModel: AIModel;
  reason: string;
  fallbackModels: AIModel[];
  estimatedCost: number;
  estimatedTime: number;
}

export interface RoutingConfig {
  prioritizeCost: boolean;
  prioritizeSpeed: boolean;
  prioritizeQuality: boolean;
  maxCostPerRequest: number;
  maxTimePerRequest: number;
  preferredProvider?: string;
}

export class MultiModelRouter {
  private models: AIModel[];
  private config: RoutingConfig;
  private performanceHistory: Map<string, { successRate: number; avgTime: number }>;

  constructor(config: Partial<RoutingConfig> = {}) {
    this.config = {
      prioritizeCost: config.prioritizeCost ?? false,
      prioritizeSpeed: config.prioritizeSpeed ?? false,
      prioritizeQuality: config.prioritizeQuality ?? true,
      maxCostPerRequest: config.maxCostPerRequest ?? 0.10,
      maxTimePerRequest: config.maxTimePerRequest ?? 10000,
      preferredProvider: config.preferredProvider
    };

    this.performanceHistory = new Map();
    this.initializeModels();
  }

  /**
   * Initialize available AI models
   */
  private initializeModels(): void {
    this.models = [
      {
        id: 'gemini-2.5-flash',
        name: 'Google Gemini 2.5 Flash',
        provider: 'openrouter',
        costPer1kTokens: 0.000075, // Very cheap
        speed: 'fast',
        quality: 'medium',
        maxTokens: 1000000,
        supportedLanguages: ['ur', 'hi', 'en', 'auto'],
        capabilities: ['text-generation', 'entity-extraction', 'intent-classification']
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        costPer1kTokens: 0.00015,
        speed: 'fast',
        quality: 'high',
        maxTokens: 128000,
        supportedLanguages: ['ur', 'hi', 'en', 'auto'],
        capabilities: ['text-generation', 'entity-extraction', 'intent-classification', 'reasoning']
      },
      {
        id: 'claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        costPer1kTokens: 0.00025,
        speed: 'fast',
        quality: 'high',
        maxTokens: 200000,
        supportedLanguages: ['ur', 'hi', 'en', 'auto'],
        capabilities: ['text-generation', 'entity-extraction', 'intent-classification', 'reasoning']
      },
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        provider: 'local',
        costPer1kTokens: 0, // Free (local)
        speed: 'medium',
        quality: 'medium',
        maxTokens: 8192,
        supportedLanguages: ['en'], // Limited language support
        capabilities: ['text-generation', 'entity-extraction']
      }
    ];
  }

  /**
   * Route request to appropriate model
   */
  route(
    taskType: TaskType,
    complexity: ComplexityLevel,
    estimatedTokens: number,
    language: string = 'en'
  ): RoutingDecision {
    // Filter models by capabilities and language
    const eligibleModels = this.models.filter(model => {
      // Check language support
      if (!model.supportedLanguages.includes(language) && !model.supportedLanguages.includes('auto')) {
        return false;
      }

      // Check capabilities
      const capabilityMap: Record<TaskType, string> = {
        [TaskType.TEXT_GENERATION]: 'text-generation',
        [TaskType.ENTITY_EXTRACTION]: 'entity-extraction',
        [TaskType.INTENT_CLASSIFICATION]: 'intent-classification',
        [TaskType.PARAMETER_VALIDATION]: 'reasoning',
        [TaskType.REASONING]: 'reasoning'
      };

      const requiredCapability = capabilityMap[taskType];
      return model.capabilities.includes(requiredCapability);
    });

    if (eligibleModels.length === 0) {
      throw new Error('No eligible models found for request');
    }

    // Score each model
    const scoredModels = eligibleModels.map(model => ({
      model,
      score: this.calculateModelScore(model, taskType, complexity, estimatedTokens)
    }));

    // Sort by score (descending)
    scoredModels.sort((a, b) => b.score - a.score);

    // Select best model
    const selectedModel = scoredModels[0].model;
    const fallbackModels = scoredModels.slice(1, 3).map(s => s.model);

    // Calculate estimates
    const estimatedCost = (estimatedTokens / 1000) * selectedModel.costPer1kTokens;
    const estimatedTime = this.estimateTime(selectedModel, estimatedTokens);

    const decision: RoutingDecision = {
      selectedModel,
      reason: this.getSelectionReason(selectedModel, scoredModels[0].score),
      fallbackModels,
      estimatedCost,
      estimatedTime
    };

    console.log('[Multi-Model Router] Routing decision:', decision);
    return decision;
  }

  /**
   * Calculate model score for routing
   */
  private calculateModelScore(
    model: AIModel,
    taskType: TaskType,
    complexity: ComplexityLevel,
    estimatedTokens: number
  ): number {
    let score = 0;

    // Quality score (0-40)
    const qualityScores = { low: 10, medium: 25, high: 40 };
    score += qualityScores[model.quality];

    // Speed score (0-30)
    const speedScores = { slow: 10, medium: 20, fast: 30 };
    score += speedScores[model.speed];

    // Cost score (0-20) - lower cost = higher score
    const maxCost = Math.max(...this.models.map(m => m.costPer1kTokens));
    const costScore = 20 * (1 - model.costPer1kTokens / maxCost);
    score += costScore;

    // Performance history (0-10)
    const history = this.performanceHistory.get(model.id);
    if (history) {
      score += history.successRate * 10;
    }

    // Priority adjustments
    if (this.config.prioritizeCost) {
      score += costScore * 2; // Double weight for cost
    }

    if (this.config.prioritizeSpeed) {
      score += speedScores[model.speed] * 0.5; // Extra weight for speed
    }

    if (this.config.prioritizeQuality) {
      score += qualityScores[model.quality] * 0.5; // Extra weight for quality
    }

    // Complexity matching
    if (complexity === ComplexityLevel.HIGH && model.quality === 'high') {
      score += 15;
    } else if (complexity === ComplexityLevel.LOW && model.speed === 'fast') {
      score += 10;
    }

    // Token limit check
    if (estimatedTokens > model.maxTokens) {
      score -= 100; // Penalize if can't handle tokens
    }

    // Preferred provider
    if (this.config.preferredProvider && model.provider === this.config.preferredProvider) {
      score += 5;
    }

    return score;
  }

  /**
   * Get selection reason
   */
  private getSelectionReason(model: AIModel, score: number): string {
    const reasons: string[] = [];

    if (model.quality === 'high') {
      reasons.push('high quality');
    }
    if (model.speed === 'fast') {
      reasons.push('fast response');
    }
    if (model.costPer1kTokens === 0) {
      reasons.push('free (local)');
    } else if (model.costPer1kTokens < 0.0001) {
      reasons.push('low cost');
    }

    return `Selected ${model.name} for ${reasons.join(', ')}`;
  }

  /**
   * Estimate processing time
   */
  private estimateTime(model: AIModel, tokens: number): number {
    const baseTimes = { fast: 50, medium: 100, slow: 200 }; // ms per 1k tokens
    const baseTime = baseTimes[model.speed];
    return (tokens / 1000) * baseTime;
  }

  /**
   * Record model performance
   */
  recordPerformance(modelId: string, success: boolean, time: number): void {
    const history = this.performanceHistory.get(modelId) || {
      successRate: 1.0,
      avgTime: 0
    };

    // Update success rate (exponential moving average)
    history.successRate = history.successRate * 0.9 + (success ? 1.0 : 0.0) * 0.1;

    // Update average time
    history.avgTime = history.avgTime * 0.9 + time * 0.1;

    this.performanceHistory.set(modelId, history);
  }

  /**
   * Get available models
   */
  getAvailableModels(): AIModel[] {
    return [...this.models];
  }

  /**
   * Get model by ID
   */
  getModelById(id: string): AIModel | undefined {
    return this.models.find(m => m.id === id);
  }

  /**
   * Update routing configuration
   */
  updateConfig(config: Partial<RoutingConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[Multi-Model Router] Config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RoutingConfig {
    return { ...this.config };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Map<string, { successRate: number; avgTime: number }> {
    return new Map(this.performanceHistory);
  }

  /**
   * Reset performance history
   */
  resetPerformanceHistory(): void {
    this.performanceHistory.clear();
    console.log('[Multi-Model Router] Performance history reset');
  }

  /**
   * Add custom model
   */
  addModel(model: AIModel): void {
    this.models.push(model);
    console.log('[Multi-Model Router] Added model:', model.name);
  }

  /**
   * Remove model
   */
  removeModel(modelId: string): void {
    this.models = this.models.filter(m => m.id !== modelId);
    this.performanceHistory.delete(modelId);
    console.log('[Multi-Model Router] Removed model:', modelId);
  }
}

// Singleton instance
export const multiModelRouter = new MultiModelRouter();
