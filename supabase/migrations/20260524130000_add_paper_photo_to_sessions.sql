-- ============================================================
-- PAPER ATTENDANCE PHOTO + RLS FIX
-- Compromisso 360 | Migration 20260524130000
-- ============================================================

-- ── 1. Adicionar coluna para foto da chamada em papel ───────
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS paper_photo_url TEXT;

-- ── 2. Corrigir cs_insert: admin/staff podem criar sessões
--    com qualquer teacher_id (antes exigia auth.uid() = teacher_id,
--    o que bloqueava a secretaria de agendar aulas para professores)
DROP POLICY IF EXISTS "cs_insert" ON public.class_sessions;
CREATE POLICY "cs_insert"
  ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
    AND (
      auth.uid() = teacher_id
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
      )
    )
  );

-- ── 3. Storage: staff/admin podem fazer upload de fotos de chamada ──
--    Reutiliza o bucket learning-contents já existente,
--    segregado pelo prefixo attendance-photos/
DROP POLICY IF EXISTS "attendance_photos_upload" ON storage.objects;
CREATE POLICY "attendance_photos_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'learning-contents' AND
    (storage.foldername(name))[1] = 'attendance-photos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "attendance_photos_update" ON storage.objects;
CREATE POLICY "attendance_photos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'learning-contents' AND
    (storage.foldername(name))[1] = 'attendance-photos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

-- Leitura pública das fotos (mesma política do bucket learning-contents)
DROP POLICY IF EXISTS "attendance_photos_select" ON storage.objects;
CREATE POLICY "attendance_photos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'learning-contents' AND
    (storage.foldername(name))[1] = 'attendance-photos'
  );
