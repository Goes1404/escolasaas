-- ============================================================
-- Migration: 20260710120000_create_student_guardians.sql
-- Roadmap Secretaria · Onda 1 — Dados dos responsáveis legais.
--
-- Um aluno pode ter 1..N responsáveis (mãe, pai, avó, tutor...).
-- Dados pessoais de TERCEIROS (CPF/telefone/e-mail) → RLS restrita a
-- admin/staff; o próprio aluno pode apenas LER os seus responsáveis.
-- Papel checado por profiles.role (enum confiável), nunca pelo claim
-- morto auth.jwt()->>'user_role'.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_guardians (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  relationship  TEXT,                 -- parentesco: mãe, pai, avó, responsável legal...
  cpf           TEXT,
  phone         TEXT,
  email         TEXT,
  is_primary    BOOLEAN     NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id
  ON public.student_guardians(student_id);

-- No máximo um responsável principal por aluno.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_guardians_primary
  ON public.student_guardians(student_id)
  WHERE is_primary;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.student_guardians TO authenticated, service_role;

-- Admin/staff: gerência total (a secretaria cadastra os responsáveis).
DROP POLICY IF EXISTS "guardians_manage_staff" ON public.student_guardians;
CREATE POLICY "guardians_manage_staff" ON public.student_guardians
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')
  ));

-- Aluno: apenas leitura dos próprios responsáveis.
DROP POLICY IF EXISTS "guardians_select_own" ON public.student_guardians;
CREATE POLICY "guardians_select_own" ON public.student_guardians
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());
