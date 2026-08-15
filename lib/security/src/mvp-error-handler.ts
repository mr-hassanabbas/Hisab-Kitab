// MVP Error Handler - Simplified error handling and retry logic for MVP
export interface MVPError {
  type: 'network' | 'api' | 'validation' | 'permission' | 'ai' | 'unknown';
  message: string;
  details?: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class MVPErrorHandler {
  private errorLog: MVPError[] = [];
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  /**
   * Classify error type
   */
  classifyError(error: any): MVPError {
    const timestamp = new Date();

    // Network errors
    if (error?.name === 'NetworkError' || error?.message?.includes('network') || error?.message?.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection error',
        details: error.message,
        retryable: true,
        severity: 'high',
        timestamp
      };
    }

    // API errors
    if (error?.status || error?.statusCode) {
      const status = error.status || error.statusCode;
      const retryable = status >= 500 || status === 429; // Retry on server errors or rate limiting
      
      return {
        type: 'api',
        message: `API error: ${status}`,
        details: error.message,
        retryable,
        severity: status >= 500 ? 'high' : 'medium',
        timestamp
      };
    }

    // Validation errors
    if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
      return {
        type: 'validation',
        message: 'Validation error',
        details: error.message,
        retryable: false,
        severity: 'low',
        timestamp
      };
    }

    // Permission errors
    if (error?.message?.includes('permission') || error?.message?.includes('unauthorized') || error?.message?.includes('forbidden')) {
      return {
        type: 'permission',
        message: 'Permission denied',
        details: error.message,
        retryable: false,
        severity: 'high',
        timestamp
      };
    }

    // AI errors
    if (error?.message?.includes('AI') || error?.message?.includes('OpenRouter') || error?.message?.includes('quota') || error?.message?.includes('429')) {
      return {
        type: 'ai',
        message: 'AI service error',
        details: error.message,
        retryable: error?.message?.includes('429') || error?.message?.includes('quota'),
        severity: 'medium',
        timestamp
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: 'Unknown error occurred',
      details: error.message || String(error),
      retryable: false,
      severity: 'medium',
      timestamp
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: MVPError, language: 'urdu' | 'english' = 'urdu'): string {
    const messages: Record<string, Record<string, string>> = {
      network: {
        urdu: 'انٹرنیٹ کنکشن میں مسئلہ ہے۔ دوبارہ کوشش کریں۔',
        english: 'Network connection error. Please try again.'
      },
      api: {
        urdu: 'سرور میں مسئلہ ہے۔ بعد میں دوبارہ کوشش کریں۔',
        english: 'Server error. Please try again later.'
      },
      validation: {
        urdu: 'غلط انپٹ۔ براہ کست دوبارہ کوشش کریں۔',
        english: 'Invalid input. Please try again.'
      },
      permission: {
        urdu: 'آپ کے پاس اجازت نہیں ہے۔',
        english: 'You do not have permission for this action.'
      },
      ai: {
        urdu: 'AI خدمت میں مسئلہ۔ دوبارہ کوشش کریں۔',
        english: 'AI service error. Please try again.'
      },
      unknown: {
        urdu: 'کچھ غلط ہوا۔ دوبارہ کوشش کریں۔',
        english: 'Something went wrong. Please try again.'
      }
    };

    return messages[error.type]?.[language] || messages[error.type]?.['english'] || messages['unknown']['english'];
  }

  /**
   * Retry function with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.retryConfig, ...config };
    let lastError: any;
    let delay = finalConfig.initialDelay;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const classifiedError = this.classifyError(error);

        this.logError(classifiedError);

        // Don't retry if error is not retryable
        if (!classifiedError.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === finalConfig.maxRetries) {
          throw error;
        }

        // Wait before retry
        await this.delay(delay);
        delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error
   */
  private logError(error: MVPError): void {
    this.errorLog.push(error);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }

    console.error('[MVP Error Handler]', JSON.stringify(error));
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentErrors: MVPError[];
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const error of this.errorLog) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    return {
      totalErrors: this.errorLog.length,
      byType,
      bySeverity,
      recentErrors: this.errorLog.slice(-10)
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Handle API response errors
   */
  handleAPIError(response: Response): MVPError {
    const timestamp = new Date();
    
    if (response.status === 401) {
      return {
        type: 'permission',
        message: 'Authentication required',
        details: 'Please log in again',
        retryable: false,
        severity: 'high',
        timestamp
      };
    }

    if (response.status === 403) {
      return {
        type: 'permission',
        message: 'Access denied',
        details: 'You do not have permission for this action',
        retryable: false,
        severity: 'high',
        timestamp
      };
    }

    if (response.status === 429) {
      return {
        type: 'api',
        message: 'Rate limit exceeded',
        details: 'Too many requests. Please wait and try again.',
        retryable: true,
        severity: 'medium',
        timestamp
      };
    }

    if (response.status >= 500) {
      return {
        type: 'api',
        message: 'Server error',
        details: `Server returned ${response.status}`,
        retryable: true,
        severity: 'high',
        timestamp
      };
    }

    return {
      type: 'api',
      message: 'API error',
      details: `HTTP ${response.status}`,
      retryable: false,
      severity: 'medium',
      timestamp
    };
  }

  /**
   * Wrap async function with error handling
   */
  async handleAsync<T>(
    fn: () => Promise<T>,
    options?: {
      retry?: boolean;
      language?: 'urdu' | 'english';
      fallback?: T;
    }
  ): Promise<{ success: boolean; data?: T; error?: MVPError; userMessage?: string }> {
    try {
      if (options?.retry) {
        const data = await this.retryWithBackoff(fn);
        return { success: true, data };
      } else {
        const data = await fn();
        return { success: true, data };
      }
    } catch (error) {
      const classifiedError = this.classifyError(error);
      const userMessage = this.getUserMessage(classifiedError, options?.language || 'urdu');

      if (options?.fallback !== undefined) {
        return { success: false, data: options.fallback, error: classifiedError, userMessage };
      }

      return { success: false, error: classifiedError, userMessage };
    }
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}

// Singleton instance for MVP
export const mvpErrorHandler = new MVPErrorHandler();
