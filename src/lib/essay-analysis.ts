/**
 * Análise determinística da redação, feita ANTES da IA.
 *
 * Motivo: o benchmark de correção automática em português (PROPOR 2026) mostra
 * que modelos de linguagem vão bem em argumentação (QWK 0,73) e mal em traços
 * mecânicos — estilo/coesão ficam em 0,60, contra 0,72–0,85 de concordância
 * entre humanos. Contagem de conectivo, repetição de vocábulo e cópia de texto
 * motivador não são tarefas de julgamento: são contagem. Fazer isso em código
 * dá número exato e de graça, e o modelo passa a receber evidência em vez de
 * ter que "lembrar" de conferir.
 *
 * Este módulo NÃO atribui nota — com duas exceções objetivas, que o INEP trata
 * como situação e não como avaliação: texto insuficiente e cópia integral.
 * Todo o resto vira evidência no prompt, e quem decide a nota continua sendo a
 * banca simulada.
 */

/** Conectivos e operadores argumentativos usados na avaliação de C4. */
const CONECTIVOS = [
  // adição
  'além disso', 'ademais', 'outrossim', 'igualmente', 'também', 'bem como',
  'não só', 'assim como', 'inclusive',
  // oposição
  'entretanto', 'contudo', 'todavia', 'no entanto', 'porém', 'apesar de',
  'embora', 'ainda que', 'em contrapartida', 'por outro lado', 'conquanto',
  // causa
  'porque', 'visto que', 'uma vez que', 'já que', 'devido a', 'em razão de',
  'por conta de', 'dado que', 'posto que',
  // consequência
  'portanto', 'logo', 'por conseguinte', 'consequentemente', 'de modo que',
  'assim', 'dessa forma', 'desse modo', 'por isso', 'sendo assim',
  // conclusão
  'em suma', 'portanto', 'destarte', 'diante disso', 'nesse sentido',
  'nesse viés', 'sob essa ótica', 'depreende-se',
  // exemplificação / referência
  'por exemplo', 'a exemplo de', 'conforme', 'segundo', 'consoante',
  'de acordo com', 'à luz de', 'como aponta',
  // finalidade
  'a fim de', 'para que', 'com o objetivo de', 'com o intuito de', 'de forma a',
  // tempo / ordem
  'primeiramente', 'em primeiro lugar', 'posteriormente', 'por fim',
  'atualmente', 'hodiernamente',
];

/** Conectivos tão comuns que sozinhos não demonstram repertório coesivo. */
const CONECTIVOS_GENERICOS = new Set([
  'também', 'assim', 'porque', 'por isso', 'portanto', 'além disso',
]);

/** Agentes típicos de proposta de intervenção (C5). */
const AGENTES = [
  'governo', 'estado', 'poder público', 'ministério', 'mec', 'união',
  'congresso', 'senado', 'câmara', 'prefeitura', 'município', 'escola',
  'escolas', 'família', 'famílias', 'mídia', 'imprensa', 'ong', 'ongs',
  'sociedade civil', 'iniciativa privada', 'empresas', 'judiciário',
  'secretaria', 'universidade', 'universidades', 'professores', 'onu',
];

/** Marcadores de MEIO/MODO na proposta de intervenção. */
const MEIOS = [
  'por meio de', 'por intermédio de', 'através de', 'mediante', 'via',
  'com o auxílio de', 'valendo-se de', 'utilizando', 'a partir de',
];

/** Marcadores de FINALIDADE/EFEITO na proposta de intervenção. */
const EFEITOS = [
  'a fim de', 'para que', 'com o objetivo de', 'com o intuito de',
  'de modo a', 'de forma a', 'visando', 'para', 'com a finalidade de',
];

/** Marcadores de DETALHAMENTO (explicação adicional de um dos elementos). */
const DETALHES = [
  'como', 'tais como', 'por exemplo', 'isto é', 'ou seja', 'a saber',
  'especificamente', 'no qual', 'nos quais', 'que abordem', 'que promovam',
];

/** Marcas de informalidade e de pessoalidade, impróprias ao texto dissertativo. */
const INFORMALIDADE = [
  'eu acho', 'eu penso', 'na minha opinião', 'a meu ver', 'eu acredito',
  'pra', 'pro', 'né', 'tipo assim', 'coisa', 'coisas', 'gente',
  'muito bom', 'muito ruim', 'hoje em dia', 'cada vez mais',
  'desde os primórdios', 'ao longo dos anos', 'com o passar do tempo',
];

/**
 * Palavras vazias, ignoradas na contagem de repetição vocabular — repetir
 * "de" ou "que" não é problema de estilo.
 */
const STOPWORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','do','da','dos','das','em',
  'no','na','nos','nas','por','para','com','sem','sob','sobre','entre','e',
  'ou','mas','que','se','ao','aos','à','às','pelo','pela','pelos','pelas',
  'seu','sua','seus','suas','este','esta','esse','essa','isso','isto','aquele',
  'aquela','ser','é','são','foi','era','ter','tem','têm','há','mais','menos',
  'muito','muita','muitos','muitas','como','quando','onde','qual','quais','não',
  'já','também','assim','ainda','após','antes','durante','ser','está','estão',
]);

/**
 * Palavras por linha manuscrita na folha oficial.
 *
 * A folha do ENEM tem 30 linhas e comporta cerca de 250–350 palavras, o que dá
 * ~11 palavras por linha. Estimar por PALAVRA e não por caractere porque o
 * comprimento médio da palavra varia bastante entre uma redação de repertório
 * ("hodiernamente", "problematização") e uma de vocabulário simples — medir por
 * caractere faria a mesma quantidade de linhas render estimativas diferentes só
 * pelo estilo do aluno.
 */
const PALAVRAS_POR_LINHA = 11;

export type ConectivoUso = { termo: string; ocorrencias: number };

export type ElementoIntervencao = {
  presente: boolean;
  /** Trecho que sustenta a detecção, para o corretor conferir. */
  evidencia: string;
};

export type EssayAnalysis = {
  caracteres: number;
  palavras: number;
  paragrafos: number;
  /** Linhas manuscritas equivalentes, estimadas a partir do texto digitado. */
  linhasEstimadas: number;
  /** ≤ 7 linhas: o INEP trata como texto insuficiente e anula. */
  textoInsuficiente: boolean;

  /** Fração do texto (0–1) coberta por trechos idênticos aos textos motivadores. */
  fracaoCopiada: number;
  trechosCopiados: string[];
  /** Cópia integral: o texto é essencialmente o motivador reproduzido. */
  copiaIntegral: boolean;

  conectivos: {
    total: number;
    distintos: number;
    /** Parágrafos que começam com conectivo — sinal de articulação entre blocos. */
    paragrafosArticulados: number;
    /** Conectivos usados 3+ vezes: repertório repetitivo trava C4 em 120. */
    repetidos: ConectivoUso[];
    /** Conectivos além dos genéricos ("também", "assim", "por isso"…). */
    variados: string[];
  };

  /** Palavras de conteúdo repetidas em excesso (indício de vocabulário pobre). */
  repeticoes: ConectivoUso[];
  /** Marcas de informalidade/clichê encontradas, com o trecho. */
  informalidades: string[];

  intervencao: {
    agente: ElementoIntervencao;
    acao: ElementoIntervencao;
    meio: ElementoIntervencao;
    efeito: ElementoIntervencao;
    detalhamento: ElementoIntervencao;
    /** Quantos dos 5 elementos foram detectados (0–5). */
    elementos: number;
  };
};

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function palavrasDe(texto: string): string[] {
  return normalizar(texto)
    .replace(/[^\wà-ÿ\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Conta ocorrências de um termo como sequência de palavras inteiras. */
function contarTermo(textoNorm: string, termo: string): number {
  const alvo = normalizar(termo);
  // \b não funciona bem com acento já removido em palavras compostas, então
  // exigimos limite de palavra manualmente.
  const re = new RegExp(`(^|[^\\wà-ÿ])${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\wà-ÿ]|$)`, 'g');
  return (textoNorm.match(re) || []).length;
}

/**
 * Maior sobreposição literal com os textos motivadores.
 *
 * Usa n-gramas de 8 palavras: menos que isso pega coincidência inocente
 * ("de acordo com o Ministério da Saúde"), mais que isso deixa passar cópia
 * com pequenas edições. Devolve a fração do texto do aluno coberta por
 * sequências que também aparecem nos motivadores.
 */
export function detectarCopia(
  texto: string,
  motivadores: string[],
  n = 8,
): { fracao: number; trechos: string[] } {
  const alunoPalavras = palavrasDe(texto);
  if (alunoPalavras.length < n) return { fracao: 0, trechos: [] };

  const fonte = new Set<string>();
  for (const m of motivadores) {
    const p = palavrasDe(m);
    for (let i = 0; i + n <= p.length; i++) fonte.add(p.slice(i, i + n).join(' '));
  }
  if (fonte.size === 0) return { fracao: 0, trechos: [] };

  const cobertas = new Set<number>();
  const trechos: string[] = [];
  for (let i = 0; i + n <= alunoPalavras.length; i++) {
    const gram = alunoPalavras.slice(i, i + n).join(' ');
    if (fonte.has(gram)) {
      for (let j = i; j < i + n; j++) cobertas.add(j);
      // Junta trechos contíguos em vez de listar cada janela deslizante.
      const anterior = trechos[trechos.length - 1];
      if (anterior && gram.startsWith(anterior.split(' ').slice(1).join(' '))) {
        trechos[trechos.length - 1] = `${anterior} ${alunoPalavras[i + n - 1]}`;
      } else {
        trechos.push(gram);
      }
    }
  }

  return {
    fracao: cobertas.size / alunoPalavras.length,
    trechos: trechos.slice(0, 5),
  };
}

/** Analisa a proposta de intervenção, geralmente no último parágrafo. */
function analisarIntervencao(texto: string, paragrafos: string[]): EssayAnalysis['intervencao'] {
  // O INEP procura a proposta no texto todo, mas ela quase sempre está no
  // fecho. Buscamos nos dois últimos parágrafos e caímos no texto inteiro se
  // a redação tiver menos que isso.
  const alvo = paragrafos.length >= 2
    ? paragrafos.slice(-2).join(' ')
    : texto;
  const norm = normalizar(alvo);

  const achar = (termos: string[]): ElementoIntervencao => {
    for (const t of termos) {
      if (contarTermo(norm, t) > 0) {
        const idx = norm.indexOf(normalizar(t));
        return { presente: true, evidencia: alvo.slice(Math.max(0, idx - 30), idx + 70).trim() };
      }
    }
    return { presente: false, evidencia: '' };
  };

  const agente = achar(AGENTES);
  const meio   = achar(MEIOS);
  const efeito = achar(EFEITOS);
  const detalhamento = achar(DETALHES);

  // AÇÃO: verbo de intervenção ligado ao agente. Procuramos formas típicas de
  // proposta (subjuntivo/infinitivo) em vez de "qualquer verbo", que daria
  // falso positivo em todo texto.
  const acaoRe = /\b(deve|devem|precisa|precisam|é preciso|é necessário|cabe|compete|promov\w+|implement\w+|cri\w+|realiz\w+|invest\w+|amplia\w+|garant\w+|fiscaliz\w+|capacit\w+|divulg\w+|elabor\w+)\b/i;
  const acaoMatch = alvo.match(acaoRe);
  const acao: ElementoIntervencao = acaoMatch
    ? { presente: true, evidencia: alvo.slice(Math.max(0, (acaoMatch.index ?? 0) - 30), (acaoMatch.index ?? 0) + 70).trim() }
    : { presente: false, evidencia: '' };

  const elementos = [agente, acao, meio, efeito, detalhamento].filter(e => e.presente).length;
  return { agente, acao, meio, efeito, detalhamento, elementos };
}

/** Roda a análise completa. `motivadores` são os textos de apoio da proposta. */
export function analisarRedacao(texto: string, motivadores: string[] = []): EssayAnalysis {
  const limpo = texto.trim();
  const norm = normalizar(limpo);
  const palavras = palavrasDe(limpo);
  const paragrafos = limpo.split(/\n\s*\n|\n/).map(p => p.trim()).filter(p => p.length > 0);

  const linhasEstimadas = Math.max(1, Math.ceil(palavras.length / PALAVRAS_POR_LINHA));

  // ── C4: conectivos ──
  const usos: ConectivoUso[] = [];
  for (const termo of new Set(CONECTIVOS)) {
    const n = contarTermo(norm, termo);
    if (n > 0) usos.push({ termo, ocorrencias: n });
  }
  const paragrafosArticulados = paragrafos.filter(p => {
    const inicio = normalizar(p).slice(0, 40);
    return CONECTIVOS.some(c => inicio.startsWith(normalizar(c)));
  }).length;

  // ── Repetição vocabular ──
  const freq = new Map<string, number>();
  for (const p of palavras) {
    if (p.length < 5 || STOPWORDS.has(p)) continue;
    freq.set(p, (freq.get(p) || 0) + 1);
  }
  const repeticoes = [...freq.entries()]
    .filter(([, n]) => n >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([termo, ocorrencias]) => ({ termo, ocorrencias }));

  // ── Informalidade ──
  const informalidades = INFORMALIDADE.filter(t => contarTermo(norm, t) > 0);

  // ── Cópia dos motivadores ──
  const copia = detectarCopia(limpo, motivadores);

  return {
    caracteres: limpo.length,
    palavras: palavras.length,
    paragrafos: paragrafos.length,
    linhasEstimadas,
    textoInsuficiente: linhasEstimadas <= 7,

    fracaoCopiada: copia.fracao,
    trechosCopiados: copia.trechos,
    // Acima de 90% do texto vindo dos motivadores não sobra redação nenhuma.
    copiaIntegral: copia.fracao >= 0.9,

    conectivos: {
      total: usos.reduce((s, u) => s + u.ocorrencias, 0),
      distintos: usos.length,
      paragrafosArticulados,
      repetidos: usos.filter(u => u.ocorrencias >= 3).sort((a, b) => b.ocorrencias - a.ocorrencias),
      variados: usos.map(u => u.termo).filter(t => !CONECTIVOS_GENERICOS.has(t)),
    },

    repeticoes,
    informalidades,
    intervencao: analisarIntervencao(limpo, paragrafos),
  };
}

/**
 * Converte a análise em texto para o prompt. É evidência, não veredito: o
 * corretor continua livre para discordar, mas não pode mais afirmar que "há
 * poucos conectivos" quando existem doze, nem deixar de ver uma cópia.
 */
export function evidenciaParaPrompt(a: EssayAnalysis): string {
  const linhas: string[] = [
    'EVIDÊNCIA OBJETIVA (medida por análise textual determinística — são contagens exatas, não estimativas suas):',
    `- Extensão: ${a.palavras} palavras, ${a.caracteres} caracteres, ${a.paragrafos} parágrafos, ~${a.linhasEstimadas} linhas manuscritas.`,
    `- Conectivos: ${a.conectivos.total} ocorrências de ${a.conectivos.distintos} conectivos distintos; ${a.conectivos.paragrafosArticulados} de ${a.paragrafos} parágrafos começam com conectivo.`,
  ];

  if (a.conectivos.variados.length > 0) {
    linhas.push(`- Conectivos além dos genéricos: ${a.conectivos.variados.slice(0, 12).join(', ')}.`);
  } else {
    linhas.push('- Nenhum conectivo além dos mais genéricos foi encontrado.');
  }
  if (a.conectivos.repetidos.length > 0) {
    linhas.push(`- Conectivos repetidos 3+ vezes: ${a.conectivos.repetidos.map(r => `"${r.termo}" (${r.ocorrencias}x)`).join(', ')}.`);
  }
  if (a.repeticoes.length > 0) {
    linhas.push(`- Palavras de conteúdo repetidas: ${a.repeticoes.map(r => `"${r.termo}" (${r.ocorrencias}x)`).join(', ')}.`);
  }
  if (a.informalidades.length > 0) {
    linhas.push(`- Marcas de informalidade/clichê detectadas: ${a.informalidades.map(t => `"${t}"`).join(', ')}.`);
  }
  if (a.fracaoCopiada > 0.05) {
    linhas.push(`- ⚠️ ${(a.fracaoCopiada * 100).toFixed(0)}% do texto reproduz literalmente os textos motivadores. Trechos: ${a.trechosCopiados.map(t => `"${t}"`).join(' | ')}. O INEP desconsidera trechos copiados: avalie C2 e C3 apenas pelo que é autoral.`);
  }

  const i = a.intervencao;
  linhas.push(
    `- Proposta de intervenção, elementos detectados (${i.elementos}/5): ` +
    [
      `Agente=${i.agente.presente ? 'sim' : 'NÃO'}`,
      `Ação=${i.acao.presente ? 'sim' : 'NÃO'}`,
      `Meio=${i.meio.presente ? 'sim' : 'NÃO'}`,
      `Efeito=${i.efeito.presente ? 'sim' : 'NÃO'}`,
      `Detalhamento=${i.detalhamento.presente ? 'sim' : 'NÃO'}`,
    ].join(', ') + '.',
  );
  linhas.push(
    'A detecção de elementos da intervenção é heurística e pode errar para mais (um "para" de finalidade comum contado como Efeito) ou para menos. ' +
    'Confira no texto antes de fechar C5: se um elemento detectado não sustenta a proposta de verdade, NÃO o conte.',
  );

  return linhas.join('\n');
}
