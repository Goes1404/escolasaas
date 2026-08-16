import { NextResponse } from 'next/server';
import { respostaFalhaIA } from '@/lib/ia-status';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const toISODate = (d: Date) => d.toISOString().split('T')[0];

function getWeekStart(): string {
  // Segunda-feira da semana atual, no horário de Brasília.
  //
  // O servidor roda em UTC: domingo às 21h no Brasil já é segunda 00h UTC, e a
  // semana virava três horas antes. Quem estudava domingo à noite via esse
  // esforço cair na semana seguinte, e recebia um resumo dizendo que não tinha
  // estudado nada.
  const agoraBR = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  );
  const day = agoraBR.getDay(); // 0=dom, 1=seg...
  const diff = day === 0 ? -6 : 1 - day;
  agoraBR.setDate(agoraBR.getDate() + diff);
  agoraBR.setHours(0, 0, 0, 0);

  // Formata a data local sem passar por toISOString(), que converteria para UTC
  // e poderia devolver o dia anterior.
  const mes = String(agoraBR.getMonth() + 1).padStart(2, '0');
  const dia = String(agoraBR.getDate()).padStart(2, '0');
  return `${agoraBR.getFullYear()}-${mes}-${dia}`;
}

export async function POST(request: Request) {
  try {
    // Segurança (IDOR): o resumo é sempre do usuário AUTENTICADO. Ignora
    // qualquer userId enviado no corpo (permitia ler dados de outro aluno).
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = authUser.id;

    // O botão "Regenerar" do widget existia mas não regenerava nada: a rota
    // devolvia o resumo em cache e o ícone girava à toa. Agora o cliente pode
    // pedir explicitamente uma nova geração.
    const corpo = await request.json().catch(() => ({}));
    const forcar = corpo?.forcar === true;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const weekStart = getWeekStart();

    // Se já existe resumo desta semana, retorna ele
    const { data: existing } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (existing && !forcar) {
      return NextResponse.json({ success: true, cached: true, summary: existing });
    }

    // Coleta métricas da semana
    const weekStartDate = new Date(weekStart);
    const weekStartISO = weekStartDate.toISOString();

    const [answersRes, essaysRes, examsRes, journalRes, profileRes, flashRes, xpRes] = await Promise.all([
      supabase
        .from('student_question_answers')
        .select('is_correct, created_at, questions(subject_id, subjects(name))')
        .eq('student_id', userId)
        .gte('created_at', weekStartISO),
      supabase
        .from('essay_submissions')
        .select('score, created_at')
        .eq('user_id', userId)
        .gte('created_at', weekStartISO),
      supabase
        .from('exam_attempts')
        .select('score, completed_at')
        .eq('user_id', userId)
        .gte('completed_at', weekStartISO),
      supabase
        .from('study_journal_entries')
        .select('mood, what_studied, hours_studied, entry_date')
        .eq('user_id', userId)
        .gte('entry_date', weekStart),
      supabase
        .from('profiles')
        .select('name, exam_target')
        .eq('id', userId)
        .maybeSingle(),
      // Flashcards e XP faltavam nas métricas. Quem estudou a semana inteira
      // por flashcard recebia um resumo dizendo que não tinha respondido nada
      // — e o texto motivacional era escrito em cima desse zero.
      supabase
        .from('flashcard_progress')
        .select('question_id, last_reviewed')
        .eq('student_id', userId)
        .gte('last_reviewed', weekStartISO),
      supabase
        .from('student_xp_log')
        .select('xp_earned')
        .eq('student_id', userId)
        .gte('created_at', weekStartISO),
    ]);

    const answers = answersRes.data ?? [];
    const essays = essaysRes.data ?? [];
    const exams = examsRes.data ?? [];
    const journal = journalRes.data ?? [];
    const profile = profileRes.data;
    const flashcards = flashRes.data ?? [];
    const xpSemana = (xpRes.data ?? []).reduce((s: number, l: any) => s + (l.xp_earned ?? 0), 0);

    const totalAnswered = answers.length;
    const correct = answers.filter((a: any) => a.is_correct).length;
    const accuracy = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;

    // Acerto por matéria
    const bySubject: Record<string, { correct: number; total: number }> = {};
    for (const a of answers as any[]) {
      const subjName = a.questions?.subjects?.name ?? 'Sem matéria';
      bySubject[subjName] ??= { correct: 0, total: 0 };
      bySubject[subjName].total += 1;
      if (a.is_correct) bySubject[subjName].correct += 1;
    }
    const subjectStats = Object.entries(bySubject).map(([name, s]) => ({
      name,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      total: s.total,
    })).sort((a, b) => a.accuracy - b.accuracy);

    const weakestSubjects = subjectStats.slice(0, 3);
    const essayAvg = essays.length > 0 ? Math.round(essays.reduce((s, e: any) => s + (e.score ?? 0), 0) / essays.length) : 0;
    const examAvg = exams.length > 0 ? Math.round(exams.reduce((s, e: any) => s + (e.score ?? 0), 0) / exams.length) : 0;

    const metrics = {
      totalAnswered,
      correct,
      accuracy,
      essaysCount: essays.length,
      essayAvg,
      examsCount: exams.length,
      examAvg,
      journalEntries: journal.length,
      flashcards: flashcards.length,
      xp: xpSemana,
      weakestSubjects,
      examTarget: profile?.exam_target ?? 'ENEM',
    };

    // Gera o resumo com IA
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Você é Aurora, mentora educacional da plataforma.
Gere um resumo semanal motivacional e estratégico para o aluno **${profile?.name ?? 'Estudante'}** (foco: ${metrics.examTarget}).

Métricas da semana:
- Questões respondidas: ${totalAnswered} (${accuracy}% de acerto)
- Redações enviadas: ${essays.length} (média ${essayAvg})
- Simulados/Provas: ${exams.length} (média ${examAvg})
- Flashcards revisados: ${flashcards.length}
- XP conquistado na semana: ${xpSemana}
- Dias com diário registrado: ${journal.length}/7
- Matérias mais fracas: ${weakestSubjects.map(s => `${s.name} (${s.accuracy}%)`).join(', ') || 'sem dados'}

Retorne um JSON com:
{
  "summary": "Texto motivacional de 3-4 parágrafos curtos (use 2ª pessoa, tom acolhedor), destacando conquistas e oportunidades. Use markdown leve.",
  "recommendations": [
    { "icon": "🎯", "title": "Foco principal", "description": "..." },
    { "icon": "📚", "title": "...", "description": "..." },
    { "icon": "⚡", "title": "...", "description": "..." }
  ]
}

3 recomendações no máximo. Concretas e específicas.

REGRA IMPORTANTE: se TODAS as métricas estiverem zeradas, o aluno provavelmente
não abriu a plataforma nesta semana — não é fracasso de estudo, é ausência.
Nesse caso, escreva um convite curto e leve (2 parágrafos), sem cobrança e sem
fingir que houve desempenho a analisar. Sugira UMA ação pequena para recomeçar.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é Aurora, mentora educacional empática. Sempre responda em português do Brasil, em JSON estrito.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const aiResult = JSON.parse(completion.choices[0].message?.content ?? '{}');

    const summaryText: string = aiResult.summary ?? 'Continue firme nos estudos!';
    const recommendations = aiResult.recommendations ?? [];

    // Persiste
    // upsert e não insert: com a regeneração, um insert cru falharia na
    // segunda vez por já existir linha da mesma semana.
    const { data: saved, error: saveError } = await supabase
      .from('weekly_summaries')
      .upsert({
        user_id: userId,
        week_start: weekStart,
        summary: summaryText,
        metrics,
        recommendations,
      }, { onConflict: 'user_id,week_start' })
      .select()
      .single();

    if (saveError) {
      // Mesmo se falhar persistência, devolve o resumo gerado
      return NextResponse.json({
        success: true,
        cached: false,
        summary: { week_start: weekStart, summary: summaryText, metrics, recommendations },
      });
    }

    return NextResponse.json({ success: true, cached: false, summary: saved });
  } catch (error: any) {
    // A mensagem crua do erro ia para o cliente. Além de inútil para o aluno
    // ("You have no credits remaining..."), vazava detalhe de infraestrutura.
    return respostaFalhaIA('weekly-summary', error);
  }
}
