-- ============================================================
-- Migration: 20260710150000_attendance_recorded_by.sql
-- Roadmap Secretaria · Onda 2.1 — Presença retroativa (auditoria).
--
-- A data da sessão já podia ser retroativa; faltava registrar QUEM
-- lançou a presença (recorded_at já captura o QUANDO). Aditivo,
-- nullable. RLS de attendance_records não muda (policy por linha).
-- ============================================================

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
