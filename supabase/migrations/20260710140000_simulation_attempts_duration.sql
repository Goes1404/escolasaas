-- ============================================================
-- Migration: 20260710140000_simulation_attempts_duration.sql
-- Persiste o tempo gasto pelo aluno no simulado.
--
-- Aditivo: coluna nullable em simulation_attempts (tabela que já tem
-- RLS por dono — "Aluno gerencia propria tentativa" USING auth.uid()
-- = user_id — e leitura por staff/teacher/admin). Consumidores atuais
-- (StudySuggestionWidget, rankings, home) leem score/total_questions e
-- ignoram esta coluna.
-- ============================================================

ALTER TABLE public.simulation_attempts
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
