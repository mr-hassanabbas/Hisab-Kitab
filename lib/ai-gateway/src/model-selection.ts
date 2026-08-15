import { TaskType, ComplexityLevel } from "./types/ai-types.js";
import type { ModelSelection } from "./types/ai-types.js";

export interface ModelConfig {
  provider: "openrouter" | "groq";
  model: string;
  maxTokens: number;
  temperature: number;
  estimatedCostPerRequest: number;
}

export class ModelSelector {
  private configs: Map<string, ModelConfig> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default model configurations
   */
  private initializeDefaultConfigs(): void {
    // OpenRouter models
    this.configs.set("gemini-flash", {
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      maxTokens: 2000,
      temperature: 0.7,
      estimatedCostPerRequest: 0.00, // Free
    });

    this.configs.set("gpt-4o-mini", {
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      maxTokens: 2000,
      temperature: 0.7,
      estimatedCostPerRequest: 0.01,
    });

    this.configs.set("claude-sonnet", {
      provider: "openrouter",
      model: "anthropic/claude-3.5-sonnet",
      maxTokens: 4000,
      temperature: 0.7,
      estimatedCostPerRequest: 0.05,
    });

    // Groq models
    this.configs.set("llama-3.3", {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      maxTokens: 2000,
      temperature: 0.7,
      estimatedCostPerRequest: 0.00, // Free
    });
  }

  /**
   * Select model based on task type and complexity
   */
  selectModel(taskType: TaskType, complexity: ComplexityLevel = ComplexityLevel.MEDIUM): ModelSelection {
    let configKey: string;
    let reason: string;

    switch (taskType) {
      case TaskType.INTENT_CLASSIFICATION:
        // Intent classification is simpler, can use faster models
        configKey = complexity === ComplexityLevel.HIGH ? "gpt-4o-mini" : "gemini-flash";
        reason = `Intent classification with ${complexity} complexity`;
        break;

      case TaskType.ENTITY_EXTRACTION:
        // Entity extraction needs good understanding
        configKey = complexity === ComplexityLevel.HIGH ? "claude-sonnet" : "gpt-4o-mini";
        reason = `Entity extraction with ${complexity} complexity`;
        break;

      case TaskType.PARAMETER_VALIDATION:
        // Parameter validation is straightforward
        configKey = "gemini-flash";
        reason = "Parameter validation (simple task)";
        break;

      case TaskType.RESPONSE_GENERATION:
        // Response generation may need higher quality
        configKey = complexity === ComplexityLevel.HIGH ? "claude-sonnet" : "gpt-4o-mini";
        reason = `Response generation with ${complexity} complexity`;
        break;

      default:
        configKey = "gemini-flash";
        reason = "Default model selection";
    }

    const config = this.configs.get(configKey);
    if (!config) {
      throw new Error(`Model config not found: ${configKey}`);
    }

    return {
      model: config.model,
      reason,
      estimatedCost: config.estimatedCostPerRequest,
    };
  }

  /**
   * Select model based on cost constraints
   */
  selectModelByCost(maxCost: number): ModelSelection {
    // Find cheapest model within cost constraint
    let cheapest: { key: string; config: ModelConfig } | null = null;

    for (const [key, config] of this.configs.entries()) {
      if (config.estimatedCostPerRequest <= maxCost) {
        if (!cheapest || config.estimatedCostPerRequest < cheapest.config.estimatedCostPerRequest) {
          cheapest = { key, config };
        }
      }
    }

    if (!cheapest) {
      // Fall back to free model
      const freeConfig = this.configs.get("gemini-flash");
      if (!freeConfig) {
        throw new Error("No model available within cost constraint");
      }
      return {
        model: freeConfig.model,
        reason: "Using free model (no model within cost constraint)",
        estimatedCost: freeConfig.estimatedCostPerRequest,
      };
    }

    return {
      model: cheapest.config.model,
      reason: `Cheapest model within cost constraint (max ${maxCost})`,
      estimatedCost: cheapest.config.estimatedCostPerRequest,
    };
  }

  /**
   * Get model configuration by model name
   */
  getModelConfig(modelName: string): ModelConfig | undefined {
    for (const config of this.configs.values()) {
      if (config.model === modelName) {
        return config;
      }
    }
    return undefined;
  }

  /**
   * Get all available models
   */
  getAvailableModels(): string[] {
    return Array.from(this.configs.values()).map((config) => config.model);
  }

  /**
   * Add custom model configuration
   */
  addModelConfig(key: string, config: ModelConfig): void {
    this.configs.set(key, config);
  }

  /**
   * Estimate total cost for multiple requests
   */
  estimateTotalCost(requests: Array<{ taskType: TaskType; complexity: ComplexityLevel }>): number {
    return requests.reduce((total, request) => {
      const selection = this.selectModel(request.taskType, request.complexity);
      return total + selection.estimatedCost;
    }, 0);
  }
}