-- ============================================================
-- Migration: 20260706000000_create_gamification.sql
-- Extends gamification: XP log, daily questions, ranking
-- Integrates with existing xp_points (profiles) + study_streaks
-- ============================================================

-- ─── 1. XP Log (histórico temporal para ranking semanal) ─────
-- Obs: xp_points em profiles já existe. Este log é ADICIONAL
-- para calcular ranking semanal (que precisa de data/hora).
CREATE TABLE IF NOT EXISTS public.student_xp_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  xp_earned     INT  NOT NULL DEFAULT 0,
  reference_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_log_student ON public.student_xp_log(student_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_created ON public.student_xp_log(created_at DESC);

-- ─── 2. View de ranking semanal ──────────────────────────────
-- Usa student_xp_log para calcular XP ganho ESTA semana
CREATE OR REPLACE VIEW public.weekly_ranking AS
SELECT
  p.id          AS student_id,
  p.full_name,
  p.avatar_url,
  p.exam_target,
  p.xp_points   AS total_xp,
  COALESCE(SUM(xl.xp_earned), 0)::INT AS weekly_xp,
  RANK() OVER (
    PARTITION BY p.exam_target
    ORDER BY COALESCE(SUM(xl.xp_earned), 0) DESC
  ) AS position
FROM public.profiles p
LEFT JOIN public.student_xp_log xl
  ON xl.student_id = p.id
  AND xl.created_at >= date_trunc('week', now())
WHERE p.profile_type = 'student'
GROUP BY p.id, p.full_name, p.avatar_url, p.exam_target, p.xp_points;

-- ─── 3. Questão do Dia ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('enem', 'etec')),
  scheduled_date  DATE NOT NULL,
  UNIQUE(target_audience, scheduled_date)
);

CREATE TABLE IF NOT EXISTS public.daily_question_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_id       UUID NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  question_date  DATE NOT NULL,
  selected_option TEXT,
  is_correct     BOOLEAN,
  answered_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, daily_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_q_date  ON public.daily_questions(scheduled_date, target_audience);
CREATE INDEX IF NOT EXISTS idx_daily_ans_std ON public.daily_question_answers(student_id, question_date);

-- ─── 4. RLS ──────────────────────────────────────────────────
ALTER TABLE public.student_xp_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_question_answers ENABLE ROW LEVEL SECURITY;

-- XP Log
DROP POLICY IF EXISTS "students read own xp"   ON public.student_xp_log;
DROP POLICY IF EXISTS "students insert own xp" ON public.student_xp_log;

CREATE POLICY "students read own xp" ON public.student_xp_log
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "students insert own xp" ON public.student_xp_log
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Questão do dia: todos os autenticados lêem
DROP POLICY IF EXISTS "authenticated read daily_questions" ON public.daily_questions;
CREATE POLICY "authenticated read daily_questions" ON public.daily_questions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Respostas do dia
DROP POLICY IF EXISTS "students read own daily answers" ON public.daily_question_answers;
DROP POLICY IF EXISTS "students insert own daily answers" ON public.daily_question_answers;

CREATE POLICY "students read own daily answers" ON public.daily_question_answers
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "students insert own daily answers" ON public.daily_question_answers
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- ─── 5. Grants ───────────────────────────────────────────────
GRANT SELECT ON public.weekly_ranking        TO authenticated;
GRANT INSERT ON public.student_xp_log        TO authenticated;
GRANT SELECT ON public.daily_questions       TO authenticated;
GRANT INSERT, SELECT ON public.daily_question_answers TO authenticated;
