-- Pódio do último ciclo encerrado, para a tela do aluno.
--
-- O comunicado anuncia os vencedores uma vez e depois some no meio dos outros
-- avisos. Quem entra na tela de Ranking depois do fim da leva vê a semana nova
-- começando do zero e nenhum sinal de que houve premiação — foi o que aconteceu
-- em 08/08. Esta view mantém o resultado visível onde o aluno vai procurar.
--
-- Expõe nome e avatar como `weekly_ranking` já expõe, e nada além disso. Mostra
-- `xp_apurado` (o número que decidiu o pódio), não o bruto, para o aluno não ver
-- dois totais diferentes sem explicação.

CREATE OR REPLACE VIEW public.ranking_last_podium AS
  SELECT w.position,
         w.student_id,
         p.full_name,
         p.avatar_url,
         w.xp_apurado AS xp,
         c.label      AS cycle_label,
         c.ends_at    AS cycle_ends_at
    FROM public.ranking_cycle_winners w
    JOIN public.profiles p ON p.id = w.student_id
    JOIN public.ranking_cycles c ON c.id = w.cycle_id
   WHERE c.id = (
     SELECT id FROM public.ranking_cycles
      WHERE closed_at IS NOT NULL
      ORDER BY ends_at DESC
      LIMIT 1
   );

COMMENT ON VIEW public.ranking_last_podium IS
  'Podio do ultimo ciclo encerrado. Alimenta o card de vencedores na tela de Ranking do aluno.';

GRANT SELECT ON public.ranking_last_podium TO authenticated;
