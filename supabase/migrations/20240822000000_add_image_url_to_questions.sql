-- Add image_url column to questions table
-- Enables teachers to attach an image after extracting questions with [IMAGEM_PENDENTE] marker
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS image_url TEXT;
