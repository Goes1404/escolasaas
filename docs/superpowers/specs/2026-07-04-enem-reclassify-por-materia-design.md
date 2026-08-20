# Design: Reclassificação das questões ENEM por matéria (IA)

**Data:** 2026-07-04
**Status:** Aprovado (decisões via brainstorming: IA + reclassificar já importadas + Script CLI)

## Objetivo

Popular os simulados "Por Matéria" com mais questões: distribuir as questões do ENEM
já importadas — hoje presas nas 3 grandes áreas — nas matérias finas do cursinho.

## Estado real do banco (diagnóstico read-only, 2026-07-04)

- 2517 questões, todas `target_audience='enem'`.
- `enem_discipline` vazio em 100% delas → **não** serve de fonte da área. A área de
  origem está no **subject atual** (nome da área agregada).
- Blocos agregados a separar:
  - `Ciências Humanas` — 741 → História / Geografia / Filosofia / Sociologia
  - `Linguagens e Códigos` — 570 → Português / Literatura / Inglês / Espanhol / Arte / Educação Física
  - `Ciências da Natureza` — 537 → Biologia / Química / Física
- `Matemática` — 542 → **já é matéria fina; NÃO tocar.**
- Total a reclassificar: ~1848 questões.

## Decisões (brainstorming)

1. **Classificação por IA** (gpt-4o-mini, modelo já usado no projeto).
2. **Reclassificar as já importadas** (não baixar de novo).
3. **Script CLI** (operação única de legado; sem timeout; com `--dry-run`).

## Arquitetura

### 1. `src/services/enem-classifier.ts` (núcleo reutilizável, server-only)

```ts
export const AREA_TO_SUBJECTS: Record<EnemArea, string[]> = {
  'linguagens':        ['Português','Literatura','Inglês','Espanhol','Arte','Educação Física'],
  'ciencias-natureza': ['Biologia','Química','Física'],
  'ciencias-humanas':  ['História','Geografia','Filosofia','Sociologia'],
  'matematica':        ['Matemática'],
};
export type EnemArea = keyof typeof AREA_TO_SUBJECTS;

classifyBatch(
  questions: { id: string; question_text: string; supporting_text?: string | null }[],
  area: EnemArea,
  opts?: { client?: OpenAI; model?: string },
): Promise<{ id: string; subject: string }[]>
```

- `area === 'matematica'` → retorna tudo como `Matemática` sem chamar IA.
- Restringe as matérias candidatas **pela área** → menos erro, menos tokens.
- Trunca enunciado (~400 chars) + `supporting_text` (~300) para baratear.
- gpt-4o-mini com `response_format: json_object`; valida a resposta com **zod**.
- Resultados com `subject` fora da lista de candidatas são **descartados**
  (a questão não é movida) — nunca inventa matéria.

### 2. `scripts/reclassify-enem.ts` (`npm run reclassify:enem`)

```
npm run reclassify:enem -- --dry            # preview, não escreve
npm run reclassify:enem                      # aplica
npm run reclassify:enem -- --area natureza   # só uma área (natureza|humanas|linguagens|all)
npm run reclassify:enem -- --batch 20        # tamanho do lote de IA
```

Fluxo:
1. `.env.local` → Supabase (service role) + OpenAI.
2. Garante que os subjects finos candidatos existam (insere os que faltarem).
3. Para cada área agregada (`Ciências da Natureza`/`Humanas`/`Linguagens e Códigos`):
   - Busca as questões com aquele `subject_id` (paginado).
   - Em lotes → `classifyBatch(area)`.
   - Para cada resultado válido: `UPDATE questions SET subject_id = <matéria fina>,
     enem_discipline = <area>` (rastreabilidade/rollback). `--dry` só conta.
4. Resumo por matéria + quantas não classificadas.

## Segurança & robustez

- **Só toca** questões cujo subject é uma das 3 áreas agregadas. **Nunca** Matemática,
  nem questões de professores, nem `Não Categorizado`.
- **Idempotente:** ao mover, a questão sai da área agregada → re-rodar não a re-seleciona.
- `enem_discipline` = área de origem grava a trilha (permite rollback:
  `UPDATE ... SET subject_id = <área> WHERE enem_discipline = <area>`).
- `--dry-run` para revisar a distribuição antes de escrever.
- Erros por lote/linha são logados e não abortam o restante.
- Sequencial (respeita rate limit da OpenAI). Custo estimado total < US$ 0,50.

## Resultado

Como o simulado agrupa por `subject_id` (RPC `get_subjects_with_question_count`),
as matérias finas passam a exibir o volume correto automaticamente — sem mudança de UI.

## Fora de escopo (YAGNI)

- Rota/UI de reclassificação (o usuário escolheu CLI).
- Classificação no fluxo de importação nova (pode plugar `enem-classifier` depois).
- Reprocessar `Matemática` ou `Não Categorizado`.
