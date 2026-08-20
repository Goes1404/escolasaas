-- Duas espécies novas: axolote e ornitorrinco.
--
-- Vieram da arte: foram geradas junto com as outras e não existiam no CHECK.
-- Sem esta migration, escolher qualquer uma das duas falha com "Especie
-- invalida" — a validação vive no banco, não no cliente, e é assim de
-- propósito (a lista de espécies é regra de dados, não de tela).
--
-- Mesmas duas listas de sempre, e elas precisam bater com `ARQUETIPOS` em
-- `src/lib/mascote.ts`: o CHECK da tabela e a validação dentro de
-- `adotar_bichinho()`. Nenhuma espécie sai da lista — remover uma deixaria o
-- bicho de quem a adotou num estado que a própria tabela recusa.

ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_especie_check;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_especie_check CHECK (especie IN (
    -- Arquétipos 3D
    'lobinho', 'dragao', 'dinossauro', 'eletrico', 'axolote', 'ornitorrinco',
    -- Legado: adotados antes do 3D
    'capivara', 'coruja', 'gato', 'tucano'
  ));

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

  INSERT INTO public.pets (user_id, especie, nome)
  VALUES (v_user, p_especie, v_nome)
  ON CONFLICT (user_id) DO UPDATE
    SET especie = EXCLUDED.especie, nome = EXCLUDED.nome, atualizado_em = now();

  RETURN public.meu_bichinho();
END;
$function$;

REVOKE ALL ON FUNCTION public.adotar_bichinho(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adotar_bichinho(TEXT, TEXT) TO authenticated;
