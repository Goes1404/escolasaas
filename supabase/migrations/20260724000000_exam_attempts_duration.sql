-- Registra quanto tempo o aluno levou para concluir a prova (em segundos).
-- Usado no boletim do aluno e nas telas de gestão (admin/secretaria) para
-- acompanhar o ritmo de execução. O valor pode exceder o tempo oficial da
-- prova (o cronômetro entra em contagem negativa quando o tempo acaba), então
-- registramos o tempo real total gasto, sem teto.

ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

COMMENT ON COLUMN public.exam_attempts.duration_seconds IS
  'Tempo total (em segundos) que o aluno levou para concluir a prova. Pode ser maior que o tempo oficial quando o aluno excede o limite (cronômetro negativo).';
