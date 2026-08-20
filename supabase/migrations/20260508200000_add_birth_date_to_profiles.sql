-- Adiciona data de nascimento para validação de identidade futura
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date DATE;
