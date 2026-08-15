import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { WorkerRepository } from "@workspace/database";

/**
 * Create worker tool
 */
export const createWorkerTool: ToolDefinition = {
  name: "create_worker",
  description: "Create a new worker record",
  parameters: {
    name: {
      type: "string",
      required: true,
      description: "Full name of the worker"
    },
    phone: {
      type: "string",
      required: false,
      description: "Phone number"
    },
    cnic: {
      type: "string",
      required: false,
      description: "CNIC number"
    },
    fathers_name: {
      type: "string",
      required: false,
      description: "Father's name"
    },
    village: {
      type: "string",
      required: false,
      description: "Village or hometown"
    },
    daily_wage: {
      type: "number",
      required: false,
      description: "Daily wage rate"
    },
    nicknames: {
      type: "array",
      required: false,
      description: "Array of nicknames for the worker"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["workers:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, phone, cnic, fathers_name, village, daily_wage, nicknames } = params;
      
      // Validate parameters
      if (!name || typeof name !== 'string') {
        return { success: false, error: "Invalid worker name" };
      }

      const workerRepo = new WorkerRepository();
      
      // Check if worker already exists
      const existingWorker = await workerRepo.findByName(name);
      if (existingWorker) {
        return { success: false, error: `Worker "${name}" already exists` };
      }

      // Create worker in database
      const newWorker = await workerRepo.create({
        name: name as string,
        phone: phone as string || null,
        cnic: cnic as string || null,
        fathers_name: fathers_name as string || null,
        village: village as string || null,
        daily_wage: daily_wage as number || 0,
        nicknames: nicknames as string[] || [],
        is_active: 1
      });
      
      return {
        success: true,
        data: {
          message: `Created worker: ${newWorker.name}`,
          worker: newWorker
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create worker: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Get worker info tool
 */
export const getWorkerInfoTool: ToolDefinition = {
  name: "get_worker_info",
  description: "Get information about a worker",
  parameters: {
    worker_name: {
      type: "string",
      required: true,
      description: "Name of the worker"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["workers:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name } = params;
      
      // Validate parameters
      if (!worker_name || typeof worker_name !== 'string') {
        return { success: false, error: "Invalid worker name" };
      }

      const workerRepo = new WorkerRepository();
      const resolution = await workerRepo.resolveWorker(worker_name);
      
      if (resolution.type === 'not_found') {
        return { success: false, error: `Worker "${worker_name}" not found` };
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
          message: `Retrieved worker info for: ${worker_name}`,
          worker: resolution.worker
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get worker info: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};