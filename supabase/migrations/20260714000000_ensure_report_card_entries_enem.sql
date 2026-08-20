-- ============================================================
-- Migration: 20260714000000_ensure_report_card_entries_enem.sql
-- Garante a criação da tabela report_card_entries_enem e suas políticas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_card_entries_enem (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  semester              INT  NOT NULL DEFAULT 1,
  classificatoria_score NUMERIC,
  classificatoria_max   NUMERIC DEFAULT 60,
  simulado_1_score      NUMERIC,
  simulado_2_score      NUMERIC,
  simulado_3_score      NUMERIC,
  simulado_max          NUMERIC DEFAULT 60,
  lingua_portuguesa     NUMERIC,
  matematica            NUMERIC,
  historia              NUMERIC,
  geografia             NUMERIC,
  biologia              NUMERIC,
  quimica               NUMERIC,
  fisica                NUMERIC,
  filosofia             NUMERIC,
  sociologia            NUMERIC,
  ingles                NUMERIC,
  redacao_score         NUMERIC,
  redacao_max           NUMERIC DEFAULT 1000,
  absences_1sem         INT,
  absences_2sem         INT,
  early_departures_1sem INT,
  early_departures_2sem INT,
  sala                  TEXT,
  turno                 TEXT,
  colegio               TEXT,
  imported_at           TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT report_card_entries_enem_student_id_semester_key UNIQUE (student_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_report_card_entries_enem_student ON public.report_card_entries_enem(student_id);

ALTER TABLE public.report_card_entries_enem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own enem report card" ON public.report_card_entries_enem;
CREATE POLICY "students read own enem report card" ON public.report_card_entries_enem
  FOR SELECT TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "staff manage enem report cards" ON public.report_card_entries_enem;
CREATE POLICY "staff manage enem report cards" ON public.report_card_entries_enem
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'staff', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'staff', 'teacher')
    )
  );
