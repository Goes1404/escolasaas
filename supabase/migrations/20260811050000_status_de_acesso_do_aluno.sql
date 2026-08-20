-- Situação de acesso do aluno: marcar em vez de apagar.
--
-- Contexto da decisão (11/08/2026): 580 alunos nunca entraram na plataforma, e
-- a proposta inicial foi excluí-los, por parecerem contas fantasma criadas pela
-- importação de boletim. A verificação mostrou o contrário:
--
--   580  nunca logaram
--   525  TÊM histórico acadêmico (prova, boletim ou presença)
--    55  não têm nada — e nenhum deles veio da importação
--
-- Apagá-los levaria junto 661 tentativas de prova (`exam_attempts` tem FK para
-- auth.users com ON DELETE CASCADE) e 430 linhas de boletim
-- (`report_card_entries` tem CASCADE para profiles). São alunos que fizeram o
-- simulado presencial de verdade; o que não existe não é o aluno, é o acesso
-- dele.
--
-- Então: classificar, não excluir. As contagens ficam legíveis, o diretório
-- fica utilizável, o boletim continua de pé, e a lista de "sem acesso" vira a
-- lista de trabalho da secretaria.

-- Arquivamento é decisão HUMANA (aluno saiu do cursinho), diferente de "nunca
-- entrou", que é fato derivado do login. Não misturar os dois: um flag que
-- replicasse `last_sign_in_at` viraria uma segunda fonte de verdade, e
-- desatualizaria no primeiro acesso do aluno.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

COMMENT ON COLUMN public.profiles.arquivado_em IS
  'Preenchido quando a secretaria arquiva o aluno (saiu do cursinho). NAO usar para "nunca acessou" — isso e derivado de auth.users.last_sign_in_at.';

CREATE INDEX IF NOT EXISTS idx_profiles_arquivado
  ON public.profiles (arquivado_em) WHERE arquivado_em IS NOT NULL;

/**
 * Situação de cada aluno, para o diretório e para as métricas.
 *
 * É função e não view porque precisa ler `auth.users` (último login), que o
 * aluno não pode acessar. Uma view rodaria com os privilégios do dono e
 * exporia a lista inteira de alunos a qualquer sessão autenticada. Aqui o
 * papel do chamador é conferido antes de qualquer linha sair.
 */
CREATE OR REPLACE FUNCTION public.listar_status_alunos()
RETURNS TABLE (
  id             UUID,
  situacao       TEXT,
  ultimo_acesso  TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ,
  tem_historico  BOOLEAN,
  arquivado_em   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para listar status de alunos.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    CASE
      WHEN p.arquivado_em IS NOT NULL              THEN 'arquivado'
      WHEN u.last_sign_in_at IS NULL               THEN 'sem_acesso'
      WHEN u.last_sign_in_at > now() - INTERVAL '30 days' THEN 'ativo'
      ELSE 'sumido'
    END::TEXT,
    u.last_sign_in_at,
    u.created_at,
    -- Histórico acadêmico: o que se perderia numa exclusão. É este campo que
    -- separa "conta a limpar" de "aluno real sem senha".
    (EXISTS (SELECT 1 FROM public.exam_attempts e WHERE e.user_id = p.id)
     OR EXISTS (SELECT 1 FROM public.report_card_entries r WHERE r.student_id = p.id)
     OR EXISTS (SELECT 1 FROM public.report_card_entries_enem r WHERE r.student_id = p.id)
     OR EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.student_id = p.id)),
    p.arquivado_em
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student';
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_status_alunos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_status_alunos() TO authenticated;

-- ── Funil, agora por situação ─────────────────────────────────────────────
-- Substitui a versão que excluía a importação por data fixa. A regra passa a
-- ser a situação real de cada aluno, que continua valendo quando alguém do
-- lote de 14/07 finalmente entrar.
-- DROP e recria: `CREATE OR REPLACE VIEW` não permite inserir coluna no meio
-- da lista, e `sem_acesso` precisa ficar ao lado de `base_real` para a leitura
-- fazer sentido.
DROP VIEW IF EXISTS public.funil_alunos;

CREATE VIEW public.funil_alunos AS
WITH base AS (
  SELECT p.id,
         u.last_sign_in_at,
         p.arquivado_em,
         (u.created_at::date = DATE '2026-07-14') AS veio_de_importacao
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student'
)
SELECT
  count(*) FILTER (WHERE arquivado_em IS NULL)                                   AS base_real,
  count(*) FILTER (WHERE last_sign_in_at IS NULL AND arquivado_em IS NULL)       AS sem_acesso,
  count(*) FILTER (WHERE veio_de_importacao)                                     AS contas_de_importacao,
  count(*) FILTER (WHERE last_sign_in_at IS NOT NULL AND arquivado_em IS NULL)   AS ja_entraram,
  count(*) FILTER (WHERE last_sign_in_at > now() - INTERVAL '30 days')           AS ativos_30d,
  count(*) FILTER (WHERE last_sign_in_at > now() - INTERVAL '7 days')            AS ativos_7d,
  (SELECT count(DISTINCT student_id) FROM public.student_question_answers)       AS responderam_questao,
  (SELECT count(DISTINCT user_id)    FROM public.essay_submissions)              AS enviaram_redacao,
  (SELECT count(DISTINCT student_id) FROM public.flashcard_progress)             AS usaram_flashcard
FROM base;

COMMENT ON VIEW public.funil_alunos IS
  'Funil de ativacao dos alunos. base_real exclui arquivados; sem_acesso e quem nunca logou.';

-- Números de operação não precisam ser visíveis ao aluno.
REVOKE SELECT ON public.funil_alunos FROM authenticated;
GRANT SELECT ON public.funil_alunos TO service_role;

/** Permite ao admin arquivar e desarquivar sem tocar em SQL. */
CREATE OR REPLACE FUNCTION public.arquivar_aluno(p_aluno UUID, p_motivo TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET arquivado_em = CASE WHEN arquivado_em IS NULL THEN now() ELSE NULL END,
      arquivado_motivo = CASE WHEN arquivado_em IS NULL THEN p_motivo ELSE NULL END
  WHERE id = p_aluno AND role = 'student';
END;
$function$;

REVOKE ALL ON FUNCTION public.arquivar_aluno(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arquivar_aluno(UUID, TEXT) TO authenticated;

/**
 * Funil por RPC, e não leitura direta da view.
 *
 * A view perdeu o GRANT para `authenticated` (números de operação não precisam
 * ser visíveis ao aluno), então o painel do admin precisa de um caminho que
 * confira o papel antes de responder — mesmo padrão de `listar_status_alunos`.
 */
CREATE OR REPLACE FUNCTION public.obter_funil_alunos()
RETURNS SETOF public.funil_alunos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT * FROM public.funil_alunos;
END;
$function$;

REVOKE ALL ON FUNCTION public.obter_funil_alunos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_funil_alunos() TO authenticated;
