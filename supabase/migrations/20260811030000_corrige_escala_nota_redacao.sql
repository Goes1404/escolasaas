-- A nota de redação vai até 1000, não até 100.
--
-- `essay_submissions.score` tinha CHECK (score >= 0 AND score <= 100), herdado
-- de quando a nota era percentual. A escala do ENEM é 0–1000 (cinco
-- competências de até 200), e o corretor devolve nessa escala desde então.
--
-- Consequência em produção: toda redação com nota acima de 100 falhava no
-- INSERT. O aluno via a correção na tela, recebia o toast "Avaliação
-- finalizada, mas houve falha ao salvar no histórico" e o texto sumia. As
-- únicas que entraram no banco foram as zeradas por fuga ao tema — que
-- passavam no CHECK justamente por valerem 0. Daí a impressão de que o
-- corretor só produzia zeros e de que o gráfico de evolução não funcionava:
-- o gráfico funcionava, mas só existia o que a restrição deixava entrar.
--
-- As 3 linhas legadas com nota 42/78/82 (dados de demonstração na escala
-- antiga) continuam válidas dentro de 0–1000 e não são alteradas aqui.

ALTER TABLE public.essay_submissions
  DROP CONSTRAINT IF EXISTS essay_submissions_score_check;

ALTER TABLE public.essay_submissions
  ADD CONSTRAINT essay_submissions_score_check
  CHECK (score IS NULL OR (score >= 0 AND score <= 1000));

-- A nota do professor vive na mesma escala e não tinha restrição nenhuma.
ALTER TABLE public.essay_submissions
  DROP CONSTRAINT IF EXISTS essay_submissions_teacher_score_check;

ALTER TABLE public.essay_submissions
  ADD CONSTRAINT essay_submissions_teacher_score_check
  CHECK (teacher_score IS NULL OR (teacher_score >= 0 AND teacher_score <= 1000));
