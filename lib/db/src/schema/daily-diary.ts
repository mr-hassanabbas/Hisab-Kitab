import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const dailyDiaryTable = pgTable("daily_diary", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  note: text("note").notNull(),
  work_summary: text("work_summary"),
  weather: text("weather"),
  extra_notes: text("extra_notes"),
  created_at: text("created_at").notNull().default("now"),
}, (t) => [unique().on(t.project_id, t.date)]);

export type DailyDiary = typeof dailyDiaryTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertDiarySchema = createInsertSchema(dailyDiaryTable, {
  project_id: z.coerce.number(),
  note: z.string().optional(),
}).omit({ id: true, created_at: true, note: true }).extend({
  work_summary: z.string().optional(),
  weather: z.string().optional(),
  notes: z.string().optional(),
});
