-- Migration: sprint4_migrations.sql
-- Fase 4: Relatórios e Transparência (Guardian Tokens e Acesso Público a Stats)

CREATE TABLE IF NOT EXISTS public.guardian_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.guardian_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual read/write guardian_tokens" ON public.guardian_tokens;
CREATE POLICY "Allow individual read/write guardian_tokens" 
  ON public.guardian_tokens 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = student_id) 
  WITH CHECK (auth.uid() = student_id);

-- RPC para obter o engajamento de forma pública via token
CREATE OR REPLACE FUNCTION public.get_student_engagement_by_token(token_val TEXT)
RETURNS TABLE (
  student_name TEXT,
  exam_target TEXT,
  institution TEXT,
  total_xp BIGINT,
  current_level INT,
  current_streak INT,
  longest_streak INT,
  total_answers BIGINT,
  correct_answers BIGINT,
  essays_submitted BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_student_id UUID;
  v_student_name TEXT;
  v_exam_target TEXT;
  v_institution TEXT;
  v_current_streak INT;
  v_longest_streak INT;
BEGIN
  -- Valida o token e pega o student_id correspondente
  SELECT student_id INTO v_student_id
  FROM public.guardian_tokens
  WHERE token = token_val;

  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- Pega as informações do perfil do estudante
  SELECT 
    full_name, 
    COALESCE(profiles.exam_target, 'enem'), 
    COALESCE(profiles.institution, 'Colégio'),
    COALESCE(profiles.current_streak, 0),
    COALESCE(profiles.longest_streak, 0)
  INTO 
    v_student_name, 
    v_exam_target, 
    v_institution,
    v_current_streak,
    v_longest_streak
  FROM public.profiles
  WHERE id = v_student_id;

  RETURN QUERY
  SELECT
    v_student_name as student_name,
    v_exam_target as exam_target,
    v_institution as institution,
    COALESCE((SELECT SUM(xp_earned) FROM public.student_xp_log WHERE student_id = v_student_id), 0)::BIGINT as total_xp,
    COALESCE((
      SELECT 
        CASE
          WHEN SUM(xp_earned) < 500    THEN 1
          WHEN SUM(xp_earned) < 1500   THEN 2
          WHEN SUM(xp_earned) < 3500   THEN 3
          WHEN SUM(xp_earned) < 7000   THEN 4
          ELSE 5
        END
      FROM public.student_xp_log WHERE student_id = v_student_id
    ), 1)::INT as current_level,
    v_current_streak as current_streak,
    v_longest_streak as longest_streak,
    COALESCE((SELECT COUNT(*) FROM public.student_xp_log WHERE student_id = v_student_id AND action IN ('correct_answer', 'wrong_answer', 'daily_question_correct', 'daily_question_wrong')), 0)::BIGINT as total_answers,
    COALESCE((SELECT COUNT(*) FROM public.student_xp_log WHERE student_id = v_student_id AND action IN ('correct_answer', 'daily_question_correct')), 0)::BIGINT as correct_answers,
    COALESCE((SELECT COUNT(*) FROM public.essay_submissions WHERE student_id = v_student_id), 0)::BIGINT as essays_submitted;
END;
$$;

-- Conceder permissão de execução da função anonimamente
GRANT EXECUTE ON FUNCTION public.get_student_engagement_by_token(TEXT) TO anon, authenticated;
