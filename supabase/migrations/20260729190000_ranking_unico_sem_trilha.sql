-- Ranking único: ENEM e ETEC disputam juntos.
--
-- Decisão de produto: sem divisão por trilha. O motivo prático é que a trilha
-- ETEC tem 701 alunos e nenhuma pontuação — o banco de questões de ETEC só
-- passou a existir agora. Com rankings separados, a premiação de 08/08 poderia
-- chegar sem ninguém elegível do lado ETEC, enquanto do lado ENEM haveria
-- disputa. Unificando, existem três primeiros colocados de verdade.
--
-- A coluna `track` permanece, mas apenas para exibição (selo da trilha ao lado
-- do nome). Ela deixou de particionar o `rank()`.
--
-- Nota sobre empates: `rank()` põe todos os alunos sem pontuação na mesma
-- posição. Hoje isso significa 1.052 pessoas empatadas em 7º, o que é o
-- comportamento correto — ninguém "perde" para alguém que também fez zero.

CREATE OR REPLACE VIEW public.weekly_ranking AS
  SELECT p.id AS student_id,
         p.full_name,
         p.avatar_url,
         p.exam_target,
         p.xp_points AS total_xp,
         COALESCE(sum(xl.xp_earned), 0::bigint)::integer AS weekly_xp,
         rank() OVER (
           ORDER BY (COALESCE(sum(xl.xp_earned), 0::bigint)) DESC
         ) AS "position",
         public.ranking_track(p.exam_target) AS track
    FROM profiles p
    LEFT JOIN student_xp_log xl
           ON xl.student_id = p.id
          AND xl.created_at >= public.current_ranking_cycle_start()
   WHERE p.role = 'student'::user_role
   GROUP BY p.id, p.full_name, p.avatar_url, p.exam_target, p.xp_points;

COMMENT ON VIEW public.weekly_ranking IS
  'Ranking unico: ENEM e ETEC disputam juntos, sem particao por trilha. A coluna track permanece apenas para exibicao.';
