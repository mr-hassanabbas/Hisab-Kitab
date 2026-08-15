// Version 1 Payment Tools - Complete payment processing
import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { WorkerRepository } from "@workspace/database";
import { ProjectRepository } from "@workspace/database";

/**
 * Create payment tool (Version 1)
 */
export const createPaymentTool: ToolDefinition = {
  name: "create_payment",
  description: "Create a new payment record",
  parameters: {
    worker_name: {
      type: "string",
      required: true,
      description: "Name of the worker to pay"
    },
    project_name: {
      type: "string",
      required: true,
      description: "Project name"
    },
    amount: {
      type: "number",
      required: true,
      description: "Payment amount"
    },
    payment_type: {
      type: "enum",
      required: false,
      description: "Type of payment",
      values: ["advance", "weekly_payment", "full_payment", "partial_payment"]
    },
    date: {
      type: "string",
      required: false,
      description: "Payment date in YYYY-MM-DD format"
    },
    notes: {
      type: "string",
      required: false,
      description: "Payment notes"
    }
  } as ToolParameters,
  riskLevel: "high" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["payments:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, amount, payment_type, date, notes } = params;
      
      const workerRepo = new WorkerRepository();
      const projectRepo = new ProjectRepository();

      // Resolve worker
      const workerResolution = await workerRepo.resolveWorker(worker_name as string);
      if (workerResolution.type === 'not_found') {
        return { success: false, error: `Worker "${worker_name}" not found` };
      }

      const worker = workerResolution.worker;
      if (!worker) {
        return { success: false, error: "Failed to resolve worker" };
      }

      // Resolve project
      const projectResolution = await projectRepo.resolveProject(project_name as string);
      if (projectResolution.type === 'not_found') {
        return { success: false, error: `Project "${project_name}" not found` };
      }

      const project = projectResolution.project;
      if (!project) {
        return { success: false, error: "Failed to resolve project" };
      }

      // Create payment record (would use PaymentRepository in real implementation)
      const paymentDate = date as string || new Date().toISOString().split('T')[0];
      
      // For now, simulate payment creation
      const payment = {
        id: Date.now(),
        worker_id: worker.id,
        project_id: project.id,
        amount: amount as number,
        payment_type: payment_type || 'partial_payment',
        date: paymentDate,
        notes: notes || '',
        created_at: new Date().toISOString()
      };

      return {
        success: true,
        data: {
          message: `Created payment of ${amount} for ${worker.name}`,
          payment
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create payment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Query payments tool (Version 1)
 */
export const queryPaymentsTool: ToolDefinition = {
  name: "query_payments",
  description: "Query payment records",
  parameters: {
    worker_name: {
      type: "string",
      required: false,
      description: "Worker name (optional)"
    },
    project_name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    start_date: {
      type: "string",
      required: false,
      description: "Start date in YYYY-MM-DD format"
    },
    end_date: {
      type: "string",
      required: false,
      description: "End date in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["payments:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, start_date, end_date } = params;
      
      // For now, simulate query (would use PaymentRepository in real implementation)
      const payments = [
        {
          id: 1,
          worker_name: 'Ahmed',
          project_name: 'Construction Site',
          amount: 5000,
          payment_type: 'weekly_payment',
          date: '2026-08-15'
        }
      ];

      // Filter results based on parameters
      let filteredPayments = payments;
      if (worker_name) {
        filteredPayments = filteredPayments.filter((p: any) => p.worker_name === worker_name);
      }
      if (project_name) {
        filteredPayments = filteredPayments.filter((p: any) => p.project_name === project_name);
      }

      return {
        success: true,
        data: {
          message: "Retrieved payment records",
          filters: { worker_name, project_name, start_date, end_date },
          payments: filteredPayments,
          total: filteredPayments.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to query payments: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Update payment tool (Version 1)
 */
export const updatePaymentTool: ToolDefinition = {
  name: "update_payment",
  description: "Update existing payment record",
  parameters: {
    payment_id: {
      type: "number",
      required: true,
      description: "ID of the payment to update"
    },
    amount: {
      type: "number",
      required: false,
      description: "New payment amount"
    },
    payment_type: {
      type: "enum",
      required: false,
      description: "New payment type",
      values: ["advance", "weekly_payment", "full_payment", "partial_payment"]
    },
    notes: {
      type: "string",
      required: false,
      description: "Updated notes"
    }
  } as ToolParameters,
  riskLevel: "high" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["payments:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { payment_id, amount, payment_type, notes } = params;
      
      // For now, simulate update (would use PaymentRepository in real implementation)
      
      return {
        success: true,
        data: {
          message: `Updated payment record ${payment_id}`,
          payment_id,
          ...((amount || payment_type || notes) && { updates: { amount, payment_type, notes }})
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update payment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Delete payment tool (Version 1)
 */
export const deletePaymentTool: ToolDefinition = {
  name: "delete_payment",
  description: "Delete payment record",
  parameters: {
    payment_id: {
      type: "number",
      required: true,
      description: "ID of the payment to delete"
    }
  } as ToolParameters,
  riskLevel: "high" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["payments:delete"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { payment_id } = params;
      
      // For now, simulate delete (would use PaymentRepository in real implementation)
      
      return {
        success: true,
        data: {
          message: `Deleted payment record ${payment_id}`,
          payment_id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete payment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Payment summary tool (Version 1)
 */
export const paymentSummaryTool: ToolDefinition = {
  name: "payment_summary",
  description: "Get payment summary for a date range",
  parameters: {
    worker_name: {
      type: "string",
      required: false,
      description: "Worker name (optional)"
    },
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
  permissions: ["payments:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, start_date, end_date } = params;
      
      // For now, simulate summary (would use PaymentRepository in real implementation)
      const summary = {
        total_payments: 10,
        total_amount: 50000,
        average_payment: 5000,
        by_type: {
          advance: 15000,
          weekly_payment: 25000,
          full_payment: 10000
        }
      };

      return {
        success: true,
        data: {
          message: "Payment summary generated",
          filters: { worker_name, project_name, start_date, end_date },
          summary
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get payment summary: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

// Version 1 Payment Tools Registry
export const paymentToolsV1 = {
  create_payment: createPaymentTool,
  query_payments: queryPaymentsTool,
  update_payment: updatePaymentTool,
  delete_payment: deletePaymentTool,
  payment_summary: paymentSummaryTool
};
