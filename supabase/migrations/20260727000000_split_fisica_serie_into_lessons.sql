-- Separa a série "Física" em aulas avulsas, mantendo-as na pasta (categoria) Física.
--
-- Contexto: a série foi criada pelo recurso de agrupar aulas do painel do professor
-- (handleMergeTrails), que cria uma trilha `serie` e re-parenta os módulos das aulas
-- originais. Esta migration faz a operação inversa: cada módulo volta a ser uma
-- trilha `standalone` própria.
--
-- Preserva os ids de `modules` e `learning_contents` (só troca o `trail_id`), então
-- nenhum vídeo é recriado e nada que aponte para o conteúdo fica órfão.
--
-- Ordem de exibição: a listagem de trilhas ordena por `created_at DESC` e não existe
-- coluna de ordenação, então o `created_at` das novas trilhas é escalonado para que a
-- ordem pedagógica (Aula 01, 02, 05...15, depois as sem numeração) se mantenha na pasta.
--
-- Atenção: apagar a trilha da série remove em cascata as linhas de `user_progress`
-- ligadas a ela. Esse progresso é um percentual agregado por trilha e não há registro
-- de conclusão por vídeo, então não é possível redistribuí-lo entre as 16 aulas sem
-- inventar dado. É o mesmo efeito que o agrupamento de aulas do painel já produz ao
-- apagar as trilhas de origem.
--
-- Backup dos 7 registros removidos (user_id, percentage, last_accessed), caso se queira
-- restaurar o histórico depois:
--   ('91c0f914-fafd-4dee-ba03-c41d3c307115', 89, '2026-07-03 17:43:27.246+00'),
--   ('4460866d-9101-4598-8e71-c66eefbcffa4', 85, '2026-07-01 00:33:01.302+00'),
--   ('c81a5d45-7e9d-4785-8196-6c137a067dc2', 85, '2026-06-18 16:03:47.989+00'),
--   ('9354d9cb-fcae-44b7-bba8-560b49de5273', 85, '2026-07-16 14:24:52.61+00'),
--   ('175491d2-c119-4793-8b73-6300a5f8b5d5', 85, '2026-07-19 16:43:30.144+00'),
--   ('0a3c3497-dee3-49e5-b7b2-c580ecee295b', 85, '2026-07-19 18:20:01.382+00'),
--   ('785cfb5e-fa1f-4f78-a78b-cf4e3317c964', 85, '2026-07-12 10:02:55.199+00')

DO $$
DECLARE
  v_serie_id uuid := 'c868f744-c647-4fe2-8ef7-1286ea472709';
  v_serie    trails%ROWTYPE;
  r          RECORD;
  v_new_id   uuid;
  i          int := 0;
BEGIN
  SELECT * INTO v_serie FROM trails WHERE id = v_serie_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Serie % nao encontrada; nada a fazer.', v_serie_id;
    RETURN;
  END IF;

  IF v_serie.trail_type <> 'serie' THEN
    RAISE EXCEPTION 'Trilha % nao e uma serie (trail_type=%)', v_serie_id, v_serie.trail_type;
  END IF;

  FOR r IN
    SELECT m.id AS module_id, btrim(c.title) AS lesson_title
    FROM modules m
    JOIN learning_contents c ON c.module_id = m.id
    WHERE m.trail_id = v_serie_id
    ORDER BY
      -- aulas numeradas primeiro, em ordem numerica; depois as sem numeracao, por titulo
      CASE WHEN btrim(c.title) ~ '^Aula\s+0*\d+' THEN 0 ELSE 1 END,
      NULLIF(substring(btrim(c.title) FROM '^Aula\s+0*(\d+)'), '')::int NULLS LAST,
      btrim(c.title)
  LOOP
    INSERT INTO trails (
      title, category, description, teacher_id, teacher_name, author_id,
      status, target_audience, trail_type, image_url, created_at
    )
    VALUES (
      r.lesson_title,
      v_serie.category,
      NULL, -- a descricao da serie era gerada automaticamente pelo merge
      v_serie.teacher_id,
      v_serie.teacher_name,
      v_serie.author_id,
      v_serie.status,
      v_serie.target_audience,
      'standalone',
      NULL, -- sem capa: a UI gera uma capa tematica a partir do titulo (getTrailCoverUrl)
      now() - (i * interval '1 second')
    )
    RETURNING id INTO v_new_id;

    -- Aula avulsa segue o padrao do app: 1 trilha -> 1 modulo -> 1 conteudo.
    UPDATE modules SET trail_id = v_new_id, order_index = 1 WHERE id = r.module_id;
    UPDATE learning_contents SET order_index = 0 WHERE module_id = r.module_id;

    i := i + 1;
  END LOOP;

  -- A serie fica vazia depois de mover todos os modulos.
  DELETE FROM trails WHERE id = v_serie_id;

  RAISE NOTICE 'Serie Fisica separada em % aulas avulsas.', i;
END $$;
