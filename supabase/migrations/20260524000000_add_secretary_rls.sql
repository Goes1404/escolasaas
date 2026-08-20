-- ============================================================
-- SECRETARY ROLE POLICIES
-- Compromisso 360 | Migration 20260524000000
-- ============================================================

-- Garante que o perfil 'staff' (Secretaria) possa gerenciar perfis de alunos
-- Criamos uma função SECURITY DEFINER para evitar a recursão infinita no RLS da tabela profiles
CREATE OR REPLACE FUNCTION public.check_user_is_staff_or_admin(user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role::text IN ('admin', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "staff_manage_profiles" ON public.profiles;
CREATE POLICY "staff_manage_profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (
    public.check_user_is_staff_or_admin(auth.uid())
  )
  WITH CHECK (
    public.check_user_is_staff_or_admin(auth.uid())
  );
