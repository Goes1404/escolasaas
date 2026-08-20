-- Reconcilia `student_xp_log` com `profiles.xp_points`.
--
-- Situação encontrada: 11.970 XP somados nos perfis contra 4.895 no log — mais
-- da metade do XP concedido nunca chegou ao log. Como o ranking soma o LOG, 23
-- alunos com XP no perfil apareciam sem nenhuma pontuação, e outros 11 apareciam
-- com menos do que tinham.
--
-- Causa: o `awardXP` antigo gravava o perfil com `await` e o log com falha
-- silenciosa (`void Promise...catch(() => undefined)`). Quando o insert do log
-- falhava, o XP entrava só no perfil, sem erro visível. E, por fazer
-- ler-somar-gravar no perfil, chamadas simultâneas leiam o mesmo total e
-- gravavam o mesmo resultado — o log registrava todas, o perfil avançava uma.
--
-- A causa raiz já está fechada: `award_xp()` grava log e perfil na mesma
-- transação, e o perfil é somado com `xp_points + v_total` em vez de um valor
-- lido antes. Divergir de novo não é possível. Esta migration só conserta o
-- histórico.
--
-- ⚠️ As linhas de ajuste são datadas em 28/07, ANTES do ciclo de premiação que
-- começa em 29/07. Datá-las de hoje faria 23 alunos aparecerem com centenas de
-- XP na disputa do prêmio sem ter estudado nesta leva.

-- 1) Perfil na frente do log → completa o log com a diferença.
INSERT INTO public.student_xp_log (student_id, action, xp_earned, reference_id, created_at)
SELECT p.id,
       'ajuste_historico',
       coalesce(p.xp_points, 0) - coalesce(l.somado, 0),
       NULL,
       TIMESTAMPTZ '2026-07-28 12:00:00-03'
FROM public.profiles p
LEFT JOIN (
  SELECT student_id, sum(xp_earned) AS somado
  FROM public.student_xp_log
  GROUP BY student_id
) l ON l.student_id = p.id
WHERE p.role = 'student'
  AND coalesce(p.xp_points, 0) > coalesce(l.somado, 0)
  AND NOT EXISTS (
    SELECT 1 FROM public.student_xp_log h
    WHERE h.student_id = p.id AND h.action = 'ajuste_historico'
  );

-- 2) Log na frente do perfil → sobe o perfil.
--
-- Aconteceu com uma aluna: três linhas idênticas de 30 XP no mesmo minuto, com o
-- perfil somando apenas 30. É a assinatura da corrida descrita acima. O log é
-- append-only e não sofre disso, então a diferença é XP que ela ganhou e não
-- recebeu — corrigir para baixo (apagando linhas) puniria a aluna por um bug do
-- sistema.
--
-- Só altera `xp_points`, que alimenta `total_xp`. Não toca no log que alimenta
-- `weekly_xp`, então o ciclo de premiação fica intacto.
UPDATE public.profiles p
SET xp_points = l.somado
FROM (
  SELECT student_id, sum(xp_earned) AS somado
  FROM public.student_xp_log
  GROUP BY student_id
) l
WHERE l.student_id = p.id
  AND p.role = 'student'
  AND l.somado > coalesce(p.xp_points, 0);
