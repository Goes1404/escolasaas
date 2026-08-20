-- Caderno de Anotações do Aluno
CREATE TABLE IF NOT EXISTS notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'Sem título',
  blocks      JSONB       NOT NULL DEFAULT '[]',
  subject_id  UUID        REFERENCES subjects(id) ON DELETE SET NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  is_pinned   BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_owner" ON notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX notes_user_updated ON notes (user_id, updated_at DESC);
