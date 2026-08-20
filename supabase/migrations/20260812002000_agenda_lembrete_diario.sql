-- Agendamento do lembrete diário (pg_cron + pg_net).
--
-- Roda às 21:00 UTC = 18:00 em Brasília: fim da tarde, quando o aluno já saiu
-- da escola e ainda dá tempo de responder uma questão antes da noite. Uma vez
-- por dia — a própria função `alunos_para_lembrete()` já garante no máximo um
-- lembrete por aluno por dia, mas rodar uma vez só torna isso óbvio.
--
-- ⚠️ O job precisa de duas configurações que NÃO ficam versionadas aqui, porque
-- uma delas é segredo:
--
--   1. `CRON_SECRET` na Vercel (Settings → Environment Variables).
--   2. A mesma string em `configuracao_privada`, para o Postgres poder assinar
--      a chamada. Ver o INSERT comentado no fim deste arquivo.
--
-- Sem as duas a rota responde 503 (falha fechada) e nada é enviado — de
-- propósito: uma rota que dispara notificação para a base inteira não pode
-- ficar aberta enquanto ninguém configurou o segredo.

-- ── Onde o Postgres guarda o que precisa para chamar a aplicação ───────────
CREATE TABLE IF NOT EXISTS public.configuracao_privada (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.configuracao_privada IS
  'Segredos que os jobs do banco precisam para falar com a aplicacao. Sem policy nenhuma: so service_role e postgres leem.';

-- RLS ligada e NENHUMA policy: nem `anon` nem `authenticated` enxergam uma
-- linha sequer. `pg_cron` roda como `postgres`, que ignora RLS.
ALTER TABLE public.configuracao_privada ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.configuracao_privada FROM PUBLIC, anon, authenticated;

-- ── O job ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_url    TEXT;
  v_token  TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ausente: agende o lembrete manualmente.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net ausente: o job nao consegue chamar a rota.';
    RETURN;
  END IF;

  SELECT valor INTO v_url   FROM public.configuracao_privada WHERE chave = 'app_url';
  SELECT valor INTO v_token FROM public.configuracao_privada WHERE chave = 'cron_secret';

  IF v_url IS NULL OR v_token IS NULL THEN
    -- Não agenda um job que só saberia falhar. O erro de 2026-05 foi
    -- exatamente este: um cron apontando para `https://SEU_PROJECT_REF...`
    -- acumulou 137 mil execuções contra um host inexistente.
    RAISE NOTICE 'configuracao_privada incompleta (app_url / cron_secret): lembrete NAO agendado.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('lembrete-diario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lembrete-diario');

  PERFORM cron.schedule(
    'lembrete-diario',
    '0 21 * * *',
    format(
      $cron$SELECT net.http_post(
        url    := %L,
        headers:= jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body   := '{}'::jsonb
      );$cron$,
      v_url || '/api/cron/lembrete-diario',
      v_token
    )
  );

  RAISE NOTICE 'lembrete-diario agendado para 21:00 UTC (18:00 BRT).';
END
$$;

-- ── Como ativar ────────────────────────────────────────────────────────────
-- Rode uma vez, com o MESMO valor que estiver em `CRON_SECRET` na Vercel, e
-- depois reaplique o bloco acima para o job ser criado:
--
--   INSERT INTO public.configuracao_privada (chave, valor) VALUES
--     ('app_url',     'https://SEU-DOMINIO'),
--     ('cron_secret', 'o-mesmo-valor-do-CRON_SECRET')
--   ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();
--
-- Para conferir depois:  SELECT jobname, schedule, active FROM cron.job;
-- Para testar na hora:   SELECT valor FROM public.configuracao_privada WHERE chave='cron_secret';
--                        e chame a rota com esse Bearer.
