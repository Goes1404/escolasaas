/**
 * Classificador de questões do ENEM por matéria fina (server-only).
 *
 * A API do ENEM só separa em 4 grandes áreas; este módulo usa a IA (gpt-4o-mini,
 * o mesmo modelo da Aurora) para classificar cada questão na matéria fina do cursinho,
 * restringindo as candidatas pela área de origem — o que reduz erro e custo.
 *
 * ⚠️ Usa OPENAI_API_KEY — nunca importar em código client-side.
 */

import { OpenAI } from 'openai';
import { z } from 'zod';

// ─── Mapa área ENEM → matérias finas candidatas (nomes = subjects.name no banco) ──

export const AREA_TO_SUBJECTS = {
  linguagens: ['Português', 'Literatura', 'Inglês', 'Espanhol', 'Arte', 'Educação Física'],
  'ciencias-natureza': ['Biologia', 'Química', 'Física'],
  'ciencias-humanas': ['História', 'Geografia', 'Filosofia', 'Sociologia'],
  matematica: ['Matemática'],
} as const;

export type EnemArea = keyof typeof AREA_TO_SUBJECTS;

/** Nome da área agregada (subject atual) → slug de área usado aqui. */
export const AGGREGATE_SUBJECT_TO_AREA: Record<string, EnemArea> = {
  'Linguagens e Códigos': 'linguagens',
  'Ciências da Natureza': 'ciencias-natureza',
  'Ciências Humanas': 'ciencias-humanas',
  Matemática: 'matematica',
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_QUESTION_CHARS = 400;
const MAX_SUPPORT_CHARS = 300;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ClassifiableQuestion {
  id: string;
  question_text: string;
  supporting_text?: string | null;
}

export interface ClassificationResult {
  id: string;
  subject: string; // sempre uma das matérias candidatas da área
}

export interface ClassifyOptions {
  /** Cliente OpenAI injetável (testes/reuso); por padrão instancia com OPENAI_API_KEY. */
  client?: OpenAI;
  model?: string;
  /**
   * Regras extras de desempate, anexadas ao prompt. Útil quando a prova é
   * interdisciplinar e o tema do texto de apoio não indica a matéria avaliada.
   */
  guidance?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function buildSnippet(q: ClassifiableQuestion): string {
  const support = q.supporting_text ? truncate(q.supporting_text, MAX_SUPPORT_CHARS) : '';
  const stmt = truncate(q.question_text ?? '', MAX_QUESTION_CHARS);
  return support ? `${support}\n---\n${stmt}` : stmt;
}

const responseSchema = z.object({
  classifications: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
    }),
  ),
});

export interface CategoryClassification {
  id: string;
  category: string; // sempre uma das categorias candidatas
}

// ─── Classificação ───────────────────────────────────────────────────────────

/**
 * Núcleo genérico: classifica um lote de questões numa lista fechada de categorias.
 * `label` descreve o contexto (ex.: `da área "linguagens"`, `da matéria "Matemática"`).
 * Resultados com categoria fora das candidatas são descartados (a questão não é movida).
 */
export async function classifyIntoCategories(
  questions: ClassifiableQuestion[],
  categories: string[],
  label: string,
  opts: ClassifyOptions = {},
): Promise<CategoryClassification[]> {
  if (questions.length === 0 || categories.length === 0) return [];

  const client = opts.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = opts.model ?? DEFAULT_MODEL;

  const items = questions
    .map((q, i) => `#${i} (id=${q.id})\n${buildSnippet(q)}`)
    .join('\n\n═══\n\n');

  const system =
    `Você classifica questões do ENEM ${label} na categoria correta. ` +
    `Escolha EXATAMENTE uma destas categorias para cada questão: ${categories.join(', ')}. ` +
    `Use apenas esses nomes, exatamente como escritos. ` +
    (opts.guidance ? `${opts.guidance} ` : '') +
    `Responda SOMENTE com JSON no formato ` +
    `{"classifications":[{"id":"<id>","category":"<categoria>"}]} sem texto extra.`;

  const user = `Classifique as ${questions.length} questões a seguir:\n\n${items}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';

  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(raw));
  } catch {
    return []; // resposta malformada → não classifica nada deste lote
  }

  const valid = new Set<string>(categories);
  const wanted = new Set(questions.map((q) => q.id));

  return parsed.classifications.filter(
    (c): c is CategoryClassification => wanted.has(c.id) && valid.has(c.category),
  );
}

/**
 * Classifica um lote de questões de UMA área na matéria fina (wrapper de conveniência).
 * Resultados com matéria fora das candidatas são descartados (a questão não é movida).
 */
export async function classifyBatch(
  questions: ClassifiableQuestion[],
  area: EnemArea,
  opts: ClassifyOptions = {},
): Promise<ClassificationResult[]> {
  if (questions.length === 0) return [];

  const candidates = AREA_TO_SUBJECTS[area];

  // Área de matéria única (matemática): não precisa de IA.
  if (candidates.length === 1) {
    return questions.map((q) => ({ id: q.id, subject: candidates[0] }));
  }

  const results = await classifyIntoCategories(questions, [...candidates], `da área "${area}"`, opts);
  return results.map((r) => ({ id: r.id, subject: r.category }));
}
