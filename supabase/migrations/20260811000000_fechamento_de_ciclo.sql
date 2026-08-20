-- Fechamento automático do ciclo de ranking.
--
-- O que faltava: o primeiro ciclo terminou em 08/08 e ninguém viu os vencedores.
-- A view `weekly_ranking` mostra só a janela VIGENTE — assim que o ciclo acabou,
-- ela voltou para a semana corrente e o pódio desapareceu da tela. Não havia
-- snapshot nem apuração; o resultado só existia implicitamente no log.
--
-- Agora o pódio é gravado quando o ciclo fecha, e um comunicado é publicado.
--
-- ── Por que a apuração não usa o XP cru ────────────────────────────────────
-- Na primeira leva os três primeiros inflaram a pontuação repetindo ações em
-- ritmo não-humano: o 1º colocado somou 1.019 flashcards com mediana de 1,6
-- segundo entre eles (854 em até 3s), e a 2ª completou 200 simulados em 7 dias,
-- 60 deles sem acertar nenhuma questão — abrir e fechar rendia os 20 XP de
-- conclusão.
--
-- A apuração conta apenas ações com pelo menos MIN_INTERVALO_SEG desde a ação
-- anterior do mesmo aluno, e limita flashcards por dia. Não altera o XP exibido
-- ao aluno durante o ciclo (isso continua sendo o total cru); muda apenas quem
-- leva o prêmio, que é onde a diferença importa.

CREATE TABLE IF NOT EXISTS public.ranking_cycle_winners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    UUID NOT NULL REFERENCES public.ranking_cycles(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_apurado  INTEGER NOT NULL,
  xp_bruto    INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ranking_cycle_winners_unico UNIQUE (cycle_id, student_id)
);

COMMENT ON TABLE public.ranking_cycle_winners IS
  'Podio congelado de cada ciclo. xp_apurado ignora acoes em ritmo nao-humano; xp_bruto e o total que o aluno via na tela.';

ALTER TABLE public.ranking_cycle_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ranking_cycle_winners_read ON public.ranking_cycle_winners;
CREATE POLICY ranking_cycle_winners_read ON public.ranking_cycle_winners
  FOR SELECT TO authenticated USING (true);

-- Marca o ciclo já apurado, para o fechamento ser idempotente.
ALTER TABLE public.ranking_cycles
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.close_ranking_cycle(p_cycle_id UUID, p_top INTEGER DEFAULT 3)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  -- Intervalo mínimo entre ações para a ação contar na apuração.
  c_min_seg    CONSTANT INTEGER := 5;
  -- Flashcards que contam por dia. Repetição espaçada é estudo; 1.000 num dia não.
  c_max_flash  CONSTANT INTEGER := 40;
  v_ciclo      public.ranking_cycles;
  v_gravados   INTEGER := 0;
  v_lista      TEXT := '';
  v_admin      UUID;
BEGIN
  SELECT * INTO v_ciclo FROM public.ranking_cycles WHERE id = p_cycle_id;
  IF v_ciclo.id IS NULL THEN
    RAISE EXCEPTION 'Ciclo inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_ciclo.ends_at > now() THEN
    RAISE EXCEPTION 'Ciclo ainda em andamento.' USING ERRCODE = '22023';
  END IF;
  IF v_ciclo.closed_at IS NOT NULL THEN
    RETURN 0;  -- já apurado
  END IF;

  WITH marcado AS (
    SELECT l.*,
           extract(epoch FROM (l.created_at - lag(l.created_at)
             OVER (PARTITION BY l.student_id ORDER BY l.created_at))) AS seg
    FROM public.student_xp_log l
    WHERE l.created_at BETWEEN v_ciclo.starts_at AND v_ciclo.ends_at
  ),
  valido AS (
    SELECT m.*,
           row_number() OVER (PARTITION BY m.student_id, m.action,
                              date_trunc('day', m.created_at) ORDER BY m.created_at) AS ordem_dia
    FROM marcado m
    WHERE m.seg IS NULL OR m.seg >= c_min_seg
  ),
  apurado AS (
    SELECT v.student_id,
           sum(v.xp_earned) FILTER (
             WHERE NOT (v.action = 'flashcard_correct' AND v.ordem_dia > c_max_flash)
           ) AS xp_apurado
    FROM valido v
    GROUP BY v.student_id
  ),
  bruto AS (
    SELECT l.student_id, sum(l.xp_earned) AS xp_bruto
    FROM public.student_xp_log l
    WHERE l.created_at BETWEEN v_ciclo.starts_at AND v_ciclo.ends_at
    GROUP BY l.student_id
  ),
  podio AS (
    SELECT a.student_id,
           coalesce(a.xp_apurado, 0) AS xp_apurado,
           coalesce(b.xp_bruto, 0) AS xp_bruto,
           rank() OVER (ORDER BY coalesce(a.xp_apurado, 0) DESC) AS pos
    FROM apurado a
    JOIN bruto b ON b.student_id = a.student_id
    JOIN public.profiles p ON p.id = a.student_id AND p.role = 'student'
    WHERE coalesce(a.xp_apurado, 0) > 0
  )
  INSERT INTO public.ranking_cycle_winners (cycle_id, position, student_id, xp_apurado, xp_bruto)
  SELECT p_cycle_id, pos, student_id, xp_apurado, xp_bruto
  FROM podio WHERE pos <= p_top
  ON CONFLICT (cycle_id, student_id) DO NOTHING;

  GET DIAGNOSTICS v_gravados = ROW_COUNT;

  UPDATE public.ranking_cycles SET closed_at = now() WHERE id = p_cycle_id;

  -- Comunicado com o pódio. Sem vencedores, não publica nada.
  --
  -- `target_group = 'all'` de propósito. O sino de notificações casa o grupo com
  -- `profile_type` OU `exam_target` do aluno, e `profile_type` tem cinco valores
  -- em produção ('student' 608, 'etec' 259, 'enem' 167, 'Estudante ENEM' 17,
  -- 'Estudante ETEC' 9). O comunicado de 29/07 foi publicado como 'student' e por
  -- isso só apareceu para 608 dos 1.058 alunos — 450 nunca souberam do prêmio.
  IF v_gravados > 0 THEN
    SELECT string_agg(format('%s° lugar — %s (%s XP)', w.position, pr.full_name, w.xp_apurado),
                      chr(10) ORDER BY w.position)
      INTO v_lista
    FROM public.ranking_cycle_winners w
    JOIN public.profiles pr ON pr.id = w.student_id
    WHERE w.cycle_id = p_cycle_id;

    SELECT id INTO v_admin FROM public.profiles WHERE role::text = 'admin' LIMIT 1;

    INSERT INTO public.announcements (title, message, priority, target_group, author_id)
    VALUES (
      '🏆 Resultado do Ranking: temos os vencedores!',
      'O ciclo "' || coalesce(v_ciclo.label, 'do ranking') || '" foi encerrado. Pódio:' ||
      chr(10) || chr(10) || v_lista || chr(10) || chr(10) ||
      'Parabéns! A secretaria entra em contato para a entrega.' || chr(10) || chr(10) ||
      'O ranking já recomeçou — todo mundo do zero. Boa sorte na próxima! 📚',
      'high', 'all', v_admin
    );
  END IF;

  RETURN v_gravados;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_ranking_cycle(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

-- Varre ciclos vencidos e ainda não apurados. É o que roda no agendador.
CREATE OR REPLACE FUNCTION public.close_due_ranking_cycles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id    UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.ranking_cycles
    WHERE ends_at <= now() AND closed_at IS NULL
    ORDER BY ends_at
  LOOP
    v_total := v_total + public.close_ranking_cycle(v_id, 3);
  END LOOP;
  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.close_due_ranking_cycles() FROM PUBLIC, anon, authenticated;
