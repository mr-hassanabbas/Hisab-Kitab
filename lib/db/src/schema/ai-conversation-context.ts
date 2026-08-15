import { pgTable, serial, integer, text, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiConversationContextTable = pgTable("ai_conversation_context", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  session_id: text("session_id").notNull(),
  context_type: text("context_type").notNull(), // 'project', 'worker', 'date', etc.
  context_value: text("context_value").notNull(), // JSON string
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull().default("now"),
}, (table) => ({
  user_session_idx: index("ai_conversation_context_user_session_idx").on(table.user_id, table.session_id),
  expires_at_idx: index("ai_conversation_context_expires_at_idx").on(table.expires_at),
}));

export type AIConversationContext = typeof aiConversationContextTable.$inferSelect;