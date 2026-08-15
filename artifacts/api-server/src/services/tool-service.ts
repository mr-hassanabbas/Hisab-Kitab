import { logger } from "../lib/logger.js";
import type { ToolCall, ToolResult } from "./ai-service.js";
import { createToolRegistry, type ToolRegistry } from "@workspace/tools";
import type { ToolContext } from "@workspace/tools";
import { PermissionSystem } from "@workspace/security";

export class ToolService {
  private toolRegistry: ToolRegistry;
  private permissionSystem: PermissionSystem;

  constructor() {
    this.toolRegistry = createToolRegistry();
    this.permissionSystem = new PermissionSystem();
  }

  /**
   * Execute tool with validation and permission checking
   */
  async executeTool(toolCall: ToolCall, user: any): Promise<ToolResult> {
    logger.info({ tool: toolCall.tool, user }, "Executing tool with validation");
    
    // Validate parameters
    const validationResult = this.validateParameters(toolCall);
    if (!validationResult.valid) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.errors.join(', ')}`
      };
    }

    // Check permissions
    const permissionResult = this.checkPermissions(toolCall, user);
    if (!permissionResult.allowed) {
      return {
        success: false,
        error: `Permission denied: ${permissionResult.reason}`
      };
    }

    // Risk classification
    const riskResult = this.classifyRisk(toolCall);
    if (riskResult.requiresConfirmation) {
      return {
        success: false,
        requiresConfirmation: true,
        confirmationMessage: riskResult.confirmationMessage
      };
    }

    // Execute tool using tool registry
    const context: ToolContext = {
      userId: user?.id || 0,
      userRole: user?.role || "admin",
      sessionId: this.generateSessionId(),
      requestId: this.generateRequestId()
    };

    const executionResult = await this.toolRegistry.executeTool(toolCall.tool, toolCall.parameters, context);
    
    return executionResult;
  }

  /**
   * Get available tools
   */
  getAvailableTools() {
    return this.toolRegistry.getAllTools();
  }

  /**
   * Get tool schema
   */
  getToolSchema(toolName: string) {
    return this.toolRegistry.getToolSchema(toolName);
  }

  /**
   * Validate tool parameters
   */
  private validateParameters(toolCall: ToolCall): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Placeholder validation logic
    if (!toolCall.parameters) {
      errors.push("Parameters are required");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check user permissions for tool
   */
  private checkPermissions(toolCall: ToolCall, user: any): { allowed: boolean; reason?: string } {
    const role = user?.role || "admin";
    
    // Check tool-specific permissions
    const tool = this.toolRegistry.getTool(toolCall.tool);
    if (tool && tool.permissions.length > 0) {
      const permissionResult = this.permissionSystem.checkToolPermissions(
        toolCall.tool,
        tool.permissions,
        role
      );
      
      if (!permissionResult.allowed) {
        return {
          allowed: false,
          reason: permissionResult.reason || "Insufficient permissions"
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Classify risk level of tool operation
   */
  private classifyRisk(toolCall: ToolCall): { requiresConfirmation: boolean; confirmationMessage?: string } {
    // Placeholder risk classification
    // Will be implemented in Phase 7
    const riskLevel = toolCall.riskLevel || "low";
    
    if (riskLevel === "high" || riskLevel === "critical") {
      return {
        requiresConfirmation: true,
        confirmationMessage: `This is a ${riskLevel} risk operation. Are you sure you want to proceed?`
      };
    }

    return { requiresConfirmation: false };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}