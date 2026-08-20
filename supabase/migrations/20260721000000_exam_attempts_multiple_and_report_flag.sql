-- Permite múltiplas tentativas por (user, exam), marca as 2 primeiras do aluno
-- para o boletim e distingue tentativas do aluno das lançadas pelo professor.

-- 1) Remove a UNIQUE(user_id, exam_id) que limitava a 1 tentativa.
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_user_exam_unique;

-- 2) Novas colunas.
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER,
  ADD COLUMN IF NOT EXISTS counts_for_report BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self';

COMMENT ON COLUMN public.exam_attempts.attempt_number IS 'N-ésima tentativa do aluno neste simulado (self). Teacher = 0.';
COMMENT ON COLUMN public.exam_attempts.counts_for_report IS 'Se a tentativa entra no boletim (2 primeiras do aluno + lançamentos do professor).';
COMMENT ON COLUMN public.exam_attempts.source IS 'Origem: self (aluno na plataforma) ou teacher (correção/importação).';

-- 3) Backfill: numera tentativas existentes por (user, exam) na ordem de conclusão.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, exam_id ORDER BY completed_at ASC, id ASC) AS n
  FROM public.exam_attempts
)
UPDATE public.exam_attempts a
SET attempt_number = ranked.n,
    counts_for_report = (ranked.n <= 2)
FROM ranked
WHERE a.id = ranked.id;

-- 4) Trigger: numera e marca boletim automaticamente na inserção.
CREATE OR REPLACE FUNCTION public.set_exam_attempt_meta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
    NEW.counts_for_report := (NEW.attempt_number <= 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_attempt_meta ON public.exam_attempts;
CREATE TRIGGER trg_exam_attempt_meta
  BEFORE INSERT ON public.exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_exam_attempt_meta();

-- 5) Índice para histórico/evolução por aluno e prova.
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_exam_time
  ON public.exam_attempts(user_id, exam_id, completed_at);
