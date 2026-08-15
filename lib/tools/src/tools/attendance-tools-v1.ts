// Version 1 Attendance Tools - Expanded operations
import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { WorkerRepository } from "@workspace/database";
import { ProjectRepository } from "@workspace/database";
import { AttendanceRepository } from "@workspace/database";

/**
 * Update attendance tool (Version 1)
 */
export const updateAttendanceTool: ToolDefinition = {
  name: "update_attendance",
  description: "Update existing attendance record",
  parameters: {
    attendance_id: {
      type: "number",
      required: true,
      description: "ID of the attendance record to update"
    },
    status: {
      type: "enum",
      required: false,
      description: "New attendance status",
      values: ["present", "absent", "half_day"]
    },
    advance_given: {
      type: "number",
      required: false,
      description: "New advance amount"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["attendance:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { attendance_id, status, advance_given } = params;
      
      const attendanceRepo = new AttendanceRepository();
      
      // Check if attendance exists
      const existingAttendance = await attendanceRepo.findById(attendance_id as number);
      if (!existingAttendance) {
        return { success: false, error: `Attendance record ${attendance_id} not found` };
      }

      // Update attendance
      const updateData: any = {};
      if (status) updateData.status = status;
      if (advance_given !== undefined) updateData.advance_given = advance_given;

      await attendanceRepo.updateAttendance(attendance_id as number, updateData);
      
      return {
        success: true,
        data: {
          message: `Updated attendance record ${attendance_id}`,
          attendance_id,
          ...updateData
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update attendance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Delete attendance tool (Version 1)
 */
export const deleteAttendanceTool: ToolDefinition = {
  name: "delete_attendance",
  description: "Delete attendance record",
  parameters: {
    attendance_id: {
      type: "number",
      required: true,
      description: "ID of the attendance record to delete"
    }
  } as ToolParameters,
  riskLevel: "high" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["attendance:delete"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { attendance_id } = params;
      
      const attendanceRepo = new AttendanceRepository();
      
      // Check if attendance exists
      const existingAttendance = await attendanceRepo.findById(attendance_id as number);
      if (!existingAttendance) {
        return { success: false, error: `Attendance record ${attendance_id} not found` };
      }

      // Delete attendance
      await attendanceRepo.deleteAttendance(attendance_id as number);
      
      return {
        success: true,
        data: {
          message: `Deleted attendance record ${attendance_id}`,
          attendance_id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete attendance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Bulk mark attendance tool (Version 1)
 */
export const bulkMarkAttendanceTool: ToolDefinition = {
  name: "bulk_mark_attendance",
  description: "Mark attendance for multiple workers at once",
  parameters: {
    worker_names: {
      type: "array",
      required: true,
      description: "Array of worker names"
    },
    project_name: {
      type: "string",
      required: true,
      description: "Project name"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format"
    },
    status: {
      type: "enum",
      required: true,
      description: "Attendance status for all workers",
      values: ["present", "absent", "half_day"]
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["attendance:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_names, project_name, date, status } = params;
      
      const workerRepo = new WorkerRepository();
      const projectRepo = new ProjectRepository();
      const attendanceRepo = new AttendanceRepository();

      // Resolve project
      const projectResolution = await projectRepo.resolveProject(project_name as string);
      if (projectResolution.type === 'not_found') {
        return { success: false, error: `Project "${project_name}" not found` };
      }

      const project = projectResolution.project;
      if (!project) {
        return { success: false, error: "Failed to resolve project" };
      }

      const attendanceDate = date as string || new Date().toISOString().split('T')[0];
      const results: Array<{ worker_name: string; success: boolean; message: string }> = [];

      // Mark attendance for each worker
      for (const workerName of worker_names as string[]) {
        const workerResolution = await workerRepo.resolveWorker(workerName);
        
        if (workerResolution.type === 'not_found') {
          results.push({
            worker_name: workerName,
            success: false,
            message: `Worker "${workerName}" not found`
          });
          continue;
        }

        const worker = workerResolution.worker;
        if (!worker) {
          results.push({
            worker_name: workerName,
            success: false,
            message: `Failed to resolve worker "${workerName}"`
          });
          continue;
        }

        // Check if attendance already exists
        const existingAttendance = await attendanceRepo.findAttendance(project.id, worker.id, attendanceDate);
        
        if (existingAttendance) {
          await attendanceRepo.updateAttendance(existingAttendance.id, { status });
        } else {
          await attendanceRepo.markAttendance({
            project_id: project.id,
            labour_id: worker.id,
            date: attendanceDate,
            status,
            advance_given: 0,
            wage_for_day: worker.daily_wage || 0
          });
        }

        results.push({
          worker_name: workerName,
          success: true,
          message: `Marked ${worker.name} as ${status}`
        });
      }

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: true,
        data: {
          message: `Marked attendance for ${successCount}/${results.length} workers`,
          project_name: project.name,
          date: attendanceDate,
          status,
          results
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to bulk mark attendance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Attendance summary tool (Version 1)
 */
export const attendanceSummaryTool: ToolDefinition = {
  name: "attendance_summary",
  description: "Get attendance summary for a date range",
  parameters: {
    project_name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    start_date: {
      type: "string",
      required: true,
      description: "Start date in YYYY-MM-DD format"
    },
    end_date: {
      type: "string",
      required: true,
      description: "End date in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["attendance:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name, start_date, end_date } = params;
      
      const attendanceRepo = new AttendanceRepository();
      let summary;

      if (project_name) {
        const projectRepo = new ProjectRepository();
        const projectResolution = await projectRepo.resolveProject(project_name as string);
        
        if (projectResolution.type === 'not_found') {
          return { success: false, error: `Project "${project_name}" not found` };
        }

        if (projectResolution.project) {
          summary = await attendanceRepo.getProjectAttendance(projectResolution.project.id, {
            startDate: start_date as string,
            endDate: end_date as string
          });
        }
      } else {
        summary = await attendanceRepo.getAttendanceByDateRange(start_date as string, end_date as string);
      }

      // Calculate summary statistics
      const attendanceList = summary?.attendance || [];
      const totalRecords = attendanceList.length;
      const presentCount = attendanceList.filter((a: any) => a.status === 'present').length;
      const absentCount = attendanceList.filter((a: any) => a.status === 'absent').length;
      const halfDayCount = attendanceList.filter((a: any) => a.status === 'half_day').length;

      return {
        success: true,
        data: {
          message: "Attendance summary generated",
          project_name: project_name || 'All projects',
          date_range: `${start_date} to ${end_date}`,
          summary: {
            total_records: totalRecords,
            present: presentCount,
            absent: absentCount,
            half_day: halfDayCount,
            attendance_rate: totalRecords > 0 ? (presentCount / totalRecords * 100).toFixed(1) + '%' : '0%'
          },
          records: attendanceList
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get attendance summary: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

// Version 1 Attendance Tools Registry
export const attendanceToolsV1 = {
  update_attendance: updateAttendanceTool,
  delete_attendance: deleteAttendanceTool,
  bulk_mark_attendance: bulkMarkAttendanceTool,
  attendance_summary: attendanceSummaryTool
};
