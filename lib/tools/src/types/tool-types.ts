// Tool Definition Types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  permissions: string[];
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolParameters {
  [key: string]: ToolParameter;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: unknown;
  values?: string[]; // for enum type
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ToolContext {
  userId: number;
  userRole: string;
  sessionId: string;
  requestId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// Intent Types
export interface Intent {
  category: IntentCategory;
  action: string;
  entities: Record<string, unknown>;
  confidence: number;
}

export enum IntentCategory {
  NAVIGATION = 'navigation',
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  REPORT = 'report',
  CALCULATE = 'calculate',
  CLARIFY = 'clarify',
}

// Entity Resolution Types
export interface EntityResolution {
  type: 'exact' | 'nickname' | 'fuzzy' | 'ambiguous' | 'not_found';
  entity?: unknown;
  candidates?: unknown[];
  question?: string;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationContext {
  toolName: string;
  userId: number;
  userRole: string;
}