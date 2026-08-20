-- Ciclo do ranking configurável, em vez de sempre "semana corrente".
--
-- A view `weekly_ranking` somava XP a partir de `date_trunc('week', now())`, ou
-- seja, zerava toda segunda-feira. Isso conflita com a primeira premiação, que
-- foi anunciada para **08/08 (sábado)**: como 03/08 é segunda, tudo que os
-- alunos pontuassem de 29/07 a 02/08 seria apagado antes de premiar.
--
-- Agora existe uma tabela de ciclos. O ciclo vigente define a janela de
-- apuração; sem nenhum ciclo cadastrado, a view volta a se comportar exatamente
-- como antes (semana corrente), então nada quebra se a tabela ficar vazia.

CREATE TABLE IF NOT EXISTS public.ranking_cycles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ranking_cycles_periodo_valido CHECK (ends_at > starts_at)
);

COMMENT ON TABLE public.ranking_cycles IS
  'Janelas de apuracao do ranking. Sem ciclo vigente, a view usa a semana corrente.';

ALTER TABLE public.ranking_cycles ENABLE ROW LEVEL SECURITY;

-- O aluno precisa ler para a interface mostrar ate quando vale o ciclo.
DROP POLICY IF EXISTS ranking_cycles_read ON public.ranking_cycles;
CREATE POLICY ranking_cycles_read ON public.ranking_cycles
  FOR SELECT TO authenticated USING (true);
-- Escrita só por service role (ignora RLS): quem define ciclo é a coordenação.

-- Primeira leva: da publicação do comunicado até o fim do dia 08/08, horário de
-- Brasília. Passa por cima da virada de segunda de propósito.
INSERT INTO public.ranking_cycles (starts_at, ends_at, label)
SELECT TIMESTAMPTZ '2026-07-29 00:00:00-03',
       TIMESTAMPTZ '2026-08-08 23:59:59-03',
       'Primeira leva — premiação em 08/08'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ranking_cycles
  WHERE starts_at = TIMESTAMPTZ '2026-07-29 00:00:00-03'
);

-- Início da janela vigente. `STABLE` para o planejador poder reaproveitar.
CREATE OR REPLACE FUNCTION public.current_ranking_cycle_start()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
    (SELECT starts_at
       FROM public.ranking_cycles
      WHERE now() >= starts_at AND now() <= ends_at
      ORDER BY starts_at DESC
      LIMIT 1),
    date_trunc('week', now())
  );
$function$;

-- Mesma view de antes, trocando apenas a origem da janela. Colunas preservadas
-- (student_id, full_name, avatar_url, exam_target, total_xp, weekly_xp,
-- position) porque a interface do aluno depende delas.
CREATE OR REPLACE VIEW public.weekly_ranking AS
  SELECT p.id AS student_id,
         p.full_name,
         p.avatar_url,
         p.exam_target,
         p.xp_points AS total_xp,
         COALESCE(sum(xl.xp_earned), 0::bigint)::integer AS weekly_xp,
         rank() OVER (
           PARTITION BY p.exam_target
           ORDER BY (COALESCE(sum(xl.xp_earned), 0::bigint)) DESC
         ) AS "position"
    FROM profiles p
    LEFT JOIN student_xp_log xl
           ON xl.student_id = p.id
          AND xl.created_at >= public.current_ranking_cycle_start()
   WHERE p.role = 'student'::user_role
   GROUP BY p.id, p.full_name, p.avatar_url, p.exam_target, p.xp_points;
