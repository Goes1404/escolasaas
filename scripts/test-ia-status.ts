/**
 * Testes da classificação de falhas da IA.
 *
 * Os erros aqui são recortes reais dos runtime logs da Vercel entre 30/07 e
 * 10/08 de 2026, quando a chave ficou sem crédito e quatro funcionalidades
 * pararam ao mesmo tempo.
 *
 * `npx tsx scripts/test-ia-status.ts`
 */
import { classificarFalhaIA, mensagemParaAluno } from '../src/lib/ia-status';

let falhas = 0;
let testes = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  testes++;
  if (condicao) console.log(`  ✓ ${nome}`);
  else { falhas++; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); }
}

console.log('\nSem crédito — formato direto da OpenAI');
{
  const erro: any = new Error(
    'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.'
  );
  erro.status = 429;
  erro.code = 'credit_balance_exhausted';
  erro.type = 'insufficient_quota';

  checar('classifica como sem_credito', classificarFalhaIA(erro) === 'sem_credito',
    classificarFalhaIA(erro));
  checar('mensagem não culpa a conexão do aluno',
    !mensagemParaAluno('sem_credito').toLowerCase().includes('conexão'),
    mensagemParaAluno('sem_credito'));
  checar('mensagem não vaza detalhe de cobrança',
    !mensagemParaAluno('sem_credito').toLowerCase().includes('credit'),
    mensagemParaAluno('sem_credito'));
}

console.log('\nSem crédito — embrulhado pelo Vercel AI SDK');
{
  // Este é o caso que engana: o AI SDK esconde o erro real em `lastError`
  // depois de esgotar as tentativas. Olhar só o topo daria "outro".
  const interno: any = new Error(
    'You have no credits remaining. Add credits to continue using the API.'
  );
  interno.statusCode = 429;
  interno.data = { error: { code: 'credit_balance_exhausted' } };

  const externo: any = new Error('Failed after 3 attempts. Last error: You have no credits remaining.');
  externo.name = 'AI_RetryError';
  externo.reason = 'maxRetriesExceeded';
  externo.lastError = interno;

  checar('enxerga através do lastError', classificarFalhaIA(externo) === 'sem_credito',
    classificarFalhaIA(externo));
}

console.log('\nOutros estados do provedor');
{
  const limite: any = new Error('Rate limit reached');
  limite.status = 429;
  checar('429 sem menção a crédito é limite_uso', classificarFalhaIA(limite) === 'limite_uso',
    classificarFalhaIA(limite));

  const chave: any = new Error('Incorrect API key provided');
  chave.status = 401;
  checar('401 é chave_invalida', classificarFalhaIA(chave) === 'chave_invalida',
    classificarFalhaIA(chave));

  const instavel: any = new Error('The server is overloaded');
  instavel.status = 503;
  checar('503 é indisponivel', classificarFalhaIA(instavel) === 'indisponivel',
    classificarFalhaIA(instavel));
}

console.log('\nErros que NÃO são do provedor');
{
  // Um bug nosso não pode virar "a IA está fora do ar" — isso esconderia o
  // defeito real atrás de um aviso de indisponibilidade.
  checar('TypeError comum é "outro"',
    classificarFalhaIA(new TypeError("Cannot read properties of undefined")) === 'outro',
    classificarFalhaIA(new TypeError("x")));
  checar('erro de parse é "outro"',
    classificarFalhaIA(new SyntaxError('Unexpected token < in JSON')) === 'outro');
  checar('null não quebra', classificarFalhaIA(null) === 'outro');
  checar('undefined não quebra', classificarFalhaIA(undefined) === 'outro');
  checar('string solta não quebra', classificarFalhaIA('deu ruim') === 'outro');
}

console.log('\nMensagens ao aluno');
{
  for (const tipo of ['sem_credito', 'limite_uso', 'chave_invalida', 'indisponivel', 'outro'] as const) {
    const m = mensagemParaAluno(tipo);
    checar(`${tipo} tem mensagem não-vazia`, m.length > 20, m);
  }
  checar('limite de uso sugere esperar',
    /espere|minuto/i.test(mensagemParaAluno('limite_uso')), mensagemParaAluno('limite_uso'));
}

console.log(`\n${testes - falhas}/${testes} testes passaram.`);
if (falhas > 0) { console.error(`${falhas} FALHA(S).`); process.exit(1); }
