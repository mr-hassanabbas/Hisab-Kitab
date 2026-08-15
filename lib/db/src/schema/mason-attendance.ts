import { pgTable, serial, integer, text, real, unique } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { masonTable } from "./mason";

export const masonAttendanceTable = pgTable("mason_attendance", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  mason_id: integer("mason_id").notNull().references(() => masonTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  status: text("status").notNull(),
  wage_for_day: real("wage_for_day").notNull().default(0),
  advance_given: real("advance_given").notNull().default(0),
  remarks: text("remarks"),
  created_at: text("created_at").notNull().default("now"),
}, (t) => [unique().on(t.project_id, t.mason_id, t.date)]);

export type MasonAttendance = typeof masonAttendanceTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertMasonAttendanceSchema = createInsertSchema(masonAttendanceTable, {
  project_id: z.coerce.number(),
  mason_id: z.coerce.number(),
  advance_given: z.coerce.number().optional(),
}).omit({ id: true, created_at: true, wage_for_day: true }).extend({
  date: z.string().refine((val) => new Date(val) <= new Date(), { message: "Date cannot be in the future" }),
});
