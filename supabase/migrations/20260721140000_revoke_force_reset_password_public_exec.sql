-- CRÍTICO (account takeover): as funções SECURITY DEFINER force_reset_password
-- trocam a senha de qualquer usuário e estavam EXECUTÁVEIS pelos papéis `anon`
-- e `authenticated` via PostgREST (/rest/v1/rpc/force_reset_password). Qualquer
-- pessoa sem login podia redefinir a senha de qualquer conta (inclusive admin)
-- e assumir o acesso.
--
-- O app não usa essas funções via RPC (só existem num schema pull). Revogamos o
-- EXECUTE de todos os papéis expostos; permanecem disponíveis para
-- service_role/postgres em operações internas.
REVOKE ALL ON FUNCTION public.force_reset_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.force_reset_password(uuid, text) FROM PUBLIC, anon, authenticated;
