-- Habilita a extensão pgvector, caso ainda não esteja ativa.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. Cria a tabela para armazenar os embeddings e metadados
CREATE TABLE IF NOT EXISTS public.embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES auth.users(id), -- Chave estrangeira para o usuário que criou o embedding
    content TEXT NOT NULL, -- O conteúdo original que foi "embedado"
    embedding VECTOR(768) NOT NULL, -- O vetor gerado. 768 é a dimensão do modelo text-embedding-004 do Google.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Cria a função para buscar por similaridade
CREATE OR REPLACE FUNCTION public.match_embeddings (
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id uuid,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content,
        1 - (e.embedding <=> query_embedding) AS similarity -- Cosseno da distância
    FROM
        public.embeddings AS e
    WHERE
        1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY
        e.embedding <=> query_embedding
    LIMIT
        match_count;
END;
$$
;

-- 3. Cria um índice para acelerar as buscas (IVFFlat ou HNSW)
-- HNSW é geralmente melhor para performance e precisão.
CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx ON public.embeddings USING hnsw (embedding vector_cosine_ops);

-- 4. Define as Políticas de Segurança (Row Level Security)
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

-- Os usuários só podem ler os próprios embeddings
CREATE POLICY "Allow individual read access" ON public.embeddings
    FOR SELECT USING (auth.uid() = owner_id);

-- Ninguém pode inserir, atualizar ou deletar diretamente. Apenas via a Edge Function com a service_role.
CREATE POLICY "Disallow all write operations" ON public.embeddings
    FOR ALL USING (false) WITH CHECK (false);

