-- Funções do financeiro de mensalidades.
--
-- Todas SECURITY DEFINER com checagem de papel DENTRO da função (padrão de
-- listar_status_alunos): o cliente chama via supabase.rpc(), mas quem decide
-- é o profiles.role do chamador. Mutações ficam atômicas (fatura + evento na
-- mesma transação) e a trilha de auditoria não depende do cliente.

-- ── Gerar as mensalidades de uma competência ────────────────────────────────
-- Idempotente: o unique parcial (student_id, competence) + ON CONFLICT DO
-- NOTHING fazem a segunda execução no mesmo mês só completar o que faltar
-- (ex.: aluno vinculado a plano depois da primeira rodada).
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(p_competence DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_comp     DATE := date_trunc('month', p_competence::timestamp)::date;
  v_criadas  INTEGER := 0;
  v_puladas  INTEGER := 0;
  v_previsto NUMERIC(12,2) := 0;
  r          RECORD;
  v_base     NUMERIC(10,2);
  v_desc     NUMERIC(10,2);
  v_final    NUMERIC(10,2);
  v_due      DATE;
  v_id       UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para gerar mensalidades.' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT s.id AS subscription_id, s.student_id, s.custom_amount,
           pl.base_amount, pl.due_day, pl.tenant_id
    FROM public.student_plan_subscriptions s
    JOIN public.tuition_plans pl ON pl.id = s.plan_id
    JOIN public.profiles pr ON pr.id = s.student_id
    WHERE s.status = 'ativa'
      AND s.school_year = EXTRACT(YEAR FROM v_comp)::int
      AND COALESCE(pr.status, 'active') = 'active'
  LOOP
    v_base := COALESCE(r.custom_amount, r.base_amount);

    -- Descontos vigentes na competência: percentuais primeiro, depois fixos.
    SELECT COALESCE(SUM(CASE WHEN kind = 'percent' THEN v_base * value / 100 ELSE 0 END), 0)
         + COALESCE(SUM(CASE WHEN kind = 'fixed' THEN value ELSE 0 END), 0)
      INTO v_desc
    FROM public.student_discounts d
    WHERE d.student_id = r.student_id
      AND d.active
      AND (d.valid_from IS NULL OR d.valid_from <= v_comp)
      AND (d.valid_until IS NULL OR d.valid_until >= v_comp);

    v_desc  := LEAST(v_desc, v_base);
    v_final := GREATEST(v_base - v_desc, 0);
    v_due   := make_date(EXTRACT(YEAR FROM v_comp)::int, EXTRACT(MONTH FROM v_comp)::int, r.due_day);

    INSERT INTO public.invoices
      (tenant_id, student_id, subscription_id, competence, base_amount, discount_amount, final_amount, due_date)
    VALUES
      (r.tenant_id, r.student_id, r.subscription_id, v_comp, v_base, v_desc, v_final, v_due)
    ON CONFLICT (student_id, competence) WHERE (status <> 'cancelada') DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      v_puladas := v_puladas + 1;
    ELSE
      v_criadas  := v_criadas + 1;
      v_previsto := v_previsto + v_final;
      INSERT INTO public.invoice_events (invoice_id, action, details, actor_id)
      VALUES (v_id, 'criada',
              jsonb_build_object('base', v_base, 'desconto', v_desc, 'valor', v_final, 'vencimento', v_due),
              auth.uid());
    END IF;
  END LOOP;

  RETURN jsonb_build_object('criadas', v_criadas, 'puladas', v_puladas, 'total_previsto', v_previsto);
END;
$function$;

-- ── Registrar pagamento ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_invoice_payment(
  p_invoice_id  UUID,
  p_method      TEXT,
  p_paid_at     TIMESTAMPTZ DEFAULT now(),
  p_paid_amount NUMERIC DEFAULT NULL,
  p_notes       TEXT DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_inv public.invoices;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para registrar pagamento.' USING ERRCODE = '42501';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('pix','dinheiro','cartao','transferencia','boleto') THEN
    RAISE EXCEPTION 'Forma de pagamento invalida.' USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE: duas pessoas registrando ao mesmo tempo não pagam duas vezes.
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Fatura inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_inv.status NOT IN ('aberta','vencida','negociada') THEN
    RAISE EXCEPTION 'Fatura % nao pode receber pagamento (status %).', p_invoice_id, v_inv.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.invoices SET
    status         = 'paga',
    payment_method = p_method,
    paid_at        = COALESCE(p_paid_at, now()),
    paid_amount    = COALESCE(p_paid_amount, final_amount),
    recorded_by    = auth.uid(),
    notes          = COALESCE(p_notes, notes),
    updated_at     = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  INSERT INTO public.invoice_events (invoice_id, action, details, actor_id)
  VALUES (p_invoice_id, 'pagamento',
          jsonb_build_object('forma', p_method, 'valor', v_inv.paid_amount, 'pago_em', v_inv.paid_at,
                             'observacao', p_notes),
          auth.uid());

  RETURN v_inv;
END;
$function$;

-- ── Cancelar fatura ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id UUID, p_reason TEXT)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_inv public.invoices;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para cancelar fatura.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Fatura inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_inv.status = 'paga' THEN
    RAISE EXCEPTION 'Fatura paga nao pode ser cancelada.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.invoices SET status = 'cancelada', updated_at = now()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  INSERT INTO public.invoice_events (invoice_id, action, details, actor_id)
  VALUES (p_invoice_id, 'cancelamento', jsonb_build_object('motivo', p_reason), auth.uid());

  RETURN v_inv;
END;
$function$;

-- ── Renegociar (novo vencimento e/ou novo valor) ────────────────────────────
CREATE OR REPLACE FUNCTION public.renegotiate_invoice(
  p_invoice_id   UUID,
  p_new_due_date DATE,
  p_new_amount   NUMERIC DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_inv public.invoices;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para renegociar fatura.' USING ERRCODE = '42501';
  END IF;
  IF p_new_due_date IS NULL THEN
    RAISE EXCEPTION 'Novo vencimento obrigatorio.' USING ERRCODE = '22023';
  END IF;
  IF p_new_amount IS NOT NULL AND p_new_amount < 0 THEN
    RAISE EXCEPTION 'Valor renegociado invalido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Fatura inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_inv.status NOT IN ('aberta','vencida','negociada') THEN
    RAISE EXCEPTION 'Fatura % nao pode ser renegociada (status %).', p_invoice_id, v_inv.status
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.invoice_events (invoice_id, action, details, actor_id)
  VALUES (p_invoice_id, 'renegociacao',
          jsonb_build_object(
            'vencimento_antigo', v_inv.due_date, 'vencimento_novo', p_new_due_date,
            'valor_antigo', v_inv.final_amount, 'valor_novo', COALESCE(p_new_amount, v_inv.final_amount),
            'observacao', p_notes),
          auth.uid());

  UPDATE public.invoices SET
    status       = 'negociada',
    due_date     = p_new_due_date,
    final_amount = COALESCE(p_new_amount, final_amount),
    notes        = COALESCE(p_notes, notes),
    updated_at   = now()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$function$;

-- ── Marcar vencidas (cron diário) ───────────────────────────────────────────
-- A UI também deriva "vencida" de due_date < hoje, então nada quebra se o
-- cron falhar — este job só materializa o status para relatórios.
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.invoices SET status = 'vencida', updated_at = now()
  WHERE status = 'aberta' AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

-- ── Permissões ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.generate_monthly_invoices(DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_invoice_payment(UUID, TEXT, TIMESTAMPTZ, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_invoice(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renegotiate_invoice(UUID, DATE, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_invoice_payment(UUID, TEXT, TIMESTAMPTZ, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renegotiate_invoice(UUID, DATE, NUMERIC, TEXT) TO authenticated;

-- ── Agendamento (padrão do lembrete diário: só agenda se pg_cron existe) ────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ausente: rode mark_overdue_invoices() manualmente.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('marcar-mensalidades-vencidas')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marcar-mensalidades-vencidas');

  PERFORM cron.schedule(
    'marcar-mensalidades-vencidas',
    '0 6 * * *',
    $cron$SELECT public.mark_overdue_invoices();$cron$
  );
END
$$;
