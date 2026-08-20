-- ============================================================
-- Migration: 20260707000000_fix_ranking_rls.sql
-- Fix ranking RLS: allow authenticated users to read XP logs
-- so that weekly_ranking view can aggregate other users' XP.
-- ============================================================

DROP POLICY IF EXISTS "students read own xp" ON public.student_xp_log;

CREATE POLICY "anyone read xp logs" ON public.student_xp_log
  FOR SELECT USING (auth.role() = 'authenticated');
