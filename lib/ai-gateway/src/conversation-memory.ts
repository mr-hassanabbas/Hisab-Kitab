// Conversation Memory for Version 1
// Manages multi-turn dialogue with context retention and reference resolution

export interface ConversationTurn {
  turnId: string;
  timestamp: Date;
  userMessage: string;
  aiResponse: string;
  intent: string;
  entities: Map<string, any>;
  resolvedReferences: Map<string, any>;
}

export interface ConversationMemory {
  userId: number;
  sessionId: string;
  turns: ConversationTurn[];
  maxTurns: number;
  createdAt: Date;
  lastUpdated: Date;
}

export interface MemorySummary {
  summary: string;
  keyEntities: Map<string, any>;
  lastTurnId: string;
}

export class ConversationMemoryManager {
  private memories: Map<string, ConversationMemory>;
  private maxTurns: number = 10;
  private maxMemoryAge: number = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.memories = new Map();
  }

  /**
   * Get or create conversation memory
   */
  getMemory(userId: number, sessionId: string): ConversationMemory {
    const key = `${userId}:${sessionId}`;
    
    let memory = this.memories.get(key);
    
    if (!memory) {
      memory = this.createMemory(userId, sessionId);
      this.memories.set(key, memory);
    }

    return memory;
  }

  /**
   * Create new conversation memory
   */
  private createMemory(userId: number, sessionId: string): ConversationMemory {
    return {
      userId,
      sessionId,
      turns: [],
      maxTurns: this.maxTurns,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Add conversation turn
   */
  addTurn(
    userId: number,
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    intent: string,
    entities: Map<string, any>,
    resolvedReferences: Map<string, any>
  ): void {
    const memory = this.getMemory(userId, sessionId);
    
    const turn: ConversationTurn = {
      turnId: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userMessage,
      aiResponse,
      intent,
      entities: new Map(entities),
      resolvedReferences: new Map(resolvedReferences)
    };

    memory.turns.push(turn);
    memory.lastUpdated = new Date();

    // Limit turns
    if (memory.turns.length > memory.maxTurns) {
      memory.turns.shift();
    }
  }

  /**
   * Get recent turns
   */
  getRecentTurns(userId: number, sessionId: string, count: number = 5): ConversationTurn[] {
    const memory = this.getMemory(userId, sessionId);
    return memory.turns.slice(-count);
  }

  /**
   * Get all turns
   */
  getAllTurns(userId: number, sessionId: string): ConversationTurn[] {
    const memory = this.getMemory(userId, sessionId);
    return [...memory.turns];
  }

  /**
   * Resolve pronoun reference (he, she, it, usko, usme, etc.)
   */
  resolveReference(
    userId: number,
    sessionId: string,
    pronoun: string
  ): any | undefined {
    const memory = this.getMemory(userId, sessionId);
    
    // Look at recent turns for entities
    for (let i = memory.turns.length - 1; i >= 0; i--) {
      const turn = memory.turns[i];
      
      // Check resolved references
      for (const [key, value] of turn.resolvedReferences.entries()) {
        if (this.matchesPronoun(key, pronoun)) {
          return value;
        }
      }

      // Check entities
      for (const [key, value] of turn.entities.entries()) {
        if (this.matchesPronoun(key, pronoun)) {
          return value;
        }
      }
    }

    return undefined;
  }

  /**
   * Check if key matches pronoun
   */
  private matchesPronoun(key: string, pronoun: string): boolean {
    const pronounMap: Record<string, string[]> = {
      'project': ['it', 'usme', 'isme', 'wo'],
      'worker': ['he', 'she', 'usko', 'uska', 'wo'],
      'payment': ['it', 'wo'],
      'expense': ['it', 'wo']
    };

    const lowerKey = key.toLowerCase();
    const lowerPronoun = pronoun.toLowerCase();

    for (const [type, variants] of Object.entries(pronounMap)) {
      if (lowerKey.includes(type) && variants.includes(lowerPronoun)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get conversation context for AI prompt
   */
  getConversationContext(userId: number, sessionId: string): string {
    const memory = this.getMemory(userId, sessionId);
    
    if (memory.turns.length === 0) {
      return 'No conversation history.';
    }

    const recentTurns = memory.turns.slice(-3);
    const contextParts: string[] = [];

    for (const turn of recentTurns) {
      contextParts.push(`User: ${turn.userMessage}`);
      contextParts.push(`AI: ${turn.aiResponse}`);
    }

    return contextParts.join('\n');
  }

  /**
   * Generate conversation summary
   */
  generateSummary(userId: number, sessionId: string): MemorySummary {
    const memory = this.getMemory(userId, sessionId);
    
    if (memory.turns.length === 0) {
      return {
        summary: 'No conversation to summarize.',
        keyEntities: new Map(),
        lastTurnId: ''
      };
    }

    // Extract key entities from all turns
    const keyEntities = new Map<string, any>();
    
    for (const turn of memory.turns) {
      for (const [key, value] of turn.entities.entries()) {
        if (!keyEntities.has(key)) {
          keyEntities.set(key, value);
        }
      }
    }

    // Generate simple summary
    const intents = memory.turns.map(t => t.intent);
    const uniqueIntents = [...new Set(intents)];
    
    const summary = `Conversation with ${memory.turns.length} turns. Topics discussed: ${uniqueIntents.join(', ')}.`;

    return {
      summary,
      keyEntities,
      lastTurnId: memory.turns[memory.turns.length - 1].turnId
    };
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(userId: number, sessionId: string): {
    totalTurns: number;
    memoryAge: number;
    lastActivity: Date;
    topIntents: Array<{ intent: string; count: number }>;
  } {
    const memory = this.getMemory(userId, sessionId);
    
    const intentCounts = new Map<string, number>();
    for (const turn of memory.turns) {
      intentCounts.set(turn.intent, (intentCounts.get(turn.intent) || 0) + 1);
    }

    const topIntents = Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalTurns: memory.turns.length,
      memoryAge: Date.now() - memory.createdAt.getTime(),
      lastActivity: memory.lastUpdated,
      topIntents
    };
  }

  /**
   * Clear conversation memory
   */
  clearMemory(userId: number, sessionId: string): void {
    const key = `${userId}:${sessionId}`;
    this.memories.delete(key);
  }

  /**
   * Clear old memories
   */
  clearOldMemories(): void {
    const now = Date.now();
    
    for (const [key, memory] of this.memories.entries()) {
      const age = now - memory.lastUpdated.getTime();
      if (age > this.maxMemoryAge) {
        this.memories.delete(key);
      }
    }

    console.log('[Conversation Memory] Cleared old memories');
  }

  /**
   * Summarize and compress old turns
   */
  compressMemory(userId: number, sessionId: string): void {
    const memory = this.getMemory(userId, sessionId);
    
    if (memory.turns.length <= this.maxTurns / 2) {
      return; // No need to compress
    }

    // Keep only recent turns
    const recentTurns = memory.turns.slice(-Math.floor(this.maxTurns / 2));
    memory.turns = recentTurns;
    
    console.log('[Conversation Memory] Compressed memory for session:', sessionId);
  }

  /**
   * Export memory
   */
  exportMemory(userId: number, sessionId: string): string {
    const memory = this.getMemory(userId, sessionId);
    return JSON.stringify(memory, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2);
  }

  /**
   * Import memory
   */
  importMemory(data: string): void {
    try {
      const memory = JSON.parse(data) as ConversationMemory;
      
      // Convert objects back to Maps
      memory.turns = memory.turns.map(turn => ({
        ...turn,
        entities: new Map(Object.entries(turn.entities as any)),
        resolvedReferences: new Map(Object.entries(turn.resolvedReferences as any))
      }));

      const key = `${memory.userId}:${memory.sessionId}`;
      this.memories.set(key, memory);
      
      console.log('[Conversation Memory] Imported memory for session:', memory.sessionId);
    } catch (error) {
      console.error('[Conversation Memory] Failed to import memory:', error);
    }
  }

  /**
   * Get all memories
   */
  getAllMemories(): ConversationMemory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalMemories: number;
    totalTurns: number;
    activeMemories: number;
    averageTurnsPerMemory: number;
  } {
    const memories = Array.from(this.memories.values());
    const totalTurns = memories.reduce((sum, m) => sum + m.turns.length, 0);
    const now = Date.now();
    const activeMemories = memories.filter(m => 
      now - m.lastUpdated.getTime() < this.maxMemoryAge
    ).length;

    return {
      totalMemories: memories.length,
      totalTurns,
      activeMemories,
      averageTurnsPerMemory: memories.length > 0 ? totalTurns / memories.length : 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    maxTurns?: number;
    maxMemoryAge?: number;
  }): void {
    if (config.maxTurns) this.maxTurns = config.maxTurns;
    if (config.maxMemoryAge) this.maxMemoryAge = config.maxMemoryAge;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      maxTurns: this.maxTurns,
      maxMemoryAge: this.maxMemoryAge
    };
  }
}

// Singleton instance
export const conversationMemoryManager = new ConversationMemoryManager();

// Periodic cleanup
setInterval(() => {
  conversationMemoryManager.clearOldMemories();
}, 10 * 60 * 1000); // Every 10 minutes
