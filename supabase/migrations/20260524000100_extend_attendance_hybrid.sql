-- ============================================================
-- ATTENDANCE HYBRID — TOKEN DIGITAL + FALLBACK MANUAL
-- Compromisso 360 | Migration 20260524000000
-- ============================================================
-- Estende o sistema de chamada existente para suportar:
-- · sala/turma vinculada à sessão (class_label)
-- · token de 4 caracteres com expiração às 17h do dia da aula
-- · método de registro (app | manual | override) para distinguir origem
-- · audit log de sobrescritas (admin/staff editando check-in via app)
-- ============================================================

-- ── 1. class_sessions: adicionar class_label e flexibilizar token ───
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS class_label TEXT;

-- Flexibilizar tamanho do token (antes CHAR(6), agora aceita 4-6)
DO $$
BEGIN
  ALTER TABLE public.class_sessions
    ALTER COLUMN checkin_code TYPE TEXT;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_sessions_class_label
  ON public.class_sessions(class_label);

-- ── 2. attendance_records: adicionar method ─────────────────────────
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'manual';

-- Constraint só após defaultar valores existentes
DO $$
BEGIN
  ALTER TABLE public.attendance_records
    DROP CONSTRAINT IF EXISTS attendance_records_method_check;
  ALTER TABLE public.attendance_records
    ADD CONSTRAINT attendance_records_method_check
    CHECK (method IN ('app','manual','override'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Backfill: migrar registros antigos. Onde self_checkin=true → 'app'
UPDATE public.attendance_records
  SET method = 'app'
  WHERE self_checkin = TRUE AND method = 'manual';

CREATE INDEX IF NOT EXISTS idx_attendance_records_method
  ON public.attendance_records(method);

-- ── 3. attendance_audit: log de sobrescritas ────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_audit (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id  UUID        NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  session_id            UUID        NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name       TEXT,
  previous_status       TEXT,
  new_status            TEXT        NOT NULL,
  previous_method       TEXT,
  new_method            TEXT        NOT NULL,
  reason                TEXT,
  changed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_record
  ON public.attendance_audit(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_session
  ON public.attendance_audit(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_changed_at
  ON public.attendance_audit(changed_at DESC);

-- ── 4. RLS audit table ──────────────────────────────────────────────
ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance_audit TO authenticated, service_role;

-- Somente staff/admin visualizam o audit log
DROP POLICY IF EXISTS "aa_select" ON public.attendance_audit;
CREATE POLICY "aa_select"
  ON public.attendance_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','staff','teacher')
    )
  );

-- Staff/admin inserem entradas de auditoria (registrando sobrescritas)
DROP POLICY IF EXISTS "aa_insert" ON public.attendance_audit;
CREATE POLICY "aa_insert"
  ON public.attendance_audit FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = changed_by AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','staff','teacher')
    )
  );
