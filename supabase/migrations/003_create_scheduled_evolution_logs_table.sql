-- Migration: Create scheduled evolution logs table
-- Description: Table to store scheduled evolution execution history

-- Scheduled Evolution Logs table
CREATE TABLE IF NOT EXISTS qa_scheduled_evolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL, -- 'self_evolution', 'feedback_evolution', 'both'
  self_evolution_summary JSONB,
  feedback_evolution_summary JSONB,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying execution history
CREATE INDEX IF NOT EXISTS idx_qa_scheduled_evolution_logs_executed_at
  ON qa_scheduled_evolution_logs(executed_at DESC);

-- Add comment for documentation
COMMENT ON TABLE qa_scheduled_evolution_logs IS 'Stores scheduled evolution execution history for monitoring and debugging';
COMMENT ON COLUMN qa_scheduled_evolution_logs.mode IS 'Execution mode: self_evolution, feedback_evolution, or both';
COMMENT ON COLUMN qa_scheduled_evolution_logs.self_evolution_summary IS 'Summary of self-evolution results (JSON)';
COMMENT ON COLUMN qa_scheduled_evolution_logs.feedback_evolution_summary IS 'Summary of feedback-driven evolution results (JSON)';
COMMENT ON COLUMN qa_scheduled_evolution_logs.executed_at IS 'When the scheduled execution started';
COMMENT ON COLUMN qa_scheduled_evolution_logs.duration_ms IS 'Total execution duration in milliseconds';
