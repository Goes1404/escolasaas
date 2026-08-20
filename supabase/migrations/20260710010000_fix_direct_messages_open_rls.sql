-- ============================================================
-- Migration: 20260710010000_fix_direct_messages_open_rls.sql
-- SEGURANÇA: direct_messages tinha policies permissivas residuais
-- (provavelmente de um modo demo) empilhadas sobre as policies
-- corretas. Como o Postgres faz OR entre policies permissivas da
-- mesma tabela, isso deixava a tabela efetivamente sem proteção:
-- qualquer usuário autenticado (e até anônimo, via "Acesso Demo")
-- conseguia ler, editar e apagar mensagens privadas de qualquer
-- pessoa, e inserir mensagens se passando por outro remetente.
--
-- Esta migration remove só as policies "abertas" (qual/with_check
-- = true sem checar sender/receiver). As policies restritas
-- corretas (dono da mensagem) já existem e permanecem intactas.
-- ============================================================

DROP POLICY IF EXISTS "Acesso Demo" ON public.direct_messages;
DROP POLICY IF EXISTS "open_select_for_authenticated_direct_messages" ON public.direct_messages;
DROP POLICY IF EXISTS "open_insert_for_authenticated_direct_messages" ON public.direct_messages;
DROP POLICY IF EXISTS "open_update_for_authenticated_direct_messages" ON public.direct_messages;
DROP POLICY IF EXISTS "open_delete_for_authenticated_direct_messages" ON public.direct_messages;
