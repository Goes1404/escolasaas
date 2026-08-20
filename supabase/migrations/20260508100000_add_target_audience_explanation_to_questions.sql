-- Adiciona target_audience para separação ETEC/ENEM e explanation para gabarito comentado
-- target_audience: 'all' | 'etec' | 'enem'

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS explanation TEXT;
