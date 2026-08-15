import type { AIProvider, GenerationOptions, GenerationResult, StructuredResult, JSONSchema } from "../types/ai-types.js";

// TypeScript workaround for fetch in Node.js environment
declare const fetch: typeof import("node-fetch").default;

// Groq API response types
interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

interface GroqResponse {
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

export class GroqProvider implements AIProvider {
  name = "Groq";
  models: string[] = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
  ];

  private apiKey: string;
  private baseUrl = "https://api.groq.com/openai/v1";

  // Groq is currently free for Llama models
  private modelCosts: Record<string, { prompt: number; completion: number }> = {
    "llama-3.3-70b-versatile": { prompt: 0.00, completion: 0.00 },
    "llama-3.1-70b-versatile": { prompt: 0.00, completion: 0.00 },
    "mixtral-8x7b-32768": { prompt: 0.00, completion: 0.00 },
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate text response from Groq
   */
  async generateText(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const startTime = Date.now();
    const model = options.model || "llama-3.3-70b-versatile";
    
    const messages: GroqMessage[] = [];
    
    if (options.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }
    
    messages.push({ role: "user", content: prompt });

    const requestBody: GroqRequest = {
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
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data: GroqResponse = await response.json() as GroqResponse;
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
      throw new Error(`Groq generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate structured JSON response from Groq
   */
  async generateStructured(prompt: string, schema: JSONSchema, options?: GenerationOptions): Promise<StructuredResult> {
    const startTime = Date.now();
    const model = options?.model || "llama-3.3-70b-versatile";
    
    const messages: GroqMessage[] = [];
    
    if (options?.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }
    
    messages.push({ 
      role: "system", 
      content: `You are a helpful assistant that responds in JSON format. Your response must conform to this JSON schema: ${JSON.stringify(schema)}.`
    });
    
    messages.push({ role: "user", content: prompt });

    const requestBody: GroqRequest = {
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
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data: GroqResponse = await response.json() as GroqResponse;
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
      throw new Error(`Groq structured generation failed: ${error instanceof Error ? error.message : String(error)}`);
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
    const costs = this.modelCosts[model] || this.modelCosts["llama-3.3-70b-versatile"];
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
}