-- RPCs do portal do responsável (página pública /guardian/[token]).
--
-- A página não tem sessão: todo acesso passa por estas duas funções, que
-- validam o token e devolvem SOMENTE os dados do aluno daquele responsável.
-- Token inválido, revogado ou expirado retorna NULL sem distinguir o motivo
-- (não dar oráculo a quem tenta adivinhar tokens).

-- ── Payload completo do portal em uma chamada ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_guardian_portal(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tok        public.guardian_access_tokens;
  v_student    RECORD;
  v_guardian   RECORD;
  v_streak     RECORD;
  v_freq       JSONB;
  v_boletim    JSONB;
  v_financeiro JSONB;
  v_comunicados JSONB;
  v_answers    BIGINT;
  v_corrects   BIGINT;
  v_essays     BIGINT;
BEGIN
  SELECT * INTO v_tok
  FROM public.guardian_access_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_tok.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.guardian_access_tokens
  SET last_access_at = now(), access_count = access_count + 1
  WHERE id = v_tok.id;

  SELECT id, name, full_name, exam_target, sala, turno, xp_points
    INTO v_student FROM public.profiles WHERE id = v_tok.student_id;
  SELECT id, name, relationship INTO v_guardian
    FROM public.student_guardians WHERE id = v_tok.guardian_id;

  SELECT * INTO v_streak FROM public.study_streaks WHERE user_id = v_tok.student_id;

  SELECT count(*), count(*) FILTER (WHERE is_correct)
    INTO v_answers, v_corrects
  FROM public.student_question_answers WHERE student_id = v_tok.student_id;

  SELECT count(*) INTO v_essays
  FROM public.essay_submissions WHERE user_id = v_tok.student_id;

  -- Frequência: agregado + últimos 10 registros.
  SELECT jsonb_build_object(
    'presencas', count(*) FILTER (WHERE ar.status = 'present'),
    'faltas',    count(*) FILTER (WHERE ar.status <> 'present'),
    'total',     count(*),
    'pct', CASE WHEN count(*) > 0
      THEN round(100.0 * count(*) FILTER (WHERE ar.status = 'present') / count(*))
      ELSE NULL END,
    'ultimas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'data', cs2.session_date, 'titulo', cs2.title, 'status', ar2.status
      ) ORDER BY cs2.session_date DESC)
      FROM (
        SELECT ar3.status, ar3.session_id
        FROM public.attendance_records ar3
        JOIN public.class_sessions cs3 ON cs3.id = ar3.session_id
        WHERE ar3.student_id = v_tok.student_id
        ORDER BY cs3.session_date DESC
        LIMIT 10
      ) ar2
      JOIN public.class_sessions cs2 ON cs2.id = ar2.session_id
    ), '[]'::jsonb)
  ) INTO v_freq
  FROM public.attendance_records ar
  WHERE ar.student_id = v_tok.student_id;

  -- Boletim (importado): entradas gerais e ENEM.
  SELECT jsonb_build_object(
    'geral', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'semestre', semester, 'trilha', track,
        'classificatoria', classificatoria_score, 'classificatoria_max', classificatoria_max,
        'simulado', simulado_score, 'simulado_max', simulado_max,
        'redacao', redacao_score, 'redacao_max', redacao_max,
        'faltas_1sem', absences_1sem, 'faltas_2sem', absences_2sem
      ) ORDER BY semester)
      FROM public.report_card_entries WHERE student_id = v_tok.student_id
    ), '[]'::jsonb),
    'enem', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'semestre', semester,
        'lingua_portuguesa', lingua_portuguesa, 'matematica', matematica,
        'historia', historia, 'geografia', geografia, 'biologia', biologia,
        'quimica', quimica, 'fisica', fisica, 'redacao', redacao_score
      ) ORDER BY semester)
      FROM public.report_card_entries_enem WHERE student_id = v_tok.student_id
    ), '[]'::jsonb)
  ) INTO v_boletim;

  -- Financeiro: faturas do aluno (sem CPF, sem nada de outros alunos).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'competencia', competence, 'valor', final_amount, 'desconto', discount_amount,
    'vencimento', due_date,
    'status', CASE WHEN status = 'aberta' AND due_date < CURRENT_DATE THEN 'vencida' ELSE status END,
    'pago_em', paid_at, 'forma', payment_method
  ) ORDER BY competence DESC), '[]'::jsonb)
    INTO v_financeiro
  FROM public.invoices
  WHERE student_id = v_tok.student_id AND status <> 'cancelada';

  -- Comunicados destinados a responsáveis, com flag de leitura DESTE responsável.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'titulo', a.title, 'mensagem', a.message,
    'prioridade', a.priority, 'criado_em', a.created_at,
    'lido', (r.id IS NOT NULL), 'lido_em', r.read_at
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_comunicados
  FROM public.announcements a
  LEFT JOIN public.guardian_announcement_reads r
    ON r.announcement_id = a.id AND r.guardian_id = v_tok.guardian_id
  WHERE a.audience IN ('guardians','all');

  RETURN jsonb_build_object(
    'aluno', jsonb_build_object(
      'nome', COALESCE(v_student.full_name, v_student.name),
      'trilha', v_student.exam_target, 'sala', v_student.sala, 'turno', v_student.turno
    ),
    'responsavel', jsonb_build_object('nome', v_guardian.name, 'parentesco', v_guardian.relationship),
    'engajamento', jsonb_build_object(
      'xp', COALESCE(v_student.xp_points, 0),
      'ofensiva', COALESCE(v_streak.current_streak, 0),
      'recorde', COALESCE(v_streak.longest_streak, 0),
      'dias_estudo', COALESCE(v_streak.total_study_days, 0),
      'questoes_respondidas', COALESCE(v_answers, 0),
      'questoes_certas', COALESCE(v_corrects, 0),
      'redacoes_enviadas', COALESCE(v_essays, 0),
      'ultima_atividade', v_streak.last_activity_date
    ),
    'frequencia', v_freq,
    'boletim', v_boletim,
    'financeiro', v_financeiro,
    'comunicados', v_comunicados
  );
END;
$function$;

-- ── Confirmar leitura de comunicado ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ack_guardian_announcement(p_token TEXT, p_announcement_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tok public.guardian_access_tokens;
BEGIN
  SELECT * INTO v_tok
  FROM public.guardian_access_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_tok.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Só comunicados que o responsável realmente enxerga.
  IF NOT EXISTS (
    SELECT 1 FROM public.announcements
    WHERE id = p_announcement_id AND audience IN ('guardians','all')
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.guardian_announcement_reads (announcement_id, guardian_id)
  VALUES (p_announcement_id, v_tok.guardian_id)
  ON CONFLICT (announcement_id, guardian_id) DO NOTHING;

  RETURN TRUE;
END;
$function$;

-- Página pública: anon precisa executar. O que cada token enxerga é decidido
-- dentro da função, nunca por policy.
REVOKE ALL ON FUNCTION public.get_guardian_portal(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ack_guardian_announcement(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_portal(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_guardian_announcement(TEXT, UUID) TO anon, authenticated;
