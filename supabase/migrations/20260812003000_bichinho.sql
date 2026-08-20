-- Bichinho de estimação.
--
-- Ideia do usuário, no espírito do Duolingo: o aluno cuida de um bicho que sobe
-- de nível conforme ele estuda. Três decisões de produto moldaram o desenho:
--
-- 1. **O bicho nunca morre.** Passa por humores (feliz → com fome → triste →
--    dormindo) e volta com um dia de estudo. A versão tamagotchi que morre
--    produz o contrário do que se quer: quem falhou três dias não volta para um
--    bicho morto, para de abrir o aplicativo. Num cursinho com menores às
--    voltas com o ENEM, culpa não é combustível.
--
-- 2. **Nível nunca cai.** O nível vem de `total_study_days`, que só cresce — o
--    aluno nunca perde o que já estudou. Quem reage ao abandono é o humor, que
--    é reversível. Assim a tensão existe sem virar castigo.
--
-- 3. **Estudo alimenta; XP compra.** Coerente com a régua já adotada em 11/08,
--    quando `simulado_complete` foi a zero: entrar e clicar não é estudo.
--
-- ── A economia não pode encostar no prêmio ────────────────────────────────
-- O ranking semanal vale prêmio e soma `student_xp_log` DENTRO do ciclo;
-- `profiles.xp_points` é outro número, o acumulado de vida, que também define o
-- nível do aluno (Iniciante → Lendário). Gastar dele faria o aluno REGREDIR de
-- nível ao comprar — castigo por participar da economia. Por isso nada é
-- debitado: o saldo é `profiles.xp_points - pets.xp_gasto`, e o gasto vive no
-- bichinho. O ranking não sente, o nível não cai, e o `profiles_block_xp_tampering`
-- nem precisa ser tocado.

-- ── Dias de estudo acumulados (a base do nível) ────────────────────────────
ALTER TABLE public.study_streaks
  ADD COLUMN IF NOT EXISTS total_study_days INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.study_streaks.total_study_days IS
  'Dias distintos em que o aluno estudou. So cresce — e o nivel do bichinho sai daqui, para nunca regredir.';

-- Ninguém começa do zero absoluto: quem já tem ofensiva já estudou. Sem prova
-- do histórico dia a dia, o recorde é a estimativa honesta mais próxima.
UPDATE public.study_streaks
SET total_study_days = GREATEST(longest_streak, current_streak)
WHERE total_study_days = 0;

-- ── O bicho ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pets (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  especie       TEXT NOT NULL CHECK (especie IN ('capivara', 'coruja', 'gato', 'tucano')),
  nome          TEXT NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 20),
  xp_gasto      INTEGER NOT NULL DEFAULT 0 CHECK (xp_gasto >= 0),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pets IS
  'Bichinho de estimacao do aluno. Nivel e humor sao derivados (nunca gravados): nivel vem de study_streaks.total_study_days, humor da ofensiva.';

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- O aluno lê o próprio bicho. Escrever é só pelas funções abaixo: `xp_gasto` é
-- dinheiro, e a lição do `award_xp` e da ofensiva é que tudo que o cliente
-- consegue escrever, o cliente forja.
DROP POLICY IF EXISTS pets_select_own ON public.pets;
CREATE POLICY pets_select_own ON public.pets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ── Preço da proteção ──────────────────────────────────────────────────────
-- 250 XP: cerca de 50 questões certas. Caro o bastante para a proteção
-- significar alguma coisa, barato o bastante para estar ao alcance de quem
-- estuda de verdade por uma semana.
CREATE OR REPLACE FUNCTION public.preco_protecao() RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $function$ SELECT 250 $function$;

-- ── Adoção ─────────────────────────────────────────────────────────────────
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
  IF p_especie IS NULL OR p_especie NOT IN ('capivara','coruja','gato','tucano') THEN
    RAISE EXCEPTION 'Especie invalida.' USING ERRCODE = '22023';
  END IF;
  IF length(v_nome) < 1 OR length(v_nome) > 20 THEN
    RAISE EXCEPTION 'O nome precisa ter de 1 a 20 caracteres.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pets (user_id, especie, nome)
  VALUES (v_user, p_especie, v_nome)
  ON CONFLICT (user_id) DO UPDATE
    -- Trocar o nome é livre; a espécie também, porque não custa nada e não há
    -- economia atrelada a ela.
    SET especie = EXCLUDED.especie, nome = EXCLUDED.nome, atualizado_em = now();

  RETURN public.meu_bichinho();
END;
$function$;

-- ── Estado completo (o que a tela precisa, numa chamada) ───────────────────
CREATE OR REPLACE FUNCTION public.meu_bichinho()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  -- Dias de estudo necessários para cada nível.
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

  -- Nível pelos dias acumulados. Só sobe.
  FOR i IN 1 .. array_length(c_niveis, 1) LOOP
    IF v_dias >= c_niveis[i] THEN v_nivel := i; END IF;
  END LOOP;
  v_prox := CASE WHEN v_nivel < array_length(c_niveis, 1) THEN c_niveis[v_nivel + 1] ELSE NULL END;

  -- Humor pelo tempo sem estudar. Nunca existe estado "morto".
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
    'nivel',           v_nivel,
    'humor',           v_humor,
    'dias_estudo',     v_dias,
    'dias_proximo_nivel', v_prox,
    'ofensiva',        v_ofensiva,
    'protecoes',       v_protec,
    'dias_sem_estudar', v_parado,
    -- Saldo gastável: acumulado de vida menos o que já virou proteção. O XP do
    -- ranking não é tocado.
    'saldo',           GREATEST(0, v_xp - COALESCE(v_pet.xp_gasto, 0)),
    'preco_protecao',  public.preco_protecao()
  );
END;
$function$;

-- ── Compra de proteção ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comprar_protecao()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_teto CONSTANT INTEGER := 2;
  v_user   UUID := auth.uid();
  v_xp     INTEGER;
  v_gasto  INTEGER;
  v_protec INTEGER;
  v_preco  INTEGER := public.preco_protecao();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sem sessao.' USING ERRCODE = '42501';
  END IF;

  -- Trava a linha do bicho: sem isso, duas compras simultâneas leriam o mesmo
  -- saldo e o aluno levaria duas proteções pelo preço de uma.
  SELECT xp_gasto INTO v_gasto FROM public.pets WHERE user_id = v_user FOR UPDATE;
  IF v_gasto IS NULL THEN
    RAISE EXCEPTION 'Adote um bichinho antes.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(xp_points, 0) INTO v_xp FROM public.profiles WHERE id = v_user;
  SELECT protections INTO v_protec FROM public.study_streaks WHERE user_id = v_user FOR UPDATE;
  v_protec := COALESCE(v_protec, 0);

  IF v_protec >= c_teto THEN
    RAISE EXCEPTION 'Voce ja tem o maximo de protecoes.' USING ERRCODE = '22023';
  END IF;
  IF v_xp - v_gasto < v_preco THEN
    RAISE EXCEPTION 'XP insuficiente.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.pets SET xp_gasto = v_gasto + v_preco, atualizado_em = now()
  WHERE user_id = v_user;

  UPDATE public.study_streaks SET protections = v_protec + 1, updated_at = now()
  WHERE user_id = v_user;

  RETURN public.meu_bichinho();
END;
$function$;

REVOKE ALL ON FUNCTION public.adotar_bichinho(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.meu_bichinho()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comprar_protecao()         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adotar_bichinho(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_bichinho()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.comprar_protecao()          TO authenticated;
