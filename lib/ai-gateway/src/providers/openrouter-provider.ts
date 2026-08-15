import type { AIProvider, GenerationOptions, GenerationResult, StructuredResult, JSONSchema } from "../types/ai-types.js";

// TypeScript workaround for fetch in Node.js environment
declare const fetch: typeof import("node-fetch").default;

// OpenRouter model configuration
interface OpenRouterModel {
  id: string;
  name: string;
  contextWindow: number;
  pricing: {
    prompt: number; // per 1M tokens
    completion: number; // per 1M tokens
  };
  capabilities: {
    jsonMode: boolean;
    functionCalling: boolean;
    streaming: boolean;
  };
}

// OpenRouter API response types
interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterProvider implements AIProvider {
  name = "OpenRouter";
  models: string[] = [
    "openai/gpt-4o-mini",      // Fast, cheap, good for simple tasks
    "openai/gpt-4o",            // Balanced performance
    "anthropic/claude-3.5-sonnet", // Good for complex reasoning
    "google/gemini-2.5-flash",  // Free, good for general tasks
    "meta-llama/llama-3.3-70b-instruct", // Good free option
  ];

  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  // Model cost configuration (USD per 1M tokens)
  private modelCosts: Record<string, { prompt: number; completion: number }> = {
    "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.60 },
    "openai/gpt-4o": { prompt: 2.50, completion: 10.00 },
    "anthropic/claude-3.5-sonnet": { prompt: 3.00, completion: 15.00 },
    "google/gemini-2.5-flash": { prompt: 0.00, completion: 0.00 }, // Free
    "meta-llama/llama-3.3-70b-instruct": { prompt: 0.00, completion: 0.00 }, // Free
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate text response from OpenRouter
   */
  async generateText(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const startTime = Date.now();
    const model = options.model || this.selectDefaultModel();
    
    const messages: OpenRouterMessage[] = [];
    
    if (options.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }
    
    messages.push({ role: "user", content: prompt });

    const requestBody: OpenRouterRequest = {
      model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://hisab-kitab.local",
          "X-Title": "Hisab Kitab Voice Assistant",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data: OpenRouterResponse = await response.json() as OpenRouterResponse;
      const text = data.choices[0]?.message?.content || "";
      const latency = Date.now() - startTime;
      
      const cost = this.calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens, model);

      return {
        text,
        model,
        tokensUsed: data.usage.total_tokens,
        cost,
        latency,
        success: true,
        cached: false,
        cacheHit: false
      };
    } catch (error) {
      throw new Error(`OpenRouter generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate structured JSON response from OpenRouter
   */
  async generateStructured(prompt: string, schema: JSONSchema, options?: GenerationOptions): Promise<StructuredResult> {
    const startTime = Date.now();
    const model = options?.model || this.selectDefaultModel();
    
    const messages: OpenRouterMessage[] = [];
    
    if (options?.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }
    
    messages.push({ 
      role: "system", 
      content: `You are a helpful assistant that responds in JSON format. Your response must conform to this JSON schema: ${JSON.stringify(schema)}.`
    });
    
    messages.push({ role: "user", content: prompt });

    const requestBody: OpenRouterRequest = {
      model,
      messages,
      temperature: options?.temperature || 0.3,
      max_tokens: options?.maxTokens || 2000,
      response_format: { type: "json_object" },
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://hisab-kitab.local",
          "X-Title": "Hisab Kitab Voice Assistant",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data: OpenRouterResponse = await response.json() as OpenRouterResponse;
      const text = data.choices[0]?.message?.content || "";
      const latency = Date.now() - startTime;
      
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = { raw: text };
      }
      
      const cost = this.calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens, model);

      return {
        data: parsedData,
        model,
        tokensUsed: data.usage.total_tokens,
        cost,
        latency,
        success: true,
        cached: false,
        cacheHit: false
      };
    } catch (error) {
      throw new Error(`OpenRouter structured generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimate cost for a generation request
   */
  estimateCost(input: string, model: string): number {
    const inputTokens = this.estimateTokens(input);
    // Estimate output as 30% of input (typical for responses)
    const outputTokens = Math.ceil(inputTokens * 0.3);
    return this.calculateCost(inputTokens, outputTokens, model);
  }

  /**
   * Calculate actual cost based on token counts
   */
  private calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const costs = this.modelCosts[model] || this.modelCosts["openai/gpt-4o-mini"];
    const inputCost = (inputTokens / 1_000_000) * costs.prompt;
    const outputCost = (outputTokens / 1_000_000) * costs.completion;
    return inputCost + outputCost;
  }

  /**
   * Estimate token count (rough approximation: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Select default model based on availability and cost
   */
  private selectDefaultModel(): string {
    // Prefer free models first, then cheapest paid models
    return "google/gemini-2.5-flash"; // Free tier option
  }

  /**
   * Select model based on task complexity
   */
  selectModelForTask(complexity: "low" | "medium" | "high"): string {
    switch (complexity) {
      case "low":
        return "google/gemini-2.5-flash"; // Free, fast
      case "medium":
        return "openai/gpt-4o-mini"; // Balanced cost/performance
      case "high":
        return "anthropic/claude-3.5-sonnet"; // Best for complex reasoning
      default:
        return this.selectDefaultModel();
    }
  }
}