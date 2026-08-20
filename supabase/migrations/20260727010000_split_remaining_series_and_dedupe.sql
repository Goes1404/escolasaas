-- Separa as 5 séries restantes em aulas avulsas e remove as duplicatas de conteúdo.
--
-- Continuação de 20260727000000 (que separou a série "Física"). Mesma abordagem:
-- cada módulo vira uma trilha `standalone` própria, na mesma categoria (pasta), sempre
-- preservando os ids de `modules` e `learning_contents` (só troca o `trail_id`), então
-- nenhum vídeo/PDF é recriado e apostilas vinculadas (`workbook_id`) continuam válidas.
--
-- Séries separadas:
--   Geografia .................. 6 módulos ->  5 aulas (1 removida como duplicata)
--   Matemática Básica do Zero .. 11 módulos -> 11 aulas
--   Português .................. 12 módulos -> 12 aulas
--   Química com Helio .......... 12 módulos -> 12 aulas
--   Química com Prof Paulo ..... 15 módulos -> 14 aulas (1 módulo vazio, sem conteúdo)
--
-- Duplicatas removidas (mesmo vídeo cadastrado duas vezes; mantido o título descritivo):
--   1. youtu.be/vmH2QFEtSnM (Física)
--      mantém "Aula 05 - Tipos de Velocidade" / remove "Tipos de velocidade"
--      -> a apostila estava vinculada na cópia removida, então é transferida antes.
--   2. youtu.be/p4AvZ3N60Mc (Geografia, dentro da série)
--      mantém "Introdução - Geografia Frente 2" / remove "Introdução - Lista de Conteúdos"
--   3. youtu.be/elik9wrGxRk (Geografia)
--      mantém "Introdução - Geografia Frente 1" (série) / remove a trilha avulsa
--      "Introdução - Lista de Conteúdos "
--
-- Ordem de exibição: a listagem ordena por `created_at DESC` e não há coluna de ordem,
-- então o `created_at` é escalonado para preservar a ordem original de cada série
-- (module.order_index, content.order_index), mantendo as aulas de uma mesma série juntas.
--
-- Atenção: apagar as trilhas remove em cascata as linhas de `user_progress` ligadas a elas
-- (percentual agregado por trilha; não há registro de conclusão por vídeo, então não é
-- possível redistribuí-lo entre as aulas sem inventar dado). Backup dos 12 registros
-- removidos (user_id, percentage, last_accessed):
--   Matemática Básica do Zero:
--     ('175491d2-c119-4793-8b73-6300a5f8b5d5', 91, '2026-07-20 18:21:08.023+00'),
--     ('69991a99-8964-438f-843b-290d50e20320', 90, '2026-07-15 19:36:29.856+00'),
--     ('dc30c56a-58b7-401b-90ca-341981ddd862', 85, '2026-07-24 13:53:40.694+00'),
--     ('eca76ba5-b6cd-45a5-96ec-94ff1f2f0561', 85, '2026-06-21 14:56:29.313+00')
--   Português:
--     ('c5185f3f-be8f-4185-8a22-2bdeb85ec067', 86, '2026-07-23 19:25:55.961+00'),
--     ('0379cfd3-1beb-4bd3-b3e2-27a362cceb03', 85, '2026-07-17 18:47:34.169+00')
--   Química com Helio:
--     ('785cfb5e-fa1f-4f78-a78b-cf4e3317c964', 85, '2026-07-11 01:59:08.377+00'),
--     ('b94acecf-64be-4ca0-a7a7-56b6f10a21fd', 85, '2026-07-08 23:05:46.535+00'),
--     ('cb04b0bb-50df-4ac1-b57d-08a7704f6a9e', 85, '2026-06-22 20:34:03.816+00')
--   Química com Prof Paulo:
--     ('b173bfd1-40f3-4508-bae9-2ff4295a3730', 93, '2026-07-07 17:01:56.246+00')
--   Introdução - Lista de Conteúdos (trilha avulsa duplicada, Geografia):
--     ('8c4846f0-503d-4abb-9d95-adaab9aae452', 99, '2026-06-16 20:24:07.743+00'),
--     ('0379cfd3-1beb-4bd3-b3e2-27a362cceb03', 85, '2026-06-14 21:21:24.359+00')

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Duplicatas
-- ─────────────────────────────────────────────────────────────────────────────

-- A apostila estava vinculada só na cópia que será removida: preserva o vínculo.
UPDATE learning_contents keep
SET workbook_id = dup.workbook_id
FROM learning_contents dup
WHERE keep.id = 'ee081b39-c8b2-4e71-ad11-733bbe997779'  -- Aula 05 - Tipos de Velocidade
  AND dup.id  = 'bcb074af-4077-4523-80aa-3eb96ccaec7a'  -- Tipos de velocidade (removida)
  AND keep.workbook_id IS NULL
  AND dup.workbook_id IS NOT NULL;

-- Física: remove a trilha avulsa duplicada (cascata em modules + learning_contents).
DELETE FROM trails t
WHERE t.trail_type = 'standalone'
  AND t.category = 'Física'
  AND t.title = 'Tipos de velocidade'
  AND EXISTS (
    SELECT 1 FROM modules m
    JOIN learning_contents c ON c.module_id = m.id
    WHERE m.trail_id = t.id AND c.id = 'bcb074af-4077-4523-80aa-3eb96ccaec7a'
  );

-- Geografia: remove a trilha avulsa que repete o vídeo de "Introdução - Geografia Frente 1".
DELETE FROM trails WHERE id = '63638a70-2692-4620-a578-d31b3429ea6c';

-- Geografia: remove, dentro da série, a cópia que repete "Introdução - Geografia Frente 2"
-- (apagar o módulo leva o conteúdo junto por cascata).
DELETE FROM modules WHERE id = '90cee82f-c596-4c07-8af0-943bce8a6819';

-- Português: título salvo duplicado dentro dele mesmo (erro de copiar/colar).
UPDATE learning_contents
SET title = 'Aula 07 - Classes Gramaticais - Verbo Pt. 2'
WHERE id = '009a0741-d0a7-4a68-ae23-78df579ee380';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Separação das séries
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_series uuid[] := ARRAY[
    'b946f7ce-fa0f-4ba9-a2fb-2e8fc9f66638',  -- Geografia
    'd4e59ee6-110c-4197-b757-a1e73939c227',  -- Matemática Básica do Zero
    '0b54f922-566f-4cae-80b2-ccefd98dfb7a',  -- Português
    '7f43972c-94a8-4a4b-aee5-0fa1533d8a97',  -- Química com Helio
    '3d81f065-ed6b-4e1c-a91f-648dfe43ee91'   -- Química com Prof Paulo
  ]::uuid[];
  v_serie_id uuid;
  v_serie    trails%ROWTYPE;
  r          RECORD;
  v_new_id   uuid;
  v_bad      int;
  i          int := 0;
BEGIN
  -- Guarda: a separação assume 1 conteúdo por módulo (padrão de aula avulsa do app).
  SELECT count(*) INTO v_bad
  FROM modules m
  WHERE m.trail_id = ANY(v_series)
    AND (SELECT count(*) FROM learning_contents c WHERE c.module_id = m.id) > 1;

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Ha % modulo(s) com mais de um conteudo; separacao abortada.', v_bad;
  END IF;

  FOREACH v_serie_id IN ARRAY v_series LOOP
    SELECT * INTO v_serie FROM trails WHERE id = v_serie_id;

    IF NOT FOUND THEN
      RAISE NOTICE 'Serie % nao encontrada; pulando.', v_serie_id;
      CONTINUE;
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
        m.order_index,
        c.order_index,
        -- desempate: aulas numeradas pelo numero, depois por titulo
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
        NULL, -- a descricao era da serie, nao da aula
        v_serie.teacher_id,
        v_serie.teacher_name,
        v_serie.author_id,
        v_serie.status,
        v_serie.target_audience,
        'standalone',
        NULL, -- sem capa: a UI gera capa tematica pelo titulo (getTrailCoverUrl)
        now() - (i * interval '1 second')
      )
      RETURNING id INTO v_new_id;

      UPDATE modules SET trail_id = v_new_id, order_index = 1 WHERE id = r.module_id;
      UPDATE learning_contents SET order_index = 0 WHERE module_id = r.module_id;

      i := i + 1;
    END LOOP;

    -- Remove a serie ja vazia. Modulos sem conteudo (nao re-parenteados) saem por cascata.
    DELETE FROM trails WHERE id = v_serie_id;
  END LOOP;

  RAISE NOTICE 'Series separadas em % aulas avulsas.', i;
END $$;
