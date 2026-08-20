-- ============================================================
-- Migration: 20260710020000_fix_open_rls_policies.sql
-- SEGURANÇA: auditoria (Supabase security advisor) encontrou o mesmo
-- padrão do fix em direct_messages espalhado por ~30 tabelas: policies
-- residuais de um "modo demo" (nomes como "Acesso Demo", "Permitir
-- tudo", "open_insert/update/delete_for_authenticated_*") com
-- qual/with_check = true, sem checar dono ou papel do usuário.
-- Como o Postgres faz OR entre policies permissivas da mesma tabela,
-- essas policies "abertas" anulavam qualquer policy restrita que já
-- existisse ao lado delas.
--
-- Também há 8 tabelas com RLS totalmente desligada (nem chega a
-- avaliar as policies existentes).
--
-- Esta migration:
--   1) Remove as policies de escrita (INSERT/UPDATE/DELETE/ALL)
--      incondicionalmente abertas em cada tabela listada abaixo.
--   2) Liga RLS nas tabelas que estavam desligadas.
--   3) Onde a tabela não tinha NENHUMA policy restrita (só as
--      abertas), adiciona uma policy mínima correta no lugar,
--      para não quebrar funcionalidade legítima do app.
--
-- Policies de leitura (SELECT) amplamente abertas para usuários
-- autenticados foram mantidas de propósito quando o conteúdo é
-- naturalmente compartilhado da plataforma (fórum, aulas, trilhas,
-- materiais, banco de questões) — não há PII nelas. Onde SELECT
-- aberto expunha dado privado (anotações de material, boletins
-- pendentes, convites) a policy foi restringida também.
-- ============================================================

-- ── profiles ── escalação de privilégio: qualquer autenticado podia
-- alterar/apagar o perfil de QUALQUER pessoa (inclusive o campo role).
DROP POLICY IF EXISTS "open_delete_for_authenticated_profiles" ON public.profiles;
DROP POLICY IF EXISTS "open_insert_for_authenticated_profiles" ON public.profiles;
DROP POLICY IF EXISTS "open_update_for_authenticated_profiles" ON public.profiles;

-- ── essay_submissions / essays ── qualquer autenticado editava/apagava
-- redação de qualquer aluno.
DROP POLICY IF EXISTS "open_delete_for_authenticated_essay_submissions" ON public.essay_submissions;
DROP POLICY IF EXISTS "open_insert_for_authenticated_essay_submissions" ON public.essay_submissions;
DROP POLICY IF EXISTS "open_select_for_authenticated_essay_submissions" ON public.essay_submissions;
DROP POLICY IF EXISTS "open_update_for_authenticated_essay_submissions" ON public.essay_submissions;

DROP POLICY IF EXISTS "open_delete_for_authenticated_essays" ON public.essays;
DROP POLICY IF EXISTS "open_insert_for_authenticated_essays" ON public.essays;
DROP POLICY IF EXISTS "open_select_for_authenticated_essays" ON public.essays;
DROP POLICY IF EXISTS "open_update_for_authenticated_essays" ON public.essays;

-- ── student_question_answers ── qualquer autenticado editava/apagava
-- respostas de qualquer aluno (gabarito/nota).
DROP POLICY IF EXISTS "open_delete_for_authenticated_student_question_answers" ON public.student_question_answers;
DROP POLICY IF EXISTS "open_insert_for_authenticated_student_question_answers" ON public.student_question_answers;
DROP POLICY IF EXISTS "open_select_for_authenticated_student_question_answers" ON public.student_question_answers;
DROP POLICY IF EXISTS "open_update_for_authenticated_student_question_answers" ON public.student_question_answers;

-- ── material_annotations ── anotações são pessoais; open_select
-- expunha as anotações privadas de qualquer aluno.
DROP POLICY IF EXISTS "open_delete_for_authenticated_material_annotations" ON public.material_annotations;
DROP POLICY IF EXISTS "open_insert_for_authenticated_material_annotations" ON public.material_annotations;
DROP POLICY IF EXISTS "open_select_for_authenticated_material_annotations" ON public.material_annotations;
DROP POLICY IF EXISTS "open_update_for_authenticated_material_annotations" ON public.material_annotations;

-- ── questions ── qualquer autenticado editava/apagava questões de
-- qualquer professor (bypass do check por teacher_id).
DROP POLICY IF EXISTS "open_delete_for_authenticated_questions" ON public.questions;
DROP POLICY IF EXISTS "open_insert_for_authenticated_questions" ON public.questions;
DROP POLICY IF EXISTS "open_update_for_authenticated_questions" ON public.questions;

-- ── announcements ── escrita aberta (leitura ampla mantida de
-- propósito — são avisos, conteúdo de broadcast).
DROP POLICY IF EXISTS "open_delete_for_authenticated_announcements" ON public.announcements;
DROP POLICY IF EXISTS "open_insert_for_authenticated_announcements" ON public.announcements;
DROP POLICY IF EXISTS "open_update_for_authenticated_announcements" ON public.announcements;

-- ── forums / forum_posts / forum_replies / forum_threads ──
DROP POLICY IF EXISTS "Acesso total fórum" ON public.forums;
DROP POLICY IF EXISTS "open_delete_for_authenticated_forums" ON public.forums;
DROP POLICY IF EXISTS "open_insert_for_authenticated_forums" ON public.forums;
DROP POLICY IF EXISTS "open_update_for_authenticated_forums" ON public.forums;

DROP POLICY IF EXISTS "Acesso total posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Enviar mensagens" ON public.forum_posts;
DROP POLICY IF EXISTS "Marcar como respondida" ON public.forum_posts;
DROP POLICY IF EXISTS "open_delete_for_authenticated_forum_posts" ON public.forum_posts;
DROP POLICY IF EXISTS "open_insert_for_authenticated_forum_posts" ON public.forum_posts;
DROP POLICY IF EXISTS "open_update_for_authenticated_forum_posts" ON public.forum_posts;

DROP POLICY IF EXISTS "open_delete_for_authenticated_forum_replies" ON public.forum_replies;
DROP POLICY IF EXISTS "open_insert_for_authenticated_forum_replies" ON public.forum_replies;
DROP POLICY IF EXISTS "open_update_for_authenticated_forum_replies" ON public.forum_replies;

DROP POLICY IF EXISTS "open_delete_for_authenticated_forum_threads" ON public.forum_threads;
DROP POLICY IF EXISTS "open_insert_for_authenticated_forum_threads" ON public.forum_threads;
DROP POLICY IF EXISTS "open_update_for_authenticated_forum_threads" ON public.forum_threads;

-- ── learning_contents / modules / trails / trail_modules / trail_contents ──
DROP POLICY IF EXISTS "Acesso Demo" ON public.learning_contents;
DROP POLICY IF EXISTS "Professores editam conteúdos" ON public.learning_contents;
DROP POLICY IF EXISTS "Acesso publico learning_contents" ON public.learning_contents;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.learning_contents;
DROP POLICY IF EXISTS "open_delete_for_authenticated_learning_contents" ON public.learning_contents;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.learning_contents;
DROP POLICY IF EXISTS "open_insert_for_authenticated_learning_contents" ON public.learning_contents;
DROP POLICY IF EXISTS "open_update_for_authenticated_learning_contents" ON public.learning_contents;

DROP POLICY IF EXISTS "Acesso Demo" ON public.modules;
DROP POLICY IF EXISTS "Professores editam módulos" ON public.modules;
DROP POLICY IF EXISTS "Acesso publico modules" ON public.modules;
DROP POLICY IF EXISTS "open_delete_for_authenticated_modules" ON public.modules;
DROP POLICY IF EXISTS "Allow delete for authenticated users on modules" ON public.modules;
DROP POLICY IF EXISTS "Allow insert for authenticated users on modules" ON public.modules;
DROP POLICY IF EXISTS "open_insert_for_authenticated_modules" ON public.modules;
DROP POLICY IF EXISTS "open_update_for_authenticated_modules" ON public.modules;

DROP POLICY IF EXISTS "Acesso Demo" ON public.trails;
DROP POLICY IF EXISTS "Professores editam trails" ON public.trails;
DROP POLICY IF EXISTS "Allow delete for authenticated users on trails" ON public.trails;
DROP POLICY IF EXISTS "Allow insert for authenticated users on trails" ON public.trails;
DROP POLICY IF EXISTS "Allow update for authenticated users on trails" ON public.trails;

DROP POLICY IF EXISTS "open_delete_for_authenticated_trail_modules" ON public.trail_modules;
DROP POLICY IF EXISTS "open_insert_for_authenticated_trail_modules" ON public.trail_modules;
DROP POLICY IF EXISTS "open_update_for_authenticated_trail_modules" ON public.trail_modules;

DROP POLICY IF EXISTS "open_delete_for_authenticated_trail_contents" ON public.trail_contents;
DROP POLICY IF EXISTS "open_insert_for_authenticated_trail_contents" ON public.trail_contents;
DROP POLICY IF EXISTS "open_update_for_authenticated_trail_contents" ON public.trail_contents;

-- ── library_resources / lives / live_messages / teachers ──
DROP POLICY IF EXISTS "Permitir tudo na biblioteca" ON public.library_resources;
DROP POLICY IF EXISTS "Acesso Demo" ON public.library_resources;
DROP POLICY IF EXISTS "open_delete_for_authenticated_library_resources" ON public.library_resources;
DROP POLICY IF EXISTS "open_insert_for_authenticated_library_resources" ON public.library_resources;
DROP POLICY IF EXISTS "open_update_for_authenticated_library_resources" ON public.library_resources;

DROP POLICY IF EXISTS "Acesso Demo" ON public.lives;
DROP POLICY IF EXISTS "Acesso publico lives" ON public.lives;
DROP POLICY IF EXISTS "open_delete_for_authenticated_lives" ON public.lives;
DROP POLICY IF EXISTS "open_insert_for_authenticated_lives" ON public.lives;
DROP POLICY IF EXISTS "open_update_for_authenticated_lives" ON public.lives;

DROP POLICY IF EXISTS "open_delete_for_authenticated_live_messages" ON public.live_messages;
DROP POLICY IF EXISTS "open_insert_for_authenticated_live_messages" ON public.live_messages;
DROP POLICY IF EXISTS "open_update_for_authenticated_live_messages" ON public.live_messages;

DROP POLICY IF EXISTS "open_delete_for_authenticated_teachers" ON public.teachers;
DROP POLICY IF EXISTS "open_insert_for_authenticated_teachers" ON public.teachers;
DROP POLICY IF EXISTS "open_update_for_authenticated_teachers" ON public.teachers;

-- ── user_progress / student_checklists ── ALL(true) eram as ÚNICAS
-- policies e a tabela estava com RLS desligada — dupla exposição.
DROP POLICY IF EXISTS "Acesso Total" ON public.user_progress;
DROP POLICY IF EXISTS "Acesso Demo" ON public.user_progress;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia proprio progresso" ON public.user_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff le todo progresso" ON public.user_progress
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')));

DROP POLICY IF EXISTS "Acesso Demo" ON public.student_checklists;
ALTER TABLE public.student_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia proprio checklist" ON public.student_checklists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff gerencia checklist de qualquer aluno" ON public.student_checklists
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')));

-- ── activity_logs ── já tinha SELECT correto (dono ou admin), mas
-- RLS estava desligada e não existia policy de INSERT nenhuma — o
-- app grava logs a partir do client, então precisa de uma policy
-- de escrita própria para não quebrar ao ligar a RLS.
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario insere proprio log" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── forum_bans / classes / library_items / subjects ── já tinham
-- policies corretas, só precisavam ligar a RLS.
ALTER TABLE public.forum_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- ── simulation_attempts ── só tinha as policies abertas; troca por
-- aluno dono da tentativa + staff/professor lê tudo.
DROP POLICY IF EXISTS "open_delete_for_authenticated_simulation_attempts" ON public.simulation_attempts;
DROP POLICY IF EXISTS "open_insert_for_authenticated_simulation_attempts" ON public.simulation_attempts;
DROP POLICY IF EXISTS "open_select_for_authenticated_simulation_attempts" ON public.simulation_attempts;
DROP POLICY IF EXISTS "open_update_for_authenticated_simulation_attempts" ON public.simulation_attempts;
CREATE POLICY "Aluno gerencia propria tentativa" ON public.simulation_attempts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff le todas as tentativas" ON public.simulation_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')));

-- ── scheduled_lives ── leitura ampla (agenda de aulas ao vivo é
-- pra todo mundo ver), escrita só staff/professor host.
DROP POLICY IF EXISTS "open_delete_for_authenticated_scheduled_lives" ON public.scheduled_lives;
DROP POLICY IF EXISTS "open_insert_for_authenticated_scheduled_lives" ON public.scheduled_lives;
DROP POLICY IF EXISTS "open_select_for_authenticated_scheduled_lives" ON public.scheduled_lives;
DROP POLICY IF EXISTS "open_update_for_authenticated_scheduled_lives" ON public.scheduled_lives;
CREATE POLICY "Autenticados leem agenda de lives" ON public.scheduled_lives
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff e host gerenciam lives agendadas" ON public.scheduled_lives
  FOR ALL TO authenticated
  USING (auth.uid() = host_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')))
  WITH CHECK (auth.uid() = host_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')));

-- ── materials ── leitura ampla (materiais de estudo), escrita só staff.
DROP POLICY IF EXISTS "open_delete_for_authenticated_materials" ON public.materials;
DROP POLICY IF EXISTS "open_insert_for_authenticated_materials" ON public.materials;
DROP POLICY IF EXISTS "open_select_for_authenticated_materials" ON public.materials;
DROP POLICY IF EXISTS "open_update_for_authenticated_materials" ON public.materials;
CREATE POLICY "Autenticados leem materiais" ON public.materials
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff gerencia materiais" ON public.materials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff', 'teacher')));

-- ── invitations ── tokens de convite não podem ser listáveis por
-- qualquer autenticado (permitiria roubar convite pendente). Fluxo
-- de convite deste app já é todo server-side (service role), então
-- fecha para admin/staff apenas.
DROP POLICY IF EXISTS "open_delete_for_authenticated_invitations" ON public.invitations;
DROP POLICY IF EXISTS "open_insert_for_authenticated_invitations" ON public.invitations;
DROP POLICY IF EXISTS "open_select_for_authenticated_invitations" ON public.invitations;
DROP POLICY IF EXISTS "open_update_for_authenticated_invitations" ON public.invitations;
CREATE POLICY "Staff gerencia convites" ON public.invitations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin', 'staff')));

-- ── chat_messages / dev_meta ── sem nenhuma linha de dado e sem
-- nenhuma referência no código do app (grep confirma) — não usadas
-- pelo client. Remove todo acesso do client; só service role acessa.
DROP POLICY IF EXISTS "open_delete_for_authenticated_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "open_insert_for_authenticated_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "open_select_for_authenticated_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "open_update_for_authenticated_chat_messages" ON public.chat_messages;

DROP POLICY IF EXISTS "open_delete_for_authenticated_dev_meta" ON public.dev_meta;
DROP POLICY IF EXISTS "open_insert_for_authenticated_dev_meta" ON public.dev_meta;
DROP POLICY IF EXISTS "open_select_for_authenticated_dev_meta" ON public.dev_meta;
DROP POLICY IF EXISTS "open_update_for_authenticated_dev_meta" ON public.dev_meta;
