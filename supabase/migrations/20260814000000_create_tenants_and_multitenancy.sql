-- ============================================================================
-- Migration: 20260814000000_create_tenants_and_multitenancy.sql
-- Descrição: Inicializa o schema base e a estrutura Multi-tenancy escolasaas
-- ============================================================================

-- 1. Extensões e Tipos Base
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin');
    END IF;
END$$;

-- 2. Tabela Base de Perfis (Profiles) se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    full_name TEXT,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    role public.user_role DEFAULT 'student'::public.user_role NOT NULL,
    profile_type TEXT DEFAULT 'student',
    course TEXT,
    last_access TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'active',
    total_time_spent BIGINT DEFAULT 0,
    exam_target TEXT,
    periodo TEXT,
    cpf TEXT,
    xp_points INTEGER DEFAULT 0 NOT NULL,
    bio TEXT
);

-- Ativar RLS em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Tabelas Auxiliares do Sistema
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    coordinator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.questions (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    options JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    teacher_id UUID,
    correct_answer TEXT,
    question_text TEXT,
    year INTEGER,
    subject TEXT
);

CREATE TABLE IF NOT EXISTS public.essay_submissions (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    theme TEXT NOT NULL,
    content TEXT NOT NULL,
    score INTEGER,
    status TEXT DEFAULT 'submitted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    blocks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduled_lives (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    teacher_id UUID,
    start_time TIMESTAMP WITH TIME ZONE,
    meet_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Criação da Tabela Central de Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    custom_domain VARCHAR(255) UNIQUE,
    branding JSONB NOT NULL DEFAULT '{
        "appName": "Plataforma EAD",
        "logoUrl": "/images/default-logo.png",
        "primaryColor": "#4CCCED",
        "secondaryColor": "#ED3474",
        "accentColor": "#EDE04C",
        "contactEmail": "suporte@escolasaas.com"
    }'::jsonb,
    features JSONB NOT NULL DEFAULT '{
        "essays": true,
        "simulations": true,
        "forum": true,
        "aiAurora": true,
        "lives": true
    }'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativar RLS na tabela tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública para identificar tenant por subdomínio
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura publica de tenants ativos') THEN
        CREATE POLICY "Permitir leitura publica de tenants ativos"
        ON public.tenants FOR SELECT
        USING (status = 'active');
    END IF;
END$$;

-- 5. Inserção do Tenant Padrão (Modelo / Default)
INSERT INTO public.tenants (id, name, slug, branding, status)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Escola Modelo',
    'default',
    '{
        "appName": "Plataforma Educacional",
        "logoUrl": "/images/default-logo.png",
        "primaryColor": "#4CCCED",
        "secondaryColor": "#ED3474",
        "accentColor": "#EDE04C",
        "contactEmail": "suporte@escolasaas.com"
    }'::jsonb,
    'active'
) ON CONFLICT (id) DO NOTHING;

-- 6. Vinculação de tenant_id em todas as tabelas principais
DO $$
BEGIN
    -- profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tenant_id') THEN
        ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
    END IF;

    -- classes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='tenant_id') THEN
        ALTER TABLE public.classes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        CREATE INDEX idx_classes_tenant_id ON public.classes(tenant_id);
    END IF;

    -- questions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='tenant_id') THEN
        ALTER TABLE public.questions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        CREATE INDEX idx_questions_tenant_id ON public.questions(tenant_id);
    END IF;

    -- essay_submissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='essay_submissions' AND column_name='tenant_id') THEN
        ALTER TABLE public.essay_submissions ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        CREATE INDEX idx_essay_submissions_tenant_id ON public.essay_submissions(tenant_id);
    END IF;

    -- notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='tenant_id') THEN
        ALTER TABLE public.notes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        CREATE INDEX idx_notes_tenant_id ON public.notes(tenant_id);
    END IF;

    -- scheduled_lives
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_lives' AND column_name='tenant_id') THEN
        ALTER TABLE public.scheduled_lives ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        CREATE INDEX idx_scheduled_lives_tenant_id ON public.scheduled_lives(tenant_id);
    END IF;
END $$;

-- 7. Trigger para autocadastro no Auth criando perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, full_name, role, profile_type, status, tenant_id)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), 
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    'active',
    '00000000-0000-0000-0000-000000000000'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
