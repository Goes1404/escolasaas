-- ============================================================
-- Migration: 20260710060000_fix_student_answers_staff_read.sql
-- Regressão da 20260710020000: ao remover o open_select de
-- student_question_answers, a leitura por professor/admin passou a
-- depender só das policies "teachers_can_view_answers" /
-- "allow_teachers_to_view_all_student_answers", ambas baseadas no
-- claim morto auth.jwt()->>'user_role' (sempre null). Resultado:
-- admin/professor via desempenho do aluno vazio
-- (admin/students/[id], admin/home).
--
-- Troca as duas policies mortas por uma baseada em profiles.role
-- (populado). O aluno continua com a policy de dono já existente.
-- ============================================================

DROP POLICY IF EXISTS "teachers_can_view_answers" ON public.student_question_answers;
DROP POLICY IF EXISTS "allow_teachers_to_view_all_student_answers" ON public.student_question_answers;

CREATE POLICY "staff_view_student_answers" ON public.student_question_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin','staff','teacher')
  ));
