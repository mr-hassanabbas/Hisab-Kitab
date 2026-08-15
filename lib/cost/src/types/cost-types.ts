// Cost Monitoring Types
export interface ModelPricing {
  input: number; // Cost per 1K input tokens
  output: number; // Cost per 1K output tokens
  currency: string;
}

export interface TokenCount {
  input: number;
  output: number;
  total: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export interface BudgetConfig {
  dailyBudget: number;
  monthlyBudget: number;
  alertThreshold: number; // Percentage (e.g., 0.8 for 80%)
  enforceLimit: boolean;
}

export interface CostTracking {
  dailySpend: number;
  monthlySpend: number;
  requestCount: number;
  lastReset: Date;
}

export interface ModelSelection {
  model: string;
  provider: string;
  reason: string;
  estimatedCost: number;
}

export interface PerformanceThreshold {
  metric: string;
  maxDuration: number;
  unit: string;
}

export interface PerformanceReport {
  ai_latency: boolean;
  voice_recognition: boolean;
  tool_execution: boolean;
  database_queries: boolean;
  api_response: boolean;
  details: Record<string, unknown>;
}