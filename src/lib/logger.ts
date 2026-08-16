/**
 * logger.ts — Structured JSON logger for Plataforma LMS
 *
 * Zero external dependencies: works in Node.js, Edge Runtime and browser.
 * All sensitive fields are redacted before any log is emitted (data masking).
 *
 * Log levels (ascending severity):  debug → info → warn → error → fatal
 * Set LOG_LEVEL env var to control minimum level (default: debug in dev, info in prod).
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('user.login', { userId, action: 'login' });
 *   log.error('db.query.failed', err, { table: 'profiles', userId });
 *
 *   // Child logger binds permanent context to every call:
 *   const reqLog = log.child({ requestId, userId });
 *   reqLog.warn('rate_limit.exceeded', { path: '/api/...' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogContext = Record<string, unknown>;

// ── Data-masking: keys whose values are always replaced with '[REDACTED]' ────
// Exact match OR key ends with _{key} OR key starts with {key}_ (case-insensitive)
const REDACT_KEYS = new Set([
  'password', 'senha', 'passcode', 'pass',
  'token', 'access_token', 'refresh_token', 'id_token', 'auth_token',
  'secret', 'client_secret', 'api_key', 'apikey', 'api_secret',
  'authorization', 'cookie', 'session', 'session_id',
  'birth_date', 'data_nascimento', 'cpf', 'rg', 'cnpj',
  'p256dh', 'auth',               // Web Push subscription keys
  'service_role_key', 'anon_key', // Supabase admin credentials
  'card_number', 'cvv', 'pan',    // Payment
  'phone', 'telefone',            // PII
]);

function shouldRedact(key: string): boolean {
  const k = key.toLowerCase().replace(/[-\s]/g, '_');
  if (REDACT_KEYS.has(k)) return true;
  for (const r of REDACT_KEYS) {
    if (k.endsWith(`_${r}`) || k.startsWith(`${r}_`)) return true;
  }
  return false;
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => sanitize(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = shouldRedact(k) ? '[REDACTED]' : sanitize(v, depth + 1);
  }
  return out;
}

// ── Level filter ───────────────��─────────────────────────────────────────────
const LEVEL_NUM: Record<LogLevel, number> = {
  debug: 10, info: 20, warn: 30, error: 40, fatal: 50,
};

function resolveMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  if (env && LEVEL_NUM[env] !== undefined) return env;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const MIN_LEVEL = resolveMinLevel();

// ── Error serialiser ─────────────���───────────────────────────────────────────
function serializeErr(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      // Truncate stack to first 5 lines to avoid log bloat
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }
  return { raw: String(err) };
}

// ── Core emit ───────────���───────────────────────��─────────────────────────────
function emit(
  level: LogLevel,
  action: string,
  data: LogContext,
  err?: unknown,
): void {
  if (LEVEL_NUM[level] < LEVEL_NUM[MIN_LEVEL]) return;

  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    action,
    ...sanitize(data) as LogContext,
  };
  if (err !== undefined) entry.err = serializeErr(err);

  const line = JSON.stringify(entry);

  if (level === 'error' || level === 'fatal') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ── Public logger API ──────────���──────────────────────────���───────────────────
export const log = {
  debug: (action: string, data: LogContext = {}) =>
    emit('debug', action, data),

  info: (action: string, data: LogContext = {}) =>
    emit('info', action, data),

  warn: (action: string, data: LogContext = {}) =>
    emit('warn', action, data),

  /** @param err  The caught error (Error instance or unknown) */
  error: (action: string, err: unknown, data: LogContext = {}) =>
    emit('error', action, data, err),

  /** Use for unrecoverable failures that should page on-call */
  fatal: (action: string, err: unknown, data: LogContext = {}) =>
    emit('fatal', action, data, err),

  /**
   * Returns a logger that merges a fixed context into every call.
   * Typical use: bind requestId + userId at the top of a route handler.
   *
   * @example
   *   const rl = log.child({ requestId, userId });
   *   rl.info('checkout.started');
   *   rl.error('payment.failed', err, { orderId });
   */
  child: (ctx: LogContext) => ({
    debug: (action: string, data: LogContext = {}) =>
      emit('debug', action, { ...ctx, ...data }),
    info: (action: string, data: LogContext = {}) =>
      emit('info', action, { ...ctx, ...data }),
    warn: (action: string, data: LogContext = {}) =>
      emit('warn', action, { ...ctx, ...data }),
    error: (action: string, err: unknown, data: LogContext = {}) =>
      emit('error', action, { ...ctx, ...data }, err),
    fatal: (action: string, err: unknown, data: LogContext = {}) =>
      emit('fatal', action, { ...ctx, ...data }, err),
  }),
};
