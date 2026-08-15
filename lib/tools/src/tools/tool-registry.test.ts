import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "./tool-registry";
import type { ToolContext } from "../types/tool-types";

describe("ToolRegistry", () => {
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    
    // Register a test tool for most tests
    const mockTool = {
      name: "test_tool",
      description: "Test tool",
      parameters: {},
      riskLevel: "low" as const,
      requiresConfirmation: false,
      permissions: [],
      execute: async () => ({ success: true, data: { message: "executed" } })
    };
    toolRegistry.registerTool(mockTool);
  });

  describe("registerTool", () => {
    it("should register a tool", () => {
      const mockTool = {
        name: "another_test_tool",
        description: "Test tool",
        parameters: {},
        riskLevel: "low" as const,
        requiresConfirmation: false,
        permissions: [],
        execute: async () => ({ success: true })
      };

      toolRegistry.registerTool(mockTool);
      expect(toolRegistry.hasTool("another_test_tool")).toBe(true);
    });
  });

  describe("getTool", () => {
    it("should return registered tool", () => {
      const tool = toolRegistry.getTool("test_tool");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("test_tool");
    });

    it("should return undefined for unknown tool", () => {
      const tool = toolRegistry.getTool("unknown_tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("getAllTools", () => {
    it("should return all registered tools", () => {
      const tools = toolRegistry.getAllTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.map(t => t.name)).toContain("test_tool");
    });
  });

  describe("getToolsByCategory", () => {
    it("should return tools by category prefix", () => {
      const mockTool = {
        name: "attendance_test",
        description: "Test tool",
        parameters: {},
        riskLevel: "low" as const,
        requiresConfirmation: false,
        permissions: [],
        execute: async () => ({ success: true })
      };
      toolRegistry.registerTool(mockTool);
      
      const tools = toolRegistry.getToolsByCategory("attendance");
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.name.startsWith("attendance"))).toBe(true);
    });
  });

  describe("hasTool", () => {
    it("should return true for existing tool", () => {
      expect(toolRegistry.hasTool("test_tool")).toBe(true);
    });

    it("should return false for non-existing tool", () => {
      expect(toolRegistry.hasTool("unknown")).toBe(false);
    });
  });

  describe("executeTool", () => {
    it("should execute tool with valid parameters", async () => {
      const context: ToolContext = {
        userId: 1,
        userRole: "admin",
        sessionId: "test-session",
        requestId: "test-request"
      };

      const result = await toolRegistry.executeTool("test_tool", {}, context);
      expect(result.success).toBe(true);
    });

    it("should return error for unknown tool", async () => {
      const context: ToolContext = {
        userId: 1,
        userRole: "admin",
        sessionId: "test-session",
        requestId: "test-request"
      };

      const result = await toolRegistry.executeTool("unknown", {}, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("getToolSchema", () => {
    it("should return tool schema", () => {
      const schema = toolRegistry.getToolSchema("test_tool");
      expect(schema).toBeDefined();
      expect(schema).toHaveProperty("name");
      expect(schema).toHaveProperty("description");
      expect(schema).toHaveProperty("parameters");
    });

    it("should return undefined for unknown tool", () => {
      const schema = toolRegistry.getToolSchema("unknown");
      expect(schema).toBeUndefined();
    });
  });

  describe("getAllToolSchemas", () => {
    it("should return all tool schemas", () => {
      const schemas = toolRegistry.getAllToolSchemas();
      expect(schemas.length).toBeGreaterThan(0);
      expect(schemas.every(s => s.name)).toBe(true);
    });
  });
});