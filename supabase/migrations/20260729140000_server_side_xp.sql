-- XP concedido pelo servidor, não declarado pelo cliente.
--
-- Motivo: o ranking semanal vai passar a valer prêmio para os 3 primeiros, e
-- hoje ele é forjável em uma linha. Confirmado por simulação de RLS agindo como
-- aluno autenticado:
--
--   INSERT INTO student_xp_log (student_id, action, xp_earned)
--     VALUES (<ele mesmo>, 'hack', 999999);   -- aceito, sem erro
--   UPDATE profiles SET xp_points = 999999 WHERE id = <ele mesmo>;  -- aceito
--
-- Qualquer um dos dois põe o aluno em primeiro na hora, direto do console do
-- navegador — o `awardXP` roda no cliente, então a chamada já está pronta na
-- página. Enquanto o ranking era decorativo isso não tinha graça nenhuma; o
-- prêmio é exatamente o que cria o incentivo.
--
-- Desenho: o cliente passa a dizer apenas O QUE fez ("acertei a questão X"), e
-- o servidor decide quanto vale, se já foi contabilizado e se o aluno não
-- estourou o teto do dia.

-- ── Tabela de valores (fonte da verdade, fora do alcance do cliente) ────────
CREATE TABLE IF NOT EXISTS public.xp_action_values (
  action        TEXT PRIMARY KEY,
  points        INTEGER NOT NULL CHECK (points >= 0 AND points <= 500),
  max_quantity  INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity >= 1 AND max_quantity <= 200),
  -- Acao que so pode pontuar uma vez por referencia. Flashcard e material NAO
  -- entram aqui de proposito: refazer um flashcard e repeticao espacada, ou
  -- seja, estudo legitimo — quem contem o abuso nesses casos e o teto diario.
  once_only     BOOLEAN NOT NULL DEFAULT TRUE,
  descricao     TEXT
);

COMMENT ON TABLE public.xp_action_values IS
  'Quanto vale cada acao de XP. Fonte da verdade no servidor: o cliente informa a acao, nunca a pontuacao.';

INSERT INTO public.xp_action_values (action, points, max_quantity, once_only, descricao) VALUES
  ('correct_answer',         5,  200, TRUE,  'Questao correta em simulado (quantity = no de acertos)'),
  ('wrong_answer',           2,  200, TRUE,  'Questao errada - XP de participacao'),
  ('simulado_complete',     20,    1, TRUE,  'Conclusao de simulado'),
  ('exam_complete',         50,    1, TRUE,  'Conclusao de prova completa'),
  ('daily_question_correct',25,    1, TRUE,  'Questao do dia correta'),
  ('daily_question_wrong',   5,    1, TRUE,  'Questao do dia errada'),
  ('flashcard_correct',      5,    1, FALSE, 'Flashcard correto - repetivel (repeticao espacada)'),
  ('essay_submit',          80,    1, TRUE,  'Envio de redacao'),
  ('checkin',               15,    1, TRUE,  'Check-in diario'),
  ('material_viewed',        5,    1, FALSE, 'Material visualizado - repetivel'),
  ('streak_bonus',          20,    1, TRUE,  'Bonus de ofensiva'),
  ('mission_complete',     150,    1, TRUE,  'Missao semanal concluida')
ON CONFLICT (action) DO NOTHING;

ALTER TABLE public.xp_action_values ENABLE ROW LEVEL SECURITY;
-- Leitura liberada (a interface mostra quanto vale cada acao); escrita só por
-- service role, que ignora RLS.
DROP POLICY IF EXISTS xp_action_values_read ON public.xp_action_values;
CREATE POLICY xp_action_values_read ON public.xp_action_values
  FOR SELECT TO authenticated USING (true);

-- ── Idempotência ───────────────────────────────────────────────────────────
-- Sem isto, bastaria repetir a chamada do mesmo simulado mil vezes. O indice
-- cobre só as acoes marcadas `once_only`; `flashcard_correct` e
-- `material_viewed` ficam de fora porque repetir é estudo de verdade (e ja
-- existem 12 grupos repetidos no historico, somando 95 XP — preservados).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_xp_log_student_action_ref
  ON public.student_xp_log (student_id, action, reference_id)
  WHERE reference_id IS NOT NULL
    AND action IN ('correct_answer','wrong_answer','simulado_complete','exam_complete',
                   'daily_question_correct','daily_question_wrong','essay_submit',
                   'checkin','streak_bonus','mission_complete');

-- ── Concessão ──────────────────────────────────────────────────────────────
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
  -- Teto diário. Uso legítimo intenso não chega perto; script de farm bate na hora.
  c_daily_cap CONSTANT INTEGER := 800;
  v_student   UUID;
  v_points    INTEGER;
  v_max_qty   INTEGER;
  v_once      BOOLEAN;
  v_qty       INTEGER;
  v_total     INTEGER;
  v_hoje      INTEGER;
BEGIN
  -- O aluno é sempre quem chamou. Nunca um id vindo do cliente.
  v_student := auth.uid();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sem sessao.' USING ERRCODE = '42501';
  END IF;

  SELECT points, max_quantity, once_only INTO v_points, v_max_qty, v_once
  FROM public.xp_action_values WHERE action = p_action;

  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Acao de XP desconhecida: %', p_action USING ERRCODE = '22023';
  END IF;

  -- Ja pontuou por esta referencia? Sai sem erro (a interface chama de novo em
  -- reenvio de rede, e isso nao pode virar XP dobrado nem excecao na tela).
  IF v_once AND p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_xp_log
    WHERE student_id = v_student AND action = p_action AND reference_id = p_reference_id
  ) THEN
    RETURN 0;
  END IF;

  v_qty := GREATEST(1, LEAST(COALESCE(p_quantity, 1), v_max_qty));
  v_total := v_points * v_qty;

  SELECT COALESCE(SUM(xp_earned), 0) INTO v_hoje
  FROM public.student_xp_log
  WHERE student_id = v_student AND created_at >= date_trunc('day', now());

  IF v_hoje >= c_daily_cap THEN
    RETURN 0;
  END IF;
  -- Corta no teto em vez de recusar: quem estudou muito fica com o que couber.
  v_total := LEAST(v_total, c_daily_cap - v_hoje);

  BEGIN
    INSERT INTO public.student_xp_log (student_id, action, xp_earned, reference_id)
    VALUES (v_student, p_action, v_total, p_reference_id);
  EXCEPTION WHEN unique_violation THEN
    -- Já contabilizado (idempotência). Não é erro para quem chamou.
    RETURN 0;
  END;

  UPDATE public.profiles
  SET xp_points = COALESCE(xp_points, 0) + v_total
  WHERE id = v_student;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_xp(TEXT, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(TEXT, UUID, INTEGER) TO authenticated;

-- ── Fecha os caminhos diretos ──────────────────────────────────────────────
-- Escrever no log agora é exclusividade da função acima (SECURITY DEFINER, roda
-- como dona) e da service role.
DROP POLICY IF EXISTS "students insert own xp" ON public.student_xp_log;

-- E o total no perfil deixa de ser editável pela sessão do aluno. Mesmo motivo
-- e mesmo formato do trigger que já bloqueia a troca de `role`: a policy de dono
-- vale para qualquer coluna, então a restricao precisa vir de trigger.
CREATE OR REPLACE FUNCTION public.profiles_block_xp_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY INVOKER: dentro de uma funcao DEFINER, `current_user` viraria o dono
-- e a checagem de papel nunca veria o `authenticated`.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.xp_points IS NOT DISTINCT FROM OLD.xp_points THEN
    RETURN NEW;
  END IF;

  -- `award_xp` roda como a dona da funcao, e as rotas administrativas usam
  -- service role; ambos passam.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF public.check_user_is_staff_or_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'XP so pode ser concedido pelo servidor.' USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.profiles_block_xp_tampering() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_block_xp_tampering ON public.profiles;
CREATE TRIGGER trg_profiles_block_xp_tampering
BEFORE UPDATE OF xp_points ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_block_xp_tampering();
