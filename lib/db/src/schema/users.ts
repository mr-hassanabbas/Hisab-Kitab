import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Muhammad Arshad"),
  mobile: text("mobile").notNull().unique(),
  pin_hash: text("pin_hash").notNull(),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("system"),
  role: text("role").notNull().default("admin"),
  created_at: text("created_at").notNull().default("now"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
