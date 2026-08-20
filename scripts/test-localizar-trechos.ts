/**
 * Testes do localizador de trechos (destaque no texto do aluno).
 * `npx tsx scripts/test-localizar-trechos.ts`
 */
import { localizarTrechos } from '../src/lib/essay-highlight';

let falhas = 0;
let testes = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  testes++;
  if (condicao) console.log(`  ✓ ${nome}`);
  else { falhas++; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); }
}

const TEXTO = `As pessoa não liga para o problema.

Além disso, o governo tem que fazer alguma coisa    para  ajudar  todos nois que sofre.`;

console.log('\nLocalização de trechos');
{
  const r = localizarTrechos(TEXTO, [
    { original: 'As pessoa não liga', suggestion: 'As pessoas não ligam', reason: 'concordância' },
  ]);
  checar('acha trecho literal', r[0].start === 0, JSON.stringify(r[0]));
  checar('offset final delimita o trecho',
    TEXTO.slice(r[0].start ?? 0, r[0].end ?? 0) === 'As pessoa não liga',
    JSON.stringify(TEXTO.slice(r[0].start ?? 0, r[0].end ?? 0)));
}

console.log('\nEspaços múltiplos e quebras de linha');
{
  // O modelo devolve o trecho com espaçamento normalizado; o texto do aluno
  // tem espaços duplicados. Sem tolerância, o destaque não apareceria.
  const r = localizarTrechos(TEXTO, [
    { original: 'para ajudar todos nois', suggestion: 'para ajudar todos nós', reason: 'ortografia' },
  ]);
  checar('acha trecho com espaçamento diferente', r[0].start !== null, JSON.stringify(r[0]));
  if (r[0].start !== null) {
    const fatia = TEXTO.slice(r[0].start ?? 0, r[0].end ?? 0);
    checar('a fatia contém o trecho', fatia.includes('nois'), JSON.stringify(fatia));
    checar('a fatia começa em "para"', fatia.startsWith('para'), JSON.stringify(fatia));
  }
}

console.log('\nTrecho inexistente');
{
  const r = localizarTrechos(TEXTO, [
    { original: 'frase que o aluno nunca escreveu', suggestion: 'x', reason: 'y' },
  ]);
  checar('devolve start null sem quebrar', r[0].start === null, JSON.stringify(r[0]));
  checar('preserva os campos originais', r[0].suggestion === 'x' && r[0].reason === 'y');
}

console.log('\nAspas curvas');
{
  const comAspas = 'Como diz o autor, “a vida é líquida” e isso muda tudo.';
  const r = localizarTrechos(comAspas, [
    { original: 'Como diz o autor, "a vida é líquida"', suggestion: 'z', reason: 'w' },
  ]);
  checar('casa aspas curvas com retas', r[0].start === 0, JSON.stringify(r[0]));
}

console.log('\nCapitalização diferente');
{
  // Caso real da validação com redação de aluno: o texto abre a frase com
  // maiúscula e o modelo devolve o trecho em minúscula.
  const r = localizarTrechos(TEXTO, [
    { original: 'as pessoa não liga', suggestion: 'As pessoas não ligam', reason: 'concordância' },
  ]);
  checar('casa ignorando maiúsculas', r[0].start === 0, JSON.stringify(r[0]));
  checar('o grifo usa o texto ORIGINAL, não o do modelo',
    TEXTO.slice(r[0].start ?? 0, r[0].end ?? 0) === 'As pessoa não liga',
    JSON.stringify(TEXTO.slice(r[0].start ?? 0, r[0].end ?? 0)));
}

console.log('\nSobreposição');
{
  const r = localizarTrechos(TEXTO, [
    { original: 'As pessoa não liga', suggestion: 'a', reason: 'b' },
    { original: 'As pessoa', suggestion: 'c', reason: 'd' },
  ]);
  checar('primeiro trecho é localizado', r[0].start === 0);
  checar('trecho sobreposto não é destacado duas vezes', r[1].start === null,
    JSON.stringify(r[1]));
}

console.log('\nEntradas inválidas');
{
  const r = localizarTrechos(TEXTO, [
    { suggestion: 'sem original' },
    { original: '   ' },
  ]);
  checar('item sem "original" passa intacto', r[0].start === undefined, JSON.stringify(r[0]));
  checar('original vazio passa intacto', r[1].start === undefined, JSON.stringify(r[1]));
  checar('lista vazia não quebra', localizarTrechos(TEXTO, []).length === 0);
}

console.log(`\n${testes - falhas}/${testes} testes passaram.`);
if (falhas > 0) { console.error(`${falhas} FALHA(S).`); process.exit(1); }
