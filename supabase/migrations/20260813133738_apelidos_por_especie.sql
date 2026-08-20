-- Um nome por espécie.
--
-- Até aqui o bichinho guardava um nome só (`pets.nome`), e trocar de espécie
-- levava esse nome junto sem perguntar — quem chamava a capivara de "Roberto"
-- via o dragão também virar "Roberto". Fazia sentido enquanto a troca era só
-- estética (espécie nunca teve economia atrelada), mas o nome é outra coisa:
-- o aluno pode querer "Fumaça" para o dragão e "Pingo" para o ornitorrinco, e
-- trocar de volta devolver o nome antigo — não abrir um campo em branco de
-- novo.
--
-- `apelidos` guarda essa memória: um mapa espécie → nome, que só cresce.
-- `nome` continua existindo como o apelido "ativo" — o da espécie corrente,
-- que é o que toda a tela já lê; `apelidos` é a lembrança por trás dele.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS apelidos JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pets.apelidos IS
  'Mapa especie -> nome. Guarda o nome que o aluno deu a cada arquetipo, para a troca de especie lembrar em vez de reaproveitar o nome da especie anterior.';

-- Quem já tinha um bicho antes desta migration ganha a memória do nome atual
-- para a espécie atual — sem isso, a primeira troca "esqueceria" o nome que a
-- pessoa já usava.
UPDATE public.pets
SET apelidos = jsonb_build_object(especie, nome)
WHERE apelidos = '{}'::jsonb;

-- ── Adoção/troca: agora grava no mapa, não só no nome ativo ────────────────
CREATE OR REPLACE FUNCTION public.adotar_bichinho(p_especie TEXT, p_nome TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT := btrim(COALESCE(p_nome, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sem sessao.' USING ERRCODE = '42501';
  END IF;
  IF p_especie IS NULL OR p_especie NOT IN (
    'lobinho','dragao','dinossauro','eletrico','axolote','ornitorrinco',
    'capivara','coruja','gato','tucano'
  ) THEN
    RAISE EXCEPTION 'Especie invalida.' USING ERRCODE = '22023';
  END IF;
  IF length(v_nome) < 1 OR length(v_nome) > 20 THEN
    RAISE EXCEPTION 'O nome precisa ter de 1 a 20 caracteres.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pets (user_id, especie, nome, apelidos)
  VALUES (v_user, p_especie, v_nome, jsonb_build_object(p_especie, v_nome))
  ON CONFLICT (user_id) DO UPDATE
    SET especie = EXCLUDED.especie,
        nome = EXCLUDED.nome,
        -- `||` sobrescreve só a chave da espécie escolhida agora; o nome que
        -- o aluno deu às outras espécies continua guardado, intacto.
        apelidos = pets.apelidos || jsonb_build_object(p_especie, v_nome),
        atualizado_em = now();

  RETURN public.meu_bichinho();
END;
$function$;

-- ── Estado completo: devolve o mapa, para a tela pré-preencher o nome ──────
CREATE OR REPLACE FUNCTION public.meu_bichinho()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_niveis CONSTANT INTEGER[] := ARRAY[0, 3, 7, 14, 25, 40, 60, 90];

  v_user     UUID := auth.uid();
  v_pet      public.pets%ROWTYPE;
  v_dias     INTEGER := 0;
  v_ofensiva INTEGER := 0;
  v_ultima   DATE;
  v_protec   INTEGER := 0;
  v_xp       INTEGER := 0;
  v_hoje     DATE;
  v_parado   INTEGER;
  v_nivel    INTEGER := 1;
  v_humor    TEXT;
  v_prox     INTEGER;
  i          INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sem sessao.' USING ERRCODE = '42501';
  END IF;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT * INTO v_pet FROM public.pets WHERE user_id = v_user;

  SELECT total_study_days, current_streak, last_activity_date, protections
    INTO v_dias, v_ofensiva, v_ultima, v_protec
  FROM public.study_streaks WHERE user_id = v_user;

  SELECT COALESCE(xp_points, 0) INTO v_xp FROM public.profiles WHERE id = v_user;

  v_dias     := COALESCE(v_dias, 0);
  v_ofensiva := COALESCE(v_ofensiva, 0);
  v_protec   := COALESCE(v_protec, 0);

  FOR i IN 1 .. array_length(c_niveis, 1) LOOP
    IF v_dias >= c_niveis[i] THEN v_nivel := i; END IF;
  END LOOP;
  v_prox := CASE WHEN v_nivel < array_length(c_niveis, 1) THEN c_niveis[v_nivel + 1] ELSE NULL END;

  v_parado := CASE WHEN v_ultima IS NULL THEN NULL ELSE v_hoje - v_ultima END;
  v_humor := CASE
    WHEN v_ultima IS NULL THEN 'novo'
    WHEN v_parado <= 0    THEN 'feliz'
    WHEN v_parado = 1     THEN 'com_fome'
    WHEN v_parado <= 3    THEN 'triste'
    ELSE 'dormindo'
  END;

  RETURN jsonb_build_object(
    'existe',          v_pet.user_id IS NOT NULL,
    'especie',         v_pet.especie,
    'nome',            v_pet.nome,
    'apelidos',        COALESCE(v_pet.apelidos, '{}'::jsonb),
    'nivel',           v_nivel,
    'humor',           v_humor,
    'dias_estudo',     v_dias,
    'dias_proximo_nivel', v_prox,
    'ofensiva',        v_ofensiva,
    'protecoes',       v_protec,
    'dias_sem_estudar', v_parado,
    'saldo',           GREATEST(0, v_xp - COALESCE(v_pet.xp_gasto, 0)),
    'preco_protecao',  public.preco_protecao()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.adotar_bichinho(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.meu_bichinho()             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adotar_bichinho(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_bichinho()              TO authenticated;
