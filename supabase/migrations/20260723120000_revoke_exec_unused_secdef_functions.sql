-- MÉDIO/ALTO (hardening): funções SECURITY DEFINER que NÃO são chamadas via RPC
-- pelo app estavam com EXECUTE concedido a PUBLIC/anon/authenticated. Como rodam
-- com privilégios do dono (postgres), expô-las via /rest/v1/rpc amplia a
-- superfície de ataque sem necessidade.
--
-- Auditoria (2026-07-23):
--   * check_user_is_staff_or_admin(uuid) e get_auth_uid()  -> NÃO usadas em
--     nenhuma policy RLS, em nenhum corpo de função e nem pelo app.
--   * questions_normalize_validate_trigger(), questions_validate_options_trigger(),
--     sync_profile_display_name_from_auth_user() -> funções de TRIGGER. O Postgres
--     NÃO verifica EXECUTE do papel chamador ao disparar o trigger, então revogar
--     não quebra a validação/normalização das tabelas.
--   * rls_auto_enable() -> não está anexada a nenhum trigger comum; helper interno.
--
-- Deixadas INTACTAS (usadas pelo app):
--   * increment_time_spent(uuid,integer)      -> src/hooks/useTimeTracker.ts
--   * get_student_engagement_by_token(text)   -> painel do responsável (guardian)
REVOKE ALL ON FUNCTION public.check_user_is_staff_or_admin(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auth_uid()                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.questions_normalize_validate_trigger()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.questions_validate_options_trigger()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_display_name_from_auth_user() FROM PUBLIC, anon, authenticated;
