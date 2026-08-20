
-- 1. Adicionar colunas faltantes para segmentação das notificações
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_group TEXT DEFAULT 'all';
-- Adicionamos target_polo como redundância para o sistema de polos instituído no NotificationBell
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_polo TEXT DEFAULT 'Todos';

-- 2. Habilitar gestão de avisos para Mentores (Professores) e Administradores
-- Primeiro garantimos que o RLS está ativo (já está, mas reforçamos)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Política de Inserção: Apenas usuários autenticados (ou especificamente teachers)
CREATE POLICY "Professores podem publicar avisos" 
ON public.announcements 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.profile_type = 'teacher' OR profiles.profile_type = 'admin')
  )
);

-- Política de Deleção: O autor ou administradores
CREATE POLICY "Professores podem deletar seus próprios avisos" 
ON public.announcements 
FOR DELETE 
TO authenticated 
USING (
  author_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.profile_type = 'admin'
  )
);

-- Política de Atualização: O autor ou administradores
CREATE POLICY "Professores podem editar seus próprios avisos" 
ON public.announcements 
FOR UPDATE 
TO authenticated 
USING (
  author_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.profile_type = 'admin'
  )
);
