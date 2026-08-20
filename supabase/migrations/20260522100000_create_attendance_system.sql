-- ============================================================
-- ATTENDANCE SYSTEM — SISTEMA DE CHAMADAS
-- Compromisso 360 | Migration 20260522100000
-- ============================================================

-- ── 1. class_sessions ─────────────────────────────────────
-- Representa uma aula/sessão agendada para registro de chamada.
-- O campo live_id vincula opcionalmente a uma live existente.
-- O campo checkin_code é um código alfanumérico de 6 chars válido por 15 min.
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT        NOT NULL,
  description             TEXT,
  subject                 TEXT,
  session_date            DATE        NOT NULL,
  start_time              TIME,
  session_type            TEXT        NOT NULL DEFAULT 'presencial'
                            CHECK (session_type IN ('live', 'presencial')),
  teacher_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_name            TEXT,
  live_id                 UUID        REFERENCES public.lives(id) ON DELETE SET NULL,
  checkin_code            CHAR(6),
  checkin_code_expires_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_title_check CHECK (char_length(title) >= 3)
);

-- ── 2. attendance_records ─────────────────────────────────
-- Um registro por aluno por sessão (UNIQUE constraint).
-- self_checkin = TRUE quando o aluno fez auto-chamada via código.
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'ausente'
                  CHECK (status IN ('presente', 'ausente', 'justificado')),
  justification TEXT,
  self_checkin  BOOLEAN     NOT NULL DEFAULT FALSE,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- ── 3. Indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_id
  ON public.class_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_session_date
  ON public.class_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_live_id
  ON public.class_sessions(live_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id
  ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id
  ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status
  ON public.attendance_records(status);

-- ── 4. RLS ────────────────────────────────────────────────
ALTER TABLE public.class_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.class_sessions     TO authenticated, service_role;
GRANT ALL ON public.attendance_records TO authenticated, service_role;

-- class_sessions: todos autenticados leem; teacher/admin/staff escrevem
DROP POLICY IF EXISTS "cs_select" ON public.class_sessions;
CREATE POLICY "cs_select"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cs_insert" ON public.class_sessions;
CREATE POLICY "cs_insert"
  ON public.class_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "cs_update" ON public.class_sessions;
CREATE POLICY "cs_update"
  ON public.class_sessions FOR UPDATE TO authenticated
  USING (
    auth.uid() = teacher_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "cs_delete" ON public.class_sessions;
CREATE POLICY "cs_delete"
  ON public.class_sessions FOR DELETE TO authenticated
  USING (
    auth.uid() = teacher_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff')
    )
  );

-- attendance_records: aluno vê próprio; teacher/admin veem tudo
-- INSERT: teacher/admin OU auto-checkin do próprio aluno
DROP POLICY IF EXISTS "ar_select" ON public.attendance_records;
CREATE POLICY "ar_select"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "ar_insert" ON public.attendance_records;
CREATE POLICY "ar_insert"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
    OR auth.uid() = student_id
  );

DROP POLICY IF EXISTS "ar_update" ON public.attendance_records;
CREATE POLICY "ar_update"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "ar_delete" ON public.attendance_records;
CREATE POLICY "ar_delete"
  ON public.attendance_records FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('teacher', 'admin', 'staff')
    )
  );
