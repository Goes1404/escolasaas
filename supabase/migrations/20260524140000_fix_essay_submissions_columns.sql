-- Add missing columns to public.essay_submissions table
ALTER TABLE public.essay_submissions ADD COLUMN IF NOT EXISTS result_data JSONB;
ALTER TABLE public.essay_submissions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.essay_submissions ADD COLUMN IF NOT EXISTS mentor_notes TEXT;
