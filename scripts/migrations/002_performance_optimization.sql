-- Performance Optimization Migration
-- This migration adds strategic indexes for improved query performance

-- Worker name search optimization (trigram index for fuzzy search)
-- Note: Requires pg_trgm extension to be installed
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_labour_name_trigram 
--   ON labour USING gin(name gin_trgm_ops);

-- Attendance queries optimization (composite index for date + project)
CREATE INDEX IF NOT EXISTS idx_attendance_date_project 
  ON attendance(date, project_id);

-- Expense queries optimization (composite index for date + project)
CREATE INDEX IF NOT EXISTS idx_daily_expenses_date_project 
  ON daily_expenses(date, project_id);

-- Payment queries optimization (composite index for date + worker)
CREATE INDEX IF NOT EXISTS idx_payment_date_worker 
  ON payment(date, labour_id);

-- Project labour assignment optimization
CREATE INDEX IF NOT EXISTS idx_project_labour_project 
  ON project_labour(project_id);

-- Project labour assignment optimization (composite)
CREATE INDEX IF NOT EXISTS idx_project_labour_project_labour 
  ON project_labour(project_id, labour_id);

-- AI audit log queries optimization (composite index for user + created_at)
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_user_created 
  ON ai_audit_log(user_id, executed_at DESC);

-- AI tool execution log queries optimization (composite index for tool + executed_at)
CREATE INDEX IF NOT EXISTS idx_ai_tool_execution_log_tool_created 
  ON ai_tool_execution_log(tool_name, executed_at DESC);

-- Worker nickname search optimization
CREATE INDEX IF NOT EXISTS idx_labour_nickname 
  ON labour(nickname);

-- Project code search optimization
CREATE INDEX IF NOT EXISTS idx_projects_code 
  ON projects(code);

-- Comments for documentation
COMMENT ON INDEX idx_attendance_date_project IS 'Optimizes attendance queries by date and project';
COMMENT ON INDEX idx_daily_expenses_date_project IS 'Optimizes expense queries by date and project';
COMMENT ON INDEX idx_payment_date_worker IS 'Optimizes payment queries by date and worker';
COMMENT ON INDEX idx_project_labour_project IS 'Optimizes project labour queries by project';
COMMENT ON INDEX idx_project_labour_project_labour IS 'Optimizes project labour queries by project and worker';
COMMENT ON INDEX idx_ai_audit_log_user_created IS 'Optimizes AI audit log queries by user and time';
COMMENT ON INDEX idx_ai_tool_execution_log_tool_created IS 'Optimizes AI tool execution log queries by tool and time';
COMMENT ON INDEX idx_labour_nickname IS 'Optimizes worker nickname searches';
COMMENT ON INDEX idx_projects_code IS 'Optimizes project code searches';