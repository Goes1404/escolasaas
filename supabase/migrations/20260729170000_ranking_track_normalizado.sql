-- Uma trilha por ranking, em vez de uma por variação de texto.
--
-- `profiles.exam_target` é texto livre, e em produção tem SEIS variações:
--   ETEC (697), ENEM (275), 'Não informado' (72), enem (9), etec (4), nulo (1)
--
-- Como a view fazia `PARTITION BY p.exam_target`, existiam seis rankings
-- paralelos. Efeito prático encontrado ao conferir os dados: uma aluna
-- cadastrada como `enem` (minúsculo) aparecia em 1º lugar com 45 XP, enquanto
-- outra, cadastrada como `ENEM`, era 1º lugar com 75 XP — duas "primeiras
-- colocadas" na mesma trilha. Com prêmio para os 3 primeiros isso daria até 18
-- ganhadores e premiaria gente errada.
--
-- Pior: a interface filtrava `.eq('exam_target', audience)` com `audience` já em
-- minúsculo, então a comparação casava apenas com as 9 linhas de `enem`. O aluno
-- cadastrado como `ENEM` (a maioria) via um ranking que não o incluía.
--
-- A normalização espelha `allowedExamTypesFor` do app: contém "etec" → etec,
-- todo o resto → enem. Quem está como 'Não informado' ou nulo cai em enem, que
-- é o padrão que o app já usa em simulados e provas.

CREATE OR REPLACE FUNCTION public.ranking_track(p_exam_target TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE
    WHEN lower(coalesce(p_exam_target, '')) LIKE '%etec%' THEN 'etec'
    ELSE 'enem'
  END;
$function$;

COMMENT ON FUNCTION public.ranking_track(TEXT) IS
  'Trilha canonica do ranking. Espelha allowedExamTypesFor do app: contem etec -> etec, resto -> enem.';

-- `track` entra no FIM da lista: CREATE OR REPLACE VIEW não permite inserir
-- coluna no meio, e as demais precisam manter nome e ordem porque a tela do
-- aluno e o widget selecionam por nome.
CREATE OR REPLACE VIEW public.weekly_ranking AS
  SELECT p.id AS student_id,
         p.full_name,
         p.avatar_url,
         p.exam_target,
         p.xp_points AS total_xp,
         COALESCE(sum(xl.xp_earned), 0::bigint)::integer AS weekly_xp,
         rank() OVER (
           PARTITION BY public.ranking_track(p.exam_target)
           ORDER BY (COALESCE(sum(xl.xp_earned), 0::bigint)) DESC
         ) AS "position",
         public.ranking_track(p.exam_target) AS track
    FROM profiles p
    LEFT JOIN student_xp_log xl
           ON xl.student_id = p.id
          AND xl.created_at >= public.current_ranking_cycle_start()
   WHERE p.role = 'student'::user_role
   GROUP BY p.id, p.full_name, p.avatar_url, p.exam_target, p.xp_points;
