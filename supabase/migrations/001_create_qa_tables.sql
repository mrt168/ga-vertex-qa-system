-- QA System Tables Migration
-- Created: 2025-12-06

-- Enable RLS on all tables
-- Note: RLS policies are created separately

-- =====================================================
-- qa_documents: ドキュメントメタデータ
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  generation INT DEFAULT 1,
  current_version INT DEFAULT 1,
  total_good_count INT DEFAULT 0,
  total_bad_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for Drive file lookup
CREATE INDEX IF NOT EXISTS idx_qa_documents_drive_file_id ON qa_documents(drive_file_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_qa_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_qa_documents_updated_at ON qa_documents;
CREATE TRIGGER trigger_qa_documents_updated_at
  BEFORE UPDATE ON qa_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_qa_documents_updated_at();

-- =====================================================
-- qa_sessions: チャットセッション
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user sessions
CREATE INDEX IF NOT EXISTS idx_qa_sessions_user_id ON qa_sessions(user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_qa_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_qa_sessions_updated_at ON qa_sessions;
CREATE TRIGGER trigger_qa_sessions_updated_at
  BEFORE UPDATE ON qa_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_qa_sessions_updated_at();

-- =====================================================
-- qa_messages: チャットメッセージ
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  feedback_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session messages
CREATE INDEX IF NOT EXISTS idx_qa_messages_session_id ON qa_messages(session_id);

-- =====================================================
-- qa_feedback_logs: フィードバックログ
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_feedback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES qa_documents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES qa_messages(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('GOOD', 'BAD')),
  feedback_text TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unprocessed feedback
CREATE INDEX IF NOT EXISTS idx_qa_feedback_logs_processed ON qa_feedback_logs(processed) WHERE processed = FALSE;

-- Index for document feedback
CREATE INDEX IF NOT EXISTS idx_qa_feedback_logs_document_id ON qa_feedback_logs(document_id);

-- Update message with feedback_id
ALTER TABLE qa_messages
ADD CONSTRAINT fk_qa_messages_feedback_id
FOREIGN KEY (feedback_id) REFERENCES qa_feedback_logs(id) ON DELETE SET NULL;

-- =====================================================
-- qa_evolution_history: 進化履歴
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_evolution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES qa_documents(id) ON DELETE CASCADE,
  generation INT NOT NULL,
  mutation_type TEXT NOT NULL,
  win_rate DECIMAL(5, 2),
  trigger_feedback_ids UUID[],
  previous_content_snapshot TEXT,
  new_content_snapshot TEXT,
  rollback_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for document evolution history
CREATE INDEX IF NOT EXISTS idx_qa_evolution_history_document_id ON qa_evolution_history(document_id);

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE qa_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_feedback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_evolution_history ENABLE ROW LEVEL SECURITY;

-- qa_documents: Everyone can read
CREATE POLICY "qa_documents_select_all" ON qa_documents
  FOR SELECT USING (true);

-- qa_sessions: Users can only access their own sessions
CREATE POLICY "qa_sessions_select_own" ON qa_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "qa_sessions_insert_own" ON qa_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qa_sessions_update_own" ON qa_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "qa_sessions_delete_own" ON qa_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- qa_messages: Users can access messages through their sessions
CREATE POLICY "qa_messages_select_via_session" ON qa_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qa_sessions
      WHERE qa_sessions.id = qa_messages.session_id
      AND qa_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "qa_messages_insert_via_session" ON qa_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM qa_sessions
      WHERE qa_sessions.id = qa_messages.session_id
      AND qa_sessions.user_id = auth.uid()
    )
  );

-- qa_feedback_logs: Users can access their own feedback
CREATE POLICY "qa_feedback_logs_select_own" ON qa_feedback_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "qa_feedback_logs_insert_own" ON qa_feedback_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- qa_evolution_history: Everyone can read
CREATE POLICY "qa_evolution_history_select_all" ON qa_evolution_history
  FOR SELECT USING (true);
