// Context Manager for Version 1
// Manages session context, project context, worker context, and entity context

export interface SessionContext {
  userId: number;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  currentProject?: {
    id: number;
    name: string;
    since: Date;
  };
  currentWorkers: Array<{
    id: number;
    name: string;
    mentionedAt: Date;
  }>;
  recentDates: Array<{
    date: string;
    mentionedAt: Date;
  }>;
  recentEntities: Map<string, any>;
  conversationTurns: number;
}

export interface ContextUpdate {
  type: 'project' | 'worker' | 'date' | 'entity';
  data: any;
  timestamp: Date;
}

export class ContextManager {
  private contexts: Map<string, SessionContext>;
  private maxSessionDuration: number = 30 * 60 * 1000; // 30 minutes
  private maxConversationTurns: number = 10;
  private maxWorkersInContext: number = 5;
  private maxDatesInContext: number = 3;

  constructor() {
    this.contexts = new Map();
  }

  /**
   * Get or create session context
   */
  getContext(userId: number, sessionId: string): SessionContext {
    const key = `${userId}:${sessionId}`;
    
    let context = this.contexts.get(key);
    
    if (!context) {
      context = this.createContext(userId, sessionId);
      this.contexts.set(key, context);
    }

    // Update last activity
    context.lastActivity = new Date();
    
    return context;
  }

  /**
   * Create new session context
   */
  private createContext(userId: number, sessionId: string): SessionContext {
    return {
      userId,
      sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      currentProject: undefined,
      currentWorkers: [],
      recentDates: [],
      recentEntities: new Map(),
      conversationTurns: 0
    };
  }

  /**
   * Update context with new information
   */
  updateContext(userId: number, sessionId: string, update: ContextUpdate): void {
    const context = this.getContext(userId, sessionId);
    
    switch (update.type) {
      case 'project':
        this.updateProjectContext(context, update.data);
        break;
      case 'worker':
        this.updateWorkerContext(context, update.data);
        break;
      case 'date':
        this.updateDateContext(context, update.data);
        break;
      case 'entity':
        this.updateEntityContext(context, update.data);
        break;
    }

    context.lastActivity = new Date();
  }

  /**
   * Update project context
   */
  private updateProjectContext(context: SessionContext, projectData: any): void {
    context.currentProject = {
      id: projectData.id,
      name: projectData.name,
      since: new Date()
    };
    
    // Store in entities as well
    context.recentEntities.set('current_project', projectData);
  }

  /**
   * Update worker context
   */
  private updateWorkerContext(context: SessionContext, workerData: any): void {
    // Add to current workers
    const workerEntry = {
      id: workerData.id,
      name: workerData.name,
      mentionedAt: new Date()
    };

    // Check if worker already in context
    const existingIndex = context.currentWorkers.findIndex(w => w.id === workerData.id);
    if (existingIndex >= 0) {
      context.currentWorkers[existingIndex] = workerEntry;
    } else {
      context.currentWorkers.push(workerEntry);
    }

    // Limit to max workers
    if (context.currentWorkers.length > this.maxWorkersInContext) {
      context.currentWorkers.shift();
    }

    // Store in entities
    context.recentEntities.set(`worker_${workerData.id}`, workerData);
  }

  /**
   * Update date context
   */
  private updateDateContext(context: SessionContext, dateData: any): void {
    const dateEntry = {
      date: dateData.date,
      mentionedAt: new Date()
    };

    // Check if date already in context
    const existingIndex = context.recentDates.findIndex(d => d.date === dateData.date);
    if (existingIndex >= 0) {
      context.recentDates[existingIndex] = dateEntry;
    } else {
      context.recentDates.push(dateEntry);
    }

    // Limit to max dates
    if (context.recentDates.length > this.maxDatesInContext) {
      context.recentDates.shift();
    }

    // Store in entities
    context.recentEntities.set('current_date', dateData);
  }

  /**
   * Update entity context
   */
  private updateEntityContext(context: SessionContext, entityData: any): void {
    const key = entityData.type || 'entity';
    context.recentEntities.set(key, entityData);
  }

  /**
   * Increment conversation turn counter
   */
  incrementTurn(userId: number, sessionId: string): void {
    const context = this.getContext(userId, sessionId);
    context.conversationTurns++;
    
    // Clean up old context if too many turns
    if (context.conversationTurns > this.maxConversationTurns) {
      this.cleanupOldContext(context);
    }
  }

  /**
   * Clean up old context entries
   */
  private cleanupOldContext(context: SessionContext): void {
    // Remove oldest workers
    if (context.currentWorkers.length > this.maxWorkersInContext) {
      context.currentWorkers = context.currentWorkers.slice(-this.maxWorkersInContext);
    }

    // Remove oldest dates
    if (context.recentDates.length > this.maxDatesInContext) {
      context.recentDates = context.recentDates.slice(-this.maxDatesInContext);
    }

    // Reset conversation turns
    context.conversationTurns = 0;
  }

  /**
   * Get current project
   */
  getCurrentProject(userId: number, sessionId: string): any | undefined {
    const context = this.getContext(userId, sessionId);
    return context.currentProject;
  }

  /**
   * Get recent workers
   */
  getRecentWorkers(userId: number, sessionId: string): Array<{ id: number; name: string }> {
    const context = this.getContext(userId, sessionId);
    return context.currentWorkers.map(w => ({ id: w.id, name: w.name }));
  }

  /**
   * Get recent dates
   */
  getRecentDates(userId: number, sessionId: string): string[] {
    const context = this.getContext(userId, sessionId);
    return context.recentDates.map(d => d.date);
  }

  /**
   * Get entity by key
   */
  getEntity(userId: number, sessionId: string, key: string): any | undefined {
    const context = this.getContext(userId, sessionId);
    return context.recentEntities.get(key);
  }

  /**
   * Get all entities
   */
  getAllEntities(userId: number, sessionId: string): Map<string, any> {
    const context = this.getContext(userId, sessionId);
    return new Map(context.recentEntities);
  }

  /**
   * Resolve pronoun reference (usko, usme, etc.)
   */
  resolvePronoun(
    userId: number,
    sessionId: string,
    pronoun: string
  ): any | undefined {
    const context = this.getContext(userId, sessionId);

    // Simple heuristic: refer to most recent project or worker
    if (pronoun.includes('project') || pronoun.includes('site')) {
      return context.currentProject;
    }

    if (pronoun.includes('worker') || pronoun.includes('labour')) {
      const lastWorker = context.currentWorkers[context.currentWorkers.length - 1];
      return lastWorker;
    }

    // Default to current project
    return context.currentProject;
  }

  /**
   * Check if context is expired
   */
  isContextExpired(userId: number, sessionId: string): boolean {
    const context = this.getContext(userId, sessionId);
    const age = Date.now() - context.lastActivity.getTime();
    return age > this.maxSessionDuration;
  }

  /**
   * Clear session context
   */
  clearContext(userId: number, sessionId: string): void {
    const key = `${userId}:${sessionId}`;
    this.contexts.delete(key);
  }

  /**
   * Clear all expired contexts
   */
  clearExpiredContexts(): void {
    const now = Date.now();
    
    for (const [key, context] of this.contexts.entries()) {
      const age = now - context.lastActivity.getTime();
      if (age > this.maxSessionDuration) {
        this.contexts.delete(key);
      }
    }

    console.log('[Context Manager] Cleared expired contexts');
  }

  /**
   * Get context as string for AI prompt
   */
  getContextString(userId: number, sessionId: string): string {
    const context = this.getContext(userId, sessionId);
    
    const parts: string[] = [];
    
    if (context.currentProject) {
      parts.push(`Current project: ${context.currentProject.name}`);
    }

    if (context.currentWorkers.length > 0) {
      const workerNames = context.currentWorkers.map(w => w.name).join(', ');
      parts.push(`Recent workers: ${workerNames}`);
    }

    if (context.recentDates.length > 0) {
      const dates = context.recentDates.map(d => d.date).join(', ');
      parts.push(`Recent dates: ${dates}`);
    }

    return parts.length > 0 ? parts.join('. ') : 'No context available.';
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const context of this.contexts.values()) {
      const age = now - context.lastActivity.getTime();
      if (age > this.maxSessionDuration) {
        expiredSessions++;
      } else {
        activeSessions++;
      }
    }

    return {
      totalSessions: this.contexts.size,
      activeSessions,
      expiredSessions
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    maxSessionDuration?: number;
    maxConversationTurns?: number;
    maxWorkersInContext?: number;
    maxDatesInContext?: number;
  }): void {
    if (config.maxSessionDuration) this.maxSessionDuration = config.maxSessionDuration;
    if (config.maxConversationTurns) this.maxConversationTurns = config.maxConversationTurns;
    if (config.maxWorkersInContext) this.maxWorkersInContext = config.maxWorkersInContext;
    if (config.maxDatesInContext) this.maxDatesInContext = config.maxDatesInContext;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      maxSessionDuration: this.maxSessionDuration,
      maxConversationTurns: this.maxConversationTurns,
      maxWorkersInContext: this.maxWorkersInContext,
      maxDatesInContext: this.maxDatesInContext
    };
  }
}

// Singleton instance
export const contextManager = new ContextManager();

// Periodic cleanup
setInterval(() => {
  contextManager.clearExpiredContexts();
}, 5 * 60 * 1000); // Every 5 minutes
