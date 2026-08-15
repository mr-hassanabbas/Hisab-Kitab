import { pgTable, serial, integer, real, text, unique } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { masonTable } from "./mason";

export const projectMasonTable = pgTable("project_mason", {
  id: serial("id").primaryKey(),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  mason_id: integer("mason_id").notNull().references(() => masonTable.id, { onDelete: "cascade" }),
  daily_wage: real("daily_wage").notNull(),
  assigned_at: text("assigned_at").notNull().default("now"),
  removed_at: text("removed_at"),
}, (t) => [unique().on(t.project_id, t.mason_id)]);

export type ProjectMason = typeof projectMasonTable.$inferSelect;
