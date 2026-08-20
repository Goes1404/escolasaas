-- Ofensiva concedida pelo servidor, com fuso correto e proteção.
--
-- Três problemas somados, todos no caminho do bichinho de estimação — que vai
-- pendurar a vida dele exatamente nesta tabela.
--
-- ── 1. A ofensiva é forjável ───────────────────────────────────────────────
-- `study_streaks` tem policy `UPDATE USING (auth.uid() = user_id)` e o
-- `bumpStreak()` escreve direto do cliente. Ou seja, do console do navegador:
--
--   UPDATE study_streaks SET current_streak = 999 WHERE user_id = <ele mesmo>;
--
-- A ofensiva concede `streak_bonus` (20 XP), o XP alimenta o ranking semanal, e
-- o ranking vale prêmio. É exatamente o buraco que `award_xp()` fechou para o
-- XP em 29/07, deixado aberto na ofensiva.
--
-- ── 2. O dia é contado em UTC ──────────────────────────────────────────────
-- `toISODate(new Date())` devolve a data em UTC, e o Brasil é UTC-3. Quem
-- estuda às 10h e de novo às 21h (BRT) atravessa a meia-noite UTC no segundo
-- acesso: o mesmo dia vira dois, e a ofensiva infla. Pior, quem estuda 21h de
-- domingo e 10h de terça aparece como dois dias UTC consecutivos, apesar de ter
-- pulado a segunda. Agora o dia é `America/Sao_Paulo`, que é o dia do aluno.
--
-- ── 3. Sem proteção, ninguém passa de 3 dias ───────────────────────────────
-- Levantamento de 12/08: a maior ofensiva ATIVA da base é 3 dias, e em 8
-- semanas nenhum aluno chegou a 7. Um único dia perdido zerava tudo. A
-- proteção é o que torna a ofensiva longa possível — e sem ofensiva longa o
-- bichinho nunca sai do nível 1.
--
-- Regra: cada aluno começa com 2 proteções e ganha mais uma a cada 5 dias
-- seguidos, com teto de 2. Cada proteção cobre UM dia perdido. Some 3 dias sem
-- estudar e nem duas proteções seguram — o que é proposital: proteção é para o
-- tropeço, não para o abandono.

-- ── Colunas de proteção ────────────────────────────────────────────────────
ALTER TABLE public.study_streaks
  ADD COLUMN IF NOT EXISTS protections       INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS protections_used  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_protected_at DATE;

COMMENT ON COLUMN public.study_streaks.protections IS
  'Dias perdidos que a ofensiva ainda aguenta sem zerar. Teto 2.';

-- Quem já tem ofensiva também começa com as duas — senão os 77 alunos atuais
-- ficariam em desvantagem contra quem entrar amanhã.
UPDATE public.study_streaks SET protections = 2 WHERE protections IS NULL OR protections = 0;

-- ── Concessão ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bump_streak(p_action TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  -- Teto de proteções acumuláveis.
  c_teto_protecao CONSTANT INTEGER := 2;
  -- A cada tantos dias seguidos, ganha uma proteção de volta.
  c_ciclo_protecao CONSTANT INTEGER := 5;
  -- Ações que NÃO são estudo. Entrar na plataforma e clicar em "check-in"
  -- continua valendo XP, mas não sustenta ofensiva: a ofensiva é a prova de que
  -- o aluno estudou, e é dela que o bichinho se alimenta. Mesma régua que
  -- zerou o XP de `simulado_complete` em 11/08.
  c_nao_estudo CONSTANT TEXT[] := ARRAY['checkin'];

  v_user       UUID;
  v_hoje       DATE;
  v_ultima     DATE;
  v_atual      INTEGER;
  v_recorde    INTEGER;
  v_protecoes  INTEGER;
  v_usadas     INTEGER;
  v_intervalo  INTEGER;
  v_perdidos   INTEGER;
  v_protegido  BOOLEAN := FALSE;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sem sessao.' USING ERRCODE = '42501';
  END IF;

  -- O dia do aluno, não o do servidor.
  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  INSERT INTO public.study_streaks (user_id, current_streak, longest_streak)
  VALUES (v_user, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_activity_date, current_streak, longest_streak, protections, protections_used
    INTO v_ultima, v_atual, v_recorde, v_protecoes, v_usadas
  FROM public.study_streaks WHERE user_id = v_user
  FOR UPDATE;

  -- Ação que não é estudo: devolve o estado sem mexer em nada.
  IF p_action IS NOT NULL AND p_action = ANY (c_nao_estudo) THEN
    RETURN jsonb_build_object(
      'current_streak', v_atual, 'longest_streak', v_recorde,
      'last_activity_date', v_ultima, 'protections', v_protecoes,
      'protected_today', FALSE, 'counted', FALSE
    );
  END IF;

  -- Já estudou hoje: idempotente.
  IF v_ultima = v_hoje THEN
    RETURN jsonb_build_object(
      'current_streak', v_atual, 'longest_streak', v_recorde,
      'last_activity_date', v_ultima, 'protections', v_protecoes,
      'protected_today', FALSE, 'counted', FALSE
    );
  END IF;

  IF v_ultima IS NULL THEN
    v_atual := 1;
  ELSE
    v_intervalo := v_hoje - v_ultima;
    v_perdidos  := v_intervalo - 1;

    IF v_perdidos <= 0 THEN
      -- Dia seguinte: a ofensiva cresce.
      v_atual := v_atual + 1;
    ELSIF v_perdidos <= v_protecoes THEN
      -- Tropeço coberto: consome uma proteção por dia perdido e a ofensiva
      -- continua de onde estava, somando o dia de hoje.
      v_protecoes := v_protecoes - v_perdidos;
      v_usadas    := v_usadas + v_perdidos;
      v_protegido := TRUE;
      v_atual     := v_atual + 1;
    ELSE
      -- Além do que a proteção cobre: recomeça.
      v_atual := 1;
    END IF;
  END IF;

  -- Regenera uma proteção a cada ciclo de dias seguidos.
  IF v_atual > 0 AND v_atual % c_ciclo_protecao = 0 AND v_protecoes < c_teto_protecao THEN
    v_protecoes := v_protecoes + 1;
  END IF;

  v_recorde := GREATEST(v_atual, COALESCE(v_recorde, 0));

  UPDATE public.study_streaks SET
    -- Dias de estudo acumulados: so cresce, nunca zera. E dele que sai o nivel
    -- do bichinho — o aluno pode perder a ofensiva, nunca o que ja estudou.
    total_study_days   = COALESCE(total_study_days, 0) + 1,
    current_streak     = v_atual,
    longest_streak     = v_recorde,
    last_activity_date = v_hoje,
    protections        = v_protecoes,
    protections_used   = v_usadas,
    last_protected_at  = CASE WHEN v_protegido THEN v_hoje ELSE last_protected_at END,
    updated_at         = now()
  WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'current_streak', v_atual, 'longest_streak', v_recorde,
    'last_activity_date', v_hoje, 'protections', v_protecoes,
    'protected_today', v_protegido, 'counted', TRUE
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bump_streak(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_streak(TEXT) TO authenticated;

-- ── Fecha o caminho direto ─────────────────────────────────────────────────
-- A partir daqui, escrever na ofensiva é exclusividade da função acima (roda
-- como dona) e da service role. O aluno continua enxergando a própria.
DROP POLICY IF EXISTS "Users update own streak" ON public.study_streaks;
DROP POLICY IF EXISTS "Users insert own streak" ON public.study_streaks;
