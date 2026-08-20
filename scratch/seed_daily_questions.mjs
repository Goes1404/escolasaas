/**
 * seed_daily_questions.mjs
 * 
 * Agenda questões do dia para os próximos 30 dias (ENEM e ETEC).
 * Escolhe aleatoriamente do banco de questões existente.
 * 
 * Uso:
 *   node scratch/seed_daily_questions.mjs
 * 
 * Rodar semanalmente (todo domingo) para manter o estoque de questões.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DAYS_AHEAD = 30;

async function seedDailyQuestions() {
  console.log(`\n🎯 Seeding questões diárias para os próximos ${DAYS_AHEAD} dias...\n`);

  const audiences = ['enem', 'etec'];
  const today = new Date();

  for (const audience of audiences) {
    console.log(`\n📚 Processando: ${audience.toUpperCase()}`);

    // Busca questões disponíveis para este público
    const { data: questions, error } = await supabase
      .from('questions')
      .select('id, question_text, subjects(name)')
      .or(`target_audience.eq.all,target_audience.eq.${audience},target_audience.is.null`)
      .not('correct_answer', 'is', null)
      .limit(500);

    if (error) { console.error(`  ❌ Erro ao buscar questões: ${error.message}`); continue; }
    if (!questions || questions.length === 0) { console.warn(`  ⚠️  Sem questões para ${audience}`); continue; }

    console.log(`  ✅ ${questions.length} questões disponíveis`);

    // Busca datas já agendadas para não duplicar
    const { data: existing } = await supabase
      .from('daily_questions')
      .select('scheduled_date, question_id')
      .eq('target_audience', audience);

    const existingDates = new Set((existing || []).map(d => d.scheduled_date));
    const usedQuestionIds = new Set((existing || []).map(d => d.question_id));

    // Shuffle das questões disponíveis (excluindo já usadas se possível)
    let pool = questions.filter(q => !usedQuestionIds.has(q.id));
    if (pool.length < DAYS_AHEAD) {
      console.warn(`  ⚠️  Pool pequeno (${pool.length}), reusando questões já utilizadas`);
      pool = [...questions]; // fallback: usa todas
    }
    pool = pool.sort(() => 0.5 - Math.random());

    let scheduled = 0;
    let poolIndex = 0;

    for (let i = 0; i < DAYS_AHEAD; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);

      if (existingDates.has(dateStr)) {
        console.log(`  ⏭️  ${dateStr} já agendado — pulando`);
        continue;
      }

      if (poolIndex >= pool.length) {
        console.warn(`  ⚠️  Pool esgotado em ${dateStr}`);
        break;
      }

      const question = pool[poolIndex++];
      const { error: insertErr } = await supabase
        .from('daily_questions')
        .insert({
          question_id:     question.id,
          target_audience: audience,
          scheduled_date:  dateStr,
        });

      if (insertErr) {
        console.error(`  ❌ ${dateStr}: ${insertErr.message}`);
      } else {
        const subject = question.subjects?.name ?? 'Geral';
        console.log(`  ✅ ${dateStr}: [${subject}] ${question.question_text?.slice(0, 60)}...`);
        scheduled++;
      }
    }

    console.log(`\n  📊 ${scheduled} questões agendadas para ${audience.toUpperCase()}`);
  }

  console.log('\n✨ Seeding concluído!\n');
}

seedDailyQuestions().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
