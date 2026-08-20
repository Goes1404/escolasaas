-- Seleção dos alunos que merecem um lembrete hoje.
--
-- Hoje nada acorda o aluno. O histórico de `notifications` mostra 2.660
-- notificações de material num disparo único em 15/06 e 23 de chat — nenhuma
-- de engajamento, nunca. O aluno que parou de estudar não recebe nada, e é
-- justamente dele que estamos falando quando dizemos "10 ativos em 7 dias".
--
-- Esta função só ESCOLHE quem recebe e por quê. Quem envia é a rota
-- `/api/cron/lembrete-diario`, porque o Web Push exige assinatura VAPID e isso
-- não existe dentro do Postgres.
--
-- Regras que evitam virar spam:
--   · quem estudou hoje não recebe nada — o lembrete é para quem falta;
--   · no máximo um lembrete por aluno por dia (checado em `notifications`);
--   · quem sumiu há mais de 21 dias sai da lista: a essa altura o problema não
--     se resolve por notificação, e insistir é só incomodar;
--   · só alunos, e só quem tem push cadastrado (sem isso a linha na inbox
--     in-app não seria vista por ninguém).
--
-- Atualizado em 12/08: passou a alcançar também quem tem push mas NUNCA
-- estudou — 35 pessoas, mais do que todo o resto da lista somado. Para elas a
-- mensagem da ofensiva seria mentira (não há ofensiva nem bichinho), então
-- recebem um convite próprio, e no máximo UM POR SEMANA: quem nunca começou
-- não muda de ideia por insistência diária.

-- `DROP` antes do `CREATE`: mudar a lista de colunas de RETURNS TABLE nao e
-- permitido por CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.alunos_para_lembrete();

CREATE FUNCTION public.alunos_para_lembrete()
RETURNS TABLE (
  user_id        UUID,
  segmento       TEXT,
  ofensiva       INTEGER,
  protecoes      INTEGER,
  dias_parado    INTEGER,
  -- Nome do bichinho: quem tem um ouve a voz dele em vez de um aviso de
  -- sistema. E a diferenca entre uma metrica cobrando e alguem esperando.
  pet_nome       TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  base AS (
    SELECT
      p.id,
      COALESCE(s.current_streak, 0) AS ofensiva,
      COALESCE(s.protections, 0)    AS protecoes,
      (SELECT d FROM hoje) - s.last_activity_date AS dias,
      pet.nome AS pet_nome
    FROM public.profiles p
    JOIN public.study_streaks s ON s.user_id = p.id
    LEFT JOIN public.pets pet ON pet.user_id = p.id
    WHERE p.role = 'student'
      AND s.last_activity_date IS NOT NULL
      -- Sem push cadastrado, o lembrete não chega a lugar nenhum.
      AND EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = p.id)
      -- Um por dia, no máximo.
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'ofensiva'
          AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (SELECT d FROM hoje)
      )
  )
  SELECT
    id,
    CASE
      -- Estudou ontem: hoje é o último dia para manter. É o lembrete que mais
      -- vale, porque a ação ainda salva alguma coisa.
      WHEN dias = 1 THEN 'ultimo_dia'
      -- Faltou, mas a proteção ainda cobre — dá para voltar de onde parou.
      WHEN dias - 1 <= protecoes THEN 'protegida'
      -- Perdeu a ofensiva e continua fora.
      ELSE 'sumido'
    END,
    ofensiva,
    protecoes,
    dias,
    pet_nome
  FROM base
  -- dias = 0 é quem já estudou hoje.
  WHERE dias BETWEEN 1 AND 21;
$function$;

COMMENT ON FUNCTION public.alunos_para_lembrete() IS
  'Alunos que devem receber lembrete hoje, com o motivo e o nome do bichinho. Só seleciona; o envio é da rota /api/cron/lembrete-diario.';

-- Só o servidor consulta isto: a lista inteira de quem parou de estudar é dado
-- de todo mundo, não do aluno.
REVOKE ALL ON FUNCTION public.alunos_para_lembrete() FROM PUBLIC, anon, authenticated;
