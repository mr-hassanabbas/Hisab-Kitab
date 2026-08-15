// AI Provider Types
export interface AIProvider {
  name: string;
  models: string[];
  generateText(prompt: string, options: GenerationOptions): Promise<GenerationResult>;
  generateStructured?(prompt: string, schema: JSONSchema, options?: GenerationOptions): Promise<StructuredResult>;
  estimateCost?(input: string, model: string): number;
}

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

export interface GenerationResult {
  text: string;
  model: string;
  tokensUsed: number;
  cost: number;
  latency: number;
  success?: boolean;
  cached?: boolean;
  cacheHit?: boolean;
}

export interface StructuredResult {
  data: unknown;
  model: string;
  tokensUsed: number;
  cost: number;
  latency: number;
  success?: boolean;
  cached?: boolean;
  cacheHit?: boolean;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

// Task Types
export enum TaskType {
  INTENT_CLASSIFICATION = "intent_classification",
  ENTITY_EXTRACTION = "entity_extraction",
  PARAMETER_VALIDATION = "parameter_validation",
  RESPONSE_GENERATION = "response_generation",
}

export enum ComplexityLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface ModelSelection {
  model: string;
  reason: string;
  estimatedCost: number;
}

// Conversation Context
export interface ConversationContext {
  userId?: number;
  sessionId: string;
  lastProjectId?: number;
  lastProjectName?: string;
  lastLabourId?: number;
  lastLabourName?: string;
  expiresAt: Date;
}