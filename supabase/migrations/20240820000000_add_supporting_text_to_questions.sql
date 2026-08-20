-- Add supporting_text column to questions table
-- Used for ENEM-style questions that reference a shared poem, article, chart, or image description
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS supporting_text TEXT;
