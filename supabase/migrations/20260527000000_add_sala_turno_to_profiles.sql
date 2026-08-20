-- Add classroom and shift fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sala      TEXT,
  ADD COLUMN IF NOT EXISTS turno     TEXT CHECK (turno IN ('manha', 'tarde', 'integral'));
