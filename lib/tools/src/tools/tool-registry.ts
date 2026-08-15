import type { ToolDefinition, ToolContext, ToolResult } from "../types/tool-types.js";

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category (based on name prefix)
   */
  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.name.startsWith(category));
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute tool by name
   */
  async executeTool(name: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`
      };
    }

    try {
      return await tool.execute(params, context);
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get tool schema for AI
   */
  getToolSchema(name: string): object | undefined {
    const tool = this.getTool(name);
    if (!tool) return undefined;

    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      riskLevel: tool.riskLevel,
      requiresConfirmation: tool.requiresConfirmation
    };
  }

  /**
   * Get all tool schemas for AI
   */
  getAllToolSchemas(): object[] {
    return this.getAllTools().map(tool => this.getToolSchema(tool.name)!);
  }
}