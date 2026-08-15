// Cost-Optimized Model Selector for Phase 13
import { TaskType, ComplexityLevel } from '@workspace/ai-gateway';
import type { ModelSelection } from '@workspace/ai-gateway';
import type { BudgetConfig, ModelPricing } from './types/cost-types';

export interface AITask {
  type: TaskType;
  complexity: ComplexityLevel;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  priority: 'low' | 'medium' | 'high';
}

export interface CostOptimizedSelection extends ModelSelection {
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  costEfficiency: number; // cost per token
  confidence: number; // how confident we are this is the right choice
}

export class CostOptimizedModelSelector {
  private modelPricing: Map<string, ModelPricing> = new Map();
  private budgetConfig: BudgetConfig;
  private currentDailySpend: number = 0;
  private currentMonthlySpend: number = 0;

  constructor(budgetConfig: BudgetConfig) {
    this.budgetConfig = budgetConfig;
    this.initializeModelPricing();
  }

  /**
   * Initialize model pricing data
   * Prices are per 1K tokens in USD
   */
  private initializeModelPricing(): void {
    // OpenRouter/Groq model pricing
    this.modelPricing.set('google/gemini-2.5-flash', {
      input: 0.000075, // $0.075 per 1M input tokens (effectively free)
      output: 0.00015, // $0.15 per 1M output tokens
      currency: 'USD'
    });

    this.modelPricing.set('openai/gpt-4o-mini', {
      input: 0.00015, // $0.15 per 1M input tokens
      output: 0.0006, // $0.60 per 1M output tokens
      currency: 'USD'
    });

    this.modelPricing.set('anthropic/claude-3.5-sonnet', {
      input: 0.003, // $3.00 per 1M input tokens
      output: 0.015, // $15.00 per 1M output tokens
      currency: 'USD'
    });

    this.modelPricing.set('llama-3.3-70b-versatile', {
      input: 0.0, // Free on Groq
      output: 0.0, // Free on Groq
      currency: 'USD'
    });

    this.modelPricing.set('meta-llama/llama-3.3-70b-instruct:free', {
      input: 0.0, // Free on OpenRouter
      output: 0.0, // Free on OpenRouter
      currency: 'USD'
    });
  }

  /**
   * Update current spending information
   */
  updateSpending(dailySpend: number, monthlySpend: number): void {
    this.currentDailySpend = dailySpend;
    this.currentMonthlySpend = monthlySpend;
  }

  /**
   * Select cost-optimized model based on task and budget
   */
  selectModel(task: AITask): CostOptimizedSelection {
    const availableBudget = this.calculateAvailableBudget();
    const estimatedCost = this.estimateTaskCost(task);

    // Check if we're near budget limits
    if (this.isNearBudgetLimit(availableBudget, estimatedCost)) {
      return this.selectBudgetConstrainedModel(task);
    }

    // Normal selection based on task requirements and cost efficiency
    return this.selectOptimalModel(task);
  }

  /**
   * Calculate available budget considering daily and monthly limits
   */
  private calculateAvailableBudget(): { daily: number; monthly: number } {
    const dailyRemaining = this.budgetConfig.dailyBudget - this.currentDailySpend;
    const monthlyRemaining = this.budgetConfig.monthlyBudget - this.currentMonthlySpend;
    
    return {
      daily: Math.max(0, dailyRemaining),
      monthly: Math.max(0, monthlyRemaining)
    };
  }

  /**
   * Estimate cost for a specific task with a specific model
   */
  private estimateTaskCost(task: AITask, model: string): number {
    const pricing = this.modelPricing.get(model);
    if (!pricing) return Infinity;

    const inputCost = (task.estimatedInputTokens / 1000) * pricing.input;
    const outputCost = (task.estimatedOutputTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Check if we're near budget limits
   */
  private isNearBudgetLimit(availableBudget: { daily: number; monthly: number }, estimatedCost: number): boolean {
    const dailyThreshold = this.budgetConfig.dailyBudget * this.budgetConfig.alertThreshold;
    const monthlyThreshold = this.budgetConfig.monthlyBudget * this.budgetConfig.alertThreshold;

    return (
      availableBudget.daily < dailyThreshold ||
      availableBudget.monthly < monthlyThreshold ||
      (this.budgetConfig.enforceLimit && estimatedCost > availableBudget.daily)
    );
  }

  /**
   * Select model when budget is constrained
   */
  private selectBudgetConstrainedModel(task: AITask): CostOptimizedSelection {
    // Priority order: free models -> cheapest models -> reduce functionality
    const freeModels = Array.from(this.modelPricing.entries())
      .filter(([_, pricing]) => pricing.input === 0 && pricing.output === 0)
      .map(([model]) => model);

    if (freeModels.length > 0) {
      // Use best free model based on task requirements
      const bestFreeModel = this.selectBestModelForTask(freeModels, task);
      return this.createSelection(bestFreeModel, task, 'Budget constraint - using free model');
    }

    // If no free models, use cheapest
    const cheapestModel = this.findCheapestModel(task);
    return this.createSelection(cheapestModel, task, 'Budget constraint - using cheapest model');
  }

  /**
   * Select optimal model balancing cost and performance
   */
  private selectOptimalModel(task: AITask): CostOptimizedSelection {
    const models = Array.from(this.modelPricing.keys());
    const scoredModels = models.map(model => ({
      model,
      score: this.calculateModelScore(model, task)
    }));

    // Sort by score (higher is better)
    scoredModels.sort((a, b) => b.score - a.score);

    const bestModel = scoredModels[0].model;
    const reason = this.getSelectionReason(bestModel, task, scoredModels[0].score);

    return this.createSelection(bestModel, task, reason);
  }

  /**
   * Calculate score for a model based on cost efficiency and task suitability
   */
  private calculateModelScore(model: string, task: AITask): number {
    const pricing = this.modelPricing.get(model);
    if (!pricing) return -1;

    const estimatedCost = this.estimateTaskCost(task, model);
    
    // Cost efficiency score (lower cost = higher score)
    const costScore = estimatedCost === 0 ? 100 : Math.max(0, 100 - (estimatedCost * 1000));
    
    // Task suitability score based on complexity
    const complexityScore = this.getComplexityScore(model, task.complexity);
    
    // Priority weight
    const priorityWeight = task.priority === 'high' ? 1.5 : task.priority === 'medium' ? 1.0 : 0.7;

    // Combined score with priority weighting
    return (costScore * 0.4 + complexityScore * 0.6) * priorityWeight;
  }

  /**
   * Get complexity score for a model
   */
  private getComplexityScore(model: string, complexity: ComplexityLevel): number {
    // Higher quality models get higher scores for complex tasks
    const highQualityModels = ['anthropic/claude-3.5-sonnet'];
    const mediumQualityModels = ['openai/gpt-4o-mini'];
    const basicModels = ['google/gemini-2.5-flash', 'llama-3.3-70b-versatile', 'meta-llama/llama-3.3-70b-instruct:free'];

    if (complexity === ComplexityLevel.HIGH) {
      if (highQualityModels.includes(model)) return 100;
      if (mediumQualityModels.includes(model)) return 80;
      return 60;
    } else if (complexity === ComplexityLevel.MEDIUM) {
      if (highQualityModels.includes(model)) return 90;
      if (mediumQualityModels.includes(model)) return 100;
      return 85;
    } else {
      // Low complexity - prefer faster/cheaper models
      if (basicModels.includes(model)) return 100;
      if (mediumQualityModels.includes(model)) return 85;
      return 70;
    }
  }

  /**
   * Select best model for task from a list of candidates
   */
  private selectBestModelForTask(candidates: string[], task: AITask): string {
    const scored = candidates.map(model => ({
      model,
      score: this.getComplexityScore(model, task.complexity)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].model;
  }

  /**
   * Find cheapest model that can handle the task
   */
  private findCheapestModel(task: AITask): string {
    const models = Array.from(this.modelPricing.entries());
    const costs = models.map(([model, pricing]) => ({
      model,
      cost: this.estimateTaskCost(task, model)
    }));

    costs.sort((a, b) => a.cost - b.cost);
    return costs[0].model;
  }

  /**
   * Create selection object
   */
  private createSelection(model: string, task: AITask, reason: string): CostOptimizedSelection {
    const pricing = this.modelPricing.get(model);
    if (!pricing) {
      throw new Error(`Pricing not found for model: ${model}`);
    }

    const inputCost = (task.estimatedInputTokens / 1000) * pricing.input;
    const outputCost = (task.estimatedOutputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;
    const totalTokens = task.estimatedInputTokens + task.estimatedOutputTokens;
    const costEfficiency = totalTokens > 0 ? totalCost / totalTokens : 0;

    return {
      model,
      provider: this.getProviderFromModel(model),
      reason,
      estimatedCost: totalCost,
      inputTokens: task.estimatedInputTokens,
      outputTokens: task.estimatedOutputTokens,
      inputCost,
      outputCost,
      costEfficiency,
      confidence: this.calculateConfidence(model, task)
    };
  }

  /**
   * Get provider name from model string
   */
  private getProviderFromModel(model: string): string {
    if (model.includes('gemini') || model.includes('claude') || model.includes('gpt')) {
      return 'openrouter';
    }
    if (model.includes('llama') && model.includes('versatile')) {
      return 'groq';
    }
    return 'openrouter'; // default
  }

  /**
   * Calculate confidence in model selection
   */
  private calculateConfidence(model: string, task: AITask): number {
    const pricing = this.modelPricing.get(model);
    if (!pricing) return 0;

    // Higher confidence for free models within budget
    if (pricing.input === 0 && pricing.output === 0) {
      return 0.95;
    }

    // Lower confidence when near budget limits
    const availableBudget = this.calculateAvailableBudget();
    if (availableBudget.daily < this.budgetConfig.dailyBudget * 0.2) {
      return 0.7;
    }

    return 0.85;
  }

  /**
   * Get selection reason for logging
   */
  private getSelectionReason(model: string, task: AITask, score: number): string {
    const pricing = this.modelPricing.get(model);
    const isFree = pricing && pricing.input === 0 && pricing.output === 0;
    
    if (isFree) {
      return `Free model selected for ${task.type} (score: ${score.toFixed(1)})`;
    }

    return `Cost-optimized model for ${task.type} with ${task.complexity} complexity (score: ${score.toFixed(1)})`;
  }

  /**
   * Update budget configuration
   */
  updateBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config };
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): {
    dailyRemaining: number;
    monthlyRemaining: number;
    dailyPercentage: number;
    monthlyPercentage: number;
    alertTriggered: boolean;
  } {
    const dailyRemaining = this.budgetConfig.dailyBudget - this.currentDailySpend;
    const monthlyRemaining = this.budgetConfig.monthlyBudget - this.currentMonthlySpend;
    const dailyPercentage = (this.currentDailySpend / this.budgetConfig.dailyBudget) * 100;
    const monthlyPercentage = (this.currentMonthlySpend / this.budgetConfig.monthlyBudget) * 100;
    const alertTriggered = dailyPercentage > (this.budgetConfig.alertThreshold * 100) ||
                         monthlyPercentage > (this.budgetConfig.alertThreshold * 100);

    return {
      dailyRemaining,
      monthlyRemaining,
      dailyPercentage,
      monthlyPercentage,
      alertTriggered
    };
  }
}
