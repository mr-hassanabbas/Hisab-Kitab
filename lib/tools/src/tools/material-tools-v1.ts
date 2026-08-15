// Version 1 Material Tracking Tools
import type { ToolDefinition, ToolParameters, ToolContext, ToolResult, RiskLevel } from "../types/tool-types.js";

/**
 * Add material tool (Version 1)
 */
export const addMaterialTool: ToolDefinition = {
  name: "add_material",
  description: "Add material record",
  parameters: {
    name: {
      type: "string",
      required: true,
      description: "Material name"
    },
    quantity: {
      type: "number",
      required: true,
      description: "Material quantity"
    },
    unit: {
      type: "string",
      required: true,
      description: "Unit of measurement (kg, pcs, bags, etc.)"
    },
    project_name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    category: {
      type: "string",
      required: false,
      description: "Material category"
    },
    date: {
      type: "string",
      required: false,
      description: "Date in YYYY-MM-DD format"
    },
    cost: {
      type: "number",
      required: false,
      description: "Material cost"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["materials:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, quantity, unit, project_name, category, date, cost } = params;
      
      // For now, simulate material addition (would use MaterialRepository in real implementation)
      const material = {
        id: Date.now(),
        name: name as string,
        quantity: quantity as number,
        unit: unit as string,
        project_name: project_name || 'General',
        category: category || 'General',
        date: date as string || new Date().toISOString().split('T')[0],
        cost: cost || 0,
        created_at: new Date().toISOString()
      };

      return {
        success: true,
        data: {
          message: `Added material: ${quantity} ${unit} of ${name}`,
          material
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add material: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Query materials tool (Version 1)
 */
export const queryMaterialsTool: ToolDefinition = {
  name: "query_materials",
  description: "Query material records",
  parameters: {
    name: {
      type: "string",
      required: false,
      description: "Material name (optional)"
    },
    project_name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    category: {
      type: "string",
      required: false,
      description: "Material category (optional)"
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
  permissions: ["materials:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { name, project_name, category, start_date, end_date } = params;
      
      // For now, simulate query (would use MaterialRepository in real implementation)
      const materials = [
        {
          id: 1,
          name: 'Cement',
          quantity: 100,
          unit: 'bags',
          project_name: 'Construction Site',
          category: 'Construction',
          date: '2026-08-15',
          cost: 5000
        }
      ];

      // Filter results
      let filteredMaterials = materials;
      if (name) {
        filteredMaterials = filteredMaterials.filter((m: any) => m.name === name);
      }
      if (project_name) {
        filteredMaterials = filteredMaterials.filter((m: any) => m.project_name === project_name);
      }
      if (category) {
        filteredMaterials = filteredMaterials.filter((m: any) => m.category === category);
      }

      return {
        success: true,
        data: {
          message: "Retrieved material records",
          filters: { name, project_name, category, start_date, end_date },
          materials: filteredMaterials,
          total: filteredMaterials.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to query materials: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Update material tool (Version 1)
 */
export const updateMaterialTool: ToolDefinition = {
  name: "update_material",
  description: "Update existing material record",
  parameters: {
    material_id: {
      type: "number",
      required: true,
      description: "ID of the material to update"
    },
    quantity: {
      type: "number",
      required: false,
      description: "New quantity"
    },
    cost: {
      type: "number",
      required: false,
      description: "New cost"
    },
    category: {
      type: "string",
      required: false,
      description: "New category"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["materials:write"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { material_id, quantity, cost, category } = params;
      
      // For now, simulate update (would use MaterialRepository in real implementation)
      
      return {
        success: true,
        data: {
          message: `Updated material record ${material_id}`,
          material_id,
          ...((quantity || cost || category) && { updates: { quantity, cost, category }})
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update material: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Delete material tool (Version 1)
 */
export const deleteMaterialTool: ToolDefinition = {
  name: "delete_material",
  description: "Delete material record",
  parameters: {
    material_id: {
      type: "number",
      required: true,
      description: "ID of the material to delete"
    }
  } as ToolParameters,
  riskLevel: "medium" as RiskLevel,
  requiresConfirmation: true,
  permissions: ["materials:delete"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { material_id } = params;
      
      // For now, simulate delete (would use MaterialRepository in real implementation)
      
      return {
        success: true,
        data: {
          message: `Deleted material record ${material_id}`,
          material_id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete material: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * Material summary tool (Version 1)
 */
export const materialSummaryTool: ToolDefinition = {
  name: "material_summary",
  description: "Get material summary for a date range",
  parameters: {
    project_name: {
      type: "string",
      required: false,
      description: "Project name (optional)"
    },
    category: {
      type: "string",
      required: false,
      description: "Material category (optional)"
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
  permissions: ["materials:read"],
  execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
    try {
      const { project_name, category, start_date, end_date } = params;
      
      // For now, simulate summary (would use MaterialRepository in real implementation)
      const summary = {
        total_materials: 25,
        total_cost: 75000,
        by_category: {
          'Construction': 50000,
          'Steel': 15000,
          'Electrical': 10000
        }
      };

      return {
        success: true,
        data: {
          message: "Material summary generated",
          filters: { project_name, category, start_date, end_date },
          summary
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get material summary: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

// Version 1 Material Tools Registry
export const materialToolsV1 = {
  add_material: addMaterialTool,
  query_materials: queryMaterialsTool,
  update_material: updateMaterialTool,
  delete_material: deleteMaterialTool,
  material_summary: materialSummaryTool
};
