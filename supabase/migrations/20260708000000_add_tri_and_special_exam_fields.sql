-- Adiciona campos para o cálculo de TRI nas questões
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS tri_a NUMERIC NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS tri_b NUMERIC NOT NULL DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS tri_c NUMERIC NOT NULL DEFAULT 0.20;

-- Adiciona sinalizadores na tabela de exames/simulados
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS is_special_cursinho BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS tri_score_calculated BOOLEAN NOT NULL DEFAULT false;

-- Adiciona a coluna para armazenar a nota de TRI no histórico de tentativas
ALTER TABLE public.exam_attempts
ADD COLUMN IF NOT EXISTS tri_score INTEGER;

-- Comentários explicativos para documentar o schema
COMMENT ON COLUMN public.questions.tri_a IS 'Parâmetro de discriminação da questão no modelo 3PL da TRI.';
COMMENT ON COLUMN public.questions.tri_b IS 'Parâmetro de dificuldade da questão no modelo 3PL da TRI.';
COMMENT ON COLUMN public.questions.tri_c IS 'Parâmetro de acerto casual (chute) da questão no modelo 3PL da TRI.';
COMMENT ON COLUMN public.exams.is_special_cursinho IS 'Indica se o simulado foi elaborado pelos professores do cursinho (diferenciado).';
COMMENT ON COLUMN public.exams.tri_score_calculated IS 'Indica se o simulado calcula as notas finais utilizando o modelo TRI.';
COMMENT ON COLUMN public.exam_attempts.tri_score IS 'Nota final calculada via Teoria de Resposta ao Item (TRI).';
