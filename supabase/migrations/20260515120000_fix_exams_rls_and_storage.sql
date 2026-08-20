-- Permite que admins/staff gerenciem TODAS as provas, independente de teacher_id
DROP POLICY IF EXISTS "exams_admin_insert" ON exams;
CREATE POLICY "exams_admin_insert" ON exams FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('admin', 'staff')));

DROP POLICY IF EXISTS "exams_admin_update" ON exams;
CREATE POLICY "exams_admin_update" ON exams FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('admin', 'staff')));

DROP POLICY IF EXISTS "exams_admin_delete" ON exams;
CREATE POLICY "exams_admin_delete" ON exams FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('admin', 'staff')));

-- Permite que admins gerenciem questões de qualquer prova
DROP POLICY IF EXISTS "exam_questions_admin_all" ON exam_questions;
CREATE POLICY "exam_questions_admin_all" ON exam_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('admin', 'staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('admin', 'staff')));

-- Corrige storage: remove políticas permissivas e adiciona verificação de role
DROP POLICY IF EXISTS "Teacher Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Teacher Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Teacher Delete Access" ON storage.objects;

DROP POLICY IF EXISTS "exam_pdfs_write" ON storage.objects;
CREATE POLICY "exam_pdfs_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exam_pdfs' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff'))
  );

DROP POLICY IF EXISTS "exam_pdfs_update" ON storage.objects;
CREATE POLICY "exam_pdfs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exam_pdfs' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff'))
  );

DROP POLICY IF EXISTS "exam_pdfs_delete" ON storage.objects;
CREATE POLICY "exam_pdfs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'exam_pdfs' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff'))
  );

-- Corrige micro_topics: restringe insert a professores/admins
DROP POLICY IF EXISTS "micro_topics_insert" ON micro_topics;
CREATE POLICY "micro_topics_insert" ON micro_topics FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')));

-- Adiciona coluna target_audience em questions caso não exista
ALTER TABLE questions ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'enem';
