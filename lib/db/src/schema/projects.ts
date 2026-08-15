import { pgTable, serial, text, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  project_code: text("project_code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("running"),
  owner_name: text("owner_name").notNull(),
  owner_phone: text("owner_phone"),
  owner_cnic: text("owner_cnic"),
  location: text("location").notNull(),
  site_address: text("site_address"),
  agreement_amount: real("agreement_amount"),
  start_date: text("start_date"),
  expected_end: text("expected_end"),
  notes: text("notes"),
  created_at: text("created_at").notNull().default("now"),
  updated_at: text("updated_at").notNull().default("now"),
}, (table) => ({
  name_search_idx: index("projects_name_search_idx").on(table.name),
}));

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
