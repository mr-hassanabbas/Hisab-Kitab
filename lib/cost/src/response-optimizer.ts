// Response Optimization for AI Prompts - Phase 13
import { TokenOptimizer } from './token-optimizer';

export interface ResponseOptimizationResult {
  originalResponse: string;
  optimizedResponse: string;
  originalTokens: number;
  optimizedTokens: number;
  tokenReduction: number;
  percentageReduction: number;
  optimizations: string[];
  qualityPreserved: boolean;
}

export interface ResponseContext {
  originalPrompt: string;
  taskType: string;
  requiredElements: string[];
  language: 'urdu' | 'english' | 'mixed';
  tone: 'formal' | 'casual' | 'technical';
}

export class ResponseOptimizer {
  private tokenOptimizer: TokenOptimizer;
  private responseCache: Map<string, ResponseOptimizationResult> = new Map();

  constructor() {
    this.tokenOptimizer = new TokenOptimizer();
  }

  /**
   * Optimize AI response to reduce tokens while preserving quality
   */
  optimizeResponse(
    response: string,
    context: ResponseContext
  ): ResponseOptimizationResult {
    // Check cache first
    const cacheKey = this.generateCacheKey(response, context);
    if (this.responseCache.has(cacheKey)) {
      return this.responseCache.get(cacheKey)!;
    }

    const originalTokens = this.tokenOptimizer.estimateTokens(response);
    const optimizations: string[] = [];
    let optimizedResponse = response;
    let qualityPreserved = true;

    // Optimization 1: Remove unnecessary fillers and pleasantries
    optimizedResponse = this.removeFillers(optimizedResponse, context.language, optimizations);

    // Optimization 2: Compress repetitive information
    optimizedResponse = this.compressRepetitions(optimizedResponse, optimizations);

    // Optimization 3: Use concise language
    optimizedResponse = this.makeConcise(optimizedResponse, context.tone, optimizations);

    // Optimization 4: Preserve required elements
    optimizedResponse = this.preserveRequiredElements(optimizedResponse, context.requiredElements, optimizations);

    // Optimization 5: Optimize for specific task type
    optimizedResponse = this.optimizeForTask(optimizedResponse, context.taskType, optimizations);

    // Optimization 6: Language-specific optimization
    optimizedResponse = this.optimizeForLanguage(optimizedResponse, context.language, optimizations);

    const optimizedTokens = this.tokenOptimizer.estimateTokens(optimizedResponse);
    const tokenReduction = originalTokens - optimizedTokens;
    const percentageReduction = (tokenReduction / originalTokens) * 100;

    // Check if quality is preserved
    qualityPreserved = this.checkQualityPreserved(response, optimizedResponse, context);

    const result: ResponseOptimizationResult = {
      originalResponse: response,
      optimizedResponse,
      originalTokens,
      optimizedTokens,
      tokenReduction,
      percentageReduction,
      optimizations,
      qualityPreserved
    };

    // Cache the result
    this.responseCache.set(cacheKey, result);

    return result;
  }

  /**
   * Remove unnecessary fillers and pleasantries
   */
  private removeFillers(text: string, language: string, optimizations: string[]): string {
    const fillerPatterns = {
      english: [
        { pattern: /\b(sure|certainly|of course|absolutely|definitely)\b,\s*/gi, replacement: '' },
        { pattern: /\b(i would be happy to|i'd be happy to)\s+/gi, replacement: '' },
        { pattern: /\b(let me help you with that|i can help you with that)\b\s*/gi, replacement: '' },
        { pattern: /\b(here is|here's)\s+/gi, replacement: '' },
        { pattern: /\b(the answer is|the result is)\b\s*/gi, replacement: '' },
      ],
      urdu: [
        { pattern: /(ضرور|بالکل|یقینا)\s*/gi, replacement: '' },
        { pattern: /(میں آپ کی مدد کر سکتا ہوں)\s*/gi, replacement: '' },
        { pattern: /(یہاں ہے)\s*/gi, replacement: '' },
      ],
      mixed: [
        { pattern: /\b(sure|certainly|of course|ضرور|بالکل)\b,\s*/gi, replacement: '' },
        { pattern: /\b(let me help|i can help|میں مدد کر سکتا)\s+/gi, replacement: '' },
      ]
    };

    const patterns = fillerPatterns[language as keyof typeof fillerPatterns] || fillerPatterns.english;
    let modified = false;

    for (const { pattern, replacement } of patterns) {
      const before = text;
      text = text.replace(pattern, replacement);
      if (before !== text) {
        modified = true;
      }
    }

    if (modified) {
      optimizations.push('Removed unnecessary fillers and pleasantries');
    }

    return text.trim();
  }

  /**
   * Compress repetitive information
   */
  private compressRepetitions(text: string, optimizations: string[]): string {
    // Remove repeated sentences
    const sentences = text.split(/[.!?।]+/).filter(s => s.trim());
    const seen = new Set<string>();
    const uniqueSentences: string[] = [];

    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueSentences.push(sentence.trim());
      }
    }

    if (sentences.length !== uniqueSentences.length) {
      optimizations.push('Compressed repetitive sentences');
      return uniqueSentences.join('. ');
    }

    return text;
  }

  /**
   * Make language more concise
   */
  private makeConcise(text: string, tone: string, optimizations: string[]): string {
    const concisePatterns = [
      { pattern: /\bin order to\b/gi, replacement: 'to' },
      { pattern: /\bfor the purpose of\b/gi, replacement: 'for' },
      { pattern: /\bat this point in time\b/gi, replacement: 'now' },
      { pattern: /\bin the event that\b/gi, replacement: 'if' },
      { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
      { pattern: /\bis able to\b/gi, replacement: 'can' },
      { pattern: /\bis capable of\b/gi, replacement: 'can' },
      { pattern: /\bhas the ability to\b/gi, replacement: 'can' },
    ];

    let modified = false;
    for (const { pattern, replacement } of concisePatterns) {
      const before = text;
      text = text.replace(pattern, replacement);
      if (before !== text) {
        modified = true;
      }
    }

    if (modified) {
      optimizations.push('Made language more concise');
    }

    return text;
  }

  /**
   * Preserve required elements in the response
   */
  private preserveRequiredElements(text: string, requiredElements: string[], optimizations: string[]): string {
    if (requiredElements.length === 0) return text;

    const missingElements = requiredElements.filter(element => 
      !text.toLowerCase().includes(element.toLowerCase())
    );

    if (missingElements.length > 0) {
      // Add missing elements back
      const addition = missingElements.join(', ');
      text = `${text} (Note: ${addition})`;
      optimizations.push('Preserved required elements');
    }

    return text;
  }

  /**
   * Optimize response for specific task type
   */
  private optimizeForTask(text: string, taskType: string, optimizations: string[]): string {
    const taskOptimizations: Record<string, (text: string) => string> = {
      'attendance': (t) => this.optimizeAttendanceResponse(t),
      'payment': (t) => this.optimizePaymentResponse(t),
      'expense': (t) => this.optimizeExpenseResponse(t),
      'report': (t) => this.optimizeReportResponse(t),
      'navigation': (t) => this.optimizeNavigationResponse(t),
    };

    const optimizer = taskOptimizations[taskType];
    if (optimizer) {
      const before = text;
      text = optimizer(text);
      if (before !== text) {
        optimizations.push(`Optimized for ${taskType} task`);
      }
    }

    return text;
  }

  /**
   * Optimize attendance-related responses
   */
  private optimizeAttendanceResponse(text: string): string {
    // Focus on key attendance information
    const patterns = [
      { pattern: /i have (successfully )?marked /gi, replacement: '' },
      { pattern: /attendance (has been )?recorded for /gi, replacement: '' },
      { pattern: /worker /gi, replacement: '' },
    ];

    let result = text;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }

    return result.trim();
  }

  /**
   * Optimize payment-related responses
   */
  private optimizePaymentResponse(text: string): string {
    const patterns = [
      { pattern: /payment (of )?/gi, replacement: '' },
      { pattern: /has been (successfully )?recorded/gi, replacement: 'recorded' },
      { pattern: /for worker /gi, replacement: '' },
    ];

    let result = text;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }

    return result.trim();
  }

  /**
   * Optimize expense-related responses
   */
  private optimizeExpenseResponse(text: string): string {
    const patterns = [
      { pattern: /expense (of )?/gi, replacement: '' },
      { pattern: /has been (successfully )?added/gi, replacement: 'added' },
      { pattern: /for /gi, replacement: '' },
    ];

    let result = text;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }

    return result.trim();
  }

  /**
   * Optimize report-related responses
   */
  private optimizeReportResponse(text: string): string {
    // Reports should be concise but comprehensive
    const patterns = [
      { pattern: /here is the (requested )?report for /gi, replacement: '' },
      { pattern: /showing /gi, replacement: '' },
      { pattern: /displaying /gi, replacement: '' },
    ];

    let result = text;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }

    return result.trim();
  }

  /**
   * Optimize navigation-related responses
   */
  private optimizeNavigationResponse(text: string): string {
    const patterns = [
      { pattern: /i am (now )?navigating to /gi, replacement: '' },
      { pattern: /taking you to /gi, replacement: '' },
      { pattern: /opening /gi, replacement: '' },
    ];

    let result = text;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }

    return result.trim();
  }

  /**
   * Optimize for specific language
   */
  private optimizeForLanguage(text: string, language: string, optimizations: string[]): string {
    if (language === 'mixed') {
      // For mixed language, prefer shorter constructions
      return this.optimizeMixedLanguage(text, optimizations);
    }

    return text;
  }

  /**
   * Optimize mixed language responses
   */
  private optimizeMixedLanguage(text: string, optimizations: string[]): string {
    // Prefer Roman Urdu over Urdu script for common terms (saves tokens)
    const urduToRoman: Record<string, string> = {
      'حاضری': 'attendance',
      'ادائیگی': 'payment',
      'خرچ': 'expense',
      'رپورٹ': 'report',
      'مناسب': 'suitable',
    };

    let modified = false;
    for (const [urdu, roman] of Object.entries(urduToRoman)) {
      if (text.includes(urdu)) {
        text = text.replace(new RegExp(urdu, 'g'), roman);
        modified = true;
      }
    }

    if (modified) {
      optimizations.push('Optimized mixed language for token efficiency');
    }

    return text;
  }

  /**
   * Check if quality is preserved after optimization
   */
  private checkQualityPreserved(original: string, optimized: string, context: ResponseContext): boolean {
    // Check if all required elements are present
    for (const element of context.requiredElements) {
      if (!optimized.toLowerCase().includes(element.toLowerCase())) {
        return false;
      }
    }

    // Check if key information is preserved (length should be reasonable)
    const lengthRatio = optimized.length / original.length;
    if (lengthRatio < 0.3) {
      // Too much compression, might have lost important info
      return false;
    }

    // Check if response still makes sense (has complete sentences)
    const sentences = optimized.split(/[.!?।]+/).filter(s => s.trim());
    if (sentences.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Generate cache key for optimization result
   */
  private generateCacheKey(response: string, context: ResponseContext): string {
    const keyComponents = [
      response.substring(0, 50), // First 50 chars
      context.taskType,
      context.language,
      context.tone,
      context.requiredElements.join(',')
    ];
    return keyComponents.join('|').replace(/\s+/g, '_');
  }

  /**
   * Clear optimization cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.responseCache.size,
      keys: Array.from(this.responseCache.keys())
    };
  }

  /**
   * Batch optimize multiple responses
   */
  optimizeBatch(
    responses: Array<{ response: string; context: ResponseContext }>
  ): ResponseOptimizationResult[] {
    return responses.map(({ response, context }) =>
      this.optimizeResponse(response, context)
    );
  }

  /**
   * Get optimization suggestions for improvement
   */
  getOptimizationSuggestions(result: ResponseOptimizationResult): string[] {
    const suggestions: string[] = [];

    if (result.percentageReduction < 10) {
      suggestions.push('Response is already well-optimized');
    }

    if (result.optimizations.length === 0) {
      suggestions.push('No further optimizations possible');
    }

    if (!result.qualityPreserved) {
      suggestions.push('Consider using less aggressive optimization to preserve quality');
    }

    if (result.percentageReduction > 30) {
      suggestions.push('High token reduction achieved - monitor for quality impact');
    }

    return suggestions;
  }
}
