// Version 1 Project Management Tools
import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";

/**
 * Create project tool (Version 1)
 */
export const createProjectTool: ToolDefinition = {
  name: "create_project",
  description: "Create a new project",
  parameters: {
    name: {
      type: "string",
      required: true,
      description: "Project name"
    },
    location: {
      type: "string",
      required: false,
      description: "Project location"
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
    },
    budget: {
      type: "number",
      required: false,
      description: "Project budget"
    },
    description: {
      type: "string",
      required: false,
      description: "Project description"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["projects:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, location, start_date, end_date, budget, description } = params;
      
      // For now, simulate project creation (would use ProjectRepository in real implementation)
      const project = {
        id: Date.now(),
        name: name as string,
        location: location || '',
        start_date: start_date || null,
        end_date: end_date || null,
        budget: budget || 0,
        description: description || '',
        status: 'active',
        created_at: new Date().toISOString()
      };

      return {
        success: true,
        data: {
          message: `Created project: ${name}`,
          project
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
 * Query projects tool (Version 1)
 */
export const queryProjectsTool: ToolDefinition = {
  name: "query_projects",
  description: "Query project records",
  parameters: {
    name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    status: {
      type: "enum",
      required: false,
      description: "Project status",
      values: ["active", "completed", "on_hold", "cancelled"]
    },
    location: {
      type: "string",
      required: false,
      description: "Project location (optional)"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["projects:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, status, location } = params;
      
      // For now, simulate query (would use ProjectRepository in real implementation)
      const projects = [
        {
          id: 1,
          name: 'Construction Site',
          location: 'Lahore',
          status: 'active',
          budget: 500000,
          start_date: '2026-01-01',
          end_date: '2026-12-31'
        }
      ];

      // Filter results
      let filteredProjects = projects;
      if (name) {
        filteredProjects = filteredProjects.filter((p: any) => p.name === name);
      }
      if (status) {
        filteredProjects = filteredProjects.filter((p: any) => p.status === status);
      }
      if (location) {
        filteredProjects = filteredProjects.filter((p: any) => p.location === location);
      }

      return {
        success: true,
        data: {
          message: "Retrieved project records",
          filters: { name, status, location },
          projects: filteredProjects,
          total: filteredProjects.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to query projects: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Update project tool (Version 1)
 */
export const updateProjectTool: ToolDefinition = {
  name: "update_project",
  description: "Update existing project",
  parameters: {
    project_id: {
      type: "number",
      required: true,
      description: "ID of the project to update"
    },
    name: {
      type: "string",
      required: false,
      description: "New project name"
    },
    status: {
      type: "enum",
      required: false,
      description: "New project status",
      values: ["active", "completed", "on_hold", "cancelled"]
    },
    budget: {
      type: "number",
      required: false,
      description: "New budget"
    },
    end_date: {
      type: "string",
      required: false,
      description: "New end date in YYYY-MM-DD format"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["projects:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_id, name, status, budget, end_date } = params;
      
      // For now, simulate update (would use ProjectRepository in real implementation)
      
      return {
        success: true,
        data: {
          message: `Updated project ${project_id}`,
          project_id,
          ...((name || status || budget || end_date) && { updates: { name, status, budget, end_date }})
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update project: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Delete project tool (Version 1)
 */
export const deleteProjectTool: ToolDefinition = {
  name: "delete_project",
  description: "Delete project",
  parameters: {
    project_id: {
      type: "number",
      required: true,
      description: "ID of the project to delete"
    }
  } as ToolParameters,
  riskLevel: "high" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["projects:delete"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_id } = params;
      
      // For now, simulate delete (would use ProjectRepository in real implementation)
      
      return {
        success: true,
        data: {
          message: `Deleted project ${project_id}`,
          project_id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete project: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Project status tool (Version 1)
 */
export const projectStatusTool: ToolDefinition = {
  name: "project_status",
  description: "Get current status of a project",
  parameters: {
    project_name: {
      type: "string",
      required: true,
      description: "Project name"
    }
  } as ToolParameters,
  riskLevel: "low" as RiskLevel,
  requiresConfirmation: false,
  permissions: ["projects:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name } = params;
      
      // For now, simulate status (would use ProjectRepository in real implementation)
      const status = {
        name: project_name,
        status: 'active',
        progress: 45,
        workers_assigned: 10,
        total_budget: 500000,
        spent: 225000,
        remaining: 275000,
        days_remaining: 180
      };

      return {
        success: true,
        data: {
          message: `Project status for ${project_name}`,
          status
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get project status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

// Version 1 Project Tools Registry
export const projectToolsV1 = {
  create_project: createProjectTool,
  query_projects: queryProjectsTool,
  update_project: updateProjectTool,
  delete_project: deleteProjectTool,
  project_status: projectStatusTool
};
