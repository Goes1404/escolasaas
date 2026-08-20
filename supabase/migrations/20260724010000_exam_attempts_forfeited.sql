-- Marca tentativas encerradas por o aluno ter saído da página durante a prova
-- (troca de aba / abriu outro app ou site). Nesse caso a prova é entregue
-- automaticamente com o que estava marcado e o aluno "perde a oportunidade".
-- Usado para transparência nas telas de gestão.

ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS forfeited BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exam_attempts.forfeited IS
  'true quando a tentativa foi encerrada automaticamente porque o aluno saiu da página durante a prova (perdeu a oportunidade).';
