-- ============================================================
-- PUSH SUBSCRIPTIONS — WEB PUSH (VAPID)
-- Compromisso 360 | Migration 20260524100000
-- ============================================================
-- Armazena as inscrições do navegador (Service Worker) para
-- envio de notificações push tipo WhatsApp ao celular do aluno.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.push_subscriptions TO authenticated, service_role;

-- Usuário gerencia apenas as próprias inscrições
DROP POLICY IF EXISTS "ps_select_own" ON public.push_subscriptions;
CREATE POLICY "ps_select_own"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_insert_own" ON public.push_subscriptions;
CREATE POLICY "ps_insert_own"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_delete_own" ON public.push_subscriptions;
CREATE POLICY "ps_delete_own"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── Tabela de notificações in-app (inbox + badge unread) ─────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'info'
               CHECK (type IN ('chat','communication','material','document','attendance','info')),
  title      TEXT        NOT NULL,
  body       TEXT,
  url        TEXT,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id, read)
  WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.notifications TO authenticated, service_role;

-- Usuário lê e marca como lidas apenas as próprias notificações
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
