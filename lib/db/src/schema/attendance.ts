import { pgTable, serial, integer, text, real, unique, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { labourTable } from "./labour";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  labour_id: integer("labour_id").notNull().references(() => labourTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  status: text("status").notNull(),
  wage_for_day: real("wage_for_day").notNull().default(0),
  overtime_hours: real("overtime_hours").notNull().default(0),
  overtime_pay: real("overtime_pay").notNull().default(0),
  advance_given: real("advance_given").notNull().default(0),
  remarks: text("remarks"),
  deleted_at: text("deleted_at"),
  created_at: text("created_at").notNull().default("now"),
}, (t) => [
  unique().on(t.project_id, t.labour_id, t.date),
  index("attendance_date_project_idx").on(t.date, t.project_id),
]);

export type Attendance = typeof attendanceTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const insertAttendanceSchema = createInsertSchema(attendanceTable, {
  project_id: z.coerce.number(),
  labour_id: z.coerce.number(),
  advance_given: z.coerce.number().optional(),
  overtime_hours: z.coerce.number().min(0).optional(),
}).omit({ id: true, created_at: true, wage_for_day: true, overtime_pay: true, deleted_at: true }).extend({
  date: z.string().refine((val) => new Date(val) <= new Date(), { message: "Date cannot be in the future" }),
});
