-- Provas Completas: exams, exam_questions, exam_attempts

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  year INTEGER,
  exam_type TEXT NOT NULL DEFAULT 'enem',
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE(exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_question_id ON exam_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);

-- RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- exams: anyone authenticated can read; only teachers/admins can write
CREATE POLICY "exams_select" ON exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_insert" ON exams FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "exams_update" ON exams FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "exams_delete" ON exams FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- exam_questions: readable by all authenticated; writable by exam owner
CREATE POLICY "exam_questions_select" ON exam_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_questions_insert" ON exam_questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM exams WHERE id = exam_id AND teacher_id = auth.uid()));
CREATE POLICY "exam_questions_delete" ON exam_questions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM exams WHERE id = exam_id AND teacher_id = auth.uid()));

-- exam_attempts: users manage their own attempts
CREATE POLICY "exam_attempts_select" ON exam_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exam_attempts_insert" ON exam_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
