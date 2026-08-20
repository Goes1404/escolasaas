import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireTeacherOrAdmin } from '@/lib/server-auth';
import {
  fetchAllQuestions,
  ENEM_DISCIPLINE_TO_SUBJECT,
  EnemApiError,
} from '@/services/enem-api';

async function ensureSubject(supabaseAdmin: SupabaseClient, name: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from('subjects')
    .insert({ name })
    .select('id')
    .single();

  if (error || !created) throw new Error(`Erro ao criar disciplina "${name}": ${error?.message}`);
  return created.id;
}

export async function POST(request: Request) {
  try {
    // Requer admin ou professor (dentro do try para capturar exceções de auth)
    const user = await requireTeacherOrAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { year } = await request.json();

    if (!year || typeof year !== 'number' || year < 1998 || year > new Date().getFullYear()) {
      return NextResponse.json({ error: 'Ano inválido.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Buscar TODAS as questões da API ENEM (o serviço pagina sozinho — o teto real é 50/página)
    let apiQuestions: Awaited<ReturnType<typeof fetchAllQuestions>> = [];
    try {
      apiQuestions = await fetchAllQuestions({ year });
    } catch (err) {
      if (err instanceof EnemApiError && err.kind === 'not_found') {
        return NextResponse.json({ error: `Prova de ${year} não encontrada na API.` }, { status: 404 });
      }
      throw err;
    }

    if (apiQuestions.length === 0) {
      return NextResponse.json({ error: 'Nenhuma questão retornada pela API.', inserted: 0 }, { status: 200 });
    }

    // 2. Cache de subject_ids por discipline
    const subjectCache: Record<string, string> = {};
    for (const [disc, subjectName] of Object.entries(ENEM_DISCIPLINE_TO_SUBJECT)) {
      subjectCache[disc] = await ensureSubject(supabaseAdmin, subjectName);
    }

    // 3. Verificar se já existe prova ENEM para o ano
    let examId: string;
    const { data: existingExam } = await supabaseAdmin
      .from('exams')
      .select('id')
      .eq('year', year)
      .eq('exam_type', 'enem')
      .maybeSingle();

    if (existingExam) {
      examId = existingExam.id;
    } else {
      const { data: newExam, error: examErr } = await supabaseAdmin
        .from('exams')
        .insert({
          title: `ENEM ${year}`,
          year,
          exam_type: 'enem',
          teacher_id: user.id,
        })
        .select('id')
        .single();

      if (examErr || !newExam) throw new Error(`Erro ao criar exame: ${examErr?.message}`);
      examId = newExam.id;
    }

    // 4. Mapear e inserir questões (skip duplicatas por índice+ano)
    let inserted = 0;
    let skipped = 0;

    const questionsToInsert = apiQuestions.map((q: any) => {
      const disc = q.discipline ?? 'linguagens';
      const subject_id = subjectCache[disc] ?? subjectCache['linguagens'];

      const options = (q.alternatives ?? []).map((a: any) => ({
        key: a.letter,
        text: a.text ?? '',
      }));

      const correct_answer = q.correctAlternative ?? 'A';

      const contextText: string = q.context ?? '';
      const mdImageMatch = contextText.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      const imageFromContext = mdImageMatch?.[1] ?? null;
      const imageFromFiles = q.files?.find((f: any) => typeof f === 'string' && f.startsWith('http')) ?? null;
      const image_url = imageFromFiles ?? imageFromContext;
      const supporting_text = contextText.replace(/!\[.*?\]\(https?:\/\/[^)]+\)/g, '').trim() || null;

      return {
        question_text: q.alternativesIntroduction ?? q.title ?? `Questão ${q.index}`,
        supporting_text,
        image_url,
        options,
        correct_answer,
        subject_id,
        target_audience: 'enem',
        explanation: null,
      };
    });

    // Inserir em batches de 20 (evitar timeout)
    const BATCH = 20;
    const insertedIds: string[] = [];

    for (let i = 0; i < questionsToInsert.length; i += BATCH) {
      const batch = questionsToInsert.slice(i, i + BATCH);
      const { data: rows, error: insErr } = await supabaseAdmin
        .from('questions')
        .insert(batch)
        .select('id');

      if (insErr) {
        // Se falhar por duplicata ou outro erro, pular o batch
        skipped += batch.length;
        continue;
      }

      if (rows) {
        insertedIds.push(...rows.map((r: any) => r.id));
        inserted += rows.length;
      }
    }

    // 5. Vincular questões ao exame (exam_questions), ignorando já existentes
    if (insertedIds.length > 0) {
      const existingLinks = await supabaseAdmin
        .from('exam_questions')
        .select('question_id')
        .eq('exam_id', examId);

      const already = new Set((existingLinks.data ?? []).map((r: any) => r.question_id));

      const links = insertedIds
        .filter(id => !already.has(id))
        .map((question_id, idx) => ({ exam_id: examId, question_id, order_index: idx + 1 }));

      if (links.length > 0) {
        await supabaseAdmin.from('exam_questions').insert(links);
      }
    }

    return NextResponse.json({
      success: true,
      year,
      total: apiQuestions.length,
      inserted,
      skipped,
      examId,
    });

  } catch (err: any) {
    console.error('[ENEM_IMPORT]', err);
    return NextResponse.json({ error: err.message ?? 'Erro ao importar.' }, { status: 500 });
  }
}
