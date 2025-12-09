-- Interpretation Layer Tables Migration
-- Created: 2025-12-08
-- Description: Add tables for the interpretation layer that allows
--              improving QA responses without modifying source documents

-- =====================================================
-- qa_interpretation_rules: 解釈ルール
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_interpretation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES qa_documents(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('CONTEXT', 'CLARIFICATION', 'FORMAT', 'MISUNDERSTANDING', 'RELATED')),
  content TEXT NOT NULL,
  trigger_pattern TEXT,
  generation INT NOT NULL DEFAULT 1,
  score DECIMAL(3, 2) NOT NULL DEFAULT 0.5 CHECK (score >= 0 AND score <= 1),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source_feedback_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for document rules lookup
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_rules_document_id ON qa_interpretation_rules(document_id);

-- Index for enabled rules
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_rules_enabled ON qa_interpretation_rules(enabled) WHERE enabled = TRUE;

-- Index for rule type filtering
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_rules_rule_type ON qa_interpretation_rules(rule_type);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_rules_doc_enabled_score ON qa_interpretation_rules(document_id, enabled, score DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_qa_interpretation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_qa_interpretation_rules_updated_at ON qa_interpretation_rules;
CREATE TRIGGER trigger_qa_interpretation_rules_updated_at
  BEFORE UPDATE ON qa_interpretation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_qa_interpretation_rules_updated_at();

-- =====================================================
-- qa_interpretation_applications: ルール適用履歴
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_interpretation_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES qa_interpretation_rules(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES qa_messages(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rule application lookup
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_applications_rule_id ON qa_interpretation_applications(rule_id);

-- Index for session application lookup
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_applications_session_id ON qa_interpretation_applications(session_id);

-- Index for recent applications
CREATE INDEX IF NOT EXISTS idx_qa_interpretation_applications_applied_at ON qa_interpretation_applications(applied_at DESC);

-- =====================================================
-- RLS Policies for Interpretation Layer
-- =====================================================

-- Enable RLS
ALTER TABLE qa_interpretation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_interpretation_applications ENABLE ROW LEVEL SECURITY;

-- qa_interpretation_rules: Authenticated users can read all rules
CREATE POLICY "qa_interpretation_rules_select_authenticated" ON qa_interpretation_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- qa_interpretation_rules: Allow service role to manage rules
-- Note: In production, you may want to restrict this to admin users
CREATE POLICY "qa_interpretation_rules_insert_authenticated" ON qa_interpretation_rules
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "qa_interpretation_rules_update_authenticated" ON qa_interpretation_rules
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "qa_interpretation_rules_delete_authenticated" ON qa_interpretation_rules
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- qa_interpretation_applications: Users can access through their sessions
CREATE POLICY "qa_interpretation_applications_select_via_session" ON qa_interpretation_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qa_sessions
      WHERE qa_sessions.id = qa_interpretation_applications.session_id
      AND qa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "qa_interpretation_applications_insert_via_session" ON qa_interpretation_applications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM qa_sessions
      WHERE qa_sessions.id = qa_interpretation_applications.session_id
      AND qa_sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- Add processed column to qa_feedback_logs if not exists
-- This is used to track which feedback has been processed by evolution
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_feedback_logs'
    AND column_name = 'processed'
  ) THEN
    ALTER TABLE qa_feedback_logs ADD COLUMN processed BOOLEAN DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS idx_qa_feedback_logs_processed ON qa_feedback_logs(processed) WHERE processed = FALSE;
  END IF;
END $$;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE qa_interpretation_rules IS 'Interpretation rules for improving QA responses without modifying source documents';
COMMENT ON COLUMN qa_interpretation_rules.rule_type IS 'Type of rule: CONTEXT (background info), CLARIFICATION (disambiguation), FORMAT (response format), MISUNDERSTANDING (common mistakes), RELATED (cross-references)';
COMMENT ON COLUMN qa_interpretation_rules.trigger_pattern IS 'Optional regex or keyword pattern to trigger this rule. NULL means always apply.';
COMMENT ON COLUMN qa_interpretation_rules.score IS 'Fitness score between 0 and 1, updated based on user feedback';
COMMENT ON COLUMN qa_interpretation_rules.generation IS 'Evolution generation number';
COMMENT ON COLUMN qa_interpretation_rules.source_feedback_ids IS 'Array of feedback IDs that triggered the creation of this rule';

COMMENT ON TABLE qa_interpretation_applications IS 'Tracks when and where interpretation rules are applied';
