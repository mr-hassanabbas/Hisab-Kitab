import { z } from "zod";

/**
 * Input validation and sanitization
 */
export class InputValidator {
  /**
   * Validate and sanitize transcript input
   */
  static validateTranscript(transcript: string): { valid: boolean; sanitized: string; error?: string } {
    if (!transcript || typeof transcript !== 'string') {
      return { valid: false, sanitized: "", error: "Transcript must be a string" };
    }

    // Check length
    if (transcript.length > 5000) {
      return { valid: false, sanitized: "", error: "Transcript too long (max 5000 characters)" };
    }

    // Remove potential injection attempts
    const sanitized = this.sanitizeInput(transcript);

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /<script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /\\x[0-9a-f]{2}/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        return { valid: false, sanitized: "", error: "Invalid characters detected" };
      }
    }

    return { valid: true, sanitized };
  }

  /**
   * Sanitize input string
   */
  static sanitizeInput(input: string): string {
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, "");
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/g, "");
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  /**
   * Validate tool parameters
   */
  static validateToolParameters(toolName: string, parameters: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Common validation rules
    if (!parameters || typeof parameters !== 'object') {
      errors.push("Parameters must be an object");
      return { valid: false, errors };
    }

    // Tool-specific validation
    switch (toolName) {
      case "mark_attendance":
        errors.push(...this.validateAttendanceParams(parameters));
        break;
      case "add_expense":
        errors.push(...this.validateExpenseParams(parameters));
        break;
      case "create_worker":
        errors.push(...this.validateWorkerParams(parameters));
        break;
      case "create_project":
        errors.push(...this.validateProjectParams(parameters));
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate attendance parameters
   */
  private static validateAttendanceParams(parameters: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (!parameters.worker_name || typeof parameters.worker_name !== 'string') {
      errors.push("worker_name is required and must be a string");
    }

    if (!parameters.project_name || typeof parameters.project_name !== 'string') {
      errors.push("project_name is required and must be a string");
    }

    if (parameters.status && typeof parameters.status === 'string') {
      const validStatuses = ['present', 'absent', 'half_day'];
      if (!validStatuses.includes(parameters.status)) {
        errors.push(`status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    if (parameters.amount && typeof parameters.amount !== 'number') {
      errors.push("amount must be a number");
    }

    return errors;
  }

  /**
   * Validate expense parameters
   */
  private static validateExpenseParams(parameters: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (!parameters.project_name || typeof parameters.project_name !== 'string') {
      errors.push("project_name is required and must be a string");
    }

    if (!parameters.category || typeof parameters.category !== 'string') {
      errors.push("category is required and must be a string");
    }

    if (!parameters.amount || typeof parameters.amount !== 'number') {
      errors.push("amount is required and must be a number");
    }

    if (parameters.amount && typeof parameters.amount === 'number' && parameters.amount <= 0) {
      errors.push("amount must be greater than 0");
    }

    return errors;
  }

  /**
   * Validate worker parameters
   */
  private static validateWorkerParams(parameters: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (!parameters.name || typeof parameters.name !== 'string') {
      errors.push("name is required and must be a string");
    }

    if (parameters.daily_wage && typeof parameters.daily_wage !== 'number') {
      errors.push("daily_wage must be a number");
    }

    if (parameters.daily_wage && typeof parameters.daily_wage === 'number' && parameters.daily_wage < 0) {
      errors.push("daily_wage must be non-negative");
    }

    return errors;
  }

  /**
   * Validate project parameters
   */
  private static validateProjectParams(parameters: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (!parameters.name || typeof parameters.name !== 'string') {
      errors.push("name is required and must be a string");
    }

    if (!parameters.project_code || typeof parameters.project_code !== 'string') {
      errors.push("project_code is required and must be a string");
    }

    if (!parameters.owner_name || typeof parameters.owner_name !== 'string') {
      errors.push("owner_name is required and must be a string");
    }

    if (!parameters.location || typeof parameters.location !== 'string') {
      errors.push("location is required and must be a string");
    }

    if (parameters.agreement_amount && typeof parameters.agreement_amount !== 'number') {
      errors.push("agreement_amount must be a number");
    }

    return errors;
  }
}