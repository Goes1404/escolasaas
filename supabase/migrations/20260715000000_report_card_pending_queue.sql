-- ============================================================
-- Migration: 20260715000000_report_card_pending_queue.sql
-- 1) Fila de boletins sem dono (report_card_pending): linhas do
--    CSV cujo aluno não foi identificado com segurança ficam aqui
--    aguardando aprovação manual (admin/secretaria).
-- 2) Índices únicos anti-duplicata nos report_card_entries*,
--    permitindo re-importar o mesmo CSV com upsert (idempotente).
-- Idempotente — seguro rodar múltiplas vezes.
-- ============================================================

-- ─── 1. Fila de aprovação manual ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_card_pending (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track               TEXT NOT NULL CHECK (track IN ('enem', 'etec')),
  full_name           TEXT NOT NULL,           -- nome como está no boletim
  sala                TEXT,
  turno               TEXT,
  colegio             TEXT,
  semester            INT  NOT NULL DEFAULT 1,
  payload             JSONB NOT NULL,          -- linha completa do CSV (notas etc.)
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-upload do mesmo CSV não duplica a fila: no máximo 1 pendência
-- aberta por (track, nome normalizado, semestre).
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_card_pending_open
  ON public.report_card_pending (track, lower(full_name), semester)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_report_card_pending_status
  ON public.report_card_pending (status, created_at DESC);

ALTER TABLE public.report_card_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff manage pending report cards" ON public.report_card_pending;

-- Só staff/admin/professor enxergam e mexem na fila; aluno não tem acesso
-- (boletins pendentes não pertencem a nenhum aluno ainda).
CREATE POLICY "staff manage pending report cards" ON public.report_card_pending
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'teacher')
    )
  );

-- ─── 1b. Converge o drift da tabela ETEC criada ad-hoc ───────
-- A report_card_entries remota nasceu fora de migration e não tem
-- created_at/updated_at (tem imported_at/source_file). Alinha ao schema
-- versionado sem quebrar o que existe.
ALTER TABLE public.report_card_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.report_card_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── 2. Anti-duplicata nos boletins importados ───────────────
-- Verificado em produção antes desta migration: nenhuma dupla
-- (student_id, semester) existente — índices criam sem conflito.
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_card_entries_student_sem
  ON public.report_card_entries (student_id, track, semester);

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_card_entries_enem_student_sem
  ON public.report_card_entries_enem (student_id, semester);
