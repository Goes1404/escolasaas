-- Ciclos semanais seguintes, para o fechamento automático ter o que fechar.
--
-- Sem esta parte o problema de 08/08 se repete de outra forma: a primeira leva
-- acabou, `ranking_cycles` ficou sem nenhuma linha vigente e
-- `current_ranking_cycle_start()` caiu no fallback `date_trunc('week', now())`.
-- O ranking continua aparecendo na tela, mas ninguém fecha nada, ninguém apura
-- pódio e nenhum comunicado sai — exatamente o silêncio que o aluno viu.
--
-- Cadência: segunda 00:00 → domingo 23:59:59, horário de Brasília (-03).
--
-- A primeira linha é a exceção: começa em 09/08 (sábado), logo depois do fim do
-- ciclo anterior, para não abrir buraco. O XP de 09 e 10/08 já ganho conta nela.
-- As demais são semanas cheias, geradas até 29/11/2026.
--
-- Para encerrar a premiação basta apagar os ciclos futuros:
--   DELETE FROM ranking_cycles WHERE starts_at > now() AND closed_at IS NULL;
-- Sem ciclo vigente o ranking volta ao fallback semanal, sem apuração de pódio.

INSERT INTO public.ranking_cycles (starts_at, ends_at, label)
SELECT TIMESTAMPTZ '2026-08-09 00:00:00-03',
       TIMESTAMPTZ '2026-08-16 23:59:59-03',
       'Semana de 09/08 a 16/08'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ranking_cycles WHERE starts_at = TIMESTAMPTZ '2026-08-09 00:00:00-03'
);

INSERT INTO public.ranking_cycles (starts_at, ends_at, label)
SELECT ini,
       ini + INTERVAL '7 days' - INTERVAL '1 second',
       'Semana de ' || to_char(ini AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') ||
       ' a ' || to_char((ini + INTERVAL '6 days') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')
FROM generate_series(
       TIMESTAMPTZ '2026-08-17 00:00:00-03',
       TIMESTAMPTZ '2026-11-23 00:00:00-03',
       INTERVAL '7 days'
     ) AS ini
WHERE NOT EXISTS (
  SELECT 1 FROM public.ranking_cycles c WHERE c.starts_at = ini
);
