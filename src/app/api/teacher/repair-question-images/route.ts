import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireTeacherOrAdmin } from '@/lib/server-auth';

interface RepairUpdate {
  questionId: string;
  imageUrl: string;
}

/**
 * Aplica imagens reparadas às questões de uma prova.
 * Segurança: exige sessão de professor/admin/staff; só aceita questões que
 * realmente pertencem à prova informada e URLs do bucket question-images
 * deste projeto (nunca URL arbitrária vinda do cliente).
 */
export async function POST(request: Request) {
  try {
    const user = await requireTeacherOrAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const examId: unknown = body?.examId;
    const updates: unknown = body?.updates;

    if (typeof examId !== 'string' || !Array.isArray(updates) || updates.length === 0 || updates.length > 300) {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
    }

    const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-images/`;
    const parsed: RepairUpdate[] = [];
    for (const u of updates) {
      const questionId = (u as RepairUpdate)?.questionId;
      const imageUrl = (u as RepairUpdate)?.imageUrl;
      if (typeof questionId !== 'string' || typeof imageUrl !== 'string' || !imageUrl.startsWith(allowedPrefix)) {
        return NextResponse.json({ error: 'Atualização inválida no payload.' }, { status: 400 });
      }
      parsed.push({ questionId, imageUrl });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Só aceita questões que pertencem à prova informada
    const { data: links, error: linkErr } = await supabaseAdmin
      .from('exam_questions')
      .select('question_id')
      .eq('exam_id', examId);
    if (linkErr) throw linkErr;

    const allowedIds = new Set((links ?? []).map(l => l.question_id as string));
    const valid = parsed.filter(u => allowedIds.has(u.questionId));
    const rejected = parsed.length - valid.length;

    let updated = 0;
    for (const u of valid) {
      const { error: upErr } = await supabaseAdmin
        .from('questions')
        .update({ image_url: u.imageUrl })
        .eq('id', u.questionId);
      if (!upErr) updated++;
    }

    return NextResponse.json({ success: true, updated, rejected });
  } catch (err: unknown) {
    console.error('[REPAIR_QUESTION_IMAGES]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erro ao aplicar imagens.' }, { status: 500 });
  }
}
