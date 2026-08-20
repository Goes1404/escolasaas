-- Agendamento do fechamento de ciclo (pg_cron).
--
-- É a peça que faltava em 08/08: a apuração existia como decisão, mas nada a
-- disparava. Roda de hora em hora, então o pódio sai no máximo ~1h depois do
-- fim do ciclo (que cai domingo 23:59:59 BRT = segunda 02:59:59 UTC).
--
-- `close_due_ranking_cycles()` é idempotente: só toca em ciclos com
-- `ends_at <= now()` e `closed_at IS NULL`. As 167 execuções semanais que não
-- encontram nada a fechar retornam 0 sem escrever nada.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ausente: agende close_due_ranking_cycles() manualmente.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('fechar-ciclos-ranking')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fechar-ciclos-ranking');

  PERFORM cron.schedule(
    'fechar-ciclos-ranking',
    '5 * * * *',
    $cron$SELECT public.close_due_ranking_cycles();$cron$
  );
END
$$;
