import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  table_name: text("table_name").notNull(),
  record_id: integer("record_id").notNull(),
  action: text("action").notNull(),
  old_values: text("old_values"),
  new_values: text("new_values"),
  changed_at: text("changed_at").notNull().default("now"),
});

export type AuditLog = typeof auditLogTable.$inferSelect;
