-- ============================================================
-- Sprint 3 Migrations
-- ============================================================

-- ─── 1. Gabarito Comentado nas Provas ─────────────────────────
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS gabarito_url            TEXT,
  ADD COLUMN IF NOT EXISTS gabarito_comentado_url  TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_level        TEXT
    CHECK (difficulty_level IN ('facil', 'medio', 'dificil'));

-- ─── 2. Flash Cards (Revisão Espaçada SM-2) ────────────────────
CREATE TABLE IF NOT EXISTS public.flashcard_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  ease_factor   FLOAT DEFAULT 2.5,
  interval_days INT   DEFAULT 1,
  repetitions   INT   DEFAULT 0,
  next_review   DATE  DEFAULT CURRENT_DATE,
  last_reviewed TIMESTAMPTZ,
  UNIQUE(student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_student_review
  ON public.flashcard_progress(student_id, next_review);

ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student rw own flashcards" ON public.flashcard_progress;
CREATE POLICY "student rw own flashcards" ON public.flashcard_progress
  FOR ALL USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

GRANT ALL ON public.flashcard_progress TO authenticated;

-- ─── 3. Temas Semanais de Redação ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.essay_weekly_themes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  source      TEXT,
  target      TEXT DEFAULT 'all' CHECK (target IN ('all', 'enem', 'etec')),
  week_start  DATE NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_essay_themes_week
  ON public.essay_weekly_themes(week_start, target);

ALTER TABLE public.essay_weekly_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read themes" ON public.essay_weekly_themes;
CREATE POLICY "auth read themes" ON public.essay_weekly_themes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin manage themes" ON public.essay_weekly_themes;
CREATE POLICY "admin manage themes" ON public.essay_weekly_themes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND profile_type IN ('admin','staff')
    )
  );

GRANT SELECT ON public.essay_weekly_themes TO authenticated;

-- ─── 4. Colunas na tabela essay_submissions ────────────────────
ALTER TABLE public.essay_submissions
  ADD COLUMN IF NOT EXISTS is_public      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS week_theme_id  UUID
    REFERENCES public.essay_weekly_themes(id);
