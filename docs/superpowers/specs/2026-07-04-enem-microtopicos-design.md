# Design: Classificação das questões ENEM por micro-tópico (IA)

**Data:** 2026-07-04
**Status:** Aprovado (decisões: taxonomia curada por mim + todas as matérias)

## Objetivo

Habilitar o modo "Treino Específico" do simulado (filtro por `micro_topic_id`),
classificando cada questão ENEM — já organizada por matéria — num micro-tópico.

## Estado atual

- `micro_topics` (id, subject_id → subjects, name, UNIQUE(subject_id, name)).
- `questions.micro_topic_id` (nullable).
- **0 micro-tópicos cadastrados; 0 questões com micro_topic_id.** Não há taxonomia →
  o passo novo é DEFINIR a lista de micro-tópicos por matéria.

## Decisões

1. **Taxonomia curada** (base Matriz de Referência do ENEM) — lista fechada por matéria.
2. **Todas as matérias** finas (Matemática, Física, Química, Biologia, História, Geografia,
   Filosofia, Sociologia, Português, Literatura, Arte, Educação Física, Inglês, Espanhol).

## Arquitetura

### 1. `src/services/enem-microtopics.ts`
`MICRO_TOPICS_BY_SUBJECT: Record<string, string[]>` — a taxonomia curada (chaves = subjects.name).

### 2. `src/services/enem-classifier.ts` (generalizado)
Extraída a função reutilizável:
```ts
classifyIntoCategories(questions, categories, label, opts): Promise<{id, category}[]>
```
`classifyBatch` (matéria) passa a ser um wrapper dela — mesmo comportamento, sem duplicação.
Restringe as candidatas à lista fechada; descarta o que a IA classifica fora dela.

### 3. `scripts/classify-microtopics-enem.ts` (`npm run classify:microtopics`)
```
npm run classify:microtopics -- --dry                 # preview
npm run classify:microtopics                           # aplica
npm run classify:microtopics -- --subject "Matemática" # uma matéria
npm run classify:microtopics -- --batch 20 --limit N
```
Fluxo por matéria:
1. Garante que os micro-tópicos da taxonomia existam (`upsert` em `micro_topics`, chave
   `subject_id,name`).
2. Busca questões da matéria com `micro_topic_id IS NULL`.
3. Classifica em lotes (`classifyIntoCategories`, candidatas = micro-tópicos da matéria).
4. `UPDATE questions SET micro_topic_id = <id>`. `--dry` só conta.

## Segurança & robustez

- **Idempotente:** só processa questões com `micro_topic_id IS NULL` → re-rodar continua.
- Só marca micro-tópico **dentro da matéria** da questão (candidatas restritas ao subject).
- Não classificado → permanece com `micro_topic_id NULL` (some do filtro específico, mas
  continua no simulado por matéria). Nunca inventa micro-tópico fora da lista.
- `--dry-run`; erros por lote logados sem abortar. gpt-4o-mini; custo total < US$ 0,50.

## Resultado

O modo "Treino Específico" passa a listar os micro-tópicos (com questões) por matéria,
sem mudança de UI (a tela já lê `micro_topics` por `subject_id` e filtra por `micro_topic_id`).

## Fora de escopo (YAGNI)

- UI de gestão de micro-tópicos.
- Micro-tópicos para as áreas agregadas remanescentes / "Não Categorizado".
- Reclassificar questões que já tenham micro_topic_id.
