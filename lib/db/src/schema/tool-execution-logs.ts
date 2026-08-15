import { pgTable, serial, integer, text, index } from "drizzle-orm/pg-core";
import { aiActionLogsTable } from "./ai-action-logs";

export const toolExecutionLogsTable = pgTable("tool_execution_logs", {
  id: serial("id").primaryKey(),
  action_log_id: integer("action_log_id").references(() => aiActionLogsTable.id, { onDelete: "cascade" }),
  tool_name: text("tool_name").notNull(),
  tool_version: text("tool_version"),
  input_parameters: text("input_parameters"), // JSON string
  output_result: text("output_result"), // JSON string
  execution_time_ms: integer("execution_time_ms"),
  success: text("success").default("false"),
  error_message: text("error_message"),
  database_operations: text("database_operations"), // JSON array string
  created_at: text("created_at").notNull().default("now"),
}, (table) => ({
  action_log_id_idx: index("tool_execution_logs_action_log_id_idx").on(table.action_log_id),
  tool_name_idx: index("tool_execution_logs_tool_name_idx").on(table.tool_name),
}));

export type ToolExecutionLog = typeof toolExecutionLogsTable.$inferSelect;