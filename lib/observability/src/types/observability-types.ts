// Observability Types
export interface StructuredLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  request_id?: string;
  user_id?: number;
  session_id?: string;
  event: string;
  data: Record<string, unknown>;
  error?: ErrorInfo;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
  context?: Record<string, unknown>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'timing' | 'gauge';
  value: number;
  tags: Record<string, string>;
  timestamp: string;
}

export interface TraceSpan {
  id: string;
  name: string;
  start_time: number;
  end_time?: number;
  duration?: number;
  parent_id?: string;
  metadata?: Record<string, unknown>;
}

export interface Trace {
  request_id: string;
  spans: TraceSpan[];
  total_duration: number;
}

export interface PerformanceReport {
  ai_latency: boolean;
  voice_recognition: boolean;
  tool_execution: boolean;
  database_queries: boolean;
  api_response: boolean;
  details: Record<string, unknown>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';