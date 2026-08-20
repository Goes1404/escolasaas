/**
 * Detecta transcrição ilegível de redação manuscrita.
 *
 * O caso real que motivou este módulo (11/08/2026): um aluno fotografou a
 * redação, o OCR devolveu texto embaralhado — "as vende-as I rem principais
 * meios económicos, onde estás sempre atuanobe no nosso dia a dia sya ves
 * mercados leesoos" — e o corretor deu **zero**, com um retorno dizendo que o
 * texto do aluno tinha "desvios gramaticais sistemáticos". O aluno escreveu; a
 * máquina é que não conseguiu ler. Dar zero e culpar a escrita dele é o pior
 * resultado possível.
 *
 * ── Como detecta ──────────────────────────────────────────────────────────
 *
 * Não é dicionário: é fonotática. Português tem restrições fortes sobre quais
 * sequências de letras podem formar palavra. "atuanobe" é plausível como
 * palavra (só não existe); "sya", "vsonvênicos" e "leesoos" são impossíveis —
 * `sy` e `vs` não iniciam sílaba, e vogal dobrada só ocorre em `oo`/`ee`.
 * O OCR erra justamente aí: ele preserva as palavras curtas e frequentes
 * (artigos, preposições) e destrói as longas, produzindo impossibilidades.
 *
 * Uma métrica óbvia foi testada e **descartada**: a taxa de palavras funcionais
 * (de, a, que, para…). Ela não separa nada — a redação embaralhada marcou 40,0%
 * e as legíveis, 37% a 49%. Justamente porque o OCR acerta as palavras curtas.
 *
 * ── Calibração (10 redações reais do banco, 11/08/2026) ───────────────────
 *
 *   legíveis (notas 42 a 960) ......... 0,0% a 0,9% de palavras impossíveis
 *   OCR embaralhado (nota 0) .......... 4,2%
 *   link colado em vez do texto ....... 70,6%
 *
 * O limite de 3% fica no meio da folga, mais perto do lado permissivo: um falso
 * positivo impede o aluno de enviar uma redação boa, o que é pior do que deixar
 * passar uma transcrição sofrível. Pela mesma razão o texto curto não é julgado
 * por esta métrica — em 20 palavras, duas incomuns já dariam 10%.
 */

const VOGAIS = 'aeiouáéíóúâêôãõà';

/** Encontros consonantais que iniciam sílaba em português. */
const ONSETS = new Set([
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'vr', 'tl',
  'ch', 'lh', 'nh', 'qu', 'gu',
  // Grupos cultos: pneu, psicologia, gnomo, mnemônico, advogado, ritmo, abdômen.
  'ps', 'pn', 'gn', 'mn', 'pt', 'ct', 'bs', 'bj', 'dv', 'tm', 'bd', 'dm', 'sc',
]);

/** Consoantes que fecham sílaba (coda) e portanto podem preceder um encontro. */
const CODAS = new Set(['n', 'm', 'r', 'l', 's', 'x', 'b', 'd', 'g', 'p', 'c', 't']);

/**
 * Um grupo de consoantes no meio da palavra é possível se der para separá-lo em
 * coda + onset — "construção" tem `nstr` = n + s + tr, e é perfeitamente normal.
 */
function grupoInternoPossivel(grupo: string): boolean {
  if (grupo.length <= 2) return true;
  for (let corte = 1; corte < grupo.length; corte++) {
    const coda = grupo.slice(0, corte);
    const onset = grupo.slice(corte);
    const codaOk = [...coda].every(c => CODAS.has(c));
    const onsetOk = onset.length === 1 || ONSETS.has(onset);
    if (codaOk && onsetOk) return true;
  }
  return false;
}

/** Uma palavra que as regras do português não permitem formar. */
export function palavraImpossivel(palavra: string): boolean {
  const s = palavra.toLowerCase();
  if (s.length < 3) return false;

  const inicio = s.match(new RegExp(`^[^${VOGAIS}]+`))?.[0] ?? '';
  if (inicio.length >= 3) return true;
  if (inicio.length === 2 && !ONSETS.has(inicio)) return true;

  for (const grupo of s.match(new RegExp(`[^${VOGAIS}]{3,}`, 'g')) ?? []) {
    if (!grupoInternoPossivel(grupo)) return true;
  }

  // Vogal dobrada: das cinco, só `oo` (voo, enjoo) e `ee` (veem, creem) ocorrem —
  // e nunca duas no mesmo vocábulo, que é o que o OCR produz ("leesoos").
  const dobradas = s.match(/([aeiouáéíóúâêôãõà])\1/g) ?? [];
  if (dobradas.some(d => d !== 'oo' && d !== 'ee')) return true;
  if (dobradas.length > 1) return true;

  if (!new RegExp(`[${VOGAIS}]`).test(s)) return true;

  return false;
}

export interface Legibilidade {
  legivel: boolean;
  /** Percentual de palavras que o português não permite formar. */
  taxaImpossiveis: number;
  /** Amostra do que disparou o alerta — vai para o log do incidente, não para o aluno. */
  exemplos: string[];
  /** Mensagem para o aluno quando `legivel` é falso. */
  motivo?: string;
}

/** Acima disto a transcrição é tratada como ilegível. */
export const LIMITE_IMPOSSIVEIS = 3;

/** Abaixo deste número de palavras a métrica não é confiável. */
const MINIMO_PALAVRAS = 40;

export function avaliarLegibilidade(texto: string): Legibilidade {
  const palavras = (texto.toLowerCase().match(/[a-záéíóúâêôãõàç]+/g) ?? []).filter(p => p.length >= 3);

  if (palavras.length < MINIMO_PALAVRAS) {
    // Texto curto demais para medir. Não é aprovação: é ausência de evidência —
    // quem decide se cabe nota é o corretor, que já trata redação insuficiente.
    return { legivel: true, taxaImpossiveis: 0, exemplos: [] };
  }

  const impossiveis = palavras.filter(palavraImpossivel);
  const taxa = (impossiveis.length / palavras.length) * 100;

  if (taxa <= LIMITE_IMPOSSIVEIS) {
    return { legivel: true, taxaImpossiveis: taxa, exemplos: [] };
  }

  return {
    legivel: false,
    taxaImpossiveis: taxa,
    exemplos: [...new Set(impossiveis)].slice(0, 10),
    motivo:
      'Não conseguimos ler sua letra nesta foto — várias palavras saíram embaralhadas na ' +
      'transcrição. Isso é problema da foto, não da sua redação. Tente de novo com mais luz, ' +
      'a folha reta e o celular paralelo ao papel. Se preferir, dá para digitar o texto.',
  };
}
