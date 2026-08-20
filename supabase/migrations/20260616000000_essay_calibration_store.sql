-- Banco de calibração da IA de correção de redação.
-- Guarda a correção HUMANA (professor) ao lado da nota da IA para medir o viés
-- da Aurora ao longo do tempo (generosa/rígida) por competência.
--
-- `score` (já existente) continua sendo a nota da IA exibida ao aluno.
-- As colunas abaixo são preenchidas APENAS quando um professor revisa e ajusta.

ALTER TABLE public.essay_submissions
  ADD COLUMN IF NOT EXISTS teacher_score        integer,                 -- nota total corrigida pelo professor (0-1000)
  ADD COLUMN IF NOT EXISTS teacher_competencies jsonb,                   -- { c1..c5: number } corrigidas
  ADD COLUMN IF NOT EXISTS teacher_reviewed_at  timestamptz,             -- quando o professor lançou a nota
  ADD COLUMN IF NOT EXISTS teacher_reviewed_by  uuid;                    -- professor que corrigiu

-- Acelera o cálculo de viés (só linhas com correção humana entram na estatística).
CREATE INDEX IF NOT EXISTS idx_essay_submissions_teacher_score
  ON public.essay_submissions(teacher_reviewed_at)
  WHERE teacher_score IS NOT NULL;
