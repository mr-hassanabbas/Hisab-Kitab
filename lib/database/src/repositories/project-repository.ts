import { eq, ilike, and } from "drizzle-orm";
import { projectsTable } from "@workspace/db/schema";
import type { Project } from "@workspace/db/schema";
import { db } from "@workspace/db";

export interface ProjectSearchParams {
  name?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectResolution {
  type: 'exact' | 'fuzzy' | 'ambiguous' | 'not_found';
  project?: Project;
  candidates?: Project[];
  question?: string;
}

export class ProjectRepository {
  /**
   * Find project by exact name match
   */
  async findByName(name: string): Promise<Project | null> {
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.name, name))
      .limit(1);
    
    return projects[0] || null;
  }

  /**
   * Find project by code
   */
  async findByCode(code: string): Promise<Project | null> {
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.project_code, code))
      .limit(1);
    
    return projects[0] || null;
  }

  /**
   * Find projects with fuzzy name matching
   */
  async findFuzzyByName(name: string, limit: number = 5): Promise<Project[]> {
    return await db
      .select()
      .from(projectsTable)
      .where(ilike(projectsTable.name, `%${name}%`))
      .orderBy(projectsTable.name)
      .limit(limit);
  }

  /**
   * Resolve project by name with disambiguation
   */
  async resolveProject(name: string): Promise<ProjectResolution> {
    // Try exact match first
    const exact = await this.findByName(name);
    if (exact) {
      return { type: 'exact', project: exact };
    }

    // Try fuzzy match
    const fuzzy = await this.findFuzzyByName(name);
    if (fuzzy.length === 1) {
      return { type: 'fuzzy', project: fuzzy[0] };
    }

    if (fuzzy.length > 1) {
      return {
        type: 'ambiguous',
        candidates: fuzzy,
        question: `I found ${fuzzy.length} projects named "${name}". Which one do you mean?`
      };
    }

    // No match found
    return {
      type: 'not_found',
      question: `Project "${name}" not found. Would you like to create a new project?`
    };
  }

  /**
   * Search projects with filters
   */
  async searchProjects(params: ProjectSearchParams): Promise<{ projects: Project[]; total: number }> {
    let whereClause;
    
    if (params.name) {
      whereClause = ilike(projectsTable.name, `%${params.name}%`);
    }
    
    if (params.status) {
      whereClause = whereClause 
        ? and(whereClause, eq(projectsTable.status, params.status))
        : eq(projectsTable.status, params.status);
    }

    const projects = await db
      .select()
      .from(projectsTable)
      .where(whereClause)
      .orderBy(projectsTable.name)
      .limit(params.limit || 50)
      .offset(params.offset || 0);

    // Get total count
    const countResult = await db
      .select({ count: projectsTable.id })
      .from(projectsTable)
      .where(whereClause);
    
    const total = countResult.length;

    return { projects, total };
  }

  /**
   * Get project by ID
   */
  async findById(id: number): Promise<Project | null> {
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);
    
    return projects[0] || null;
  }

  /**
   * Create new project
   */
  async create(projectData: Omit<typeof projectsTable.$inferInsert, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const projects = await db
      .insert(projectsTable)
      .values(projectData)
      .returning();
    
    return projects[0];
  }

  /**
   * Update project
   */
  async update(id: number, updates: Partial<typeof projectsTable.$inferInsert>): Promise<Project | null> {
    const projects = await db
      .update(projectsTable)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(eq(projectsTable.id, id))
      .returning();
    
    return projects[0] || null;
  }

  /**
   * Check if project is active
   */
  async isActive(id: number): Promise<boolean> {
    const projects = await db
      .select({ status: projectsTable.status })
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);
    
    return projects[0]?.status === 'running';
  }
}