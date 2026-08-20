-- Concessão de tentativas extras que contam para o boletim, por (aluno, prova).
-- Por padrão o boletim conta as 2 primeiras tentativas do aluno. Quando a
-- gestão quer dar "mais chances" a quem já esgotou, cria-se um grant com um
-- limite maior (ex.: 4) para aquele aluno naquela prova.

CREATE TABLE IF NOT EXISTS public.exam_report_attempt_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  max_attempts INTEGER NOT NULL DEFAULT 4,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exam_id)
);

COMMENT ON TABLE public.exam_report_attempt_grants IS
  'Limite de tentativas que contam para o boletim por (aluno, prova). Sem linha = padrão de 2.';

ALTER TABLE public.exam_report_attempt_grants ENABLE ROW LEVEL SECURITY;

-- Aluno lê os próprios grants (boletim e tela de provas rodam no cliente).
DROP POLICY IF EXISTS "grants_select_own" ON public.exam_report_attempt_grants;
CREATE POLICY "grants_select_own" ON public.exam_report_attempt_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin/staff/professor gerenciam (papel checado em profiles, nunca via claim).
DROP POLICY IF EXISTS "grants_staff_all" ON public.exam_report_attempt_grants;
CREATE POLICY "grants_staff_all" ON public.exam_report_attempt_grants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff','teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff','teacher')));

-- Trigger de metadados passa a respeitar o grant (limite por aluno+prova).
CREATE OR REPLACE FUNCTION public.set_exam_attempt_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  IF NEW.source IS NULL THEN NEW.source := 'self'; END IF;

  IF NEW.source = 'teacher' THEN
    NEW.attempt_number := COALESCE(NEW.attempt_number, 0);
    NEW.counts_for_report := true;
  ELSE
    IF NEW.attempt_number IS NULL THEN
      SELECT COUNT(*) + 1 INTO NEW.attempt_number
      FROM public.exam_attempts
      WHERE user_id = NEW.user_id AND exam_id = NEW.exam_id AND source = 'self';
    END IF;

    SELECT COALESCE(g.max_attempts, 2) INTO v_limit
    FROM (SELECT 1) dummy
    LEFT JOIN public.exam_report_attempt_grants g
      ON g.user_id = NEW.user_id AND g.exam_id = NEW.exam_id;

    NEW.counts_for_report := (NEW.attempt_number <= COALESCE(v_limit, 2));
  END IF;

  RETURN NEW;
END;
$$;

-- Recalcula counts_for_report das tentativas já existentes conforme os grants.
UPDATE public.exam_attempts a
SET counts_for_report = (a.attempt_number <= COALESCE(g.max_attempts, 2))
FROM (SELECT id, user_id, exam_id, attempt_number FROM public.exam_attempts WHERE source = 'self') s
LEFT JOIN public.exam_report_attempt_grants g ON g.user_id = s.user_id AND g.exam_id = s.exam_id
WHERE a.id = s.id
  AND a.counts_for_report IS DISTINCT FROM (s.attempt_number <= COALESCE(g.max_attempts, 2));
