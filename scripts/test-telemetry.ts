/**
 * Testes do saneamento da telemetria.
 *
 * O que está sendo protegido: alunos são majoritariamente menores, e estes
 * eventos vão para uma tabela que professores e admins leem. Um vazamento aqui
 * não é bug de métrica, é exposição de dado pessoal.
 *
 * `npx tsx scripts/test-telemetry.ts`
 */
import { normalizarRota, sanitizarProps } from '../src/lib/telemetry';

let falhas = 0;
let testes = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  testes++;
  if (condicao) console.log(`  ✓ ${nome}`);
  else { falhas++; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); }
}

console.log('\nNormalização de rota');
{
  checar('rota simples não muda',
    normalizarRota('/dashboard/student/essays') === '/dashboard/student/essays',
    normalizarRota('/dashboard/student/essays'));

  checar('UUID vira [id]',
    normalizarRota('/dashboard/student/provas/fed83180-ad79-4d3d-baca-78d1a246805d')
      === '/dashboard/student/provas/[id]',
    normalizarRota('/dashboard/student/provas/fed83180-ad79-4d3d-baca-78d1a246805d'));

  checar('número vira [id]',
    normalizarRota('/dashboard/admin/students/12345') === '/dashboard/admin/students/[id]',
    normalizarRota('/dashboard/admin/students/12345'));

  checar('palavra normal não é confundida com id',
    normalizarRota('/dashboard/teacher/analytics') === '/dashboard/teacher/analytics');

  checar('raiz não quebra', normalizarRota('/') === '/');

  // Um segmento longo sem vogal é token/hash, não nome de tela.
  checar('token longo vira [id]',
    normalizarRota('/g/xzkbcdfghjklmnpqrst') === '/g/[id]',
    normalizarRota('/g/xzkbcdfghjklmnpqrst'));
}

console.log('\nSaneamento de propriedades — o que PASSA');
{
  const p = sanitizarProps({ nota: 840, chars: 2652, acertos: 7, concluiu: true, banca: 'fuvest' });
  checar('número passa', p?.nota === 840);
  checar('booleano passa', p?.concluiu === true);
  checar('string curta passa', p?.banca === 'fuvest');
  checar('mantém todas as chaves válidas', Object.keys(p ?? {}).length === 5, JSON.stringify(p));
}

console.log('\nSaneamento de propriedades — o que É BARRADO');
{
  const p = sanitizarProps({
    full_name: 'Lucas Costa Barbalarga',
    email: 'aluno@compromisso.com',
    telefone: '11999998888',
    senha: 'compromisso2026',
    token: 'eyJhbGciOi',
    texto: 'A redação inteira do aluno...',
    conteudo: 'mais texto',
    feedback: 'comentário do corretor',
    nota: 840,
  });
  checar('nome é barrado', p?.full_name === undefined, JSON.stringify(p));
  checar('e-mail é barrado', p?.email === undefined);
  checar('telefone é barrado', p?.telefone === undefined);
  checar('senha é barrada', p?.senha === undefined);
  checar('token é barrado', p?.token === undefined);
  checar('texto do aluno é barrado', p?.texto === undefined);
  checar('conteúdo é barrado', p?.conteudo === undefined);
  checar('feedback é barrado', p?.feedback === undefined);
  checar('o dado legítimo sobrevive', p?.nota === 840, JSON.stringify(p));
}

console.log('\nSaneamento — texto livre e tipos complexos');
{
  const longa = 'x'.repeat(200);
  const p = sanitizarProps({ mensagem: longa, lista: [1, 2, 3], objeto: { a: 1 }, nulo: null, n: 5 });
  checar('string longa é descartada (pode ser texto do aluno)', p?.mensagem === undefined);
  checar('array é descartado', p?.lista === undefined);
  checar('objeto é descartado', p?.objeto === undefined);
  checar('null é descartado', p?.nulo === undefined);
  checar('número sobrevive', p?.n === 5, JSON.stringify(p));
}

console.log('\nCasos de borda');
{
  checar('sem props devolve null', sanitizarProps(undefined) === null);
  checar('props vazio devolve null', sanitizarProps({}) === null);
  checar('só PII devolve null', sanitizarProps({ nome: 'Ana', email: 'a@b.c' }) === null,
    JSON.stringify(sanitizarProps({ nome: 'Ana', email: 'a@b.c' })));
  checar('NaN é descartado', sanitizarProps({ x: NaN }) === null);
  checar('chave maiúscula também é barrada',
    sanitizarProps({ EMAIL: 'a@b.c', n: 1 })?.EMAIL === undefined);
}

console.log(`\n${testes - falhas}/${testes} testes passaram.`);
if (falhas > 0) { console.error(`${falhas} FALHA(S).`); process.exit(1); }
