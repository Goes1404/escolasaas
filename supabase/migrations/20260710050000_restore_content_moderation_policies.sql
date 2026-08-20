-- ============================================================
-- Migration: 20260710050000_restore_content_moderation_policies.sql
-- Regressão da 20260710020000: ao remover as policies "abertas" de
-- escrita, algumas tabelas ficaram apenas com policies baseadas em
-- `auth.jwt() ->> 'user_role'`. Esse claim NUNCA é populado neste
-- projeto (não há custom access token hook; user_role é null em todos
-- os 1622 usuários), então essas policies sempre negam. Enquanto as
-- policies abertas existiam elas mascaravam isso; sem elas, as
-- operações legítimas de gestão/moderação passaram a falhar:
--   - forums / forum_bans: moderação (criar/apagar tópico, banir/desbanir)
--   - modules / learning_contents / library_resources: gestão de conteúdo
--     por professores (ex.: teacher/library, teacher/books)
--
-- Correção: substituir as policies mortas (user_role) por policies
-- baseadas em `profiles.role`, que É populado — mesmo padrão já usado
-- para materials/invitations/scheduled_lives nesta auditoria.
-- Leitura permanece como está (SELECT já funcionava).
-- ============================================================

-- Predicados equivalentes (inline em cada policy):
--   staff  = admin/staff
--   content = admin/staff/teacher

-- ── forums ── moderação: admin/staff gerenciam tópicos ──────────────
DROP POLICY IF EXISTS "forums_insert_admin_only" ON public.forums;
CREATE POLICY "forums_manage_staff" ON public.forums
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')));

-- ── forum_bans ── moderação: dono vê o próprio ban; admin/staff gerenciam
DROP POLICY IF EXISTS "forum_bans_delete_by_moderator_or_admin" ON public.forum_bans;
DROP POLICY IF EXISTS "forum_bans_insert_by_moderator_or_admin" ON public.forum_bans;
DROP POLICY IF EXISTS "forum_bans_select_owner_or_moderator_admin" ON public.forum_bans;
DROP POLICY IF EXISTS "forum_bans_update_by_admin" ON public.forum_bans;

CREATE POLICY "forum_bans_select_owner_or_staff" ON public.forum_bans
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff'))
  );
CREATE POLICY "forum_bans_manage_staff" ON public.forum_bans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')));

-- ── modules ── gestão de conteúdo por professor/admin/staff ─────────
CREATE POLICY "modules_manage_content" ON public.modules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));

-- ── learning_contents ──
CREATE POLICY "learning_contents_manage_content" ON public.learning_contents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));

-- ── library_resources ── biblioteca (teacher/library, teacher/books) ─
CREATE POLICY "library_resources_manage_content" ON public.library_resources
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));
