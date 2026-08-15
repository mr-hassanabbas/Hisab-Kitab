import { logger } from "../lib/logger.js";
import { dbExec, dbInsert, queryGet } from "../lib/db.js";

export interface AIActionLog {
  userId?: number;
  sessionId: string;
  requestId: string;
  originalTranscript: string;
  normalizedTranscript?: string;
  detectedIntent?: string;
  toolName?: string;
  toolParameters?: string;
  validationResult?: string;
  permissionCheckResult?: string;
  riskLevel?: string;
  confirmationRequired?: string;
  confirmationGiven?: string;
  executionResult?: string;
  executionError?: string;
  modelUsed?: string;
  providerUsed?: string;
  tokensUsed?: number;
  costUsd?: number;
  latencyMs?: number;
}

export class AuditService {
  /**
   * Log AI action to database
   */
  async logAIAction(actionLog: AIActionLog): Promise<number> {
    logger.info({ actionLog }, "Logging AI action");
    
    try {
      const result = await dbInsert(
        `INSERT INTO ai_action_logs 
         (user_id, session_id, request_id, original_transcript, normalized_transcript, 
          detected_intent, tool_name, tool_parameters, validation_result, 
          permission_check_result, risk_level, confirmation_required, confirmation_given,
          execution_result, execution_error, model_used, provider_used, tokens_used, 
          cost_usd, latency_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actionLog.userId || null,
          actionLog.sessionId,
          actionLog.requestId,
          actionLog.originalTranscript,
          actionLog.normalizedTranscript || null,
          actionLog.detectedIntent || null,
          actionLog.toolName || null,
          actionLog.toolParameters ? JSON.stringify(actionLog.toolParameters) : null,
          actionLog.validationResult || null,
          actionLog.permissionCheckResult || null,
          actionLog.riskLevel || null,
          actionLog.confirmationRequired || "false",
          actionLog.confirmationGiven || null,
          actionLog.executionResult || null,
          actionLog.executionError || null,
          actionLog.modelUsed || null,
          actionLog.providerUsed || null,
          actionLog.tokensUsed || null,
          actionLog.costUsd || null,
          actionLog.latencyMs || null
        ]
      );
      
      return result.id;
    } catch (error) {
      logger.error({ error }, "Failed to log AI action");
      throw error;
    }
  }

  /**
   * Get AI action log by request ID
   */
  async getActionLog(requestId: string): Promise<AIActionLog | null> {
    logger.info({ requestId }, "Getting AI action log");
    
    try {
      const log = await queryGet<any>(
        `SELECT * FROM ai_action_logs WHERE request_id = ?`,
        [requestId]
      );
      
      if (!log) return null;
      
      return {
        userId: log.user_id,
        sessionId: log.session_id,
        requestId: log.request_id,
        originalTranscript: log.original_transcript,
        normalizedTranscript: log.normalized_transcript,
        detectedIntent: log.detected_intent,
        toolName: log.tool_name,
        toolParameters: log.tool_parameters ? JSON.parse(log.tool_parameters) : undefined,
        validationResult: log.validation_result,
        permissionCheckResult: log.permission_check_result,
        riskLevel: log.risk_level,
        confirmationRequired: log.confirmation_required,
        confirmationGiven: log.confirmation_given,
        executionResult: log.execution_result,
        executionError: log.execution_error,
        modelUsed: log.model_used,
        providerUsed: log.provider_used,
        tokensUsed: log.tokens_used,
        costUsd: log.cost_usd,
        latencyMs: log.latency_ms
      };
    } catch (error) {
      logger.error({ error, requestId }, "Failed to get AI action log");
      throw error;
    }
  }

  /**
   * Get AI action logs for a user
   */
  async getUserActionLogs(userId: number, limit: number = 50, offset: number = 0): Promise<AIActionLog[]> {
    logger.info({ userId, limit, offset }, "Getting user AI action logs");
    
    try {
      const logs = await queryGet<any>(
        `SELECT * FROM ai_action_logs 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );
      
      return logs ? [logs] : [];
    } catch (error) {
      logger.error({ error, userId }, "Failed to get user AI action logs");
      throw error;
    }
  }

  /**
   * Log tool execution
   */
  async logToolExecution(actionLogId: number, toolName: string, parameters: any, result: any, executionTimeMs: number, success: boolean, error?: string): Promise<void> {
    logger.info({ actionLogId, toolName, success }, "Logging tool execution");
    
    try {
      await dbInsert(
        `INSERT INTO tool_execution_logs 
         (action_log_id, tool_name, input_parameters, output_result, execution_time_ms, success, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          actionLogId,
          toolName,
          JSON.stringify(parameters),
          JSON.stringify(result),
          executionTimeMs,
          success ? "true" : "false",
          error || null
        ]
      );
    } catch (error) {
      logger.error({ error, actionLogId, toolName }, "Failed to log tool execution");
      throw error;
    }
  }
}