-- Desativa o cron job `cleanup-images-nightly`, que nunca funcionou.
--
-- Dois defeitos ao mesmo tempo:
--   1. O nome diz "nightly", mas o agendamento é `* * * * *` — a cada minuto.
--   2. A URL e a chave nunca foram preenchidas. Ele dispara
--      `net.http_post` para `https://SEU_PROJECT_REF.supabase.co/functions/v1/
--      cleanup-orphaned-images` com o cabeçalho `Bearer SUA_SERVICE_ROLE_KEY`.
--
-- Resultado: 137.050 execuções desde maio contra um host que não existe. Elas
-- aparecem como "succeeded" porque `net.http_post` apenas enfileira o pedido —
-- a resolução de DNS falha depois, no worker do pg_net, fora do alcance do
-- histórico do cron.
--
-- Desativado, e não removido, de propósito: a limpeza de imagens órfãs é uma
-- necessidade real. Quando a edge function existir, basta corrigir a URL,
-- ajustar o horário e reativar — a definição continua aqui.
--
--   Para reativar (com a URL correta):
--     SELECT cron.alter_job(1, schedule := '0 3 * * *', active := true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobid = 1 AND jobname = 'cleanup-images-nightly') THEN
    PERFORM cron.alter_job(1, active := false);
  END IF;
END
$$;
