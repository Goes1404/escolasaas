-- Arquétipos 3D do bichinho.
--
-- O bichinho nasceu (migration 20260812003000) desenhado como um emoji de
-- 7rem. Este passo troca o emoji por um boneco 3D e, com ele, entram quatro
-- arquétipos novos: lobinho, dragão, dinossauro e elétrico.
--
-- ── As quatro espécies antigas continuam válidas ──────────────────────────
-- `capivara`, `coruja`, `gato` e `tucano` seguem no CHECK. Já existem alunos
-- com elas adotadas, e tirar uma espécie da lista não "descontinua" nada — ela
-- deixa o bicho de quem a escolheu num estado que a própria tabela recusa.
-- Todas as oito são desenhadas pelo mesmo rig em `src/components/mascote`, o
-- que muda entre um lobo e um tucano é orelha, focinho, cauda e paleta.
--
-- Nada de dados a migrar: a coluna é TEXT, e só o CHECK precisa abrir.

ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_especie_check;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_especie_check CHECK (especie IN (
    -- Arquétipos 3D
    'lobinho', 'dragao', 'dinossauro', 'eletrico',
    -- Legado: adotados antes do 3D
    'capivara', 'coruja', 'gato', 'tucano'
  ));

COMMENT ON COLUMN public.pets.especie IS
  'Arquetipo do bichinho. Os quatro primeiros sao os 3D; os quatro ultimos sao legado e continuam validos porque ja existem alunos com eles. Precisa bater com ARQUETIPOS em src/lib/mascote.ts.';

-- `adotar_bichinho` valida a espécie por conta própria, então a lista dela
-- precisa abrir junto — senão o CHECK aceita e a função recusa.
--
-- O resto do corpo é idêntico ao da migration original: trocar de espécie
-- continua livre (não há economia atrelada a ela) e trocar o nome também.
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
    'lobinho','dragao','dinossauro','eletrico',
    'capivara','coruja','gato','tucano'
  ) THEN
    RAISE EXCEPTION 'Especie invalida.' USING ERRCODE = '22023';
  END IF;
  IF length(v_nome) < 1 OR length(v_nome) > 20 THEN
    RAISE EXCEPTION 'O nome precisa ter de 1 a 20 caracteres.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pets (user_id, especie, nome)
  VALUES (v_user, p_especie, v_nome)
  ON CONFLICT (user_id) DO UPDATE
    SET especie = EXCLUDED.especie, nome = EXCLUDED.nome, atualizado_em = now();

  RETURN public.meu_bichinho();
END;
$function$;

REVOKE ALL ON FUNCTION public.adotar_bichinho(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adotar_bichinho(TEXT, TEXT) TO authenticated;
