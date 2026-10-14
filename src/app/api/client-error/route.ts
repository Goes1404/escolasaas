import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

/**
 * Recebe falhas de tela do navegador (ErrorScreen) e registra nos logs da
 * Vercel. Cobre quem não está logado (login, primeiro acesso), que a
 * telemetria — gravada por usuário — não alcança.
 *
 * Não grava nada no banco e só aceita campos curtos e sem PII: rota
 * normalizada, nome do erro, mensagem truncada e o `digest` do Next.
 */
export const runtime = 'nodejs';

const MAX = 600;
const corta = (v: unknown, n = MAX) => (typeof v === 'string' ? v.slice(0, n) : undefined);

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 4000) return NextResponse.json({ ok: false }, { status: 413 });
    const body = JSON.parse(text || '{}');
    log.error('client.render_error', new Error(corta(body.message) || 'erro sem mensagem'), {
      route: corta(body.route, 200),
      name: corta(body.name, 80),
      digest: corta(body.digest, 80),
      ua: corta(req.headers.get('user-agent'), 160),
    });
  } catch {
    // corpo inválido: ignora em silêncio
  }
  return NextResponse.json({ ok: true });
}
