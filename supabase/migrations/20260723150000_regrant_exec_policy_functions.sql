-- CORREÇÃO de regressão da migration 20260723120000.
--
-- Duas das funções cujo EXECUTE foi revogado são chamadas DENTRO de policies RLS,
-- então o papel `authenticated` PRECISA poder executá-las — senão a avaliação da
-- policy lança "permission denied for function" e QUALQUER escrita na tabela
-- retorna 403 (quebrou o cadastro de telefone e toda edição de perfil em produção).
--
--   * check_user_is_staff_or_admin(uuid) -> policy `staff_manage_profiles` (ALL) em `profiles`
--   * get_auth_uid()                     -> policies de dono em `matérias` e `questões`
--
-- Reconcede EXECUTE (estado anterior à regressão). As outras 4 funções revogadas
-- (rls_auto_enable, questions_normalize_validate_trigger,
-- questions_validate_options_trigger, sync_profile_display_name_from_auth_user)
-- NÃO são referenciadas por policy (são triggers/internas) e permanecem revogadas.
GRANT EXECUTE ON FUNCTION public.check_user_is_staff_or_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_uid()                    TO anon, authenticated;
