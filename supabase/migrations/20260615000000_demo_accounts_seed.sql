-- ============================================================
-- Demo Accounts Seed
-- Contas públicas para demonstração de portfólio.
-- Idempotente: pode ser re-executado sem efeitos colaterais.
-- ============================================================
-- Credenciais:
--   aluno@compromisso.com    / compromisso2026@  (student)
--   professor@compromisso.com / compromisso2026@  (teacher)
--   admin@compromisso.com    / compromisso2026@  (admin)
--   staff@compromisso.com    / compromisso2026@  (staff)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
SET search_path TO public, extensions, auth;

-- 1. Coluna is_demo
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_demo ON public.profiles(is_demo) WHERE is_demo = true;

-- 2. Auth users para admin e staff (UUIDs fixos para idempotência)
DO $$
DECLARE
  v_pw   text := crypt('compromisso2026@', gen_salt('bf'));
  adm_id uuid := '00000000-0000-0000-0000-000000000099';
  stf_id uuid := '00000000-0000-0000-0000-000000000098';
  stu_id uuid := 'cca86ded-1c50-4f7d-909c-f3ba2223068e';
  tch_id uuid := 'c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f';
BEGIN

  -- Admin
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
  VALUES (adm_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'admin@compromisso.com', v_pw, NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Renata Souza Lima","role":"admin"}',
    false, false, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, updated_at = NOW();

  INSERT INTO auth.identities (user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  VALUES (adm_id, 'admin@compromisso.com', 'email',
    jsonb_build_object('sub', adm_id::text, 'email', 'admin@compromisso.com'),
    NOW(), NOW(), NOW())
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- Staff
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
  VALUES (stf_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'staff@compromisso.com', v_pw, NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marcos Vieira Costa","role":"staff"}',
    false, false, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, updated_at = NOW();

  INSERT INTO auth.identities (user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  VALUES (stf_id, 'staff@compromisso.com', 'email',
    jsonb_build_object('sub', stf_id::text, 'email', 'staff@compromisso.com'),
    NOW(), NOW(), NOW())
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- Atualizar senha das contas existentes para manter consistência
  UPDATE auth.users SET encrypted_password = v_pw, updated_at = NOW()
  WHERE id IN (stu_id, tch_id);

  -- Perfis
  UPDATE public.profiles SET
    full_name = 'Ana Beatriz Ferreira dos Santos', name = 'Ana Beatriz Ferreira dos Santos',
    email = 'aluno@compromisso.com', role = 'student',
    sala = 'Turma A', turno = 'manha', exam_target = 'ENEM / USP',
    xp_points = 3240, birth_date = '2007-03-15', phone = '(11) 98765-4321',
    bio = 'Estudante dedicada focada em Ciências Humanas e Linguagens. Meta: aprovação na USP em Relações Internacionais.',
    is_demo = true, status = 'active', updated_at = NOW()
  WHERE id = stu_id;

  UPDATE public.profiles SET
    full_name = 'Carlos Eduardo Menezes', name = 'Carlos Eduardo Menezes',
    email = 'professor@compromisso.com', role = 'teacher',
    bio = 'Professor de Matemática e Física com 8 anos de experiência no preparo para ENEM e ETEC.',
    is_demo = true, status = 'active', updated_at = NOW()
  WHERE id = tch_id;

  INSERT INTO public.profiles (id, full_name, name, email, role, bio, is_demo, status, xp_points, updated_at)
  VALUES (adm_id, 'Renata Souza Lima', 'Renata Souza Lima', 'admin@compromisso.com', 'admin',
    'Coordenadora Pedagógica do Cursinho Compromisso. Responsável pelo planejamento acadêmico e gestão de desempenho das turmas.',
    true, 'active', 0, NOW())
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, name = EXCLUDED.name, email = EXCLUDED.email,
    role = EXCLUDED.role, bio = EXCLUDED.bio, is_demo = true, status = 'active', updated_at = NOW();

  INSERT INTO public.profiles (id, full_name, name, email, role, bio, is_demo, status, xp_points, updated_at)
  VALUES (stf_id, 'Marcos Vieira Costa', 'Marcos Vieira Costa', 'staff@compromisso.com', 'staff',
    'Secretário Acadêmico responsável pelo cadastro, matrícula e suporte aos alunos do cursinho.',
    true, 'active', 0, NOW())
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, name = EXCLUDED.name, email = EXCLUDED.email,
    role = EXCLUDED.role, bio = EXCLUDED.bio, is_demo = true, status = 'active', updated_at = NOW();

END $$;

-- 3. Dados da aluna (Ana Beatriz)
DELETE FROM exam_attempts WHERE user_id = 'cca86ded-1c50-4f7d-909c-f3ba2223068e'
  AND exam_id IN ('8d084e7a-0fb3-4461-a46b-89a4ef2be287','f364c893-cdb8-4ed0-b122-e4f9cd1b3bd1','f70ff6e2-6327-4937-a698-98e0362abfe7');
DELETE FROM exam_attempts WHERE id IN (
  'de000001-0000-0000-0000-000000000001','de000001-0000-0000-0000-000000000002','de000001-0000-0000-0000-000000000003');
INSERT INTO exam_attempts (id, user_id, exam_id, score, total_questions, answers, completed_at) VALUES
  ('de000001-0000-0000-0000-000000000001','cca86ded-1c50-4f7d-909c-f3ba2223068e','8d084e7a-0fb3-4461-a46b-89a4ef2be287',61,90,'{}',NOW()-INTERVAL'60 days'),
  ('de000001-0000-0000-0000-000000000002','cca86ded-1c50-4f7d-909c-f3ba2223068e','f364c893-cdb8-4ed0-b122-e4f9cd1b3bd1',67,90,'{}',NOW()-INTERVAL'30 days'),
  ('de000001-0000-0000-0000-000000000003','cca86ded-1c50-4f7d-909c-f3ba2223068e','f70ff6e2-6327-4937-a698-98e0362abfe7',74,90,'{}',NOW()-INTERVAL'7 days');

INSERT INTO study_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
VALUES ('cca86ded-1c50-4f7d-909c-f3ba2223068e', 21, 45, CURRENT_DATE, NOW())
ON CONFLICT (user_id) DO UPDATE SET current_streak=21, longest_streak=45, last_activity_date=CURRENT_DATE, updated_at=NOW();

DELETE FROM user_badges WHERE user_id = 'cca86ded-1c50-4f7d-909c-f3ba2223068e';
INSERT INTO user_badges (user_id, badge_type, earned_at) VALUES
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','first_question', NOW()-INTERVAL'55 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','questions_10',   NOW()-INTERVAL'50 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','questions_50',   NOW()-INTERVAL'10 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','perfect_simulado',NOW()-INTERVAL'7 days');

DELETE FROM essay_submissions WHERE id IN (
  'de000002-0000-0000-0000-000000000001','de000002-0000-0000-0000-000000000002');
INSERT INTO essay_submissions (id, user_id, theme, content, score, competencies, feedback, status, created_at) VALUES
  ('de000002-0000-0000-0000-000000000001','cca86ded-1c50-4f7d-909c-f3ba2223068e',
   'Os desafios da educação pública no Brasil frente às desigualdades sociais',
   'A educação pública brasileira enfrenta um paradoxo estrutural: apesar de ser prevista como direito fundamental na Constituição Federal de 1988, ela reproduz as mesmas desigualdades que deveria combater.',
   82,'{"C1":16,"C2":20,"C3":16,"C4":20,"C5":10}',
   'Excelente domínio da norma culta. Tese bem estruturada. Proposta de intervenção articulada. Detalhar agente na competência 5.',
   'graded', NOW()-INTERVAL'25 days'),
  ('de000002-0000-0000-0000-000000000002','cca86ded-1c50-4f7d-909c-f3ba2223068e',
   'O impacto das redes sociais na saúde mental dos jovens brasileiros',
   'As redes sociais tornaram-se o principal meio de comunicação da geração Z no Brasil. Contudo, o uso excessivo tem gerado consequências preocupantes para a saúde mental dos jovens.',
   78,'{"C1":16,"C2":16,"C3":16,"C4":18,"C5":12}',
   'Boa argumentação e propostas articuladas. Repertório pode ser aprofundado. Conclusão convincente.',
   'graded', NOW()-INTERVAL'10 days');

DELETE FROM student_question_answers WHERE student_id='cca86ded-1c50-4f7d-909c-f3ba2223068e'
  AND question_id IN ('eaca85f0-319c-4266-9ee6-3a35d3098501','581374d9-0433-41c6-89e3-96557c984e4a',
    'f6bba515-e72a-4a48-8c11-6142d2010b71','05ee5165-03b6-4822-ac1e-df4620d28f9f',
    '0a2ae344-7f60-43f2-acd8-3def00688e19','0c5769cf-7e7a-4598-9e82-5f2e7077caa7',
    '702f8ec5-c1cc-4188-ba28-c0a7b0597404','866d6a83-bf81-4c7a-b908-82395e7f5be8',
    '90b0d253-5a81-4cbe-a528-d2f2018c84c0','dc4f59d4-6a40-4afa-a500-da8d2f9482ac',
    '1655fc96-c182-4a86-888e-41cb44d71a2d','16ea4f1d-2a9f-4b9f-8875-82581a65a9ce',
    '26c85588-299c-4aec-80bc-731024dac8a7','ee49b32e-7962-4f7f-8dcd-692c5d9fb6fb',
    '4fc0f0b9-9dfa-4718-8b74-a3dd92a19416','d00a7741-81d4-44af-bbb2-bfe57aa8aa82',
    '70630f31-c727-4779-a1bc-7fb1bd07da91','8f97c646-d62f-4b8d-b9f8-41280d7ff659',
    '765169ae-40e5-4d5f-9c0d-4807aff63857','0cf6d150-c034-46d5-be3d-e018e3c68d7b');
INSERT INTO student_question_answers (student_id, question_id, selected_option, is_correct, answered_at) VALUES
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','eaca85f0-319c-4266-9ee6-3a35d3098501','B',true, NOW()-INTERVAL'55 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','581374d9-0433-41c6-89e3-96557c984e4a','E',true, NOW()-INTERVAL'54 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','f6bba515-e72a-4a48-8c11-6142d2010b71','C',true, NOW()-INTERVAL'53 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','05ee5165-03b6-4822-ac1e-df4620d28f9f','D',true, NOW()-INTERVAL'52 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','0a2ae344-7f60-43f2-acd8-3def00688e19','C',true, NOW()-INTERVAL'51 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','0c5769cf-7e7a-4598-9e82-5f2e7077caa7','C',true, NOW()-INTERVAL'50 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','702f8ec5-c1cc-4188-ba28-c0a7b0597404','D',true, NOW()-INTERVAL'49 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','866d6a83-bf81-4c7a-b908-82395e7f5be8','C',true, NOW()-INTERVAL'48 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','90b0d253-5a81-4cbe-a528-d2f2018c84c0','A',true, NOW()-INTERVAL'47 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','dc4f59d4-6a40-4afa-a500-da8d2f9482ac','A',true, NOW()-INTERVAL'46 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','1655fc96-c182-4a86-888e-41cb44d71a2d','A',true, NOW()-INTERVAL'40 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','16ea4f1d-2a9f-4b9f-8875-82581a65a9ce','E',true, NOW()-INTERVAL'35 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','26c85588-299c-4aec-80bc-731024dac8a7','A',true, NOW()-INTERVAL'28 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','ee49b32e-7962-4f7f-8dcd-692c5d9fb6fb','A',true, NOW()-INTERVAL'21 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','4fc0f0b9-9dfa-4718-8b74-a3dd92a19416','B',false,NOW()-INTERVAL'18 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','d00a7741-81d4-44af-bbb2-bfe57aa8aa82','C',false,NOW()-INTERVAL'15 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','70630f31-c727-4779-a1bc-7fb1bd07da91','D',false,NOW()-INTERVAL'12 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','8f97c646-d62f-4b8d-b9f8-41280d7ff659','B',false,NOW()-INTERVAL'9 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','765169ae-40e5-4d5f-9c0d-4807aff63857','D',false,NOW()-INTERVAL'6 days'),
  ('cca86ded-1c50-4f7d-909c-f3ba2223068e','0cf6d150-c034-46d5-be3d-e018e3c68d7b','B',false,NOW()-INTERVAL'3 days');

DELETE FROM notes WHERE id IN (
  'de000005-0000-0000-0000-000000000001','de000005-0000-0000-0000-000000000002','de000005-0000-0000-0000-000000000003');
INSERT INTO notes (id, user_id, title, blocks, subject_id, tags, is_pinned, updated_at, created_at) VALUES
  ('de000005-0000-0000-0000-000000000001','cca86ded-1c50-4f7d-909c-f3ba2223068e',
   'Revolução Industrial — Resumo ENEM',
   '[{"id":"d5b01","type":"text","checked":false,"content":"Séc. XVIII-XIX: transição de economias agrárias para industriais, origem na Inglaterra."},{"id":"d5b02","type":"text","checked":false,"content":"Mecanização + máquina a vapor + urbanização acelerada + surgimento do proletariado."},{"id":"d5b03","type":"text","checked":false,"content":"Consequências: exploração do trabalho infantil, 14-16h/dia nas fábricas, surgimento do sindicalismo."},{"id":"d5b04","type":"text","checked":false,"content":"Karl Marx → mais-valia e luta de classes. Adam Smith → laissez-faire e mão invisível do mercado."}]'::jsonb,
   'f1ae4302-277f-4a79-bcb3-356e07dec260',ARRAY['ENEM','Revolução Industrial','História'],true,
   NOW()-INTERVAL'15 days',NOW()-INTERVAL'30 days'),
  ('de000005-0000-0000-0000-000000000002','cca86ded-1c50-4f7d-909c-f3ba2223068e',
   'Função Quadrática — Bhaskara',
   '[{"id":"d5b05","type":"text","checked":false,"content":"f(x) = ax² + bx + c. Parábola: a>0 concavidade ↑ | a<0 concavidade ↓"},{"id":"d5b06","type":"text","checked":false,"content":"Δ = b²−4ac. Δ>0: 2 raízes | Δ=0: 1 raiz | Δ<0: sem raízes reais."},{"id":"d5b07","type":"text","checked":false,"content":"x = (−b ± √Δ) / 2a — fórmula de Bhaskara."},{"id":"d5b08","type":"text","checked":false,"content":"Vértice: xv = −b/2a | yv = −Δ/4a — ponto de máx. ou mín. ENEM: área max., projéteis, receita/lucro."}]'::jsonb,
   '5010b14f-3090-4d4f-a42a-b5561e7631ba',ARRAY['Matemática','Funções','ENEM'],false,
   NOW()-INTERVAL'10 days',NOW()-INTERVAL'20 days'),
  ('de000005-0000-0000-0000-000000000003','cca86ded-1c50-4f7d-909c-f3ba2223068e',
   'Redação ENEM — Conectivos e Estrutura',
   '[{"id":"d5b09","type":"text","checked":false,"content":"Competência 3: selecionar, relacionar e organizar argumentos em defesa do ponto de vista."},{"id":"d5b10","type":"text","checked":false,"content":"Adição: além disso, ademais. Oposição: entretanto, contudo, todavia. Conclusão: portanto, logo, assim sendo."},{"id":"d5b11","type":"text","checked":false,"content":"Estrutura: 1) Tópico frasal  2) Desenvolvimento (exemplo, dado, citação)  3) Fechamento/transição."},{"id":"d5b12","type":"text","checked":false,"content":"Nunca começar parágrafo com pronome pessoal! Evitar repetição de palavras no mesmo parágrafo."}]'::jsonb,
   '00000000-0000-0000-0000-000000000020',ARRAY['Redação','ENEM','Escrita'],false,
   NOW()-INTERVAL'5 days',NOW()-INTERVAL'10 days');

-- 4. Dados do professor (Carlos Eduardo)
DELETE FROM scheduled_lives WHERE id IN (
  'de000006-0000-0000-0000-000000000001','de000006-0000-0000-0000-000000000002',
  'de000006-0000-0000-0000-000000000003','de000006-0000-0000-0000-000000000004');
INSERT INTO scheduled_lives (id, host_id, title, description, scheduled_at, subject, target_audience, status) VALUES
  ('de000006-0000-0000-0000-000000000001','c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f',
   'Funções Quadráticas para o ENEM',
   'Vamos resolver as principais questões de funções do 2º grau que caem no ENEM. Traga suas dúvidas!',
   NOW()+INTERVAL'3 days','Matemática','Todos','scheduled'),
  ('de000006-0000-0000-0000-000000000002','c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f',
   'Leis de Newton — Revisão Intensiva',
   'Revisão completa das Leis de Newton com exercícios comentados. Foco nos padrões ENEM 2025.',
   NOW()+INTERVAL'10 days','Física','ENEM','scheduled'),
  ('de000006-0000-0000-0000-000000000003','c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f',
   'Geometria Analítica — Reta e Circunferência',
   'Equação da reta, distância entre pontos, equação da circunferência. Exercícios de provas anteriores.',
   NOW()-INTERVAL'7 days','Matemática','Todos','completed'),
  ('de000006-0000-0000-0000-000000000004','c9f9b9f3-52cc-4f71-abdd-eea2bf08e43f',
   'Ondulatória e Óptica Geométrica',
   'Revisão de fenômenos ondulatórios e óptica geométrica com questões comentadas do ENEM.',
   NOW()-INTERVAL'14 days','Física','ENEM','completed');

-- 5. Dados da admin (Renata)
DELETE FROM announcements WHERE id IN (
  'de000007-0000-0000-0000-000000000001','de000007-0000-0000-0000-000000000002','de000007-0000-0000-0000-000000000003');
INSERT INTO announcements (id, author_id, title, message, priority, target_group, created_at) VALUES
  ('de000007-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099',
   'Simulado ENEM 2026 — Inscrições Abertas',
   'Turmas A, B e C: inscrições abertas até sexta-feira. Simulado presencial no sábado das 8h às 13h. Materiais: lápis, borracha e caneta azul ou preta. Apresentem documento de identidade.',
   'high','student',NOW()-INTERVAL'5 days'),
  ('de000007-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000099',
   'Semana Intensiva de Redação — Programação',
   'Semana Intensiva de Redação na próxima semana, todos os dias das 14h às 16h. Correções pela IA Aurora. Tema: Impactos das Fake News na Democracia Brasileira.',
   'medium','all',NOW()-INTERVAL'3 days'),
  ('de000007-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000099',
   'Resultados do Simulado de Maio',
   'Parabéns a todos! Média geral: 634 pontos. Gabaritos e relatórios disponíveis em Simulados > Histórico. Nota abaixo de 500? Entre em contato com a coordenação para agendamento de reforço.',
   'low','student',NOW()-INTERVAL'8 days');
