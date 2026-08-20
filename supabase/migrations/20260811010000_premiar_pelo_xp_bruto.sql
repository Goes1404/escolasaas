-- Premiação pelo XP bruto: o líder da tela é o vencedor.
--
-- Decisão de produto, tomada depois de ver o efeito da apuração: separar
-- "XP que aparece" de "XP que premia" cria uma virada no domingo que o aluno
-- não tem como prever. Some a regra; quem lidera a semana leva o prêmio.
--
-- ⚠️ Consequência conhecida e aceita: a liderança volta a ser conquistável por
-- repetição rápida. Na leva em curso (09/08) o 1º colocado está com 410 XP e
-- mediana de 1,6s entre ações, 82 flashcards — o mesmo padrão da leva anterior.
-- Pelo critério bruto, é ele quem ganha.
--
-- O pódio já publicado do primeiro ciclo NÃO é recalculado: saiu em comunicado
-- e foi apurado sob a regra vigente na época. Reescrevê-lo tiraria o prêmio de
-- alguém que já foi anunciada como vencedora.

-- `xp_apurado` deixa de descrever o conteúdo: no primeiro ciclo é o valor
-- apurado, daqui em diante é o bruto. `xp_premiado` vale para os dois — é o
-- número que decidiu a posição.
ALTER TABLE public.ranking_cycle_winners
  RENAME COLUMN xp_apurado TO xp_premiado;

COMMENT ON TABLE public.ranking_cycle_winners IS
  'Podio congelado de cada ciclo. xp_premiado e o numero que decidiu a posicao; xp_bruto e o total do ciclo. Sao iguais desde 11/08/2026, quando a apuracao foi removida.';

CREATE OR REPLACE FUNCTION public.close_ranking_cycle(p_cycle_id UUID, p_top INTEGER DEFAULT 3)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ciclo    public.ranking_cycles;
  v_gravados INTEGER := 0;
  v_lista    TEXT := '';
  v_admin    UUID;
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

  -- Soma direta do log, sem filtro de ritmo. É exatamente o que a view
  -- `weekly_ranking` mostra ao aluno durante a semana, então o pódio gravado
  -- aqui bate com a tela que ele acompanhou.
  WITH podio AS (
    SELECT l.student_id,
           sum(l.xp_earned)::integer AS xp,
           rank() OVER (ORDER BY sum(l.xp_earned) DESC) AS pos
    FROM public.student_xp_log l
    JOIN public.profiles p ON p.id = l.student_id AND p.role = 'student'
    WHERE l.created_at BETWEEN v_ciclo.starts_at AND v_ciclo.ends_at
    GROUP BY l.student_id
    HAVING sum(l.xp_earned) > 0
  )
  INSERT INTO public.ranking_cycle_winners (cycle_id, position, student_id, xp_premiado, xp_bruto)
  SELECT p_cycle_id, pos, student_id, xp, xp
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
    SELECT string_agg(format('%s° lugar — %s (%s XP)', w.position, pr.full_name, w.xp_premiado),
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

-- Recriada apenas para a definição armazenada citar o nome novo da coluna.
CREATE OR REPLACE VIEW public.ranking_last_podium AS
  SELECT w.position,
         w.student_id,
         p.full_name,
         p.avatar_url,
         w.xp_premiado AS xp,
         c.label       AS cycle_label,
         c.ends_at     AS cycle_ends_at
    FROM public.ranking_cycle_winners w
    JOIN public.profiles p ON p.id = w.student_id
    JOIN public.ranking_cycles c ON c.id = w.cycle_id
   WHERE c.id = (
     SELECT id FROM public.ranking_cycles
      WHERE closed_at IS NOT NULL
      ORDER BY ends_at DESC
      LIMIT 1
   );

GRANT SELECT ON public.ranking_last_podium TO authenticated;
