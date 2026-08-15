import type { Trace, TraceSpan } from "../types/observability-types.js";

export class RequestTracer {
  private requestId: string;
  private spans: TraceSpan[] = [];
  private spanStack: string[] = [];

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, metadata?: Record<string, unknown>): TraceSpan {
    const span: TraceSpan = {
      id: this.generateId(),
      name,
      start_time: Date.now(),
      parent_id: this.getCurrentSpanId(),
      metadata
    };
    
    this.spans.push(span);
    this.spanStack.push(span.id);
    
    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, metadata?: Record<string, unknown>): void {
    const span = this.spans.find(s => s.id === spanId);
    if (!span) return;

    span.end_time = Date.now();
    span.duration = span.end_time - span.start_time;
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }

    // Remove from stack
    const index = this.spanStack.indexOf(spanId);
    if (index > -1) {
      this.spanStack.splice(index, 1);
    }
  }

  /**
   * Get current span ID
   */
  private getCurrentSpanId(): string | undefined {
    return this.spanStack[this.spanStack.length - 1];
  }

  /**
   * Get complete trace
   */
  getTrace(): Trace {
    return {
      request_id: this.requestId,
      spans: this.spans,
      total_duration: this.getTotalDuration()
    };
  }

  /**
   * Get total duration of all spans
   */
  private getTotalDuration(): number {
    if (this.spans.length === 0) return 0;
    
    const startTime = Math.min(...this.spans.map(s => s.start_time));
    const endTime = Math.max(...this.spans.map(s => s.end_time || s.start_time));
    
    return endTime - startTime;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get span by ID
   */
  getSpanById(spanId: string): TraceSpan | undefined {
    return this.spans.find(s => s.id === spanId);
  }

  /**
   * Get root spans (no parent)
   */
  getRootSpans(): TraceSpan[] {
    return this.spans.filter(s => !s.parent_id);
  }

  /**
   * Get child spans of a parent
   */
  getChildSpans(parentId: string): TraceSpan[] {
    return this.spans.filter(s => s.parent_id === parentId);
  }
}