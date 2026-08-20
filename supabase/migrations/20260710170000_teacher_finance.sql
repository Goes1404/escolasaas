-- ============================================================
-- Migration: 20260710170000_teacher_finance.sql
-- Roadmap Secretaria · Onda 3 — Financeiro dos professores.
--   3.1 teacher_rates: valor a pagar vigente por professor.
--   3.2 teacher_payments: recibos/pagamentos por período.
--
-- RLS: admin/staff gerenciam tudo; o professor vê apenas os próprios
-- (valor e recibos). Papel checado por profiles.role.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teacher_rates (
  teacher_id  UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rate_type   TEXT        NOT NULL DEFAULT 'monthly',
  amount      NUMERIC     NOT NULL DEFAULT 0,
  notes       TEXT,
  updated_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_month TEXT        NOT NULL,
  amount          NUMERIC     NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_teacher_payments_teacher ON public.teacher_payments(teacher_id, reference_month);

ALTER TABLE public.teacher_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.teacher_rates TO authenticated, service_role;
GRANT ALL ON public.teacher_payments TO authenticated, service_role;

DROP POLICY IF EXISTS "teacher_rates_manage_staff" ON public.teacher_rates;
CREATE POLICY "teacher_rates_manage_staff" ON public.teacher_rates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')));
DROP POLICY IF EXISTS "teacher_rates_select_own" ON public.teacher_rates;
CREATE POLICY "teacher_rates_select_own" ON public.teacher_rates
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_payments_manage_staff" ON public.teacher_payments;
CREATE POLICY "teacher_payments_manage_staff" ON public.teacher_payments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role::text IN ('admin','staff')));
DROP POLICY IF EXISTS "teacher_payments_select_own" ON public.teacher_payments;
CREATE POLICY "teacher_payments_select_own" ON public.teacher_payments
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());
