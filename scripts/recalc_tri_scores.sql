-- Recalcula o tri_score das tentativas existentes (exam_attempts) usando a
-- curva θ -> nota ENEM ATUAL definida em src/lib/tri-solver.ts.
--
-- Quando as âncoras de calibração da TRI mudam (ver ENEM_ANCHORS em
-- tri-solver.ts), as notas já gravadas ficam desatualizadas. Este script
-- recomputa, de forma idêntica ao solver do app (EAP no modelo 3PL sobre uma
-- grade de θ de -4.0 a 4.0 com passo 0.05 e prior N(0,1)), e regrava apenas
-- as tentativas cujo valor muda.
--
-- É idempotente e seguro para reexecutar. NÃO é uma migration (não roda no
-- deploy): rode manualmente (psql / Supabase SQL editor) após recalibrar a TRI.
--
-- IMPORTANTE: mantenha as âncoras abaixo em sincronia com ENEM_ANCHORS.

WITH target AS (
  SELECT a.id, a.answers
  FROM exam_attempts a
  WHERE a.tri_score IS NOT NULL AND jsonb_typeof(a.answers) = 'array'
),
items AS (
  SELECT t.id AS attempt_id,
    (upper(trim(ans->>'selected')) = upper(trim(ans->>'correct'))) AS correct,
    LEAST(3.0, GREATEST(0.3, COALESCE(q.tri_a, 1.2)))::float8 AS a,
    LEAST(4.0, GREATEST(-4.0, COALESCE(q.tri_b, 0.2)))::float8 AS b,
    LEAST(0.5, GREATEST(0.0, COALESCE(q.tri_c, 0.20)))::float8 AS c
  FROM target t
  CROSS JOIN LATERAL jsonb_array_elements(t.answers) AS ans
  LEFT JOIN questions q ON q.id = NULLIF(ans->>'question_id','')::uuid
),
grid AS ( SELECT generate_series(-80,80)::float8/20.0 AS theta ),   -- -4.0..4.0 passo 0.05
loglik AS (
  SELECT i.attempt_id, g.theta,
    SUM( CASE WHEN COALESCE(i.correct,false) THEN ln(pc) ELSE ln(1-pc) END ) AS ll
  FROM items i CROSS JOIN grid g
  CROSS JOIN LATERAL (
    SELECT LEAST(1-1e-9, GREATEST(1e-9, i.c + (1-i.c)/(1+exp(-i.a*(g.theta-i.b))) )) AS pc
  ) p
  GROUP BY i.attempt_id, g.theta
),
moments AS (
  SELECT attempt_id,
    SUM(exp(ll - 0.5*theta*theta)) AS s0,
    SUM(theta * exp(ll - 0.5*theta*theta)) AS s1
  FROM loglik GROUP BY attempt_id
),
theta_hat AS ( SELECT attempt_id, s1/s0 AS theta FROM moments WHERE s0 > 0 ),
scored AS (
  SELECT attempt_id,
    CASE                                    -- âncoras ENEM (θ, nota) — ver tri-solver.ts
      WHEN theta <= -3.5 THEN 300
      WHEN theta <= -1.6 THEN round(300 + (theta+3.5)/1.9*(350-300))
      WHEN theta <=  0.0 THEN round(350 + (theta+1.6)/1.6*(500-350))
      WHEN theta <=  1.5 THEN round(500 + (theta-0.0)/1.5*(690-500))
      WHEN theta <=  3.0 THEN round(690 + (theta-1.5)/1.5*(920-690))
      WHEN theta <   3.6 THEN round(920 + (theta-3.0)/0.6*(1000-920))
      ELSE 1000
    END::int AS new_score
  FROM theta_hat
)
UPDATE exam_attempts a
SET tri_score = s.new_score
FROM scored s
WHERE a.id = s.attempt_id AND a.tri_score IS DISTINCT FROM s.new_score
RETURNING a.id, a.tri_score AS updated_to;

-- Limpa notas TRI "fantasma": tentativas sem respostas por questão (registros
-- só de score, importados/lançados) não têm como ter TRI calculada. Se tiverem
-- um tri_score gravado, ele é inconsistente e polui o ranking — zeramos.
UPDATE exam_attempts
SET tri_score = NULL
WHERE tri_score IS NOT NULL
  AND (jsonb_typeof(answers) <> 'array' OR jsonb_array_length(answers) = 0);
