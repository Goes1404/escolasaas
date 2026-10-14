import { format as dfFormat, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formatação à prova de dado ruim. Regra da plataforma: o usuário NUNCA vê
 * "Invalid Date", "NaN", "undefined" ou "null". Faltou o dado (ou veio num
 * formato estranho), aparece o traço `VAZIO` — e a tela não quebra.
 *
 * Por que existe: `format(new Date(x), ...)` do date-fns LANÇA erro
 * (RangeError) com data inválida, e isso derrubava a tela inteira (Diário,
 * Financeiro, chamadas). `Math.round(a / b)` com b = 0 virava "NaN%" nas Metas.
 */
export const VAZIO = '—';

type DateInput = Date | string | number | null | undefined;

/** Converte qualquer coisa em Date válida, ou null. Aceita 'YYYY-MM-DD' sem fuso. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  const s = String(value).trim();
  // Data pura do Postgres ('2026-10-14'): meio-dia evita voltar um dia no fuso BR.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISO(`${s}T12:00:00`) : new Date(s);
  return isValid(d) ? d : null;
}

/** `format` do date-fns que nunca lança: devolve `fallback` quando a data é ruim. */
export function fmtDate(value: DateInput, pattern = 'dd/MM/yyyy', fallback = VAZIO): string {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return dfFormat(d, pattern, { locale: ptBR });
  } catch {
    return fallback;
  }
}

export const fmtDateTime = (value: DateInput, fallback = VAZIO) =>
  fmtDate(value, "dd/MM/yyyy 'às' HH:mm", fallback);

/** Número finito ou null. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Inteiro/decimal em pt-BR ("12.450", "7,5"). */
export function fmtNumber(value: unknown, decimals = 0, fallback = VAZIO): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Porcentagem a partir de parte/total, sem NaN nem Infinity. */
export function pct(part: unknown, total: unknown): number {
  const p = toNumber(part);
  const t = toNumber(total);
  if (p === null || t === null || t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
}

export function fmtPct(value: unknown, fallback = VAZIO): string {
  const n = toNumber(value);
  return n === null ? fallback : `${Math.round(n)}%`;
}

export function fmtBRL(value: unknown, fallback = VAZIO): string {
  const n = toNumber(value);
  if (n === null) return fallback;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Texto para exibir: nunca "null"/"undefined". */
export function txt(value: unknown, fallback = VAZIO): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s && s !== 'null' && s !== 'undefined' && s !== 'NaN' ? s : fallback;
}

/** `new Date(x).toLocale*String(...)` sem "Invalid Date". */
export function fmtLocale(
  value: DateInput,
  kind: 'date' | 'time' | 'datetime' = 'date',
  locale: string | string[] = 'pt-BR',
  options?: Intl.DateTimeFormatOptions,
  fallback = VAZIO,
): string {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    if (kind === 'time') return d.toLocaleTimeString(locale, options);
    if (kind === 'datetime') return d.toLocaleString(locale, options);
    return d.toLocaleDateString(locale, options);
  } catch {
    return fallback;
  }
}
