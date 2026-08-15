import { pgTable, serial, integer, real, text, unique } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { labourTable } from "./labour";

export const projectLabourTable = pgTable("project_labour", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  labour_id: integer("labour_id").notNull().references(() => labourTable.id, { onDelete: "cascade" }),
  daily_wage: real("daily_wage").notNull(),
  assigned_at: text("assigned_at").notNull().default("now"),
  removed_at: text("removed_at"),
}, (t) => [unique().on(t.project_id, t.labour_id)]);

export type ProjectLabour = typeof projectLabourTable.$inferSelect;
