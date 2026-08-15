import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  whatsappUrl: text("whatsapp_url").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  opened: integer("opened").default(0),
});

export type Reminder = typeof remindersTable.$inferSelect;