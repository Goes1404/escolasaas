/**
 * Tokens HMAC para links de auto-cadastro de alunos.
 * Validação 100% server-side — nunca importe este arquivo em componentes cliente.
 *
 * Formato interno do token (antes do base64url):
 *   "<expiry_ms>:<nonce_hex>:<hmac_hex_24>"
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Chave do HMAC dos tokens de cadastro.
 *
 * Usava a `SUPABASE_SERVICE_ROLE_KEY` diretamente. Duas razões para separar:
 *
 * 1. Escopo. A service role key abre o banco inteiro ignorando RLS. Reutilizá-la
 *    como segredo de assinatura amarra dois usos de risco muito diferente — e
 *    torna a rotação da chave do banco um evento que invalida todos os links de
 *    cadastro em circulação.
 * 2. Exposição. Ela já foi exposta em texto puro durante a auditoria e está na
 *    lista de rotação pendente. Enquanto estiver ali, quem a tiver consegue
 *    forjar tokens de cadastro válidos.
 *
 * `REGISTRATION_TOKEN_SECRET` é o segredo dedicado. O fallback para a chave
 * antiga existe para os links já emitidos continuarem válidos até expirarem
 * (7 dias) — sem ele, todo convite em circulação quebraria no deploy.
 */
function secret(): string {
  const dedicado = process.env.REGISTRATION_TOKEN_SECRET;
  if (dedicado && dedicado.length >= 32) return dedicado;

  const legado = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!legado) {
    throw new Error('Defina REGISTRATION_TOKEN_SECRET (mínimo 32 caracteres).');
  }
  if (!dedicado) {
    console.warn(
      '[registration-token] Usando a service role key como segredo (legado). ' +
      'Defina REGISTRATION_TOKEN_SECRET para separar os escopos.',
    );
  } else {
    console.warn('[registration-token] REGISTRATION_TOKEN_SECRET curto demais; usando o legado.');
  }
  return legado;
}

/**
 * Todas as chaves aceitas na VERIFICAÇÃO, da preferida para a legada.
 *
 * Aceitar as duas na leitura e assinar só com a nova é o que permite trocar o
 * segredo sem invalidar os links que já estão com os alunos.
 */
function secretsParaVerificar(): string[] {
  const chaves: string[] = [];
  const dedicado = process.env.REGISTRATION_TOKEN_SECRET;
  if (dedicado && dedicado.length >= 32) chaves.push(dedicado);
  const legado = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (legado) chaves.push(legado);
  return chaves;
}

export function generateRegistrationToken(expiryDays = DEFAULT_EXPIRY_DAYS): string {
  const expiry = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
  const nonce = randomBytes(16).toString('hex');
  const payload = `${expiry}:${nonce}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex').substring(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export type TokenStatus = 'valid' | 'expired' | 'invalid';

export function verifyRegistrationToken(token: string): TokenStatus {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    // Esperamos exatamente 3 segmentos separados por ":"
    // expiry pode conter apenas dígitos, nonce é hex de 32 chars, sig é hex de 24 chars
    const colonIdxFirst = decoded.indexOf(':');
    const colonIdxLast = decoded.lastIndexOf(':');
    if (colonIdxFirst === colonIdxLast || colonIdxFirst === -1) return 'invalid';

    const expiryStr = decoded.substring(0, colonIdxFirst);
    const nonce = decoded.substring(colonIdxFirst + 1, colonIdxLast);
    const sig = decoded.substring(colonIdxLast + 1);

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || nonce.length < 8 || sig.length < 16) return 'invalid';

    const payload = `${expiryStr}:${nonce}`;

    // Aceita a chave nova e a legada durante a transição. `timingSafeEqual`
    // em vez de `!==`: comparação de string curto-circuita no primeiro byte
    // diferente, e o tempo gasto vaza quantos bytes o atacante já acertou.
    const assinaturaConfere = secretsParaVerificar().some(chave => {
      const esperada = createHmac('sha256', chave).update(payload).digest('hex').substring(0, 24);
      if (esperada.length !== sig.length) return false;
      return timingSafeEqual(Buffer.from(esperada), Buffer.from(sig));
    });

    if (!assinaturaConfere) return 'invalid';
    if (Date.now() > expiry) return 'expired';

    return 'valid';
  } catch {
    return 'invalid';
  }
}

/** Retorna o número de dias restantes até o vencimento (0 se expirado). */
export function tokenExpiryInfo(token: string): { daysLeft: number; expiresAt: Date } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return null;
    const expiry = parseInt(decoded.substring(0, colonIdx), 10);
    if (isNaN(expiry)) return null;
    const daysLeft = Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
    return { daysLeft, expiresAt: new Date(expiry) };
  } catch {
    return null;
  }
}
