-- Add 'competencies' column to essay_submissions
ALTER TABLE public.essay_submissions
  ADD COLUMN IF NOT EXISTS competencies JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.essay_submissions.competencies IS 'JSONB object storing competency scores and feedback';
