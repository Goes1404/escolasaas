-- Bucket público para imagens de questões extraídas de PDFs de prova.
-- Antes desta migration o bucket não existia, então TODO upload em
-- `question-images` (fluxo de extração do professor e ferramenta de reparo)
-- falhava silenciosamente — motivo pelo qual as imagens nunca eram anexadas.
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública: alunos veem a imagem no card da questão durante a prova.
DROP POLICY IF EXISTS "question_images_public_read" ON storage.objects;
CREATE POLICY "question_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-images');

-- Escrita apenas por usuários autenticados (professores/admin no fluxo real).
DROP POLICY IF EXISTS "question_images_auth_insert" ON storage.objects;
CREATE POLICY "question_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-images');

DROP POLICY IF EXISTS "question_images_auth_update" ON storage.objects;
CREATE POLICY "question_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "question_images_auth_delete" ON storage.objects;
CREATE POLICY "question_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'question-images');
