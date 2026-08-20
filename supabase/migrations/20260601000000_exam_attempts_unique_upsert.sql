-- Garante que cada aluno tem no máximo 1 attempt por prova
-- Necessário para o UPSERT de resultados de simulados importados
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_attempts_user_exam_unique'
  ) THEN
    ALTER TABLE public.exam_attempts
      ADD CONSTRAINT exam_attempts_user_exam_unique
      UNIQUE (user_id, exam_id);
  END IF;
END $$;
