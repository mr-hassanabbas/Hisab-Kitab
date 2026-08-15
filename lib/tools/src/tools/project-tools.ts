import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { ProjectRepository } from "@workspace/database";
import { WorkerRepository } from "@workspace/database";
import { projectLabourTable } from "@workspace/db/schema";
import { db } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Create project tool
 */
export const createProjectTool: ToolDefinition = {
  name: "create_project",
  description: "Create a new project",
  parameters: {
    name: {
      type: "string",
      required: true,
      description: "Name of the project"
    },
    project_code: {
      type: "string",
      required: true,
      description: "Unique project code"
    },
    owner_name: {
      type: "string",
      required: true,
      description: "Name of the project owner"
    },
    owner_phone: {
      type: "string",
      required: false,
      description: "Phone number of the owner"
    },
    location: {
      type: "string",
      required: true,
      description: "Project location"
    },
    site_address: {
      type: "string",
      required: false,
      description: "Detailed site address"
    },
    agreement_amount: {
      type: "number",
      required: false,
      description: "Agreement amount"
    },
    start_date: {
      type: "string",
      required: false,
      description: "Start date in YYYY-MM-DD format"
    },
    expected_end: {
      type: "string",
      required: false,
      description: "Expected end date in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "high" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["projects:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, project_code, owner_name, owner_phone, location, site_address, agreement_amount, start_date, expected_end } = params;
      
      // Validate parameters
      if (!name || typeof name !== 'string') {
        return { success: false, error: "Invalid project name" };
      }
      if (!project_code || typeof project_code !== 'string') {
        return { success: false, error: "Invalid project code" };
      }
      if (!owner_name || typeof owner_name !== 'string') {
        return { success: false, error: "Invalid owner name" };
      }
      if (!location || typeof location !== 'string') {
        return { success: false, error: "Invalid location" };
      }

      const projectRepo = new ProjectRepository();
      
      // Check if project code already exists
      const existingProject = await projectRepo.findByCode(project_code as string);
      if (existingProject) {
        return { success: false, error: `Project with code "${project_code}" already exists` };
      }

      // Create project in database
      const newProject = await projectRepo.create({
        name: name as string,
        project_code: project_code as string,
        owner_name: owner_name as string,
        owner_phone: owner_phone as string || null,
        location: location as string,
        site_address: site_address as string || null,
        agreement_amount: agreement_amount as number || null,
        start_date: start_date as string || null,
        expected_end: expected_end as string || null,
        status: 'running'
      });
      
      return {
        success: true,
        data: {
          message: `Created project: ${newProject.name} (${newProject.project_code})`,
          project: newProject
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create project: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Get project info tool
 */
export const getProjectInfoTool: ToolDefinition = {
  name: "get_project_info",
  description: "Get information about a project",
  parameters: {
    project_name: {
      type: "string",
      required: true,
      description: "Name of the project"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["projects:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name } = params;
      
      // Validate parameters
      if (!project_name || typeof project_name !== 'string') {
        return { success: false, error: "Invalid project name" };
      }

      const projectRepo = new ProjectRepository();
      const resolution = await projectRepo.resolveProject(project_name);
      
      if (resolution.type === 'not_found') {
        return { success: false, error: `Project "${project_name}" not found` };
      }
      
      if (resolution.type === 'ambiguous') {
        return { 
          success: false, 
          requiresConfirmation: true,
          confirmationMessage: resolution.question,
          error: resolution.question
        };
      }

      return {
        success: true,
        data: {
          message: `Retrieved project info for: ${project_name}`,
          project: resolution.project
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get project info: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Assign worker to project tool
 */
export const assignWorkerTool: ToolDefinition = {
  name: "assign_worker",
  description: "Assign a worker to a project",
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
    daily_wage: {
      type: "number",
      required: false,
      description: "Daily wage for this project (optional)"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["projects:write", "workers:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, daily_wage } = params;
      
      // Validate parameters
      if (!worker_name || typeof worker_name !== 'string') {
        return { success: false, error: "Invalid worker name" };
      }
      if (!project_name || typeof project_name !== 'string') {
        return { success: false, error: "Invalid project name" };
      }

      const workerRepo = new WorkerRepository();
      const projectRepo = new ProjectRepository();

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

      // Check if assignment already exists
      const existingAssignment = await db
        .select()
        .from(projectLabourTable)
        .where(and(
          eq(projectLabourTable.labour_id, worker.id),
          eq(projectLabourTable.project_id, project.id)
        ))
        .limit(1);

      if (existingAssignment.length > 0) {
        return { success: false, error: `Worker "${worker_name}" is already assigned to project "${project_name}"` };
      }

      // Create assignment in database
      await db.insert(projectLabourTable).values({
        labour_id: worker.id,
        project_id: project.id,
        daily_wage: daily_wage as number || worker.daily_wage || 0,
        assigned_at: new Date().toISOString()
      });
      
      return {
        success: true,
        data: {
          message: `Assigned ${worker.name} to ${project.name}`,
          assignment: {
            worker_name: worker.name,
            project_name: project.name,
            daily_wage: daily_wage || worker.daily_wage
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to assign worker: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};