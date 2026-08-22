-- Financeiro de mensalidades (módulo 1 de gestão de escolas particulares).
--
-- Cinco tabelas: plano de cobrança, vínculo aluno↔plano, bolsas/descontos,
-- fatura (mensalidade) e histórico append-only por fatura. Sem gateway de
-- pagamento nesta fase — o pagamento é registrado manualmente pela secretaria;
-- `external_id`/`gateway` ficam reservados para plugar PIX/boleto depois.
--
-- RLS segue o padrão do projeto: papel via profiles.role (NUNCA
-- auth.jwt()->>'user_role', que é sempre null — ver CLAUDE.md).

-- ── Plano de cobrança ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tuition_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES public.tenants(id),
  name                  TEXT NOT NULL,
  school_year           INTEGER NOT NULL,
  base_amount           NUMERIC(10,2) NOT NULL CHECK (base_amount > 0),
  -- Até 28 para o vencimento existir em todo mês (fevereiro incluído).
  due_day               SMALLINT NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 28),
  installments_per_year SMALLINT NOT NULL DEFAULT 12 CHECK (installments_per_year BETWEEN 1 AND 13),
  active                BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tuition_plans IS
  'Planos de mensalidade (valor base, dia de vencimento, parcelas/ano).';

CREATE INDEX IF NOT EXISTS idx_tuition_plans_year_active
  ON public.tuition_plans (school_year, active);

-- ── Vínculo aluno ↔ plano ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_plan_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id       UUID NOT NULL REFERENCES public.tuition_plans(id),
  school_year   INTEGER NOT NULL,
  -- Override do valor base do plano para este aluno (negociação individual).
  custom_amount NUMERIC(10,2) CHECK (custom_amount IS NULL OR custom_amount > 0),
  status        TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','encerrada')),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_plan_subscriptions_um_por_ano UNIQUE (student_id, school_year)
);

COMMENT ON TABLE public.student_plan_subscriptions IS
  'Qual plano de mensalidade cada aluno tem em cada ano letivo. Um por aluno/ano.';

CREATE INDEX IF NOT EXISTS idx_student_plan_subscriptions_plan
  ON public.student_plan_subscriptions (plan_id);

-- ── Bolsas e descontos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_discounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value       NUMERIC(10,2) NOT NULL CHECK (value > 0),
  reason      TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  valid_from  DATE,
  valid_until DATE,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_discounts_percent_max CHECK (kind <> 'percent' OR value <= 100),
  CONSTRAINT student_discounts_periodo CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

COMMENT ON TABLE public.student_discounts IS
  'Bolsas e descontos por aluno (percentual ou valor fixo), com vigência opcional.';

CREATE INDEX IF NOT EXISTS idx_student_discounts_ativos
  ON public.student_discounts (student_id) WHERE active;

-- ── Fatura / mensalidade ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES public.tenants(id),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.student_plan_subscriptions(id) ON DELETE SET NULL,
  -- Competência: sempre o dia 1 do mês a que a mensalidade se refere.
  competence      DATE NOT NULL CHECK (competence = date_trunc('month', competence::timestamp)::date),
  base_amount     NUMERIC(10,2) NOT NULL CHECK (base_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount    NUMERIC(10,2) NOT NULL CHECK (final_amount >= 0),
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','paga','vencida','cancelada','negociada')),
  payment_method  TEXT CHECK (payment_method IN ('pix','dinheiro','cartao','transferencia','boleto')),
  paid_at         TIMESTAMPTZ,
  paid_amount     NUMERIC(10,2) CHECK (paid_amount IS NULL OR paid_amount >= 0),
  recorded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Reservados para integração futura com gateway (Asaas, Iugu, ...):
  external_id     TEXT,
  gateway         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoices IS
  'Mensalidades/faturas dos alunos. Uma por aluno/competência (canceladas fora do unique, permitindo reemissão).';

-- Unique parcial: garante idempotência da geração em lote e ainda permite
-- reemitir uma fatura depois de cancelada.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_student_competence
  ON public.invoices (student_id, competence) WHERE status <> 'cancelada';

CREATE INDEX IF NOT EXISTS idx_invoices_competence_status ON public.invoices (competence, status);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON public.invoices (student_id, competence DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_a_vencer
  ON public.invoices (due_date) WHERE status IN ('aberta','vencida','negociada');

-- ── Histórico por fatura (append-only) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('criada','pagamento','cancelamento','renegociacao','observacao')),
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_events IS
  'Trilha de auditoria da fatura: criação, pagamento, cancelamento, renegociação, observações.';

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice
  ON public.invoice_events (invoice_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.tuition_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_plan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_events             ENABLE ROW LEVEL SECURITY;

-- Admin/secretaria: gestão completa (mesmo padrão de student_guardians).
DROP POLICY IF EXISTS tuition_plans_staff_all ON public.tuition_plans;
CREATE POLICY tuition_plans_staff_all ON public.tuition_plans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

DROP POLICY IF EXISTS student_plan_subscriptions_staff_all ON public.student_plan_subscriptions;
CREATE POLICY student_plan_subscriptions_staff_all ON public.student_plan_subscriptions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

DROP POLICY IF EXISTS student_discounts_staff_all ON public.student_discounts;
CREATE POLICY student_discounts_staff_all ON public.student_discounts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

DROP POLICY IF EXISTS invoices_staff_all ON public.invoices;
CREATE POLICY invoices_staff_all ON public.invoices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

DROP POLICY IF EXISTS invoice_events_staff_all ON public.invoice_events;
CREATE POLICY invoice_events_staff_all ON public.invoice_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

-- Aluno: leitura do que é dele. Nunca escreve — pagamento é registrado pela
-- secretaria (e as mutações passam por RPC SECURITY DEFINER).
DROP POLICY IF EXISTS invoices_aluno_select ON public.invoices;
CREATE POLICY invoices_aluno_select ON public.invoices
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS invoice_events_aluno_select ON public.invoice_events;
CREATE POLICY invoice_events_aluno_select ON public.invoice_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.student_id = auth.uid()));

DROP POLICY IF EXISTS student_plan_subscriptions_aluno_select ON public.student_plan_subscriptions;
CREATE POLICY student_plan_subscriptions_aluno_select ON public.student_plan_subscriptions
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS student_discounts_aluno_select ON public.student_discounts;
CREATE POLICY student_discounts_aluno_select ON public.student_discounts
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- Aluno precisa ler o plano vinculado a ele (nome/valor/vencimento).
DROP POLICY IF EXISTS tuition_plans_aluno_select ON public.tuition_plans;
CREATE POLICY tuition_plans_aluno_select ON public.tuition_plans
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_plan_subscriptions s
    WHERE s.plan_id = id AND s.student_id = auth.uid()
  ));
