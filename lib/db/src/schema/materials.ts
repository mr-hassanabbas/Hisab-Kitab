import { pgTable, serial, integer, text, real } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  material_type: text("material_type").notNull(),
  custom_name: text("custom_name"),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull().default("bags"),
  rate: real("rate").notNull(),
  total_cost: real("total_cost").notNull(),
  supplier: text("supplier"),
  remarks: text("remarks"),
  created_at: text("created_at").notNull().default("now"),
});

export type Material = typeof materialsTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertMaterialSchema = createInsertSchema(materialsTable, {
  project_id: z.coerce.number(),
  quantity: z.coerce.number(),
  rate: z.coerce.number(),
  total_cost: z.coerce.number(),
}).omit({ id: true, created_at: true, custom_name: true, rate: true, remarks: true })
  .extend({
    quantity: z.coerce.number().positive(),
    rate_per_unit: z.coerce.number().positive(),
    total_cost: z.coerce.number().positive().optional(),
    description: z.string().optional(),
    supplier: z.string().optional(),
    notes: z.string().optional(),
  });
