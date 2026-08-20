-- 1. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Create custom enum type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin');
    END IF;
END$$;

-- 3. Create helper functions
CREATE OR REPLACE FUNCTION public.get_my_claim(claim_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims JSONB;
BEGIN
  claims := COALESCE(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  RETURN claims -> claim_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_question_options(options jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  elem jsonb;
  key_text text;
  key_val text;
  keys text[] := ARRAY[]::text[];
BEGIN
  IF options IS NULL THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(options) <> 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(options) = 0 THEN
    RETURN false;
  END IF;
  FOR elem IN SELECT * FROM jsonb_array_elements(options) LOOP
    -- must be object
    IF jsonb_typeof(elem) <> 'object' THEN
      RETURN false;
    END IF;
    -- must have key and text
    IF NOT (elem ? 'key') OR NOT (elem ? 'text') THEN
      RETURN false;
    END IF;
    -- extract and validate as non-empty trimmed strings
    key_val := trim(both from (elem ->> 'key'));
    key_text := trim(both from (elem ->> 'text'));
    IF key_val IS NULL OR key_text IS NULL THEN
      RETURN false;
    END IF;
    IF key_val = '' OR key_text = '' THEN
      RETURN false;
    END IF;
    -- uniqueness check for key
    IF key_val = ANY(keys) THEN
      RETURN false;
    END IF;
    keys := array_append(keys, key_val);
  END LOOP;
  RETURN true;
END;
$$;

-- 4. Create initial tables

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE,
    full_name TEXT,
    avatar_url TEXT,
    role public.user_role DEFAULT 'student'::public.user_role NOT NULL,
    profile_type TEXT,
    course TEXT,
    last_access TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_financial_aid_eligible BOOLEAN DEFAULT false,
    name TEXT,
    name_changes_count INTEGER DEFAULT 0,
    favorite_subject UUID,
    status TEXT DEFAULT 'active'::text,
    email TEXT,
    username TEXT,
    total_time_spent BIGINT DEFAULT 0,
    exam_target TEXT,
    periodo TEXT,
    cpf TEXT,
    xp_points INTEGER DEFAULT 0 NOT NULL,
    bio TEXT
);

-- Questions table
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

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'low'::text,
    author_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trails table
CREATE TABLE IF NOT EXISTS public.trails (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    description TEXT,
    is_fundamental BOOLEAN DEFAULT false,
    author_id UUID,
    image_url TEXT,
    teacher_name TEXT,
    status TEXT DEFAULT 'draft'::text,
    target_audience TEXT DEFAULT 'all'::text,
    teacher_id UUID
);

-- Classes table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    coordinator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Lives table
CREATE TABLE IF NOT EXISTS public.lives (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    teacher_name TEXT,
    teacher_id UUID,
    youtube_id TEXT,
    youtube_url TEXT,
    meet_link TEXT,
    status TEXT DEFAULT 'scheduled'::text
);

-- System Feedbacks table
CREATE TABLE IF NOT EXISTS public.system_feedbacks (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Trigger to automatically handle profiles on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, profile_type, status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Insert student and teacher users into auth.users (so they exist for subsequent migrations)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
VALUES 
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'aluno@compromisso.com', extensions.crypt('compromisso2026@', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Ana Beatriz Ferreira dos Santos","role":"student"}',
   false, false, NOW(), NOW()),
  ('c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'professor@compromisso.com', extensions.crypt('compromisso2026@', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Carlos Eduardo Menezes","role":"teacher"}',
   false, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
