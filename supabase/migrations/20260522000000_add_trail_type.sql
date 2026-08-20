-- Adiciona trail_type às trilhas
-- 'standalone' = aula avulsa (filme), 'serie' = conjunto de aulas
-- Todas as trilhas existentes viram 'standalone' por padrão
ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS trail_type TEXT NOT NULL DEFAULT 'standalone'
  CHECK (trail_type IN ('standalone', 'serie'));
