INSERT INTO exams (id, title, description, year, exam_type, teacher_id)
VALUES 
  ('8d084e7a-0fb3-4461-a46b-89a4ef2be287', 'Simulado ENEM 1', 'Simulado para teste', 2026, 'enem', 'c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f'),
  ('f364c893-cdb8-4ed0-b122-e4f9cd1b3bd1', 'Simulado ENEM 2', 'Simulado para teste', 2026, 'enem', 'c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f'),
  ('f70ff6e2-6327-4937-a698-98e0362abfe7', 'Simulado ENEM 3', 'Simulado para teste', 2026, 'enem', 'c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subjects (id, name)
VALUES 
  ('f1ae4302-277f-4a79-bcb3-356e07dec260', 'História (Demo)'),
  ('5010b14f-3090-4d4f-a42a-b5561e7631ba', 'Matemática (Demo)'),
  ('00000000-0000-0000-0000-000000000020', 'Redação')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_subject_id UUID;
BEGIN
  -- get any subject
  SELECT id INTO v_subject_id FROM public.subjects LIMIT 1;
  
  -- Insert dummy questions if they don't exist
  INSERT INTO questions (id, question_text, content, options, correct_answer, year, subject_id)
  VALUES
    ('eaca85f0-319c-4266-9ee6-3a35d3098501', 'Questão de teste 1', 'Questão de teste 1', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'B', 2026, v_subject_id),
    ('581374d9-0433-41c6-89e3-96557c984e4a', 'Questão de teste 2', 'Questão de teste 2', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'E', 2026, v_subject_id),
    ('f6bba515-e72a-4a48-8c11-6142d2010b71', 'Questão de teste 3', 'Questão de teste 3', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'C', 2026, v_subject_id),
    ('05ee5165-03b6-4822-ac1e-df4620d28f9f', 'Questão de teste 4', 'Questão de teste 4', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'D', 2026, v_subject_id),
    ('0a2ae344-7f60-43f2-acd8-3def00688e19', 'Questão de teste 5', 'Questão de teste 5', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'C', 2026, v_subject_id),
    ('0c5769cf-7e7a-4598-9e82-5f2e7077caa7', 'Questão de teste 6', 'Questão de teste 6', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'C', 2026, v_subject_id),
    ('702f8ec5-c1cc-4188-ba28-c0a7b0597404', 'Questão de teste 7', 'Questão de teste 7', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'D', 2026, v_subject_id),
    ('866d6a83-bf81-4c7a-b908-82395e7f5be8', 'Questão de teste 8', 'Questão de teste 8', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'C', 2026, v_subject_id),
    ('90b0d253-5a81-4cbe-a528-d2f2018c84c0', 'Questão de teste 9', 'Questão de teste 9', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'A', 2026, v_subject_id),
    ('dc4f59d4-6a40-4afa-a500-da8d2f9482ac', 'Questão de teste 10', 'Questão de teste 10', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'A', 2026, v_subject_id),
    ('1655fc96-c182-4a86-888e-41cb44d71a2d', 'Questão de teste 11', 'Questão de teste 11', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'A', 2026, v_subject_id),
    ('16ea4f1d-2a9f-4b9f-8875-82581a65a9ce', 'Questão de teste 12', 'Questão de teste 12', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'E', 2026, v_subject_id),
    ('26c85588-299c-4aec-80bc-731024dac8a7', 'Questão de teste 13', 'Questão de teste 13', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'A', 2026, v_subject_id),
    ('ee49b32e-7962-4f7f-8dcd-692c5d9fb6fb', 'Questão de teste 14', 'Questão de teste 14', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'A', 2026, v_subject_id),
    ('4fc0f0b9-9dfa-4718-8b74-a3dd92a19416', 'Questão de teste 15', 'Questão de teste 15', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'B', 2026, v_subject_id),
    ('d00a7741-81d4-44af-bbb2-bfe57aa8aa82', 'Questão de teste 16', 'Questão de teste 16', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'C', 2026, v_subject_id),
    ('70630f31-c727-4779-a1bc-7fb1bd07da91', 'Questão de teste 17', 'Questão de teste 17', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'D', 2026, v_subject_id),
    ('8f97c646-d62f-4b8d-b9f8-41280d7ff659', 'Questão de teste 18', 'Questão de teste 18', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'B', 2026, v_subject_id),
    ('765169ae-40e5-4d5f-9c0d-4807aff63857', 'Questão de teste 19', 'Questão de teste 19', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'D', 2026, v_subject_id),
    ('0cf6d150-c034-46d5-be3d-e018e3c68d7b', 'Questão de teste 20', 'Questão de teste 20', '[{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}, {"key": "C", "text": "Opção C"}, {"key": "D", "text": "Opção D"}, {"key": "E", "text": "Opção E"}]'::jsonb, 'B', 2026, v_subject_id)
  ON CONFLICT (id) DO NOTHING;
END $$;
