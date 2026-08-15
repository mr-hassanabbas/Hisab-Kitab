import { pgTable, serial, integer, text, decimal, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiActionLogsTable = pgTable("ai_action_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  session_id: text("session_id"),
  request_id: text("request_id").notNull().unique(),
  original_transcript: text("original_transcript").notNull(),
  normalized_transcript: text("normalized_transcript"),
  detected_intent: text("detected_intent"),
  tool_name: text("tool_name"),
  tool_parameters: text("tool_parameters"), // JSON string
  validation_result: text("validation_result"),
  permission_check_result: text("permission_check_result"),
  risk_level: text("risk_level"),
  confirmation_required: text("confirmation_required").default("false"),
  confirmation_given: text("confirmation_given"),
  execution_result: text("execution_result"),
  execution_error: text("execution_error"),
  model_used: text("model_used"),
  provider_used: text("provider_used"),
  tokens_used: integer("tokens_used"),
  cost_usd: decimal("cost_usd", { precision: 10, scale: 6 }),
  latency_ms: integer("latency_ms"),
  created_at: text("created_at").notNull().default("now"),
}, (table) => ({
  user_id_idx: index("ai_action_logs_user_id_idx").on(table.user_id),
  session_id_idx: index("ai_action_logs_session_id_idx").on(table.session_id),
  request_id_idx: index("ai_action_logs_request_id_idx").on(table.request_id),
  created_at_idx: index("ai_action_logs_created_at_idx").on(table.created_at),
}));

export type AIActionLog = typeof aiActionLogsTable.$inferSelect;