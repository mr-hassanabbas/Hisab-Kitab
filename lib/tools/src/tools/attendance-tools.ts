import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { WorkerRepository } from "@workspace/database";
import { ProjectRepository } from "@workspace/database";
import { AttendanceRepository } from "@workspace/database";

/**
 * Mark attendance tool
 */
export const markAttendanceTool: ToolDefinition = {
  name: "mark_attendance",
  description: "Mark worker attendance for a specific date and project",
  parameters: {
    worker_name: {
      type: "string",
      required: true,
      description: "Name of the worker to mark attendance for"
    },
    project_name: {
      type: "string",
      required: true,
      description: "Name of the project"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format (defaults to today)",
      default: new Date().toISOString().split('T')[0]
    },
    status: {
      type: "enum",
      required: true,
      description: "Attendance status",
      values: ["present", "absent", "half_day"]
    },
    advance_given: {
      type: "number",
      required: false,
      description: "Advance amount given to worker",
      default: 0
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["attendance:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, date, status, advance_given } = params;
      
      // Validate parameters
      if (!worker_name || typeof worker_name !== 'string') {
        return { success: false, error: "Invalid worker name" };
      }
      if (!project_name || typeof project_name !== 'string') {
        return { success: false, error: "Invalid project name" };
      }
      if (!status || typeof status !== 'string' || !['present', 'absent', 'half_day'].includes(status)) {
        return { success: false, error: "Invalid status" };
      }

      // Initialize repositories
      const workerRepo = new WorkerRepository();
      const projectRepo = new ProjectRepository();
      const attendanceRepo = new AttendanceRepository();

      // Resolve worker
      const workerResolution = await workerRepo.resolveWorker(worker_name);
      if (workerResolution.type === 'not_found') {
        return { success: false, error: `Worker "${worker_name}" not found` };
      }
      if (workerResolution.type === 'ambiguous') {
        return { 
          success: false, 
          requiresConfirmation: true,
          confirmationMessage: workerResolution.question,
          error: workerResolution.question
        };
      }

      const worker = workerResolution.worker;
      if (!worker) {
        return { success: false, error: "Failed to resolve worker" };
      }

      // Resolve project
      const projectResolution = await projectRepo.resolveProject(project_name);
      if (projectResolution.type === 'not_found') {
        return { success: false, error: `Project "${project_name}" not found` };
      }
      if (projectResolution.type === 'ambiguous') {
        return { 
          success: false, 
          requiresConfirmation: true,
          confirmationMessage: projectResolution.question,
          error: projectResolution.question
        };
      }

      const project = projectResolution.project;
      if (!project) {
        return { success: false, error: "Failed to resolve project" };
      }

      // Check if attendance already exists
      const attendanceDate = date as string || new Date().toISOString().split('T')[0];
      const existingAttendance = await attendanceRepo.findAttendance(project.id, worker.id, attendanceDate);
      
      if (existingAttendance) {
        // Update existing attendance
        await attendanceRepo.updateAttendance(existingAttendance.id, {
          status,
          advance_given: advance_given as number || 0
        });
      } else {
        // Create new attendance
        await attendanceRepo.markAttendance({
          project_id: project.id,
          labour_id: worker.id,
          date: attendanceDate,
          status,
          advance_given: advance_given as number || 0,
          wage_for_day: worker.daily_wage || 0
        });
      }
      
      return {
        success: true,
        data: {
          message: `Marked ${worker.name} as ${status} for ${project.name} on ${attendanceDate}`,
          worker_name: worker.name,
          project_name: project.name,
          date: attendanceDate,
          status,
          advance_given: advance_given || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to mark attendance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Get attendance tool
 */
export const getAttendanceTool: ToolDefinition = {
  name: "get_attendance",
  description: "Get attendance records for workers",
  parameters: {
    worker_name: {
      type: "string",
      required: false,
      description: "Name of the worker (optional)"
    },
    project_name: {
      type: "string",
      required: false,
      description: "Name of the project (optional)"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format (optional)"
    },
    start_date: {
      type: "string",
      required: false,
      description: "Start date for range query in YYYY-MM-DD format"
    },
    end_date: {
      type: "string",
      required: false,
      description: "End date for range query in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["attendance:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, date, start_date, end_date } = params;
      
      const attendanceRepo = new AttendanceRepository();
      let attendanceResult;
      
      if (worker_name) {
        // Get attendance for specific worker
        const workerRepo = new WorkerRepository();
        const workerResolution = await workerRepo.resolveWorker(worker_name as string);
        
        if (workerResolution.type === 'not_found') {
          return { success: false, error: `Worker "${worker_name}" not found` };
        }
        
        if (workerResolution.worker) {
          attendanceResult = await attendanceRepo.getWorkerAttendance(workerResolution.worker.id, {
            date: date as string,
            startDate: start_date as string,
            endDate: end_date as string
          });
        }
      } else if (project_name) {
        // Get attendance for specific project
        const projectRepo = new ProjectRepository();
        const projectResolution = await projectRepo.resolveProject(project_name as string);
        
        if (projectResolution.type === 'not_found') {
          return { success: false, error: `Project "${project_name}" not found` };
        }
        
        if (projectResolution.project) {
          attendanceResult = await attendanceRepo.getProjectAttendance(projectResolution.project.id, {
            date: date as string,
            startDate: start_date as string,
            endDate: end_date as string
          });
        }
      } else {
        // Get attendance for specific date
        const records = await attendanceRepo.getAttendanceByDate(date as string);
        attendanceResult = { attendance: records, total: records.length };
      }
      
      return {
        success: true,
        data: {
          message: "Retrieved attendance records",
          filters: { worker_name, project_name, date, start_date, end_date },
          records: attendanceResult?.attendance || []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get attendance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};