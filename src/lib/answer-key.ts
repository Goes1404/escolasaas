/**
 * Leitura do gabarito oficial colado como texto.
 *
 * As provas da FUVEST (e várias do ENEM) publicam o gabarito num PDF/página
 * separada da prova, então o extrator devolve `correct_answer` nulo. Sem isto,
 * seriam ~90 respostas digitadas à mão por prova.
 *
 * Aceita os formatos que aparecem na prática:
 *   "1-A 2-B 3-C"      "1. A / 2. B"      "01) A"      "12: C"
 *   "A B C D E"        "ABCDE"            "AB CD"
 */

export type AnswerKeyMode = 'numbered' | 'sequence' | 'empty';

export type ParsedAnswerKey = {
  /** Número impresso da questão → letra. Preenchido no modo `numbered`. */
  byNumber: Map<number, string>;
  /** Letras na ordem lida. Preenchido no modo `sequence`. */
  sequence: string[];
  mode: AnswerKeyMode;
  /** Quantas respostas foram lidas no total. */
  total: number;
};

const VALID_LETTER = /^[A-E]+$/;

/**
 * Lê o texto colado. Prefere o formato numerado (mais seguro, casa pelo número
 * impresso da questão); só cai para sequência pura quando não há numeração.
 */
export function parseAnswerKey(raw: string): ParsedAnswerKey {
  const text = (raw || '').toUpperCase();

  // ── Formato numerado ──────────────────────────────────────────────────────
  // O look-ahead evita casar lixo como "1AB" ou "1A2".
  const byNumber = new Map<number, string>();
  for (const m of text.matchAll(/(\d{1,3})\s*[-.):\]º°]?\s*([A-E])(?![A-Z0-9])/g)) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 300 && !byNumber.has(n)) byNumber.set(n, m[2]);
  }
  // Uma única ocorrência é provavelmente coincidência (ex.: um ano no cabeçalho).
  if (byNumber.size >= 2) {
    return { byNumber, sequence: [], mode: 'numbered', total: byNumber.size };
  }

  // ── Sequência pura de letras ──────────────────────────────────────────────
  // Quebra em tokens e descarta palavras (ex.: "GABARITO" tem G/R/I/T/O), para
  // que um cabeçalho colado junto não vire resposta.
  const sequence: string[] = [];
  for (const token of text.split(/[^A-Z]+/)) {
    if (token && VALID_LETTER.test(token)) sequence.push(...token.split(''));
  }
  if (sequence.length === 0) {
    return { byNumber: new Map(), sequence: [], mode: 'empty', total: 0 };
  }
  return { byNumber: new Map(), sequence, mode: 'sequence', total: sequence.length };
}

export type AnswerKeyTarget = {
  question_number?: number | null;
  correct_answer: string | null;
};

export type AnswerKeyApplication<T extends AnswerKeyTarget> = {
  /** Lista na ordem original, com `correct_answer` preenchido onde houve casamento. */
  updated: T[];
  /** Índices (na ordem original) das questões que receberam resposta do gabarito. */
  appliedIndices: number[];
  /** Quantas questões receberam resposta. */
  applied: number;
  /** Questões sem correspondência no gabarito. */
  unmatched: number;
  /** Respostas do gabarito que não encontraram questão (sinal de prova/gabarito trocados). */
  leftover: number;
};

/**
 * Casa o gabarito com as questões extraídas.
 *
 * No modo `numbered` o casamento é pelo número impresso da questão — imune a
 * questão faltando ou fora de ordem. No modo `sequence` é por posição, sobre as
 * questões ordenadas pelo número impresso (as sem número vão para o fim).
 */
export function applyAnswerKey<T extends AnswerKeyTarget>(
  questions: T[],
  key: ParsedAnswerKey
): AnswerKeyApplication<T> {
  if (key.mode === 'empty') {
    return { updated: questions, appliedIndices: [], applied: 0, unmatched: questions.length, leftover: 0 };
  }

  const answers = new Map<number, string>();

  if (key.mode === 'numbered') {
    questions.forEach((q, i) => {
      const n = q.question_number;
      if (typeof n === 'number' && key.byNumber.has(n)) answers.set(i, key.byNumber.get(n)!);
    });
  } else {
    // Ordena pelo número impresso, mantendo a ordem original como desempate e
    // jogando as sem número para o fim.
    const order = questions
      .map((q, i) => ({ i, n: typeof q.question_number === 'number' ? q.question_number : Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i));
    order.forEach((entry, pos) => {
      const letter = key.sequence[pos];
      if (letter) answers.set(entry.i, letter);
    });
  }

  const updated = questions.map((q, i) =>
    answers.has(i) ? { ...q, correct_answer: answers.get(i)! } : q
  );

  const appliedIndices = [...answers.keys()].sort((a, b) => a - b);
  const applied = appliedIndices.length;
  return {
    updated,
    appliedIndices,
    applied,
    unmatched: questions.length - applied,
    leftover: Math.max(0, key.total - applied),
  };
}
