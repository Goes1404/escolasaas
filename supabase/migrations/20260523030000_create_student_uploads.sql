-- ============================================================
-- STUDENT UPLOADS — DOCUMENTOS ENVIADOS PELO ALUNO
-- Compromisso 360 | Migration 20260523030000
-- ============================================================

-- ── 1. Bucket de storage ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-documents',
  'student-documents',
  false,
  10485760,  -- 10 MB por arquivo
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Tabela student_uploads ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_uploads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT,
  doc_type     TEXT        NOT NULL DEFAULT 'outro'
                 CHECK (doc_type IN ('atestado','rg','cpf','historico','comprovante_residencia','certidao','comprovante_renda','outro')),
  title        TEXT        NOT NULL,
  file_url     TEXT        NOT NULL,
  file_path    TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','aprovado','rejeitado')),
  notes        TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID        REFERENCES auth.users(id)
);

-- ── 3. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_uploads_student_id ON public.student_uploads(student_id);
CREATE INDEX IF NOT EXISTS idx_student_uploads_status     ON public.student_uploads(status);
CREATE INDEX IF NOT EXISTS idx_student_uploads_uploaded   ON public.student_uploads(uploaded_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────
ALTER TABLE public.student_uploads ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.student_uploads TO authenticated, service_role;

-- Aluno vê somente os próprios uploads
DROP POLICY IF EXISTS "su_student_select" ON public.student_uploads;
CREATE POLICY "su_student_select"
  ON public.student_uploads FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Aluno insere apenas para si mesmo
DROP POLICY IF EXISTS "su_student_insert" ON public.student_uploads;
CREATE POLICY "su_student_insert"
  ON public.student_uploads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Aluno pode deletar somente documentos ainda pendentes
DROP POLICY IF EXISTS "su_student_delete" ON public.student_uploads;
CREATE POLICY "su_student_delete"
  ON public.student_uploads FOR DELETE TO authenticated
  USING (auth.uid() = student_id AND status = 'pendente');

-- Staff/admin veem todos os uploads
DROP POLICY IF EXISTS "su_staff_select" ON public.student_uploads;
CREATE POLICY "su_staff_select"
  ON public.student_uploads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','staff','teacher')
    )
  );

-- Somente staff/admin atualizam status/notes
DROP POLICY IF EXISTS "su_staff_update" ON public.student_uploads;
CREATE POLICY "su_staff_update"
  ON public.student_uploads FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','staff')
    )
  );

-- ── 5. Storage RLS ────────────────────────────────────────────
-- Aluno faz upload para a própria pasta (student_id como prefixo)
DROP POLICY IF EXISTS "student_docs_upload" ON storage.objects;
CREATE POLICY "student_docs_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Aluno e staff leem os arquivos
DROP POLICY IF EXISTS "student_docs_read" ON storage.objects;
CREATE POLICY "student_docs_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-documents' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role::text IN ('admin','staff','teacher')
      )
    )
  );

-- Aluno deleta os próprios arquivos
DROP POLICY IF EXISTS "student_docs_delete" ON storage.objects;
CREATE POLICY "student_docs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
