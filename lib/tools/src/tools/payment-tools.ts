import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { WorkerRepository } from "@workspace/database";
import { ProjectRepository } from "@workspace/database";
import { AttendanceRepository } from "@workspace/database";

/**
 * Calculate payment tool
 */
export const calculatePaymentTool: ToolDefinition = {
  name: "calculate_payment",
  description: "Calculate worker payment for a specific period",
  parameters: {
    worker_name: {
      type: "string",
      required: true,
      description: "Name of the worker"
    },
    project_name: {
      type: "string",
      required: true,
      description: "Name of the project"
    },
    week_start: {
      type: "string",
      required: false,
      description: "Week start date in YYYY-MM-DD format"
    },
    week_end: {
      type: "string",
      required: false,
      description: "Week end date in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["payments:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, week_start, week_end } = params;
      
      // Validate parameters
      if (!worker_name || typeof worker_name !== 'string') {
        return { success: false, error: "Invalid worker name" };
      }
      if (!project_name || typeof project_name !== 'string') {
        return { success: false, error: "Invalid project name" };
      }

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

      // Calculate payment based on attendance
      const summary = await attendanceRepo.getWorkerSummary(
        worker.id,
        week_start as string,
        week_end as string
      );
      
      return {
        success: true,
        data: {
          message: `Calculated payment for ${worker.name} on ${project.name}`,
          payment: {
            worker_name: worker.name,
            project_name: project.name,
            week_start,
            week_end,
            days_worked: summary.totalDays,
            total_earned: summary.totalEarned,
            advance_deductions: 0,
            net_payment: summary.totalEarned
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to calculate payment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};