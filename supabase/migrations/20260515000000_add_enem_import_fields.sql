-- Campos para importação de questões do ENEM via enem.dev API
-- enem_discipline: área original da API (linguagens, matematica, natureza, humanas)
-- enem_year: ano do ENEM de origem
-- enem_index: índice da questão dentro do exame (para rastreabilidade)
-- Estes campos permitem reclassificação futura por matéria via IA

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS enem_discipline TEXT,
ADD COLUMN IF NOT EXISTS enem_year INTEGER,
ADD COLUMN IF NOT EXISTS enem_index INTEGER;

-- Subjects de área do ENEM (granularidade de área, não matéria)
-- Opção C: importar por área agora, reclassificar por matéria depois
INSERT INTO public.subjects (name) VALUES
  ('Linguagens e Códigos'),
  ('Ciências da Natureza'),
  ('Ciências Humanas')
ON CONFLICT (name) DO NOTHING;

-- Índice para buscas por área/ano (útil para reclassificação em batch)
CREATE INDEX IF NOT EXISTS idx_questions_enem_discipline
  ON public.questions(enem_discipline)
  WHERE enem_discipline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_enem_year
  ON public.questions(enem_year)
  WHERE enem_year IS NOT NULL;
