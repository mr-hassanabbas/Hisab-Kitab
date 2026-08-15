// Command History Database Schema for Version 1
// Persisted command history with full search and export capabilities

import { pgTable, serial, index, timestamp, integer, text, boolean, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const commandHistory = pgTable('command_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  transcript: text('transcript').notNull(),
  intent: text('intent').notNull(),
  entities: json('entities').notNull().$type<Record<string, any>>(),
  success: boolean('success').notNull(),
  response: text('response'),
  error: text('error'),
  confidence: integer('confidence'), // 0-100
  language: text('language'),
  processingTime: integer('processing_time'), // milliseconds
  aiModel: text('ai_model'),
  riskLevel: text('risk_level'),
  metadata: json('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('command_history_user_id_idx').on(table.userId),
  sessionIdIdx: index('command_history_session_id_idx').on(table.sessionId),
  intentIdx: index('command_history_intent_idx').on(table.intent),
  successIdx: index('command_history_success_idx').on(table.success),
  createdAtIdx: index('command_history_created_at_idx').on(table.createdAt),
  userIdSessionIdx: index('command_history_user_session_idx').on(table.userId, table.sessionId),
}));

export type CommandHistory = typeof commandHistory.$inferSelect;
export type NewCommandHistory = typeof commandHistory.$inferInsert;
