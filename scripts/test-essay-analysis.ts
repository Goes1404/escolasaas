/**
 * Testes da análise determinística de redação.
 *
 * Roda sem rede e sem OpenAI — é justamente o ponto de tirar essas medidas do
 * modelo. `npx tsx scripts/test-essay-analysis.ts`
 */
import { analisarRedacao, detectarCopia, evidenciaParaPrompt } from '../src/lib/essay-analysis';

let falhas = 0;
let testes = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  testes++;
  if (condicao) {
    console.log(`  ✓ ${nome}`);
  } else {
    falhas++;
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

// ── Amostras ────────────────────────────────────────────────────────────────

const MOTIVADOR =
  'O desperdício na cadeia logística de alimentos agrava as crises sociais e ' +
  'ambientais do país, segundo levantamento da ONU Brasil divulgado em 2023.';

const FORTE = `Consoante o sociólogo Zygmunt Bauman, vivemos a "modernidade líquida", em que os laços sociais se dissolvem com rapidez. Tal lógica explica por que o descaso com a saúde mental juvenil se naturaliza no Brasil contemporâneo, uma vez que o sofrimento é tratado como fraqueza individual e não como questão coletiva.

Em primeiro lugar, cabe destacar que a ausência de política pública consolidada agrava o quadro. Segundo dados do Ministério da Saúde, houve aumento expressivo dos casos de ansiedade entre adolescentes na última década. Nesse sentido, a escola, que poderia funcionar como espaço de acolhimento, limita-se a cobrar desempenho, uma vez que o próprio corpo docente carece de formação específica.

Por outro lado, a naturalização do sofrimento encontra respaldo na lógica de produtividade descrita por Byung-Chul Han, para quem o sujeito contemporâneo se explora voluntariamente. Dessa forma, o adolescente internaliza a cobrança e evita pedir ajuda, o que retroalimenta o estigma.

Portanto, é imperativo que o Ministério da Educação promova, por meio de rodas de conversa mediadas por psicólogos nas escolas públicas, a discussão sobre saúde mental, a fim de romper o estigma que impede o pedido de ajuda. Tal medida deve ser detalhada em cartilhas distribuídas aos professores, que abordem sinais de alerta e fluxos de encaminhamento.`;

const FRACA = `eu acho que esse problema é muito serio e tem que resolver. as pessoa não liga pra isso e fica pior a cada dia que passa na sociedade.

hoje em dia todo mundo fala disso mas ninguem faz nada. o governo tem que fazer alguma coisa pra ajudar todos nois que sofre com isso.`;

const CURTA = 'A tecnologia é importante. Muita gente usa celular. Isso pode ser ruim para todos.';

const COPIADA = `O desperdício na cadeia logística de alimentos agrava as crises sociais e ambientais do país, segundo levantamento da ONU Brasil divulgado em 2023.`;

// ── Extensão e texto insuficiente ───────────────────────────────────────────

console.log('\nExtensão / texto insuficiente');
{
  const curta = analisarRedacao(CURTA);
  checar('texto curto é marcado como insuficiente', curta.textoInsuficiente,
    `linhas=${curta.linhasEstimadas}`);

  const forte = analisarRedacao(FORTE);
  checar('redação completa NÃO é insuficiente', !forte.textoInsuficiente,
    `linhas=${forte.linhasEstimadas}`);
  // 207 palavras ÷ 11 por linha ≈ 19 linhas — uma redação curta, mas dentro da
  // folha de 30 linhas e bem acima do limite de anulação.
  checar('estimativa de linhas é coerente com a folha de 30 linhas',
    forte.linhasEstimadas >= 15 && forte.linhasEstimadas <= 30,
    `linhas=${forte.linhasEstimadas}, palavras=${forte.palavras}`);

  // Fronteira da regra do INEP: 7 linhas anula, 8 não.
  const seteLinhas = analisarRedacao(Array.from({ length: 77 }, (_, i) => `palavra${i}`).join(' '));
  const oitoLinhas = analisarRedacao(Array.from({ length: 88 }, (_, i) => `palavra${i}`).join(' '));
  checar('77 palavras (7 linhas) = insuficiente', seteLinhas.textoInsuficiente,
    `linhas=${seteLinhas.linhasEstimadas}`);
  checar('88 palavras (8 linhas) = suficiente', !oitoLinhas.textoInsuficiente,
    `linhas=${oitoLinhas.linhasEstimadas}`);
  checar('conta parágrafos corretamente', forte.paragrafos === 4,
    `paragrafos=${forte.paragrafos}`);
}

// ── Cópia dos motivadores ───────────────────────────────────────────────────

console.log('\nCópia dos textos motivadores');
{
  const copia = detectarCopia(COPIADA, [MOTIVADOR]);
  checar('cópia literal é detectada com fração alta', copia.fracao >= 0.9,
    `fracao=${copia.fracao.toFixed(2)}`);

  const analise = analisarRedacao(COPIADA, [MOTIVADOR]);
  checar('cópia integral levanta a flag', analise.copiaIntegral);

  const limpa = detectarCopia(FORTE, [MOTIVADOR]);
  checar('texto autoral não acusa cópia', limpa.fracao === 0,
    `fracao=${limpa.fracao.toFixed(2)}`);

  // Uma citação curta e legítima não pode ser tratada como cópia.
  const citacao = detectarCopia(
    'Como aponta a ONU Brasil, o desperdício agrava crises. Contudo, o problema é mais amplo e exige ação coordenada do Estado brasileiro.',
    [MOTIVADOR],
  );
  checar('citação curta não é acusada de cópia', citacao.fracao < 0.3,
    `fracao=${citacao.fracao.toFixed(2)}`);
}

// ── Conectivos (C4) ─────────────────────────────────────────────────────────

console.log('\nConectivos / coesão (C4)');
{
  const forte = analisarRedacao(FORTE);
  checar('detecta repertório coesivo variado', forte.conectivos.distintos >= 8,
    `distintos=${forte.conectivos.distintos}: ${forte.conectivos.variados.join(', ')}`);
  checar('detecta parágrafos articulados', forte.conectivos.paragrafosArticulados >= 2,
    `articulados=${forte.conectivos.paragrafosArticulados}`);
  checar('acha conectivos não-genéricos', forte.conectivos.variados.length >= 5,
    forte.conectivos.variados.join(', '));

  const fraca = analisarRedacao(FRACA);
  checar('texto sem articulação tem poucos conectivos distintos',
    fraca.conectivos.distintos <= 3,
    `distintos=${fraca.conectivos.distintos}: ${fraca.conectivos.variados.join(', ')}`);
}

// ── Informalidade ───────────────────────────────────────────────────────────

console.log('\nInformalidade e clichê');
{
  const fraca = analisarRedacao(FRACA);
  checar('acha "eu acho"', fraca.informalidades.includes('eu acho'), fraca.informalidades.join(', '));
  checar('acha "hoje em dia"', fraca.informalidades.includes('hoje em dia'));
  checar('acha "pra"', fraca.informalidades.includes('pra'));

  const forte = analisarRedacao(FORTE);
  checar('texto formal não acusa "eu acho"', !forte.informalidades.includes('eu acho'),
    forte.informalidades.join(', '));
}

// ── Proposta de intervenção (C5) ────────────────────────────────────────────

console.log('\nProposta de intervenção (C5)');
{
  const forte = analisarRedacao(FORTE);
  const i = forte.intervencao;
  checar('detecta Agente', i.agente.presente, i.agente.evidencia);
  checar('detecta Ação', i.acao.presente, i.acao.evidencia);
  checar('detecta Meio', i.meio.presente, i.meio.evidencia);
  checar('detecta Efeito', i.efeito.presente, i.efeito.evidencia);
  checar('detecta Detalhamento', i.detalhamento.presente, i.detalhamento.evidencia);
  checar('conta 5 elementos na proposta completa', i.elementos === 5, `elementos=${i.elementos}`);

  const fraca = analisarRedacao(FRACA);
  checar('proposta genérica não fecha 5 elementos', fraca.intervencao.elementos < 5,
    `elementos=${fraca.intervencao.elementos}`);
}

// ── Repetição vocabular ─────────────────────────────────────────────────────

console.log('\nRepetição vocabular');
{
  const repetitivo = analisarRedacao(
    'A educação é importante. A educação transforma. A educação liberta. A educação muda vidas. ' +
    'Sem educação não há futuro para a educação brasileira.',
  );
  const achou = repetitivo.repeticoes.find(r => r.termo === 'educacao');
  checar('detecta palavra repetida', !!achou, JSON.stringify(repetitivo.repeticoes));
  checar('conta as ocorrências', (achou?.ocorrencias ?? 0) >= 6, `n=${achou?.ocorrencias}`);
}

// ── Texto do prompt ─────────────────────────────────────────────────────────

console.log('\nEvidência para o prompt');
{
  const forte = analisarRedacao(FORTE, [MOTIVADOR]);
  const txt = evidenciaParaPrompt(forte);
  checar('menciona contagem de palavras', txt.includes(`${forte.palavras} palavras`));
  checar('menciona conectivos', /Conectivos: \d+ ocorrências/.test(txt));
  checar('menciona os 5 elementos da intervenção', txt.includes('(5/5)'), txt);
  checar('avisa que a heurística pode errar', txt.includes('heurística'));

  const copiada = analisarRedacao(COPIADA, [MOTIVADOR]);
  checar('avisa sobre cópia quando existe', evidenciaParaPrompt(copiada).includes('reproduz literalmente'));
}

// ── Resultado ───────────────────────────────────────────────────────────────

console.log(`\n${testes - falhas}/${testes} testes passaram.`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S).`);
  process.exit(1);
}
