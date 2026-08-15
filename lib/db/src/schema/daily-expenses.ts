import { pgTable, serial, integer, text, real } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const dailyExpensesTable = pgTable("daily_expenses", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  category: text("category").notNull(),
  custom_name: text("custom_name"),
  amount: real("amount").notNull(),
  remarks: text("remarks"),
  created_at: text("created_at").notNull().default("now"),
});

export type DailyExpense = typeof dailyExpensesTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertExpenseSchema = createInsertSchema(dailyExpensesTable, {
  project_id: z.coerce.number(),
  amount: z.coerce.number(),
}).omit({ id: true, created_at: true, custom_name: true, remarks: true }).extend({
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  paid_to: z.string().optional(),
});
