/**
 * Tokens HMAC para o wizard de recuperação de senha via SMS OTP.
 * Validação 100% server-side — nunca importe este arquivo em componentes cliente.
 *
 * Formato interno do token (antes do base64url):
 *   "<expiry_ms>:<userId>:<hmac_hex_24>"
 */

import { createHmac, timingSafeEqual } from 'crypto';

function secret(): string {
  const s = process.env.PASSWORD_RESET_TOKEN_SECRET;
  if (!s) throw new Error('PASSWORD_RESET_TOKEN_SECRET não definida');
  return s;
}

export function generateResetToken(userId: string, expiryMinutes = 10): string {
  const expiry = Date.now() + expiryMinutes * 60 * 1000;
  const payload = `${expiry}:${userId}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex').substring(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export type ResetTokenResult =
  | { status: 'valid'; userId: string }
  | { status: 'expired' | 'invalid' };

export function verifyResetToken(token: string): ResetTokenResult {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const colonIdxFirst = decoded.indexOf(':');
    const colonIdxLast = decoded.lastIndexOf(':');
    if (colonIdxFirst === colonIdxLast || colonIdxFirst === -1) return { status: 'invalid' };

    const expiryStr = decoded.substring(0, colonIdxFirst);
    const userId = decoded.substring(colonIdxFirst + 1, colonIdxLast);
    const sig = decoded.substring(colonIdxLast + 1);

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || userId.length < 8 || sig.length < 16) return { status: 'invalid' };

    const payload = `${expiryStr}:${userId}`;
    const expectedSig = createHmac('sha256', secret()).update(payload).digest('hex').substring(0, 24);

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { status: 'invalid' };
    }
    if (Date.now() > expiry) return { status: 'expired' };

    return { status: 'valid', userId };
  } catch {
    return { status: 'invalid' };
  }
}
