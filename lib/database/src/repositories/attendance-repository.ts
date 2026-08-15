import { eq, and, gte, lte, desc } from "drizzle-orm";
import { attendanceTable } from "@workspace/db/schema";
import type { Attendance } from "@workspace/db/schema";
import { db } from "@workspace/db";

export interface AttendanceSearchParams {
  projectId?: number;
  labourId?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class AttendanceRepository {
  /**
   * Find attendance by unique combination
   */
  async findAttendance(projectId: number, labourId: number, date: string): Promise<Attendance | null> {
    const attendance = await db
      .select()
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.project_id, projectId),
        eq(attendanceTable.labour_id, labourId),
        eq(attendanceTable.date, date)
      ))
      .limit(1);
    
    return attendance[0] || null;
  }

  /**
   * Mark attendance for a worker
   */
  async markAttendance(data: Omit<typeof attendanceTable.$inferInsert, 'id' | 'created_at'>): Promise<Attendance> {
    const attendance = await db
      .insert(attendanceTable)
      .values(data)
      .returning();
    
    return attendance[0];
  }

  /**
   * Update attendance
   */
  async updateAttendance(id: number, updates: Partial<typeof attendanceTable.$inferInsert>): Promise<Attendance | null> {
    const attendance = await db
      .update(attendanceTable)
      .set(updates)
      .where(eq(attendanceTable.id, id))
      .returning();
    
    return attendance[0] || null;
  }

  /**
   * Soft delete attendance
   */
  async softDelete(id: number): Promise<boolean> {
    const result = await db
      .update(attendanceTable)
      .set({ deleted_at: new Date().toISOString() })
      .where(eq(attendanceTable.id, id));
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get attendance for a worker
   */
  async getWorkerAttendance(labourId: number, params: AttendanceSearchParams): Promise<{ attendance: Attendance[]; total: number }> {
    const conditions = [eq(attendanceTable.labour_id, labourId)];
    
    if (params.status) {
      conditions.push(eq(attendanceTable.status, params.status));
    }
    
    if (params.date) {
      conditions.push(eq(attendanceTable.date, params.date));
    }
    
    if (params.startDate && params.endDate) {
      conditions.push(gte(attendanceTable.date, params.startDate), lte(attendanceTable.date, params.endDate));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const attendance = await db
      .select()
      .from(attendanceTable)
      .where(whereClause)
      .orderBy(desc(attendanceTable.date))
      .limit(params.limit || 50)
      .offset(params.offset || 0);

    // Get total count
    const countResult = await db
      .select({ count: attendanceTable.id })
      .from(attendanceTable)
      .where(whereClause);
    
    const total = countResult.length;

    return { attendance, total };
  }

  /**
   * Get attendance for a project
   */
  async getProjectAttendance(projectId: number, params: AttendanceSearchParams): Promise<{ attendance: Attendance[]; total: number }> {
    const conditions = [eq(attendanceTable.project_id, projectId)];
    
    if (params.status) {
      conditions.push(eq(attendanceTable.status, params.status));
    }
    
    if (params.date) {
      conditions.push(eq(attendanceTable.date, params.date));
    }
    
    if (params.startDate && params.endDate) {
      conditions.push(gte(attendanceTable.date, params.startDate), lte(attendanceTable.date, params.endDate));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const attendance = await db
      .select()
      .from(attendanceTable)
      .where(whereClause)
      .orderBy(desc(attendanceTable.date))
      .limit(params.limit || 50)
      .offset(params.offset || 0);

    // Get total count
    const countResult = await db
      .select({ count: attendanceTable.id })
      .from(attendanceTable)
      .where(whereClause);
    
    const total = countResult.length;

    return { attendance, total };
  }

  /**
   * Get attendance summary for a worker
   */
  async getWorkerSummary(labourId: number, startDate?: string, endDate?: string): Promise<{
    totalDays: number;
    presentDays: number;
    halfDays: number;
    absentDays: number;
    totalEarned: number;
  }> {
    const conditions = [eq(attendanceTable.labour_id, labourId)];
    
    if (startDate && endDate) {
      conditions.push(gte(attendanceTable.date, startDate), lte(attendanceTable.date, endDate));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const attendance = await db
      .select()
      .from(attendanceTable)
      .where(whereClause);

    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const halfDays = attendance.filter(a => a.status === 'half_day').length;
    const absentDays = attendance.filter(a => a.status === 'absent').length;
    const totalEarned = attendance.reduce((sum, a) => sum + (a.wage_for_day || 0), 0);

    return {
      totalDays,
      presentDays,
      halfDays,
      absentDays,
      totalEarned
    };
  }

  /**
   * Get attendance for a specific date
   */
  async getAttendanceByDate(date: string, projectId?: number): Promise<Attendance[]> {
    const conditions = [eq(attendanceTable.date, date)];
    
    if (projectId) {
      conditions.push(eq(attendanceTable.project_id, projectId));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    return await db
      .select()
      .from(attendanceTable)
      .where(whereClause);
  }

  /**
   * Check if attendance already exists
   */
  async exists(projectId: number, labourId: number, date: string): Promise<boolean> {
    const attendance = await this.findAttendance(projectId, labourId, date);
    return attendance !== null;
  }
}