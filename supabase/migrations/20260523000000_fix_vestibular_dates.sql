-- ============================================================
-- FIX: DATAS DE VESTIBULARES 2026 / 2027 — CORRIGIDAS
-- Compromisso 360 | Migration 20260523000000
--
-- Corrige seed anterior (20260522310000) com datas oficiais:
-- • ENEM 2026: edital INEP nº 64 (publicado 2026-05-21)
-- • FUVEST 2027: calendário revisado em 2026-05-22
-- • UNICAMP 2027: calendário COMVEST (março 2026)
-- • UNESP 2027: calendário Vunesp revisado em 2026-05-22
-- • ETEC 2026/2: calendário CPS (abril 2026)
-- • ETEC 2027/1 / FATEC / SISU / ProUni / FIES: estimativas
-- ============================================================

-- Apaga todos os eventos oficiais seedados (criados pela migration anterior)
DELETE FROM public.academic_events
WHERE is_official = TRUE AND created_by IS NULL;

-- ─────────────────────────────────────────────────────────────
-- ENEM 2026
-- Fonte: Edital INEP nº 64, publicado 2026-05-21
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.academic_events
  (title, description, event_date, event_type, target_group, is_official, created_by)
VALUES

('ENEM 2026 — Abertura das Inscrições',
 'Início do período de inscrição no ENEM 2026. Acesse enem.inep.gov.br para se inscrever.',
 '2026-05-25', 'abertura_inscricao', 'enem', TRUE, NULL),

('ENEM 2026 — Fechamento das Inscrições',
 'Último dia para se inscrever no ENEM 2026 e gerar o boleto de pagamento.',
 '2026-06-05', 'fechamento_inscricao', 'enem', TRUE, NULL),

('ENEM 2026 — Prova Dia 1',
 'Linguagens, Códigos e suas Tecnologias + Ciências Humanas + Redação. Duração: 5h30.',
 '2026-11-08', 'vestibular', 'enem', TRUE, NULL),

('ENEM 2026 — Prova Dia 2',
 'Ciências da Natureza e suas Tecnologias + Matemática. Duração: 5h.',
 '2026-11-15', 'vestibular', 'enem', TRUE, NULL),

('ENEM 2026 — Gabarito Oficial',
 'Publicação do gabarito definitivo pelo INEP (prazo: até o 10º dia útil após o Dia 2). (ESTIMADO)',
 '2026-11-27', 'resultado', 'enem', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- FUVEST 2027 (USP / Santa Casa / outras)
-- Fonte: Calendário revisado pela FUVEST em 2026-05-22
-- 1ª Fase antecipada para 01/11 — antes do ENEM — para evitar conflito
-- ─────────────────────────────────────────────────────────────
('FUVEST 2027 — Abertura das Inscrições',
 'Início do período de inscrição para a FUVEST 2027. Acesse fuvest.br.',
 '2026-08-17', 'abertura_inscricao', 'enem', TRUE, NULL),

('FUVEST 2027 — Fechamento das Inscrições',
 'Último dia para inscrição na FUVEST 2027.',
 '2026-10-09', 'fechamento_inscricao', 'enem', TRUE, NULL),

('FUVEST 2027 — 1ª Fase',
 '90 questões objetivas de múltipla escolha. Duração: 5h. Data antecipada para a semana anterior ao ENEM.',
 '2026-11-01', 'vestibular', 'enem', TRUE, NULL),

('FUVEST 2027 — Resultado 1ª Fase',
 'Divulgação dos convocados para a 2ª fase da FUVEST 2027. (ESTIMADO)',
 '2026-11-27', 'resultado', 'enem', TRUE, NULL),

('FUVEST 2027 — 2ª Fase Dia 1',
 'Questões dissertativas de Língua Portuguesa, Literatura, Idiomas e Redação.',
 '2026-12-06', 'vestibular', 'enem', TRUE, NULL),

('FUVEST 2027 — 2ª Fase Dia 2',
 'Questões dissertativas das disciplinas específicas do curso escolhido.',
 '2026-12-07', 'vestibular', 'enem', TRUE, NULL),

('FUVEST 2027 — Resultado Final',
 'Divulgação da lista de aprovados em 1ª chamada da FUVEST 2027. (ESTIMADO)',
 '2027-01-18', 'resultado', 'enem', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- UNICAMP 2027 (COMVEST)
-- Fonte: Portal Unicamp, março 2026
-- ─────────────────────────────────────────────────────────────
('UNICAMP 2027 — Abertura das Inscrições',
 'Início das inscrições no COMVEST para ingresso na Unicamp em 2027. Acesse comvest.unicamp.br.',
 '2026-08-03', 'abertura_inscricao', 'enem', TRUE, NULL),

('UNICAMP 2027 — Fechamento das Inscrições',
 'Último dia para inscrição no vestibular da Unicamp 2027.',
 '2026-08-31', 'fechamento_inscricao', 'enem', TRUE, NULL),

('UNICAMP 2027 — 1ª Fase',
 '96 questões objetivas. Duração: 5h.',
 '2026-10-18', 'vestibular', 'enem', TRUE, NULL),

('UNICAMP 2027 — 2ª Fase Dia 1',
 'Provas discursivas (Redação + disciplinas).',
 '2026-11-29', 'vestibular', 'enem', TRUE, NULL),

('UNICAMP 2027 — 2ª Fase Dia 2',
 'Provas discursivas (disciplinas específicas do curso).',
 '2026-11-30', 'vestibular', 'enem', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- UNESP 2027 (VUNESP) — agora com DUAS FASES
-- Fonte: Calendário Vunesp revisado em 2026-05-22
-- ─────────────────────────────────────────────────────────────
('UNESP 2027 — Abertura das Inscrições',
 'Início das inscrições no vestibular da UNESP 2027. Acesse vunesp.com.br.',
 '2026-09-04', 'abertura_inscricao', 'enem', TRUE, NULL),

('UNESP 2027 — Fechamento das Inscrições',
 'Último dia para inscrição no vestibular da UNESP 2027.',
 '2026-10-08', 'fechamento_inscricao', 'enem', TRUE, NULL),

('UNESP 2027 — 1ª Fase',
 'Questões objetivas de múltipla escolha.',
 '2026-11-22', 'vestibular', 'enem', TRUE, NULL),

('UNESP 2027 — 2ª Fase Dia 1',
 'Questões dissertativas e Redação.',
 '2026-12-13', 'vestibular', 'enem', TRUE, NULL),

('UNESP 2027 — 2ª Fase Dia 2',
 'Questões dissertativas das disciplinas específicas do curso.',
 '2026-12-14', 'vestibular', 'enem', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- ETEC Vestibulinho 2026/2 (ingresso 2º semestre 2026)
-- Fonte: CPS / Centro Paula Souza, abril 2026
-- ─────────────────────────────────────────────────────────────
('ETEC Vestibulinho 2026/2 — Abertura das Inscrições',
 'Início das inscrições para o Vestibulinho das Escolas Técnicas do Estado de SP — 2º semestre de 2026. Acesse vestibulinhoetec.com.br.',
 '2026-04-15', 'abertura_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2026/2 — Fechamento das Inscrições',
 'Último dia para se inscrever no Vestibulinho ETEC 2026/2.',
 '2026-05-25', 'fechamento_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2026/2 — Prova',
 'Aplicação da prova do Vestibulinho ETEC 2026/2. Duração: 3h.',
 '2026-06-21', 'vestibular', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2026/2 — Resultado',
 'Divulgação da lista de aprovados no Vestibulinho ETEC 2026/2.',
 '2026-07-15', 'resultado', 'etec', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- ETEC Vestibulinho 2027/1 (ingresso 1º semestre 2027)
-- Datas estimadas com base no calendário histórico do CPS
-- ─────────────────────────────────────────────────────────────
('ETEC Vestibulinho 2027/1 — Abertura das Inscrições',
 'Início das inscrições para o Vestibulinho ETEC 2027/1. Acesse vestibulinhoetec.com.br. (ESTIMADO)',
 '2026-08-17', 'abertura_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2027/1 — Fechamento das Inscrições',
 'Último dia para inscrição no Vestibulinho ETEC 2027/1. (ESTIMADO)',
 '2026-09-14', 'fechamento_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2027/1 — Prova',
 'Aplicação da prova do Vestibulinho ETEC 2027/1. Duração: 3h. (ESTIMADO)',
 '2026-11-29', 'vestibular', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2027/1 — Resultado',
 'Divulgação da lista de aprovados no Vestibulinho ETEC 2027/1. (ESTIMADO)',
 '2026-12-18', 'resultado', 'etec', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- FATEC 2027/1
-- Datas estimadas — edital oficial não publicado
-- ─────────────────────────────────────────────────────────────
('FATEC 2027/1 — Abertura das Inscrições',
 'Início das inscrições para o Vestibular FATEC 2027/1. Acesse vestibularfatec.com.br. (ESTIMADO)',
 '2026-09-01', 'abertura_inscricao', 'etec', TRUE, NULL),

('FATEC 2027/1 — Fechamento das Inscrições',
 'Último dia para inscrição no Vestibular FATEC 2027/1. (ESTIMADO)',
 '2026-10-05', 'fechamento_inscricao', 'etec', TRUE, NULL),

('FATEC 2027/1 — Prova',
 'Aplicação da prova do Vestibular FATEC 2027/1. Duração: 3h30. (ESTIMADO)',
 '2026-11-22', 'vestibular', 'etec', TRUE, NULL),

('FATEC 2027/1 — Resultado',
 'Divulgação dos aprovados no Vestibular FATEC 2027/1. (ESTIMADO)',
 '2027-01-10', 'resultado', 'etec', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- SISU 2027 (baseado nas notas do ENEM 2026)
-- Estimado — depende da publicação dos resultados do ENEM
-- ─────────────────────────────────────────────────────────────
('SISU 2027 — Abertura das Inscrições',
 'Início das inscrições no SISU 2027. Utilize sua nota do ENEM 2026 para concorrer a vagas em universidades federais. (ESTIMADO)',
 '2027-01-20', 'abertura_inscricao', 'enem', TRUE, NULL),

('SISU 2027 — Fechamento das Inscrições',
 'Último dia para alterar opções de curso no SISU 2027. (ESTIMADO)',
 '2027-01-25', 'fechamento_inscricao', 'enem', TRUE, NULL),

('SISU 2027 — Resultado (Chamada Regular)',
 'Divulgação dos selecionados na chamada regular do SISU 2027. (ESTIMADO)',
 '2027-02-05', 'resultado', 'enem', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- PROUNI 2027
-- ─────────────────────────────────────────────────────────────
('PROUNI 2027 — Abertura das Inscrições',
 'Início das inscrições no ProUni 2027 — bolsas em faculdades particulares usando nota do ENEM 2026. (ESTIMADO)',
 '2027-01-27', 'abertura_inscricao', 'enem', TRUE, NULL),

('PROUNI 2027 — Fechamento das Inscrições',
 'Último dia para se inscrever no ProUni 2027. (ESTIMADO)',
 '2027-02-01', 'fechamento_inscricao', 'enem', TRUE, NULL),

('PROUNI 2027 — Resultado 1ª Chamada',
 'Divulgação dos aprovados na 1ª chamada do ProUni 2027. (ESTIMADO)',
 '2027-02-10', 'resultado', 'enem', TRUE, NULL),

-- ─────────────────────────────────────────────────────────────
-- FIES 2027
-- ─────────────────────────────────────────────────────────────
('FIES 2027 — Inscrições',
 'Período de inscrição no FIES 2027 (Fundo de Financiamento Estudantil). Use sua nota do ENEM. (ESTIMADO)',
 '2027-02-12', 'abertura_inscricao', 'enem', TRUE, NULL)

ON CONFLICT DO NOTHING;
