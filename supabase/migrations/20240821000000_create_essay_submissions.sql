CREATE TABLE IF NOT EXISTS public.essay_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL,
    content TEXT NOT NULL,
    score INTEGER,
    feedback TEXT,
    result_data JSONB,
    mentor_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS essay_submissions_user_id_idx ON public.essay_submissions(user_id);

CREATE POLICY "Students can view own essays" ON public.essay_submissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own essays" ON public.essay_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can view all essays" ON public.essay_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "Teachers can update essays" ON public.essay_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('teacher', 'admin')
        )
    );
