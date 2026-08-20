-- ============================================================
-- Migration: 20260710130000_attendance_left_early.sql
-- Roadmap Secretaria · Onda 1.3 — Saída antecipada por aula.
--
-- "Saiu antes" é um qualificador de presença (o aluno esteve na aula,
-- só não ficou até o fim) — não substitui o status presente/ausente/
-- justificado existente, só o complementa. Aditivo, sem tocar no CHECK
-- constraint de status nem na lógica dos 9 arquivos que já consomem
-- esse campo.
-- ============================================================

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS left_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS left_early_time TEXT,       -- "HH:MM"
  ADD COLUMN IF NOT EXISTS left_early_reason TEXT;
