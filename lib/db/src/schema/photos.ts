import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const photosTable = pgTable("photos", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  file_path: text("file_path").notNull(),
  category: text("category").notNull().default("progress"),
  caption: text("caption"),
  date_taken: text("date_taken"),
  created_at: text("created_at").notNull().default("now"),
});

export type Photo = typeof photosTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertPhotoSchema = createInsertSchema(photosTable).omit({ id: true, created_at: true });
