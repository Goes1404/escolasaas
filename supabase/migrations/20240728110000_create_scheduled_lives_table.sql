--
-- Tabela para Agendamento de Transmissões ao Vivo (Lives)
--

-- 1. Criar o tipo ENUM para o status da live, de forma idempotente.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'live_status') THEN
        CREATE TYPE public.live_status AS ENUM ('scheduled', 'live', 'completed', 'canceled');
    END IF;
END$$;

-- 2. Criar a tabela principal 'scheduled_lives', se ela não existir.
CREATE TABLE IF NOT EXISTS public.scheduled_lives (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    host_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    subject character varying(255),
    target_audience character varying(255),
    status public.live_status DEFAULT 'scheduled',
    cover_image_url text,
    CONSTRAINT scheduled_lives_title_check CHECK ((char_length(title) > 3))
);

-- 3. Adicionar comentários para documentar o schema, o que é uma excelente prática.
COMMENT ON TABLE public.scheduled_lives IS 'Armazena informações sobre transmissões ao vivo agendadas.';
COMMENT ON COLUMN public.scheduled_lives.id IS 'Identificador único da live (Chave Primária).';
COMMENT ON COLUMN public.scheduled_lives.created_at IS 'Data e hora de criação do registro de agendamento.';
COMMENT ON COLUMN public.scheduled_lives.title IS 'Título da transmissão ao vivo.';
COMMENT ON COLUMN public.scheduled_lives.description IS 'Descrição detalhada do conteúdo da live.';
COMMENT ON COLUMN public.scheduled_lives.scheduled_at IS 'Data e hora em que a transmissão está programada para começar.';
COMMENT ON COLUMN public.scheduled_lives.host_id IS 'ID do usuário (professor) que irá apresentar a live. Vinculado a `auth.users`.';
COMMENT ON COLUMN public.scheduled_lives.subject IS 'Tópico ou matéria principal da transmissão (ex: Matemática, História).';
COMMENT ON COLUMN public.scheduled_lives.target_audience IS 'O público-alvo da transmissão (ex: 9º Ano, Ensino Médio).';
COMMENT ON COLUMN public.scheduled_lives.status IS 'O estado atual da transmissão (Agendada, Ao Vivo, Concluída, Cancelada).';
COMMENT ON COLUMN public.scheduled_lives.cover_image_url IS 'URL para uma imagem de capa ou thumbnail personalizada para a live.';

-- 4. Habilitar a Segurança em Nível de Linha (RLS) para proteger os dados.
ALTER TABLE public.scheduled_lives ENABLE ROW LEVEL SECURITY;

-- 5. Conceder permissões básicas na tabela. Ajuste conforme as necessidades do seu app.
-- Por padrão, ninguém pode fazer nada. As políticas de RLS definirão o acesso.
GRANT ALL ON TABLE public.scheduled_lives TO authenticated;
GRANT ALL ON TABLE public.scheduled_lives TO service_role;
