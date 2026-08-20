/**
 * Relatório de alunos com mais de uma conta.
 *
 * Descoberto em 11/08/2026 ao preparar a entrega de acesso: 201 nomes têm mais
 * de uma conta, somando 202 contas excedentes. A base tem 1.057 contas para
 * cerca de 855 alunos reais.
 *
 * Causa: o e-mail de login é derivado do nome, e a regra mudou ao longo do
 * tempo. "Abner de Jesus Jales da Silva" gerou `abnerjsilva@` (inicial do
 * primeiro nome do meio), `abnerdsilva@` (inicial da segunda palavra — a
 * preposição "de") e `abnersilva@` (regra de duas partes). Como nomes com
 * preposição são a maioria em português, isso atingiu meio cadastro.
 *
 * Este script NÃO altera nada. Fundir contas é decisão da secretaria: o
 * boletim de um mesmo aluno está espalhado entre as contas, e escolher qual
 * sobrevive é uma escolha sobre o histórico dele, não sobre dados técnicos.
 *
 * Uso:
 *   npx tsx scripts/duplicatas-de-alunos.ts            # resumo
 *   npx tsx scripts/duplicatas-de-alunos.ts --csv      # planilha para a secretaria
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const csv = process.argv.includes('--csv');

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Linha = {
  nome: string;
  email: string;
  criada: string;
  ultimo_acesso: string | null;
  provas: number;
  boletim: number;
};

async function main() {
  const { data, error } = await db().rpc('relatorio_duplicatas_alunos');
  if (error) throw error;
  const linhas = (data ?? []) as Linha[];

  const porNome = new Map<string, Linha[]>();
  for (const l of linhas) {
    const k = l.nome.toLowerCase();
    porNome.set(k, [...(porNome.get(k) ?? []), l]);
  }

  if (csv) {
    console.log('nome,email_login,criada_em,ultimo_acesso,provas,linhas_boletim,sugestao');
    for (const [, contas] of porNome) {
      // Sugestão, não decisão: a conta com acesso vence; sem acesso, a que tem
      // mais histórico; empatado, a mais antiga.
      const principal = [...contas].sort((a, b) =>
        Number(Boolean(b.ultimo_acesso)) - Number(Boolean(a.ultimo_acesso)) ||
        (b.provas + b.boletim) - (a.provas + a.boletim) ||
        a.criada.localeCompare(b.criada),
      )[0];

      for (const c of contas) {
        const sugestao = c.email === principal.email ? 'MANTER' : 'revisar';
        console.log(
          `"${c.nome}",${c.email},${c.criada},${c.ultimo_acesso ?? ''},${c.provas},${c.boletim},${sugestao}`,
        );
      }
    }
    return;
  }

  console.log(`\n${porNome.size} alunos com mais de uma conta · ${linhas.length} contas envolvidas\n`);

  let comAcesso = 0;
  let semAcessoNenhum = 0;
  for (const [, contas] of porNome) {
    if (contas.some(c => c.ultimo_acesso)) comAcesso++;
    else semAcessoNenhum++;
  }

  console.log(`  ${comAcesso} casos em que ao menos uma conta já foi usada`);
  console.log(`  ${semAcessoNenhum} casos em que NENHUMA conta foi usada`);
  console.log(`\nExemplos:\n`);

  let mostrados = 0;
  for (const [, contas] of porNome) {
    if (mostrados++ >= 3) break;
    console.log(`  ${contas[0].nome}`);
    for (const c of contas) {
      console.log(
        `    ${c.email.padEnd(38)} criada ${c.criada}  ` +
        `acesso ${(c.ultimo_acesso ?? '—').padEnd(12)} ` +
        `provas ${c.provas}  boletim ${c.boletim}`,
      );
    }
    console.log('');
  }

  console.log('Nenhuma alteração foi feita. Use --csv para gerar a planilha da secretaria.');
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
