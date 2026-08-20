-- Gabarito do simulado (array de 60 letras, ex: ["A","C","B",...])
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS answer_key JSONB;

-- Permite teacher/staff atualizar answer_key de simulados importados
DROP POLICY IF EXISTS "exams_update_simulado" ON exams;
CREATE POLICY "exams_update_simulado" ON exams FOR UPDATE TO authenticated
  USING (
    exam_type = 'simulado_importado'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher','admin','staff')
    )
  );
