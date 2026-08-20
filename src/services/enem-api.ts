/**
 * Serviço dedicado à API pública do ENEM — https://enem.dev (repo: yunger7/enem-api).
 *
 * Cliente HTTP puro e agnóstico de framework: NÃO importa Supabase nem Next.js.
 * É a única fonte de verdade para acessar `api.enem.dev` — route handlers, o script
 * de importação (`scripts/import-enem.ts`) e futuros consumidores devem usá-lo.
 *
 * Fatos da API confirmados ao vivo (2026-07):
 *  - `limit` é limitado a 50 por página; requisitar > 50 retorna resposta VAZIA.
 *  - `language` (`ingles` | `espanhol`) é filtro server-side; questões em português
 *    têm `language: null`.
 *  - `discipline` NÃO é filtro server-side — é ignorado. Filtrar por área de
 *    conhecimento exige paginar tudo e filtrar em memória (ver `fetchAllQuestions`).
 */

import { z } from 'zod';

// ─── Config ──────────────────────────────────────────────────────────────────

export const ENEM_API_BASE = 'https://api.enem.dev/v1';

/** Teto real de `limit` por página. Acima disso a API devolve lista vazia. */
export const ENEM_MAX_LIMIT = 50;

const DEFAULT_TIMEOUT_MS = 15_000;

/** Áreas de conhecimento (slugs) usadas pela API. */
export type EnemDiscipline =
  | 'linguagens'
  | 'ciencias-humanas'
  | 'ciencias-natureza'
  | 'matematica';

/** Idiomas da seção de língua estrangeira. Questões em português têm `null`. */
export type EnemLanguage = 'ingles' | 'espanhol';

/**
 * Mapa canônico slug da API → `subjects.name` no nosso banco.
 * ÚNICA fonte de verdade desse mapeamento (importado por route.ts e import-enem.ts).
 */
export const ENEM_DISCIPLINE_TO_SUBJECT: Record<EnemDiscipline, string> = {
  linguagens: 'Linguagens e Códigos',
  'ciencias-humanas': 'Ciências Humanas',
  'ciencias-natureza': 'Ciências da Natureza',
  matematica: 'Matemática',
};

// ─── Schemas (zod) + Tipos ───────────────────────────────────────────────────

const labelValueSchema = z.object({ label: z.string(), value: z.string() });

const alternativeSchema = z.object({
  letter: z.string(),
  // Alternativas só de imagem podem vir com texto vazio; normalizamos null → ''.
  text: z.string().nullable().transform((v) => v ?? ''),
  file: z.string().nullable(),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  title: z.string(),
  index: z.number(),
  discipline: z.string(),
  language: z.string().nullable(),
  year: z.number(),
  context: z.string().nullable(),
  files: z.array(z.string()).default([]),
  correctAlternative: z.string(),
  alternativesIntroduction: z.string().nullable(),
  alternatives: z.array(alternativeSchema),
});

const metadataSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
});

const questionsResponseSchema = z.object({
  questions: z.array(questionSchema),
  metadata: metadataSchema,
});

const questionSummarySchema = z.object({
  title: z.string(),
  index: z.number(),
  discipline: z.string(),
  language: z.string().nullable(),
});

const examSchema = z.object({
  title: z.string(),
  year: z.number(),
  disciplines: z.array(labelValueSchema),
  languages: z.array(labelValueSchema),
});

const examDetailSchema = examSchema.extend({
  questions: z.array(questionSummarySchema),
});

const examsListSchema = z.array(examSchema);

export type EnemLabelValue = z.infer<typeof labelValueSchema>;
export type EnemAlternative = z.infer<typeof alternativeSchema>;
export type EnemQuestion = z.infer<typeof questionSchema>;
export type EnemMetadata = z.infer<typeof metadataSchema>;
export type EnemQuestionsResponse = z.infer<typeof questionsResponseSchema>;
export type EnemQuestionSummary = z.infer<typeof questionSummarySchema>;
export type EnemExam = z.infer<typeof examSchema>;
export type EnemExamDetail = z.infer<typeof examDetailSchema>;

// ─── Erros ───────────────────────────────────────────────────────────────────

export type EnemApiErrorKind =
  | 'not_found' // 404 — prova/questão inexistente
  | 'rate_limited' // 429 — limite de requisições
  | 'network' // falha de conexão / timeout
  | 'http' // outro status HTTP não-OK
  | 'parse'; // corpo não é JSON válido ou fora do formato esperado

export class EnemApiError extends Error {
  constructor(
    message: string,
    /** Status HTTP; `null` em erros de rede/timeout. */
    public readonly status: number | null,
    public readonly url: string,
    public readonly kind: EnemApiErrorKind,
  ) {
    super(message);
    this.name = 'EnemApiError';
  }
}

// ─── Núcleo de requisição ─────────────────────────────────────────────────────

export interface RequestOptions {
  /** Aborta a requisição externamente. */
  signal?: AbortSignal;
  /** Sobrescreve a base URL (útil para self-hosting/testes). */
  baseUrl?: string;
  /** Injeta uma implementação de `fetch` (testes sem rede). */
  fetchImpl?: typeof fetch;
  /** Timeout em ms (padrão 15s). */
  timeoutMs?: number;
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  opts: RequestOptions = {},
): Promise<z.output<S>> {
  const base = opts.baseUrl ?? ENEM_API_BASE;
  const url = `${base}${path}`;
  const doFetch = opts.fetchImpl ?? fetch;

  // Timeout próprio + encadeamento de um signal externo, se houver.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await doFetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (err) {
    throw new EnemApiError(
      `Falha de rede ao acessar ${url}: ${(err as Error)?.message ?? 'erro desconhecido'}`,
      null,
      url,
      'network',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const kind: EnemApiErrorKind =
      res.status === 404 ? 'not_found' : res.status === 429 ? 'rate_limited' : 'http';
    throw new EnemApiError(`API ENEM retornou ${res.status} em ${url}`, res.status, url, kind);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new EnemApiError(`Resposta não-JSON da API ENEM em ${url}`, res.status, url, 'parse');
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new EnemApiError(
      `Formato inesperado da API ENEM em ${url}: ${parsed.error.message}`,
      res.status,
      url,
      'parse',
    );
  }
  return parsed.data;
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n)) return ENEM_MAX_LIMIT;
  return Math.max(1, Math.min(ENEM_MAX_LIMIT, Math.floor(n)));
}

// ─── API pública ──────────────────────────────────────────────────────────────

/** Lista todas as provas disponíveis (anos), com disciplinas e idiomas. */
export function listExams(opts?: RequestOptions): Promise<EnemExam[]> {
  return request('/exams', examsListSchema, opts);
}

/** Detalhe de uma prova, incluindo o índice resumido de questões. */
export function getExam(year: number, opts?: RequestOptions): Promise<EnemExamDetail> {
  return request(`/exams/${year}`, examDetailSchema, opts);
}

export interface FetchQuestionsPageParams {
  year: number;
  /** Máx 50 (é o teto da API); valores fora de 1..50 são ajustados. */
  limit?: number;
  offset?: number;
  language?: EnemLanguage;
}

/** Busca UMA página de questões (respeitando o teto de 50). */
export function fetchQuestionsPage(
  params: FetchQuestionsPageParams,
  opts?: RequestOptions,
): Promise<EnemQuestionsResponse> {
  const { year, offset = 0, language } = params;
  const limit = clampLimit(params.limit ?? ENEM_MAX_LIMIT);

  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (language) qs.set('language', language);

  return request(`/exams/${year}/questions?${qs.toString()}`, questionsResponseSchema, opts);
}

export interface FetchAllQuestionsParams {
  year: number;
  /** Filtro por área de conhecimento — aplicado CLIENT-SIDE (a API ignora). */
  discipline?: EnemDiscipline;
  /** Filtro de idioma — server-side. */
  language?: EnemLanguage;
  /** Callback de progresso a cada página (para logs/CLI). */
  onProgress?: (progress: { fetched: number; total: number }) => void;
}

/**
 * Busca TODAS as questões de um ano, paginando automaticamente (50/página,
 * sequencial para respeitar o rate limit). Se `discipline` for informado,
 * filtra em memória — a API não suporta esse filtro no servidor.
 */
export async function fetchAllQuestions(
  params: FetchAllQuestionsParams,
  opts?: RequestOptions,
): Promise<EnemQuestion[]> {
  const { year, discipline, language, onProgress } = params;
  const all: EnemQuestion[] = [];
  let offset = 0;

  for (;;) {
    const page = await fetchQuestionsPage(
      { year, offset, limit: ENEM_MAX_LIMIT, language },
      opts,
    );
    all.push(...page.questions);
    onProgress?.({ fetched: all.length, total: page.metadata.total });

    // Avança pelo número real de itens retornados (à prova de páginas parciais).
    offset += page.questions.length;
    if (!page.metadata.hasMore || page.questions.length === 0) break;
  }

  return discipline ? all.filter((q) => q.discipline === discipline) : all;
}

export interface GetQuestionOptions {
  language?: EnemLanguage;
}

/** Busca uma questão específica pelo índice. */
export function getQuestion(
  year: number,
  index: number,
  params: GetQuestionOptions = {},
  opts?: RequestOptions,
): Promise<EnemQuestion> {
  const qs = new URLSearchParams();
  if (params.language) qs.set('language', params.language);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  return request(`/exams/${year}/questions/${index}${suffix}`, questionSchema, opts);
}
