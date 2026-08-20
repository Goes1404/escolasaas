-- 1. Function to get all subjects with their question count
CREATE OR REPLACE FUNCTION get_subjects_with_question_count()
RETURNS TABLE (id UUID, name TEXT, question_count BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        COUNT(q.id) as question_count
    FROM 
        public.subjects s
    LEFT JOIN 
        public.questions q ON s.id = q.subject_id
    GROUP BY 
        s.id, s.name
    ORDER BY
        s.name;
END;
$$;

-- 2. Function to get N random questions for a given subject
CREATE OR REPLACE FUNCTION get_random_questions_for_subject(p_subject_id UUID, p_limit INT)
RETURNS SETOF questions
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.questions
    WHERE subject_id = p_subject_id
    ORDER BY random()
    LIMIT p_limit;
END;
$$;

-- 3. Grant usage permissions for these functions to the authenticated role
-- This allows logged-in users (students) to call these functions.
GRANT EXECUTE ON FUNCTION get_subjects_with_question_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_random_questions_for_subject(UUID, INT) TO authenticated;
