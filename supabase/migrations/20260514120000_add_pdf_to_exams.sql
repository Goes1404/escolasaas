-- Adiciona coluna pdf_url na tabela exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Cria o bucket 'exam_pdfs' no storage, caso não exista
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exam_pdfs', 'exam_pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Define a política pública de leitura para o bucket (qualquer um logado ou não pode ler se tiver a URL)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'exam_pdfs' );

-- Define a política de upload para professores autenticados
CREATE POLICY "Teacher Upload Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'exam_pdfs' );

-- Define a política de atualização/exclusão para professores autenticados
CREATE POLICY "Teacher Update Access" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'exam_pdfs' );

CREATE POLICY "Teacher Delete Access" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'exam_pdfs' );
