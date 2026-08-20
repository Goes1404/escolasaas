-- ============================================================
-- Migration: 20260711000000_report_card_entries_schema_rls.sql
-- Versiona (retroativamente) a tabela report_card_entries (ETEC),
-- já em uso por src/app/dashboard/student/report-card/page.tsx,
-- e cria report_card_entries_enem para o formato ENEM (nota por
-- matéria + redação), que é estruturalmente diferente do ETEC.
-- Idempotente — seguro rodar múltiplas vezes.
-- ============================================================

-- ─── 0. profiles.institution ──────────────────────────────────
-- Coluna citada no CLAUDE.md mas ausente de qualquer migration
-- (mesmo drift do report_card_entries) — garantindo aqui pois a
-- rota de import escreve nela.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution TEXT;

-- ─── 1. ETEC: report_card_entries ────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_card_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track                 TEXT NOT NULL CHECK (track IN ('enem', 'etec')),
  semester              INT  NOT NULL DEFAULT 1,
  classificatoria_score NUMERIC,
  classificatoria_max   NUMERIC,
  simulado_score        NUMERIC,
  simulado_max          NUMERIC,
  redacao_score         NUMERIC,
  redacao_max           NUMERIC,
  absences_1sem         INT,
  absences_2sem         INT,
  sala                  TEXT,
  turno                 TEXT,
  colegio               TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_card_entries_student ON public.report_card_entries(student_id);

ALTER TABLE public.report_card_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own report card" ON public.report_card_entries;
DROP POLICY IF EXISTS "staff manage report cards"      ON public.report_card_entries;

CREATE POLICY "students read own report card" ON public.report_card_entries
  FOR SELECT USING (auth.uid() = student_id);

-- Staff/admin/professor podem ler e escrever (import via secretaria).
-- Sem policy de INSERT/UPDATE para o aluno: escrita só via service role
-- (rota /api/admin/report-card-import) ou por staff autenticado.
CREATE POLICY "staff manage report cards" ON public.report_card_entries
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

-- ─── 2. ENEM: report_card_entries_enem ───────────────────────
-- Formato diferente do ETEC: nota por matéria (0-N) + redação /1000.
CREATE TABLE IF NOT EXISTS public.report_card_entries_enem (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester            INT  NOT NULL DEFAULT 1,
  classificatoria_score NUMERIC,
  classificatoria_max   NUMERIC DEFAULT 60,
  simulado_1_score      NUMERIC,
  simulado_2_score      NUMERIC,
  simulado_3_score      NUMERIC,
  simulado_max           NUMERIC DEFAULT 60,
  lingua_portuguesa      NUMERIC,
  matematica             NUMERIC,
  historia               NUMERIC,
  geografia              NUMERIC,
  biologia               NUMERIC,
  quimica                NUMERIC,
  fisica                 NUMERIC,
  filosofia              NUMERIC,
  sociologia             NUMERIC,
  ingles                 NUMERIC,
  redacao_score          NUMERIC,
  redacao_max            NUMERIC DEFAULT 1000,
  absences_1sem          INT,
  absences_2sem          INT,
  early_departures_1sem  INT,
  early_departures_2sem  INT,
  sala                   TEXT,
  turno                  TEXT,
  colegio                TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_card_entries_enem_student ON public.report_card_entries_enem(student_id);

ALTER TABLE public.report_card_entries_enem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own enem report card" ON public.report_card_entries_enem;
DROP POLICY IF EXISTS "staff manage enem report cards"      ON public.report_card_entries_enem;

CREATE POLICY "students read own enem report card" ON public.report_card_entries_enem
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "staff manage enem report cards" ON public.report_card_entries_enem
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
