import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";
import { ProjectRepository } from "@workspace/database";
import { dailyExpensesTable } from "@workspace/db/schema";
import { db } from "@workspace/db";

/**
 * Add expense tool
 */
export const addExpenseTool: ToolDefinition = {
  name: "add_expense",
  description: "Add expense record for a project",
  parameters: {
    project_name: {
      type: "string",
      required: true,
      description: "Name of the project"
    },
    category: {
      type: "enum",
      required: true,
      description: "Expense category",
      values: ["materials", "labor", "equipment", "transport", "food", "other"]
    },
    amount: {
      type: "number",
      required: true,
      description: "Expense amount in PKR"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format (defaults to today)",
      default: new Date().toISOString().split('T')[0]
    },
    description: {
      type: "string",
      required: false,
      description: "Description of the expense"
    },
    paid_to: {
      type: "string",
      required: false,
      description: "Person or vendor paid to"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["expenses:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name, category, amount, date, description, paid_to } = params;
      
      // Validate parameters
      if (!project_name || typeof project_name !== 'string') {
        return { success: false, error: "Invalid project name" };
      }
      if (!category || typeof category !== 'string') {
        return { success: false, error: "Invalid category" };
      }
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return { success: false, error: "Invalid amount" };
      }

      const projectRepo = new ProjectRepository();
      
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

      // Create expense in database
      const expense = await db.insert(dailyExpensesTable).values({
        project_id: project.id,
        category: category as string,
        amount: amount as number,
        date: date as string || new Date().toISOString().split('T')[0],
        remarks: description as string || null
      }).returning();
      
      return {
        success: true,
        data: {
          message: `Added expense of ${amount} PKR for ${category} to ${project.name}`,
          project_name: project.name,
          category,
          amount,
          date,
          description,
          paid_to
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add expense: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Get expenses tool
 */
export const getExpensesTool: ToolDefinition = {
  name: "get_expenses",
  description: "Get expense records for projects",
  parameters: {
    project_name: {
      type: "string",
      required: false,
      description: "Name of the project (optional)"
    },
    category: {
      type: "string",
      required: false,
      description: "Expense category (optional)"
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
  permissions: ["expenses:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name, category, date, start_date, end_date } = params;
      
      // Simple implementation - get all expenses with limit
      const records = await db
        .select()
        .from(dailyExpensesTable)
        .orderBy(dailyExpensesTable.date)
        .limit(50);
      
      return {
        success: true,
        data: {
          message: "Retrieved expense records",
          filters: { project_name, category, date, start_date, end_date },
          records: records || []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get expenses: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};