/**
 * Localiza os trechos apontados pela correção dentro da redação do aluno.
 *
 * Para quê: hoje as correções de C1 aparecem numa lista separada ("original →
 * sugestão"), e o aluno precisa procurar no próprio texto onde aquilo estava.
 * Com o intervalo de caracteres, a tela consegue grifar o trecho no lugar em
 * que ele foi escrito — que é como o professor corrige no papel, e o que
 * nenhum dos corretores de IA pesquisados (CorrigeAI, RedaAI) faz.
 *
 * O casamento precisa ser tolerante porque o modelo raramente devolve o trecho
 * byte a byte: normaliza espaços duplos, troca aspas curvas por retas, corta
 * quebras de linha. Um `indexOf` cru falharia na maioria dos casos reais.
 */

export type CorrecaoLocalizada = {
  original?: string;
  suggestion?: string;
  reason?: string;
  /** Índice do primeiro caractere na redação, ou null se não foi localizado. */
  start?: number | null;
  /** Índice após o último caractere. */
  end?: number | null;
  [k: string]: unknown;
};

/** Uniformiza aspas tipográficas, que o modelo troca com frequência. */
function suavizar(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

export function localizarTrechos(texto: string, correcoes: unknown[]): CorrecaoLocalizada[] {
  if (!Array.isArray(correcoes) || correcoes.length === 0) return [];

  // Texto com espaços colapsados + mapa de volta para as posições originais,
  // para que o offset devolvido aponte para o texto que o aluno realmente
  // escreveu, e não para a versão normalizada.
  const mapa: number[] = [];
  let normalizado = '';
  let anteriorEspaco = false;
  for (let i = 0; i < texto.length; i++) {
    const espaco = /\s/.test(texto[i]);
    if (espaco && anteriorEspaco) continue;
    normalizado += espaco ? ' ' : texto[i];
    mapa.push(i);
    anteriorEspaco = espaco;
  }
  const normalizadoSuave = suavizar(normalizado);

  const usados: [number, number][] = [];

  return (correcoes as CorrecaoLocalizada[]).map((c) => {
    const original = typeof c?.original === 'string' ? c.original.trim() : '';
    if (!original) return c;

    const alvo = original.replace(/\s+/g, ' ');

    // Três tentativas, da mais estrita para a mais tolerante. A ordem importa:
    // começar pela busca frouxa arriscaria casar o trecho errado quando o
    // mesmo desvio aparece mais de uma vez no texto.
    let idx = normalizado.indexOf(alvo);
    if (idx < 0) idx = normalizadoSuave.indexOf(suavizar(alvo));
    if (idx < 0) {
      // Capitalização: o modelo devolve "as pessoa que mora" para um texto que
      // começa a frase com "As pessoa que mora". Aconteceu em 1 de 4 trechos na
      // validação com redação real — sem isto, o aluno não vê o grifo do erro.
      idx = normalizadoSuave.toLowerCase().indexOf(suavizar(alvo).toLowerCase());
    }
    if (idx < 0 || idx >= mapa.length) return { ...c, start: null, end: null };

    const start = mapa[idx];
    const fimNorm = Math.min(idx + alvo.length, mapa.length) - 1;
    const end = mapa[fimNorm] + 1;

    // O modelo às vezes lista o mesmo erro duas vezes, ou um trecho contido em
    // outro. Destacar sobreposto embaralharia o texto na tela.
    if (usados.some(([s, e]) => start < e && end > s)) return { ...c, start: null, end: null };
    usados.push([start, end]);

    return { ...c, start, end };
  });
}
