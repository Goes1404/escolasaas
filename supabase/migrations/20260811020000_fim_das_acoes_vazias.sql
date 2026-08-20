-- Tira o XP das ações que não exigem estudo.
--
-- Alternativa às travas de ritmo (recusadas): em vez de detectar farming, some
-- o que dá para farmar. Sobra pontuar por acerto, que não tem atalho.
--
-- Duas fontes concentravam o problema, ambas visíveis no log:
--
--   flashcard_correct   1.667 linhas   8.335 XP
--   simulado_complete     274 linhas   5.450 XP
--   correct_answer        195 linhas   2.440 XP   ← o que deveria dominar
--
-- 1) `simulado_complete` valia 20 XP só por chegar ao fim. Abrir e fechar sem
--    responder nada pagava igual — 60 dos 200 simulados da 2ª colocada da leva
--    anterior tiveram zero acertos. Vai a 0. O aluno continua pontuando pelos
--    acertos do simulado (`correct_answer`, 5 XP cada), que é o que ele fez de
--    fato. Deixo a ação existindo com 0 em vez de apagar a linha: `award_xp()`
--    lança exceção para ação desconhecida, e a tela de simulados a chama.
--
-- 2) `flashcard_correct` era a única ação com `once_only = false` de fato usada
--    — o mesmo card pagava 5 XP quantas vezes fosse revisto, e o 1º colocado
--    somou 1.019 num único ciclo. Passa a pagar uma vez por card. Rever continua
--    valendo para o algoritmo de repetição espaçada; só não paga de novo.
--
-- `material_viewed` também está com `once_only = false`, mas nenhuma chamada
-- existe no app (zero linhas no log em treze meses), então fica como está.

UPDATE public.xp_action_values SET points = 0 WHERE action = 'simulado_complete';

UPDATE public.xp_action_values SET once_only = true WHERE action = 'flashcard_correct';

-- Observação sobre `uniq_xp_log_student_action_ref`: o índice único não cobre
-- `flashcard_correct` porque o histórico já tem repetições (foi assim que o
-- farming aconteceu), e criá-lo agora falharia. A proteção fica com o teste
-- `EXISTS` dentro de `award_xp()`, suficiente aqui — o farming é sequencial,
-- não concorrente, e uma corrida perdida custa 5 XP.
