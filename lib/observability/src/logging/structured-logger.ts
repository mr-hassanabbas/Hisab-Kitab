import type { StructuredLog, ErrorInfo, LogLevel } from "../types/observability-types.js";

// Simple console shim for library use
const consoleShim = {
  log: (...args: unknown[]) => {
    // In production, this would send to a logging service
    // For now, use a simple no-op for library compatibility
    // Logging service integration would be done in Phase 11
  }
};

export class StructuredLogger {
  private service: string;
  private requestContext: Map<string, string> = new Map();

  constructor(service: string) {
    this.service = service;
  }

  /**
   * Set request context for logging
   */
  setRequestContext(requestId: string, userId?: number, sessionId?: string): void {
    this.requestContext.set('request_id', requestId);
    if (userId) this.requestContext.set('user_id', userId.toString());
    if (sessionId) this.requestContext.set('session_id', sessionId);
  }

  /**
   * Clear request context
   */
  clearRequestContext(): void {
    this.requestContext.clear();
  }

  /**
   * Log an event with structured data
   */
  log(event: string, data: Record<string, unknown>, level: LogLevel = 'info'): void {
    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      request_id: this.requestContext.get('request_id'),
      user_id: this.requestContext.get('user_id') ? parseInt(this.requestContext.get('user_id')!) : undefined,
      session_id: this.requestContext.get('session_id'),
      event,
      data
    };

    // Log to console (in production, this would go to a logging service)
    consoleShim.log(logEntry);
  }

  /**
   * Log debug message
   */
  debug(event: string, data: Record<string, unknown>): void {
    this.log(event, data, 'debug');
  }

  /**
   * Log info message
   */
  info(event: string, data: Record<string, unknown>): void {
    this.log(event, data, 'info');
  }

  /**
   * Log warning message
   */
  warn(event: string, data: Record<string, unknown>): void {
    this.log(event, data, 'warn');
  }

  /**
   * Log error message
   */
  error(event: string, error: Error | string, data?: Record<string, unknown>): void {
    const errorInfo: ErrorInfo = typeof error === 'string' 
      ? { message: error }
      : {
          message: error.message,
          stack: error.stack,
          context: data
        };

    this.log(event, { ...data, error }, 'error');
  }

  /**
   * Log AI request
   */
  logAIRequest(transcript: string, model: string, userId: number): void {
    this.info('ai.request', {
      transcript,
      model,
      user_id: userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log AI response
   */
  logAIResponse(model: string, latency: number, cost: number, success: boolean): void {
    this.info('ai.response', {
      model,
      latency_ms: latency,
      cost_usd: cost,
      success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log tool execution
   */
  logToolExecution(tool: string, parameters: Record<string, unknown>, success: boolean, duration: number): void {
    this.info('tool.execution', {
      tool,
      parameters,
      success,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, userId: number, details: Record<string, unknown>): void {
    this.warn('security.event', {
      event,
      user_id: userId,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
}