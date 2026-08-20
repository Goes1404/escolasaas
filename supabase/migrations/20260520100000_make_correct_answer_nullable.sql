-- Allow correct_answer to be NULL for questions imported without a visible answer key
ALTER TABLE public.questions
  ALTER COLUMN correct_answer DROP NOT NULL;

-- Index to quickly find questions needing answer curation
CREATE INDEX IF NOT EXISTS idx_questions_needs_gabarito
  ON public.questions(id)
  WHERE correct_answer IS NULL;
