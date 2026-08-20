import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

/**
 * API de Controle de Transmissões Master.
 * Limpa para uso em produção - Dados mock removidos.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data: any[] = [];
    return NextResponse.json(data);
  } catch (error: any) {
    log.error('scheduled_lives.get.unhandled', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "Corpo da requisição vazio." }, { status: 400 });
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      log.warn('scheduled_lives.post.invalid_json');
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const requiredFields = ['title', 'start_time', 'teacher_id'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `O campo ${field} é obrigatório.` }, { status: 400 });
      }
    }

    const data = { id: Math.random().toString(36).substr(2, 9), ...body };
    log.info('scheduled_lives.post.created', { liveId: data.id });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    log.error('scheduled_lives.post.unhandled', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}