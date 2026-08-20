/* Migration to set default for competencies column and make it nullable */
ALTER TABLE public.essay_submissions
  ALTER COLUMN competencies SET DEFAULT '{}'::jsonb,
  ALTER COLUMN competencies DROP NOT NULL;

-- Optionally, you can add a comment
COMMENT ON COLUMN public.essay_submissions.competencies IS 'JSONB object storing competency scores and feedback. Default empty object.';
