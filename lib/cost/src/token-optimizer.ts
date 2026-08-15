// Token Optimization and Cost Estimation for Phase 13
import type { ModelPricing, TokenCount, CostEstimate } from './types/cost-types';

export interface TokenOptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  originalTokens: number;
  optimizedTokens: number;
  tokenReduction: number;
  percentageReduction: number;
  optimizations: string[];
}

export interface PromptContext {
  systemPrompt: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentInput: string;
  maxLength?: number;
}

export class TokenOptimizer {
  private modelPricing: Map<string, ModelPricing> = new Map();
  private tokenCache: Map<string, number> = new Map();

  constructor() {
    this.initializeModelPricing();
  }

  /**
   * Initialize model pricing data
   */
  private initializeModelPricing(): void {
    // OpenRouter/Groq model pricing (per 1K tokens)
    this.modelPricing.set('google/gemini-2.5-flash', {
      input: 0.000075,
      output: 0.00015,
      currency: 'USD'
    });

    this.modelPricing.set('openai/gpt-4o-mini', {
      input: 0.00015,
      output: 0.0006,
      currency: 'USD'
    });

    this.modelPricing.set('anthropic/claude-3.5-sonnet', {
      input: 0.003,
      output: 0.015,
      currency: 'USD'
    });

    this.modelPricing.set('llama-3.3-70b-versatile', {
      input: 0.0,
      output: 0.0,
      currency: 'USD'
    });

    this.modelPricing.set('meta-llama/llama-3.3-70b-instruct:free', {
      input: 0.0,
      output: 0.0,
      currency: 'USD'
    });
  }

  /**
   * Estimate token count for text (rough approximation)
   * Uses character-based estimation when exact tokenizer not available
   */
  estimateTokens(text: string, model: string = 'default'): number {
    // Check cache first
    const cacheKey = `${model}:${text.substring(0, 100)}`;
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }

    // Rough estimation: ~4 characters per token for English
    // Adjust for mixed languages (Urdu/English use different ratios)
    const hasNonLatin = /[^\x00-\x7F]/.test(text);
    const charRatio = hasNonLatin ? 2.5 : 4; // Non-Latin scripts use more tokens per character

    const estimatedTokens = Math.ceil(text.length / charRatio);

    // Cache the result
    this.tokenCache.set(cacheKey, estimatedTokens);

    return estimatedTokens;
  }

  /**
   * Estimate cost for input/output tokens
   */
  estimateCost(inputTokens: number, outputTokens: number, model: string): CostEstimate {
    const pricing = this.modelPricing.get(model);
    if (!pricing) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: 'USD'
      };
    }

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: pricing.currency
    };
  }

  /**
   * Estimate cost for a complete prompt
   */
  estimatePromptCost(context: PromptContext, model: string): CostEstimate {
    const inputTokens = this.estimateContextTokens(context);
    // Estimate output tokens as 30% of input (typical for responses)
    const estimatedOutputTokens = Math.ceil(inputTokens * 0.3);

    return this.estimateCost(inputTokens, estimatedOutputTokens, model);
  }

  /**
   * Estimate tokens for complete context
   */
  estimateContextTokens(context: PromptContext): number {
    let totalTokens = 0;

    totalTokens += this.estimateTokens(context.systemPrompt, 'system');

    for (const message of context.conversationHistory) {
      totalTokens += this.estimateTokens(message.content, message.role);
    }

    totalTokens += this.estimateTokens(context.currentInput, 'user');

    return totalTokens;
  }

  /**
   * Optimize prompt to reduce token count
   */
  optimizePrompt(prompt: string, targetReduction: number = 0.2): TokenOptimizationResult {
    const originalTokens = this.estimateTokens(prompt);
    const optimizations: string[] = [];
    let optimizedPrompt = prompt;

    // Optimization 1: Remove excessive whitespace
    optimizedPrompt = optimizedPrompt.replace(/\s+/g, ' ').trim();
    if (optimizedPrompt.length !== prompt.length) {
      optimizations.push('Removed excessive whitespace');
    }

    // Optimization 2: Remove redundant phrases
    const redundantPatterns = [
      { pattern: /please\s+/gi, replacement: '' },
      { pattern: /kindly\s+/gi, replacement: '' },
      { pattern: /i would like you to\s+/gi, replacement: '' },
      { pattern: /can you please\s+/gi, replacement: '' },
      { pattern: /i need you to\s+/gi, replacement: '' },
    ];

    for (const { pattern, replacement } of redundantPatterns) {
      const before = optimizedPrompt;
      optimizedPrompt = optimizedPrompt.replace(pattern, replacement);
      if (before !== optimizedPrompt) {
        optimizations.push('Removed redundant courtesy phrases');
      }
    }

    // Optimization 3: Compress repeated information
    optimizedPrompt = this.compressRepeatedInfo(optimizedPrompt, optimizations);

    // Optimization 4: Use abbreviations where appropriate
    optimizedPrompt = this.useAbbreviations(optimizedPrompt, optimizations);

    // Optimization 5: Remove verbose explanations
    optimizedPrompt = this.removeVerbosity(optimizedPrompt, optimizations);

    const optimizedTokens = this.estimateTokens(optimizedPrompt);
    const tokenReduction = originalTokens - optimizedTokens;
    const percentageReduction = (tokenReduction / originalTokens) * 100;

    return {
      originalPrompt: prompt,
      optimizedPrompt,
      originalTokens,
      optimizedTokens,
      tokenReduction,
      percentageReduction,
      optimizations
    };
  }

  /**
   * Optimize complete context
   */
  optimizeContext(context: PromptContext, targetReduction: number = 0.2): PromptContext {
    const optimized: PromptContext = {
      ...context,
      systemPrompt: this.optimizePrompt(context.systemPrompt, targetReduction).optimizedPrompt,
      currentInput: this.optimizePrompt(context.currentInput, targetReduction).optimizedPrompt,
      conversationHistory: context.conversationHistory.map(msg => ({
        ...msg,
        content: this.optimizePrompt(msg.content, targetReduction).optimizedPrompt
      }))
    };

    // Apply context window limit if specified
    if (context.maxLength) {
      optimized.conversationHistory = this.trimToFitWindow(
        optimized.conversationHistory,
        optimized.systemPrompt,
        optimized.currentInput,
        context.maxLength
      );
    }

    return optimized;
  }

  /**
   * Compress repeated information in prompt
   */
  private compressRepeatedInfo(prompt: string, optimizations: string[]): string {
    // Remove duplicate sentences
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim());
    const uniqueSentences = [...new Set(sentences.map(s => s.trim().toLowerCase()))];
    
    if (sentences.length !== uniqueSentences.length) {
      optimizations.push('Compressed repeated information');
      return sentences.filter((s, i) => 
        uniqueSentences.includes(s.trim().toLowerCase()) && 
        sentences.findIndex((x, j) => x.trim().toLowerCase() === s.trim().toLowerCase() && j <= i) === i
      ).join('. ');
    }

    return prompt;
  }

  /**
   * Use abbreviations where appropriate
   */
  private useAbbreviations(prompt: string, optimizations: string[]): string {
    const abbreviations = [
      { pattern: /\binformation\b/gi, replacement: 'info' },
      { pattern: /\bapplication\b/gi, replacement: 'app' },
      { pattern: /\bconfiguration\b/gi, replacement: 'config' },
      { pattern: /\bdocumentation\b/gi, replacement: 'docs' },
      { pattern: /\bparameter\b/gi, replacement: 'param' },
      { pattern: /\bargument\b/gi, replacement: 'arg' },
      { pattern: /\bvariable\b/gi, replacement: 'var' },
      { pattern: /\bfunction\b/gi, replacement: 'fn' },
    ];

    let modified = false;
    for (const { pattern, replacement } of abbreviations) {
      if (pattern.test(prompt)) {
        prompt = prompt.replace(pattern, replacement);
        modified = true;
      }
    }

    if (modified) {
      optimizations.push('Used common abbreviations');
    }

    return prompt;
  }

  /**
   * Remove verbose explanations
   */
  private removeVerbosity(prompt: string, optimizations: string[]): string {
    const verbosePatterns = [
      { pattern: /in order to\s+/gi, replacement: 'to ' },
      { pattern: /for the purpose of\s+/gi, replacement: 'for ' },
      { pattern: /as a result of\s+/gi, replacement: 'due to ' },
      { pattern: /at this point in time\s+/gi, replacement: 'now ' },
      { pattern: /in the event that\s+/gi, replacement: 'if ' },
    ];

    let modified = false;
    for (const { pattern, replacement } of verbosePatterns) {
      if (pattern.test(prompt)) {
        prompt = prompt.replace(pattern, replacement);
        modified = true;
      }
    }

    if (modified) {
      optimizations.push('Removed verbose phrases');
    }

    return prompt;
  }

  /**
   * Trim conversation history to fit within context window
   */
  private trimToFitWindow(
    history: Array<{ role: string; content: string }>,
    systemPrompt: string,
    currentInput: string,
    maxLength: number
  ): Array<{ role: string; content: string }> {
    const systemTokens = this.estimateTokens(systemPrompt);
    const inputTokens = this.estimateTokens(currentInput);
    const availableTokens = maxLength - systemTokens - inputTokens;

    if (availableTokens <= 0) {
      return []; // No space for history
    }

    let trimmedHistory: Array<{ role: string; content: string }> = [];
    let usedTokens = 0;

    // Keep most recent messages (reverse order)
    for (let i = history.length - 1; i >= 0; i--) {
      const messageTokens = this.estimateTokens(history[i].content);
      
      if (usedTokens + messageTokens <= availableTokens) {
        trimmedHistory.unshift(history[i]);
        usedTokens += messageTokens;
      } else {
        break;
      }
    }

    return trimmedHistory;
  }

  /**
   * Calculate token count for text
   */
  getTokenCount(text: string): TokenCount {
    const totalTokens = this.estimateTokens(text);
    // Rough estimate: 70% input, 30% output for typical interactions
    const inputTokens = Math.ceil(totalTokens * 0.7);
    const outputTokens = Math.ceil(totalTokens * 0.3);

    return {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    };
  }

  /**
   * Get detailed cost breakdown
   */
  getCostBreakdown(text: string, model: string): {
    tokenCount: TokenCount;
    costEstimate: CostEstimate;
    modelPricing: ModelPricing;
  } {
    const tokenCount = this.getTokenCount(text);
    const costEstimate = this.estimateCost(tokenCount.input, tokenCount.output, model);
    const pricing = this.modelPricing.get(model) || { input: 0, output: 0, currency: 'USD' };

    return {
      tokenCount,
      costEstimate,
      modelPricing: pricing
    };
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.tokenCache.size,
      hitRate: 0.0 // Would need tracking for actual hit rate
    };
  }
}
