-- ============================================================
-- CALENDAR SYSTEM UPDATE
-- Compromisso 360 | Migration 20260522300000
-- ============================================================

-- ── 1. Coluna is_official ─────────────────────────────────
-- Eventos oficiais (vestibulares, ENEM, etc.) têm is_official = TRUE.
-- Criados por seed com created_by = NULL — apenas admins podem editar.
ALTER TABLE public.academic_events
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Corrigir RLS: admin/staff podem editar qualquer evento ─
DROP POLICY IF EXISTS "academic_events_update" ON public.academic_events;
DROP POLICY IF EXISTS "academic_events_delete" ON public.academic_events;

CREATE POLICY "academic_events_update" ON public.academic_events
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

CREATE POLICY "academic_events_delete" ON public.academic_events
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

-- Professores também podem criar eventos (já permitido pela policy original)
-- INSERT mantém: WITH CHECK (auth.uid() = created_by)
-- Para eventos oficiais com created_by = NULL, a inserção é feita via service_role (migrations).
