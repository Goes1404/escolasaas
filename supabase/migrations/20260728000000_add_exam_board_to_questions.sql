-- Banca da questão (`questions.exam_board`) — separa ENEM, FUVEST, ETEC etc. no
-- banco de questões, para o simulado por matéria poder filtrar por banca sem
-- misturar conteúdo de vestibulares diferentes.
--
-- Por que uma coluna nova e não `target_audience`: `target_audience` é a TRILHA do
-- aluno (etec/enem/all) e é consumida por flashcards, questão do dia e pelo próprio
-- simulado. Sobrecarregá-la com o nome da banca quebraria esses consumidores.
--
-- Por que uma coluna e não um JOIN em tempo de consulta: hoje toda questão está
-- ligada a exatamente uma prova, então o backfill é exato; e um `.eq('exam_board', …)`
-- mantém a query do PostgREST simples e indexável, em vez de um join aninhado.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS exam_board TEXT;

COMMENT ON COLUMN questions.exam_board IS
  'Banca/vestibular de origem da questao (enem, fuvest, etec...). Espelha exams.exam_type da prova vinculada; mantido pelo trigger trg_exam_questions_set_board.';

-- Backfill a partir do vinculo com a prova.
UPDATE questions q
SET exam_board = e.exam_type
FROM exam_questions eq
JOIN exams e ON e.id = eq.exam_id
WHERE eq.question_id = q.id
  AND q.exam_board IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_exam_board ON questions(exam_board);
-- O simulado por materia filtra por materia + banca ao mesmo tempo.
CREATE INDEX IF NOT EXISTS idx_questions_subject_board ON questions(subject_id, exam_board);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: carimba a banca ao vincular a questao a uma prova.
--
-- SECURITY DEFINER e necessario: a policy de UPDATE de `questions` e
-- `auth.uid() = teacher_id`, entao um admin (ou outro professor) vinculando uma
-- questao de terceiro nao conseguiria gravar a coluna e ela ficaria nula.
--
-- Escopo minimo de proposito: a funcao so escreve `exam_board`, so na questao que
-- esta sendo vinculada, e o valor vem da propria prova -- nao ha entrada livre do
-- usuario. Quem pode criar o vinculo continua sendo decidido pela RLS de
-- `exam_questions`. `search_path` fixado conforme 20260723130000.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_question_exam_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE questions q
  SET exam_board = e.exam_type
  FROM exams e
  WHERE e.id = NEW.exam_id
    AND q.id = NEW.question_id
    AND q.exam_board IS DISTINCT FROM e.exam_type;

  RETURN NEW;
END;
$$;

-- Funcao de trigger nao precisa de EXECUTE para disparar; revoga o acesso direto.
REVOKE ALL ON FUNCTION set_question_exam_board() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_exam_questions_set_board ON exam_questions;
CREATE TRIGGER trg_exam_questions_set_board
AFTER INSERT OR UPDATE OF exam_id ON exam_questions
FOR EACH ROW
EXECUTE FUNCTION set_question_exam_board();
