-- Migração gerada a partir das diferenças do banco de dados remoto (3 migrações órfãs).
-- Esta migração sincroniza o schema local com o remoto, adicionando as tabelas e colunas faltantes.

﻿create extension if not exists "hypopg" with schema "extensions" version '1.4.1';

create table "public"."activity_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "user_name" text,
    "action" text not null,
    "entity_type" text,
    "entity_id" uuid,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

create table "public"."chat_messages" (
    "id" uuid not null default gen_random_uuid(),
    "sender_id" uuid,
    "receiver_id" text,
    "message" text,
    "file_name" text,
    "file_type" text,
    "file_url" text,
    "is_read" boolean default false,
    "created_at" timestamp with time zone default now()
);

alter table "public"."chat_messages" enable row level security;

create table "public"."dev_meta" (
    "key" text not null,
    "value" jsonb,
    "created_at" timestamp with time zone default now()
);

alter table "public"."dev_meta" enable row level security;

create table "public"."direct_messages" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "sender_id" uuid,
    "receiver_id" uuid,
    "content" text not null,
    "is_read" boolean default false
);

alter table "public"."direct_messages" enable row level security;

create table "public"."essay_submissions_competencies_placeholder" (
    "id" uuid not null default gen_random_uuid()
);

alter table "public"."essay_submissions_competencies_placeholder" enable row level security;

create table "public"."essay_weekly_themes" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "source" text,
    "target" text default 'all'::text,
    "week_start" date not null,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
);

alter table "public"."essay_weekly_themes" enable row level security;

create table "public"."essays" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "theme" text not null,
    "content" text not null,
    "status" text not null default 'submitted'::text,
    "grade" real,
    "feedback" text,
    "student_id" uuid not null,
    "grader_id" uuid
);

alter table "public"."essays" enable row level security;

create table "public"."flashcard_progress" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "question_id" uuid not null,
    "ease_factor" double precision default 2.5,
    "interval_days" integer default 1,
    "repetitions" integer default 0,
    "next_review" date default CURRENT_DATE,
    "last_reviewed" timestamp with time zone
);

alter table "public"."flashcard_progress" enable row level security;

create table "public"."forum_bans" (
    "id" uuid not null default gen_random_uuid(),
    "forum_id" uuid,
    "user_id" uuid,
    "created_at" timestamp with time zone default now()
);

create table "public"."forum_posts" (
    "id" uuid not null default gen_random_uuid(),
    "forum_id" text not null,
    "author_id" uuid,
    "author_name" text,
    "content" text not null,
    "is_question" boolean default false,
    "is_answered" boolean default false,
    "created_at" timestamp with time zone default now()
);

alter table "public"."forum_posts" enable row level security;

create table "public"."forum_replies" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "thread_id" uuid not null,
    "content" text not null,
    "author_id" uuid
);

alter table "public"."forum_replies" enable row level security;

create table "public"."forum_threads" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "title" text not null,
    "content" text,
    "category" text,
    "author_id" uuid
);

alter table "public"."forum_threads" enable row level security;

create table "public"."forums" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "category" text,
    "author_id" uuid,
    "author_name" text,
    "created_at" timestamp with time zone default now(),
    "is_teacher_only" boolean default false
);

alter table "public"."forums" enable row level security;

create table "public"."guardian_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid not null,
    "token" text not null,
    "created_at" timestamp with time zone default now()
);

alter table "public"."guardian_tokens" enable row level security;

create table "public"."invitations" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "token" uuid not null default gen_random_uuid(),
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "used" boolean not null default false,
    "meta" jsonb default '{}'::jsonb
);

alter table "public"."invitations" enable row level security;

create table "public"."learning_contents" (
    "id" uuid not null default gen_random_uuid(),
    "module_id" uuid not null,
    "title" text not null,
    "type" text not null,
    "url" text,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "order_index" integer default 0,
    "workbook_id" uuid
);

alter table "public"."learning_contents" enable row level security;

create table "public"."learning_modules" (
    "id" uuid not null default gen_random_uuid(),
    "trail_id" uuid not null,
    "title" text not null,
    "order_index" integer default 0,
    "created_at" timestamp with time zone default now()
);

create table "public"."learning_trails" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "category" text,
    "teacher_id" uuid,
    "teacher_name" text,
    "status" text default 'draft'::text,
    "image_url" text,
    "created_at" timestamp with time zone default now()
);

create table "public"."library_items" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "title" text not null,
    "description" text,
    "category" text,
    "item_type" text not null,
    "url" text not null,
    "author_id" uuid
);

create table "public"."library_resources" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone default now(),
    "title" text not null,
    "category" text,
    "type" text,
    "url" text,
    "image_url" text,
    "description" text,
    "target_audience" text default 'all'::text
);

alter table "public"."library_resources" enable row level security;

create table "public"."live_messages" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone default now(),
    "live_id" uuid,
    "user_id" uuid,
    "user_name" text,
    "content" text not null,
    "is_question" boolean default false,
    "is_answered" boolean default false
);

alter table "public"."live_messages" enable row level security;

create table "public"."matérias" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "content" text,
    "owner_id" uuid not null,
    "created_at" timestamp with time zone default now()
);

alter table "public"."matérias" enable row level security;

create table "public"."material_annotations" (
    "id" bigint generated by default as identity not null,
    "user_id" bigint not null,
    "material_id" bigint not null,
    "drawing_data" jsonb default '{}'::jsonb,
    "percentage_explored" integer default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);

alter table "public"."material_annotations" enable row level security;

create table "public"."materials" (
    "id" bigint generated by default as identity not null,
    "title" text not null default ''::text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);

alter table "public"."materials" enable row level security;

create table "public"."modules" (
    "id" uuid not null default uuid_generate_v4(),
    "trail_id" uuid,
    "title" text not null,
    "order_index" integer default 0
);

alter table "public"."modules" enable row level security;

create table "public"."notices" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "content" text,
    "priority" text default 'normal'::text,
    "author" text,
    "read_by" uuid[] default '{}'::uuid[],
    "created_at" timestamp with time zone default now()
);

create table "public"."otp_codes" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "code" text not null,
    "created_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone not null
);

alter table "public"."otp_codes" enable row level security;

create table "public"."questões" (
    "id" uuid not null default gen_random_uuid(),
    "mat??ria_id" uuid not null,
    "question" text not null,
    "answer" text,
    "owner_id" uuid not null,
    "created_at" timestamp with time zone default now()
);

alter table "public"."questões" enable row level security;

create table "public"."quiz_submissions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "content_id" uuid,
    "score" integer,
    "total" integer,
    "created_at" timestamp with time zone default now()
);

create table "public"."simulation_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "subject_id" uuid,
    "score" integer not null,
    "total_questions" integer not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);

alter table "public"."simulation_attempts" enable row level security;

create table "public"."student_checklists" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "item_id" text not null,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

create table "public"."teachers" (
    "id" uuid not null,
    "name" text,
    "email" text,
    "subjects" text,
    "last_access" timestamp with time zone default now(),
    "auth_user_id" uuid
);

alter table "public"."teachers" enable row level security;

create table "public"."trail_contents" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "module_id" uuid not null,
    "title" text not null,
    "content_type" text not null,
    "url" text,
    "description" text,
    "content_order" integer not null default 0
);

alter table "public"."trail_contents" enable row level security;

create table "public"."trail_modules" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "trail_id" uuid not null,
    "title" text not null,
    "module_order" integer not null default 0
);

alter table "public"."trail_modules" enable row level security;

create table "public"."user_progress" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "trail_id" uuid not null,
    "percentage" integer default 0,
    "last_accessed" timestamp with time zone default timezone('utc'::text, now())
);

alter table "public"."essay_submissions" add column "is_public" boolean default false;

alter table "public"."essay_submissions" add column "week_theme_id" uuid;

alter table "public"."essay_submissions" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."essay_submissions" alter column "score" set not null;

alter table "public"."essay_submissions" alter column "user_id" drop not null;

alter table "public"."exams" add column "difficulty_level" text;

alter table "public"."exams" add column "gabarito_comentado_url" text;

alter table "public"."exams" add column "gabarito_url" text;

alter table "public"."lives" add column "meeting_url" text;

alter table "public"."lives" enable row level security;

alter table "public"."notes" alter column "title" set default 'Sem t??tulo'::text;

alter table "public"."profiles" enable row level security;

alter table "public"."questions" alter column "subject_id" drop not null;

alter table "public"."report_card_entries" add column "imported_at" timestamp with time zone default now();

alter table "public"."report_card_entries" add column "source_file" text;

alter table "public"."scheduled_lives" alter column "status" set not null;

alter table "public"."subjects" disable row level security;

alter table "public"."weekly_missions" alter column "icon" set default '????'::text;

CREATE UNIQUE INDEX audit_log_entries_pkey ON auth.audit_log_entries USING btree (id);

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);

CREATE UNIQUE INDEX instances_pkey ON auth.instances USING btree (id);

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);

CREATE UNIQUE INDEX refresh_tokens_pkey ON auth.refresh_tokens USING btree (id);

CREATE INDEX refresh_tokens_token_idx ON auth.refresh_tokens USING btree (token);

CREATE UNIQUE INDEX schema_migrations_pkey ON auth.schema_migrations USING btree (version);

CREATE UNIQUE INDEX users_email_key ON auth.users USING btree (email);

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, email);

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);

CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id);

CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE UNIQUE INDEX dev_meta_pkey ON public.dev_meta USING btree (key);

CREATE UNIQUE INDEX direct_messages_pkey ON public.direct_messages USING btree (id);

CREATE UNIQUE INDEX essay_submissions_competencies_placeholder_pkey ON public.essay_submissions_competencies_placeholder USING btree (id);

CREATE UNIQUE INDEX essay_weekly_themes_pkey ON public.essay_weekly_themes USING btree (id);

CREATE UNIQUE INDEX essays_pkey ON public.essays USING btree (id);

CREATE UNIQUE INDEX flashcard_progress_pkey ON public.flashcard_progress USING btree (id);

CREATE UNIQUE INDEX flashcard_progress_student_id_question_id_key ON public.flashcard_progress USING btree (student_id, question_id);

CREATE UNIQUE INDEX forum_bans_forum_id_user_id_key ON public.forum_bans USING btree (forum_id, user_id);

CREATE UNIQUE INDEX forum_bans_pkey ON public.forum_bans USING btree (id);

CREATE UNIQUE INDEX forum_posts_pkey ON public.forum_posts USING btree (id);

CREATE UNIQUE INDEX forum_replies_pkey ON public.forum_replies USING btree (id);

CREATE UNIQUE INDEX forum_threads_pkey ON public.forum_threads USING btree (id);

CREATE UNIQUE INDEX forums_pkey ON public.forums USING btree (id);

CREATE UNIQUE INDEX guardian_tokens_pkey ON public.guardian_tokens USING btree (id);

CREATE UNIQUE INDEX guardian_tokens_token_key ON public.guardian_tokens USING btree (token);

CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages USING btree (sender_id);

CREATE INDEX idx_classes_coordinator_id ON public.classes USING btree (coordinator_id);

CREATE INDEX idx_direct_messages_receiver ON public.direct_messages USING btree (receiver_id);

CREATE INDEX idx_direct_messages_sender ON public.direct_messages USING btree (sender_id);

CREATE INDEX idx_essay_submissions_competencies_gin ON public.essay_submissions USING gin (competencies);

CREATE INDEX idx_essay_submissions_user_id ON public.essay_submissions USING btree (user_id);

CREATE INDEX idx_essay_themes_week ON public.essay_weekly_themes USING btree (week_start, target);

CREATE INDEX idx_essays_grader_id ON public.essays USING btree (grader_id);

CREATE INDEX idx_essays_student_id ON public.essays USING btree (student_id);

CREATE INDEX idx_flashcard_student_review ON public.flashcard_progress USING btree (student_id, next_review);

CREATE INDEX idx_forum_replies_author_id ON public.forum_replies USING btree (author_id);

CREATE INDEX idx_forum_replies_thread_id ON public.forum_replies USING btree (thread_id);

CREATE INDEX idx_forum_threads_author_id ON public.forum_threads USING btree (author_id);

CREATE INDEX idx_forums_author_id ON public.forums USING btree (author_id);

CREATE INDEX idx_learning_contents_module_id ON public.learning_contents USING btree (module_id);

CREATE INDEX idx_learning_contents_order_index ON public.learning_contents USING btree (order_index);

CREATE INDEX idx_learning_modules_trail_id ON public.learning_modules USING btree (trail_id);

CREATE INDEX idx_library_items_author_id ON public.library_items USING btree (author_id);

CREATE INDEX idx_lives_teacher_id ON public.lives USING btree (teacher_id);

CREATE INDEX idx_material_annotations_material_id ON public.material_annotations USING btree (material_id);

CREATE INDEX idx_material_annotations_user_id ON public.material_annotations USING btree (user_id);

CREATE INDEX idx_materias_owner ON public."matérias" USING btree (owner_id);

CREATE INDEX idx_modules_trail_id ON public.modules USING btree (trail_id);

CREATE UNIQUE INDEX idx_profiles_email_unique ON public.profiles USING btree (email) WHERE (email IS NOT NULL);

CREATE INDEX idx_questions_subject_id ON public.questions USING btree (subject_id);

CREATE INDEX idx_questions_teacher_id ON public.questions USING btree (teacher_id);

CREATE INDEX idx_questoes_materia ON public."questões" USING btree ("mat??ria_id");

CREATE INDEX idx_questoes_owner ON public."questões" USING btree (owner_id);

CREATE INDEX idx_quiz_submissions_content_id ON public.quiz_submissions USING btree (content_id);

CREATE INDEX idx_quiz_submissions_user_id ON public.quiz_submissions USING btree (user_id);

CREATE INDEX idx_report_card_student ON public.report_card_entries USING btree (student_id);

CREATE INDEX idx_report_card_track ON public.report_card_entries USING btree (track);

CREATE INDEX idx_scheduled_lives_host_id ON public.scheduled_lives USING btree (host_id);

CREATE INDEX idx_scheduled_lives_scheduled_at ON public.scheduled_lives USING btree (scheduled_at);

CREATE INDEX idx_simulation_attempts_subject_id ON public.simulation_attempts USING btree (subject_id);

CREATE INDEX idx_simulation_attempts_user_id ON public.simulation_attempts USING btree (user_id);

CREATE INDEX idx_student_answers_student_question ON public.student_question_answers USING btree (student_id, question_id);

CREATE INDEX idx_student_checklists_user_id ON public.student_checklists USING btree (user_id);

CREATE INDEX idx_trail_contents_module_id ON public.trail_contents USING btree (module_id);

CREATE INDEX idx_trail_modules_trail_id ON public.trail_modules USING btree (trail_id);

CREATE INDEX idx_trails_author_id ON public.trails USING btree (author_id);

CREATE INDEX idx_trails_teacher_id ON public.trails USING btree (teacher_id);

CREATE INDEX idx_user_progress_user_trail ON public.user_progress USING btree (user_id, trail_id);

CREATE UNIQUE INDEX invitations_pkey ON public.invitations USING btree (id);

CREATE UNIQUE INDEX learning_contents_pkey ON public.learning_contents USING btree (id);

CREATE UNIQUE INDEX learning_modules_pkey ON public.learning_modules USING btree (id);

CREATE UNIQUE INDEX learning_trails_pkey ON public.learning_trails USING btree (id);

CREATE UNIQUE INDEX library_items_pkey ON public.library_items USING btree (id);

CREATE UNIQUE INDEX library_resources_pkey ON public.library_resources USING btree (id);

CREATE UNIQUE INDEX live_messages_pkey ON public.live_messages USING btree (id);

CREATE UNIQUE INDEX "matérias_pkey" ON public."matérias" USING btree (id);

CREATE UNIQUE INDEX material_annotations_pkey ON public.material_annotations USING btree (id);

CREATE UNIQUE INDEX material_annotations_user_material_unique ON public.material_annotations USING btree (user_id, material_id);

CREATE UNIQUE INDEX materials_pkey ON public.materials USING btree (id);

CREATE UNIQUE INDEX modules_pkey ON public.modules USING btree (id);

CREATE UNIQUE INDEX notices_pkey ON public.notices USING btree (id);

CREATE UNIQUE INDEX otp_codes_email_key ON public.otp_codes USING btree (email);

CREATE UNIQUE INDEX otp_codes_pkey ON public.otp_codes USING btree (id);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);

CREATE INDEX profiles_institution_idx ON public.profiles USING btree (institution);

CREATE UNIQUE INDEX "questões_pkey" ON public."questões" USING btree (id);

CREATE UNIQUE INDEX quiz_submissions_pkey ON public.quiz_submissions USING btree (id);

CREATE UNIQUE INDEX report_card_entries_student_id_semester_key ON public.report_card_entries USING btree (student_id, semester);

CREATE UNIQUE INDEX simulation_attempts_pkey ON public.simulation_attempts USING btree (id);

CREATE UNIQUE INDEX student_checklists_pkey ON public.student_checklists USING btree (id);

CREATE UNIQUE INDEX student_checklists_user_id_item_id_key ON public.student_checklists USING btree (user_id, item_id);

CREATE UNIQUE INDEX teachers_auth_user_id_unique ON public.teachers USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);

CREATE UNIQUE INDEX teachers_pkey ON public.teachers USING btree (id);

CREATE UNIQUE INDEX trail_contents_pkey ON public.trail_contents USING btree (id);

CREATE UNIQUE INDEX trail_modules_pkey ON public.trail_modules USING btree (id);

CREATE UNIQUE INDEX user_progress_pkey ON public.user_progress USING btree (id);

CREATE UNIQUE INDEX user_progress_user_id_trail_id_key ON public.user_progress USING btree (user_id, trail_id);

alter table "public"."activity_logs" add constraint "activity_logs_pkey" PRIMARY KEY using index "activity_logs_pkey";

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";

alter table "public"."dev_meta" add constraint "dev_meta_pkey" PRIMARY KEY using index "dev_meta_pkey";

alter table "public"."direct_messages" add constraint "direct_messages_pkey" PRIMARY KEY using index "direct_messages_pkey";

alter table "public"."essay_submissions_competencies_placeholder" add constraint "essay_submissions_competencies_placeholder_pkey" PRIMARY KEY using index "essay_submissions_competencies_placeholder_pkey";

alter table "public"."essay_weekly_themes" add constraint "essay_weekly_themes_pkey" PRIMARY KEY using index "essay_weekly_themes_pkey";

alter table "public"."essays" add constraint "essays_pkey" PRIMARY KEY using index "essays_pkey";

alter table "public"."flashcard_progress" add constraint "flashcard_progress_pkey" PRIMARY KEY using index "flashcard_progress_pkey";

alter table "public"."forum_bans" add constraint "forum_bans_pkey" PRIMARY KEY using index "forum_bans_pkey";

alter table "public"."forum_posts" add constraint "forum_posts_pkey" PRIMARY KEY using index "forum_posts_pkey";

alter table "public"."forum_replies" add constraint "forum_replies_pkey" PRIMARY KEY using index "forum_replies_pkey";

alter table "public"."forum_threads" add constraint "forum_threads_pkey" PRIMARY KEY using index "forum_threads_pkey";

alter table "public"."forums" add constraint "forums_pkey" PRIMARY KEY using index "forums_pkey";

alter table "public"."guardian_tokens" add constraint "guardian_tokens_pkey" PRIMARY KEY using index "guardian_tokens_pkey";

alter table "public"."invitations" add constraint "invitations_pkey" PRIMARY KEY using index "invitations_pkey";

alter table "public"."learning_contents" add constraint "learning_contents_pkey" PRIMARY KEY using index "learning_contents_pkey";

alter table "public"."learning_modules" add constraint "learning_modules_pkey" PRIMARY KEY using index "learning_modules_pkey";

alter table "public"."learning_trails" add constraint "learning_trails_pkey" PRIMARY KEY using index "learning_trails_pkey";

alter table "public"."library_items" add constraint "library_items_pkey" PRIMARY KEY using index "library_items_pkey";

alter table "public"."library_resources" add constraint "library_resources_pkey" PRIMARY KEY using index "library_resources_pkey";

alter table "public"."live_messages" add constraint "live_messages_pkey" PRIMARY KEY using index "live_messages_pkey";

alter table "public"."matérias" add constraint "matérias_pkey" PRIMARY KEY using index "matérias_pkey";

alter table "public"."material_annotations" add constraint "material_annotations_pkey" PRIMARY KEY using index "material_annotations_pkey";

alter table "public"."materials" add constraint "materials_pkey" PRIMARY KEY using index "materials_pkey";

alter table "public"."modules" add constraint "modules_pkey" PRIMARY KEY using index "modules_pkey";

alter table "public"."notices" add constraint "notices_pkey" PRIMARY KEY using index "notices_pkey";

alter table "public"."otp_codes" add constraint "otp_codes_pkey" PRIMARY KEY using index "otp_codes_pkey";

alter table "public"."questões" add constraint "questões_pkey" PRIMARY KEY using index "questões_pkey";

alter table "public"."quiz_submissions" add constraint "quiz_submissions_pkey" PRIMARY KEY using index "quiz_submissions_pkey";

alter table "public"."simulation_attempts" add constraint "simulation_attempts_pkey" PRIMARY KEY using index "simulation_attempts_pkey";

alter table "public"."student_checklists" add constraint "student_checklists_pkey" PRIMARY KEY using index "student_checklists_pkey";

alter table "public"."teachers" add constraint "teachers_pkey" PRIMARY KEY using index "teachers_pkey";

alter table "public"."trail_contents" add constraint "trail_contents_pkey" PRIMARY KEY using index "trail_contents_pkey";

alter table "public"."trail_modules" add constraint "trail_modules_pkey" PRIMARY KEY using index "trail_modules_pkey";

alter table "public"."user_progress" add constraint "user_progress_pkey" PRIMARY KEY using index "user_progress_pkey";

alter table "public"."activity_logs" add constraint "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_user_id_fkey";

alter table "public"."announcements" add constraint "announcements_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) not valid;

alter table "public"."announcements" validate constraint "announcements_author_id_fkey";

alter table "public"."announcements" add constraint "announcements_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."announcements" validate constraint "announcements_priority_check";

alter table "public"."chat_messages" add constraint "chat_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES users(id) not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_sender_id_fkey";

alter table "public"."direct_messages" add constraint "direct_messages_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_receiver_id_fkey";

alter table "public"."direct_messages" add constraint "direct_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_sender_id_fkey";

alter table "public"."essay_submissions" add constraint "essay_submissions_score_check" CHECK (((score >= 0) AND (score <= 100))) not valid;

alter table "public"."essay_submissions" validate constraint "essay_submissions_score_check";

alter table "public"."essay_submissions" add constraint "essay_submissions_week_theme_id_fkey" FOREIGN KEY (week_theme_id) REFERENCES essay_weekly_themes(id) not valid;

alter table "public"."essay_submissions" validate constraint "essay_submissions_week_theme_id_fkey";

alter table "public"."essay_weekly_themes" add constraint "essay_weekly_themes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) not valid;

alter table "public"."essay_weekly_themes" validate constraint "essay_weekly_themes_created_by_fkey";

alter table "public"."essay_weekly_themes" add constraint "essay_weekly_themes_target_check" CHECK ((target = ANY (ARRAY['all'::text, 'enem'::text, 'etec'::text]))) not valid;

alter table "public"."essay_weekly_themes" validate constraint "essay_weekly_themes_target_check";

alter table "public"."essays" add constraint "essays_grader_id_fkey" FOREIGN KEY (grader_id) REFERENCES profiles(id) ON DELETE SET NULL not valid;

alter table "public"."essays" validate constraint "essays_grader_id_fkey";

alter table "public"."essays" add constraint "essays_student_id_fkey" FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."essays" validate constraint "essays_student_id_fkey";

alter table "public"."exams" add constraint "exams_difficulty_level_check" CHECK ((difficulty_level = ANY (ARRAY['facil'::text, 'medio'::text, 'dificil'::text]))) not valid;

alter table "public"."exams" validate constraint "exams_difficulty_level_check";

alter table "public"."flashcard_progress" add constraint "flashcard_progress_question_id_fkey" FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE not valid;

alter table "public"."flashcard_progress" validate constraint "flashcard_progress_question_id_fkey";

alter table "public"."flashcard_progress" add constraint "flashcard_progress_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."flashcard_progress" validate constraint "flashcard_progress_student_id_fkey";

alter table "public"."flashcard_progress" add constraint "flashcard_progress_student_id_question_id_key" UNIQUE using index "flashcard_progress_student_id_question_id_key";

alter table "public"."forum_bans" add constraint "forum_bans_forum_id_fkey" FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE not valid;

alter table "public"."forum_bans" validate constraint "forum_bans_forum_id_fkey";

alter table "public"."forum_bans" add constraint "forum_bans_forum_id_user_id_key" UNIQUE using index "forum_bans_forum_id_user_id_key";

alter table "public"."forum_bans" add constraint "forum_bans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."forum_bans" validate constraint "forum_bans_user_id_fkey";

alter table "public"."forum_replies" add constraint "forum_replies_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL not valid;

alter table "public"."forum_replies" validate constraint "forum_replies_author_id_fkey";

alter table "public"."forum_replies" add constraint "forum_replies_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE not valid;

alter table "public"."forum_replies" validate constraint "forum_replies_thread_id_fkey";

alter table "public"."forum_threads" add constraint "forum_threads_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL not valid;

alter table "public"."forum_threads" validate constraint "forum_threads_author_id_fkey";

alter table "public"."forums" add constraint "forums_author_id_fkey" FOREIGN KEY (author_id) REFERENCES users(id) not valid;

alter table "public"."forums" validate constraint "forums_author_id_fkey";

alter table "public"."guardian_tokens" add constraint "guardian_tokens_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."guardian_tokens" validate constraint "guardian_tokens_student_id_fkey";

alter table "public"."guardian_tokens" add constraint "guardian_tokens_token_key" UNIQUE using index "guardian_tokens_token_key";

alter table "public"."learning_contents" add constraint "learning_contents_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE not valid;

alter table "public"."learning_contents" validate constraint "learning_contents_module_id_fkey";

alter table "public"."learning_contents" add constraint "learning_contents_workbook_id_fkey" FOREIGN KEY (workbook_id) REFERENCES library_resources(id) ON DELETE SET NULL not valid;

alter table "public"."learning_contents" validate constraint "learning_contents_workbook_id_fkey";

alter table "public"."learning_modules" add constraint "learning_modules_trail_id_fkey" FOREIGN KEY (trail_id) REFERENCES learning_trails(id) ON DELETE CASCADE not valid;

alter table "public"."learning_modules" validate constraint "learning_modules_trail_id_fkey";

alter table "public"."library_items" add constraint "library_items_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL not valid;

alter table "public"."library_items" validate constraint "library_items_author_id_fkey";

alter table "public"."live_messages" add constraint "live_messages_live_id_fkey" FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE not valid;

alter table "public"."live_messages" validate constraint "live_messages_live_id_fkey";

alter table "public"."live_messages" add constraint "live_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) not valid;

alter table "public"."live_messages" validate constraint "live_messages_user_id_fkey";

alter table "public"."material_annotations" add constraint "check_percentage_explored" CHECK (((percentage_explored >= 0) AND (percentage_explored <= 100))) not valid;

alter table "public"."material_annotations" validate constraint "check_percentage_explored";

alter table "public"."material_annotations" add constraint "fk_material" FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE not valid;

alter table "public"."material_annotations" validate constraint "fk_material";

alter table "public"."material_annotations" add constraint "material_annotations_user_material_unique" UNIQUE using index "material_annotations_user_material_unique";

alter table "public"."modules" add constraint "modules_trail_id_fkey" FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE not valid;

alter table "public"."modules" validate constraint "modules_trail_id_fkey";

alter table "public"."otp_codes" add constraint "otp_codes_email_key" UNIQUE using index "otp_codes_email_key";

alter table "public"."profiles" add constraint "profiles_email_key" UNIQUE using index "profiles_email_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."questões" add constraint "questões_mat??ria_id_fkey" FOREIGN KEY ("mat??ria_id") REFERENCES "matérias"(id) ON DELETE CASCADE not valid;

alter table "public"."questões" validate constraint "questões_mat??ria_id_fkey";

alter table "public"."questions" add constraint "questions_correct_answer_check" CHECK ((correct_answer = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text]))) not valid;

alter table "public"."questions" validate constraint "questions_correct_answer_check";

alter table "public"."questions" add constraint "questions_options_structure_check" CHECK (validate_question_options(options)) not valid;

alter table "public"."questions" validate constraint "questions_options_structure_check";

alter table "public"."questions" add constraint "questions_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL not valid;

alter table "public"."questions" validate constraint "questions_teacher_id_fkey";

alter table "public"."quiz_submissions" add constraint "quiz_submissions_content_id_fkey" FOREIGN KEY (content_id) REFERENCES learning_contents(id) not valid;

alter table "public"."quiz_submissions" validate constraint "quiz_submissions_content_id_fkey";

alter table "public"."quiz_submissions" add constraint "quiz_submissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) not valid;

alter table "public"."quiz_submissions" validate constraint "quiz_submissions_user_id_fkey";

alter table "public"."report_card_entries" add constraint "report_card_entries_semester_check" CHECK ((semester = ANY (ARRAY[1, 2]))) not valid;

alter table "public"."report_card_entries" validate constraint "report_card_entries_semester_check";

alter table "public"."report_card_entries" add constraint "report_card_entries_student_id_semester_key" UNIQUE using index "report_card_entries_student_id_semester_key";

alter table "public"."scheduled_lives" add constraint "fk_host" FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE SET NULL not valid;

alter table "public"."scheduled_lives" validate constraint "fk_host";

alter table "public"."simulation_attempts" add constraint "simulation_attempts_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL not valid;

alter table "public"."simulation_attempts" validate constraint "simulation_attempts_subject_id_fkey";

alter table "public"."simulation_attempts" add constraint "simulation_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."simulation_attempts" validate constraint "simulation_attempts_user_id_fkey";

alter table "public"."student_checklists" add constraint "student_checklists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."student_checklists" validate constraint "student_checklists_user_id_fkey";

alter table "public"."student_checklists" add constraint "student_checklists_user_id_item_id_key" UNIQUE using index "student_checklists_user_id_item_id_key";

alter table "public"."teachers" add constraint "teachers_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."teachers" validate constraint "teachers_auth_user_id_fkey";

alter table "public"."trail_contents" add constraint "trail_contents_module_id_fkey" FOREIGN KEY (module_id) REFERENCES trail_modules(id) ON DELETE CASCADE not valid;

alter table "public"."trail_contents" validate constraint "trail_contents_module_id_fkey";

alter table "public"."trail_modules" add constraint "trail_modules_trail_id_fkey" FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE not valid;

alter table "public"."trail_modules" validate constraint "trail_modules_trail_id_fkey";

alter table "public"."trails" add constraint "trails_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL not valid;

alter table "public"."trails" validate constraint "trails_author_id_fkey";

alter table "public"."trails" add constraint "trails_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES users(id) not valid;

alter table "public"."trails" validate constraint "trails_teacher_id_fkey";

alter table "public"."user_progress" add constraint "user_progress_trail_id_fkey" FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE not valid;

alter table "public"."user_progress" validate constraint "user_progress_trail_id_fkey";

alter table "public"."user_progress" add constraint "user_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."user_progress" validate constraint "user_progress_user_id_fkey";

alter table "public"."user_progress" add constraint "user_progress_user_id_trail_id_key" UNIQUE using index "user_progress_user_id_trail_id_key";

alter table "public"."classes" add constraint "classes_coordinator_id_fkey" FOREIGN KEY (coordinator_id) REFERENCES profiles(id) not valid;

alter table "public"."classes" validate constraint "classes_coordinator_id_fkey";

alter table "public"."questions" add constraint "questions_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES subjects(id) not valid;

alter table "public"."questions" validate constraint "questions_subject_id_fkey";

alter table "public"."report_card_entries" add constraint "report_card_entries_student_id_fkey" FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."report_card_entries" validate constraint "report_card_entries_student_id_fkey";

alter table "public"."student_question_answers" add constraint "student_question_answers_question_id_fkey" FOREIGN KEY (question_id) REFERENCES questions(id) not valid;

alter table "public"."student_question_answers" validate constraint "student_question_answers_question_id_fkey";

set check_function_bodies = off;

create type "net"."http_response" as ("status_code" integer, "headers" jsonb, "body" text);

create type "net"."http_response_result" as ("status" net.request_status, "message" text, "response" net.http_response);

CREATE OR REPLACE FUNCTION public.force_reset_password(target_email text, new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

v_old_role TEXT;

v_old_profile_type TEXT;

v_profile_exists BOOLEAN;

BEGIN

  -- 1. Capturar o cargo atual

  SELECT role::text, profile_type INTO v_old_role, v_old_profile_type

  FROM public.profiles

  WHERE lower(email) = lower(target_email)

  LIMIT 1;

-- 2. Purgar registros fantasmas

  DELETE FROM auth.identities WHERE user_id IN (

    SELECT id FROM auth.users WHERE lower(email) = lower(target_email)

  );

DELETE FROM auth.users WHERE lower(email) = lower(target_email);

-- 3. Criar usu??rio limpo

  v_user_id := gen_random_uuid();

INSERT INTO auth.users (

    id, instance_id, aud, role, email, 

    encrypted_password, email_confirmed_at,

    confirmation_token, recovery_token, email_change, 

    email_change_token_new, email_change_token_current,

    reauthentication_token,

    raw_app_meta_data, raw_user_meta_data,

    is_super_admin, created_at, updated_at,

    is_sso_user

  ) VALUES (

    v_user_id,

    '00000000-0000-0000-0000-000000000000',

    'authenticated',

    'authenticated',

    lower(target_email),

    crypt(new_password, gen_salt('bf')),

    now(),

    '', '', '', '', '', '',

    '{"provider": "email", "providers": ["email"]}'::jsonb,

    '{"must_change_password": false}'::jsonb,

    false,

    now(), now(),

    false

  );

-- 4. Criar identidade

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)

  VALUES (

    gen_random_uuid(),

    v_user_id,

    v_user_id::text,

    'email',

    jsonb_build_object('sub', v_user_id::text, 'email', lower(target_email), 'email_verified', true, 'phone_verified', false),

    now(), now(), now()

  );

-- 5. Vincular ou Atualizar o profile (L??gica segura sem ON CONFLICT)

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE lower(email) = lower(target_email)) INTO v_profile_exists;

IF v_profile_exists THEN

    UPDATE public.profiles 

    SET id = v_user_id,

        role = COALESCE(v_old_role, 'teacher')::user_role, -- For??a 'teacher' por seguran??a nesta lista

        profile_type = COALESCE(v_old_profile_type, 'teacher')

    WHERE lower(email) = lower(target_email);

ELSE

    INSERT INTO public.profiles (id, email, role, profile_type)

    VALUES (v_user_id, lower(target_email), 'teacher'::user_role, 'teacher');

END IF;

END;

$function$;

CREATE OR REPLACE FUNCTION public.force_reset_password(user_id uuid, new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE auth.users

  SET encrypted_password = crypt(new_password, gen_salt('bf')),

      updated_at = now(),

      last_sign_in_at = NULL

  WHERE id = user_id;

-- Sincronizar tambem com o status force_change se necess??rio (opcional)

  UPDATE auth.users

  SET raw_user_meta_data = raw_user_meta_data || '{"must_change_password": false}'::jsonb

  WHERE id = user_id;

END;

$function$;

CREATE OR REPLACE FUNCTION public.get_auth_uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$

  SELECT auth.uid();

$function$;

CREATE OR REPLACE FUNCTION public.get_student_engagement_by_token(token_val text)
 RETURNS TABLE(student_name text, exam_target text, institution text, total_xp bigint, current_level integer, current_streak integer, longest_streak integer, total_answers bigint, correct_answers bigint, essays_submitted bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_student_id UUID;

v_student_name TEXT;

v_exam_target TEXT;

v_institution TEXT;

v_current_streak INT;

v_longest_streak INT;

BEGIN

  -- Valida o token e pega o student_id correspondente

  SELECT student_id INTO v_student_id

  FROM public.guardian_tokens

  WHERE token = token_val;

IF v_student_id IS NULL THEN

    RETURN;

END IF;

-- Pega as informa????es do perfil do estudante

  SELECT 

    full_name, 

    COALESCE(profiles.exam_target, 'enem'), 

    COALESCE(profiles.institution, 'Col??gio'),

    COALESCE(profiles.current_streak, 0),

    COALESCE(profiles.longest_streak, 0)

  INTO 

    v_student_name, 

    v_exam_target, 

    v_institution,

    v_current_streak,

    v_longest_streak

  FROM public.profiles

  WHERE id = v_student_id;

RETURN QUERY

  SELECT

    v_student_name as student_name,

    v_exam_target as exam_target,

    v_institution as institution,

    COALESCE((SELECT SUM(xp_earned) FROM public.student_xp_log WHERE student_id = v_student_id), 0)::BIGINT as total_xp,

    COALESCE((

      SELECT 

        CASE

          WHEN SUM(xp_earned) < 500    THEN 1

          WHEN SUM(xp_earned) < 1500   THEN 2

          WHEN SUM(xp_earned) < 3500   THEN 3

          WHEN SUM(xp_earned) < 7000   THEN 4

          ELSE 5

        END

      FROM public.student_xp_log WHERE student_id = v_student_id

    ), 1)::INT as current_level,

    v_current_streak as current_streak,

    v_longest_streak as longest_streak,

    COALESCE((SELECT COUNT(*) FROM public.student_xp_log WHERE student_id = v_student_id AND action IN ('correct_answer', 'wrong_answer', 'daily_question_correct', 'daily_question_wrong')), 0)::BIGINT as total_answers,

    COALESCE((SELECT COUNT(*) FROM public.student_xp_log WHERE student_id = v_student_id AND action IN ('correct_answer', 'daily_question_correct')), 0)::BIGINT as correct_answers,

    COALESCE((SELECT COUNT(*) FROM public.essay_submissions WHERE student_id = v_student_id), 0)::BIGINT as essays_submitted;

END;

$function$;

CREATE OR REPLACE FUNCTION public.normalize_email_localpart(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$

  SELECT regexp_replace(translate(lower(input),

    '????????????????????????????????????????????????????????????????????????????????????????????????????????????',

    'aaaaaaceeeeiiiiooooouuuuyynAAAAAACEEEEIIIIOOOOOUUUUYYN'), '[^a-z0-9]', '', 'g');

$function$;

CREATE OR REPLACE FUNCTION public.normalize_email_part(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$

  SELECT lower(regexp_replace(unaccent(trim(input)), '[^a-z0-9]', '', 'g'));

$function$;

create or replace view "public"."profile_public" as  SELECT id,
    name AS username,
    avatar_url
   FROM profiles;

create or replace view "public"."profiles_public" as  SELECT id,
    full_name,
    avatar_url,
    name,
    updated_at
   FROM profiles;

CREATE OR REPLACE FUNCTION public.questions_normalize_validate_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  raw jsonb := NEW.options;

normalized jsonb := '[]'::jsonb;

item jsonb;

key_text text;

text_text text;

seen_keys jsonb := '[]'::jsonb;

tmp jsonb;

i int;

BEGIN

  -- Reject null or non-json

  IF raw IS NULL THEN

    RAISE EXCEPTION 'Invalid options payload for questions.id=%: must be a non-empty JSON array of objects with unique non-empty "key" and "text" fields', NEW.id;

END IF;

-- Must be array

  IF jsonb_typeof(raw) <> 'array' THEN

    RAISE EXCEPTION 'Invalid options payload for questions.id=%: must be a non-empty JSON array of objects with unique non-empty "key" and "text" fields', NEW.id;

END IF;

-- Iterate array and normalize

  FOR i IN 0 .. jsonb_array_length(raw)-1 LOOP

    item := raw -> i;

-- Skip non-objects

    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN

      CONTINUE;

END IF;

-- extract fields safely

    key_text := trim((item ->> 'key'));

text_text := trim((item ->> 'text'));

-- If key or text missing/empty after trim, skip

    IF key_text IS NULL OR key_text = '' OR text_text IS NULL OR text_text = '' THEN

      CONTINUE;

END IF;

-- normalize key to lower-case and text trimmed

    key_text := lower(key_text);

text_text := text_text;

-- already trimmed



    -- deduplicate: keep first occurrence

    IF (seen_keys ? key_text) THEN

      CONTINUE;

END IF;

-- add to seen_keys

    seen_keys := seen_keys || jsonb_build_object(key_text, true);

-- build normalized item

    tmp := jsonb_build_object('key', key_text, 'text', text_text);

normalized := normalized || tmp;

END LOOP;

-- Validate non-empty

  IF jsonb_array_length(normalized) = 0 THEN

    RAISE EXCEPTION 'Invalid options payload for questions.id=%: must be a non-empty JSON array of objects with unique non-empty "key" and "text" fields after normalization', NEW.id;

END IF;

-- assign normalized back

  NEW.options := normalized;

RETURN NEW;

END;

$function$;

CREATE OR REPLACE FUNCTION public.questions_validate_options_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  IF NOT validate_question_options(NEW.options) THEN

    RAISE EXCEPTION 'Invalid options payload for questions.id=%: must be a non-empty JSON array of objects with unique non-empty "key" and "text" fields', COALESCE(NEW.id::text, 'null');

END IF;

RETURN NEW;

END;

$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$

DECLARE

  cmd record;

BEGIN

  FOR cmd IN

    SELECT *

    FROM pg_event_trigger_ddl_commands()

    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')

      AND object_type IN ('table','partitioned table')

  LOOP

     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN

      BEGIN

        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);

RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;

EXCEPTION

        WHEN OTHERS THEN

          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;

END;

ELSE

        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;

END IF;

END LOOP;

END;

$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_display_name_from_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE

  v_first text;

v_last text;

v_full text;

v_display text;

BEGIN

  -- Values from auth.users JSON payload

  v_first := NEW.raw_user_meta_data ->> 'first_name';

v_last  := NEW.raw_user_meta_data ->> 'last_name';

v_full  := NEW.raw_user_meta_data ->> 'full_name';

-- Build display name: first + last if present, else full_name, else NULL

  IF (v_first IS NOT NULL AND v_last IS NOT NULL) THEN

    v_display := btrim(v_first) || ' ' || btrim(v_last);

ELSIF (v_first IS NOT NULL) THEN

    v_display := btrim(v_first);

ELSIF (v_last IS NOT NULL) THEN

    v_display := btrim(v_last);

ELSE

    v_display := v_full;

END IF;

-- Update/insert into profiles

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.id) THEN

    UPDATE public.profiles p

    SET

      full_name = COALESCE(v_display, p.full_name),

      name = COALESCE(v_display, p.name)

    WHERE p.id = NEW.id;

ELSE

    INSERT INTO public.profiles (id, full_name, name, email, role, profile_type)

    VALUES (

      NEW.id,

      v_display,

      v_display,

      NEW.email,

      COALESCE(NEW.raw_app_meta_data ->> 'role', 'student')::public.user_role,

      COALESCE(NEW.raw_user_meta_data ->> 'profile_type', NULL)

    );

END IF;

RETURN NEW;

END;

$function$;

CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

    NEW.updated_at = timezone('utc'::text, now());

RETURN NEW;

END;

$function$;

CREATE OR REPLACE FUNCTION public.validate_question_options(jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$

DECLARE

  elem jsonb;

key_text text;

key_val text;

keys text[] := ARRAY[]::text[];

BEGIN

  IF $1 IS NULL THEN

    RETURN false;

END IF;

IF jsonb_typeof($1) <> 'array' THEN

    RETURN false;

END IF;

IF jsonb_array_length($1) = 0 THEN

    RETURN false;

END IF;

FOR elem IN SELECT * FROM jsonb_array_elements($1) LOOP

    -- must be object

    IF jsonb_typeof(elem) <> 'object' THEN

      RETURN false;

END IF;

-- must have key and text

    IF NOT (elem ? 'key') OR NOT (elem ? 'text') THEN

      RETURN false;

END IF;

-- extract and validate as non-empty trimmed strings

    key_val := trim(both from (elem ->> 'key'));

key_text := trim(both from (elem ->> 'text'));

IF key_val IS NULL OR key_text IS NULL THEN

      RETURN false;

END IF;

IF key_val = '' OR key_text = '' THEN

      RETURN false;

END IF;

-- uniqueness check for key

    IF key_val = ANY(keys) THEN

      RETURN false;

END IF;

keys := array_append(keys, key_val);

END LOOP;

RETURN true;

END;

$function$;

CREATE OR REPLACE FUNCTION auth.email()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select nullif(current_setting('request.jwt.claim.email', true), '')::text;

$function$;

CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text;

$function$;

CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

$function$;

CREATE OR REPLACE FUNCTION public.check_user_is_staff_or_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  RETURN EXISTS (

    SELECT 1 FROM public.profiles

    WHERE id = user_id AND role::text IN ('admin', 'staff')

  );

END;

$function$;

CREATE OR REPLACE FUNCTION public.fn_set_question_hash()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  NEW.question_hash := md5(lower(regexp_replace(trim(NEW.question_text), '\s+', ' ', 'g')));

RETURN NEW;

END;

$function$;

CREATE OR REPLACE FUNCTION public.get_random_questions_for_subject(p_subject_id uuid, p_limit integer)
 RETURNS SETOF questions
 LANGUAGE plpgsql
AS $function$

BEGIN

  RETURN QUERY

  SELECT * FROM public.questions

  WHERE subject_id = p_subject_id

  ORDER BY random()

  LIMIT p_limit;

END;

$function$;

CREATE OR REPLACE FUNCTION public.get_subjects_with_question_count()
 RETURNS TABLE(id uuid, name text, question_count bigint)
 LANGUAGE plpgsql
AS $function$

BEGIN

  RETURN QUERY

  SELECT s.id, s.name, COUNT(q.id) as question_count

  FROM public.subjects s

  LEFT JOIN public.questions q ON s.id = q.subject_id

  GROUP BY s.id, s.name

  ORDER BY s.name ASC;

END;

$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  INSERT INTO public.profiles (id, email, name, profile_type, status)

  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'student', 'active')

  ON CONFLICT (id) DO NOTHING;

RETURN new;

END;

$function$;

CREATE OR REPLACE FUNCTION public.increment_time_spent(p_user_id uuid, p_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE public.profiles

  SET total_time_spent = COALESCE(total_time_spent, 0) + p_seconds,

      updated_at = NOW()

  WHERE id = p_user_id;

END;

$function$;

create or replace view "public"."weekly_ranking" as  SELECT p.id AS student_id,
    p.full_name,
    p.avatar_url,
    p.exam_target,
    p.xp_points AS total_xp,
    (COALESCE(sum(xl.xp_earned), (0)::bigint))::integer AS weekly_xp,
    rank() OVER (PARTITION BY p.exam_target ORDER BY COALESCE(sum(xl.xp_earned), (0)::bigint) DESC) AS "position"
   FROM (profiles p
     LEFT JOIN student_xp_log xl ON (((xl.student_id = p.id) AND (xl.created_at >= date_trunc('week'::text, now())))))
  WHERE (p.role = 'student'::user_role)
  GROUP BY p.id, p.full_name, p.avatar_url, p.exam_target, p.xp_points;

create policy "cron_job_policy"
on "cron"."job"
as permissive
for all
to public
using ((username = CURRENT_USER));

create policy "cron_job_run_details_policy"
on "cron"."job_run_details"
as permissive
for all
to public
using ((username = CURRENT_USER));

create policy "activity_logs_select_admin_or_owner"
on "public"."activity_logs"
as permissive
for select
to authenticated
using (((NOT (user_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)));

create policy "Todos podem ler avisos vinculados"
on "public"."announcements"
as permissive
for select
to authenticated
using (true);

create policy "announcements_delete_auth"
on "public"."announcements"
as permissive
for delete
to authenticated
using (((NOT (author_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)));

create policy "announcements_insert_auth"
on "public"."announcements"
as permissive
for insert
to authenticated
with check ((NOT (author_id IS DISTINCT FROM ( SELECT uid() AS uid))));

create policy "announcements_select_auth"
on "public"."announcements"
as permissive
for select
to authenticated
using (((NOT (author_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)));

create policy "announcements_update_auth"
on "public"."announcements"
as permissive
for update
to authenticated
using (((NOT (author_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)))
with check ((NOT (author_id IS DISTINCT FROM ( SELECT uid() AS uid))));

create policy "open_delete_for_authenticated_announcements"
on "public"."announcements"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_announcements"
on "public"."announcements"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_announcements"
on "public"."announcements"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_announcements"
on "public"."announcements"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "open_delete_for_authenticated_chat_messages"
on "public"."chat_messages"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_chat_messages"
on "public"."chat_messages"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_chat_messages"
on "public"."chat_messages"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_chat_messages"
on "public"."chat_messages"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "classes_delete_auth"
on "public"."classes"
as permissive
for delete
to authenticated
using (((NOT (coordinator_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)));

create policy "classes_insert_auth"
on "public"."classes"
as permissive
for insert
to authenticated
with check ((((jwt() ->> 'user_role'::text) = 'coordinator'::text) OR ((jwt() ->> 'user_role'::text) = 'admin'::text) OR (NOT (coordinator_id IS DISTINCT FROM ( SELECT uid() AS uid)))));

create policy "classes_select_auth"
on "public"."classes"
as permissive
for select
to authenticated
using (true);

create policy "classes_update_auth"
on "public"."classes"
as permissive
for update
to authenticated
using (((NOT (coordinator_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)))
with check (((NOT (coordinator_id IS DISTINCT FROM ( SELECT uid() AS uid))) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)));

create policy "open_delete_for_authenticated_dev_meta"
on "public"."dev_meta"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_dev_meta"
on "public"."dev_meta"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_dev_meta"
on "public"."dev_meta"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_dev_meta"
on "public"."dev_meta"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso Demo"
on "public"."direct_messages"
as permissive
for all
to public
using (true);

create policy "Enviar mensagens"
on "public"."direct_messages"
as permissive
for insert
to public
with check ((uid() = sender_id));

create policy "Mensagens: enviar"
on "public"."direct_messages"
as permissive
for insert
to authenticated
with check ((uid() = sender_id));

create policy "Mensagens: ver pr??prias"
on "public"."direct_messages"
as permissive
for select
to public
using (((uid() = sender_id) OR (uid() = receiver_id)));

create policy "Ver mensagens"
on "public"."direct_messages"
as permissive
for select
to public
using (((uid() = sender_id) OR (uid() = receiver_id)));

create policy "direct_delete_sender"
on "public"."direct_messages"
as permissive
for delete
to authenticated
using ((( SELECT uid() AS uid) = sender_id));

create policy "direct_insert_sender_check"
on "public"."direct_messages"
as permissive
for insert
to authenticated
with check ((( SELECT uid() AS uid) = sender_id));

create policy "direct_select_owner"
on "public"."direct_messages"
as permissive
for select
to authenticated
using (((( SELECT uid() AS uid) = sender_id) OR (( SELECT uid() AS uid) = receiver_id)));

create policy "direct_update_owner"
on "public"."direct_messages"
as permissive
for update
to authenticated
using (((( SELECT uid() AS uid) = sender_id) OR (( SELECT uid() AS uid) = receiver_id)))
with check (((( SELECT uid() AS uid) = sender_id) OR (( SELECT uid() AS uid) = receiver_id)));

create policy "open_delete_for_authenticated_direct_messages"
on "public"."direct_messages"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_direct_messages"
on "public"."direct_messages"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_direct_messages"
on "public"."direct_messages"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_direct_messages"
on "public"."direct_messages"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Alunos podem enviar reda????es"
on "public"."essay_submissions"
as permissive
for insert
to public
with check ((( SELECT uid() AS uid) = user_id));

create policy "Alunos veem apenas suas pr??prias reda????es"
on "public"."essay_submissions"
as permissive
for select
to public
using ((( SELECT uid() AS uid) = user_id));

create policy "Mentores e Admins podem auditar todas as reda????es"
on "public"."essay_submissions"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT uid() AS uid)) AND (profiles.profile_type = ANY (ARRAY['admin'::text, 'teacher'::text, 'mentor'::text]))))));

create policy "open_delete_for_authenticated_essay_submissions"
on "public"."essay_submissions"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_essay_submissions"
on "public"."essay_submissions"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_essay_submissions"
on "public"."essay_submissions"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_essay_submissions"
on "public"."essay_submissions"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "admin manage themes"
on "public"."essay_weekly_themes"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = uid()) AND (profiles.profile_type = ANY (ARRAY['admin'::text, 'staff'::text]))))));

create policy "auth read themes"
on "public"."essay_weekly_themes"
as permissive
for select
to public
using ((role() = 'authenticated'::text));

create policy "Students can create essays for themselves."
on "public"."essays"
as permissive
for insert
to authenticated
with check ((( SELECT uid() AS uid) = student_id));

create policy "Students can view their own essays."
on "public"."essays"
as permissive
for select
to authenticated
using ((( SELECT uid() AS uid) = student_id));

create policy "Teachers can update essays with feedback and grades."
on "public"."essays"
as permissive
for update
to authenticated
using ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT uid() AS uid))) = ANY (ARRAY['teacher'::user_role, 'admin'::user_role])));

create policy "Teachers can view and grade all essays."
on "public"."essays"
as permissive
for select
to authenticated
using ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT uid() AS uid))) = ANY (ARRAY['teacher'::user_role, 'admin'::user_role])));

create policy "open_delete_for_authenticated_essays"
on "public"."essays"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_essays"
on "public"."essays"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_essays"
on "public"."essays"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_essays"
on "public"."essays"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "teachers_update_simulado_answer_key"
on "public"."exams"
as permissive
for update
to authenticated
using (((exam_type = 'simulado_importado'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = uid()) AND (profiles.role = ANY (ARRAY['teacher'::user_role, 'admin'::user_role])))))))
with check (((exam_type = 'simulado_importado'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = uid()) AND (profiles.role = ANY (ARRAY['teacher'::user_role, 'admin'::user_role])))))));

create policy "student rw own flashcards"
on "public"."flashcard_progress"
as permissive
for all
to public
using ((uid() = student_id))
with check ((uid() = student_id));

create policy "forum_bans_delete_by_moderator_or_admin"
on "public"."forum_bans"
as permissive
for delete
to authenticated
using (((jwt() ->> 'user_role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])));

create policy "forum_bans_insert_by_moderator_or_admin"
on "public"."forum_bans"
as permissive
for insert
to authenticated
with check (((jwt() ->> 'user_role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text])));

create policy "forum_bans_select_owner_or_moderator_admin"
on "public"."forum_bans"
as permissive
for select
to authenticated
using (((user_id = ( SELECT uid() AS uid)) OR ((jwt() ->> 'user_role'::text) = ANY (ARRAY['admin'::text, 'moderator'::text]))));

create policy "forum_bans_update_by_admin"
on "public"."forum_bans"
as permissive
for update
to authenticated
using (((jwt() ->> 'user_role'::text) = 'admin'::text))
with check (((jwt() ->> 'user_role'::text) = 'admin'::text));

create policy "Acesso total posts"
on "public"."forum_posts"
as permissive
for all
to public
using (true);

create policy "Criar posts"
on "public"."forum_posts"
as permissive
for insert
to public
with check ((uid() = author_id));

create policy "Enviar mensagens"
on "public"."forum_posts"
as permissive
for insert
to authenticated
with check (true);

create policy "Marcar como respondida"
on "public"."forum_posts"
as permissive
for update
to authenticated
using (true);

create policy "Ver mensagens"
on "public"."forum_posts"
as permissive
for select
to authenticated
using (true);

create policy "Ver posts"
on "public"."forum_posts"
as permissive
for select
to public
using (true);

create policy "open_delete_for_authenticated_forum_posts"
on "public"."forum_posts"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_forum_posts"
on "public"."forum_posts"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_forum_posts"
on "public"."forum_posts"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_forum_posts"
on "public"."forum_posts"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can create replies"
on "public"."forum_replies"
as permissive
for insert
to authenticated
with check ((( SELECT role() AS role) = 'authenticated'::text));

create policy "Authors can delete their own replies"
on "public"."forum_replies"
as permissive
for delete
to public
using ((uid() = author_id));

create policy "Authors can update their own replies"
on "public"."forum_replies"
as permissive
for update
to public
using ((uid() = author_id));

create policy "Public can read all forum replies"
on "public"."forum_replies"
as permissive
for select
to public
using (true);

create policy "open_delete_for_authenticated_forum_replies"
on "public"."forum_replies"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_forum_replies"
on "public"."forum_replies"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_forum_replies"
on "public"."forum_replies"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_forum_replies"
on "public"."forum_replies"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can create threads"
on "public"."forum_threads"
as permissive
for insert
to authenticated
with check ((( SELECT role() AS role) = 'authenticated'::text));

create policy "Authors can delete their own threads"
on "public"."forum_threads"
as permissive
for delete
to public
using ((uid() = author_id));

create policy "Authors can update their own threads"
on "public"."forum_threads"
as permissive
for update
to public
using ((uid() = author_id));

create policy "Public can read all forum threads"
on "public"."forum_threads"
as permissive
for select
to public
using (true);

create policy "open_delete_for_authenticated_forum_threads"
on "public"."forum_threads"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_forum_threads"
on "public"."forum_threads"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_forum_threads"
on "public"."forum_threads"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_forum_threads"
on "public"."forum_threads"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso total f??rum"
on "public"."forums"
as permissive
for all
to public
using (true);

create policy "forums_insert_admin_only"
on "public"."forums"
as permissive
for insert
to authenticated
with check (((jwt() ->> 'user_role'::text) = 'admin'::text));

create policy "forums_select_public_non_teacher"
on "public"."forums"
as permissive
for select
to public
using ((is_teacher_only IS FALSE));

create policy "forums_select_teacher_control"
on "public"."forums"
as permissive
for select
to authenticated
using (((is_teacher_only IS FALSE) OR ((jwt() ->> 'user_role'::text) = ANY (ARRAY['admin'::text, 'teacher'::text]))));

create policy "open_delete_for_authenticated_forums"
on "public"."forums"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_forums"
on "public"."forums"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_forums"
on "public"."forums"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_forums"
on "public"."forums"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Allow individual read/write guardian_tokens"
on "public"."guardian_tokens"
as permissive
for all
to authenticated
using ((uid() = student_id))
with check ((uid() = student_id));

create policy "open_delete_for_authenticated_invitations"
on "public"."invitations"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_invitations"
on "public"."invitations"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_invitations"
on "public"."invitations"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_invitations"
on "public"."invitations"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso Demo"
on "public"."learning_contents"
as permissive
for all
to public
using (true);

create policy "Acesso p??blico conte??dos"
on "public"."learning_contents"
as permissive
for select
to public
using (true);

create policy "Acesso publico learning_contents"
on "public"."learning_contents"
as permissive
for all
to public
using (true)
with check (true);

create policy "Allow delete for authenticated users"
on "public"."learning_contents"
as permissive
for delete
to authenticated
using (true);

create policy "Allow insert for authenticated users"
on "public"."learning_contents"
as permissive
for insert
to authenticated
with check (true);

create policy "Allow read for all users"
on "public"."learning_contents"
as permissive
for select
to public
using (true);

create policy "Professores editam conte??dos"
on "public"."learning_contents"
as permissive
for all
to public
using (true);

create policy "open_delete_for_authenticated_learning_contents"
on "public"."learning_contents"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_learning_contents"
on "public"."learning_contents"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_learning_contents"
on "public"."learning_contents"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_learning_contents"
on "public"."learning_contents"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can create library items"
on "public"."library_items"
as permissive
for insert
to public
with check ((role() = 'authenticated'::text));

create policy "Authors can delete their own library items"
on "public"."library_items"
as permissive
for delete
to public
using ((uid() = author_id));

create policy "Authors can update their own library items"
on "public"."library_items"
as permissive
for update
to public
using ((uid() = author_id));

create policy "Public can read all library items"
on "public"."library_items"
as permissive
for select
to public
using (true);

create policy "Acesso Demo"
on "public"."library_resources"
as permissive
for all
to public
using (true);

create policy "Permitir tudo na biblioteca"
on "public"."library_resources"
as permissive
for all
to public
using (true);

create policy "open_delete_for_authenticated_library_resources"
on "public"."library_resources"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_library_resources"
on "public"."library_resources"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_library_resources"
on "public"."library_resources"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_library_resources"
on "public"."library_resources"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Inser????o autenticada chat live"
on "public"."live_messages"
as permissive
for insert
to authenticated
with check ((uid() = user_id));

create policy "Leitura p??blica chat live"
on "public"."live_messages"
as permissive
for select
to public
using (true);

create policy "Update moderador chat live"
on "public"."live_messages"
as permissive
for update
to authenticated
using (((uid() = user_id) OR ((jwt() ->> 'user_role'::text) = 'teacher'::text) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)))
with check (((uid() = user_id) OR ((jwt() ->> 'user_role'::text) = 'teacher'::text) OR ((jwt() ->> 'user_role'::text) = 'admin'::text)));

create policy "open_delete_for_authenticated_live_messages"
on "public"."live_messages"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_live_messages"
on "public"."live_messages"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_live_messages"
on "public"."live_messages"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_live_messages"
on "public"."live_messages"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso Demo"
on "public"."lives"
as permissive
for all
to public
using (true);

create policy "Acesso publico lives"
on "public"."lives"
as permissive
for all
to public
using (true)
with check (true);

create policy "Permitir leitura de aulas para usu??rios autenticados"
on "public"."lives"
as permissive
for select
to authenticated
using (true);

create policy "Public can read all lives"
on "public"."lives"
as permissive
for select
to public
using (true);

create policy "open_delete_for_authenticated_lives"
on "public"."lives"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_lives"
on "public"."lives"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_lives"
on "public"."lives"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_lives"
on "public"."lives"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "leitura_publica_materias"
on "public"."matérias"
as permissive
for select
to authenticated
using (true);

create policy "materias_delete_owner"
on "public"."matérias"
as permissive
for delete
to authenticated
using ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)));

create policy "materias_insert_owner"
on "public"."matérias"
as permissive
for insert
to authenticated
with check ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)));

create policy "materias_update_owner"
on "public"."matérias"
as permissive
for update
to authenticated
using ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)))
with check ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)));

create policy "open_delete_for_authenticated_matérias"
on "public"."matérias"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_matérias"
on "public"."matérias"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_matérias"
on "public"."matérias"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_matérias"
on "public"."matérias"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Admins can select"
on "public"."material_annotations"
as permissive
for select
to authenticated
using (((jwt() ->> 'role'::text) = 'admin'::text));

create policy "Owners can delete"
on "public"."material_annotations"
as permissive
for delete
to authenticated
using ((((( SELECT uid() AS uid))::text IS NOT NULL) AND ((user_id)::text = (( SELECT uid() AS uid))::text)));

create policy "Owners can insert"
on "public"."material_annotations"
as permissive
for insert
to authenticated
with check ((((( SELECT uid() AS uid))::text IS NOT NULL) AND ((user_id)::text = (( SELECT uid() AS uid))::text)));

create policy "Owners can select"
on "public"."material_annotations"
as permissive
for select
to authenticated
using ((((( SELECT uid() AS uid))::text IS NOT NULL) AND ((user_id)::text = (( SELECT uid() AS uid))::text)));

create policy "Owners can update"
on "public"."material_annotations"
as permissive
for update
to authenticated
using ((((( SELECT uid() AS uid))::text IS NOT NULL) AND ((user_id)::text = (( SELECT uid() AS uid))::text)))
with check ((((( SELECT uid() AS uid))::text IS NOT NULL) AND ((user_id)::text = (( SELECT uid() AS uid))::text)));

create policy "open_delete_for_authenticated_material_annotations"
on "public"."material_annotations"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_material_annotations"
on "public"."material_annotations"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_material_annotations"
on "public"."material_annotations"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_material_annotations"
on "public"."material_annotations"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "open_delete_for_authenticated_materials"
on "public"."materials"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_materials"
on "public"."materials"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_materials"
on "public"."materials"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_materials"
on "public"."materials"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso Demo"
on "public"."modules"
as permissive
for all
to public
using (true);

create policy "Acesso p??blico m??dulos"
on "public"."modules"
as permissive
for select
to public
using (true);

create policy "Acesso publico modules"
on "public"."modules"
as permissive
for all
to public
using (true)
with check (true);

create policy "Allow delete for authenticated users on modules"
on "public"."modules"
as permissive
for delete
to authenticated
using (true);

create policy "Allow insert for authenticated users on modules"
on "public"."modules"
as permissive
for insert
to authenticated
with check (true);

create policy "Allow read for all users on modules"
on "public"."modules"
as permissive
for select
to public
using (true);

create policy "Professores editam m??dulos"
on "public"."modules"
as permissive
for all
to public
using (true);

create policy "open_delete_for_authenticated_modules"
on "public"."modules"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_modules"
on "public"."modules"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_modules"
on "public"."modules"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_modules"
on "public"."modules"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "notif_delete_own"
on "public"."notifications"
as permissive
for delete
to authenticated
using ((uid() = user_id));

create policy "notif_insert_own"
on "public"."notifications"
as permissive
for insert
to authenticated
with check ((uid() = user_id));

create policy "notif_select_own"
on "public"."notifications"
as permissive
for select
to authenticated
using ((uid() = user_id));

create policy "notif_update_own"
on "public"."notifications"
as permissive
for update
to authenticated
using ((uid() = user_id))
with check ((uid() = user_id));

create policy "otp_codes_write_service"
on "public"."otp_codes"
as permissive
for all
to service_role
using (true)
with check (true);

create policy "Auth service can insert profiles"
on "public"."profiles"
as permissive
for insert
to supabase_auth_admin
with check (true);

create policy "Authenticated can select profiles"
on "public"."profiles"
as permissive
for select
to authenticated
using (true);

create policy "Perfis: leitura por autenticados"
on "public"."profiles"
as permissive
for select
to authenticated
using (((jwt() ->> 'role'::text) = 'authenticated'::text));

create policy "Profiles: owner delete"
on "public"."profiles"
as permissive
for delete
to authenticated
using ((( SELECT uid() AS uid) = id));

create policy "Profiles: owner insert"
on "public"."profiles"
as permissive
for insert
to authenticated
with check ((( SELECT uid() AS uid) = id));

create policy "Profiles: owner select"
on "public"."profiles"
as permissive
for select
to authenticated
using ((( SELECT uid() AS uid) = id));

create policy "Profiles: owner update"
on "public"."profiles"
as permissive
for update
to authenticated
using ((( SELECT uid() AS uid) = id))
with check ((( SELECT uid() AS uid) = id));

create policy "Profiles: public select"
on "public"."profiles"
as permissive
for select
to public
using (true);

create policy "Profiles: update own"
on "public"."profiles"
as permissive
for update
to public
using ((uid() = id))
with check ((uid() = id));

create policy "Users can insert their own profile."
on "public"."profiles"
as permissive
for insert
to authenticated
with check ((( SELECT uid() AS uid) = id));

create policy "Users can update their own profile (old)"
on "public"."profiles"
as permissive
for update
to authenticated
using ((( SELECT uid() AS uid) = id))
with check ((( SELECT uid() AS uid) = id));

create policy "Users can update their own profile."
on "public"."profiles"
as permissive
for update
to authenticated
using ((( SELECT uid() AS uid) = id));

create policy "Users can view own profile"
on "public"."profiles"
as permissive
for select
to public
using ((uid() = id));

create policy "Usu??rios atualizam pr??prio perfil"
on "public"."profiles"
as permissive
for update
to authenticated
using ((uid() = id));

create policy "open_delete_for_authenticated_profiles"
on "public"."profiles"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_profiles"
on "public"."profiles"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_profiles"
on "public"."profiles"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_profiles"
on "public"."profiles"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "leitura_publica_questoes"
on "public"."questões"
as permissive
for select
to authenticated
using (true);

create policy "open_delete_for_authenticated_questões"
on "public"."questões"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_questões"
on "public"."questões"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_questões"
on "public"."questões"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_questões"
on "public"."questões"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "questoes_delete_owner"
on "public"."questões"
as permissive
for delete
to authenticated
using ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)));

create policy "questoes_insert_owner"
on "public"."questões"
as permissive
for insert
to authenticated
with check ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)));

create policy "questoes_update_owner"
on "public"."questões"
as permissive
for update
to authenticated
using ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)))
with check ((owner_id = ( SELECT get_auth_uid() AS get_auth_uid)));

create policy "Delete pr??prio professor"
on "public"."questions"
as permissive
for delete
to authenticated
using ((( SELECT uid() AS uid) = teacher_id));

create policy "Inser????o de questões por professores"
on "public"."questions"
as permissive
for insert
to authenticated
with check ((( SELECT uid() AS uid) = teacher_id));

create policy "Leitura de questões"
on "public"."questions"
as permissive
for select
to authenticated
using (true);

create policy "Update pr??prio professor"
on "public"."questions"
as permissive
for update
to authenticated
using ((( SELECT uid() AS uid) = teacher_id));

create policy "authenticated_select_questions"
on "public"."questions"
as permissive
for select
to authenticated
using (true);

create policy "open_delete_for_authenticated_questions"
on "public"."questions"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_questions"
on "public"."questions"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_questions"
on "public"."questions"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_questions"
on "public"."questions"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Staff manage report cards"
on "public"."report_card_entries"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = uid()) AND ((profiles.role)::text = ANY (ARRAY['admin'::text, 'staff'::text, 'teacher'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = uid()) AND ((profiles.role)::text = ANY (ARRAY['admin'::text, 'staff'::text, 'teacher'::text]))))));

create policy "Students view own report card"
on "public"."report_card_entries"
as permissive
for select
to authenticated
using ((uid() = student_id));

create policy "open_delete_for_authenticated_scheduled_lives"
on "public"."scheduled_lives"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_scheduled_lives"
on "public"."scheduled_lives"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_scheduled_lives"
on "public"."scheduled_lives"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_scheduled_lives"
on "public"."scheduled_lives"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "open_delete_for_authenticated_simulation_attempts"
on "public"."simulation_attempts"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_simulation_attempts"
on "public"."simulation_attempts"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_simulation_attempts"
on "public"."simulation_attempts"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_simulation_attempts"
on "public"."simulation_attempts"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso Demo"
on "public"."student_checklists"
as permissive
for all
to public
using (true);

create policy "allow_students_to_create_and_view_their_own_answers"
on "public"."student_question_answers"
as permissive
for all
to authenticated
using ((uid() = student_id))
with check ((uid() = student_id));

create policy "allow_teachers_to_view_all_student_answers"
on "public"."student_question_answers"
as permissive
for select
to authenticated
using (((jwt() ->> 'user_role'::text) = 'teacher'::text));

create policy "open_delete_for_authenticated_student_question_answers"
on "public"."student_question_answers"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_student_question_answers"
on "public"."student_question_answers"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_student_question_answers"
on "public"."student_question_answers"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_student_question_answers"
on "public"."student_question_answers"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "students_can_manage_their_answers"
on "public"."student_question_answers"
as permissive
for all
to public
using ((uid() = student_id))
with check ((uid() = student_id));

create policy "teachers_can_view_answers"
on "public"."student_question_answers"
as permissive
for select
to public
using (((jwt() ->> 'user_role'::text) = 'teacher'::text));

create policy "Acesso p??blico leitura matérias"
on "public"."subjects"
as permissive
for select
to authenticated
using (true);

create policy "allow_authenticated_users_to_read_subjects"
on "public"."subjects"
as permissive
for select
to authenticated
using (true);

create policy "allow_only_teachers_to_manage_subjects"
on "public"."subjects"
as permissive
for all
to authenticated
using (((jwt() ->> 'user_role'::text) = 'teacher'::text))
with check (((jwt() ->> 'user_role'::text) = 'teacher'::text));

create policy "authenticated_select_subjects"
on "public"."subjects"
as permissive
for select
to authenticated
using (true);

create policy "Admins can view all feedbacks"
on "public"."system_feedbacks"
as permissive
for select
to public
using (true);

create policy "Teachers insert own"
on "public"."teachers"
as permissive
for insert
to authenticated
with check ((auth_user_id = uid()));

create policy "Teachers select own"
on "public"."teachers"
as permissive
for select
to authenticated
using ((auth_user_id = uid()));

create policy "Teachers update own"
on "public"."teachers"
as permissive
for update
to authenticated
using ((auth_user_id = uid()))
with check ((auth_user_id = uid()));

create policy "open_delete_for_authenticated_teachers"
on "public"."teachers"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_teachers"
on "public"."teachers"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_teachers"
on "public"."teachers"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_teachers"
on "public"."teachers"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Public can read all contents"
on "public"."trail_contents"
as permissive
for select
to public
using (true);

create policy "Trail authors can manage contents in their trails"
on "public"."trail_contents"
as permissive
for all
to authenticated
using ((( SELECT t.author_id
   FROM (trails t
     JOIN trail_modules tm ON ((t.id = tm.trail_id)))
  WHERE (tm.id = trail_contents.module_id)) = ( SELECT uid() AS uid)));

create policy "open_delete_for_authenticated_trail_contents"
on "public"."trail_contents"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_trail_contents"
on "public"."trail_contents"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_trail_contents"
on "public"."trail_contents"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_trail_contents"
on "public"."trail_contents"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Public can read all modules"
on "public"."trail_modules"
as permissive
for select
to public
using (true);

create policy "Trail authors can manage modules in their trails"
on "public"."trail_modules"
as permissive
for all
to authenticated
using ((( SELECT trails.author_id
   FROM trails
  WHERE (trails.id = trail_modules.trail_id)) = ( SELECT uid() AS uid)));

create policy "open_delete_for_authenticated_trail_modules"
on "public"."trail_modules"
as permissive
for delete
to authenticated
using (true);

create policy "open_insert_for_authenticated_trail_modules"
on "public"."trail_modules"
as permissive
for insert
to authenticated
with check (true);

create policy "open_select_for_authenticated_trail_modules"
on "public"."trail_modules"
as permissive
for select
to authenticated
using (true);

create policy "open_update_for_authenticated_trail_modules"
on "public"."trail_modules"
as permissive
for update
to authenticated
using (true)
with check (true);

create policy "Acesso Demo"
on "public"."trails"
as permissive
for all
to public
using (true);

create policy "Acesso p??blico trails"
on "public"."trails"
as permissive
for select
to public
using (true);

create policy "Allow delete for authenticated users on trails"
on "public"."trails"
as permissive
for delete
to authenticated
using (true);

create policy "Allow insert for authenticated users on trails"
on "public"."trails"
as permissive
for insert
to authenticated
with check (true);

create policy "Allow read for all users on trails"
on "public"."trails"
as permissive
for select
to public
using (true);

create policy "Allow update for authenticated users on trails"
on "public"."trails"
as permissive
for update
to authenticated
using (true);

create policy "Professores editam trails"
on "public"."trails"
as permissive
for all
to public
using (true);

create policy "Public can read all trails"
on "public"."trails"
as permissive
for select
to public
using (true);

create policy "Teachers can create trails"
on "public"."trails"
as permissive
for insert
to authenticated
with check ((( SELECT role() AS role) = 'authenticated'::text));

create policy "Trail authors can delete their own trails"
on "public"."trails"
as permissive
for delete
to authenticated
using ((( SELECT uid() AS uid) = author_id));

create policy "Trail authors can update their own trails"
on "public"."trails"
as permissive
for update
to authenticated
using ((( SELECT uid() AS uid) = author_id));

create policy "Acesso Demo"
on "public"."user_progress"
as permissive
for all
to public
using (true);

create policy "Acesso Total"
on "public"."user_progress"
as permissive
for all
to public
using (true);

create policy "Allow only teachers to manage questions"
on "public"."questions"
as permissive
for all
to public
using (((jwt() ->> 'user_role'::text) = 'teacher'::text))
with check (((jwt() ->> 'user_role'::text) = 'teacher'::text));

CREATE TRIGGER cron_job_cache_invalidate AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON cron.job FOR EACH STATEMENT EXECUTE FUNCTION cron.job_cache_invalidate();

CREATE TRIGGER update_material_annotations_modtime BEFORE UPDATE ON public.material_annotations FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER questions_normalize_validate_trigger BEFORE INSERT OR UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION questions_normalize_validate_trigger();

CREATE TRIGGER questions_validate_options_before_write BEFORE INSERT OR UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION questions_validate_options_trigger();