-- `award_xp`: recompensa de missão lida do banco, não aceita do cliente.
--
-- Complementa 20260729140000. Cada missão semanal tem sua própria recompensa
-- (`weekly_missions.xp_reward`), então um valor fixo na tabela de ações não
-- serviria — mas aceitar o número que o cliente manda recriaria exatamente o
-- problema que a migration anterior fechou.
--
-- A função passa a ler a recompensa da própria missão e ainda assim a limita a
-- 500, para que uma missão mal cadastrada (ou cadastrada com má intenção) não
-- vire um atalho para o topo do ranking.

CREATE OR REPLACE FUNCTION public.award_xp(
  p_action       TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_quantity     INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_daily_cap CONSTANT INTEGER := 800;
  v_student   UUID;
  v_points    INTEGER;
  v_max_qty   INTEGER;
  v_once      BOOLEAN;
  v_qty       INTEGER;
  v_total     INTEGER;
  v_hoje      INTEGER;
  v_missao    INTEGER;
BEGIN
  v_student := auth.uid();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sem sessao.' USING ERRCODE = '42501';
  END IF;

  SELECT points, max_quantity, once_only INTO v_points, v_max_qty, v_once
  FROM public.xp_action_values WHERE action = p_action;

  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Acao de XP desconhecida: %', p_action USING ERRCODE = '22023';
  END IF;

  IF v_once AND p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_xp_log
    WHERE student_id = v_student AND action = p_action AND reference_id = p_reference_id
  ) THEN
    RETURN 0;
  END IF;

  v_qty := GREATEST(1, LEAST(COALESCE(p_quantity, 1), v_max_qty));
  v_total := v_points * v_qty;

  IF p_action = 'mission_complete' AND p_reference_id IS NOT NULL THEN
    SELECT xp_reward INTO v_missao FROM public.weekly_missions WHERE id = p_reference_id;
    IF v_missao IS NULL THEN
      RAISE EXCEPTION 'Missao inexistente.' USING ERRCODE = '22023';
    END IF;
    v_total := LEAST(GREATEST(v_missao, 0), 500);
  END IF;

  SELECT COALESCE(SUM(xp_earned), 0) INTO v_hoje
  FROM public.student_xp_log
  WHERE student_id = v_student AND created_at >= date_trunc('day', now());

  IF v_hoje >= c_daily_cap THEN
    RETURN 0;
  END IF;
  v_total := LEAST(v_total, c_daily_cap - v_hoje);

  BEGIN
    INSERT INTO public.student_xp_log (student_id, action, xp_earned, reference_id)
    VALUES (v_student, p_action, v_total, p_reference_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN 0;
  END;

  UPDATE public.profiles
  SET xp_points = COALESCE(xp_points, 0) + v_total
  WHERE id = v_student;

  RETURN v_total;
END;
$function$;
