/**
 * Testes do detector de transcrição ilegível.
 *
 *   npx tsx scripts/test-legibilidade.ts
 *
 * O texto embaralhado é o caso real de 11/08/2026 (redação que tirou zero
 * porque o OCR não leu a letra do aluno). Os legíveis também vêm do banco.
 */
import { avaliarLegibilidade, palavraImpossivel } from '../src/lib/essay-legibilidade';

let ok = 0;
let falhou = 0;

function teste(nome: string, condicao: boolean, detalhe = '') {
  if (condicao) { ok++; console.log(`  ✓ ${nome}`); }
  else { falhou++; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); }
}

// ── Palavras que o português permite ───────────────────────────────────────
console.log('\nPalavras legítimas (não podem ser marcadas como impossíveis):');
const legitimas = [
  'construção', 'instruindo', 'monstro', 'abstrato', 'transporte', 'perspectiva',
  'lembrando', 'ritmo', 'advogado', 'pneumático', 'psicologia', 'gnomo', 'mnemônico',
  'voo', 'enjoo', 'veem', 'crescer', 'excelente', 'subscrever', 'obstrução',
  'compreensão', 'inscrição', 'substrato', 'interdisciplinaridade', 'sociedade',
  'desigualdade', 'conscientização', 'tecnológica', 'infraestrutura',
];
for (const p of legitimas) teste(p, !palavraImpossivel(p));

// ── Palavras que o português não permite ───────────────────────────────────
console.log('\nPalavras impossíveis (o OCR embaralhado as produz):');
const impossiveis = ['sya', 'leesoos', 'vsonvênicos', 'markting', 'nzmxntiyndoyzdg', 'mzk'];
for (const p of impossiveis) teste(p, palavraImpossivel(p));

// ── Textos inteiros ────────────────────────────────────────────────────────
const EMBARALHADO = `
Atualmente as vende-as I rem principais meios económicos, onde estás sempre atuanobe no nosso
dia a dia sya ves mercados leesoos de reapas acuários ca comida. Claro que quando falamos als
vendee não é só meio físico, mas vendas onlines que rão tanto nacional, quanto internacional,
Mas no fim das contas, o porque compromen fer trás de todo mio de vendas tem o markting a
propagander e diceulgação. Somos mocidos a compra, a necessidade de obter duersas casas mesmee
não precisa. Nos tempos de los podemos lidar mella com isso, criando limites vsonvênicos e
Alemprando somente e necessário, mar não quer dizer que vod não merece se divertir e a porocitor,
pole cadrario se organize e vise o dinheiro das compras de maneiro efisante`;

// Redação fraca, com erros — mas legível. É a que NÃO pode ser barrada.
const FRACA_MAS_LEGIVEL = `
No Brasil, o desperdício de alimentos é frequente, especialmente através do resto de pratos,
lixos em restaurantes e ambientes escolares, sendo a quantidade discrepante. Ademais, no Novela
Carrossel, uma menina chamada Carmen passava fome, enquanto sua colega de classe Maria Joaquina
comia um lanche, mas depois no lixo, que deixou a Carmen com fome, pegar o lanche e o comeu.
Portanto, esta situação mostra o quanto o desperdício de alimentos é péssimo, porque enquanto um
tem o algo para comer outros não possuem nada, e isso ocorre diariamente e de forma constante.
Entretanto, o único de doações para a população, deve continuar, e ter um caminho viável, para
pessoas que não tem o que comer, ajudando a humanidade em conjunto com o ambiente.`;

const BOA = `
A Constituição Federal de 1988 assegura a todos os cidadãos o direito à informação, à educação e
ao pleno exercício da cidadania. Todavia, na contemporaneidade brasileira, a efetivação dessas
garantias encontra um gargalo expressivo na assimetria do acesso às tecnologias de informação e
comunicação. Nesse cenário, a exclusão tecnológica manifesta-se sob duas vias cruciais: a
disparidade socioeconômica na infraestrutura de acesso e o incipiente letramento digital da
população. Desse modo, torna-se imperativo analisar esses entraves para viabilizar uma sociedade
verdadeiramente inclusiva e construir polos digitais comunitários nas escolas públicas.`;

console.log('\nTextos inteiros:');
const a = avaliarLegibilidade(EMBARALHADO);
teste('OCR embaralhado é barrado', !a.legivel, `taxa ${a.taxaImpossiveis.toFixed(1)}%`);
teste('barrado traz mensagem ao aluno', Boolean(a.motivo));
teste('mensagem não culpa a escrita do aluno', !!a.motivo && a.motivo.includes('problema da foto'));

const b = avaliarLegibilidade(FRACA_MAS_LEGIVEL);
teste('redação fraca porém legível passa', b.legivel, `taxa ${b.taxaImpossiveis.toFixed(1)}%`);

const c = avaliarLegibilidade(BOA);
teste('redação boa passa', c.legivel, `taxa ${c.taxaImpossiveis.toFixed(1)}%`);

// Margem entre os dois lados: é o que sustenta o limite escolhido.
teste(
  'há folga entre legível e ilegível',
  a.taxaImpossiveis > Math.max(b.taxaImpossiveis, c.taxaImpossiveis) * 3 + 1,
  `ilegível ${a.taxaImpossiveis.toFixed(1)}% vs legíveis ${b.taxaImpossiveis.toFixed(1)}%/${c.taxaImpossiveis.toFixed(1)}%`,
);

console.log('\nTexto curto:');
const curto = avaliarLegibilidade('Sou contra o desperdício de comida no Brasil de hoje.');
teste('texto curto não é julgado por esta métrica', curto.legivel);

console.log(`\n${ok} passaram · ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
