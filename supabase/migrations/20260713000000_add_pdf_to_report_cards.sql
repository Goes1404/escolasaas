-- ============================================================
-- BOLETINS EM PDF — SUPORTE A UPLOAD DE BOLETINS OFICIAIS
-- Compromisso 360 | Migration 20260713000000
-- ============================================================

-- ── 1. Bucket de storage seguro para boletins ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-cards',
  'report-cards',
  false,
  10485760,  -- 10 MB por arquivo
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Colunas na tabela profiles para referenciar os PDFs ─────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_card_pdf_url_1sem TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_card_pdf_url_2sem TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_card_pdf_path_1sem TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_card_pdf_path_2sem TEXT;

-- ── 3. Políticas de RLS para o Storage ────────────────────────
-- Remove políticas anteriores para evitar duplicações
DROP POLICY IF EXISTS "report_cards_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "report_cards_student_read" ON storage.objects;

-- Admin, staff e professores têm acesso total ao bucket 'report-cards'
CREATE POLICY "report_cards_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'report-cards' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','staff','teacher')
    )
  )
  WITH CHECK (
    bucket_id = 'report-cards' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','staff','teacher')
    )
  );

-- O aluno autenticado pode ler apenas o seu próprio boletim em PDF (onde a pasta é seu id)
CREATE POLICY "report_cards_student_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-cards' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
