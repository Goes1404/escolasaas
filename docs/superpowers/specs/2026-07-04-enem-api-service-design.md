# Design: Serviço dedicado para a API pública do ENEM (enem.dev)

**Data:** 2026-07-04
**Status:** Aprovado (usuário: "faça a melhor opção possível")

## Contexto e problema

A plataforma já consome `https://api.enem.dev/v1` em **dois lugares**, com lógica de
fetch, tipos e mapa de disciplinas **duplicados e inconsistentes**:

- `src/app/api/enem-import/route.ts` — botão "Importar ENEM" (admin/professor).
- `scripts/import-enem.ts` — importação em massa via CLI (`npm run import:enem`).

Investigação da API ao vivo revelou dois bugs reais:

1. **`limit` da API é limitado a 50.** Requisitar `limit >= 51` retorna **zero** questões.
   `route.ts` usa `limit=200` → a importação pela interface hoje traz **nada**
   (reporta "Nenhuma questão retornada"). O script CLI usa 50 (correto).
2. **Mapas de disciplina divergentes.** `route.ts` usa `ciencias-natureza`/`ciencias-humanas`
   (slugs corretos da API); `import-enem.ts` usa `natureza`/`humanas` (slugs errados →
   nunca casam, questões caem em fallback).

### Fatos confirmados da API (testados ao vivo)

- **Base:** `https://api.enem.dev/v1`
- **Endpoints:** `GET /exams`, `GET /exams/{year}`,
  `GET /exams/{year}/questions?limit=&offset=&language=`,
  `GET /exams/{year}/questions/{index}?language=`
- **`limit` máx = 50** (>50 → resposta vazia). `offset` para paginar.
- **`language` é filtro server-side** (`ingles` | `espanhol`); questões em português têm
  `language: null`.
- **`discipline` NÃO é filtro server-side** — é ignorado. Filtrar por área de conhecimento
  exige paginação + filtro **client-side**.
- **Resposta:** `{ questions: EnemQuestion[], metadata: { limit, offset, total, hasMore } }`.
- **Disciplinas:** `linguagens`, `ciencias-humanas`, `ciencias-natureza`, `matematica`.

## Decisão

Criar uma **camada de serviço única** e migrar os dois consumidores para ela, eliminando
duplicação e corrigindo os dois bugs em uma passada.

## Arquitetura

### Módulo: `src/services/enem-api.ts`

Cliente HTTP puro, agnóstico de framework (sem Supabase, sem imports Next.js). Utilizável
por route handlers, pelo script CLI e por chamadas futuras.

#### Superfície pública

```ts
// Config
export const ENEM_API_BASE = 'https://api.enem.dev/v1';
export const ENEM_MAX_LIMIT = 50;                 // teto real da API (corrige o bug limit=200)
export type EnemDiscipline = 'linguagens' | 'ciencias-humanas' | 'ciencias-natureza' | 'matematica';
export type EnemLanguage   = 'ingles' | 'espanhol';
// mapa canônico slug → subjects.name local (o ÚNICO mapa que os dois consumidores importam)
export const ENEM_DISCIPLINE_TO_SUBJECT: Record<EnemDiscipline, string>;

// Tipos: EnemAlternative, EnemQuestion, EnemMetadata, EnemQuestionsResponse, EnemExam

// Funções
listExams(opts?): Promise<EnemExam[]>                          // GET /exams
getExam(year, opts?): Promise<EnemExam>                        // GET /exams/{year}
fetchQuestionsPage({ year, limit?, offset?, language? }, opts?): Promise<EnemQuestionsResponse>
fetchAllQuestions({ year, discipline?, language?, onProgress? }, opts?): Promise<EnemQuestion[]>
getQuestion(year, index, { language? }?, opts?): Promise<EnemQuestion>
```

- `opts = { signal?: AbortSignal; baseUrl?: string; fetchImpl?: typeof fetch }` — `fetchImpl`
  permite injeção para teste sem rede.
- `fetchQuestionsPage` **clampa `limit` para 1..50**.
- `fetchAllQuestions` pagina automaticamente (50/página) enquanto `metadata.hasMore`,
  sequencialmente (respeita rate limit), e aplica o filtro `discipline` em memória
  (a API ignora server-side). `onProgress?({ fetched, total })` para o CLI.

### Tratamento de erros

```ts
export class EnemApiError extends Error {
  status: number | null;   // status HTTP; null em erro de rede
  url: string;
  kind: 'not_found' | 'rate_limited' | 'network' | 'http' | 'parse';
}
```

- Wrapper de fetch mapeia: `404 → not_found`, `429 → rate_limited`, outros não-OK → `http`,
  throw do fetch → `network`.
- Resposta validada com **zod** (já é dependência) → divergência lança `kind: 'parse'`.
- `cache: 'no-store'` + `Accept: application/json` + timeout via `AbortController`.
- Consumidores decidem por `err.kind` (ex.: route devolve 404 vs 500).

## Migração dos consumidores

- **`src/app/api/enem-import/route.ts`:** remover fetch inline, `DISCIPLINE_TO_SUBJECT` local
  e o `limit=200` quebrado; chamar `fetchAllQuestions({ year })` (passa a importar as ~183
  questões em vez de 0) e importar `ENEM_DISCIPLINE_TO_SUBJECT`. Auth (`requireTeacherOrAdmin`)
  e toda a lógica Supabase de insert/link permanecem intactas.
- **`scripts/import-enem.ts`:** remover `fetchPage`, as interfaces locais e o `DISCIPLINE_MAP`
  errado; usar `fetchAllQuestions` + tipos + mapa do serviço. Parsing de args CLI, upsert e
  logs de progresso permanecem. Semântica de filtro por `language` preservada (sem mudança de
  comportamento além da correção de slug).

## Testes / verificação

O repositório **não tem framework de testes** (sem jest/vitest) — não adicionar um sem pedido.
Verificação:

- `npm run typecheck` + `npm run lint` + `npm run build`.
- Script `tsx` descartável que bate na API ao vivo para um ano e um filtro de disciplina
  (removido após confirmar).

`fetchImpl` é injetável, então testes unitários com fetch mockado podem ser adicionados depois
sem refatoração, caso o time adote vitest.

## Fora de escopo (YAGNI)

- UI nova (as páginas `enem-import` já existem e continuam funcionando).
- Cache/persistência da resposta da API.
- Novo framework de testes.
