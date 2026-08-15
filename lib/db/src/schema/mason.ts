import { pgTable, serial, text, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masonTable = pgTable("mason", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  cnic: text("cnic"),
  fathers_name: text("fathers_name"),
  village: text("village"),
  photo_path: text("photo_path"),
  daily_wage: real("daily_wage").default(0),
  overtime_rate_per_hour: real("overtime_rate_per_hour").default(0),
  joining_date: text("joining_date"),
  remarks: text("remarks"),
  is_active: integer("is_active").notNull().default(1),
  created_at: text("created_at").notNull().default("now"),
});

export const insertMasonSchema = createInsertSchema(masonTable, {
  daily_wage: z.coerce.number().optional(),
  overtime_rate_per_hour: z.coerce.number().optional(),
}).omit({ id: true, created_at: true });
export type InsertMason = z.infer<typeof insertMasonSchema>;
export type Mason = typeof masonTable.$inferSelect;
