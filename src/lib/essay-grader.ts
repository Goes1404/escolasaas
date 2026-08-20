/**
 * Motor de correção de redação.
 *
 * Vive fora da rota HTTP porque precisa ser chamável de scripts — recorrigir
 * uma redação já enviada, rodar calibração contra as notas dos professores,
 * comparar modelos em lote. Se o motor morasse dentro do route handler, cada
 * uma dessas coisas viraria uma reimplementação paralela, e o que se testa
 * deixaria de ser o que roda em produção.
 *
 * `/api/essay-evaluate` é uma casca fina sobre `corrigirRedacao`.
 */
import OpenAI from "openai";
import { analisarRedacao, evidenciaParaPrompt, type EssayAnalysis } from "@/lib/essay-analysis";
import { localizarTrechos } from "@/lib/essay-highlight";
import {
  COMP_KEYS, aplicarProtocoloInep, motivosDeDiscrepancia, snapCompetency, total,
  type Correcao, type ResultadoBanca,
} from "@/lib/inep-banca";

export type EntradaCorrecao = {
  theme: string;
  text: string;
  /** Textos motivadores da proposta, em texto puro. */
  motivadores?: string[];
  /** "ocr" quando o texto veio de foto — evita punir C1 por ruído de transcrição. */
  origin?: string;
  /** Modelo a usar; sobrescrevível para comparar custo e qualidade. */
  model?: string;
};

/** Erro com status HTTP, para a rota traduzir sem conhecer as regras. */
export class ErroCorrecao extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ErroCorrecao';
  }
}

const SYSTEM_PROMPT = `Você é um corretor da banca de redação do ENEM, treinado na Matriz de Referência do INEP. Sua prioridade #1 é CALIBRAÇÃO FIEL: a nota deve ser a mesma que uma banca real do INEP daria — nem mais generosa, nem mais rígida.

Você está corrigindo SOZINHO e às cegas. Não existe debate, não existe outro corretor para consultar: dê a SUA nota, com a sua leitura. (O sistema executa outras correções independentes em paralelo e aplica o protocolo oficial de discrepância depois.)

REGRAS MATEMÁTICAS E DE SAÍDA (CRÍTICO):
- A nota de CADA competência é EXCLUSIVAMENTE um destes valores: 0, 40, 80, 120, 160 ou 200. Nunca use valores intermediários (ex.: 100, 150, 175 são PROIBIDOS).
- "total_score" DEVE ser a soma exata de c1 + c2 + c3 + c4 + c5 (varia de 0 a 1000).
- Responda APENAS com JSON válido. NÃO use blocos de código Markdown. Comece com { e termine com }.

SITUAÇÕES DE ANULAÇÃO (o INEP as verifica ANTES de avaliar competências, nesta ordem):
1. Fuga ao tema — o texto trata de assunto que não corresponde ao recorte da proposta.
2. Não atendimento ao tipo textual — não é dissertativo-argumentativo (é narração, poema, receita, carta pessoal).
3. Cópia — o texto reproduz os textos motivadores sem elaboração própria.
4. Parte desconectada — trechos deliberadamente sem relação com o tema (letra de música, recados, texto aleatório).
Em qualquer desses casos, TODAS as competências recebem 0, "total_score" = 0, e o motivo é explicado de forma didática e respeitosa.
ATENÇÃO: tangenciar o tema (abordar de forma incompleta ou por um ângulo lateral) NÃO é fuga — é C2 baixa, entre 40 e 80. Zerar só quando o texto realmente trata de outro assunto.

ÂNCORAS DE BANDA POR COMPETÊNCIA (decida a nota comparando o texto com estes níveis reais do INEP — escolha o nível que melhor descreve o PADRÃO PREDOMINANTE do texto, não a melhor nem a pior frase isolada):

C1 — Domínio da norma culta:
- 200: no máximo falhas pontuais e raríssimas (1-2 deslizes em todo o texto).
- 160: poucos desvios gramaticais/ortográficos, sem comprometer a leitura.
- 120: número mediano de desvios (estrutura de frase, concordância, pontuação) — domínio tolerável mas perceptivelmente imperfeito.
- 80: domínio insuficiente — desvios frequentes que exigem esforço de leitura.
- 40: desvios sistemáticos em praticamente todos os períodos.
- 0: texto desestruturado, sem domínio mínimo da norma escrita.

C2 — Compreensão do tema + repertório sociocultural:
- 200: tema desenvolvido com repertório produtivo, de área(s) de conhecimento distinta(s) do senso comum, articulado organicamente ao argumento (não apenas citado).
- 160: repertório legitimado (autor, dado, fato histórico, obra) presente e relevante, mas com articulação um pouco menos costurada ao argumento.
- 120: repertório baseado em referências genéricas/superficiais ou citadas sem uso argumentativo real (apenas "decorativas").
- 80: desenvolvimento insuficiente do tema, recorrendo a paráfrase dos textos motivadores ou repertório quase nulo.
- 40: tangencia o tema ou usa só senso comum, sem nenhuma referência legitimada.
- 0: não atende ao tema ou ao tipo dissertativo-argumentativo.
REGRA DURA: repertório só conta como "produtivo" (160-200) se for usado para SUSTENTAR um argumento específico do texto. Repertório citado apenas para "decorar" o parágrafo (sem função argumentativa clara) trava em 120.

C3 — Projeto de texto / argumentação:
- 200: projeto estratégico e autoral; argumentos consistentes, aprofundados, articulados entre si e com conclusão que retoma a tese.
- 160: argumentos consistentes e organizados, com algum aprofundamento, autoria perceptível.
- 120: organização presente, mas argumentos previsíveis/superficiais (apresenta-mas-não-desenvolve).
- 80: indícios de organização; argumentos pouco consistentes, contraditórios ou circulares.
- 40: sem organização clara, informações desconexas ou meramente expositivas (sem defesa de tese).
- 0: fuga total à estrutura dissertativo-argumentativa.
REGRA DURA: argumento clichê (repetição de senso comum sem desenvolvimento próprio, ex.: "a educação é a base de tudo" sem aprofundar o porquê) trava em no máximo 120, mesmo que o texto seja bem escrito.

C4 — Coesão textual:
- 200: repertório diversificado de conectivos/recursos coesivos, intra e interparágrafos, sem inadequações.
- 160: boa articulação, repertório diversificado, com poucas inadequações ou repetições.
- 120: articulação presente mas com inadequações ou repertório repetitivo (mesmo conectivo reaparecendo sempre).
- 80: articulação rara — parágrafos parecem blocos isolados, poucos conectivos.
- 40: articulação quase ausente.
- 0: frases/parágrafos sem nenhuma conexão lógica.
REGRA DURA: a EVIDÊNCIA OBJETIVA abaixo traz a contagem exata de conectivos, quais se repetem e quantos parágrafos começam articulados. Use esses números — não estime "poucos" ou "muitos" por impressão.

C5 — Proposta de intervenção:
- 200: 5 elementos articulados entre si (Agente + Ação + Modo/Meio + Efeito + Detalhamento de 1+ elemento), relacionados ao tema e aos argumentos do texto.
- 160: 4 dos 5 elementos presentes e claros.
- 120: 3 dos 5 elementos presentes.
- 80: 2 dos 5 elementos presentes.
- 40: 1 elemento, ou proposta genérica/tangencial ao tema.
- 0: sem proposta, ou proposta que viola direitos humanos.
REGRA DURA: nota é estritamente matemática (nº de elementos válidos × 40). Cite literalmente cada elemento encontrado no "feedback" de C5. Não soma elemento repetido nem genérico (ex.: "o governo deveria agir" sem dizer COMO não conta como Ação).

REGRA ANTI-VIÉS BIDIRECIONAL (CRÍTICO — este é o erro mais comum a evitar):
1. VIÉS DE GENEROSIDADE (nunca infle nota de redação ruim): elogiar o esforço do aluno é papel do "general_feedback" e das "suggestions", NUNCA da nota. Uma nota 160-200 exige EVIDÊNCIA TEXTUAL CITÁVEL e específica. Se ao tentar citar um trecho que comprove excelência você não encontra nada concreto além de "o texto é razoável", a nota correta é mais baixa (80-120). Repertório de senso comum, argumentos clichês e propostas genéricas NUNCA justificam nota alta só porque "pelo menos tentou".
2. VIÉS DE RIGIDEZ (nunca castigue redação boa por detalhes irrelevantes): se o PADRÃO PREDOMINANTE do texto é forte, um erro isolado, uma vírgula fora do lugar ou um conectivo repetido NÃO deve travar a nota numa banda inferior. Um texto com 25 períodos e 1 deslize gramatical pontual é C1=200, não C1=160.
3. TESTE DE CONSISTÊNCIA OBRIGATÓRIO antes de fechar o JSON: para cada competência com nota ≥160, verifique se você conseguiria citar no mínimo 1 trecho exato do texto que prova aquele nível. Se não conseguir citar, REDUZA a nota até um nível que você consiga comprovar com citação. Para cada competência com nota ≤80, verifique se o feedback explica ESPECIFICAMENTE o que faltou (não apenas "está fraco").

DIRETRIZES DE ANCORAGEM TEXTUAL (OBRIGATÓRIO):
Cite o Texto: nos feedbacks de C2, C3, C4 e C5, use OBRIGATORIAMENTE aspas para citar trechos EXATOS da redação, provando sua conclusão. Ex.: Você apresentou ótimo repertório ao citar "Zygmunt Bauman".
- C1 (Norma Culta): se a nota for ≤160, preencha "detailed_corrections" mapeando o erro e a regra (MÁXIMO 4 erros mais graves/recorrentes). Para 200, deixe o array []. NÃO penalize escolhas estilísticas nem troque construções formais corretas (crase 'à') por coloquiais ('para a'). Só aponte erro se a norma-padrão for inquestionavelmente violada.
- Cada item de "detailed_corrections" deve trazer em "original" o trecho EXATO como está na redação (mesmas palavras, mesma grafia), para o sistema conseguir localizá-lo e destacá-lo na tela do aluno.

QUALIDADE DAS DICAS (CRÍTICO — combata feedbacks rasos):
- Cada "feedback" de competência deve ser ACIONÁVEL e ESPECÍFICO: aponte o que está faltando E como corrigir, citando o trecho da própria redação.
- PROIBIDO usar conselhos genéricos vazios como "melhore a argumentação", "revise a gramática" ou "use mais conectivos" sem mostrar ONDE e COMO no texto do aluno.
- O array "suggestions" deve conter de 3 a 5 itens, cada um sendo uma INSTRUÇÃO CONCRETA e priorizada, vinculada à competência de menor nota, com micro-exemplo de reescrita aplicado ao texto do aluno.

EXEMPLOS DE CALIBRAÇÃO (ÂNCORAS — compare a redação do aluno com estes níveis antes de pontuar):

[ÂNCORA A — Redação FORTE, ~960] "Consoante o sociólogo Zygmunt Bauman, vivemos a 'modernidade líquida', em que laços se dissolvem; tal lógica explica por que o descaso com a saúde mental juvenil se naturaliza no Brasil. Não por acaso, dados do Ministério da Saúde apontam aumento de 45% nos casos... Portanto, é imperativo que o MEC, por meio de campanhas nas escolas, promova rodas de conversa mediadas por psicólogos, a fim de romper o estigma." → C1=200, C2=200, C3=200, C4=200, C5=160 (Agente=MEC, Ação=campanhas, Meio=rodas com psicólogos, Efeito=romper estigma; faltou detalhamento). NÃO baixe C1/C3 dessa redação por um deslize isolado.

[ÂNCORA B — Redação MEDIANA, ~560] "A tecnologia é muito importante na sociedade de hoje em dia. Muitas pessoas usam o celular o tempo todo e isso pode ser ruim. Como diz o ditado, tudo que é demais faz mal. Por isso as pessoas devem usar menos o celular e os pais devem controlar os filhos." → C1=120, C2=80, C3=120, C4=120, C5=120. Aqui o erro comum é ser GENEROSO: não eleve C2/C3 só porque o texto é "educado".

[ÂNCORA C — Redação FRACA, ~360] "eu acho que esse problema é muito serio e tem que resolver. as pessoa não liga pra isso e fica pior. o governo tem que fazer alguma coisa pra ajudar todos nois." → C1=80, C2=40, C3=80, C4=40, C5=40. Aqui o erro comum é RIGIDEZ ao zerar tudo: ainda há tentativa de tese e de proposta, então não é nota 0.

REGRA DE USO DAS ÂNCORAS: para cada competência, pergunte "a redação do aluno está mais próxima da Âncora A, B ou C nesta competência?".

PASSO FINAL: revise a soma das competências e o TESTE DE CONSISTÊNCIA antes de fechar o JSON. "general_feedback" deve refletir a nota final, não o esforço percebido — não inicie com "Excelente!" se a nota for < 800; para notas baixas, tom acolhedor e encorajador, sem suavizar a nota.

FORMATO DO JSON:
{
"anulacao": null,
"total_score": 960,
"general_feedback": "...",
"competencies": {
"c1": { "score": 160, "feedback": "..." },
"c2": { "score": 200, "feedback": "..." },
"c3": { "score": 200, "feedback": "..." },
"c4": { "score": 200, "feedback": "..." },
"c5": { "score": 200, "feedback": "..." }
},
"detailed_corrections": [
{ "original": "...", "suggestion": "...", "reason": "..." }
],
"suggestions": ["..."]
}
Em caso de anulação, "anulacao" recebe um dos valores: "fuga_ao_tema", "tipo_textual", "copia", "parte_desconectada".`;

type ParsedRun = {
  competencies: Record<string, { score: number; feedback: string }>;
  vector: number[];
  detailed_corrections: any[];
  suggestions: any[];
  general_feedback: string;
  anulacao: string | null;
};

/** Normaliza um JSON cru da IA num run consistente. */
function normalizeRun(parsed: any): ParsedRun {
  const comps = parsed?.competencies || {};
  const competencies: Record<string, { score: number; feedback: string }> = {};
  const vector: number[] = [];
  for (const key of COMP_KEYS) {
    const score = snapCompetency(comps[key]?.score);
    vector.push(score);
    competencies[key] = {
      score,
      feedback: typeof comps[key]?.feedback === "string" ? comps[key].feedback : "",
    };
  }
  return {
    competencies,
    vector,
    detailed_corrections: Array.isArray(parsed?.detailed_corrections) ? parsed.detailed_corrections : [],
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
    general_feedback: typeof parsed?.general_feedback === "string" ? parsed.general_feedback : "",
    anulacao: typeof parsed?.anulacao === "string" ? parsed.anulacao : null,
  };
}

/** Monta o conteúdo enviado ao corretor. */
function montarUserContent(
  theme: string,
  text: string,
  motivadores: string[],
  origin: string | undefined,
  analise: EssayAnalysis,
): string {
  let out = `Tema: ${theme}\n\n`;

  if (motivadores.length > 0) {
    out += `Textos motivadores da proposta (copiar/parafrasear estes textos NÃO é repertório legitimado e reduz C2):\n` +
      motivadores.map((t, i) => `(${i + 1}) ${t}`).join('\n') + `\n\n`;
  }

  if (origin === "ocr") {
    out += `AVISO: este texto foi transcrito de uma FOTO da redação manuscrita. Marcações "[ilegível]" e pequenos ruídos de digitalização NÃO devem penalizar a C1 — avalie a norma culta apenas pelo que está claramente legível.\n\n`;
  }

  out += evidenciaParaPrompt(analise) + `\n\nTexto da Redação:\n${text}`;
  return out;
}

/** Resposta de anulação, montada sem gastar chamada de IA. */
function respostaAnulacao(motivo: string, explicacao: string, analise: EssayAnalysis) {
  const competencies: Record<string, { score: number; feedback: string }> = {};
  for (const k of COMP_KEYS) competencies[k] = { score: 0, feedback: explicacao };

  return {
    anulacao: motivo,
    competencies,
    total_score: 0,
    general_feedback: explicacao,
    detailed_corrections: [],
    suggestions: [
      'Reescreva o texto atendendo à proposta: dissertativo-argumentativo, com tese, argumentos próprios e proposta de intervenção.',
      'Use os textos motivadores apenas como ponto de partida — copiá-los anula a redação.',
      'Preencha ao menos 8 das 30 linhas da folha; abaixo disso o INEP considera texto insuficiente.',
    ],
    _analise: analise,
    _banca: { anulada: true, motivo },
  };
}

/**
 * Corrige uma redação seguindo o protocolo do INEP.
 *
 * Sequência: análise determinística → anulações objetivas (sem gastar IA) →
 * duas correções independentes → terceira só se houver discrepância →
 * combinação pela regra oficial.
 */
export async function corrigirRedacao(entrada: EntradaCorrecao, openai: OpenAI) {
  const { theme, text, origin, model = "gpt-4o" } = entrada;

  if (!text || typeof text !== 'string' || text.trim().length < 40) {
    throw new ErroCorrecao("Texto muito curto para avaliação.", 400);
  }

  const motivadores = (entrada.motivadores ?? []).filter(l => l.trim().length > 4);

  // ── 1. Análise determinística ──
  const analise = analisarRedacao(text, motivadores);

  // ── 2. Anulações objetivas, na hierarquia do INEP ──
  // Estas duas não dependem de julgamento: são medidas. Resolver aqui evita
  // gastar chamadas de IA para concluir o que a contagem já provou, e evita o
  // caso em que o modelo "tem pena" e dá nota a um texto anulável.
  if (analise.textoInsuficiente) {
    return respostaAnulacao(
      'texto_insuficiente',
      `Seu texto tem cerca de ${analise.linhasEstimadas} ${analise.linhasEstimadas === 1 ? 'linha' : 'linhas'} (${analise.palavras} palavras). ` +
      `O ENEM anula redações com até 7 linhas — é a regra de "texto insuficiente", e ela vem antes de qualquer avaliação de conteúdo. ` +
      `Escreva entre 25 e 30 linhas para ter todas as competências avaliadas.`,
      analise,
    );
  }

  if (analise.copiaIntegral) {
    return respostaAnulacao(
      'copia',
      `${(analise.fracaoCopiada * 100).toFixed(0)}% do seu texto reproduz literalmente os textos motivadores da proposta. ` +
      `O INEP anula a redação nesse caso: os textos de apoio servem para você refletir, não para copiar. ` +
      `Use as informações deles, mas escreva com as suas palavras e acrescente repertório próprio.`,
      analise,
    );
  }

  const userContent = montarUserContent(theme, text, motivadores, origin, analise);

  const corrigir = () =>
    openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      // Temperatura > 0 é o que torna as correções realmente independentes:
      // dois corretores idênticos não teriam por que discordar, e o protocolo
      // de discrepância não teria função.
      temperature: 0.4,
      max_tokens: 2500,
    });

  const parse = (r: PromiseSettledResult<any>): ParsedRun | null => {
    if (r.status !== "fulfilled") return null;
    try {
      return normalizeRun(JSON.parse(r.value.choices[0].message?.content || "{}"));
    } catch {
      return null;
    }
  };

  // ── 3. Dois corretores independentes, em paralelo ──
  const primeiros = await Promise.allSettled([corrigir(), corrigir()]);
  const runs: ParsedRun[] = primeiros.map(parse).filter((r): r is ParsedRun => r !== null);

  if (runs.length === 0) {
    throw new ErroCorrecao("A IA retornou um formato inesperado. Tente novamente.", 502);
  }

  // ── 4. Terceiro corretor SÓ quando há discrepância ──
  if (runs.length >= 2 && motivosDeDiscrepancia(runs[0].vector, runs[1].vector).length > 0) {
    const terceira = parse((await Promise.allSettled([corrigir()]))[0]);
    if (terceira) runs.push(terceira);
  }

  // ── 5. Anulação por julgamento — exige maioria ──
  // Um corretor sozinho não anula a redação de ninguém.
  const anulacoes = runs.map(r => r.anulacao).filter(Boolean) as string[];
  if (anulacoes.length > runs.length / 2) {
    const motivo = anulacoes[0];
    const comFeedback = runs.find(r => r.anulacao)!;
    return {
      ...respostaAnulacao(motivo, comFeedback.general_feedback, analise),
      suggestions: comFeedback.suggestions,
      _banca: { anulada: true, motivo, votos: `${anulacoes.length}/${runs.length}` },
    };
  }

  // ── 6. Combinação pela regra oficial ──
  const correcoes: Correcao[] = runs.map(r => ({ vetor: r.vector }));
  const banca: ResultadoBanca = aplicarProtocoloInep(correcoes);

  // Os textos vêm da correção mais próxima do resultado final, para que
  // feedback e nota não se contradigam.
  const representativo = runs.reduce((best, r) => {
    const dist = (v: number[]) => v.reduce((acc, s, i) => acc + Math.abs(s - banca.vetor[i]), 0);
    return dist(r.vector) < dist(best.vector) ? r : best;
  }, runs[0]);

  const competencies: Record<string, { score: number; feedback: string }> = {};
  COMP_KEYS.forEach((key, idx) => {
    competencies[key] = {
      score: banca.vetor[idx],
      feedback: representativo.competencies[key]?.feedback || "",
    };
  });

  return {
    anulacao: null,
    competencies,
    total_score: total(banca.vetor),
    detailed_corrections: localizarTrechos(text, representativo.detailed_corrections),
    suggestions: representativo.suggestions,
    general_feedback: representativo.general_feedback,
    // Espelho de correção: como a nota foi formada.
    _banca: {
      corretores: runs.map(r => ({ vetor: r.vector, total: total(r.vector) })),
      houveDiscrepancia: banca.houveDiscrepancia,
      motivos: banca.motivos,
      precisouBanca: banca.precisouBanca,
      usadas: banca.usadas,
      revisaoRecomendada: banca.precisouBanca || banca.houveDiscrepancia,
    },
    _analise: analise,
  };
}
