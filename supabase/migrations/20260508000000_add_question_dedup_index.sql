-- Proteção server-side contra duplicação de questões via trigger + índice único.
-- O banco calcula o hash automaticamente no INSERT — o app não precisa enviar o campo.

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS question_hash TEXT;

-- Popula hashes para questões já existentes
UPDATE public.questions
SET question_hash = md5(lower(regexp_replace(trim(question_text), '\s+', ' ', 'g')))
WHERE question_hash IS NULL AND question_text IS NOT NULL;

-- Função que gera o hash normalizado antes de cada INSERT
CREATE OR REPLACE FUNCTION public.fn_set_question_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.question_hash := md5(lower(regexp_replace(trim(NEW.question_text), '\s+', ' ', 'g')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que dispara a função antes de qualquer INSERT
DROP TRIGGER IF EXISTS trg_question_hash ON public.questions;
CREATE TRIGGER trg_question_hash
BEFORE INSERT ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.fn_set_question_hash();

-- Índice único: impede inserção de questão com mesmo hash (mesmo conteúdo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_hash
ON public.questions(question_hash)
WHERE question_hash IS NOT NULL;
