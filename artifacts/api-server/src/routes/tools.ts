import { Router } from "express";
import { logger } from "../lib/logger.js";
import { createToolRegistry, type ToolContext } from "@workspace/tools";

const router = Router();
const toolRegistry = createToolRegistry();

/**
 * List available tools
 * GET /api/tools
 */
router.get("/", async (req, res) => {
  try {
    logger.info("Listing available tools");

    const tools = toolRegistry.getAllTools();

    res.json({
      success: true,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        riskLevel: tool.riskLevel,
        requiresConfirmation: tool.requiresConfirmation,
        permissions: tool.permissions
      }))
    });
  } catch (error) {
    logger.error({ error }, "Tool listing failed");
    res.status(500).json({ success: false, error: "Tool listing failed" });
  }
});

/**
 * Get tool schema
 * GET /api/tools/:name
 */
router.get("/:name", async (req, res) => {
  try {
    const { name } = req.params;
    
    logger.info({ toolName: name }, "Getting tool schema");

    const tool = toolRegistry.getTool(name);
    
    if (!tool) {
      res.status(404).json({ success: false, error: "Tool not found" });
      return;
    }

    res.json({
      success: true,
      tool: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        riskLevel: tool.riskLevel,
        requiresConfirmation: tool.requiresConfirmation,
        permissions: tool.permissions
      }
    });
  } catch (error) {
    logger.error({ error }, "Tool schema retrieval failed");
    res.status(500).json({ success: false, error: "Tool schema retrieval failed" });
  }
});

/**
 * Test tool execution
 * POST /api/tools/test
 */
router.post("/test", async (req, res) => {
  try {
    const { tool, parameters } = req.body;
    
    if (!tool) {
      res.status(400).json({ success: false, error: "Tool name is required" });
      return;
    }

    logger.info({ tool, parameters }, "Testing tool execution");

    const context: ToolContext = {
      userId: (req.user as any)?.id || 0,
      userRole: (req.user as any)?.role || "admin",
      sessionId: "test-session",
      requestId: "test-request"
    };

    const result = await toolRegistry.executeTool(tool, parameters || {}, context);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error({ error }, "Tool test execution failed");
    res.status(500).json({ success: false, error: "Tool test execution failed" });
  }
});

export default router;