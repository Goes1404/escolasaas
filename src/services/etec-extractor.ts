/**
 * Extrator de questões do Vestibulinho ETEC a partir do texto de prova (pdftotext)
 * e do gabarito oficial. Server-only (usa OPENAI_API_KEY).
 *
 * A prova é interdisciplinar e não rotula matéria — a classificação por matéria e
 * micro-tópico é feita depois (src/services/enem-classifier.ts).
 */

import { OpenAI } from 'openai';
import { z } from 'zod';

const DEFAULT_MODEL = 'gpt-4o';

// ─── Gabarito ────────────────────────────────────────────────────────────────

/**
 * Extrai o gabarito oficial do texto do PDF de gabarito.
 * Casa linhas como "001 B C4" → { 1: 'B', 2: 'C', ... }.
 */
export function parseGabarito(text: string): Record<number, string> {
  // O layout do PDF põe o critério (Cn) em outra linha e duas colunas lado a lado
  // ("001  B ... 026  E"). Casamos "NNN  L" (nº 1..99) e ignoramos o critério.
  const out: Record<number, string> = {};
  const re = /(?:^|\s)(\d{1,3})\s+([A-E])(?=\s|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 99) out[n] = m[2];
  }
  return out;
}

// ─── Estruturação via IA ──────────────────────────────────────────────────────

export interface EtecOption {
  key: string; // 'A'..'E'
  text: string;
}

export interface EtecStructuredQuestion {
  number: number;
  question_text: string;
  supporting_text: string | null;
  options: EtecOption[];
  depends_on_image: boolean;
}

export interface StructureOptions {
  client?: OpenAI;
  model?: string;
  /**
   * Quantas questões por chamada de IA (padrão 10). Era 25, mas com o caderno
   * inteiro no contexto a resposta não cabia e metade das questões se perdia.
   */
  chunkSize?: number;
  /** Total de questões da prova (padrão 50). */
  totalQuestions?: number;
}

const optionSchema = z.object({
  key: z.string().transform((s) => s.trim().toUpperCase().slice(0, 1)),
  text: z.string(),
});

const questionSchema = z.object({
  number: z.number(),
  question_text: z.string(),
  supporting_text: z.string().nullable().default(null),
  options: z.array(optionSchema),
  depends_on_image: z.boolean().default(false),
});

const responseSchema = z.object({
  questions: z.array(questionSchema),
});

async function structureRange(
  examText: string,
  from: number,
  to: number,
  client: OpenAI,
  model: string,
): Promise<EtecStructuredQuestion[]> {
  const system =
    'Você extrai questões de um caderno de prova do Vestibulinho ETEC (Centro Paula Souza). ' +
    'Trabalhe apenas com o conteúdo fornecido — nunca invente enunciados, alternativas ou dados. ' +
    'Para cada questão retorne: number (int), question_text (o enunciado, SEM as alternativas), ' +
    'supporting_text (o texto de apoio que precede e é compartilhado pela questão, ex.: "Leia o texto...", ' +
    'ou null se não houver), options (as 5 alternativas, cada uma {key:"A".."E", text}), e ' +
    'depends_on_image (true se a questão se refere a uma imagem, mapa, gráfico, charge, tirinha ou figura ' +
    'que NÃO está reproduzida no texto — essas serão descartadas). ' +
    'Responda SOMENTE JSON no formato {"questions":[...]}.';

  const user =
    `Extraia APENAS as questões de número ${from} a ${to} do caderno abaixo.\n\n` +
    `===== CADERNO =====\n${examText}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    // Sem teto explícito a resposta era cortada no meio do JSON, o parse falhava
    // e o lote inteiro voltava vazio — em silêncio.
    max_tokens: 16000,
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
    // Resposta truncada ou inválida. Divide a faixa e tenta de novo: metade das
    // questões cabe na resposta. Só desiste quando a faixa é de uma só questão.
    if (to > from) {
      const mid = Math.floor((from + to) / 2);
      const [a, b] = [
        await structureRange(examText, from, mid, client, model),
        await structureRange(examText, mid + 1, to, client, model),
      ];
      return [...a, ...b];
    }
    return [];
  }

  // Mantém só as questões dentro do range pedido e com 5 alternativas.
  return parsed.questions.filter((q) => q.number >= from && q.number <= to);
}

/**
 * Estrutura todas as questões da prova, em lotes por faixa de número
 * (o texto completo vai como contexto em cada lote — preserva textos de apoio).
 */
export async function structureQuestions(
  examText: string,
  opts: StructureOptions = {},
): Promise<EtecStructuredQuestion[]> {
  const client = opts.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = opts.model ?? DEFAULT_MODEL;
  const total = opts.totalQuestions ?? 50;
  const chunk = opts.chunkSize ?? 10;

  const all: EtecStructuredQuestion[] = [];
  for (let from = 1; from <= total; from += chunk) {
    const to = Math.min(from + chunk - 1, total);
    const batch = await structureRange(examText, from, to, client, model);
    all.push(...batch);
  }

  // Dedup por número (mantém a primeira ocorrência) e ordena.
  const seen = new Set<number>();
  return all
    .filter((q) => (seen.has(q.number) ? false : (seen.add(q.number), true)))
    .sort((a, b) => a.number - b.number);
}
