-- ============================================================
-- Migration: 20260707000100_fix_ranking_view_filter.sql
-- Fix weekly_ranking view: filter profiles by role = 'student'
-- instead of profile_type = 'student', since some students have
-- custom profile_type values (e.g. 'Estudante ETEC').
-- ============================================================

CREATE OR REPLACE VIEW public.weekly_ranking AS
SELECT
  p.id          AS student_id,
  p.full_name,
  p.avatar_url,
  p.exam_target,
  p.xp_points   AS total_xp,
  COALESCE(SUM(xl.xp_earned), 0)::INT AS weekly_xp,
  RANK() OVER (
    PARTITION BY p.exam_target
    ORDER BY COALESCE(SUM(xl.xp_earned), 0) DESC
  ) AS position
FROM public.profiles p
LEFT JOIN public.student_xp_log xl
  ON xl.student_id = p.id
  AND xl.created_at >= date_trunc('week', now())
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.avatar_url, p.exam_target, p.xp_points;
