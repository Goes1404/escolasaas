/**
 * Recorrige uma redação já enviada, inferindo o tema a partir do próprio texto.
 *
 * Existe por causa de um defeito já corrigido: o tema vinha pré-preenchido na
 * tela, e redações escritas sobre outro assunto eram anuladas por fuga a um
 * tema que o aluno nunca escolheu. As redações continuam no banco, com o texto
 * íntegro — só a proposta que as originou se perdeu.
 *
 * Aqui o modelo lê o texto e reconstrói a proposta que ele responde, e a
 * correção roda pelo mesmo motor da produção (`corrigirRedacao`).
 *
 * Uso:
 *   npx tsx scripts/recorrigir-redacao.ts --id <uuid>       # simula, não grava
 *   npx tsx scripts/recorrigir-redacao.ts --id <uuid> --gravar
 *   npx tsx scripts/recorrigir-redacao.ts --listar           # candidatas
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { corrigirRedacao } from '../src/lib/essay-grader';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const flag = (nome: string) => args.includes(`--${nome}`);
const valor = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key);
}

function ia() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Falta OPENAI_API_KEY.');
  return new OpenAI({ apiKey: key });
}

/**
 * Reconstrói a proposta a partir do texto do aluno.
 *
 * O risco desta operação é circular: se o modelo inventa um tema colado no que
 * o aluno escreveu, a fuga ao tema fica impossível por construção e a nota de
 * C2 sobe artificialmente. Por isso o prompt pede o RECORTE, no formato de uma
 * proposta do ENEM — que é mais amplo que o texto e admite abordagens que o
 * aluno não tomou.
 */
async function inferirTema(openai: OpenAI, texto: string): Promise<{ tema: string; justificativa: string }> {
  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Você recebe uma redação dissertativo-argumentativa de um aluno brasileiro e precisa reconstruir a ' +
          'PROPOSTA DE REDAÇÃO do ENEM que ela responde.\n\n' +
          'Regras:\n' +
          '- O tema deve ter a forma de uma proposta oficial do ENEM: um recorte social amplo, ex.: ' +
          '"Desafios para o combate ao desperdício de alimentos no Brasil".\n' +
          '- NÃO resuma o texto do aluno nem copie a tese dele. O tema é mais AMPLO que a redação: outros alunos ' +
          'poderiam respondê-lo por caminhos diferentes.\n' +
          '- Se o texto tratar de vários assuntos sem foco, escolha o predominante.\n' +
          'Responda apenas JSON: {"tema": "...", "justificativa": "por que este é o recorte, em 1 frase"}',
      },
      { role: 'user', content: texto },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300,
  });

  const p = JSON.parse(r.choices[0].message?.content || '{}');
  if (!p.tema) throw new Error('O modelo não devolveu um tema.');
  return { tema: String(p.tema), justificativa: String(p.justificativa || '') };
}

async function listar() {
  const { data, error } = await db()
    .from('essay_submissions')
    .select('id, user_id, theme, content, score, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Sem embed de `profiles`: não há FK declarada entre as tabelas, então o
  // PostgREST não resolve a relação. Busca os nomes em separado.
  const ids = [...new Set((data ?? []).map(e => e.user_id))];
  const { data: perfis } = await db().from('profiles').select('id, full_name').in('id', ids);
  const nomes = new Map((perfis ?? []).map(p => [p.id, p.full_name]));

  console.log('\nRedações no banco:\n');
  for (const e of data ?? []) {
    const nome = nomes.get(e.user_id) ?? '(sem nome)';
    console.log(
      `${e.id}  ${String(e.created_at).slice(0, 10)}  ${String(e.score).padStart(4)} pts  ` +
      `${String((e.content || '').length).padStart(5)} chars  ${nome}`,
    );
    console.log(`    tema gravado: ${e.theme}`);
  }
}

async function recorrigir(id: string, gravar: boolean) {
  const supabase = db();
  const openai = ia();

  const { data: essay, error } = await supabase
    .from('essay_submissions')
    .select('id, user_id, theme, content, score, result_data, created_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!essay?.content) throw new Error('Redação sem conteúdo.');

  console.log(`\n── Redação ${id} ──`);
  console.log(`Enviada em .... ${String(essay.created_at).slice(0, 10)}`);
  console.log(`Tema gravado .. ${essay.theme}`);
  console.log(`Nota atual .... ${essay.score}`);
  console.log(`Tamanho ....... ${essay.content.length} caracteres`);

  console.log('\n1) Inferindo o tema a partir do texto…');
  const { tema, justificativa } = await inferirTema(openai, essay.content);
  console.log(`   Tema inferido: ${tema}`);
  console.log(`   Justificativa: ${justificativa}`);

  console.log('\n2) Corrigindo com o motor de produção…');
  // Sem motivadores: a proposta original se perdeu, e inventar textos de apoio
  // criaria um alvo de "cópia" que não existiu na prova real do aluno.
  const resultado = await corrigirRedacao(
    { theme: tema, text: essay.content, motivadores: [] },
    openai,
  );

  console.log(`\n── Resultado ──`);
  if (resultado.anulacao) {
    console.log(`ANULADA: ${resultado.anulacao}`);
    console.log(resultado.general_feedback);
  } else {
    for (const [k, v] of Object.entries(resultado.competencies)) {
      console.log(`  ${k.toUpperCase()}: ${String((v as any).score).padStart(3)}  ${(v as any).feedback.slice(0, 110)}…`);
    }
    console.log(`  TOTAL: ${resultado.total_score}  (antes: ${essay.score})`);
  }

  const banca: any = (resultado as any)._banca;
  if (banca?.corretores) {
    console.log('\n── Banca ──');
    banca.corretores.forEach((c: any, i: number) => {
      const usada = banca.usadas?.includes(i) ? 'usada    ' : 'descartada';
      console.log(`  Corretor ${i + 1} [${usada}]: ${c.vetor.join(' · ')} = ${c.total}`);
    });
    console.log(`  Discrepância: ${banca.houveDiscrepancia ? banca.motivos.join('; ') : 'nenhuma'}`);
  }

  const analise: any = (resultado as any)._analise;
  if (analise) {
    console.log('\n── Análise determinística ──');
    console.log(`  ${analise.palavras} palavras · ~${analise.linhasEstimadas} linhas · ${analise.paragrafos} parágrafos`);
    console.log(`  Conectivos: ${analise.conectivos.total} (${analise.conectivos.distintos} distintos)`);
    console.log(`  Intervenção: ${analise.intervencao.elementos}/5 elementos`);
  }

  if (!gravar) {
    console.log('\n(simulação — nada foi gravado. Use --gravar para aplicar.)');
    return;
  }

  const { error: upErr } = await supabase
    .from('essay_submissions')
    .update({
      theme: tema,
      score: resultado.total_score,
      feedback: resultado.general_feedback,
      result_data: {
        ...resultado,
        // Registro de que esta nota não veio do envio original.
        _recorrecao: {
          em: new Date().toISOString(),
          tema_anterior: essay.theme,
          nota_anterior: essay.score,
          tema_inferido: true,
          justificativa,
        },
      },
    })
    .eq('id', id);
  if (upErr) throw upErr;

  console.log(`\n✓ Gravado. Nota ${essay.score} → ${resultado.total_score}.`);
}

async function main() {
  if (flag('listar')) return listar();

  const id = valor('id');
  if (!id) {
    console.error('Uso: --id <uuid> [--gravar] | --listar');
    process.exit(1);
  }
  await recorrigir(id, flag('gravar'));
}

main().catch(e => {
  console.error('\nErro:', e.message);
  process.exit(1);
});
