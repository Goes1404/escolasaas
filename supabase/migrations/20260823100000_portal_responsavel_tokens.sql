-- Portal dos responsáveis — tokens por responsável e comunicados com leitura.
--
-- O portal antigo (guardian_tokens) tinha token POR ALUNO, gerado pelo próprio
-- aluno, e só mostrava engajamento gamificado. Este passo cria o modelo novo:
-- token POR RESPONSÁVEL (ligado a student_guardians), gerado pela secretaria,
-- revogável e com expiração — e é ele que dá acesso a frequência, boletim,
-- financeiro e comunicados. Os tokens antigos continuam funcionando na RPC
-- legada (fallback da página) até serem descontinuados.

CREATE TABLE IF NOT EXISTS public.guardian_access_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id    UUID NOT NULL REFERENCES public.student_guardians(id) ON DELETE CASCADE,
  -- Denormalizado do responsável para as RPCs não precisarem de join extra.
  student_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 192 bits aleatórios gerados NO BANCO (o cliente nunca escolhe o token).
  token          TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at     TIMESTAMPTZ DEFAULT (now() + INTERVAL '365 days'),
  revoked_at     TIMESTAMPTZ,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_access_at TIMESTAMPTZ,
  access_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guardian_access_tokens IS
  'Acesso do responsavel ao portal publico (/guardian/[token]). Um token por responsavel, revogavel. A pagina so acessa via RPC — sem policy publica.';

CREATE INDEX IF NOT EXISTS idx_guardian_access_tokens_guardian
  ON public.guardian_access_tokens (guardian_id);

ALTER TABLE public.guardian_access_tokens ENABLE ROW LEVEL SECURITY;

-- Só admin/secretaria gerenciam. NENHUMA policy para anon: o portal público
-- passa exclusivamente pelas RPCs SECURITY DEFINER.
DROP POLICY IF EXISTS guardian_access_tokens_staff_all ON public.guardian_access_tokens;
CREATE POLICY guardian_access_tokens_staff_all ON public.guardian_access_tokens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

-- ── Comunicados para responsáveis: reaproveita announcements ────────────────
-- `audience` separa o mural do aluno do mural do responsável. Default
-- 'students' preserva o comportamento de tudo que já existe.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'students'
  CHECK (audience IN ('students','guardians','all'));

COMMENT ON COLUMN public.announcements.audience IS
  'students = mural do aluno (padrao historico); guardians = so portal do responsavel; all = ambos.';

-- ── Confirmação de leitura por responsável ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guardian_announcement_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  -- Por responsável (não por token): sobrevive à rotação/revogação do token.
  guardian_id     UUID NOT NULL REFERENCES public.student_guardians(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guardian_announcement_reads_unico UNIQUE (announcement_id, guardian_id)
);

COMMENT ON TABLE public.guardian_announcement_reads IS
  'Recibo de leitura de comunicado pelo responsavel. Escrita apenas via RPC ack_guardian_announcement.';

ALTER TABLE public.guardian_announcement_reads ENABLE ROW LEVEL SECURITY;

-- Staff lê (relatório de quem confirmou). Escrita só pela RPC (definer).
DROP POLICY IF EXISTS guardian_announcement_reads_staff_select ON public.guardian_announcement_reads;
CREATE POLICY guardian_announcement_reads_staff_select ON public.guardian_announcement_reads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));
