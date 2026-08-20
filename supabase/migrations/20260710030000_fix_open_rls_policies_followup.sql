-- ============================================================
-- Migration: 20260710030000_fix_open_rls_policies_followup.sql
-- Complemento da 20260710020000: itens que não apareceram no
-- primeiro escaneamento do security advisor.
-- ============================================================

-- trails: as policies abertas já tinham sido removidas na migration
-- anterior, mas esqueci de ligar a RLS na própria tabela.
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;

-- matérias / questões: mesmo padrão open_* de subjects/questions,
-- em tabelas com nome acentuado que não apareceram no primeiro scan.
DROP POLICY IF EXISTS "open_delete_for_authenticated_matérias" ON public."matérias";
DROP POLICY IF EXISTS "open_insert_for_authenticated_matérias" ON public."matérias";
DROP POLICY IF EXISTS "open_update_for_authenticated_matérias" ON public."matérias";

DROP POLICY IF EXISTS "open_delete_for_authenticated_questões" ON public."questões";
DROP POLICY IF EXISTS "open_insert_for_authenticated_questões" ON public."questões";
DROP POLICY IF EXISTS "open_update_for_authenticated_questões" ON public."questões";

-- learning_trails / learning_modules: usadas pela edge function
-- learning-trails-crud (via service role, não afetada por RLS), mas
-- estavam com RLS desligada = acesso público total também via REST
-- direto. Liga RLS com o mesmo modelo de dono (teacher_id) + admin
-- que a própria edge function já pretende impor.
ALTER TABLE public.learning_trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem trilhas" ON public.learning_trails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Professor dono ou staff gerencia trilha" ON public.learning_trails
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')))
  WITH CHECK (auth.uid() = teacher_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));

ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem modulos" ON public.learning_modules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff gerencia modulos" ON public.learning_modules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));

-- notices / quiz_submissions: 0 linhas, sem nenhuma referência no
-- código do app, RLS desligada. Liga RLS com policy mínima segura.
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem avisos" ON public.notices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff gerencia avisos" ON public.notices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));

ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia propria submissao de quiz" ON public.quiz_submissions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff le submissoes de quiz" ON public.quiz_submissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff','teacher')));
