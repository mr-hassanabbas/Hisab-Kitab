// Migration for Command History Table (Version 1)
import { sql } from 'drizzle-orm';

export async function up(db: any) {
  // Create command_history table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS command_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      transcript TEXT NOT NULL,
      intent TEXT NOT NULL,
      entities JSONB NOT NULL,
      success BOOLEAN NOT NULL,
      response TEXT,
      error TEXT,
      confidence INTEGER,
      language TEXT,
      processing_time INTEGER,
      ai_model TEXT,
      risk_level TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS command_history_user_id_idx ON command_history(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS command_history_session_id_idx ON command_history(session_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS command_history_intent_idx ON command_history(intent)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS command_history_success_idx ON command_history(success)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS command_history_created_at_idx ON command_history(created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS command_history_user_session_idx ON command_history(user_id, session_id)`);

  console.log('Command history table and indexes created successfully');
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS command_history CASCADE`);
  console.log('Command history table dropped successfully');
}
