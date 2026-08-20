-- Hardening (advisor: function_search_path_mutable / 0011): funções sem
-- `search_path` fixo resolvem objetos pelo path do CHAMADOR. Em funções
-- SECURITY DEFINER isso permite sequestro de search_path (criar objeto homônimo
-- num schema à frente de `public` e fazer a função privilegiada executá-lo).
--
-- Fixamos `search_path = public, extensions, pg_temp` (com pg_temp por último,
-- como recomenda o Postgres) em todas as funções sinalizadas. O valor reproduz
-- exatamente a resolução atual (as tabelas/funções vivem em `public`; extensões
-- como pg_net/unaccent em `public`/`extensions`), então não altera comportamento.
ALTER FUNCTION public.fn_set_question_hash()                          SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.force_reset_password(text, text)                SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.force_reset_password(uuid, text)                SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_auth_uid()                                 SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_random_questions_for_subject(uuid, integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_student_engagement_by_token(text)          SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_subjects_with_question_count()             SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.handle_new_user()                             SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.increment_time_spent(uuid, integer)            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.normalize_email_localpart(text)               SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.normalize_email_part(text)                    SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.questions_normalize_validate_trigger()        SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.questions_validate_options_trigger()          SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.set_exam_attempt_meta()                       SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_modified_column()                     SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.validate_question_options(jsonb)              SET search_path = public, extensions, pg_temp;
