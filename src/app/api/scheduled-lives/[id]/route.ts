import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Rota de Lives Individuais compatível com Next.js 15.
 * Params devem ser tratados como uma Promise.
 */

export const dynamic = 'force-dynamic';

const getMockLive = (id: string) => ({
  id: id,
  title: 'Aula Magna de Revisão',
  teacher_name: 'Prof. Ana Lúcia',
  start_time: new Date(Date.now() + 3600 * 1000).toISOString(),
  status: 'scheduled',
  youtube_id: 'dQw4w9WgXcQ',
  description: 'Uma revisão completa dos tópicos mais importantes para o curso.'
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    if (id === 'not-found') {
        return NextResponse.json({ error: 'Transmissão não encontrada.' }, { status: 404 });
    }

    const mockLive = getMockLive(id);
    return NextResponse.json(mockLive);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}