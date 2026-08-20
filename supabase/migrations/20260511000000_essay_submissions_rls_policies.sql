-- RLS policies for essay_submissions (applied separately due to existing table)
ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS essay_submissions_user_id_idx ON public.essay_submissions(user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'essay_submissions' AND policyname = 'Students can view own essays') THEN
    CREATE POLICY "Students can view own essays" ON public.essay_submissions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'essay_submissions' AND policyname = 'Students can insert own essays') THEN
    CREATE POLICY "Students can insert own essays" ON public.essay_submissions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'essay_submissions' AND policyname = 'Teachers can view all essays') THEN
    CREATE POLICY "Teachers can view all essays" ON public.essay_submissions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('teacher', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'essay_submissions' AND policyname = 'Teachers can update essays') THEN
    CREATE POLICY "Teachers can update essays" ON public.essay_submissions
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('teacher', 'admin')
        )
      );
  END IF;
END $$;
