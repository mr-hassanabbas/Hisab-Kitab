import { Router } from "express";
import { AIService } from "../services/ai-service.js";
import { ToolService } from "../services/tool-service.js";
import { AuditService } from "../services/audit-service.js";
import { logger } from "../lib/logger.js";

const router = Router();
const aiService = new AIService();
const toolService = new ToolService();
const auditService = new AuditService();

/**
 * Parse intent from transcript
 * POST /api/ai/intent
 */
router.post("/intent", async (req, res) => {
  try {
    const { transcript, context } = req.body;
    
    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({ success: false, error: "Transcript is required" });
      return;
    }

    logger.info({ transcript, context }, "Parsing intent");

    const intentResult = await aiService.parseIntent(transcript, context);
    
    res.json({
      success: true,
      intent: intentResult
    });
  } catch (error) {
    logger.error({ error }, "Intent parsing failed");
    res.status(500).json({ success: false, error: "Intent parsing failed" });
  }
});

/**
 * Execute validated tool
 * POST /api/ai/execute
 */
router.post("/execute", async (req, res) => {
  try {
    const { toolCall, user } = req.body;
    
    if (!toolCall) {
      res.status(400).json({ success: false, error: "Tool call is required" });
      return;
    }

    logger.info({ tool: toolCall.tool, user }, "Executing tool");

    const toolResult = await toolService.executeTool(toolCall, user);
    
    res.json({
      success: true,
      result: toolResult
    });
  } catch (error) {
    logger.error({ error }, "Tool execution failed");
    res.status(500).json({ success: false, error: "Tool execution failed" });
  }
});

/**
 * Handle disambiguation
 * POST /api/ai/clarify
 */
router.post("/clarify", async (req, res) => {
  try {
    const { clarifyRequest } = req.body;
    
    if (!clarifyRequest) {
      res.status(400).json({ success: false, error: "Clarification request is required" });
      return;
    }

    logger.info({ clarifyRequest }, "Handling clarification");

    const clarificationResponse = await aiService.handleClarification(clarifyRequest);
    
    res.json({
      success: true,
      response: clarificationResponse
    });
  } catch (error) {
    logger.error({ error }, "Clarification handling failed");
    res.status(500).json({ success: false, error: "Clarification handling failed" });
  }
});

/**
 * User feedback on AI response
 * POST /api/ai/feedback
 */
router.post("/feedback", async (req, res) => {
  try {
    const { requestId, feedback, rating } = req.body;
    
    if (!requestId) {
      res.status(400).json({ success: false, error: "Request ID is required" });
      return;
    }

    logger.info({ requestId, feedback, rating }, "Recording AI feedback");

    // Placeholder for feedback recording
    // Will be implemented in Phase 10 for observability
    
    res.json({
      success: true,
      message: "Feedback recorded"
    });
  } catch (error) {
    logger.error({ error }, "Feedback recording failed");
    res.status(500).json({ success: false, error: "Feedback recording failed" });
  }
});

/**
 * Get conversation context
 * GET /api/ai/context
 */
router.get("/context", async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      res.status(400).json({ success: false, error: "Session ID is required" });
      return;
    }

    logger.info({ sessionId }, "Getting conversation context");

    // Placeholder for context retrieval
    // Will be implemented in Phase 6 with actual context management
    
    res.json({
      success: true,
      context: {}
    });
  } catch (error) {
    logger.error({ error }, "Context retrieval failed");
    res.status(500).json({ success: false, error: "Context retrieval failed" });
  }
});

/**
 * Clear conversation context
 * DELETE /api/ai/context
 */
router.delete("/context", async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      res.status(400).json({ success: false, error: "Session ID is required" });
      return;
    }

    logger.info({ sessionId }, "Clearing conversation context");

    // Placeholder for context clearing
    // Will be implemented in Phase 6 with actual context management
    
    res.json({
      success: true,
      message: "Context cleared"
    });
  } catch (error) {
    logger.error({ error }, "Context clearing failed");
    res.status(500).json({ success: false, error: "Context clearing failed" });
  }
});

export default router;