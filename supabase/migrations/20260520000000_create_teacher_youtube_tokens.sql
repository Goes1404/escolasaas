CREATE TABLE IF NOT EXISTS public.teacher_youtube_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  token_expiry   TIMESTAMPTZ,
  channel_id     TEXT,
  channel_title  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT teacher_youtube_tokens_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.teacher_youtube_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_own_tokens_select" ON public.teacher_youtube_tokens;
CREATE POLICY "teacher_own_tokens_select"
  ON public.teacher_youtube_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "teacher_own_tokens_insert" ON public.teacher_youtube_tokens;
CREATE POLICY "teacher_own_tokens_insert"
  ON public.teacher_youtube_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "teacher_own_tokens_update" ON public.teacher_youtube_tokens;
CREATE POLICY "teacher_own_tokens_update"
  ON public.teacher_youtube_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "teacher_own_tokens_delete" ON public.teacher_youtube_tokens;
CREATE POLICY "teacher_own_tokens_delete"
  ON public.teacher_youtube_tokens FOR DELETE
  USING (auth.uid() = user_id);
