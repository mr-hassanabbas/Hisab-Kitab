import { pgTable, serial, integer, text, real } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const ownerPaymentsTable = pgTable("owner_payments", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  payment_method: text("payment_method").notNull().default("cash"),
  receipt_photo: text("receipt_photo"),
  notes: text("notes"),
  created_at: text("created_at").notNull().default("now"),
});

export type OwnerPayment = typeof ownerPaymentsTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertOwnerPaymentSchema = createInsertSchema(ownerPaymentsTable, {
  project_id: z.coerce.number(),
  amount: z.coerce.number(),
}).omit({ id: true, created_at: true }).extend({
  amount: z.coerce.number().positive(),
});
