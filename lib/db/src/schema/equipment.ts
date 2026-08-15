import { pgTable, serial, integer, text, real } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const equipmentTable = pgTable("equipment", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  custom_name: text("custom_name"),
  quantity: integer("quantity").notNull().default(1),
  price: real("price").notNull(),
  condition_note: text("condition_note"),
  purchase_date: text("purchase_date"),
  remarks: text("remarks"),
  is_active: integer("is_active").notNull().default(1),
  created_at: text("created_at").notNull().default("now"),
});

export type Equipment = typeof equipmentTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertEquipmentSchema = createInsertSchema(equipmentTable).omit({ id: true, created_at: true }).extend({
  price: z.number().positive(),
});
