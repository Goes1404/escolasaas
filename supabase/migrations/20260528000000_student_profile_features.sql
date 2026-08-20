-- ============================================================
-- STUDENT PROFILE FEATURES
-- Adiciona suporte para: Streaks, Metas, Diário e Resumo Semanal
-- 100% idempotente — seguro rodar múltiplas vezes
-- ============================================================

-- 0. Avatar / perfil (rede de segurança caso a coluna não exista)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS favorite_subject TEXT,
  ADD COLUMN IF NOT EXISTS name_changes_count INT DEFAULT 0;

-- ============================================================
-- 1. STREAKS DE ESTUDO (Ofensiva)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.study_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own streak"   ON public.study_streaks;
DROP POLICY IF EXISTS "Users update own streak" ON public.study_streaks;
DROP POLICY IF EXISTS "Users insert own streak" ON public.study_streaks;

CREATE POLICY "Users see own streak"   ON public.study_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own streak" ON public.study_streaks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own streak" ON public.study_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. METAS PESSOAIS DO ALUNO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('questions', 'essays', 'simulados', 'hours', 'custom')),
  target_value INT NOT NULL CHECK (target_value > 0),
  current_value INT NOT NULL DEFAULT 0,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'custom')),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users CRUD own goals" ON public.student_goals;
CREATE POLICY "Users CRUD own goals" ON public.student_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_student_goals_user_status ON public.student_goals(user_id, status);

-- ============================================================
-- 3. DIÁRIO DE ESTUDOS (REFLEXÃO DIÁRIA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT CHECK (mood IN ('great', 'good', 'neutral', 'tired', 'frustrated')),
  what_studied TEXT,
  what_learned TEXT,
  blocker TEXT,
  hours_studied NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

ALTER TABLE public.study_journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users CRUD own journal" ON public.study_journal_entries;
CREATE POLICY "Users CRUD own journal" ON public.study_journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_journal_user_date ON public.study_journal_entries(user_id, entry_date DESC);

-- ============================================================
-- 4. RESUMOS SEMANAIS (gerados pela Aurora IA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  summary TEXT NOT NULL,
  metrics JSONB,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own summaries"   ON public.weekly_summaries;
DROP POLICY IF EXISTS "Users insert own summaries" ON public.weekly_summaries;

CREATE POLICY "Users see own summaries"   ON public.weekly_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own summaries" ON public.weekly_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week ON public.weekly_summaries(user_id, week_start DESC);
