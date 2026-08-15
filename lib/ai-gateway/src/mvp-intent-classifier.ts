// MVP Intent Classifier - Simplified for MVP Launch
import { TaskType, ComplexityLevel } from './types/ai-types';

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  taskType: TaskType;
  complexity: ComplexityLevel;
}

export interface MVPIntentPattern {
  pattern: RegExp[];
  intent: string;
  entities: string[];
  priority: number;
}

export class MVPIntentClassifier {
  private patterns: MVPIntentPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize MVP-specific intent patterns
   * Focused on core MVP features: attendance, workers, expenses
   */
  private initializePatterns(): void {
    // Attendance patterns - Urdu, English, Roman Urdu
    this.patterns.push({
      pattern: [
        /حاضری/i, /hazri/i, /attendance/i, /present/i, /absent/i, /lagao/i, /kar do/i
      ],
      intent: 'mark_attendance',
      entities: ['worker_name', 'project_name', 'status', 'date'],
      priority: 1
    });

    // Query attendance patterns
    this.patterns.push({
      pattern: [
        /حاضری دکھاؤ/i, /attendance dikhao/i, /hazri dikhao/i, /show attendance/i
      ],
      intent: 'get_attendance',
      entities: ['worker_name', 'project_name', 'date'],
      priority: 1
    });

    // Create worker patterns
    this.patterns.push({
      pattern: [
        /نیا مزدور/i, /naya worker/i, /create worker/i, /add worker/i, /banana/i, /shamil/i
      ],
      intent: 'create_worker',
      entities: ['name', 'phone', 'daily_wage'],
      priority: 1
    });

    // Query worker patterns
    this.patterns.push({
      pattern: [
        /مزدور کی تفصیلات/i, /worker details/i, /worker info/i, /mazdoor ki details/i
      ],
      intent: 'get_worker_info',
      entities: ['worker_name'],
      priority: 1
    });

    // Add expense patterns
    this.patterns.push({
      pattern: [
        /خرچہ/i, /kharcha/i, /expense/i, /lagao/i, /add expense/i
      ],
      intent: 'add_expense',
      entities: ['amount', 'category', 'description', 'project_name'],
      priority: 1
    });

    // Query expenses patterns
    this.patterns.push({
      pattern: [
        /اخراجات دکھاؤ/i, /expenses dikhao/i, /kharchay dikhao/i, /show expenses/i
      ],
      intent: 'get_expenses',
      entities: ['project_name', 'date', 'category'],
      priority: 1
    });

    // Navigation patterns (basic)
    this.patterns.push({
      pattern: [
        /کھولو/i, /kholo/i, /open/i, /navigate/i, /jao/i, /dikhao/i
      ],
      intent: 'navigate',
      entities: ['page'],
      priority: 2
    });
  }

  /**
   * Classify intent from text
   */
  classify(text: string): IntentClassification {
    const normalizedText = text.toLowerCase().trim();
    
    // Check each pattern
    for (const pattern of this.patterns) {
      const matches = pattern.pattern.some(regex => regex.test(normalizedText));
      
      if (matches) {
        const entities = this.extractEntities(normalizedText, pattern.entities);
        
        return {
          intent: pattern.intent,
          confidence: this.calculateConfidence(normalizedText, pattern),
          entities,
          taskType: this.mapToTaskType(pattern.intent),
          complexity: this.assessComplexity(entities)
        };
      }
    }

    // Default fallback
    return {
      intent: 'unknown',
      confidence: 0.3,
      entities: {},
      taskType: TaskType.PARAMETER_VALIDATION,
      complexity: ComplexityLevel.LOW
    };
  }

  /**
   * Extract entities from text based on entity types
   */
  private extractEntities(text: string, entityTypes: string[]): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract worker names (common Pakistani names)
    const workerNames = ['ahmed', 'mohammed', 'raza', 'ali', 'hassan', 'hussein', 'imran', 'khan', 'butt', 'malik'];
    const foundWorker = workerNames.find(name => text.includes(name));
    if (foundWorker && entityTypes.includes('worker_name')) {
      entities.worker_name = foundWorker;
    }

    // Extract project names (common construction terms)
    const projectTerms = ['construction', 'building', 'site', 'project', 'ghar', 'makkan'];
    const foundProject = projectTerms.find(term => text.includes(term));
    if (foundProject && entityTypes.includes('project_name')) {
      entities.project_name = foundProject;
    }

    // Extract status
    if (entityTypes.includes('status')) {
      if (text.includes('present') || text.includes('حاضر')) {
        entities.status = 'present';
      } else if (text.includes('absent') || text.includes('غائب')) {
        entities.status = 'absent';
      } else if (text.includes('half') || text.includes('آدھا')) {
        entities.status = 'half_day';
      }
    }

    // Extract amounts (numbers)
    if (entityTypes.includes('amount')) {
      const amountMatch = text.match(/(\d+)/);
      if (amountMatch) {
        entities.amount = parseInt(amountMatch[1]);
      }
    }

    // Extract dates
    if (entityTypes.includes('date')) {
      if (text.includes('today') || text.includes('آج')) {
        entities.date = new Date().toISOString().split('T')[0];
      } else if (text.includes('yesterday') || text.includes('کل')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        entities.date = yesterday.toISOString().split('T')[0];
      }
    }

    return entities;
  }

  /**
   * Calculate confidence score for classification
   */
  private calculateConfidence(text: string, pattern: MVPIntentPattern): number {
    let matches = 0;
    for (const regex of pattern.pattern) {
      if (regex.test(text)) {
        matches++;
      }
    }
    
    // Base confidence from pattern matches
    const patternConfidence = matches / pattern.pattern.length;
    
    // Boost confidence if entities are present
    const entities = this.extractEntities(text, pattern.entities);
    const entityCount = Object.keys(entities).length;
    const entityBoost = Math.min(entityCount * 0.1, 0.3);
    
    return Math.min(patternConfidence + entityBoost, 0.95);
  }

  /**
   * Map intent to task type
   */
  private mapToTaskType(intent: string): TaskType {
    const taskMapping: Record<string, TaskType> = {
      'mark_attendance': TaskType.ENTITY_EXTRACTION,
      'get_attendance': TaskType.ENTITY_EXTRACTION,
      'create_worker': TaskType.ENTITY_EXTRACTION,
      'get_worker_info': TaskType.ENTITY_EXTRACTION,
      'add_expense': TaskType.ENTITY_EXTRACTION,
      'get_expenses': TaskType.ENTITY_EXTRACTION,
      'navigate': TaskType.PARAMETER_VALIDATION,
      'unknown': TaskType.PARAMETER_VALIDATION
    };

    return taskMapping[intent] || TaskType.PARAMETER_VALIDATION;
  }

  /**
   * Assess complexity based on entities
   */
  private assessComplexity(entities: Record<string, any>): ComplexityLevel {
    const entityCount = Object.keys(entities).length;
    
    if (entityCount <= 2) {
      return ComplexityLevel.LOW;
    } else if (entityCount <= 4) {
      return ComplexityLevel.MEDIUM;
    } else {
      return ComplexityLevel.HIGH;
    }
  }

  /**
   * Check if text looks like a command
   */
  isCommand(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    const commandIndicators = ['kar', 'do', 'karo', 'lagao', 'dikhao', 'show', 'create', 'add', 'mark'];
    
    return commandIndicators.some(indicator => normalized.includes(indicator));
  }

  /**
   * Get available intents
   */
  getAvailableIntents(): string[] {
    return [...new Set(this.patterns.map(p => p.intent))];
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: MVPIntentPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Reset to default patterns
   */
  resetPatterns(): void {
    this.patterns = [];
    this.initializePatterns();
  }
}
