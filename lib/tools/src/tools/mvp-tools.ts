// MVP-specific simplified tools for core functionality
import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";

/**
 * MVP Mark Attendance Tool - Simplified for MVP
 */
export const mvpMarkAttendanceTool: ToolDefinition = {
  name: "mark_attendance",
  description: "Mark worker attendance (MVP simplified)",
  parameters: {
    worker_name: {
      type: "string",
      required: true,
      description: "Worker name"
    },
    project_name: {
      type: "string", 
      required: true,
      description: "Project name"
    },
    status: {
      type: "string",
      required: true,
      description: "Attendance status (present/absent/half_day)"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["attendance:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, project_name, status, date } = params;
      
      // MVP: Direct API call instead of repository pattern for simplicity
      const apiUrl = context.apiUrl || '/api/attendance';
      const attendanceDate = date as string || new Date().toISOString().split('T')[0];
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.token || ''}`
        },
        body: JSON.stringify({
          labour_name: worker_name,
          project_name: project_name,
          date: attendanceDate,
          status: status,
          advance_given: 0
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: {
          message: `Marked ${worker_name} as ${status} for ${project_name}`,
          ...result
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
 * MVP Get Attendance Tool - Simplified for MVP
 */
export const mvpGetAttendanceTool: ToolDefinition = {
  name: "get_attendance", 
  description: "Get attendance records (MVP simplified)",
  parameters: {
    worker_name: {
      type: "string",
      required: false,
      description: "Worker name (optional)"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format (optional)"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["attendance:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name, date } = params;
      const apiUrl = context.apiUrl || '/api/attendance';
      const queryParams = new URLSearchParams();
      
      if (worker_name) queryParams.append('labour_name', worker_name as string);
      if (date) queryParams.append('date', date as string);
      
      const response = await fetch(`${apiUrl}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${context.token || ''}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: {
          message: "Retrieved attendance records",
          records: result.data || result
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

/**
 * MVP Create Worker Tool - Simplified for MVP
 */
export const mvpCreateWorkerTool: ToolDefinition = {
  name: "create_worker",
  description: "Create new worker (MVP simplified)",
  parameters: {
    name: {
      type: "string",
      required: true,
      description: "Worker name"
    },
    phone: {
      type: "string",
      required: false,
      description: "Phone number"
    },
    daily_wage: {
      type: "number",
      required: false,
      description: "Daily wage"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["workers:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, phone, daily_wage } = params;
      const apiUrl = context.apiUrl || '/api/labour';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.token || ''}`
        },
        body: JSON.stringify({
          name: name,
          phone: phone || null,
          daily_wage: daily_wage || 0,
          is_active: 1
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: {
          message: `Created worker: ${name}`,
          ...result
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
 * MVP Get Worker Info Tool - Simplified for MVP
 */
export const mvpGetWorkerInfoTool: ToolDefinition = {
  name: "get_worker_info",
  description: "Get worker information (MVP simplified)",
  parameters: {
    worker_name: {
      type: "string",
      required: true,
      description: "Worker name"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["workers:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { worker_name } = params;
      const apiUrl = context.apiUrl || '/api/labour';
      
      const response = await fetch(`${apiUrl}?name=${encodeURIComponent(worker_name as string)}`, {
        headers: {
          'Authorization': `Bearer ${context.token || ''}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      const workers = result.data || result;
      
      if (!workers || workers.length === 0) {
        return { success: false, error: `Worker "${worker_name}" not found` };
      }
      
      return {
        success: true,
        data: {
          message: `Found worker: ${worker_name}`,
          worker: workers[0]
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

/**
 * MVP Add Expense Tool - Simplified for MVP
 */
export const mvpAddExpenseTool: ToolDefinition = {
  name: "add_expense",
  description: "Add expense record (MVP simplified)",
  parameters: {
    amount: {
      type: "number",
      required: true,
      description: "Expense amount"
    },
    category: {
      type: "string",
      required: true,
      description: "Expense category"
    },
    description: {
      type: "string",
      required: false,
      description: "Expense description"
    },
    project_name: {
      type: "string",
      required: false,
      description: "Project name"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["expenses:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { amount, category, description, project_name } = params;
      const apiUrl = context.apiUrl || '/api/daily-expenses';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.token || ''}`
        },
        body: JSON.stringify({
          amount: amount,
          category: category,
          description: description || category,
          project_name: project_name || 'General',
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: {
          message: `Added expense: ${amount} for ${category}`,
          ...result
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
 * MVP Get Expenses Tool - Simplified for MVP
 */
export const mvpGetExpensesTool: ToolDefinition = {
  name: "get_expenses",
  description: "Get expense records (MVP simplified)",
  parameters: {
    project_name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format (optional)"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["expenses:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name, date } = params;
      const apiUrl = context.apiUrl || '/api/daily-expenses';
      const queryParams = new URLSearchParams();
      
      if (project_name) queryParams.append('project_name', project_name as string);
      if (date) queryParams.append('date', date as string);
      
      const response = await fetch(`${apiUrl}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${context.token || ''}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: {
          message: "Retrieved expense records",
          records: result.data || result
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

/**
 * MVP Tool Registry
 */
export const mvpToolRegistry = {
  mark_attendance: mvpMarkAttendanceTool,
  get_attendance: mvpGetAttendanceTool,
  create_worker: mvpCreateWorkerTool,
  get_worker_info: mvpGetWorkerInfoTool,
  add_expense: mvpAddExpenseTool,
  get_expenses: mvpGetExpensesTool
};

/**
 * Get MVP tool by name
 */
export function getMVPTool(name: string): ToolDefinition | undefined {
  return mvpToolRegistry[name as keyof typeof mvpToolRegistry];
}

/**
 * Get all MVP tool names
 */
export function getMVPToolNames(): string[] {
  return Object.keys(mvpToolRegistry);
}
