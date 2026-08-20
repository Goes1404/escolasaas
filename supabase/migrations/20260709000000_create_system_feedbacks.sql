-- A tabela system_feedbacks já existia (rating, comment, user_id, created_at).
-- Esta migration apenas adiciona a coluna de categoria/destino do feedback.
ALTER TABLE public.system_feedbacks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'equipe_tecnica'
  CHECK (category IN ('equipe_tecnica', 'professores', 'material', 'outro'));

CREATE INDEX IF NOT EXISTS idx_system_feedbacks_category ON public.system_feedbacks(category);
CREATE INDEX IF NOT EXISTS idx_system_feedbacks_created_at ON public.system_feedbacks(created_at DESC);

ALTER TABLE public.system_feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.system_feedbacks;
CREATE POLICY "Users can insert their own feedback"
  ON public.system_feedbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own feedback" ON public.system_feedbacks;
CREATE POLICY "Users can view their own feedback"
  ON public.system_feedbacks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and staff can view all feedback" ON public.system_feedbacks;
CREATE POLICY "Admins and staff can view all feedback"
  ON public.system_feedbacks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'staff')
    )
  );

COMMENT ON TABLE public.system_feedbacks IS 'Feedback dos alunos com nota (1-5 estrelas), comentário e categoria de destino (equipe técnica, professores, material).';
