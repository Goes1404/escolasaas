-- ============================================================
-- Migration: 20260706100000_create_missions.sql
-- Sprint 2: Missões Semanais + Progress Tracking
-- ============================================================

-- ─── 1. Tabela de missões semanais ───────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_missions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL,
  target       TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'enem', 'etec')),
  title        TEXT NOT NULL,
  description  TEXT,
  icon         TEXT DEFAULT '🎯',
  action_type  TEXT NOT NULL,
  -- action_type values: 'answer_questions', 'complete_simulados',
  --                     'submit_essay', 'maintain_streak', 'checkin'
  goal         INT  NOT NULL DEFAULT 1,
  xp_reward    INT  NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missions_week  ON public.weekly_missions(week_start, target);

-- ─── 2. Progresso por aluno ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mission_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id   UUID NOT NULL REFERENCES public.weekly_missions(id) ON DELETE CASCADE,
  progress     INT  DEFAULT 0,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  xp_granted   BOOLEAN DEFAULT FALSE,
  UNIQUE(student_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_prog_student ON public.mission_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_mission_prog_mission ON public.mission_progress(mission_id);

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.weekly_missions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress  ENABLE ROW LEVEL SECURITY;

-- Missões: todos os autenticados leem
DROP POLICY IF EXISTS "auth read missions" ON public.weekly_missions;
CREATE POLICY "auth read missions" ON public.weekly_missions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Progresso: aluno lê e insere/atualiza os próprios
DROP POLICY IF EXISTS "student read own progress" ON public.mission_progress;
CREATE POLICY "student read own progress" ON public.mission_progress
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "student upsert own progress" ON public.mission_progress;
CREATE POLICY "student upsert own progress" ON public.mission_progress
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "student update own progress" ON public.mission_progress;
CREATE POLICY "student update own progress" ON public.mission_progress
  FOR UPDATE USING (auth.uid() = student_id);

-- ─── 4. Grants ───────────────────────────────────────────────
GRANT SELECT ON public.weekly_missions   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mission_progress TO authenticated;

-- ─── 5. Seed: missões da semana atual ────────────────────────
-- (Serão inseridas pelo script seed_weekly_missions.mjs semanalmente)
-- Inserindo para a semana atual como bootstrap:
INSERT INTO public.weekly_missions (week_start, target, title, description, icon, action_type, goal, xp_reward)
VALUES
  (date_trunc('week', CURRENT_DATE)::DATE, 'all',  'Maratonista',        'Responda 20 questões esta semana',    '⚡', 'answer_questions',    20,  100),
  (date_trunc('week', CURRENT_DATE)::DATE, 'all',  'Simulador',          'Complete 2 simulados esta semana',    '🏆', 'complete_simulados',   2,  150),
  (date_trunc('week', CURRENT_DATE)::DATE, 'all',  'Escritor',           'Envie uma redação esta semana',       '✍️', 'submit_essay',         1,  200),
  (date_trunc('week', CURRENT_DATE)::DATE, 'all',  'Desafiante',         'Responda 5 Desafios Diários',         '🎯', 'daily_question',       5,  120),
  (date_trunc('week', CURRENT_DATE)::DATE, 'all',  'Presença Garantida', 'Faça check-in em 2 aulas esta semana','📋', 'checkin',              2,   80)
ON CONFLICT DO NOTHING;
