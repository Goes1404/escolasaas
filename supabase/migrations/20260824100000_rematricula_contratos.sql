-- Rematrícula digital com aceite eletrônico simples.
--
-- Campanha (por ano letivo, com template de contrato e plano de cobrança do
-- ano seguinte) + adesão por aluno. O aceite grava snapshot imutável do
-- contrato renderizado, nome/CPF do signatário, IP e user-agent — aceite
-- eletrônico simples (MP 2.200-2, art. 10 §2º), não assinatura certificada.
-- O aceite SÓ acontece pelas rotas de API (que fornecem o IP real do
-- servidor): as funções accept/refuse são EXECUTE apenas para service_role.

CREATE TABLE IF NOT EXISTS public.reenrollment_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES public.tenants(id),
  school_year       INTEGER NOT NULL,
  title             TEXT NOT NULL,
  -- Placeholders suportados: {{aluno}}, {{valor}}, {{ano}}
  contract_template TEXT NOT NULL,
  plan_id           UUID NOT NULL REFERENCES public.tuition_plans(id),
  starts_at         DATE,
  ends_at           DATE,
  status            TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativa','encerrada')),
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reenrollment_campaigns_uma_por_ano UNIQUE (tenant_id, school_year)
);

COMMENT ON TABLE public.reenrollment_campaigns IS
  'Campanha de rematricula por ano letivo. plan_id define o plano de mensalidade que o aceite ativa.';

CREATE TABLE IF NOT EXISTS public.reenrollment_agreements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES public.reenrollment_campaigns(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','recusado')),
  decided_at          TIMESTAMPTZ,
  signer_name         TEXT,
  signer_cpf          TEXT,
  signer_relationship TEXT,
  signed_via          TEXT CHECK (signed_via IN ('student_portal','guardian_portal')),
  signer_guardian_id  UUID REFERENCES public.student_guardians(id) ON DELETE SET NULL,
  ip_address          INET,
  user_agent          TEXT,
  -- Snapshot do contrato como exibido no momento do aceite. Imutável.
  contract_snapshot   TEXT,
  amount_snapshot     NUMERIC(10,2),
  refusal_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reenrollment_agreements_unico UNIQUE (campaign_id, student_id)
);

COMMENT ON TABLE public.reenrollment_agreements IS
  'Adesao de cada aluno a uma campanha de rematricula, com trilha de auditoria do aceite (nome+CPF+IP+UA+snapshot).';

CREATE INDEX IF NOT EXISTS idx_reenrollment_agreements_campaign
  ON public.reenrollment_agreements (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_reenrollment_agreements_student
  ON public.reenrollment_agreements (student_id);

ALTER TABLE public.reenrollment_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reenrollment_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reenrollment_campaigns_staff_all ON public.reenrollment_campaigns;
CREATE POLICY reenrollment_campaigns_staff_all ON public.reenrollment_campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

-- Aluno lê a campanha ATIVA (precisa ver o contrato para aceitar).
DROP POLICY IF EXISTS reenrollment_campaigns_aluno_select ON public.reenrollment_campaigns;
CREATE POLICY reenrollment_campaigns_aluno_select ON public.reenrollment_campaigns
  FOR SELECT TO authenticated USING (status = 'ativa');

DROP POLICY IF EXISTS reenrollment_agreements_staff_all ON public.reenrollment_agreements;
CREATE POLICY reenrollment_agreements_staff_all ON public.reenrollment_agreements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')));

-- Aluno lê a própria adesão. O aceite NÃO passa por RLS: só via rota + função.
DROP POLICY IF EXISTS reenrollment_agreements_aluno_select ON public.reenrollment_agreements;
CREATE POLICY reenrollment_agreements_aluno_select ON public.reenrollment_agreements
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- ── Abrir campanha (staff): ativa e semeia pendências ───────────────────────
CREATE OR REPLACE FUNCTION public.open_reenrollment_campaign(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_camp public.reenrollment_campaigns;
  v_n    INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role::text IN ('admin','staff')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para abrir campanha.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_camp FROM public.reenrollment_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_camp.id IS NULL THEN
    RAISE EXCEPTION 'Campanha inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_camp.status = 'encerrada' THEN
    RAISE EXCEPTION 'Campanha encerrada nao pode ser reaberta.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.reenrollment_campaigns SET status = 'ativa', updated_at = now()
  WHERE id = p_campaign_id;

  -- Seed reexecutável: alunos que entraram depois ganham pendência ao reabrir.
  INSERT INTO public.reenrollment_agreements (campaign_id, student_id)
  SELECT p_campaign_id, pr.id
  FROM public.profiles pr
  WHERE pr.role::text = 'student' AND COALESCE(pr.status, 'active') = 'active'
  ON CONFLICT (campaign_id, student_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('novas_pendencias', v_n);
END;
$function$;

-- ── Aceite / recusa (SÓ service_role — o IP vem das rotas de API) ───────────
CREATE OR REPLACE FUNCTION public.accept_reenrollment(
  p_agreement_id UUID,
  p_signer_name  TEXT,
  p_signer_cpf   TEXT,
  p_via          TEXT,
  p_guardian_id  UUID DEFAULT NULL,
  p_ip           INET DEFAULT NULL,
  p_user_agent   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ag       public.reenrollment_agreements;
  v_camp     public.reenrollment_campaigns;
  v_aluno    TEXT;
  v_valor    NUMERIC(10,2);
  v_contrato TEXT;
BEGIN
  IF p_signer_name IS NULL OR length(btrim(p_signer_name)) < 3 THEN
    RAISE EXCEPTION 'Nome do signatario obrigatorio.' USING ERRCODE = '22023';
  END IF;
  IF p_via IS NULL OR p_via NOT IN ('student_portal','guardian_portal') THEN
    RAISE EXCEPTION 'Origem do aceite invalida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ag FROM public.reenrollment_agreements WHERE id = p_agreement_id FOR UPDATE;
  IF v_ag.id IS NULL THEN
    RAISE EXCEPTION 'Adesao inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_ag.status <> 'pendente' THEN
    RAISE EXCEPTION 'Adesao ja decidida (%).', v_ag.status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_camp FROM public.reenrollment_campaigns WHERE id = v_ag.campaign_id;
  IF v_camp.status <> 'ativa' THEN
    RAISE EXCEPTION 'Campanha nao esta ativa.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(full_name, name) INTO v_aluno FROM public.profiles WHERE id = v_ag.student_id;
  SELECT base_amount INTO v_valor FROM public.tuition_plans WHERE id = v_camp.plan_id;

  -- Renderiza o contrato NO BANCO, garantindo que o snapshot é o texto oficial.
  v_contrato := replace(replace(replace(v_camp.contract_template,
      '{{aluno}}', COALESCE(v_aluno, '')),
      '{{valor}}', to_char(v_valor, 'FM999G999D00')),
      '{{ano}}', v_camp.school_year::text);

  UPDATE public.reenrollment_agreements SET
    status              = 'aceito',
    decided_at          = now(),
    signer_name         = btrim(p_signer_name),
    signer_cpf          = p_signer_cpf,
    signed_via          = p_via,
    signer_guardian_id  = p_guardian_id,
    ip_address          = p_ip,
    user_agent          = p_user_agent,
    contract_snapshot   = v_contrato,
    amount_snapshot     = v_valor,
    updated_at          = now()
  WHERE id = p_agreement_id;

  -- Fecha o ciclo com o financeiro: aceite ativa o plano do ano da campanha.
  INSERT INTO public.student_plan_subscriptions (student_id, plan_id, school_year)
  VALUES (v_ag.student_id, v_camp.plan_id, v_camp.school_year)
  ON CONFLICT (student_id, school_year) DO NOTHING;

  RETURN jsonb_build_object('status', 'aceito', 'ano', v_camp.school_year, 'valor', v_valor);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refuse_reenrollment(
  p_agreement_id UUID,
  p_reason       TEXT DEFAULT NULL,
  p_via          TEXT DEFAULT 'student_portal',
  p_guardian_id  UUID DEFAULT NULL,
  p_ip           INET DEFAULT NULL,
  p_user_agent   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ag public.reenrollment_agreements;
BEGIN
  SELECT * INTO v_ag FROM public.reenrollment_agreements WHERE id = p_agreement_id FOR UPDATE;
  IF v_ag.id IS NULL THEN
    RAISE EXCEPTION 'Adesao inexistente.' USING ERRCODE = '22023';
  END IF;
  IF v_ag.status <> 'pendente' THEN
    RAISE EXCEPTION 'Adesao ja decidida (%).', v_ag.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.reenrollment_agreements SET
    status             = 'recusado',
    decided_at         = now(),
    refusal_reason     = p_reason,
    signed_via         = p_via,
    signer_guardian_id = p_guardian_id,
    ip_address         = p_ip,
    user_agent         = p_user_agent,
    updated_at         = now()
  WHERE id = p_agreement_id;

  RETURN jsonb_build_object('status', 'recusado');
END;
$function$;

-- Permissões: abrir campanha é do staff logado; aceite/recusa só via rotas
-- server-side (service_role), porque o IP não pode vir do cliente.
REVOKE ALL ON FUNCTION public.open_reenrollment_campaign(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_reenrollment_campaign(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_reenrollment(UUID, TEXT, TEXT, TEXT, UUID, INET, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refuse_reenrollment(UUID, TEXT, TEXT, UUID, INET, TEXT) FROM PUBLIC, anon, authenticated;

-- ── Portal do responsável: bloco de rematrícula no payload ──────────────────
-- (estende get_guardian_portal sem reescrever a função inteira: wrapper leve)
CREATE OR REPLACE FUNCTION public.get_guardian_reenrollment(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tok  public.guardian_access_tokens;
  v_out  JSONB;
BEGIN
  SELECT * INTO v_tok
  FROM public.guardian_access_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_tok.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'agreement_id', a.id,
    'status', a.status,
    'decidido_em', a.decided_at,
    'campanha', c.title,
    'ano', c.school_year,
    'valor', pl.base_amount,
    'contrato', replace(replace(replace(c.contract_template,
        '{{aluno}}', COALESCE(pr.full_name, pr.name, '')),
        '{{valor}}', to_char(pl.base_amount, 'FM999G999D00')),
        '{{ano}}', c.school_year::text)
  ) INTO v_out
  FROM public.reenrollment_agreements a
  JOIN public.reenrollment_campaigns c ON c.id = a.campaign_id AND c.status = 'ativa'
  JOIN public.tuition_plans pl ON pl.id = c.plan_id
  JOIN public.profiles pr ON pr.id = a.student_id
  WHERE a.student_id = v_tok.student_id
  ORDER BY c.school_year DESC
  LIMIT 1;

  RETURN v_out;  -- NULL quando não há campanha ativa para o aluno
END;
$function$;

REVOKE ALL ON FUNCTION public.get_guardian_reenrollment(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_reenrollment(TEXT) TO anon, authenticated;
