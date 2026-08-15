import { eq, ilike, or, and, desc } from "drizzle-orm";
import { labourTable } from "@workspace/db/schema";
import type { Labour } from "@workspace/db/schema";
import { db } from "@workspace/db";

export interface WorkerSearchParams {
  name?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface WorkerResolution {
  type: 'exact' | 'nickname' | 'fuzzy' | 'ambiguous' | 'not_found';
  worker?: Labour;
  candidates?: Labour[];
  question?: string;
}

export class WorkerRepository {
  /**
   * Find worker by exact name match
   */
  async findByName(name: string): Promise<Labour | null> {
    const workers = await db
      .select()
      .from(labourTable)
      .where(and(
        eq(labourTable.name, name),
        eq(labourTable.is_active, 1)
      ))
      .limit(1);
    
    return workers[0] || null;
  }

  /**
   * Find worker by nickname
   */
  async findByNickname(nickname: string): Promise<Labour | null> {
    const workers = await db
      .select()
      .from(labourTable)
      .where(and(
        ilike(labourTable.nicknames, `%${nickname}%`),
        eq(labourTable.is_active, 1)
      ))
      .limit(1);
    
    return workers[0] || null;
  }

  /**
   * Find workers with fuzzy name matching
   */
  async findFuzzyByName(name: string, limit: number = 5): Promise<Labour[]> {
    return await db
      .select()
      .from(labourTable)
      .where(and(
        or(
          ilike(labourTable.name, `%${name}%`),
          ilike(labourTable.nicknames, `%${name}%`)
        ),
        eq(labourTable.is_active, 1)
      ))
      .orderBy(labourTable.name)
      .limit(limit);
  }

  /**
   * Resolve worker by name with disambiguation
   */
  async resolveWorker(name: string): Promise<WorkerResolution> {
    // Try exact match first
    const exact = await this.findByName(name);
    if (exact) {
      return { type: 'exact', worker: exact };
    }

    // Try nickname match
    const nickname = await this.findByNickname(name);
    if (nickname) {
      return { type: 'nickname', worker: nickname };
    }

    // Try fuzzy match
    const fuzzy = await this.findFuzzyByName(name);
    if (fuzzy.length === 1) {
      return { type: 'fuzzy', worker: fuzzy[0] };
    }

    if (fuzzy.length > 1) {
      return {
        type: 'ambiguous',
        candidates: fuzzy,
        question: `I found ${fuzzy.length} workers named "${name}". Which one do you mean?`
      };
    }

    // No match found
    return {
      type: 'not_found',
      question: `Worker "${name}" not found. Would you like to create a new worker?`
    };
  }

  /**
   * Search workers with filters
   */
  async searchWorkers(params: WorkerSearchParams): Promise<{ workers: Labour[]; total: number }> {
    let whereClause = and(eq(labourTable.is_active, 1));
    
    if (params.name) {
      whereClause = and(
        whereClause,
        or(
          ilike(labourTable.name, `%${params.name}%`),
          ilike(labourTable.nicknames, `%${params.name}%`)
        )
      );
    }

    const workers = await db
      .select()
      .from(labourTable)
      .where(whereClause)
      .orderBy(labourTable.name)
      .limit(params.limit || 50)
      .offset(params.offset || 0);

    // Get total count
    const countResult = await db
      .select({ count: labourTable.id })
      .from(labourTable)
      .where(whereClause);
    
    const total = countResult.length;

    return { workers, total };
  }

  /**
   * Get worker by ID
   */
  async findById(id: number): Promise<Labour | null> {
    const workers = await db
      .select()
      .from(labourTable)
      .where(eq(labourTable.id, id))
      .limit(1);
    
    return workers[0] || null;
  }

  /**
   * Create new worker
   */
  async create(workerData: Omit<typeof labourTable.$inferInsert, 'id' | 'created_at'>): Promise<Labour> {
    const workers = await db
      .insert(labourTable)
      .values(workerData)
      .returning();
    
    return workers[0];
  }

  /**
   * Update worker
   */
  async update(id: number, updates: Partial<typeof labourTable.$inferInsert>): Promise<Labour | null> {
    const workers = await db
      .update(labourTable)
      .set(updates)
      .where(eq(labourTable.id, id))
      .returning();
    
    return workers[0] || null;
  }

  /**
   * Check if worker is active
   */
  async isActive(id: number): Promise<boolean> {
    const workers = await db
      .select({ is_active: labourTable.is_active })
      .from(labourTable)
      .where(eq(labourTable.id, id))
      .limit(1);
    
    return workers[0]?.is_active === 1;
  }
}