-- Impede escalada de privilégio via `profiles.role`.
--
-- As policies de UPDATE de `profiles` permitem que o usuário edite a PRÓPRIA
-- linha (`auth.uid() = id`) — o que é correto e necessário: é assim que o aluno
-- salva telefone, nome, avatar e bio. O problema é que a permissão vale para
-- QUALQUER coluna, inclusive `role`, e não havia trigger nenhum na tabela.
--
-- Confirmado por simulação de RLS antes desta migration: agindo como um aluno
-- autenticado (`SET LOCAL ROLE authenticated` + `request.jwt.claims` com o `sub`
-- dele), `UPDATE profiles SET role='admin' WHERE id = <ele mesmo>` era aceito
-- sem erro — `antes=student | depois=admin`. Qualquer aluno virava admin.
--
-- A auditoria de 2026-07-10 removeu as policies abertas de "modo demo", que
-- eram o vetor conhecido, mas as policies de dono que ficaram continuam sem
-- restrição de coluna. Este trigger fecha isso sem tirar do usuário a edição
-- legítima do próprio perfil.

CREATE OR REPLACE FUNCTION public.profiles_block_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY INVOKER de propósito: dentro de uma função SECURITY DEFINER,
-- `current_user` passa a ser o DONO da função (postgres) e não o papel de quem
-- chamou, então a checagem de service_role/authenticated nunca funcionaria.
-- O trigger não precisa de privilégio elevado: só lê OLD/NEW e decide.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Rotas administrativas usam a service role (PostgREST entra como
  -- `service_role`); migrations e jobs entram como `postgres`/`supabase_admin`.
  -- Esses caminhos já fazem a autorização na aplicação.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Sessão de usuário: só admin/staff muda papel, e de ninguém mais que si.
  IF public.check_user_is_staff_or_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Alteracao de papel nao permitida.'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.profiles_block_role_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_block_role_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_block_role_escalation
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_block_role_escalation();

COMMENT ON FUNCTION public.profiles_block_role_escalation() IS
  'Bloqueia mudanca de profiles.role por sessao de usuario comum. Permite service_role e admin/staff.';
