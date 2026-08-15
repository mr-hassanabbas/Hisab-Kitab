import type { AIProvider } from "../types/ai-types.js";
import { OpenRouterProvider } from "./openrouter-provider.js";
import { GroqProvider } from "./groq-provider.js";

export type ProviderType = "openrouter" | "groq";

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  priority?: number; // Higher priority = used first
}

export class ProviderFactory {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private config: ProviderConfig[] = [];

  /**
   * Register a provider configuration
   */
  registerProvider(config: ProviderConfig): void {
    this.config.push(config);
    
    let provider: AIProvider;
    switch (config.type) {
      case "openrouter":
        provider = new OpenRouterProvider(config.apiKey);
        break;
      case "groq":
        provider = new GroqProvider(config.apiKey);
        break;
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
    
    this.providers.set(config.type, provider);
  }

  /**
   * Get provider by type
   */
  getProvider(type: ProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get primary provider (highest priority)
   */
  getPrimaryProvider(): AIProvider {
    if (this.config.length === 0) {
      throw new Error("No providers configured");
    }

    // Sort by priority (descending)
    const sorted = [...this.config].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const primary = sorted[0];
    
    const provider = this.providers.get(primary.type);
    if (!provider) {
      throw new Error(`Provider ${primary.type} not found`);
    }
    
    return provider;
  }

  /**
   * Get all providers
   */
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if provider is available
   */
  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig[] {
    return [...this.config];
  }
}