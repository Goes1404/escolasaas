-- ============================================================
-- Migration: 20260710160000_create_student_notes.sql
-- Roadmap Secretaria · Onda 2.3 — Observações no perfil do aluno
-- (ex.: troca de sala/ambiente, comportamento, ocorrências).
--
-- Notas INTERNAS da secretaria/coordenação. RLS restrita a admin/staff
-- (gerência + leitura); o aluno NÃO vê estas observações. Papel checado
-- por profiles.role.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name  TEXT,
  category     TEXT        NOT NULL DEFAULT 'observacao',
  note         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_notes_student_id
  ON public.student_notes(student_id, created_at DESC);

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.student_notes TO authenticated, service_role;

DROP POLICY IF EXISTS "student_notes_manage_staff" ON public.student_notes;
CREATE POLICY "student_notes_manage_staff" ON public.student_notes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')));
