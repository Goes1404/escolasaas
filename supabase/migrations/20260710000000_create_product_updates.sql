-- Feed de novidades/atualizações da plataforma, visível para todos os usuários
CREATE TABLE IF NOT EXISTS public.product_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  tag TEXT NOT NULL DEFAULT 'feature' CHECK (tag IN ('feature', 'improvement', 'bugfix')),
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_updates_created_at ON public.product_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_updates_published ON public.product_updates(published);

ALTER TABLE public.product_updates ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado vê as novidades publicadas
DROP POLICY IF EXISTS "Anyone can view published updates" ON public.product_updates;
CREATE POLICY "Anyone can view published updates"
  ON public.product_updates
  FOR SELECT
  TO authenticated
  USING (published = true);

-- Admins e staff podem gerenciar (criar/editar/apagar) novidades
DROP POLICY IF EXISTS "Admins and staff manage updates" ON public.product_updates;
CREATE POLICY "Admins and staff manage updates"
  ON public.product_updates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'staff')
    )
  );

COMMENT ON TABLE public.product_updates IS 'Feed de novidades/atualizações da plataforma (correções, novas funcionalidades, melhorias) exibido no menu de todos os usuários.';

-- Seed inicial: as correções visuais e o novo recurso de feedback desta sessão
INSERT INTO public.product_updates (title, description, tag, published) VALUES
(
  'Novo: Feedback dentro do app',
  'Agora você pode avaliar a plataforma e enviar comentários direto pelo app, escolhendo se o retorno é para a Equipe Técnica, Professores ou sobre Material. É só tocar no botão de feedback (acima do botão da Aurora IA) e dar sua nota de 1 a 5 estrelas.',
  'feature',
  true
),
(
  'Correções de layout no mobile',
  'Ajustamos vários pontos onde textos estavam sendo cortados ou vazando dos cards: cabeçalho do Desafio Diário, cards da tela inicial, título da página de Trilhas e as estatísticas de Acertos/Redação/Trilhas. Também corrigimos um problema de acentuação em textos importados (como "previsão" aparecendo como "previsÃ£o").',
  'bugfix',
  true
);
