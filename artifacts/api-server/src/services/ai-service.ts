import { type Request } from "express";
import { logger } from "../lib/logger.js";
import { ProviderFactory } from "@workspace/ai-gateway";
import { StructuredLogger, MetricsCollector, RequestTracer } from "@workspace/observability";

// Import prompt templates
const INTENT_CLASSIFICATION_SYSTEM = `You are an intelligent assistant for a construction business management system called "Hisab Kitab". 
Your task is to analyze user voice commands and classify their intent into specific categories.

Available Intent Categories:
- mark_attendance: Mark worker attendance (present, absent, half-day)
- get_attendance: Get attendance records for workers
- add_expense: Add expense record
- get_expenses: Get expense records
- create_worker: Create new worker record
- get_worker_info: Get worker information
- create_project: Create new project
- get_project_info: Get project information
- assign_worker: Assign worker to project
- calculate_payment: Calculate worker payments
- clarify: User is asking for clarification or more information

Your response should be a JSON object with the following structure:
{
  "intent": "intent_category",
  "confidence": 0.0-1.0,
  "entities": {
    "worker_name": "string or null",
    "project_name": "string or null",
    "date": "YYYY-MM-DD or null",
    "status": "string or null",
    "amount": "number or null",
    "category": "string or null"
  },
  "requires_clarification": false,
  "clarification_question": "string or null"
}`;

const DISAMBIGUATION_SYSTEM = `You are an intelligent assistant for a construction business management system called "Hisab Kitab".
Your task is to help users disambiguate when multiple matches are found.

When multiple workers or projects match a user's query, generate a natural language question to help the user specify which one they mean.

Example:
User: "Mark Ahmed as present"
System finds 3 workers named Ahmed
Response: "I found 3 workers named Ahmed: Ahmed Khan (Project A), Ahmed Ali (Project B), Ahmed Hassan (Project C). Which one do you mean?"

Your response should be a JSON object:
{
  "question": "natural language question",
  "candidates": ["candidate1", "candidate2", "candidate3"],
  "suggested_response": "string or null"
}`;

export interface ConversationContext {
  userId?: number;
  sessionId: string;
  lastProjectId?: number;
  lastProjectName?: string;
  lastLabourId?: number;
  lastLabourName?: string;
  expiresAt: Date;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  toolCalls: ToolCall[];
  requiresClarification?: boolean;
  clarificationQuestion?: string;
}

export interface ToolCall {
  tool: string;
  parameters: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresConfirmation: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface ClarificationRequest {
  question: string;
  candidates?: string[];
  actions: ToolCall[];
  state: ConversationContext;
  field?: string;
}

export interface ClarificationResponse {
  resolved: boolean;
  actions?: ToolCall[];
  question?: string;
}

export class AIService {
  private providerFactory: ProviderFactory;
  private providerConfigured: boolean = false;
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;
  private tracer: RequestTracer;

  constructor() {
    this.providerFactory = new ProviderFactory();
    this.structuredLogger = new StructuredLogger('ai-service');
    this.metricsCollector = new MetricsCollector(true);
    this.tracer = new RequestTracer(this.generateRequestId());
    this.initializeProviders();
  }

  /**
   * Initialize AI providers from environment configuration
   */
  private initializeProviders(): void {
    // Try to configure OpenRouter first
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey && openRouterKey !== "your_key_here") {
      this.providerFactory.registerProvider({
        type: "openrouter",
        apiKey: openRouterKey,
        priority: 10, // Highest priority
      });
      this.providerConfigured = true;
      logger.info("OpenRouter provider configured");
    }

    // Fallback to Groq if available
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey !== "your_key_here") {
      this.providerFactory.registerProvider({
        type: "groq",
        apiKey: groqKey,
        priority: 5, // Lower priority than OpenRouter
      });
      this.providerConfigured = true;
      logger.info("Groq provider configured");
    }

    if (!this.providerConfigured) {
      logger.warn("No AI providers configured - using placeholder implementation");
    }
  }

  /**
   * Parse intent from transcript
   */
  async parseIntent(transcript: string, context: ConversationContext): Promise<IntentResult> {
    const requestId = this.generateRequestId();
    this.tracer = new RequestTracer(requestId);
    this.structuredLogger.setRequestContext(requestId, context.userId);

    const span = this.tracer.startSpan('intent_parsing', { transcript });
    
    logger.info({ transcript, context }, "Parsing intent from transcript");
    
    if (!this.providerConfigured) {
      this.tracer.endSpan(span.id, { success: false, reason: 'no_provider' });
      return this.getPlaceholderIntent(transcript);
    }

    try {
      this.structuredLogger.logAIRequest(transcript, 'openrouter', context.userId || 0);
      this.metricsCollector.incrementCounter('ai.requests.total', { operation: 'intent_parsing' });

      const provider = this.providerFactory.getPrimaryProvider();
      const contextPrompt = this.buildContextPrompt(context);
      
      const prompt = `${INTENT_CLASSIFICATION_SYSTEM}\n\n${contextPrompt}\n\nUser command: "${transcript}"`;
      
      const startTime = Date.now();
      const result = await provider.generateStructured(prompt, {
        type: "object",
        properties: {
          intent: { type: "string" },
          confidence: { type: "number" },
          entities: { type: "object" },
          requires_clarification: { type: "boolean" },
          clarification_question: { type: "string" }
        },
        required: ["intent", "confidence", "entities"]
      });
      const duration = Date.now() - startTime;

      this.metricsCollector.recordTiming('ai.latency', duration, { operation: 'intent_parsing' });
      this.metricsCollector.recordTiming('intent_parsing', duration);
      
      const data = result.data as any;
      
      const intentResult = {
        intent: data.intent || "unknown",
        confidence: data.confidence || 0.5,
        entities: data.entities || {},
        requiresClarification: data.requires_clarification || false,
        clarificationQuestion: data.clarification_question || undefined,
        toolCalls: this.entitiesToToolCalls(data.entities, data.intent)
      };

      this.tracer.endSpan(span.id, { success: true, intent_category: intentResult.intent, confidence: intentResult.confidence });
      this.structuredLogger.info('intent.parsed', {
        category: intentResult.intent,
        confidence: intentResult.confidence,
        duration_ms: duration
      });

      return intentResult;
    } catch (error) {
      this.metricsCollector.incrementCounter('ai.errors', { operation: 'intent_parsing' });
      this.tracer.endSpan(span.id, { success: false, error: String(error) });
      this.structuredLogger.error('intent.parsing_failed', error as Error);
      logger.error({ error }, "Intent parsing failed, using fallback");
      return this.getPlaceholderIntent(transcript);
    }
  }

  /**
   * Execute validated tool call
   */
  async executeTool(toolCall: ToolCall, user: Request['user']): Promise<ToolResult> {
    logger.info({ toolCall, user }, "Executing tool");
    
    // Placeholder implementation - will be connected to tool service
    return {
      success: true,
      data: { result: "Tool executed successfully" }
    };
  }

  /**
   * Generate response from tool result
   */
  async generateResponse(result: ToolResult, intent: IntentResult): Promise<string> {
    logger.info({ result, intent }, "Generating response");
    
    if (!this.providerConfigured) {
      return this.getPlaceholderResponse(result);
    }

    try {
      const provider = this.providerFactory.getPrimaryProvider();
      
      const prompt = `Tool execution result: ${JSON.stringify(result)}\nOriginal intent: ${intent.intent}\n\nGenerate a natural language response for the user.`;
      
      const generationResult = await provider.generateText(prompt, {
        systemInstruction: "You are a helpful assistant for a construction business management system. Generate clear, concise responses in English or Urdu based on the tool execution results.",
        temperature: 0.7,
        maxTokens: 200
      });
      
      return generationResult.text;
    } catch (error) {
      logger.error({ error }, "Response generation failed, using fallback");
      return this.getPlaceholderResponse(result);
    }
  }

  /**
   * Handle clarification request
   */
  async handleClarification(clarifyRequest: ClarificationRequest): Promise<ClarificationResponse> {
    logger.info({ clarifyRequest }, "Handling clarification");
    
    if (!this.providerConfigured) {
      return {
        resolved: false,
        question: clarifyRequest.question
      };
    }

    try {
      const provider = this.providerFactory.getPrimaryProvider();
      
      const prompt = `User clarification request: ${clarifyRequest.question}\nCandidates: ${JSON.stringify(clarifyRequest.candidates)}\n\nGenerate a helpful response to guide the user.`;
      
      const result = await provider.generateText(prompt, {
        systemInstruction: DISAMBIGUATION_SYSTEM,
        temperature: 0.7,
        maxTokens: 300
      });
      
      return {
        resolved: false,
        question: result.text
      };
    } catch (error) {
      logger.error({ error }, "Clarification handling failed, using fallback");
      return {
        resolved: false,
        question: clarifyRequest.question
      };
    }
  }

  /**
   * Build context prompt for intent parsing
   */
  private buildContextPrompt(context: ConversationContext): string {
    let contextStr = "";
    
    if (context.lastProjectName) {
      contextStr += `Current project: ${context.lastProjectName}\n`;
    }
    if (context.lastLabourName) {
      contextStr += `Last mentioned worker: ${context.lastLabourName}\n`;
    }
    
    return contextStr || "No specific context";
  }

  /**
   * Convert entities to tool calls
   */
  private entitiesToToolCalls(entities: Record<string, unknown>, intent: string): ToolCall[] {
    return [{
      tool: intent,
      parameters: entities,
      riskLevel: this.assessRisk(intent, entities),
      requiresConfirmation: this.requiresConfirmation(intent, entities)
    }];
  }

  /**
   * Assess risk level of an operation
   */
  private assessRisk(intent: string, entities: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    const riskyIntents = ['delete', 'remove', 'payment', 'transfer'];
    if (riskyIntents.some(r => intent.includes(r))) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Determine if confirmation is required
   */
  private requiresConfirmation(intent: string, entities: Record<string, unknown>): boolean {
    return this.assessRisk(intent, entities) === 'high';
  }

  /**
   * Get placeholder intent (fallback when no provider configured)
   */
  private getPlaceholderIntent(transcript: string): IntentResult {
    return {
      intent: "mark_attendance",
      confidence: 0.5,
      entities: {
        worker_name: "unknown",
        status: "present",
        date: new Date().toISOString().split('T')[0]
      },
      toolCalls: [{
        tool: "mark_attendance",
        parameters: {
          worker_name: "unknown",
          status: "present",
          date: new Date().toISOString().split('T')[0]
        },
        riskLevel: "medium",
        requiresConfirmation: false
      }]
    };
  }

  /**
   * Get placeholder response (fallback when no provider configured)
   */
  private getPlaceholderResponse(result: ToolResult): string {
    if (result.success) {
      return "Action completed successfully";
    } else {
      return `Error: ${result.error}`;
    }
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.metricsCollector.getAllMetrics();
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    return {
      metrics: this.metricsCollector.getAllMetrics(),
      trace: this.tracer.getTrace()
    };
  }
}