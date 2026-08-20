-- Contagem de questões por matéria, filtrada por banca.
--
-- O simulado por matéria passou a deixar o aluno escolher a banca (ENEM/FUVEST/
-- Todas). O contador exibido em cada matéria vinha de
-- `get_subjects_with_question_count()`, que conta o banco inteiro — com o filtro
-- de banca ativo ele passaria a mentir (ex.: "Matemática · 545 questões" quando
-- só 60 são da FUVEST).
--
-- Mantém o estilo da função original: SECURITY INVOKER (a RLS de `questions`
-- continua valendo para quem chama) e `search_path` fixado.

CREATE OR REPLACE FUNCTION public.get_subjects_with_question_count_by_boards(p_boards text[])
RETURNS TABLE(id uuid, name text, question_count bigint)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, COUNT(q.id) AS question_count
  FROM public.subjects s
  -- O filtro de banca fica na condição do LEFT JOIN, não no WHERE: assim as
  -- matérias sem nenhuma questão da banca continuam aparecendo, com contagem 0.
  LEFT JOIN public.questions q
         ON q.subject_id = s.id
        AND (p_boards IS NULL OR q.exam_board = ANY(p_boards))
  GROUP BY s.id, s.name
  ORDER BY s.name ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_subjects_with_question_count_by_boards(text[]) IS
  'Como get_subjects_with_question_count(), mas contando so as questoes das bancas informadas. p_boards NULL conta todas.';
