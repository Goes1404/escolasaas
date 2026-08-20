-- ============================================================
-- SEED: DATAS DE VESTIBULARES 2026 / 2027
-- Compromisso 360 | Migration 20260522310000
--
-- Datas baseadas no calendário histórico de cada processo.
-- Descrições marcadas como (ESTIMADO) podem ser ajustadas
-- pelo admin quando o edital oficial for publicado.
-- created_by = NULL → eventos oficiais, apenas admins editam.
-- ============================================================

INSERT INTO public.academic_events
  (title, description, event_date, event_type, target_group, is_official, created_by)
VALUES

-- ════════════════════════════════════════════════════
-- ENEM 2026
-- ════════════════════════════════════════════════════
('ENEM 2026 — Abertura das Inscrições',
 'Início do período de inscrição no ENEM 2026. Acesse enem.inep.gov.br para se inscrever. (ESTIMADO)',
 '2026-05-27', 'abertura_inscricao', 'enem', TRUE, NULL),

('ENEM 2026 — Fechamento das Inscrições',
 'Último dia para se inscrever no ENEM 2026 e gerar o boleto de pagamento. (ESTIMADO)',
 '2026-06-07', 'fechamento_inscricao', 'enem', TRUE, NULL),

('ENEM 2026 — Prova Dia 1',
 'Linguagens, Códigos e suas Tecnologias + Ciências Humanas + Redação. Duração: 5h30. (ESTIMADO)',
 '2026-11-01', 'vestibular', 'enem', TRUE, NULL),

('ENEM 2026 — Prova Dia 2',
 'Ciências da Natureza e suas Tecnologias + Matemática. Duração: 5h. (ESTIMADO)',
 '2026-11-08', 'vestibular', 'enem', TRUE, NULL),

('ENEM 2026 — Gabarito Oficial',
 'Publicação do gabarito definitivo pelo INEP no portal do participante. (ESTIMADO)',
 '2026-11-12', 'resultado', 'enem', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- FUVEST 2027 (USP / Santa Casa / outras)
-- ════════════════════════════════════════════════════
('FUVEST 2027 — Abertura das Inscrições',
 'Início do período de inscrição para a FUVEST 2027. Acesse fuvest.br. (ESTIMADO)',
 '2026-07-01', 'abertura_inscricao', 'enem', TRUE, NULL),

('FUVEST 2027 — Fechamento das Inscrições',
 'Último dia para inscrição na FUVEST 2027. (ESTIMADO)',
 '2026-08-15', 'fechamento_inscricao', 'enem', TRUE, NULL),

('FUVEST 2027 — 1ª Fase',
 '90 questões objetivas de múltipla escolha. Duração: 5h. Local: conforme comprovante. (ESTIMADO)',
 '2026-11-22', 'vestibular', 'enem', TRUE, NULL),

('FUVEST 2027 — Resultado 1ª Fase',
 'Divulgação dos convocados para a 2ª fase da FUVEST 2027. (ESTIMADO)',
 '2026-12-18', 'resultado', 'enem', TRUE, NULL),

('FUVEST 2027 — 2ª Fase Dia 1',
 'Questões dissertativas de Língua Portuguesa, Literatura, Idiomas e Redação. (ESTIMADO)',
 '2027-01-11', 'vestibular', 'enem', TRUE, NULL),

('FUVEST 2027 — 2ª Fase Dia 2',
 'Questões dissertativas das disciplinas específicas do curso escolhido. (ESTIMADO)',
 '2027-01-12', 'vestibular', 'enem', TRUE, NULL),

('FUVEST 2027 — Resultado Final',
 'Divulgação da lista de aprovados em 1ª chamada da FUVEST 2027. (ESTIMADO)',
 '2027-02-08', 'resultado', 'enem', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- UNICAMP 2027 (COMVEST)
-- ════════════════════════════════════════════════════
('UNICAMP 2027 — Abertura das Inscrições',
 'Início das inscrições no COMVEST para ingresso na Unicamp em 2027. Acesse comvest.unicamp.br. (ESTIMADO)',
 '2026-08-03', 'abertura_inscricao', 'enem', TRUE, NULL),

('UNICAMP 2027 — Fechamento das Inscrições',
 'Último dia para inscrição no vestibular da Unicamp 2027. (ESTIMADO)',
 '2026-09-14', 'fechamento_inscricao', 'enem', TRUE, NULL),

('UNICAMP 2027 — 1ª Fase',
 '96 questões objetivas. Duração: 5h. (ESTIMADO)',
 '2026-10-18', 'vestibular', 'enem', TRUE, NULL),

('UNICAMP 2027 — 2ª Fase Dia 1',
 'Provas discursivas (Redação + disciplinas). (ESTIMADO)',
 '2027-01-04', 'vestibular', 'enem', TRUE, NULL),

('UNICAMP 2027 — 2ª Fase Dia 2',
 'Provas discursivas (disciplinas específicas do curso). (ESTIMADO)',
 '2027-01-05', 'vestibular', 'enem', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- UNESP 2027 (VUNESP)
-- ════════════════════════════════════════════════════
('UNESP 2027 — Abertura das Inscrições',
 'Início das inscrições no vestibular da UNESP 2027. Acesse vunesp.com.br. (ESTIMADO)',
 '2026-08-20', 'abertura_inscricao', 'enem', TRUE, NULL),

('UNESP 2027 — Fechamento das Inscrições',
 'Último dia para inscrição no vestibular da UNESP 2027. (ESTIMADO)',
 '2026-09-25', 'fechamento_inscricao', 'enem', TRUE, NULL),

('UNESP 2027 — Prova (Fase Única)',
 'Prova única do vestibular UNESP 2027 — questões objetivas e redação. (ESTIMADO)',
 '2026-11-15', 'vestibular', 'enem', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- ETEC Vestibulinho 2026 / 2º semestre
-- ════════════════════════════════════════════════════
('ETEC Vestibulinho 2026/2 — Abertura das Inscrições',
 'Início das inscrições para o Vestibulinho das Escolas Técnicas do Estado de SP — 2º semestre de 2026. Acesse vestibulinhoetec.com.br. (ESTIMADO)',
 '2026-07-06', 'abertura_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2026/2 — Fechamento das Inscrições',
 'Último dia para se inscrever no Vestibulinho ETEC 2026/2. (ESTIMADO)',
 '2026-07-18', 'fechamento_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2026/2 — Prova',
 'Aplicação da prova do Vestibulinho ETEC 2026/2. Duração: 3h. (ESTIMADO)',
 '2026-08-09', 'vestibular', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2026/2 — Resultado',
 'Divulgação da lista de aprovados no Vestibulinho ETEC 2026/2. (ESTIMADO)',
 '2026-09-02', 'resultado', 'etec', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- ETEC Vestibulinho 2027 / 1º semestre
-- ════════════════════════════════════════════════════
('ETEC Vestibulinho 2027/1 — Abertura das Inscrições',
 'Início das inscrições para o Vestibulinho ETEC 2027/1. Acesse vestibulinhoetec.com.br. (ESTIMADO)',
 '2026-11-04', 'abertura_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2027/1 — Fechamento das Inscrições',
 'Último dia para inscrição no Vestibulinho ETEC 2027/1. (ESTIMADO)',
 '2026-11-19', 'fechamento_inscricao', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2027/1 — Prova',
 'Aplicação da prova do Vestibulinho ETEC 2027/1. Duração: 3h. (ESTIMADO)',
 '2026-12-13', 'vestibular', 'etec', TRUE, NULL),

('ETEC Vestibulinho 2027/1 — Resultado',
 'Divulgação da lista de aprovados no Vestibulinho ETEC 2027/1. (ESTIMADO)',
 '2027-01-15', 'resultado', 'etec', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- FATEC 2027 / 1º semestre
-- ════════════════════════════════════════════════════
('FATEC 2027/1 — Abertura das Inscrições',
 'Início das inscrições para o Vestibular FATEC 2027/1. Acesse vestibularfatec.com.br. (ESTIMADO)',
 '2026-09-01', 'abertura_inscricao', 'etec', TRUE, NULL),

('FATEC 2027/1 — Fechamento das Inscrições',
 'Último dia para inscrição no Vestibular FATEC 2027/1. (ESTIMADO)',
 '2026-10-05', 'fechamento_inscricao', 'etec', TRUE, NULL),

('FATEC 2027/1 — Prova',
 'Aplicação da prova do Vestibular FATEC 2027/1. Duração: 3h30. (ESTIMADO)',
 '2026-12-06', 'vestibular', 'etec', TRUE, NULL),

('FATEC 2027/1 — Resultado',
 'Divulgação dos aprovados no Vestibular FATEC 2027/1. (ESTIMADO)',
 '2027-01-10', 'resultado', 'etec', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- SISU 2027 (baseado nas notas do ENEM 2026)
-- ════════════════════════════════════════════════════
('SISU 2027 — Abertura das Inscrições',
 'Início das inscrições no SISU 2027. Utilize sua nota do ENEM 2026 para concorrer a vagas em universidades federais. (ESTIMADO)',
 '2027-01-20', 'abertura_inscricao', 'enem', TRUE, NULL),

('SISU 2027 — Fechamento das Inscrições',
 'Último dia para alterar opções de curso no SISU 2027. (ESTIMADO)',
 '2027-01-25', 'fechamento_inscricao', 'enem', TRUE, NULL),

('SISU 2027 — Resultado (Chamada Regular)',
 'Divulgação dos selecionados na chamada regular do SISU 2027. (ESTIMADO)',
 '2027-02-05', 'resultado', 'enem', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- PROUNI 2027
-- ════════════════════════════════════════════════════
('PROUNI 2027 — Abertura das Inscrições',
 'Início das inscrições no ProUni 2027 — bolsas em faculdades particulares usando nota do ENEM 2026. (ESTIMADO)',
 '2027-01-27', 'abertura_inscricao', 'enem', TRUE, NULL),

('PROUNI 2027 — Fechamento das Inscrições',
 'Último dia para se inscrever no ProUni 2027. (ESTIMADO)',
 '2027-02-01', 'fechamento_inscricao', 'enem', TRUE, NULL),

('PROUNI 2027 — Resultado 1ª Chamada',
 'Divulgação dos aprovados na 1ª chamada do ProUni 2027. (ESTIMADO)',
 '2027-02-10', 'resultado', 'enem', TRUE, NULL),

-- ════════════════════════════════════════════════════
-- FIES 2027 (Financiamento Estudantil)
-- ════════════════════════════════════════════════════
('FIES 2027 — Inscrições',
 'Período de inscrição no FIES 2027 (Fundo de Financiamento Estudantil). Use sua nota do ENEM. (ESTIMADO)',
 '2027-02-12', 'abertura_inscricao', 'enem', TRUE, NULL)

ON CONFLICT DO NOTHING;
