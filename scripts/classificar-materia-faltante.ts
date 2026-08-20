/**
 * Atribui matéria às questões que entraram sem `subject_id`.
 *
 * O importador em massa deduz a matéria do cabeçalho do PDF. Quando a prova não
 * traz o cabeçalho — ou a questão cai numa página de transição — a questão entra
 * com `subject_id` nulo. Ela existe no banco, tem gabarito, e mesmo assim nunca
 * aparece para o aluno: o simulado por matéria filtra por `subject_id`.
 *
 * A lista de matérias candidatas NÃO é a tabela `subjects` inteira: é o conjunto
 * de matérias que já têm questão naquela banca. O Vestibulinho da ETEC não cobra
 * Sociologia, Filosofia nem Espanhol — oferecer essas opções ao classificador só
 * criaria matéria fantasma no seletor do aluno.
 *
 * Uso:
 *   npx tsx scripts/classificar-materia-faltante.ts --board etec --dry
 *   npx tsx scripts/classificar-materia-faltante.ts --board etec
 *
 * Idempotente: só toca questões com `subject_id IS NULL`.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { classifyIntoCategories } from '../src/services/enem-classifier';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const BOARD = args[args.indexOf('--board') + 1];
const BATCH = 15;

if (!BOARD || BOARD.startsWith('--')) {
  console.error('Informe a banca: --board etec');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  // Candidatas = matérias que já existem nessa banca.
  const { data: comMateria, error: e1 } = await supabase
    .from('questions')
    .select('subject_id, subjects!inner(id, name)')
    .eq('exam_board', BOARD)
    .not('subject_id', 'is', null);
  if (e1) throw e1;

  const candidatas = new Map<string, string>(); // nome → id
  for (const q of (comMateria ?? []) as any[]) {
    const s = q.subjects;
    if (s) candidatas.set(s.name, s.id);
  }
  if (candidatas.size === 0) throw new Error(`Nenhuma matéria com questão na banca "${BOARD}".`);

  const nomes = [...candidatas.keys()].sort();
  console.log(`\nBanca ${BOARD} · ${nomes.length} matérias candidatas: ${nomes.join(', ')}\n`);

  const { data: orfas, error: e2 } = await supabase
    .from('questions')
    .select('id, question_text, supporting_text')
    .eq('exam_board', BOARD)
    .is('subject_id', null);
  if (e2) throw e2;

  const lista = (orfas ?? []) as { id: string; question_text: string; supporting_text: string | null }[];
  console.log(`${lista.length} questões sem matéria.\n`);
  if (lista.length === 0) return;

  const contagem = new Map<string, number>();
  let gravadas = 0;
  let semResposta = 0;

  for (let i = 0; i < lista.length; i += BATCH) {
    const lote = lista.slice(i, i + BATCH);
    const res = await classifyIntoCategories(lote, nomes, `da prova ${BOARD.toUpperCase()}`, {
      // O Vestibulinho mistura texto de apoio longo com a questão avaliada.
      // Sem esta regra o modelo classifica pelo tema do texto (um texto sobre
      // agricultura vira Geografia mesmo quando a pergunta é de interpretação).
      guidance:
        'Classifique pela habilidade que a PERGUNTA cobra, não pelo tema do texto de apoio. ' +
        'Pergunta sobre sentido, coesão ou gramática do texto é Português, mesmo que o texto seja de História ou Geografia.',
    });

    const porId = new Map(res.map(r => [r.id, r.category]));
    for (const q of lote) {
      const nome = porId.get(q.id);
      if (!nome) { semResposta++; continue; }
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
      if (DRY) continue;
      const { error } = await supabase
        .from('questions')
        .update({ subject_id: candidatas.get(nome) })
        .eq('id', q.id)
        .is('subject_id', null); // corrida: não sobrescreve quem já ganhou matéria
      if (error) console.error(`  ✗ ${q.id}: ${error.message}`);
      else gravadas++;
    }
    process.stdout.write(`  ${Math.min(i + BATCH, lista.length)}/${lista.length}\r`);
  }

  console.log('\n');
  for (const [nome, n] of [...contagem].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${nome.padEnd(14)} ${n}`);
  }
  if (semResposta) console.log(`\n  ${semResposta} sem resposta válida da IA — seguem sem matéria.`);
  console.log(DRY ? '\n(simulação — nada foi gravado.)' : `\n✓ ${gravadas} questões classificadas.`);
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
