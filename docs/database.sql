
-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS (Sincronizada com o Cadastro)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  username TEXT UNIQUE,
  profile_type TEXT, -- 'etec', 'uni', 'teacher', 'admin', etc.
  institution TEXT,
  course TEXT,
  favorite_subject TEXT,
  interests TEXT,
  is_financial_aid_eligible BOOLEAN DEFAULT FALSE,
  last_access TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- 'active' ou 'suspended'
  avatar_url TEXT,
  name_changes_count INTEGER DEFAULT 0,
  class_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BANCO DE QUESTÕES E SIMULADOS
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- Formato: [{"key": "A", "text": "..."}, ...]
  correct_answer TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id),
  year INTEGER DEFAULT 2024,
  teacher_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.simulation_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id),
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ECOSSISTEMA DE COMUNIDADE (Chat, Fóruns e Avisos)
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.forums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Geral',
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  is_teacher_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forum_id UUID REFERENCES public.forums(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  target_group TEXT DEFAULT 'all',
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRILHAS DE APRENDIZAGEM
CREATE TABLE IF NOT EXISTS public.trails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  teacher_id UUID REFERENCES auth.users(id),
  teacher_name TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'published'
  image_url TEXT,
  target_audience TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trail_id UUID REFERENCES public.trails(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.learning_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT, -- 'video', 'pdf', 'quiz', 'text'
  url TEXT,
  description TEXT,
  order_index INTEGER DEFAULT 0
);

-- 6. GESTÃO E LIVES
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  coordinator_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  meet_link TEXT,
  teacher_id UUID REFERENCES auth.users(id),
  teacher_name TEXT,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'live', 'finished'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trail_id UUID REFERENCES public.trails(id) ON DELETE CASCADE,
  percentage INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, trail_id)
);

-- 7. FUNÇÕES E GATILHOS (Motores Automáticos)

-- Função de Criação Automática de Perfil (Atomicidade no Cadastro)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    name, 
    email, 
    username, 
    profile_type, 
    institution, 
    course, 
    last_access
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'profile_type',
    new.raw_user_meta_data->>'institution',
    new.raw_user_meta_data->>'course',
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho de Cadastro
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para pegar questões aleatórias
CREATE OR REPLACE FUNCTION get_random_questions_for_subject(p_subject_id UUID, p_limit INTEGER)
RETURNS SETOF questions AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM questions
  WHERE subject_id = p_subject_id
  ORDER BY random()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Função para dashboard de matérias
CREATE OR REPLACE FUNCTION get_subjects_with_question_count()
RETURNS TABLE (id UUID, name TEXT, question_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, COUNT(q.id) as question_count
  FROM subjects s
  LEFT JOIN questions q ON s.id = q.subject_id
  GROUP BY s.id, s.name
  ORDER BY s.name ASC;
END;
$$ LANGUAGE plpgsql;

-- 8. PERMISSÕES BÁSICAS (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Pública Perfis" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Update Próprio Perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Trigger de Cadastro Perfil" ON public.profiles FOR INSERT WITH CHECK (true);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver mensagens próprias" ON public.direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Enviar mensagens próprias" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Liberar leitura para o protótipo (MVP)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Pública Subjects" ON public.subjects FOR SELECT USING (true);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Pública Questions" ON public.questions FOR SELECT USING (true);

ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Pública Trilhas" ON public.trails FOR SELECT USING (true);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Pública Avisos" ON public.announcements FOR SELECT USING (true);
