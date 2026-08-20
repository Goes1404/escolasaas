-- Telemetria de produto: onde o aluno passa e onde ele trava.
--
-- Motivo: em 11/08/2026 o funil mostrava 733 alunos reais, 472 que já entraram,
-- 373 que voltaram outro dia — e apenas 86 que chegaram a usar alguma
-- ferramenta de estudo. O buraco está entre "voltou" e "estudou", e não havia
-- como saber onde: `activity_logs` tinha 21 linhas de 6 usuários em cinco meses.
--
-- Os dois defeitos encontrados na redação (o CHECK que limitava a nota a 100 e
-- o tema pré-preenchido que anulava por fuga) só apareceram por arqueologia nas
-- tabelas de negócio. Ambos falhavam em silêncio: o aluno tentava, não
-- funcionava, e não voltava. Sem registro de falha, cada correção é aposta.
--
-- Por que tabela nova e não `activity_logs`: aquela é auditoria administrativa,
-- guarda `user_name` (PII) e não tem campo de propriedades. Misturar auditoria
-- com analytics de produto arrastaria PII para dentro de consultas de métrica.
--
-- ── Privacidade ───────────────────────────────────────────────────────────
-- Alunos são majoritariamente menores de idade. Aqui NÃO entra nome, e-mail,
-- telefone nem conteúdo escrito por eles: só a rota normalizada (sem ids), o
-- nome do evento e propriedades numéricas/booleanas. `user_id` é necessário
-- para montar funil por aluno, e cai junto com o perfil (ON DELETE CASCADE).

CREATE TABLE IF NOT EXISTS public.app_events (
  -- bigserial e não uuid: esta tabela cresce por ordem de grandeza mais que as
  -- outras, e o índice de um inteiro sequencial é bem mais barato.
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** Agrupa os eventos de uma mesma visita. Gerado no cliente, não é segredo. */
  session_id  TEXT,
  /** Categoria: 'tela', 'acao' ou 'falha'. */
  kind        TEXT NOT NULL CHECK (kind IN ('tela', 'acao', 'falha')),
  /** Rota normalizada, sem ids: /dashboard/student/provas/[id]. */
  screen      TEXT,
  /** Nome do evento: 'redacao_enviada', 'simulado_iniciado', 'erro_salvar'… */
  name        TEXT NOT NULL,
  /** Só números, booleanos e rótulos curtos. Nunca texto escrito pelo aluno. */
  props       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_events IS
  'Telemetria de produto (tela/acao/falha). Sem PII: nao gravar nome, email, telefone nem texto do aluno.';

CREATE INDEX IF NOT EXISTS idx_app_events_created ON public.app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_user    ON public.app_events (user_id, created_at DESC);
-- Consultas de funil filtram por nome do evento em janela de tempo.
CREATE INDEX IF NOT EXISTS idx_app_events_name    ON public.app_events (name, created_at DESC);
-- Falhas são o uso mais frequente na prática: "o que quebrou hoje".
CREATE INDEX IF NOT EXISTS idx_app_events_falhas  ON public.app_events (created_at DESC)
  WHERE kind = 'falha';

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- O aluno grava os próprios eventos e não lê nada. Escrever para outro usuário
-- é bloqueado pelo WITH CHECK: sem isso, qualquer sessão poderia poluir o
-- funil de terceiros.
DROP POLICY IF EXISTS app_events_insere_proprio ON public.app_events;
CREATE POLICY app_events_insere_proprio ON public.app_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Leitura só para quem analisa. `profiles.role` e não o claim do JWT: o claim
-- `user_role` é null para todos os usuários (não há custom access token hook),
-- então policy que gateia por ele nunca concede acesso.
DROP POLICY IF EXISTS app_events_le_staff ON public.app_events;
CREATE POLICY app_events_le_staff ON public.app_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'teacher')
  ));

-- ── Funil, pronto para leitura ────────────────────────────────────────────
-- Responde "de cada 100 que entram, quantos chegam a estudar" sem exigir que
-- alguém escreva o SQL de novo toda vez.
CREATE OR REPLACE VIEW public.funil_alunos AS
WITH base AS (
  SELECT p.id,
         u.last_sign_in_at,
         -- Contas criadas pela importação de boletim de 14/07 nunca foram
         -- entregues a ninguém (319 das 328 jamais logaram). Mantê-las na
         -- conta faria toda taxa parecer metade do que é.
         (u.created_at::date = DATE '2026-07-14') AS veio_de_importacao
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student'
)
SELECT
  count(*) FILTER (WHERE NOT veio_de_importacao)                                   AS base_real,
  count(*) FILTER (WHERE veio_de_importacao)                                       AS contas_de_importacao,
  count(*) FILTER (WHERE NOT veio_de_importacao AND last_sign_in_at IS NOT NULL)   AS ja_entraram,
  count(*) FILTER (WHERE last_sign_in_at > now() - INTERVAL '30 days')             AS ativos_30d,
  count(*) FILTER (WHERE last_sign_in_at > now() - INTERVAL '7 days')              AS ativos_7d,
  (SELECT count(DISTINCT student_id) FROM public.student_question_answers)         AS responderam_questao,
  (SELECT count(DISTINCT user_id)    FROM public.essay_submissions)                AS enviaram_redacao,
  (SELECT count(DISTINCT student_id) FROM public.flashcard_progress)               AS usaram_flashcard
FROM base;

COMMENT ON VIEW public.funil_alunos IS
  'Funil de ativacao dos alunos, excluindo as contas criadas pela importacao de boletim de 14/07/2026.';

GRANT SELECT ON public.funil_alunos TO authenticated;
