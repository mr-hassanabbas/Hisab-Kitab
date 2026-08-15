// Database Performance Optimization Migration
// This script adds strategic indexes for AI-related queries

import { sql } from 'drizzle-orm';

export async function up(db: any) {
  // Add trigram extension for fuzzy name search
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  // Add trigram index for labour name fuzzy search
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_labour_name_trigram 
    ON labour USING gin(name gin_trgm_ops);
  `);

  // Add index for labour nicknames array search
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_labour_nicknames 
    ON labour USING gin(nicknames);
  `);

  // Add composite index for attendance queries (date + project + labour)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_date_project_labour 
    ON attendance(date, project_id, labour_id);
  `);

  // Add index for attendance status queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_status 
    ON attendance(status);
  `);

  // Add composite index for AI action logs (user + created_at DESC)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_action_logs_user_created 
    ON ai_action_logs(user_id, created_at DESC);
  `);

  // Add index for AI action logs by session and created_at
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_action_logs_session_created 
    ON ai_action_logs(session_id, created_at DESC);
  `);

  // Add index for AI action logs by tool name
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_action_logs_tool_name 
    ON ai_action_logs(tool_name);
  `);

  // Add index for AI action logs by cost tracking
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_action_logs_cost_tracking 
    ON ai_action_logs(created_at, cost_usd);
  `);

  // Add index for conversation context expiration
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conversation_context_expires 
    ON ai_conversation_context(expires_at);
  `);

  // Add index for conversation context user session
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conversation_context_user_session 
    ON ai_conversation_context(user_id, session_id);
  `);

  // Add index for tool execution logs by action log
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_action 
    ON tool_execution_logs(action_log_id);
  `);

  // Add index for tool execution logs by tool name
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_tool 
    ON tool_execution_logs(tool_name);
  `);

  // Add index for tool execution logs by execution time
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_execution_time 
    ON tool_execution_logs(execution_time_ms);
  `);

  console.log('Performance optimization indexes created successfully');
}

export async function down(db: any) {
  // Rollback all performance optimization indexes
  const indexes = [
    'idx_labour_name_trigram',
    'idx_labour_nicknames',
    'idx_attendance_date_project_labour',
    'idx_attendance_status',
    'idx_ai_action_logs_user_created',
    'idx_ai_action_logs_session_created',
    'idx_ai_action_logs_tool_name',
    'idx_ai_action_logs_cost_tracking',
    'idx_conversation_context_expires',
    'idx_conversation_context_user_session',
    'idx_tool_execution_logs_action',
    'idx_tool_execution_logs_tool',
    'idx_tool_execution_logs_execution_time'
  ];

  for (const indexName of indexes) {
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(indexName)}`);
  }

  console.log('Performance optimization indexes dropped successfully');
}
