-- Create a table for subjects
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-populate with some common subjects
INSERT INTO public.subjects (name) VALUES
('Matemática'),
('Português'),
('História'),
('Geografia'),
('Biologia'),
('Química'),
('Física'),
('Filosofia'),
('Sociologia'),
('Não Categorizado');

-- Add the new subject_id foreign key to the questions table, making it nullable for now
ALTER TABLE public.questions
ADD COLUMN subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Update all existing questions to point to the 'Não Categorizado' subject
UPDATE public.questions
SET subject_id = (SELECT id FROM public.subjects WHERE name = 'Não Categorizado');

-- Now that all rows are populated, make the column NOT NULL
ALTER TABLE public.questions
ALTER COLUMN subject_id SET NOT NULL;

-- Drop the old, inefficient text-based subject column
ALTER TABLE public.questions
DROP COLUMN subject;

-- Create a table to track student answers, the basis for analytics
CREATE TABLE public.student_question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security for all affected tables
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_question_answers ENABLE ROW LEVEL SECURITY;

-- POLICIES for subjects table
CREATE POLICY "Allow authenticated users to read subjects" ON public.subjects
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow only teachers to manage subjects" ON public.subjects
    FOR ALL USING ( (get_my_claim('user_role'))::text = 'teacher' )
    WITH CHECK ( (get_my_claim('user_role'))::text = 'teacher' );

-- POLICIES for questions table
CREATE POLICY "Allow authenticated users to read questions" ON public.questions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow only teachers to manage questions" ON public.questions
    FOR ALL USING ( (get_my_claim('user_role'))::text = 'teacher' )
    WITH CHECK ( (get_my_claim('user_role'))::text = 'teacher' );

-- POLICIES for student_question_answers table
CREATE POLICY "Allow students to create and view their own answers" ON public.student_question_answers
    FOR ALL USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Allow teachers to view all student answers" ON public.student_question_answers
    FOR SELECT USING ( (get_my_claim('user_role'))::text = 'teacher' );

