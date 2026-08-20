# Design: Importação de questões da ETEC (extração de provas oficiais)

**Data:** 2026-07-05
**Status:** Aprovado (fonte: provas oficiais; escopo: vários anos; imagens: pular)

## Contexto

Não existe API pública de questões da ETEC (a enem.dev é só ENEM). As provas do
Vestibulinho (Centro Paula Souza) são públicas em PDF, com gabarito oficial.

Verificado ao vivo:
- Páginas por edição: `vestibulinho.etec.sp.gov.br/provas-gabaritos/detalhe.asp?q=<ANO>`
  (2017–2026; requer User-Agent de navegador).
- PDFs diretos em S3: `.../Prova.pdf` e `.../Gabarito.pdf` (públicos).
- Gabarito: tabela `NNN <letra> <critério>` → 50 respostas oficiais.
- Prova: `pdftotext -layout -enc UTF-8` extrai texto limpo. Marcadores `Questão NN`,
  alternativas `(A)`–`(E)`, textos de apoio compartilhados ("para responder às questões X a Y").
- **A prova é interdisciplinar e NÃO rotula a matéria** (gabarito só traz competências C1–C5)
  → matéria e micro-tópico são definidos por IA (reuso do classificador ENEM).

## Decisões

- **Fonte:** provas oficiais (gabarito confiável).
- **Escopo:** vários anos de uma vez.
- **Imagens:** pdftotext não captura imagens → **pular** questões que dependem de imagem
  (mapa/charge/gráfico), inserindo só as 100% textuais e completas.

## Arquitetura (2 passos — cada ferramenta no que faz melhor)

O Node não invoca o `pdftotext` do Git (falta PATH/DLLs). Separa-se:

### Passo 1 — `scripts/fetch-etec-pdfs.sh` (Bash)
Varre as edições, extrai os links `Prova.pdf`/`Gabarito.pdf`, baixa e roda
`pdftotext -layout -enc UTF-8`, salvando em uma pasta de trabalho:
`<ano>-<seq>.prova.txt` e `<ano>-<seq>.gabarito.txt`.

### Passo 2 — `scripts/import-etec.ts` (Node, `npm run import:etec`)
Para cada par de `.txt` na pasta:
1. `parseGabarito` → `{ nº: letra }` (respostas oficiais).
2. `segmentQuestions` (regex `Questão\s+NN`) → blocos brutos + preâmbulo de apoio.
3. `structureQuestionsBatch` (IA gpt-4o, JSON+zod) → `{ number, question_text,
   supporting_text, options[A-E], depends_on_image }`.
4. **Filtra**: descarta `depends_on_image` e as sem gabarito/alternativas completas.
5. Cruza com o gabarito → `correct_answer`.
6. Classifica **matéria** (candidatas ETEC) e **micro-tópico** (reuso `classifyIntoCategories`).
7. Insere: cria `exams` (`exam_type='etec'`), `questions` (`target_audience='etec'`,
   `micro_topic_id`), vincula `exam_questions`. Dedup por hash (como o ENEM).

### `src/services/etec-extractor.ts`
`parseGabarito`, `segmentQuestions`, `structureQuestionsBatch` — puro, testável.

## Matérias candidatas (ETEC, ensino fundamental)
Matemática, Português, História, Geografia, Física, Química, Biologia, Inglês, Literatura, Arte.
Micro-tópicos: taxonomia existente (`MICRO_TOPICS_BY_SUBJECT`), restrita à matéria escolhida.

## Segurança & robustez
- Idempotente: dedup por `question_hash`; re-rodar não duplica.
- `--dry-run` (mostra amostra estruturada + distribuição, sem escrever).
- Só insere questão com enunciado + 5 alternativas + gabarito casado.
- gpt-4o para estruturação (precisão do enunciado); gpt-4o-mini para classificação.
- Erros por prova/lote logados sem abortar o restante.

## Fora de escopo (YAGNI)
- OCR/visão de imagens (questões com imagem são puladas).
- UI de importação ETEC (usa o script; o Motor de Provas da UI continua para uploads manuais).
