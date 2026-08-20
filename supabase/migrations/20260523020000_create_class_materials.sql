-- ============================================================
-- CLASS MATERIALS — MATERIAIS DE AULA
-- Compromisso 360 | Migration 20260523020000
-- ============================================================

-- ── 1. class_materials ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_materials (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  subject      TEXT,
  file_url     TEXT        NOT NULL,
  file_type    TEXT        NOT NULL DEFAULT 'pdf'
                 CHECK (file_type IN ('pdf', 'video', 'link', 'imagem', 'outro')),
  target_group TEXT        NOT NULL DEFAULT 'all'
                 CHECK (target_group IN ('all', 'enem', 'etec')),
  teacher_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_name TEXT,
  session_id   UUID        REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  is_published BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_materials_title_check CHECK (char_length(title) >= 3)
);

-- ── 2. material_views ────────────────────────────────────────
-- Um registro por aluno por material (UNIQUE constraint).
CREATE TABLE IF NOT EXISTS public.material_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID        NOT NULL REFERENCES public.class_materials(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material_id, student_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_class_materials_teacher_id
  ON public.class_materials(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_created_at
  ON public.class_materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_materials_subject
  ON public.class_materials(subject);
CREATE INDEX IF NOT EXISTS idx_material_views_student_id
  ON public.material_views(student_id);
CREATE INDEX IF NOT EXISTS idx_material_views_material_id
  ON public.material_views(material_id);

-- ── 4. RLS ────────────────────────────────────────────────────
ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_views  ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.class_materials TO authenticated, service_role;
GRANT ALL ON public.material_views  TO authenticated, service_role;

-- class_materials: todos autenticados leem materiais publicados
DROP POLICY IF EXISTS "cm_select" ON public.class_materials;
CREATE POLICY "cm_select"
  ON public.class_materials FOR SELECT TO authenticated
  USING (is_published = TRUE OR auth.uid() = teacher_id OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
  ));

-- Apenas teacher/admin/staff inserem; teacher vincula ao próprio id
DROP POLICY IF EXISTS "cm_insert" ON public.class_materials;
CREATE POLICY "cm_insert"
  ON public.class_materials FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );

-- Apenas dono ou admin atualizam
DROP POLICY IF EXISTS "cm_update" ON public.class_materials;
CREATE POLICY "cm_update"
  ON public.class_materials FOR UPDATE TO authenticated
  USING (
    auth.uid() = teacher_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

-- Apenas dono ou admin deletam
DROP POLICY IF EXISTS "cm_delete" ON public.class_materials;
CREATE POLICY "cm_delete"
  ON public.class_materials FOR DELETE TO authenticated
  USING (
    auth.uid() = teacher_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

-- material_views: aluno vê próprias views; teacher/admin veem todas
DROP POLICY IF EXISTS "mv_select" ON public.material_views;
CREATE POLICY "mv_select"
  ON public.material_views FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );

-- Aluno insere a própria view
DROP POLICY IF EXISTS "mv_insert" ON public.material_views;
CREATE POLICY "mv_insert"
  ON public.material_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Aluno deleta a própria view (desmarcar como estudado)
DROP POLICY IF EXISTS "mv_delete" ON public.material_views;
CREATE POLICY "mv_delete"
  ON public.material_views FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

-- ── 5. Storage policy para learning-contents/materials/ ──────
-- Reutiliza bucket existente 'learning-contents'
-- Qualquer teacher/admin/staff pode escrever em materials/
DROP POLICY IF EXISTS "materials_upload" ON storage.objects;
CREATE POLICY "materials_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'learning-contents' AND
    (storage.foldername(name))[1] = 'materials' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "materials_delete" ON storage.objects;
CREATE POLICY "materials_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'learning-contents' AND
    (storage.foldername(name))[1] = 'materials' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );
