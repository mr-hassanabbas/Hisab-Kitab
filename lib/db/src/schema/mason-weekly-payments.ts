import { pgTable, serial, integer, text, real } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { masonTable } from "./mason";

export const masonWeeklyPaymentsTable = pgTable("mason_weekly_payments", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  mason_id: integer("mason_id").notNull().references(() => masonTable.id, { onDelete: "cascade" }),
  week_start: text("week_start").notNull(),
  week_end: text("week_end").notNull(),
  days_worked: real("days_worked").notNull().default(0),
  half_days: integer("half_days").notNull().default(0),
  total_earned: real("total_earned").notNull().default(0),
  advance_total: real("advance_total").notNull().default(0),
  previous_balance: real("previous_balance").notNull().default(0),
  amount_paid: real("amount_paid").notNull().default(0),
  remaining: real("remaining").notNull().default(0),
  is_paid: integer("is_paid").notNull().default(0),
  paid_at: text("paid_at"),
  remarks: text("remarks"),
  breakdown: text("breakdown"),
  created_at: text("created_at").notNull().default("now"),
});

export type MasonWeeklyPayment = typeof masonWeeklyPaymentsTable.$inferSelect;
